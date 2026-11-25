"""Real REST adapters. No retries, redirects, provider-controlled tools, or raw error logs."""
import re
import socket
import ssl
import time
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, HTTPSHandler, ProxyHandler, Request, build_opener
from .common import canonical, digest, parse


class ProviderError(Exception):
    """Only an enumerated nonsecret diagnostic may leave the adapter."""
    def __init__(self, code):
        super().__init__(code)
        self.code = code


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ProviderError('REDIRECT_REJECTED')


def http_post(url, headers, payload, timeout):
    # Explicit hosts below, default TLS verification, no environment proxy or redirect.
    opener = build_opener(ProxyHandler({}), _NoRedirect(), HTTPSHandler(context=ssl.create_default_context()))
    request = Request(url, data=canonical(payload).encode('utf-8'), headers=headers, method='POST')
    with opener.open(request, timeout=timeout) as response:
        body = response.read(1024 * 1024 + 1)
        if len(body) > 1024 * 1024:
            raise ProviderError('RESPONSE_TOO_LARGE')
        return parse(body.decode('utf-8'))


def output_schema(labels):
    return {'type': 'object', 'properties': {'labels': {'type': 'array',
            'items': {'type': 'string', 'enum': list(labels)}}},
            'required': ['labels'], 'additionalProperties': False}


def payload(provider, model, instructions, text, labels, max_output_tokens):
    """Only the common review body enters the user input. No gold, IDs or metadata."""
    if (provider not in ('openai', 'gemini') or not isinstance(model, str)
            or re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,127}', model) is None):
        raise ProviderError('INVALID_PROVIDER_MODEL')
    if (not isinstance(text, str) or not text.strip() or not isinstance(instructions, str)
            or not instructions.strip() or type(max_output_tokens) is not int
            or not 128 <= max_output_tokens <= 8192):
        raise ProviderError('INVALID_REQUEST_CONFIGURATION')
    schema = output_schema(labels)
    if provider == 'openai':
        return {'model': model, 'instructions': instructions,
                'input': [{'role': 'user', 'content': [{'type': 'input_text', 'text': text}]}],
                'max_output_tokens': max_output_tokens, 'store': False,
                'text': {'format': {'type': 'json_schema', 'name': 'review_labels',
                                    'strict': True, 'schema': schema}}}
    return {'systemInstruction': {'parts': [{'text': instructions}]},
            'contents': [{'role': 'user', 'parts': [{'text': text}]}],
            'generationConfig': {'candidateCount': 1, 'maxOutputTokens': max_output_tokens,
                                 'responseMimeType': 'application/json', 'responseJsonSchema': schema}}


def _usage(values, names):
    if values is None:
        return {name: None for name in names}
    if not isinstance(values, dict):
        raise ProviderError('INVALID_USAGE')
    result = {}
    for name in names:
        value = values.get(name)
        if value is not None and (type(value) is not int or value < 0):
            raise ProviderError('INVALID_USAGE')
        result[name] = value
    return result


def parse_response(provider, response, allowed_labels):
    try:
        if not isinstance(response, dict):
            raise ProviderError('INVALID_RESPONSE')
        if provider == 'openai':
            if response.get('error'):
                raise ProviderError('PROVIDER_RESPONSE_ERROR')
            if response.get('status') != 'completed' or response.get('incomplete_details'):
                raise ProviderError('INCOMPLETE_RESPONSE')
            chunks = []
            for item in response.get('output', []):
                if item.get('type') == 'reasoning':
                    continue
                if item.get('type') != 'message' or item.get('role') != 'assistant':
                    raise ProviderError('UNEXPECTED_OUTPUT_ITEM')
                if item.get('status') not in (None, 'completed'):
                    raise ProviderError('INCOMPLETE_RESPONSE')
                for content in item.get('content', []):
                    if content.get('type') == 'refusal':
                        raise ProviderError('REFUSED')
                    if content.get('type') != 'output_text' or not isinstance(content.get('text'), str):
                        raise ProviderError('UNEXPECTED_OUTPUT_ITEM')
                    chunks.append(content['text'])
            usage = _usage(response.get('usage'), ('input_tokens', 'output_tokens', 'total_tokens'))
            details = response.get('usage', {}) or {}
            usage['cached_input_tokens'] = _usage(details.get('input_tokens_details'), ('cached_tokens',))['cached_tokens']
            usage['reasoning_output_tokens'] = _usage(details.get('output_tokens_details'), ('reasoning_tokens',))['reasoning_tokens']
            model = response.get('model')
        elif provider == 'gemini':
            if response.get('error'):
                raise ProviderError('PROVIDER_RESPONSE_ERROR')
            if response.get('promptFeedback', {}).get('blockReason'):
                raise ProviderError('REFUSED')
            candidates = response.get('candidates', [])
            if len(candidates) != 1:
                raise ProviderError('EMPTY_OR_MULTIPLE_CANDIDATES')
            candidate = candidates[0]
            if candidate.get('finishReason') != 'STOP':
                raise ProviderError('INCOMPLETE_OR_REFUSED_RESPONSE')
            chunks = []
            for part in candidate.get('content', {}).get('parts', []):
                if part.get('thought') is True:
                    continue
                if not isinstance(part.get('text'), str):
                    raise ProviderError('UNEXPECTED_OUTPUT_ITEM')
                chunks.append(part['text'])
            usage = _usage(response.get('usageMetadata'), ('promptTokenCount', 'candidatesTokenCount',
                'totalTokenCount', 'cachedContentTokenCount', 'thoughtsTokenCount'))
            model = response.get('modelVersion')
        else:
            raise ProviderError('INVALID_PROVIDER_MODEL')
        if len(chunks) != 1 or not chunks[0].strip():
            raise ProviderError('EMPTY_OR_MULTIPLE_TEXT_RESPONSES')
        result = parse(chunks[0])
        if not isinstance(result, dict) or set(result) != {'labels'} or not isinstance(result['labels'], list):
            raise ProviderError('INVALID_OUTPUT_SCHEMA')
        values = result['labels']
        if (any(not isinstance(label, str) or label not in allowed_labels for label in values)
                or len(values) != len(set(values))):
            raise ProviderError('INVALID_OUTPUT_LABELS')
        if not isinstance(model, str) or re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,127}', model) is None:
            raise ProviderError('MISSING_RESPONSE_MODEL_VERSION')
        return {'labels': sorted(values), 'state': 'PREDICTED_TARGETS' if values else 'NO_TARGET_PREDICTED',
                'response_model': model, 'response_id_sha256': digest(str(response.get('id', response.get('responseId', '')))),
                'usage': usage, 'actual_cost': None,
                'cost_note': 'Not billed-cost verification; usage alone does not establish actual cost.'}
    except ProviderError:
        raise
    except (ValueError, KeyError, TypeError, AttributeError, UnicodeError):
        raise ProviderError('RESPONSE_PARSE_FAILED') from None


def classify(provider, model, api_key, instructions, text, labels, max_output_tokens=2048,
             timeout_seconds=30, transport=None):
    """Exactly one HTTP attempt. The caller reserves its durable budget first."""
    if not isinstance(api_key, str) or not api_key.strip() or '\n' in api_key or '\r' in api_key:
        raise ProviderError('KEY_UNAVAILABLE')
    if type(timeout_seconds) is not int or not 1 <= timeout_seconds <= 120:
        raise ProviderError('INVALID_REQUEST_CONFIGURATION')
    request_payload = payload(provider, model, instructions, text, labels, max_output_tokens)
    if provider == 'openai':
        url = 'https://api.openai.com/v1/responses'
        headers = {'Authorization': 'Bearer ' + api_key, 'Content-Type': 'application/json'}
    else:
        url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent'
        headers = {'x-goog-api-key': api_key, 'Content-Type': 'application/json'}
    start = time.monotonic()
    try:
        response = (transport or http_post)(url, headers, request_payload, timeout_seconds)
        result = parse_response(provider, response, labels)
        if api_key in canonical(result):
            raise ProviderError('SECRET_IN_RESPONSE')
        result['latency_seconds'] = time.monotonic() - start
        return result
    except HTTPError as exc:
        status = exc.code
        exc.close()
        if status in (401, 403):
            code = 'AUTHENTICATION_FAILED'
        elif status == 429:
            code = 'QUOTA_OR_RATE_LIMIT'
        elif 500 <= status < 600:
            code = 'PROVIDER_UNAVAILABLE'
        elif 300 <= status < 400:
            code = 'REDIRECT_REJECTED'
        else:
            code = 'PROVIDER_REQUEST_REJECTED'
        raise ProviderError(code) from None
    except (TimeoutError, socket.timeout):
        raise ProviderError('TIMEOUT_DELIVERY_UNKNOWN') from None
    except URLError:
        raise ProviderError('NETWORK_DELIVERY_UNKNOWN') from None
    except ProviderError:
        raise
    except Exception:
        # A transport exception may contain credentials, response bodies or prompts.
        raise ProviderError('TRANSPORT_OR_RESPONSE_FAILED') from None

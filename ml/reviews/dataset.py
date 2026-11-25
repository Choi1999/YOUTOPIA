"""Freeze human gold, exclusion registry, tokenizer policy, and game-held-out splits."""
import random
import unicodedata
from pathlib import Path
from .common import digest, fingerprint, read, rows, seal, verify, write, write_rows, file_hash
from .contract import POLICY, labels, taxonomy, validate


def check_registry(registry):
    if registry.get('complete') is not True or not registry.get('source_ref', '').strip():
        raise ValueError('PILOT_REGISTRY_INCOMPLETE')
    batches = registry['batches']
    if not registry.get('synthetic', False):
        required = {'reviewed_pilot_50': 50, 'additional_draft_10': 10}
        if {b['id']: b['expected_count'] for b in batches} != required:
            raise ValueError('PILOT_BATCH_INVENTORY_INCOMPLETE')
    all_keys = []
    for batch in batches:
        if not batch.get('id') or len(batch['keys']) != batch['expected_count']:
            raise ValueError('PILOT_BATCH_COUNT_MISMATCH')
        all_keys.extend(batch['keys'])
    if len(set(all_keys)) != len(all_keys) or any(not isinstance(k, str) or k.count(':') != 1 for k in all_keys):
        raise ValueError('PILOT_REGISTRY_DUPLICATE_OR_INVALID_KEY')
    return set(all_keys)


def normalized(text):
    return ' '.join(unicodedata.normalize('NFC', text).split())


def audit(records, ledger):
    workbench, errors = [], []
    decisions = {}
    for entry in ledger:
        identity = tuple(entry.get(field) for field in ('key', 'scope', 'text_sha256', 'scope_sha256'))
        if identity in decisions and decisions[identity] != entry:
            return [], [{'key': entry.get('key'), 'reason': 'CONFLICTING_APPROVAL_LEDGER_ENTRIES'}]
        decisions[identity] = entry
    seen = set()
    for record in records:
        try:
            if record.get('key') in seen:
                raise ValueError('DUPLICATE_REVIEW_NEEDS_ADJUDICATION')
            seen.add(record.get('key'))
            workbench.append(validate(record, ledger))
        except (ValueError, KeyError, TypeError) as exc:
            errors.append({'key': record.get('key'), 'reason': str(exc)})
    return workbench, errors


def split_games(workbench, seed):
    games = sorted({r['appid'] for r in workbench})
    if len(games) < 5:
        raise ValueError('AT_LEAST_FIVE_GAMES_REQUIRED_NO_ROW_SPLIT_FALLBACK')
    random.Random(seed).shuffle(games)
    count = max(1, round(len(games) * .2))
    groups = {'test': set(games[:count]), 'validation': set(games[count:count * 2]),
              'train': set(games[count * 2:])}
    return {split: [r for r in workbench if r['appid'] in ids] for split, ids in groups.items()}


def check_leakage(splits):
    """Exact and high-similarity text checks; NOT a claim of semantic deduplication."""
    from sklearn.feature_extraction.text import TfidfVectorizer
    names, texts, keys = [], [], []
    for split, records in splits.items():
        for record in records:
            names.append(split)
            texts.append(normalized(record['text']))
            keys.append(record['key'])
    seen = {}
    for index, text in enumerate(texts):
        if text in seen:
            raise ValueError('DUPLICATE_BODY_NEEDS_ADJUDICATION')
        seen[text] = index
    matrix = TfidfVectorizer(analyzer='char', ngram_range=(3, 5)).fit_transform(texts)
    for start in range(0, len(texts), 128):
        similarity = (matrix[start:start + 128] @ matrix.T).tocoo()
        for i, j, score in zip(similarity.row, similarity.col, similarity.data):
            i += start
            if i < j and names[i] != names[j] and score >= .97:
                raise ValueError('NEAR_DUPLICATE_CROSS_SPLIT_NEEDS_ADJUDICATION')


def build(source, approvals, registry_path, base, destination, max_tokens=256, seed=42):
    from transformers import AutoConfig, AutoTokenizer
    registry = read(registry_path)
    excluded = check_registry(registry)
    base_meta = verify(base)
    if base_meta.get('synthetic', False) != registry.get('synthetic', False):
        raise ValueError('SYNTHETIC_REAL_INPUT_MISMATCH')
    if type(max_tokens) is not int or not 8 <= max_tokens <= 512:
        raise ValueError('INVALID_INPUT_TOKEN_LIMIT')
    tokenizer = AutoTokenizer.from_pretrained(base, local_files_only=True, trust_remote_code=False)
    config = AutoConfig.from_pretrained(base, local_files_only=True, trust_remote_code=False)
    if max_tokens > config.max_position_embeddings:
        raise ValueError('INPUT_LIMIT_EXCEEDS_ENCODER_CAPACITY')
    workbench, errors = audit(read(source)['records'], rows(approvals))
    if errors:
        raise ValueError('INVALID_SOURCE_RECORDS; run audit for private details')
    included = []
    for record in workbench:
        if record['key'] in excluded:
            record['reasons'].append('REFERENCE_PILOT_EXCLUDED')
        tokens = tokenizer(record['text'], add_special_tokens=True, truncation=False)['input_ids']
        record['token_count'] = len(tokens)
        if len(tokens) > max_tokens:
            record['reasons'].append('LONG_BODY_HELD_NO_TRUNCATION')
        record['eligible'] = not record['reasons']
        if record['eligible']:
            included.append(record)
    splits = split_games(included, seed)
    check_leakage(splits)
    target = Path(destination)
    target.mkdir(parents=True, exist_ok=False)
    write_rows(target / 'workbench.jsonl', workbench)
    for split, records in splits.items():
        write_rows(target / (split + '.jsonl'), records)
    summary = {
        'input_reviews': len(workbench), 'eligible_reviews': len(included),
        'linked_human_opinion_confirmations': sum(r['human_review_evidence_count'] for r in workbench),
        'unlinked_review_confirmation_reviews': sum('REVIEW_CONFIRMATION_UNLINKED' in r['reasons'] for r in workbench),
        'note': 'Unlinked confirmations do not mean the user never reviewed these opinions.',
        'excluded': [{'key': r['key'], 'reasons': r['reasons']} for r in workbench if not r['eligible']],
    }
    write(target / 'audit.json', summary)
    metadata = {
        'contract': 'review-training-v1', 'taxonomy_sha256': fingerprint(taxonomy()),
        'policy_sha256': fingerprint(POLICY), 'labels': labels(), 'seed': seed,
        'synthetic': registry.get('synthetic', False), 'base_sha256': file_hash(Path(base) / 'READY.json'),
        'base': base_meta, 'max_tokens': max_tokens, 'steam_in_model_input': False,
        'source_sha256': file_hash(source), 'approvals_sha256': file_hash(approvals),
        'pilot_registry_sha256': file_hash(registry_path),
        'split_counts': {key: len(value) for key, value in splits.items()},
        'game_counts': {key: len({r['appid'] for r in value}) for key, value in splits.items()},
        'dedup': 'NFC whitespace exact + cross-split char 3..5 TF-IDF cosine >= .97 block; no semantic guarantee',
    }
    seal(target, metadata)
    return summary


def load(root, split):
    metadata = verify(root)
    if metadata['labels'] != labels() or metadata['policy_sha256'] != fingerprint(POLICY) or metadata['taxonomy_sha256'] != fingerprint(taxonomy()):
        raise ValueError('DATASET_CONTRACT_CHANGED')
    records = rows(Path(root) / (split + '.jsonl'))
    if not records or len(records) != metadata['split_counts'][split]:
        raise ValueError('EMPTY_OR_CHANGED_SPLIT')
    return records, metadata

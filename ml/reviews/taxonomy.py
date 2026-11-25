"""Versioned fine targets; installed defaults are a draft, never implicit real gold."""
import re
from pathlib import Path
from .common import fingerprint, read


def taxonomy(value=None):
    tax = read(Path(__file__).with_suffix('.json')) if value is None else (read(value) if not isinstance(value, dict) else value)
    if tax.get('schema') != 'review-target-taxonomy-v2':
        raise ValueError('LEGACY_COARSE_TAXONOMY_REQUIRES_MIGRATION')
    if tax.get('status') not in ('draft', 'confirmed') or not tax.get('version') or not tax.get('source_ref'):
        raise ValueError('TAXONOMY_PROVENANCE_MISSING')
    groups, leaves = set(), set()
    for category in tax['categories']:
        group = category['code']
        if not isinstance(group, str) or not re.fullmatch(r'[A-Z][A-Z0-9_]*', group) or group in groups or group in ('OTHER', 'OVERALL'):
            raise ValueError('INVALID_OR_DUPLICATE_ASPECT')
        groups.add(group)
        for target in category['targets']:
            code = target['code']
            if not isinstance(code, str) or not re.fullmatch(re.escape(group) + r'\.[A-Z][A-Z0-9_]*', code) or code in leaves or not target.get('label'):
                raise ValueError('INVALID_OR_DUPLICATE_TARGET')
            leaves.add(code)
    if not leaves:
        raise ValueError('EMPTY_TARGET_TAXONOMY')
    return tax


def target_map(value=None):
    return {leaf['code']: {**leaf, 'aspect_code': category['code'], 'aspect_label': category['label']}
            for category in taxonomy(value)['categories'] for leaf in category['targets']}


def require_confirmed(tax, synthetic):
    tax = taxonomy(tax)
    if not synthetic and (tax['status'] != 'confirmed'
            or any(not category['targets'] or category.get('detail_status') != 'confirmed'
                   or any(leaf.get('status') != 'confirmed' for leaf in category['targets'])
                   for category in tax['categories'])):
        raise ValueError('FULL_CONFIRMED_TARGET_TAXONOMY_REQUIRED')
    return fingerprint(tax)

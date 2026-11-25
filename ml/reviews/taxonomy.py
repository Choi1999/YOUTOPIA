"""Pinned v0.5 leaf taxonomy. Pilot definitions are not human-adjudicated gold."""
import re
from pathlib import Path
from .common import fingerprint, read


def taxonomy(value=None):
    tax = read(Path(__file__).with_suffix('.json')) if value is None else (read(value) if not isinstance(value, dict) else value)
    if tax.get('schema_version') != 'youtopia_review_taxonomy_v2':
        raise ValueError('LEGACY_COARSE_TAXONOMY_REQUIRES_MIGRATION')
    if tax.get('status') not in ('pilot', 'confirmed') or not tax.get('version') or not tax.get('guideline_version'):
        raise ValueError('TAXONOMY_PROVENANCE_MISSING')
    if tax.get('active_polarities') != ['긍정', '부정'] or tax.get('mixed_is_derived') is not True or tax.get('primary_label_unit') != 'leaf_id':
        raise ValueError('V05_BINARY_POLARITY_AND_DERIVED_MIXED_REQUIRED')
    groups, leaves = set(), set()
    for category in tax['categories']:
        group = category['code']
        if not isinstance(group, str) or not re.fullmatch(r'[A-Z][A-Z0-9_]*', group) or group in groups or group in ('OTHER', 'OVERALL'):
            raise ValueError('INVALID_OR_DUPLICATE_ASPECT')
        groups.add(group)
        for target in category['subaspects']:
            code = target['leaf_id']
            if (not isinstance(code, str) or not re.fullmatch(re.escape(group) + r'\.[A-Z][A-Z0-9_]*', code)
                    or code != group + '.' + target['code'] or code in leaves or not target.get('label')):
                raise ValueError('INVALID_OR_DUPLICATE_TARGET')
            leaves.add(code)
    if not leaves:
        raise ValueError('EMPTY_TARGET_TAXONOMY')
    return tax


def target_map(value=None):
    return {leaf['leaf_id']: {**leaf, 'aspect_code': category['code'], 'aspect_label': category['label']}
            for category in taxonomy(value)['categories'] for leaf in category['subaspects']}


def require_frozen_taxonomy(tax, synthetic):
    """Validate a frozen usable dictionary; never claims pilot labels are gold.

    Real gold still requires independent review approvals and explicit eligibility.
    """
    tax = taxonomy(tax)
    if not synthetic and any(not category['subaspects'] or category.get('subaspects_exhaustive') is not True for category in tax['categories']):
        raise ValueError('FULL_CONFIRMED_TARGET_TAXONOMY_REQUIRED')
    return fingerprint(tax)

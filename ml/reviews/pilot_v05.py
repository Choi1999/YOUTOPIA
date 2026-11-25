"""Read consolidated v0.5 pilots privately without turning AI leaf labels into gold."""
import copy
import shutil
from pathlib import Path
from .common import file_hash, fingerprint, read, write, write_rows
from .dataset import audit
from .taxonomy import taxonomy

PINNED_PILOT_SHA256 = 'c725153182e99647e859b04cecf07699ec869508bda405d6e0f7ec36aeb5e1d4'
PINNED_KEYSET_SHA256 = 'b548aeb7ade50e9b32cfd8d7a824c7fc8acffda77e51914208e990919dc12423'
LEGACY_TAXONOMY = Path(__file__).parent / 'legacy' / 'taxonomy-v0.5.json'


def convert_record(record, tax):
    revised = copy.deepcopy(record)
    if record.get('schema_version') != 'youtopia_pilot_review_v2' or record.get('taxonomy_version') != tax['version']:
        raise ValueError('PILOT_V05_VERSION_OR_SCHEMA_MISMATCH')
    converted = []
    if any(span.get('retain_in_model_input') is not True or span.get('span_negative_training_eligible') is not False
           for span in record.get('excluded_spans', [])):
        raise ValueError('PILOT_EXCLUSION_RETENTION_POLICY_CHANGED')
    for original in [*record['annotations'], *record['held_annotations']]:
        annotation = copy.deepcopy(original)
        annotation['evidence_spans'] = [{'start': original['start'], 'end': original['end'], 'text': original['evidence']}]
        annotation['target_spans'] = copy.deepcopy(original.get('target', {}).get('mentions', []))
        converted.append(annotation)
    revised['annotations'] = converted
    revised['taxonomy_sha256'] = fingerprint(tax)
    states = {'EVALUATION_PRESENT': '평가 있음', 'EVALUATION_WITH_HOLD': '평가 있음',
              'NO_CONCRETE_EVALUATION': '평가 없음', 'HOLD': '판단 보류'}
    if record['analysis_status'] not in states:
        raise ValueError('UNKNOWN_PILOT_ANALYSIS_STATUS')
    revised['review_status'] = states[record['analysis_status']]
    # Old acceptance and new AI review are intentionally retained as distinct fields.
    return revised


def import_pilot(source, destination, taxonomy_path=None):
    original = read(source); tax = taxonomy(taxonomy_path or LEGACY_TAXONOMY)
    if original.get('schema') != 'youtopia_pilot_consolidated_review_v2' or original.get('taxonomy_version') != tax['version']:
        raise ValueError('PILOT_V05_VERSION_OR_SCHEMA_MISMATCH')
    converted = [convert_record(record, tax) for record in original['records']]
    keys = [record['key'] for record in converted]
    if len(set(keys)) != len(keys) or set(original['pilot_exclusion_keys']) != set(keys):
        raise ValueError('PILOT_EXCLUSION_KEY_MISMATCH')
    workbench, errors = audit(converted, [], tax)
    if errors:
        raise ValueError('PILOT_EVIDENCE_OR_LEAF_VALIDATION_FAILED')
    if any(record.get('learning_eligible') is not False for record in converted):
        raise ValueError('GUIDELINE_PILOT_MUST_REMAIN_TRAINING_EXCLUDED')
    target = Path(destination); target.mkdir(parents=True, exist_ok=False)
    shutil.copyfile(source, target / 'original-pilot.json')
    write(target / 'adapted-pilot.json', {'schema': 'review-workbench-v05', 'records': converted})
    write_rows(target / 'workbench.jsonl', workbench)
    write(target / 'pilot-registry.json', {
        'schema': 'pilot-reference-registry-v2', 'complete': False,
        'source_ref': 'Actual imported v0.5 guideline pilot; verify inventory also includes every other reference batch',
        'inventory': [{'id': 'guideline-pilot-v0.5', 'expected_count': len(keys), 'source_sha256': file_hash(source)}],
        'batches': [{'id': 'guideline-pilot-v0.5', 'expected_count': len(keys), 'keys': keys}],
    })
    summary = {
        'reviews': len(converted), 'active_opinions': sum(len(r['active_opinion_ids']) for r in converted),
        'held_opinions': sum(len(r['held_opinion_ids']) for r in converted),
        'source_acceptance_records': sum(bool(r.get('source_review_acceptance')) for r in converted),
        'new_leaf_user_verified_records': sum(r.get('reclassification_review', {}).get('user_verified') is True for r in converted),
        'training_eligible_reviews': sum(r['eligible'] for r in workbench),
        'source_sha256': file_hash(source), 'pinned_source_match': file_hash(source) == PINNED_PILOT_SHA256,
        'training_started': False, 'registry_inventory_complete': False,
    }
    write(target / 'audit.json', summary)
    return summary

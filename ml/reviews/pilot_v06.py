"""Import the v0.6 guideline pilot privately, keeping all 100 keys excluded."""
import shutil
from pathlib import Path
from .common import file_hash, fingerprint, read, write, write_rows
from .import_labels import adapt_consolidated
from .taxonomy import taxonomy

PINNED_PILOT_SHA256 = 'ec4492251e3fe0fa23f28a63e9f6383bdccc5734dd0f5b05a3fd59898204c032'
PINNED_KEYSET_SHA256 = '219ae23a38e6999238d00c414af27c89fd6ed3e63400904c13354c981e8d7dd3'
PINNED_BODYSET_SHA256 = '52c1c1ecdbebca09a4bae88c88776ccd26bccb49c75de269669ffa176ec07889'


def import_pilot(source, destination, taxonomy_path=None):
    original = read(source); tax = taxonomy(taxonomy_path)
    if tax['version'] != 'v0.6':
        raise ValueError('V06_PILOT_TAXONOMY_REQUIRED')
    converted, workbench = adapt_consolidated(original, tax)
    keys = [record['key'] for record in converted]
    if len(set(keys)) != len(keys) or set(original.get('pilot_exclusion_keys', [])) != set(keys):
        raise ValueError('PILOT_EXCLUSION_KEY_MISMATCH')
    if any(record.get('learning_eligible') is not False for record in converted):
        raise ValueError('GUIDELINE_PILOT_MUST_REMAIN_TRAINING_EXCLUDED')
    target = Path(destination); target.mkdir(parents=True, exist_ok=False)
    shutil.copyfile(source, target / 'original-pilot.json')
    write(target / 'adapted-pilot.json', {'schema': 'review-workbench-v06', 'records': converted})
    write_rows(target / 'workbench.jsonl', workbench)
    write(target / 'pilot-registry.json', {
        'schema': 'pilot-reference-registry-v2', 'complete': False,
        'source_ref': 'Pinned v0.6 guideline pilot; verify inventory includes every other reference batch before marking complete',
        'inventory': [{'id': 'guideline-pilot-v0.6', 'expected_count': len(keys), 'source_sha256': file_hash(source)}],
        'batches': [{'id': 'guideline-pilot-v0.6', 'expected_count': len(keys), 'keys': keys,
                     'reference_bodies': [{'key': r['key'], 'text': r['clean_text'], 'text_sha256': r['text_sha256']}
                                          for r in converted]}],
    })
    summary = {
        'reviews': len(converted), 'active_opinions': sum(len(r['active_opinion_ids']) for r in converted),
        'held_opinions': sum(len(r.get('held_opinion_ids', [])) for r in converted),
        'source_acceptance_records': sum(bool(r.get('source_review_acceptance')) for r in converted),
        'new_leaf_user_verified_records': sum(r.get('reclassification_review', {}).get('user_verified') is True for r in converted),
        'metadata_assisted_reviews': sum(r['task_eligibility']['metadata_assisted'] for r in workbench),
        'training_eligible_reviews': sum(r['eligible'] for r in workbench),
        'source_sha256': file_hash(source), 'pinned_source_match': file_hash(source) == PINNED_PILOT_SHA256,
        'pinned_keyset_match': fingerprint(sorted(keys)) == PINNED_KEYSET_SHA256,
        'pinned_bodyset_match': fingerprint(sorted([{'key': r['key'], 'text_sha256': r['text_sha256']}
                                                  for r in converted], key=lambda r: r['key'])) == PINNED_BODYSET_SHA256,
        'training_started': False, 'registry_inventory_complete': False,
        'independent_blind_gold': False,
    }
    write(target / 'audit.json', summary)
    return summary

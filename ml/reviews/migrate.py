"""Preserve legacy annotations and approvals; create pending fine-target work only."""
import copy
import shutil
from pathlib import Path
from .common import file_hash, fingerprint, read, rows, write, write_rows
from .contract import approval_candidates
from .taxonomy import taxonomy


def migrate(source, approvals, destination, taxonomy_path=None):
    tax = taxonomy(taxonomy_path)
    original = read(source)
    ledger = rows(approvals)  # validate JSON; never copy approvals as new approvals
    migrated = []
    for record in original['records']:
        if record.get('taxonomy_sha256') == fingerprint(tax):
            raise ValueError('ALREADY_CURRENT_TAXONOMY_USE_AUDIT_INSTEAD')
        revised = copy.deepcopy(record)
        revised['migration'] = {
            'source_record_sha256': fingerprint(record),
            'previous_taxonomy_version': record.get('taxonomy_version'),
            'previous_taxonomy_sha256': record.get('taxonomy_sha256'),
            'previous_review_status': record.get('review_status'),
            'previous_active_opinion_ids': record.get('active_opinion_ids', []),
            'previous_held_opinion_ids': record.get('held_opinion_ids', []),
            'old_approval_history_preserved': True, 'new_scope_approved': False,
        }
        for annotation in revised['annotations']:
            annotation['previous_leaf_id'] = annotation.get('leaf_id')
            annotation['leaf_id'] = None
        revised['taxonomy_version'] = tax['version']
        revised['taxonomy_sha256'] = fingerprint(tax)
        revised['review_status'] = '재분류 필요'
        revised['active_opinion_ids'] = []
        revised['held_opinion_ids'] = [a['id'] for a in revised['annotations']]
        migrated.append(revised)
    target = Path(destination); target.mkdir(parents=True, exist_ok=False)
    shutil.copyfile(source, target / 'original-source.json')
    shutil.copyfile(approvals, target / 'original-approvals.jsonl')
    write(target / 'taxonomy.json', tax)
    write(target / 'reclassification.json', {**original, 'taxonomy_version': tax['version'],
                                            'taxonomy_sha256': fingerprint(tax), 'records': migrated})
    write_rows(target / 'pending-approval-candidates.jsonl', [a for r in migrated for a in approval_candidates(r)])
    summary = {'reviews_preserved': len(migrated), 'prior_approval_entries_preserved': len(ledger),
               'source_sha256': file_hash(source), 'approvals_sha256': file_hash(approvals),
               'new_human_approvals': 0, 'auto_reclassified_opinions': 0, 'training_started': False,
               'taxonomy_status': tax['status'], 'taxonomy_sha256': fingerprint(tax)}
    write(target / 'migration.json', summary)
    return summary

"""Adapt private consolidated labeled batches; preserve history, never invent gold."""
import shutil
from pathlib import Path
from .common import file_hash, read, write, write_rows
from .contract import approval_candidates
from .dataset import audit
from .pilot_v05 import convert_record
from .taxonomy import taxonomy


def adapt_consolidated(original, tax):
    if (original.get('schema') != 'youtopia_pilot_consolidated_review_v2'
            or original.get('taxonomy_version') != tax['version']):
        raise ValueError('CONSOLIDATED_VERSION_OR_SCHEMA_MISMATCH')
    if not isinstance(original.get('records'), list) or not original['records']:
        raise ValueError('NONEMPTY_LABELED_RECORDS_REQUIRED')
    converted = [convert_record(record, tax) for record in original['records']]
    workbench, errors = audit(converted, [], tax)
    if errors:
        raise ValueError('LABELED_EVIDENCE_OR_LEAF_VALIDATION_FAILED')
    return converted, workbench


def import_labels(source, destination, taxonomy_path=None):
    """Import without assuming a MAIN batch number, eligibility or approval.

    The same consolidated-v2 schema serves pilots and private MAIN batches.
    Registry construction stays separate: arbitrary MAIN records do not replace
    the pinned 100-review guideline exclusion list.
    """
    tax = taxonomy(taxonomy_path)
    converted, workbench = adapt_consolidated(read(source), tax)
    target = Path(destination); target.mkdir(parents=True, exist_ok=False)
    shutil.copyfile(source, target / 'original-labels.json')
    write(target / 'adapted-labels.json', {'schema': 'review-workbench-v06',
                                         'taxonomy_version': tax['version'], 'records': converted})
    write_rows(target / 'workbench.jsonl', workbench)
    write_rows(target / 'pending-approval-candidates.jsonl',
               [candidate for row in converted for candidate in approval_candidates(row)])
    summary = {'reviews': len(converted), 'active_opinions': sum(len(r['active_opinion_ids']) for r in converted),
               'held_opinions': sum(len(r.get('held_opinion_ids', [])) for r in converted),
               'metadata_assisted_reviews': sum(r['task_eligibility']['metadata_assisted'] for r in workbench),
               'training_eligible_reviews': sum(r['eligible'] for r in workbench),
               'new_human_approvals': 0, 'source_sha256': file_hash(source),
               'training_started': False,
               'note': 'Original review history is preserved. Pending candidates are not approvals; link actual human review evidence separately.'}
    write(target / 'audit.json', summary)
    return summary

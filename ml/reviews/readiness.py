"""Offline readiness checks. Missing private inputs are blockers, never fake success."""
import importlib.metadata
from collections import Counter
from pathlib import Path
from .common import file_hash, fingerprint, read, rows, verify, write
from .contract import POLICY, labels
from .taxonomy import taxonomy, target_map


def inspect(source=None, approvals=None, registry=None, base=None, dataset=None):
    """Do not download, query CUDA, call APIs, open final-test rows or change inputs."""
    tax = taxonomy()
    checks = []

    def add(name, status, detail):
        checks.append({'name': name, 'status': status, 'detail': detail})

    add('taxonomy', 'PASS', {'version': tax['version'], 'guideline': tax['guideline_version'],
                            'leaves': len(target_map(tax)), 'binary_outputs': len(labels(tax)),
                            'sha256': fingerprint(tax), 'policy_sha256': fingerprint(POLICY)})
    dependencies = {}
    for name in ('torch', 'transformers', 'tokenizers', 'safetensors', 'numpy', 'scipy', 'scikit-learn', 'matplotlib'):
        try:
            dependencies[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            dependencies[name] = None
    add('dependencies', 'PASS' if all(dependencies.values()) else 'BLOCKED', dependencies)

    excluded = None
    registry_doc = None
    if registry is None:
        add('pilot_registry', 'BLOCKED', 'Provide the private complete exclusion inventory, including pinned pilot100 and revisions.')
    else:
        try:
            from .dataset import check_registry
            registry_doc = read(registry)
            excluded = check_registry(registry_doc)
            if registry_doc.get('synthetic'):
                add('pilot_registry', 'SYNTHETIC_ONLY', {'excluded_review_keys': len(excluded)})
            else:
                add('pilot_registry', 'PASS', {'excluded_review_keys': len(excluded), 'sha256': file_hash(registry)})
        except (OSError, ValueError, KeyError, TypeError):
            add('pilot_registry', 'BLOCKED', 'Registry missing, incomplete, malformed or inconsistent with pinned source; run private audit.')

    if source is None or approvals is None:
        add('human_gold', 'BLOCKED', 'Provide canonical labeled records and the separate, genuinely reviewed approval ledger; pilot100 is excluded.')
    else:
        try:
            from .dataset import audit, split_games, check_leakage, reference_pilot_matches
            records = read(source)['records']
            if (not isinstance(records, list) or not records
                    or any(not isinstance(record, dict) for record in records)):
                raise ValueError('NONEMPTY_RECORD_OBJECTS_REQUIRED')
            workbench, errors = audit(records, rows(approvals), tax)
            copied = reference_pilot_matches(workbench, registry_doc) if excluded is not None else {}
            candidates = [r for r in workbench if r['eligible'] and excluded is not None
                          and r['key'] not in excluded and r['key'] not in copied]
            support = Counter(label for r in candidates for label in set(r['labels']))
            details = {'input_reviews': len(records), 'contract_error_count': len(errors),
                       'eligible_after_pilot_exclusion': len(candidates),
                       'candidate_games': len({r['appid'] for r in candidates}),
                       'exclusion_inventory_verified': excluded is not None,
                       'reference_body_exclusion_counts': dict(Counter(copied.values())),
                       'reasons': dict(Counter(reason for r in workbench for reason in r['reasons'])),
                       'supported_binary_labels': len(support),
                       'unsupported_binary_labels': [label for label in labels(tax) if support[label] == 0],
                       'token_length_check': 'Only dataset build with the verified base tokenizer can establish eligibility.',
                       'source_sha256': file_hash(source), 'approvals_sha256': file_hash(approvals),
                       'final_test_rows_read': False}
            if errors or excluded is None or not candidates:
                add('human_gold', 'BLOCKED', details)
            else:
                try:
                    proposed = split_games(candidates, 42)
                    check_leakage(proposed)
                    details['proposed_game_split_counts'] = {name: len(part) for name, part in proposed.items()}
                    details['proposed_split_is_frozen'] = False
                    add('human_gold', 'PASS', details)
                except (ValueError, ImportError):
                    details['split_check'] = 'Insufficient distinct games, duplicate/near-duplicate text or missing dependencies; resolve in private.'
                    add('human_gold', 'BLOCKED', details)
        except (OSError, ValueError, KeyError, TypeError, ImportError):
            add('human_gold', 'BLOCKED', 'Missing or malformed canonical source/ledger or missing audit dependencies. Use import-labels, then audit; no approvals are created by this check.')

    if base is None:
        add('base_model', 'BLOCKED', 'Supply the hash-verified pinned KcELECTRA base artifact using import-base; no download or model load ran.')
    else:
        try:
            from .assets import REPO, REVISION, BIN_SHA256, PINNED_FILES
            meta = verify(base)
            if meta.get('synthetic'):
                add('base_model', 'SYNTHETIC_ONLY', 'Random tiny fixture cannot establish real pretrained-model readiness.')
            elif (meta.get('repo') != REPO or meta.get('revision') != REVISION
                  or meta.get('source_weight_sha256') != BIN_SHA256
                  or meta.get('source_config_tokenizer_sha256') != PINNED_FILES):
                add('base_model', 'BLOCKED', 'Base provenance differs from pinned import contract.')
            else:
                add('base_model', 'PASS', {'repo': REPO, 'revision': REVISION, 'artifact_sha256': file_hash(Path(base) / 'READY.json'),
                                          'real_model_loaded_by_check': False})
        except (OSError, ValueError, KeyError, TypeError):
            add('base_model', 'BLOCKED', 'Missing, incomplete or changed base artifact.')

    if dataset is None:
        add('frozen_dataset', 'BLOCKED', 'Run build after gold, exclusions and base are ready; train/validation/test remain separate.')
    else:
        try:
            from .dataset import load
            train_rows, metadata = load(dataset, 'train')
            validation_rows, validation_meta = load(dataset, 'validation')
            if metadata != validation_meta:
                raise ValueError('CHANGED_METADATA')
            current_base = file_hash(Path(base) / 'READY.json') if base is not None else None
            if current_base is not None and current_base != metadata['base_sha256']:
                raise ValueError('BASE_IDENTITY_CHANGED')
            for supplied, field in ((source, 'source_sha256'), (approvals, 'approvals_sha256'),
                                    (registry, 'pilot_registry_sha256')):
                if supplied is not None and file_hash(supplied) != metadata.get(field):
                    raise ValueError('FROZEN_DATASET_INPUT_CHANGED')
            add('frozen_dataset', 'SYNTHETIC_ONLY' if metadata['synthetic'] else 'PASS',
                {'sha256': file_hash(Path(dataset) / 'READY.json'), 'split_counts': metadata['split_counts'],
                 'train_reviews': len(train_rows), 'validation_reviews': len(validation_rows),
                 'input_scope': metadata['input_scope'], 'final_test_rows_read': False,
                 'cross_checked_base': current_base is not None})
        except (OSError, ValueError, KeyError, TypeError, ImportError):
            add('frozen_dataset', 'BLOCKED', 'Dataset missing, changed or incompatible; rebuild under current contract.')

    ready = all(check['status'] == 'PASS' for check in checks)
    return {'schema': 'review-training-readiness-v1', 'ready_for_local_training': ready,
            'status': 'READY_OFFLINE_INPUTS' if ready else 'BLOCKED', 'checks': checks,
            'comparison_conditions': {'local': ['tfidf', 'textcnn', 'frozen', 'full'],
                                      'external': ['openai_baseline', 'openai_prompt', 'gemini_baseline', 'gemini_prompt'],
                                      'rule': 'Same provider model, fixed input/output contract; baseline versus enhanced project instructions.'},
            'facts': {'real_training_performed': False, 'model_accuracy_verified': False,
                      'api_requests': 0, 'gpu_changes': False, 'production_changes': False,
                      'final_test_rows_read': False},
            'remaining_runtime_validation': ['Real KcELECTRA load', 'L4 CUDA/environment compatibility and measured memory/throughput',
                                             'Same-input external comparison after explicit key/budget setup',
                                             'Independent final-test quality and cohort limits'],
            'public_corpus': 'Optional auxiliary binary sentiment data does not replace Korean v0.6 leaf/polarity gold.'}


def report(destination, **kwargs):
    result = inspect(**kwargs)
    target = Path(destination); target.mkdir(parents=True, exist_ok=False)
    write(target / 'readiness.json', result)
    return result

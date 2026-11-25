"""Validation selection, sealed final-test execution, and private diagnostic reports."""
import csv
import statistics
from pathlib import Path
import numpy as np
from .common import claim, file_hash, fingerprint, read, rows, seal, verify, write, write_rows
from .dataset import load
from .models import KINDS, Predictor, decode, fit, metrics, predict, targets
from .contract import rollup


def train(dataset, base, destination, seeds=(13, 42, 73), epochs=5, batch_size=16, device='cpu'):
    if not seeds or len(seeds) != len(set(seeds)):
        raise ValueError('DISTINCT_TRAINING_SEEDS_REQUIRED')
    _, metadata = load(dataset, 'train')
    target = Path(destination); target.mkdir(parents=True, exist_ok=False)
    experiments = []
    for kind in KINDS:
        for seed in seeds:
            relative = kind + '-' + str(seed)
            report = fit(dataset, base, target / relative, kind, seed=seed,
                         epochs=epochs, batch_size=batch_size, device=device)
            experiments.append({'path': relative, 'kind': kind, 'seed': seed,
                                'macro': report['validation']['macro_f1_all_labels_zero_division_0'],
                                'micro': report['validation']['micro_f1'],
                                'artifact_sha256': file_hash(target / relative / 'READY.json')})
    groups = []
    for kind in KINDS:
        scores = [r['macro'] for r in experiments if r['kind'] == kind]
        groups.append({'kind': kind, 'macro_mean': statistics.mean(scores),
                       'macro_sample_std': statistics.stdev(scores) if len(scores) > 1 else None,
                       'seeds': len(scores), 'uncertainty_note': 'seed variation; not confidence interval'})
    best_kind = max(groups, key=lambda r: (r['macro_mean'], -KINDS.index(r['kind'])))['kind']
    chosen = max((r for r in experiments if r['kind'] == best_kind), key=lambda r: (r['macro'], r['micro'], -r['seed']))
    selection = {'contract': 'review-experiment-v2', 'dataset_sha256': file_hash(Path(dataset) / 'READY.json'),
                 'classification_unit': 'evaluation_target', 'label_count': len(metadata['labels']),
                 'experiments': experiments, 'comparison': groups, 'selected_path': chosen['path'],
                 'rule': 'best mean validation macro by kind; best validation macro/micro seed within kind; lower seed tie',
                 'synthetic': metadata['synthetic'], 'test_used_for_selection': False}
    write(target / 'selection.json', selection)
    plots(target, groups, len(metadata['labels']))
    seal(target, {'contract': selection['contract'], 'synthetic': metadata['synthetic']})
    return selection


def plots(destination, comparisons, label_count):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(8, 4), layout='constrained')
    ax.bar([r['kind'] for r in comparisons], [r['macro_mean'] for r in comparisons],
           yerr=[r['macro_sample_std'] or 0 for r in comparisons], capsize=5)
    ax.set(ylabel=f'Validation Macro-F1 (all {label_count} target labels; absent = 0)', ylim=(0, 1),
           title='Model comparison: error bars = seed standard deviation')
    fig.savefig(Path(destination) / 'validation_comparison.png', dpi=160)
    plt.close(fig)


def final_test(dataset, experiment, destination, device='cpu'):
    """One local claim per sealed experiment. Crash leaves claim; no auto retry."""
    experiment = Path(experiment).resolve(); verify(experiment)
    selection = read(experiment / 'selection.json')
    if selection.get('contract') != 'review-experiment-v2':
        raise ValueError('LEGACY_COARSE_EXPERIMENT_REQUIRES_RETRAINING')
    test_rows, metadata = load(dataset, 'test')
    if file_hash(Path(dataset) / 'READY.json') != selection['dataset_sha256']:
        raise ValueError('FINAL_DATASET_CHANGED')
    if Path(destination).exists():
        raise FileExistsError('FINAL_DESTINATION_EXISTS')
    for item in selection['experiments']:
        if file_hash(experiment / item['path'] / 'READY.json') != item['artifact_sha256']:
            raise ValueError('SELECTED_MODEL_CHANGED')
    claim(experiment.with_name(experiment.name + '.FINAL_TEST_CLAIM.json'),
          {'experiment_sha256': file_hash(experiment / 'READY.json'),
           'selection_sha256': file_hash(experiment / 'selection.json'), 'status': 'claimed; no automatic retry'})
    target = Path(destination); target.mkdir(parents=True, exist_ok=False)
    reports = []
    for item in selection['experiments']:
        scores, report = predict(experiment / item['path'], [r['text'] for r in test_rows], device)
        truth = targets(test_rows, metadata['labels'])
        predicted = decode(scores, report['threshold'], metadata['labels'])
        result = metrics(truth, predicted, metadata['labels'])
        result.update({'model': item['path'], 'threshold': report['threshold'],
                       'selected_before_test': item['path'] == selection['selected_path'], 'split': 'test'})
        model_dir = target / item['path']; model_dir.mkdir()
        write(model_dir / 'metrics.json', result)
        np.savez(model_dir / 'scores.npz', truth=truth, scores=scores)
        errors = []
        for index, row in enumerate(test_rows):
            prediction = [label for label, v in zip(metadata['labels'], predicted[index]) if v]
            if prediction != sorted(row['labels']):
                # Compare sets; label order carries no meaning.
                if set(prediction) != set(row['labels']):
                    errors.append({'key': row['key'], 'text_sha256': row['text_sha256'],
                                   'gold': row['labels'], 'predicted': prediction})
        write_rows(model_dir / 'errors.jsonl', errors)
        with (model_dir / 'per_label.csv').open('w', encoding='utf-8', newline='') as stream:
            writer = csv.DictWriter(stream, fieldnames=list(result['per_label'][0]))
            writer.writeheader(); writer.writerows(result['per_label'])
        reports.append(result)
    write(target / 'final.json', {'reports': reports, 'selected_path': selection['selected_path'],
                                 'selection_changed_after_test': False, 'synthetic': metadata['synthetic'],
                                 'release_approved': False, 'note': 'No automatic accuracy or production approval'})
    seal(target, {'split': 'test', 'synthetic': metadata['synthetic']})
    return {'models_evaluated': len(reports), 'release_approved': False}


def batch_predict(source, model, destination, device='cpu'):
    """A failed/held inference never turns into an empty successful analysis."""
    root = Path(model); predictor = Predictor(root, device)
    report = predictor.report; output = []; seen = set()
    from .common import digest
    for row in rows(source):
        result = {key: row.get(key) for key in ('key', 'appid', 'review_id', 'source_revision', 'snapshot_id', 'text_sha256')}
        result.update({'model_sha256': file_hash(root / 'READY.json'),
                       'taxonomy_sha256': report['dataset']['taxonomy_sha256'],
                       'policy_sha256': report['dataset']['policy_sha256'],
                       'synthetic_model': report['synthetic'], 'evidence_spans': None,
                       'classification_unit': 'evaluation_target',
                       'threshold': report['threshold'],
                       'taxonomy_version': report['dataset']['taxonomy']['version']})
        key = row.get('key')
        if (not isinstance(row.get('text'), str) or not row['text'].strip()
                or row.get('text_sha256') != digest(row['text'])
                or not row.get('source_revision') or not row.get('snapshot_id')
                or key != str(row.get('appid')) + ':' + str(row.get('review_id')) or key in seen):
            result.update({'state': 'REJECTED_INPUT', 'labels': None, 'scores': None, 'aspect_summary': None})
        else:
            seen.add(key)
            try:
                scores = predictor.score([row['text']])
                prediction = decode(scores, report['threshold'], report['dataset']['labels'])[0]
                selected = [label for label, flag in zip(report['dataset']['labels'], prediction) if flag]
                result.update({'state': 'PREDICTED_TARGETS' if selected else 'NO_TARGET_PREDICTED',
                               'labels': selected, 'scores': {l: float(v) for l, v in zip(report['dataset']['labels'], scores[0])},
                               'aspect_summary': rollup(selected, report['dataset']['taxonomy'])})
            except ValueError as exc:
                if str(exc) != 'LONG_BODY_HELD_NO_TRUNCATION':
                    raise  # abort batch; no success artifact on model/state failure
                result.update({'state': 'HELD_LONG_INPUT', 'labels': None, 'scores': None, 'aspect_summary': None})
        output.append(result)
    target = Path(destination); target.mkdir(parents=True, exist_ok=False)
    write(target / 'taxonomy.json', report['dataset']['taxonomy'])
    write_rows(target / 'predictions.jsonl', output)
    seal(target, {'model_sha256': file_hash(root / 'READY.json'), 'rows': len(output),
                  'database_writes': False, 'not_evidence_extraction': True,
                  'classification_unit': 'evaluation_target', 'synthetic_model': report['synthetic'],
                  'threshold': report['threshold'],
                  'taxonomy_sha256': report['dataset']['taxonomy_sha256'],
                  'policy_sha256': report['dataset']['policy_sha256']})
    return {'rows': len(output), 'model_sha256': file_hash(root / 'READY.json')}

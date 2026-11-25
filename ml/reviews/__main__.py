"""Run from repository root: python -m ml.reviews --help."""
import argparse
from pathlib import Path
from .common import canonical, read, rows, write, write_rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    for name in ('audit', 'approval-candidates'):
        p = sub.add_parser(name); p.add_argument('--source', required=True); p.add_argument('--out', required=True)
        if name == 'audit':
            p.add_argument('--approvals', required=True)
    p = sub.add_parser('import-base')
    p.add_argument('--source', required=True); p.add_argument('--out', required=True)
    p = sub.add_parser('build')
    for name in ('source', 'approvals', 'registry', 'base', 'out'):
        p.add_argument('--' + name, required=True)
    p.add_argument('--max-tokens', type=int, default=256); p.add_argument('--seed', type=int, default=42)
    p = sub.add_parser('train')
    for name in ('dataset', 'base', 'out'):
        p.add_argument('--' + name, required=True)
    p.add_argument('--seeds', type=int, nargs='+', default=[13, 42, 73])
    p.add_argument('--epochs', type=int, default=5); p.add_argument('--batch-size', type=int, default=16)
    p.add_argument('--device', choices=['cpu', 'cuda'], default='cpu')
    p = sub.add_parser('final')
    for name in ('dataset', 'experiment', 'out'):
        p.add_argument('--' + name, required=True)
    p.add_argument('--device', choices=['cpu', 'cuda'], default='cpu')
    p = sub.add_parser('predict')
    for name in ('source', 'model', 'out'):
        p.add_argument('--' + name, required=True)
    p.add_argument('--device', choices=['cpu', 'cuda'], default='cpu')
    args = parser.parse_args(); a = vars(args); command = a.pop('command')
    out = a.pop('out')
    if command in ('audit', 'approval-candidates'):
        records = read(a['source'])['records']; target = Path(out); target.mkdir(parents=True, exist_ok=False)
        if command == 'approval-candidates':
            from .contract import approval_candidates
            write_rows(target / 'approval_candidates.jsonl', [entry for record in records for entry in approval_candidates(record)])
            result = {'status': 'pending; not human approval', 'reviews': len(records)}
        else:
            from .dataset import audit
            workbench, errors = audit(records, rows(a['approvals']))
            write_rows(target / 'workbench.jsonl', workbench)
            result = {'input_reviews': len(records), 'eligible_reviews': sum(r['eligible'] for r in workbench),
                      'linked_human_opinions': sum(r['human_review_evidence_count'] for r in workbench), 'errors': errors,
                      'note': 'Unlinked review metadata does not prove that human review never occurred.'}
            write(target / 'audit.json', result)
            if errors:
                raise SystemExit('INVALID_SOURCE; private audit.json contains details')
    elif command == 'import-base':
        from .assets import import_base
        import_base(a['source'], out); result = {'base_imported': True, 'training_started': False}
    elif command == 'build':
        from .dataset import build
        a['registry_path'] = a.pop('registry')
        result = build(**a, destination=out)
        # Keep private review keys/reasons in the artifact, not console logs.
        result = {k: v for k, v in result.items() if k not in ('excluded',)}
    elif command == 'train':
        from .experiment import train
        result = train(**a, destination=out)
        result = {'models_trained': len(result['experiments']), 'synthetic': result['synthetic'],
                  'selected_path': result['selected_path'], 'test_used_for_selection': False}
    elif command == 'final':
        from .experiment import final_test
        result = final_test(**a, destination=out)
    else:
        from .experiment import batch_predict
        result = batch_predict(**a, destination=out)
    print(canonical(result))


if __name__ == '__main__':
    main()

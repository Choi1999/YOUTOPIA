import random
from pathlib import Path
from ml.reviews.common import digest, fingerprint, seal, write, write_rows
from ml.reviews.contract import approval_candidates, taxonomy


def record(app='synthetic-game', rid='synthetic-review', text='음악 좋다', polarity='긍정'):
    return {'key': app + ':' + rid, 'appid': app, 'review_id': rid,
            'clean_text': text, 'text_sha256': digest(text), 'review_status': '평가 있음',
            'taxonomy_version': taxonomy()['version'], 'taxonomy_sha256': fingerprint(taxonomy()),
            'active_opinion_ids': ['o1'], 'held_opinion_ids': [], 'human_reviewed': False,
            'voted_up': None, 'votes_up': None,
            'annotations': [{'id': 'o1', 'aspect_code': 'SOUND', 'target_code': 'SOUND.MUSIC', 'polarity': polarity,
                             'detail': '합성 평가 근거', 'evidence_spans': [{'start': 0, 'end': len(text), 'text': text}],
                             'human_reviewed': False}]}


def approvals(row):
    return [{**candidate, 'decision': 'confirmed', 'reviewer': 'synthetic-reviewer',
             'reviewed_at': '2026-11-25T19:00:00+09:00', 'source_ref': 'synthetic-test-only'}
            for candidate in approval_candidates(row)]


def tiny_base(root):
    import torch
    from transformers import ElectraConfig, ElectraModel, ElectraTokenizerFast
    target = Path(root); target.mkdir()
    vocabulary = ['[PAD]', '[UNK]', '[CLS]', '[SEP]', '[MASK]', '음악', '좋다', '오류', '많다', '표본']
    vocabulary += list('abcdefghijklmnopqrstuvwxyz') + ['##' + c for c in 'abcdefghijklmnopqrstuvwxyz']
    (target / 'vocab.txt').write_text('\n'.join(vocabulary) + '\n', encoding='utf-8')
    tokenizer = ElectraTokenizerFast(vocab_file=str(target / 'vocab.txt'), do_lower_case=False)
    tokenizer.save_pretrained(target)
    config = ElectraConfig(vocab_size=len(vocabulary), embedding_size=16, hidden_size=16,
                          intermediate_size=32, num_hidden_layers=1, num_attention_heads=2,
                          max_position_embeddings=64, pad_token_id=0)
    torch.manual_seed(7)
    ElectraModel(config).save_pretrained(target, safe_serialization=True)
    seal(target, {'repo': 'synthetic-random-electra', 'revision': 'synthetic-v1', 'synthetic': True})
    return target


def inputs(root):
    rng = random.Random(9); records = []
    for game in range(10):
        for item in range(6):
            suffix = ''.join(rng.choice('abcdefghijklmnopqrstuvwxyz') for _ in range(12))
            text = ('음악 좋다' if item % 2 else '오류 많다') + ' 표본 ' + suffix
            row = record('synthetic-g' + str(game), 'synthetic-r' + str(item), text,
                         '긍정' if item % 2 else '부정')
            if not item % 2:
                row['annotations'][0]['aspect_code'] = 'TECHNICAL'
                row['annotations'][0]['target_code'] = 'TECHNICAL.CRASH'
            records.append(row)
    write(root / 'source.json', {'records': records})
    write_rows(root / 'approvals.jsonl', [a for r in records for a in approvals(r)])
    write(root / 'registry.json', {'schema': 'pilot-reference-registry-v2', 'complete': True, 'synthetic': True,
                                 'source_ref': 'synthetic-test-only',
                                 'inventory': [{'id': 'synthetic-reference', 'expected_count': 1,
                                                'source_sha256': digest('synthetic-reference-source')}],
                                 'batches': [{'id': 'synthetic-reference', 'expected_count': 1,
                                              'keys': ['synthetic-reference:excluded']}]})
    return records

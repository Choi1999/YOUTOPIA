"""Validate this versioned guideline pilot; no network, training, or DB operations."""
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def load(name):
    return json.loads((BASE / name).read_text(encoding='utf-8'))


def span_check(text, span, field='text'):
    start, end = span['start'], span['end']
    require(isinstance(start, int) and isinstance(end, int) and 0 <= start <= end <= len(text), 'Invalid offsets')
    require(text[start:end] == span[field], 'Evidence does not match review text')


def validate():
    data, taxonomy, migration = load('pilot70.json'), load('taxonomy.json'), load('migration_v04_to_v05.json')
    current = json.loads((BASE.parent/'CURRENT.json').read_text(encoding='utf-8'))
    require(data['taxonomy_version'] == taxonomy['version'] == current['taxonomy_version'] == 'v0.5', 'Version mismatch')
    require(data['guideline_version'] == taxonomy['guideline_version'] == current['guideline_version'] == 'v1.2.0', 'Guideline mismatch')
    require(data['schema'] == current['pilot_schema'] == 'youtopia_pilot_consolidated_review_v2', 'Schema mismatch')
    require(current['status'] == 'PILOT_TAXONOMY_NOT_TRAINING_READY', 'Pilot is not a trained model')
    leaves = {s['leaf_id']:(c['code'],s['code'],s['label']) for c in taxonomy['categories'] for s in c['subaspects']}
    require(len(leaves) == sum(len(c['subaspects']) for c in taxonomy['categories']), 'Duplicate leaf IDs')
    require({c['code'] for c in taxonomy['categories']} == {
        'STORY','CHARACTER','GAMEPLAY','GRAPHICS','SOUND','USABILITY','CONTENT',
        'BALANCE','TECHNICAL','MONETIZATION','OPERATIONS','SOCIAL'}, 'Unexpected parents')
    records=data['records']
    require(len(records) == 70 and {r['display_number'] for r in records} == set(range(1,71)), 'Missing or duplicate review number')
    require(len({r['key'] for r in records}) == 70, 'Duplicate review key')
    require(set(data['pilot_exclusion_keys']) == {r['key'] for r in records}, 'Pilot leakage guard incomplete')
    active, held, key_by_id = {}, {}, {}
    support=defaultdict(set)
    for r in records:
        text=r['clean_text']
        require(hashlib.sha256(text.encode('utf-8')).hexdigest() == r['text_sha256'], 'Review hash mismatch')
        require(r['learning_eligible'] is False, 'Guideline pilot cannot train or enter final test')
        require(r['reclassification_review']['user_verified'] is False, 'New AI classification cannot self-approve')
        require(set(r['active_opinion_ids']) == {a['id'] for a in r['annotations']}, 'Active index mismatch')
        require(set(r['held_opinion_ids']) == {a['id'] for a in r['held_annotations']}, 'Held index mismatch')
        directions=defaultdict(set)
        for a in r['annotations']:
            require(a['id'] not in active, 'Duplicate opinion ID')
            require(a['state'] == 'ACTIVE' and a['polarity'] in ('긍정','부정'), 'Invalid active state/polarity')
            require(a['leaf_id'] in leaves, 'Unknown leaf')
            require(leaves[a['leaf_id']] == (a['aspect_code'],a['subaspect_code'],a['subaspect']), 'Leaf mapping mismatch')
            require(a['learning_eligible'] is False and a['classification_review']['user_verified'] is False, 'AI/pilot promoted to gold')
            span_check(text,a,'evidence')
            for s in a['supporting_context_spans']:span_check(text,s)
            for s in a['target'].get('mentions',[]):span_check(text,s)
            active[a['id']]=a
            key_by_id[a['id']]=r['key']
            directions[a['leaf_id']].add(a['polarity'])
            support[a['leaf_id']].add(r['key'])
        expected={k:('복합' if len(v)>1 else next(iter(v))) for k,v in directions.items()}
        require(expected == r['leaf_directions'], 'Leaf aggregation lost or mixed unrelated sentiments')
        for a in r['held_annotations']:
            require(a['id'] not in held and a['id'] not in active, 'Held collision')
            require(a['state']=='HOLD' and a['leaf_id'] is None and a['polarity'] is None and a['learning_eligible'] is False, 'HOLD was resolved implicitly')
            span_check(text,a,'evidence')
            held[a['id']]=a
        for x in r['excluded_spans']:
            span_check(text,x)
            require(x.get('retain_in_model_input') is True, 'Excluded span removed from input')
            require(x.get('span_negative_training_eligible') is False, 'Exclusion wrongly used as token-negative gold')
    seen_sources, seen_results=set(),set()
    for m in migration['mappings']:
        require(m['source_opinion_id'] not in seen_sources, 'Duplicate source migration')
        seen_sources.add(m['source_opinion_id'])
        source_review=next(r for r in records if r['key']==m['review_key'])
        require(m['source_evidence'] in source_review['clean_text'], 'Source evidence lost')
        for child in m['result']:
            require(child['id'] in active and child['id'] not in seen_results,'Missing/duplicate migrated child')
            a=active[child['id']]
            require(a['source_opinion_id']==m['source_opinion_id'] and key_by_id[a['id']]==m['review_key'],'Broken provenance')
            require(a['aspect_code']==m['source_aspect_code'] and a['polarity']==m['source_polarity']==child['polarity'],'Changed adjudicated sentiment/parent')
            require(a['leaf_id']==child['leaf_id'],'Migration leaf mismatch')
            seen_results.add(a['id'])
    require(len(seen_sources)==112 and seen_results==set(active) and len(active)==118,'Incomplete migration')
    require(set(migration['preserved_hold_ids'])==set(held) and len(held)==7,'Held decisions lost')
    require(data['counts']['active_opinions']==len(active) and data['counts']['held_opinions']==len(held),'Count mismatch')
    by_number={r['display_number']:r for r in records}
    require(by_number[58]['annotations']==[],'Background knowledge leaked into review 58')
    require({a['leaf_id'] for a in by_number[69]['annotations']} == {
        'USABILITY.NAVIGATION','USABILITY.SETTINGS_ACCESSIBILITY','GAMEPLAY.HIT_FEEL','USABILITY.CONTROLS'},'Review 69 boundary changed')
    require(next(a for a in by_number[57]['annotations'] if a['subaspect_code']=='UNSPECIFIED')['polarity_strength']=='weak','Weak positive lost')
    require(all(a['subaspect_code']=='UNSPECIFIED' for n in (63,68) for a in by_number[n]['annotations'] if a['aspect_code']=='CHARACTER'),'Appearance inferred')
    require(all(a['leaf_id'] not in ('TECHNICAL.SAVE_PROGRESS_LOSS','OPERATIONS.PATCH_RESPONSE') for a in by_number[60]['annotations']),'Bug root cause/operation inferred')
    manifest=load('manifest.json')
    for path,expected_hash in manifest['files'].items():
        p=ROOT/path
        require(p.is_file(),f'Missing versioned file {path}')
        require(hashlib.sha256(p.read_bytes()).hexdigest()==expected_hash,f'File hash mismatch: {path}')
    counts=Counter(a['leaf_id'] for a in active.values())
    report={
        'status':'PASS','taxonomy_version':'v0.5','reviews':70,'source_opinions':112,
        'active_opinions':118,'held_opinions':7,'registered_leaves':len(leaves),
        'observed_leaves':len(counts),'split_source_opinions':sum(m['operation']=='SPLIT' for m in migration['mappings']),
        'review_text_hashes':'PASS','evidence_offsets':'PASS','migration_coverage':'PASS',
        'polarity_parent_preservation':'PASS','hold_exclusion_preservation':'PASS','leaf_aggregation':'PASS',
        'manifest_hashes':'PASS','training_performed':False,'deployment_performed':False,
        'user_verified_new_leaf_labels':0,
        'support_by_leaf':{k:{'reviews':len(support[k]),'opinions':counts[k]} for k in sorted(leaves)}}
    (BASE/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return {k:v for k,v in report.items() if k!='support_by_leaf'}


if __name__=='__main__':
    print(json.dumps(validate(),ensure_ascii=False,indent=2))

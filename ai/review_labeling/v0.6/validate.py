"""Portable checks for pilot integrity and adjudication boundaries; no remote access."""
import copy
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]

def require(ok, message):
    if not ok:
        raise ValueError(message)

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def check_span(text, span, field='text'):
    a,b = span['start'],span['end']
    require(type(a) is int and type(b) is int and 0 <= a < b <= len(text),'Invalid span offsets')
    require(text[a:b] == span[field], 'Evidence/offset mismatch')

def validate():
    data=read(BASE/'pilot100.json'); taxonomy=read(BASE/'taxonomy.json')
    current=read(BASE.parent/'CURRENT.json'); migration=read(BASE/'migration_v05_to_v06.json')
    old=read(ROOT/migration['source_file'])
    require(data['taxonomy_version']==taxonomy['version']==current['taxonomy_version']=='v0.6','Taxonomy version mismatch')
    require(data['guideline_version']==taxonomy['guideline_version']==current['guideline_version']=='v1.3.0','Guideline mismatch')
    require(data['schema']==current['pilot_schema']=='youtopia_pilot_consolidated_review_v2','Dataset schema mismatch')
    require(current['status']=='PILOT_TAXONOMY_NOT_TRAINING_READY','Trained-service claim invalid')
    for pointer in ['taxonomy','guidelines','pilot','review_table','handoff','manifest','adjudications']:
        require((ROOT/current[pointer]).is_file(),f'Broken CURRENT pointer: {pointer}')
    leaves={s['leaf_id']:(c['code'],s['code'],s['label']) for c in taxonomy['categories'] for s in c['subaspects']}
    require(len(leaves)==sum(len(c['subaspects']) for c in taxonomy['categories']),'Duplicate leaves')
    old_leaves={s['leaf_id'] for c in read(BASE.parent/'v0.5/taxonomy.json')['categories'] for s in c['subaspects']}
    require(set(leaves)-old_leaves=={'CONTENT.TRACK_CATALOG','GAMEPLAY.EXPLORATION'} and old_leaves <= set(leaves),'Unexpected taxonomy delta')
    records=data['records']; by_number={r['display_number']:r for r in records}
    require(len(records)==100 and set(by_number)==set(range(1,101)),'Missing/duplicate review numbers')
    require(len({r['key'] for r in records})==100,'Duplicate review key')
    require(len({r['text_sha256'] for r in records})==100,'Duplicate review text')
    require(set(data['pilot_exclusion_keys'])=={r['key'] for r in records},'Incomplete pilot leakage guard')
    for i,legacy in enumerate(old['records']):
        expected=copy.deepcopy(legacy); expected.update(taxonomy_version='v0.6',guideline_version='v1.3.0')
        require(records[i]==expected,f'Legacy record {i+1} or review status changed')
    for path,sha in migration['historical_version_files'].items():
        require(hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==sha,'Archived file changed: '+path)
    require(hashlib.sha256((ROOT/migration['source_file']).read_bytes()).hexdigest()==migration['source_sha256']==data['source']['sha256'],'Source pilot hash changed')
    excerpts={x['display_number']:x for x in read(BASE/'source_excerpts_71_100.json')['records']}
    require(set(excerpts)==set(range(71,101)),'Incomplete source excerpts')
    active_ids=set(); held_ids=set(); support=defaultdict(set); active_count=Counter(); verified=0
    for r in records:
        n=r['display_number']; text=r['clean_text']
        require(hashlib.sha256(text.encode()).hexdigest()==r['text_sha256'],'Text hash mismatch')
        require(r['key']==f"{r['appid']}:{r['review_id']}",'Wrong review key')
        require(r['learning_eligible'] is False,'Pilot promoted to training data')
        require(r['taxonomy_version']=='v0.6' and r['guideline_version']=='v1.3.0','Record version mismatch')
        require(r['active_opinion_ids']==[a['id'] for a in r['annotations']],'Active index mismatch')
        require(r['held_opinion_ids']==[a['id'] for a in r['held_annotations']],'Held index mismatch')
        directions=defaultdict(set)
        for a in r['annotations']:
            require(a['id'] not in active_ids and a['id'] not in held_ids,'Duplicate opinion ID')
            active_ids.add(a['id'])
            require(a['state']=='ACTIVE' and a['polarity'] in ('긍정','부정'),'Invalid active polarity')
            require(leaves.get(a['leaf_id'])==(a['aspect_code'],a['subaspect_code'],a['subaspect']),'Unknown or mismatched leaf')
            require(a['learning_eligible'] is False,'Pilot opinion promoted to training')
            require(a['classification_review']['user_verified'] is (n>70),'Review provenance misrepresented')
            verified+=a['classification_review']['user_verified']
            check_span(text,a,'evidence')
            for s in a['supporting_context_spans']:check_span(text,s)
            for s in a['target'].get('mentions',[]):check_span(text,s)
            directions[a['leaf_id']].add(a['polarity']);support[a['leaf_id']].add(r['key']);active_count[a['leaf_id']]+=1
        expected={k:('복합' if len(v)>1 else next(iter(v))) for k,v in directions.items()}
        require(r['leaf_directions']==expected,'Incorrect within-leaf sentiment aggregation')
        for h in r['held_annotations']:
            require(h['id'] not in held_ids and h['id'] not in active_ids,'Duplicate held opinion')
            held_ids.add(h['id']);check_span(text,h,'evidence')
            require(h['state']=='HOLD' and h['polarity'] is None and h['leaf_id'] is None and h['learning_eligible'] is False,'Hold implicitly resolved')
        for x in r['excluded_spans']:
            check_span(text,x)
            require(x['retain_in_model_input'] is True and x['span_negative_training_eligible'] is False,'Excluded text removed or made negative gold')
        if n>70:
            e=excerpts[n]; api=e['api_review_fields']
            require(e['appid']==r['appid'] and str(api['recommendationid'])==r['review_id'] and api['review']==text,'Source excerpt mismatch')
            require(e['raw_response_sha256']==r['source']['raw_sha256'] and e['observed_at']==r['source']['observed_at'],'Source provenance mismatch')
            require(api['voted_up'] is r['metadata']['steam_recommended'],'Steam recommendation changed')
            require(api['author']['playtime_at_review']==r['metadata']['playtime_at_review_minutes'],'At-review playtime changed')
            require(api['author']['playtime_forever']==r['metadata']['playtime_forever_minutes'],'Collection playtime changed')
            require(r['reclassification_review']['user_verified'] is True and r['reclassification_review']['independent_blind_annotation'] is False,'User adjudication mistaken for independent labeling')
            require(r['annotation_input']['text_only_sufficient'] is (n!=92),'Metadata-assisted requirement lost')
            require(r['annotation_input']['required_metadata']==(['steam_recommended'] if n==92 else []),'Unexpected metadata input')
    def pairs(n):return {(a['leaf_id'],a['polarity']) for a in by_number[n]['annotations']}
    require(pairs(83)=={('USABILITY.CONTROLS','부정')},'83 must be a control issue')
    require(by_number[84]['analysis_status']=='NO_CONCRETE_EVALUATION' and not by_number[84]['annotations'] and not by_number[84]['held_annotations'],'84 must have no concrete evaluation')
    require(any(x['text']==by_number[84]['clean_text'] for x in by_number[84]['excluded_spans']),'84 exclusion missing')
    require(pairs(92)=={('SOUND.SFX','부정')} and not by_number[92]['held_annotations'],'92 user decision missing')
    require(by_number[92]['metadata']['steam_recommended'] is False and by_number[92]['annotations'][0]['sentiment_basis']=='STEAM_RECOMMENDATION_TIEBREAK','92 metadata basis lost')
    require(data['text_only_comparison_excluded_keys']==[by_number[92]['key']],'92 wrongly used as text-only gold')
    require(pairs(95)=={('CONTENT.TRACK_CATALOG','부정')},'95 track catalog missing')
    require(pairs(96)=={('SOUND.MUSIC_BGM','긍정'),('GAMEPLAY.RULES_SYSTEM','긍정')},'96 gameplay/music distinction missing')
    require(len({a['source_opinion_id'] for a in by_number[96]['annotations']})==1,'96 shared source relation lost')
    require(('GAMEPLAY.EXPLORATION','긍정') in pairs(91),'91 exploration approval missing')
    require(('MONETIZATION.PURCHASE_ACCESS','부정') in pairs(76),'76 purchase structure approval missing')
    require(pairs(80)=={('STORY.UNSPECIFIED','긍정'),('CONTENT.VARIETY','부정')},'80 story/content split changed')
    require(by_number[78]['metadata']['playtime_at_review_minutes']==643 and by_number[78]['metadata']['playtime_forever_minutes']==910,'78 source times changed')
    require(pairs(100)=={('GAMEPLAY.BUILDING_MANAGEMENT','긍정')},'100 sentiment overwritten by Steam metadata')
    require(len(held_ids)==8 and set(migration['preserved_hold_ids']) <= held_ids and len(by_number[75]['held_annotations'])==1,'Preserved holds lost')
    counts=data['counts']
    expected_counts={'reviews':len(records),'active_opinions':len(active_ids),'held_opinions':len(held_ids),
      'reviews_with_holds':sum(bool(r['held_annotations']) for r in records),
      'no_concrete_evaluation_reviews':sum(r['analysis_status']=='NO_CONCRETE_EVALUATION' for r in records),
      'active_opinions_user_verified':verified,'records_with_user_verified_leaf_decisions':30,'legacy_records_pending_leaf_review':70,'metadata_assisted_reviews':1}
    for k,v in expected_counts.items():require(counts[k]==v,'Incorrect count: '+k)
    for path,sha in read(BASE/'manifest.json')['files'].items():
        require(hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==sha,'Manifest hash mismatch: '+path)
    report={'status':'PASS','taxonomy_version':'v0.6','guideline_version':'v1.3.0',**expected_counts,
        'registered_leaves':len(leaves),'observed_leaves':len(active_count),
        'review_text_hashes':'PASS','evidence_offsets':'PASS','source_excerpt_integrity':'PASS',
        'archived_version_preservation':'PASS','user_corrections':'PASS','hold_exclusion_preservation':'PASS',
        'metadata_input_separation':'PASS','leaf_aggregation':'PASS','manifest_hashes':'PASS',
        'training_performed':False,'deployment_performed':False,
        'support_by_leaf':{k:{'reviews':len(support[k]),'opinions':active_count[k]} for k in sorted(leaves)}}
    (BASE/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return {k:v for k,v in report.items() if k!='support_by_leaf'}

if __name__=='__main__':
    print(json.dumps(validate(),ensure_ascii=False,indent=2))

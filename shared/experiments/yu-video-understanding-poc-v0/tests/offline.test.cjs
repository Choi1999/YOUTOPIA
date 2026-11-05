'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const x=require('../g1-offline.cjs');
function copy(v){return structuredClone(v);}
test('36 questions, six synthetic videos, fixed 12/8/6/5/5 categories',()=>{
 const d=x.benchmark(),idx=x.validate(d);assert.equal(idx.vmap.size,6);
 assert.equal(idx.qmap.size,36);assert.deepEqual(idx.count,{SPEECH:12,VISUAL:8,OCR:6,TEMPORAL:5,UNSUPPORTED:5});
});
test('108 paired mock responses with zero external calls',()=>{
 const d=x.benchmark(),p=x.responses(d);x.validateResponses(d,p);assert.equal(p.rows.length,108);assert.equal(p.externalCalls,0);
});
test('real video source is not eligible for offline-only validation',()=>{
 const d=x.benchmark();d.videos[0].sourceType='APPROVED_VIDEO';assert.throws(()=>x.validate(d),/rights/);
});
test('external source reference is forbidden',()=>{
 const d=x.benchmark();d.videos[0].scenes[0].sourceRef='https://youtube.com/watch';assert.throws(()=>x.validate(d),/synthetic scene/);
});
test('duplicated question fails closed',()=>{
 const d=x.benchmark();d.questions[1].questionId=d.questions[0].questionId;assert.throws(()=>x.validate(d),/question id/);
});
test('missing question is not interpreted as zero',()=>{
 const d=x.benchmark();d.questions.pop();assert.throws(()=>x.validate(d),/dataset size/);
});
test('gold temporal evidence requires before-then-after',()=>{
 const d=x.benchmark();d.questions[3].gold.evidence.reverse();assert.throws(()=>x.validate(d),/order/);
});
test('missing prediction is rejected',()=>{
 const d=x.benchmark(),p=x.responses(d);p.rows.pop();assert.throws(()=>x.validateResponses(d,p),/3x36/);
});
test('duplicate trial and new provider arm rejected',()=>{
 const d=x.benchmark(),p=x.responses(d);p.rows[1].questionId=p.rows[0].questionId;assert.throws(()=>x.validateResponses(d,p),/duplicate/);
});
test('live call count and retry count prohibited',()=>{
 const d=x.benchmark(),p=x.responses(d);p.rows[0].usage.externalCalls=1;assert.throws(()=>x.validateResponses(d,p),/live request/);
 p.rows[0].usage.externalCalls=0;p.rows[0].usage.retries=1;assert.throws(()=>x.validateResponses(d,p),/live request/);
});
test('time shift above five seconds invalidates temporal matching',()=>{
 const d=x.benchmark(),p=x.responses(d),q=d.questions[0],row=copy(p.rows[0]);
 row.evidence[0].startMs+=6000;row.evidence[0].endMs+=6000;
 assert.equal(x.aligned(row,q,x.validate(d).vmap.get(q.videoRef)),false);
});
test('missing evidence is not grounded',()=>{
 const d=x.benchmark(),p=x.responses(d),q=d.questions[29];
 assert.equal(x.aligned(p.rows[29],q,x.validate(d).vmap.get(q.videoRef)),false);
});
test('incorrect scene is traceable but not supporting evidence',()=>{
 const d=x.benchmark(),p=x.responses(d),q=d.questions[9],v=x.validate(d).vmap.get(q.videoRef);
 assert.equal(x.aligned(p.rows[9],q,v),false);
});
test('rights epoch mismatch invalidates evidence trace',()=>{
 const d=x.benchmark(),p=x.responses(d),row=copy(p.rows[0]);
 row.evidence[0].rightsEpoch=1;assert.equal(x.traceable(row,x.validate(d).vmap.get(row.videoRef)),false);
});
test('unanswerable question correctly abstains under alternate mock arm',()=>{
 const d=x.benchmark(),p=x.responses(d);assert.equal(p.rows[35].answerability,'SUPPORTED');
 assert.equal(p.rows[36+35].answerability,'UNSUPPORTED');
});
test('quality metrics never claim model performance validated',()=>{
 const d=x.benchmark(),p=x.responses(d),r=x.evaluate(d,p);
 assert.equal(r.decision,'INCONCLUSIVE_OFFLINE_SYNTHETIC');assert.equal(r.liveAccuracyVerified,false);
 assert.equal(r.byArm.SEMANTIC_INDEX.sampleCount,36);
});
test('hypothetical N=1/5/20 costs are calculated without spending',()=>{
 const r=x.cost();assert.equal(r.actualSpendUsd,0);assert.equal(r.providerRatesVerified,false);
 assert.equal(r.byArm.NATIVE_MULTIMODAL[5].perVideoUsd,0.055);
 assert.equal(r.byArm.SEMANTIC_INDEX[5].perVideoUsd,0.0345);
 assert.equal(r.byArm.SEMANTIC_INDEX[20].sixVideoUsd,0.432);
});
test('unknown cost remains unknown instead of zero',()=>{
 const template={setup:{ingestion:0,preprocessing:0,indexing:0,storage:0,lifecycle:0},
 query:{inference:0,retrieval:0,recheck:0}};
 const model=Object.fromEntries(x.ARMS.map(a=>[a,copy(template)]));model.NATIVE_MULTIMODAL.setup.ingestion=null;
 assert.equal(x.cost(model).byArm.NATIVE_MULTIMODAL[5].perVideoUsd,null);
});
test('negative cost fails closed',()=>{
 const template={setup:{ingestion:0,preprocessing:0,indexing:0,storage:0,lifecycle:0},
 query:{inference:0,retrieval:0,recheck:0}};
 const model=Object.fromEntries(x.ARMS.map(a=>[a,copy(template)]));model.TRANSCRIPT_ONLY.setup.indexing=-1;
 assert.throws(()=>x.cost(model),/invalid or negative cost/);
});
test('CLI remains offline and cannot authorize merge, provider calls or spending',()=>{
 const r=x.run();assert.equal(r.status,'OFFLINE_ONLY');assert.equal(r.liveCallsAuthorized,false);
 assert.equal(r.externalCalls,0);assert.equal(r.actualSpendUsd,0);assert.equal(r.mergeApproved,false);
});

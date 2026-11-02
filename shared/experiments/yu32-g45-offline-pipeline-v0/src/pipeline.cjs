"use strict";
/**
 * End-to-end synthetic-only: documented response shape -> in-memory filtered
 * rows -> toy rule-based labels -> counts -> analysis-v1 candidate snapshot.
 * Does not fetch, persist, publish, call a model, or use an API credential.
 */
const {parseSyntheticCommentThreadsPage}=require("./ingest.cjs");
const {classifySyntheticText}=require("./synthetic-classifier.cjs");
function buildSyntheticSnapshot(envelope){
  const p=parseSyntheticCommentThreadsPage(envelope);
  const eligible=p.rows.filter(x=>x.eligible);
  const counts={positive:0,neutral:0,negative:0};
  const topics=new Map();
  let classified=0;
  for(const row of eligible){
    const label=classifySyntheticText(row.text);
    if(label.sentiment){counts[label.sentiment]++;classified++;}
    for(const id of label.topics){
      const current=topics.get(id)||{topicId:id,mentionCount:0,
        classifiedTopicCount:0,negativeTopicCount:0};
      current.mentionCount++;
      if(label.sentiment){current.classifiedTopicCount++;}
      if(label.sentiment==="negative")current.negativeTopicCount++;
      topics.set(id,current);
    }
  }
  const empty=p.rawCount===0&&!p.hasNextPage;
  const status=empty?"NO_DATA":
    p.hasNextPage||eligible.length===0||classified<eligible.length?"PARTIAL":"READY";
  const snapshot={
    contractVersion:"analysis-v1-candidate",
    snapshotId:"synthetic-g45-"+(empty?"empty":p.hasNextPage?"partial":"complete"),
    target:{source:"YOUTUBE",targetType:"VIDEO",targetId:p.videoId},
    scope:p.scope,status,sourceType:"STATIC_FIXTURE",isSynthetic:true,
    visibility:"PUBLIC_REUSABLE",tenantId:null,
    observedAt:p.observedAt,
    analyzedAt:empty?null:p.analyzedAt,
    sample:empty?null:{
      rawCount:p.rawCount,eligibleCount:eligible.length,
      excludedCount:p.rawCount-eligible.length,
      classifiedCount:classified,unclassifiedCount:eligible.length-classified
    },
    sentiment:empty?null:counts,
    topics:empty?[]:Array.from(topics.values()).sort((a,b)=>a.topicId.localeCompare(b.topicId)),
    analysisVersion:empty?null:"synthetic-rule-v0-not-production",
    topicTaxonomyVersion:empty?null:"synthetic-taxonomy-v0"
  };
  // Deliberately keep evidence separate from the strict AnalysisSnapshot schema.
  const evidence={
    resultKind:"OFFLINE_SYNTHETIC_QA_ONLY",
    sourceType:"STATIC_FIXTURE",providerRequestsMade:0,
    externalProviderApproved:false,
    derivedMetricsApproved:false,
    samplePopulationClaim:false,
    topLevelOnly:true,
    nextPageAvailable:p.hasNextPage,
    repliesNotEnumerated:true,
    rawCommentPersistence:"NONE",
    profileInference:"NONE",
    topicsNotProbability:true,
    trendStatus:"TREND_UNAVAILABLE",
    classificationModel:"SYNTHETIC_RULES_UNVALIDATED",
    quotaUnitsConsumed:0
  };
  return {snapshot,evidence};
}
// External errors are not "zero comments". Do not produce synthetic scores.
function classifySourceFailure(reason){
  if(reason!=="commentsDisabled"&&reason!=="quotaExceeded"&&reason!=="forbidden"&&
     reason!=="videoNotFound"&&reason!=="unknown")reason="unknown";
  return Object.freeze({
    status:reason==="commentsDisabled"?"COMMENTS_DISABLED":
      reason==="forbidden"?"POLICY_BLOCKED":"ERROR",
    sample:null,sentiment:null,topics:[],analyzedAt:null,
    providerRequestsMade:0,classification:"DIAGNOSTIC_ONLY_NOT_LIVE",
    sourceType:"STATIC_FIXTURE"
  });
}
module.exports=Object.freeze({buildSyntheticSnapshot,classifySourceFailure});

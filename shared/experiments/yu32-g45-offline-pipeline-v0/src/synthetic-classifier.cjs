"use strict";
/**
 * Deterministic rules for synthetic QA examples ONLY. Not an approved sentiment
 * model, not calibrated, no inference about commenters or sensitive traits.
 */
const TOPICS=Object.freeze({
  EDITING:["편집","영상 구성","editing"],
  AUDIO:["소리","음질","audio"],
  CAPTIONS:["자막","subtitles"],
  PRICE:["가격","price"]
});
const POS=["좋아요","좋습니다","만족","great","love"];
const NEG=["아쉬워","불편","나빠","싫어","bad"];
const NEUT=["무난","보통","평범","okay"];
function hasAny(text,words){return words.some(w=>text.includes(w));}
function classifySyntheticText(text){
  if(typeof text!=="string"||text.length>10000)throw new TypeError("G45 synthetic text required");
  const s=text.normalize("NFKC").toLowerCase();
  const positive=hasAny(s,POS),negative=hasAny(s,NEG),neutral=hasAny(s,NEUT);
  // Ambiguous or unsupported prose must abstain instead of inventing confidence.
  const active=Number(positive)+Number(negative)+Number(neutral);
  const sentiment=active!==1?null:(positive?"positive":negative?"negative":"neutral");
  const topics=Object.keys(TOPICS).filter(k=>hasAny(s,TOPICS[k]));
  return {sentiment,topics};
}
module.exports=Object.freeze({classifySyntheticText});

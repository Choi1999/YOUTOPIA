"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.join(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const VIDEO_A="Ab0_-123xyz";
const VIDEO_B="Ab0_-123xyZ";
const CHANNEL="UC"+"a".repeat(22);
const DOM_IDS=[
  "selection-status","selection-details","selection-kind","selection-id",
  "web-analysis-link","demo-preview","demo-scope","demo-sample",
  "demo-briefing","demo-sentiment-bar","demo-topics",
  "demo-positive","demo-neutral","demo-negative",
  "demo-bar-positive","demo-bar-neutral","demo-bar-negative",
  ...["overview","topics","trends"].flatMap(x=>["demo-tab-"+x,"demo-panel-"+x])
];

function makeElement(id="") {
  const listeners=new Map();
  const attrs=new Map();
  return {
    id,hidden:false,textContent:"",style:{},href:"",tabIndex:0,children:[],
    focused:0,
    setAttribute(name,value){attrs.set(name,String(value));},
    getAttribute(name){return attrs.get(name)??null;},
    removeAttribute(name){
      attrs.delete(name);
      if(name==="href")this.href="";
    },
    replaceChildren(...children){this.children=children;},
    addEventListener(type,fn){
      if(!listeners.has(type))listeners.set(type,new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
    trigger(type,event={}){
      for(const fn of listeners.get(type)||[])fn(event);
    },
    focus(){this.focused++;},
  };
}
function harness() {
  const elements=new Map(DOM_IDS.map(id=>[id,makeElement(id)]));
  let reply={
    type:"YUTOPIA_YU28_SELECTION_RESULT_V1",
    version:1,tabId:17,ok:true,status:"EMPTY"
  };
  let activeTab=17;
  let deferred=null;
  let calls=0;
  const subs={};
  const doc={
    getElementById:id=>elements.get(id)??null,
    createElement:tag=>makeElement(tag),
    documentElement:{dataset:{}}
  };
  const ctx=vm.createContext({
    document:doc,Promise,Date,console,
    setTimeout:()=>1,clearTimeout(){},
    addEventListener(){},removeEventListener(){},
    chrome:{
      tabs:{
        query:async()=>[{id:activeTab}],
        onActivated:{addListener(fn){subs.activate=fn;},removeListener(){}}
      },
      storage:{onChanged:{addListener(fn){subs.changed=fn;},removeListener(){}}},
      runtime:{sendMessage:async()=>{
        calls++;
        return deferred?await deferred:reply;
      }},
    }
  });
  for(const file of [
    "panel-selection-contract.js","hover-card-model.js",
    "web-analysis-link.js","sidepanel.js"
  ])vm.runInContext(read(file),ctx,{filename:file});
  const contract=ctx.YUTOPIA_PANEL_SELECTION;
  function pin(targetType="VIDEO",targetId=VIDEO_A,tab=17){
    return contract.makePin({
      targetType,targetId,requestId:3
    },tab,"document_demo_123");
  }
  function response(targetType="VIDEO",targetId=VIDEO_A,tab=17){
    return{type:contract.READ_RESULT_TYPE,version:contract.VERSION,
      tabId:tab,ok:true,status:"READY",pin:pin(targetType,targetId,tab)};
  }
  return{
    elements,ctx,contract,panel:ctx.YUTOPIA_SIDE_PANEL,
    model:ctx.YUTOPIA_HOVER_CARD_MODEL,
    get:id=>elements.get(id),
    setReply(value){reply=value;},
    setActiveTab(id){activeTab=id;},
    setDeferred(p){deferred=p;},
    getCalls(){return calls;},response,pin,
    empty:(tab=17)=>({type:contract.READ_RESULT_TYPE,version:1,
      tabId:tab,ok:true,status:"EMPTY"}),
  };
}
test("YU33-01 Side Panel visibly shows the pinned VIDEO's synthetic summary only",async()=>{
  const f=harness();
  f.setReply(f.response("VIDEO",VIDEO_A));
  await f.panel.refresh();
  const mock=f.model.mockForTarget({targetType:"VIDEO",targetId:VIDEO_A});
  assert.equal(f.get("demo-preview").hidden,false);
  assert.equal(f.get("demo-scope").textContent,mock.scopeLabel);
  assert.equal(f.get("demo-sample").textContent,mock.sampleLabel+" · "+mock.periodLabel);
  for(const key of ["positive","neutral","negative"]){
    assert.equal(f.get("demo-"+key).textContent,mock[key]+"%");
    assert.equal(f.get("demo-bar-"+key).style.width,mock[key]+"%");
  }
  assert.match(f.get("demo-sentiment-bar").getAttribute("aria-label"),/가상 감성 분포/);
  assert.equal(f.get("web-analysis-link").hidden,false);
  assert.match(f.get("web-analysis-link").href,/\/analysis\/youtube\/video\/Ab0_-123xyz$/);
  assert.equal(f.panel.getRuntimeStatus().previewVisible,true);
  assert.equal(f.panel.getRuntimeStatus().previewTab,"overview");
  f.panel.dispose();
});
test("YU33-02 topics and trends tabs navigate by click and keyboard without external calls",async()=>{
  const f=harness();
  f.setReply(f.response());
  await f.panel.refresh();
  const initialRequests=f.getCalls();
  const topics=f.get("demo-tab-topics");
  topics.trigger("click");
  assert.equal(f.get("demo-panel-overview").hidden,true);
  assert.equal(f.get("demo-panel-topics").hidden,false);
  assert.equal(topics.getAttribute("aria-selected"),"true");
  assert.deepEqual(f.get("demo-topics").children.map(x=>x.textContent),
    [...f.model.mockForTarget({targetType:"VIDEO",targetId:VIDEO_A}).topics]);
  let prevented=false;
  topics.trigger("keydown",{key:"ArrowRight",preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  assert.equal(f.get("demo-panel-trends").hidden,false);
  assert.equal(f.get("demo-tab-trends").focused,1);
  f.get("demo-tab-trends").trigger("keydown",{key:"Home",preventDefault(){}});
  assert.equal(f.get("demo-panel-overview").hidden,false);
  assert.equal(f.get("demo-tab-overview").tabIndex,0);
  assert.equal(f.getCalls(),initialRequests,"UI tab changes must not call worker again");
  f.panel.dispose();
});
test("YU33-03 selection change and EMPTY response clear old preview and web navigation",async()=>{
  const f=harness();
  f.setReply(f.response("VIDEO",VIDEO_A));
  await f.panel.refresh();
  f.get("demo-tab-topics").trigger("click");
  f.setReply(f.response("VIDEO",VIDEO_B));
  await f.panel.refresh();
  assert.equal(f.get("demo-preview").hidden,false);
  assert.equal(f.get("demo-panel-overview").hidden,false,"new target resets to overview");
  assert.equal(f.get("demo-sample").textContent,
    f.model.mockForTarget({targetType:"VIDEO",targetId:VIDEO_B}).sampleLabel+" · "+
    f.model.mockForTarget({targetType:"VIDEO",targetId:VIDEO_B}).periodLabel);
  assert.match(f.get("web-analysis-link").href,/Ab0_-123xyZ$/);
  f.setReply(f.empty());
  await f.panel.refresh();
  assert.equal(f.get("demo-preview").hidden,true);
  assert.equal(f.get("demo-sample").textContent,"");
  assert.equal(f.get("demo-topics").children.length,0);
  assert.equal(f.get("demo-bar-positive").style.width,"0%");
  assert.equal(f.get("web-analysis-link").hidden,true);
  assert.equal(f.get("web-analysis-link").href,"");
  assert.equal(f.panel.getRuntimeStatus().previewVisible,false);
  f.panel.dispose();
});
test("YU33-04 verified CHANNEL gets synthetic preview but never VIDEO deep link",async()=>{
  const f=harness();
  f.setReply(f.response("CHANNEL",CHANNEL));
  await f.panel.refresh();
  assert.equal(f.get("demo-preview").hidden,false);
  assert.match(f.get("demo-scope").textContent,/가상/);
  assert.equal(f.get("web-analysis-link").hidden,true);
  assert.equal(f.get("web-analysis-link").href,"");
  f.panel.dispose();
});
test("YU33-05 invalid, expired, or forged pins never show preview or links",async()=>{
  const f=harness();
  let pin=f.pin();
  f.setReply({...f.response(),pin:{...pin,isSynthetic:false}});
  await f.panel.refresh();
  assert.equal(f.get("demo-preview").hidden,true);
  f.setReply({...f.response(),pin:{...pin,expiresAt:Date.now()-1}});
  await f.panel.refresh();
  assert.equal(f.get("demo-preview").hidden,true);
  f.setReply({...f.response(),pin:{...pin,targetId:"https://evil.test"}});
  await f.panel.refresh();
  assert.equal(f.get("demo-preview").hidden,true);
  assert.equal(f.get("web-analysis-link").hidden,true);
  f.panel.dispose();
});
test("YU33-06 stale asynchronous tab reply cannot replace the later pinned target",async()=>{
  const f=harness();
  f.setReply(f.response("VIDEO",VIDEO_A));
  await f.panel.refresh();
  let release;
  f.setDeferred(new Promise(resolve=>{release=resolve;}));
  const stale=f.panel.refresh();
  // Make the next refresh resolve for the newer selected video.
  f.setDeferred(null);
  f.setReply(f.response("VIDEO",VIDEO_B));
  await f.panel.refresh();
  release(f.response("VIDEO",VIDEO_A));
  await stale;
  assert.equal(f.get("demo-preview").hidden,false);
  assert.match(f.get("web-analysis-link").href,/Ab0_-123xyZ$/);
  assert.equal(f.panel.getRuntimeStatus().selectedKey,"VIDEO:"+VIDEO_B);
  f.panel.dispose();
});
test("YU33-07 actual browser panel loads deterministic model and accessible tabs",()=>{
  const html=read("sidepanel.html"),js=read("sidepanel.js");
  assert.ok(html.indexOf('src="hover-card-model.js"') <
    html.indexOf('src="sidepanel.js"'));
  assert.match(html,/id="demo-preview"/);
  assert.equal((html.match(/role="tab"/g)||[]).length,3);
  assert.match(html,/DEMO · 가상 수치 · 실제 YouTube 댓글 분석이 아닙니다/);
  assert.match(html,/추이 데이터는 아직 제공되지 않습니다/);
  assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|innerHTML/);
  assert.match(js,/pin\.source !== "STATIC_FIXTURE"/);
  assert.match(js,/valueSemantics !== "ILLUSTRATIVE_ONLY"/);
});

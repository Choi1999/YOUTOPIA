"use strict";
/* YU-41/42 UI wiring tests with an isolated synthetic worker substitute. */
const {test} = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const read = n => fs.readFileSync(path.join(__dirname,"..",n),"utf8");
const A="Ab0_-123xyz",B="Qb0_-123xyz",C="Zb0_-123xyz";
const pause=()=>new Promise(resolve=>setImmediate(resolve));

function element(tag="div"){
  const listeners=new Map(),attrs=new Map();
  return {
    tag,children:[],href:"",hidden:false,disabled:false,checked:false,
    textContent:"",className:"",type:"",style:{},
    addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},
    removeEventListener(type,fn){listeners.set(type,(listeners.get(type)||[]).filter(x=>x!==fn));},
    trigger(type){for(const fn of listeners.get(type)||[])fn({});},
    append(...nodes){this.children.push(...nodes);},
    replaceChildren(...nodes){this.children=[...nodes];},
    setAttribute(name,value){attrs.set(name,String(value));},
    removeAttribute(name){attrs.delete(name);if(name==="href")this.href="";},
  };
}

async function harness() {
  const ids=["compare-add-current","compare-status","compare-list","compare-swap",
    "compare-clear","compare-open-pair"];
  const elements=new Map(ids.map(id=>[id,element(id)]));
  const listeners={storage:[],activated:[]};
  let activeTab=17;
  const pins=new Map(),collections=new Map();
  const doc={getElementById:id=>elements.get(id)||null,
    createElement:tag=>element(tag)};
  const ctx=vm.createContext({document:doc,Date,Promise,console,
    setTimeout:()=>99,clearTimeout(){},
    addEventListener(){},removeEventListener(){},
    chrome:{
      runtime:{
        id:"testext",getURL:p=>"chrome-extension://testext/"+p,
        sendMessage:async request=>{
          if(request.type==="YUTOPIA_YU28_READ_SELECTION_V1"){
            const saved=pins.get(request.tabId);
            return{type:"YUTOPIA_YU28_SELECTION_RESULT_V1",version:1,
              tabId:request.tabId,ok:true,
              status:saved?"READY":"EMPTY",pin:saved??null};
          }
          const c=ctx.YUTOPIA_PANEL_COMPARE;
          const raw=collections.get(request.tabId);
          const pin=ctx.YUTOPIA_PANEL_SELECTION.readPin(
            pins.get(request.tabId),request.tabId);
          const result=c.modify(raw,request.tabId,
            request.action,request.targetId,Date.now(),pin);
          if(result.ok && request.action!=="READ"){
            if(request.action==="CLEAR"||result.state.items.length===0)
              collections.delete(request.tabId);
            else collections.set(request.tabId,result.state);
          }
          return{type:c.RESULT,version:c.VERSION,tabId:request.tabId,
            ok:result.ok,status:result.status,
            state:result.ok?{items:result.state.items,selected:result.state.selected}:null};
        }
      },
      tabs:{query:async()=>[{id:activeTab}],
        onActivated:{addListener:fn=>listeners.activated.push(fn),
          removeListener(){}}},
      storage:{onChanged:{addListener:fn=>listeners.storage.push(fn),
        removeListener(){}}},
    }
  });
  for(const file of ["panel-selection-contract.js","panel-compare-contract.js",
    "web-analysis-link.js","panel-compare-ui.js"])
    vm.runInContext(read(file),ctx,{filename:file});
  await pause();await pause();
  const ui=ctx.YUTOPIA_COMPARE_PANEL;
  assert.ok(ui);
  async function pin(id,tab=activeTab,type="VIDEO"){
    const p=ctx.YUTOPIA_PANEL_SELECTION.makePin({
      targetType:type,targetId:id,requestId:1},tab,"document_demo_123");
    pins.set(tab,p);
    await ui.refresh();
  }
  async function click(id){
    elements.get(id).trigger("click");await pause();await pause();
  }
  return{ctx,ui,elements,collections,pin,click,
    get:id=>elements.get(id),
    setActive(tab){activeTab=tab;},
    async refresh(){await ui.refresh();},
    async flush(){await pause();await pause();}};
}

test("YU41-UI01 Hover/no PIN leaves ADD hidden and no Web pair URL",async()=>{
  const f=await harness();
  assert.equal(f.get("compare-add-current").hidden,true);
  assert.equal(f.get("compare-open-pair").hidden,true);
  assert.equal(f.ui.getState().items.length,0);
  f.ui.dispose();
});

test("YU41-UI02 explicit PIN then explicit ADD generates exact A/B URL",async()=>{
  const f=await harness();
  await f.pin(A);
  assert.equal(f.get("compare-add-current").hidden,false);
  assert.equal(f.ui.getState().items.length,0);
  await f.click("compare-add-current");
  assert.equal(f.ui.getState().selected.join(","),A);
  await f.pin(B);
  await f.click("compare-add-current");
  assert.equal(f.get("compare-open-pair").hidden,false);
  assert.equal(f.get("compare-open-pair").href,
    "http://localhost:5173/analysis/youtube/compare?video="+A+"&video="+B);
  f.ui.dispose();
});

test("YU41-UI03 tab switch hides old pair and never shows its href",async()=>{
  const f=await harness();await f.pin(A);await f.click("compare-add-current");
  await f.pin(B);await f.click("compare-add-current");
  assert.equal(f.get("compare-open-pair").hidden,false);
  f.setActive(18);
  await f.refresh();
  assert.equal(f.get("compare-open-pair").hidden,true);
  assert.equal(f.get("compare-open-pair").href,"");
  assert.equal(f.ui.getState().items.length,0);
  f.ui.dispose();
});

test("YU42-UI04 collection of 3 keeps two selected and allows explicit reselect",async()=>{
  const f=await harness();await f.pin(A);await f.click("compare-add-current");
  await f.pin(B);await f.click("compare-add-current");
  await f.pin(C);await f.click("compare-add-current");
  assert.equal(f.ui.getState().items.length,3);
  assert.equal(f.ui.getState().selected.join(","),A+","+B);
  const rows=f.get("compare-list").children;
  assert.equal(rows.length,3);
  const checkboxA=rows[0].children[0].children[0];
  const checkboxC=rows[2].children[0].children[0];
  assert.equal(checkboxC.disabled,true);
  checkboxA.trigger("change");await f.flush();
  assert.equal(f.ui.getState().selected.join(","),B);
  const newerC=f.get("compare-list").children[2].children[0].children[0];
  assert.equal(newerC.disabled,false);
  newerC.trigger("change");await f.flush();
  assert.equal(f.ui.getState().selected.join(","),B+","+C);
  assert.match(f.get("compare-open-pair").href,/video=Qb0_-123xyz&video=Zb0_-123xyz$/);
  f.ui.dispose();
});

test("YU42-UI05 channel PIN cannot add a VIDEO and clear removes all",async()=>{
  const f=await harness();await f.pin(A);await f.click("compare-add-current");
  await f.pin("UC"+"a".repeat(22),17,"CHANNEL");
  assert.equal(f.get("compare-add-current").hidden,true);
  assert.equal(f.ui.getState().items.length,1);
  await f.click("compare-clear");
  assert.equal(f.ui.getState().items.length,0);
  assert.equal(f.get("compare-open-pair").hidden,true);
  f.ui.dispose();
});

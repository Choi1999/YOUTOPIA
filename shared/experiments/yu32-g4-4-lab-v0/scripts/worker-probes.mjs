/*
 * G44-P3 synthetic PostgreSQL 16 Worker recovery/Outbox probes.
 * Dynamic only: parent preflight must verify local Windows Docker Desktop,
 * clean authorized branch, one internal network and zero published ports.
 */
import assert from "node:assert/strict";
import {fork,spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";

const workerScript=path.join(path.dirname(fileURLToPath(import.meta.url)),
  "worker-process.mjs");
const tokenRx=/^[0-9]+:[0-9]+:[0-9]+$/;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function newWorker(ctx,name,offset=0) {
  assert.ok(["worker-A","worker-B"].includes(name));
  const proc=fork(workerScript,[],{
    env:{...ctx.env,G44_CHILD_PROJECT:ctx.project,
      G44_CHILD_OWNER:name,G44_CHILD_CLOCK_OFFSET_MS:String(offset)},
    stdio:["ignore","ignore","pipe","ipc"],windowsHide:true
  });
  let done=false,readyDone=false,stderr="",nextId=0;
  const pending=new Map();
  let readyResolve,readyReject,exitResolve;
  const ready=new Promise((resolve,reject)=>{
    readyResolve=resolve;readyReject=reject;
  });
  const exited=new Promise(resolve=>{exitResolve=resolve;});
  const readyTimer=setTimeout(()=>{
    if(!readyDone){readyDone=true;readyReject(new Error("Worker startup timeout: "+name));
      proc.kill("SIGKILL");}
  },15000);
  proc.stderr?.on("data",b=>{stderr=(stderr+String(b)).slice(-350);});
  proc.on("message",msg=>{
    if(msg?.type==="ready"&&!readyDone){
      readyDone=true;clearTimeout(readyTimer);
      readyResolve({pid:msg.pid,owner:msg.owner,offsetMs:msg.clockOffsetMs});
      return;
    }
    if(msg?.type==="reply"&&pending.has(msg.reqId)){
      const task=pending.get(msg.reqId);
      clearTimeout(task.timer);
      pending.delete(msg.reqId);
      if(msg.ok)task.resolve(msg);
      else task.reject(new Error(name+" DB operation rejected: "+String(msg.error).slice(0,180)));
    }
  });
  proc.on("error",error=>{
    if(!readyDone){readyDone=true;clearTimeout(readyTimer);readyReject(error);}
    for(const task of pending.values()){clearTimeout(task.timer);task.reject(error);}
    pending.clear();
  });
  proc.on("exit",(code,signal)=>{
    done=true;exitResolve({code,signal,pid:proc.pid});
    if(!readyDone){
      readyDone=true;clearTimeout(readyTimer);
      readyReject(new Error("Worker exited before ready: "+name+" "+stderr));
    }
    for(const task of pending.values()){
      clearTimeout(task.timer);
      task.reject(new Error("Worker exited during DB operation: "+name+" "+stderr));
    }
    pending.clear();
  });
  async function request(action,payload={}){
    await ready;
    if(done)throw new Error("Worker is no longer alive: "+name);
    const reqId=++nextId;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{
        pending.delete(reqId);
        reject(new Error("Worker IPC timeout: "+name+" "+action+" "+stderr));
        proc.kill("SIGKILL");
      },25000);
      pending.set(reqId,{resolve,reject,timer});
      proc.send({reqId,action,...payload},error=>{
        if(error&&pending.has(reqId)){
          clearTimeout(timer);pending.delete(reqId);reject(error);
        }
      });
    });
  }
  async function kill(signal="SIGKILL") {
    if(!done)proc.kill(signal);
    return Promise.race([
      exited,
      delay(10000).then(()=>{throw new Error("Worker OS process did not terminate: "+name);})
    ]);
  }
  return {ready,request,kill,pid:proc.pid,get exited(){return exited;}};
}
async function withWorkers(ctx,fn) {
  const workers=[];
  const spawnWorker=(name,offset=0)=>{
    const x=newWorker(ctx,name,offset);workers.push(x);return x;
  };
  try{return await fn(spawnWorker);}
  finally{
    const stopped=await Promise.allSettled(workers.map(w=>w.kill("SIGKILL")));
    const failed=stopped.find(x=>x.status==="rejected");
    if(failed)throw new Error("Synthetic worker cleanup failed: "+failed.reason?.message);
  }
}
function fixture(ctx){
  const scopeId=ctx.reset();
  const job=ctx.submit(scopeId);
  assert.match(job,/^CREATED:[0-9]+$/);
  const jobId=Number(job.split(":")[1]);
  const eventId=Number(ctx.scalar(
    "SELECT event_id FROM g44_lab.job_outbox WHERE job_id="+jobId+";"));
  assert.ok(Number.isSafeInteger(eventId)&&eventId>0);
  assert.equal(ctx.count("analysis_job"),1);
  assert.equal(ctx.count("job_outbox"),1);
  assert.equal(ctx.count("budget_reservation"),1);
  return {scopeId,jobId,eventId};
}
function parseClaim(msg,expectedJob){
  assert.match(msg.value,tokenRx);
  const [job,epoch,version]=msg.value.split(":").map(Number);
  assert.equal(job,expectedJob);
  return {job,epoch,version};
}
function assertOneLease(ctx,jobId,owner){
  const actual=ctx.scalar("SELECT lease_owner FROM g44_lab.analysis_job WHERE job_id="+jobId+";");
  assert.equal(actual,owner);
  assert.equal(ctx.scalar("SELECT state FROM g44_lab.analysis_job WHERE job_id="+jobId+";"),"RUNNING");
}
async function waitDbExpiry(ctx,jobId){
  for(let i=0;i<45;i++){
    const db=ctx.scalar("SELECT CASE WHEN lease_expires_at<=clock_timestamp() "+
      "THEN 'EXPIRED' ELSE 'ACTIVE' END FROM g44_lab.analysis_job "+
      "WHERE job_id="+jobId+";");
    if(db==="EXPIRED")return "DB_EXPIRED";
    assert.equal(db,"ACTIVE");
    await delay(200);
  }
  throw new Error("Database lease did not expire within bounded time");
}
async function outboxBarrier(ctx,eventId){
  const proc=spawn("docker", [...ctx.base,"exec","-T","-u","postgres",
    "db","psql","-X","-q","-A","-t","-v","ON_ERROR_STOP=1",
    "-U","g44_dba","-d","g44_lab","-f","-"],
    {env:ctx.env,stdio:["pipe","pipe","pipe"],windowsHide:true});
  let output="",stderr="",settled=false;
  const completed=new Promise((resolve,reject)=>{
    proc.on("close",code=>code===0?resolve():reject(
      new Error("Outbox advisory barrier failed: "+stderr.slice(0,160))));
    proc.on("error",reject);
  });
  const ready=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{
      if(!settled){settled=true;reject(new Error("Outbox barrier startup timeout"));}
    },12000);
    proc.stdout.on("data",part=>{
      output+=String(part);
      if(!settled&&output.includes("G44_OUTBOX_READY")){
        settled=true;clearTimeout(timer);resolve();
      }
    });
    proc.stderr.on("data",part=>{stderr=(stderr+String(part)).slice(-400);});
    proc.on("exit",()=>{
      if(!settled){settled=true;clearTimeout(timer);
        reject(new Error("Outbox barrier exited before ready: "+stderr));}
    });
  });
  const key="'g44-outbox:"+eventId+"'";
  proc.stdin.write("SELECT pg_advisory_lock(hashtextextended("+key+",0));\n"+
    "SELECT 'G44_OUTBOX_READY';\n");
  try{await ready;}
  catch(e){proc.kill("SIGKILL");await Promise.allSettled([completed]);throw e;}
  let released=false;
  return async()=>{
    if(released)return;
    released=true;
    proc.stdin.end("SELECT pg_advisory_unlock(hashtextextended("+key+",0));\n");
    await Promise.race([completed,delay(12000).then(()=>{
      proc.kill("SIGKILL");throw new Error("Outbox barrier release timeout");
    })]);
  };
}
async function blockedOnOutbox(ctx,atLeast){
  for(let i=0;i<40;i++){
    const waiting=Number(ctx.scalar(
      "SELECT count(*) FROM pg_stat_activity WHERE datname='g44_lab' "+
      "AND wait_event_type='Lock' AND query LIKE '%g44_lab.claim_from_outbox%';"));
    if(waiting>=atLeast)return waiting;
    await delay(150);
  }
  throw new Error("Concurrent outbox DB lock waits not observed: INCONCLUSIVE");
}

export async function runWorkerRecoveryProbes(ctx){
  await ctx.verify("G44-T14-PROCESS","Two independent Worker processes race for one stored Outbox Job",async()=>
    withWorkers(ctx,async spawnWorker=>{
      const f=fixture(ctx);
      const a=spawnWorker("worker-A"),b=spawnWorker("worker-B");
      const [ra,rb]=await Promise.all([a.ready,b.ready]);
      assert.notEqual(ra.pid,rb.pid);
      const release=await outboxBarrier(ctx,f.eventId);
      const first=a.request("dispatch",{eventId:f.eventId,leaseMs:5000});
      const second=b.request("dispatch",{eventId:f.eventId,leaseMs:5000});
      let blocked=0;
      try{blocked=await blockedOnOutbox(ctx,2);}
      finally{await release();}
      const [x,y]=await Promise.all([first,second]);
      assert.equal([x.value,y.value].filter(z=>z!=="NONE").length,1);
      const winner=x.value!=="NONE"?{reply:x,owner:"worker-A"}:{reply:y,owner:"worker-B"};
      parseClaim(winner.reply,f.jobId);
      assertOneLease(ctx,f.jobId,winner.owner);
      assert.equal(ctx.count("analysis_job"),1);
      return "event="+f.eventId+";blocked="+blocked+";pids="+ra.pid+","+rb.pid+
        ";owner="+winner.owner+";claim="+winner.reply.value+";other=NONE";
    })
  );

  await ctx.verify("G44-T15/T16-PROCESS","Kill Worker A; DB-timed reclaim by B; reject late A token",async()=>
    withWorkers(ctx,async spawnWorker=>{
      const f=fixture(ctx);
      const a=spawnWorker("worker-A");
      const ra=await a.ready;
      const tokenA=(await a.request("dispatch",
        {eventId:f.eventId,leaseMs:1500})).value;
      const leaseA=parseClaim({value:tokenA},f.jobId);
      const killed=await a.kill("SIGKILL");
      assert.equal(killed.pid,ra.pid);
      assert.ok(killed.signal==="SIGKILL"||killed.code!==0,
        "Expected forced OS process termination");
      assertOneLease(ctx,f.jobId,"worker-A");
      assert.equal(await waitDbExpiry(ctx,f.jobId),"DB_EXPIRED");
      const b=spawnWorker("worker-B");
      const rb=await b.ready;
      const tokenB=(await b.request("dispatch",
        {eventId:f.eventId,leaseMs:10000})).value;
      const leaseB=parseClaim({value:tokenB},f.jobId);
      assert.equal(leaseB.epoch,leaseA.epoch+1);
      assert.ok(leaseB.version>leaseA.version);
      const lateA=spawnWorker("worker-A");
      const rr=await lateA.ready;
      assert.notEqual(rr.pid,ra.pid);
      const stale=await lateA.request("complete",
        {token:tokenA,snapshot:"crashed-old"});
      assert.equal(stale.value,"STALE");
      assertOneLease(ctx,f.jobId,"worker-B");
      const completed=await b.request("complete",
        {token:tokenB,snapshot:"reclaimed-new"});
      assert.equal(completed.value,"SUCCEEDED");
      assert.equal(ctx.scalar("SELECT snapshot_id FROM g44_lab.scope_latest "+
        "WHERE scope_id="+f.scopeId+";"),"synthetic-reclaimed-new");
      assert.equal(ctx.count("analysis_snapshot"),1);
      assert.equal(ctx.count("budget_reservation"),1);
      return "pids="+ra.pid+"(KILLED),"+rb.pid+","+rr.pid+
        ";job="+f.jobId+";epoch="+leaseA.epoch+"->"+leaseB.epoch+
        ";A_stale="+stale.value+";B="+completed.value;
    })
  );

  await ctx.verify("G44-T17-PROCESS","Expired live Worker heartbeat and completion both denied",async()=>
    withWorkers(ctx,async spawnWorker=>{
      const f=fixture(ctx);
      const a=spawnWorker("worker-A");
      const ra=await a.ready;
      const token=(await a.request("dispatch",
        {eventId:f.eventId,leaseMs:1000})).value;
      parseClaim({value:token},f.jobId);
      assert.equal(await waitDbExpiry(ctx,f.jobId),"DB_EXPIRED");
      const before=ctx.scalar("SELECT version::text||':'||lease_epoch::text "+
        "FROM g44_lab.analysis_job WHERE job_id="+f.jobId+";");
      const h=await a.request("heartbeat",{token,leaseMs:3000});
      const c=await a.request("complete",{token,snapshot:"after-expiry"});
      assert.equal(h.value,"STALE");
      assert.equal(c.value,"STALE");
      const after=ctx.scalar("SELECT version::text||':'||lease_epoch::text "+
        "FROM g44_lab.analysis_job WHERE job_id="+f.jobId+";");
      assert.equal(before,after);
      assert.equal(ctx.count("analysis_snapshot"),0);
      assert.equal(ctx.count("scope_latest"),0);
      return "pid="+ra.pid+";job="+f.jobId+
        ";DB_EXPIRED;heartbeat=STALE;complete=STALE;version="+after;
    })
  );

  await ctx.verify("G44-T27-REDRIVE","Deliver same persisted Outbox ID twice; no duplicate Job/budget/claim",async()=>
    withWorkers(ctx,async spawnWorker=>{
      const f=fixture(ctx);
      const a=spawnWorker("worker-A"),b=spawnWorker("worker-B");
      const [ra,rb]=await Promise.all([a.ready,b.ready]);
      const release=await outboxBarrier(ctx,f.eventId);
      const first=a.request("dispatch",{eventId:f.eventId,leaseMs:12000});
      const second=b.request("dispatch",{eventId:f.eventId,leaseMs:12000});
      let blocked=0;
      try{blocked=await blockedOnOutbox(ctx,2);}
      finally{await release();}
      const [x,y]=await Promise.all([first,second]);
      assert.equal([x.value,y.value].filter(z=>z!=="NONE").length,1);
      const owner=x.value!=="NONE"?"worker-A":"worker-B";
      const winner=owner==="worker-A"?a:b,loser=owner==="worker-A"?b:a;
      const token=owner==="worker-A"?x.value:y.value;
      parseClaim({value:token},f.jobId);
      const replay=await loser.request("dispatch",
        {eventId:f.eventId,leaseMs:12000});
      assert.equal(replay.value,"NONE");
      const success=await winner.request("complete",
        {token,snapshot:"outbox-once"});
      assert.equal(success.value,"SUCCEEDED");
      const duplicateAfter=await loser.request("dispatch",
        {eventId:f.eventId,leaseMs:12000});
      assert.equal(duplicateAfter.value,"NONE");
      for(const table of ["analysis_job","budget_reservation","job_outbox",
        "analysis_snapshot","scope_latest"])assert.equal(ctx.count(table),1);
      assert.equal(ctx.scalar("SELECT count(*) FROM g44_lab.job_outbox "+
        "WHERE event_id="+f.eventId+";"),"1");
      return "event="+f.eventId+"(same x3);pids="+ra.pid+","+rb.pid+
        ";blocked="+blocked+";first="+owner+";extraClaims=0;rows=1";
    })
  );

  await ctx.verify("G44-T36-NODE_CLOCK_SUBSET","Injected ±24h Worker Date.now offset does not drive DB lease expiry",async()=>
    withWorkers(ctx,async spawnWorker=>{
      const f=fixture(ctx);
      const a=spawnWorker("worker-A",86400000);
      const b=spawnWorker("worker-B",-86400000);
      const [ra,rb]=await Promise.all([a.ready,b.ready]);
      assert.equal(ra.offsetMs,86400000);
      assert.equal(rb.offsetMs,-86400000);
      const aReply=await a.request("dispatch",
        {eventId:f.eventId,leaseMs:6000});
      parseClaim(aReply,f.jobId);
      assert.ok(Math.abs(aReply.wallClockMs-Date.now())>23*3600*1000);
      const remaining=Number(ctx.scalar("SELECT EXTRACT(EPOCH FROM "+
        "(lease_expires_at-clock_timestamp())) FROM g44_lab.analysis_job "+
        "WHERE job_id="+f.jobId+";"));
      assert.ok(remaining>0 && remaining<=6,
        "Lease must be based on DB clock, not Worker Date.now");
      const bReply=await b.request("dispatch",
        {eventId:f.eventId,leaseMs:6000});
      assert.equal(bReply.value,"NONE");
      assert.ok(Math.abs(bReply.wallClockMs-Date.now())>23*3600*1000);
      assertOneLease(ctx,f.jobId,"worker-A");
      return "pids="+ra.pid+","+rb.pid+
        ";clockOffsets=+86400000,-86400000;DB_lease_seconds="+
        remaining.toFixed(2)+";B=NONE";
    })
  );
}

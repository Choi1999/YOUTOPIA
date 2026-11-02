/*
 * G44 synthetic worker child process. Only runs under the guarded parent lab.
 * Each child is a real OS process and owns an independent psql DB connection
 * per operation. No real provider, HTTP, billing, or production data access.
 */
import {spawnSync} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";

const owner=process.env.G44_CHILD_OWNER;
const project=process.env.G44_CHILD_PROJECT;
const offset=Number(process.env.G44_CHILD_CLOCK_OFFSET_MS??"0");
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const composeFile=path.join(root,"compose.lab.yaml");
const validOwner=owner==="worker-A"||owner==="worker-B";

function fail(message) {
  process.stderr.write("G44 child STOP: "+String(message).slice(0,200)+"\n");
  process.exitCode=1;
}
function execute(args,input="") {
  const x=spawnSync("docker",args,{env:process.env,input,encoding:"utf8",
    timeout:25000,maxBuffer:512*1024,windowsHide:true});
  if(x.error||x.status!==0)
    throw new Error("Local Docker psql failed: "+String(x.error?.message||x.stderr).slice(0,160));
  return x.stdout.trim();
}
function sql(query) {
  return execute(["compose","-p",project,"-f",composeFile,"exec","-T",
    "-u","postgres","db","psql","-X","-q","-A","-t",
    "-v","ON_ERROR_STOP=1","-U","g44_dba","-d","g44_lab","-f","-"],
    "SET ROLE g44_writer;\n"+query+"\n");
}
function tokenParts(value) {
  if(typeof value!=="string"||!/^[0-9]+:[0-9]+:[0-9]+$/.test(value))
    throw new Error("Invalid synthetic lease token");
  return value.split(":");
}
function dispatch(message) {
  const id=message.eventId,ms=message.leaseMs;
  if(!Number.isSafeInteger(id)||id<1||
      !Number.isInteger(ms)||ms<500||ms>60000)
    throw new Error("Invalid synthetic dispatch");
  return sql("SELECT g44_lab.claim_from_outbox("+id+",'"+owner+"',"+ms+");");
}
function complete(message) {
  const [id,epoch,version]=tokenParts(message.token);
  if(typeof message.snapshot!=="string"||
      !/^[A-Za-z0-9_-]{1,40}$/.test(message.snapshot))
    throw new Error("Invalid synthetic snapshot label");
  return sql("SELECT g44_lab.complete_job("+id+",'"+owner+"',"+epoch+","+
    version+",'synthetic-"+message.snapshot+"');");
}
function heartbeat(message) {
  const [id,epoch,version]=tokenParts(message.token);
  const ms=message.leaseMs;
  if(!Number.isInteger(ms)||ms<500||ms>60000)
    throw new Error("Invalid lease duration");
  return sql("SELECT g44_lab.heartbeat("+id+",'"+owner+"',"+epoch+","+
    version+","+ms+");");
}
function ready() {
  if(!validOwner||!/^g44_[a-f0-9]{12}$/.test(project||"")||
      !Number.isFinite(offset)||Math.abs(offset)>7*24*3600*1000||
      process.env.G44_LAB_CONFIRM!=="ISOLATED_ONLY"||
      process.env.CI||typeof process.send!=="function")
    throw new Error("Synthetic parent/lab guard failed");
  for(const key of ["DOCKER_HOST","DOCKER_CONTEXT","DOCKER_TLS_VERIFY","DOCKER_CERT_PATH"])
    if(process.env[key])throw new Error("Docker endpoint override rejected");
  if(execute(["context","show"])!=="desktop-linux")
    throw new Error("Not local Windows Docker Desktop Linux");
  // The parent checks this exact context's named pipe before any DB creation.
  const original=Date.now.bind(Date);
  Date.now=()=>original()+offset;
  process.send({type:"ready",pid:process.pid,owner,clockOffsetMs:offset});
}
try {ready();} catch(e) {fail(e.message);}

let busy=false;
process.on("message",message=>{
  const reqId=message?.reqId;
  if(!Number.isSafeInteger(reqId)||reqId<1||busy)return;
  busy=true;
  try {
    const value=message.action==="dispatch"?dispatch(message):
      message.action==="complete"?complete(message):
      message.action==="heartbeat"?heartbeat(message):
      (()=>{throw new Error("Unapproved worker action")})();
    process.send?.({type:"reply",reqId,ok:true,value,pid:process.pid,
      wallClockMs:Date.now(),offsetMs:offset});
  }catch(e){
    process.send?.({type:"reply",reqId,ok:false,
      error:String(e.message).slice(0,200),pid:process.pid});
  }finally{busy=false;}
});

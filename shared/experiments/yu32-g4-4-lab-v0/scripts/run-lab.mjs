/*
 * YUTOPIA G4-4 disposable PostgreSQL 16 lab. This does not implement APIs,
 * authorize YouTube access or prove any production concurrency guarantee.
 * Host Node uses docker compose exec -> psql; no host DB port is exposed.
 */
import assert from "node:assert/strict";
import {spawn, spawnSync} from "node:child_process";
import {createHash, randomBytes, randomUUID} from "node:crypto";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const composeFile = path.join(root, "compose.lab.yaml");
const schemaFile = path.join(root, "sql", "schema.lab.sql");
const image = "postgres:16-alpine";
const project = "g44_" + randomBytes(6).toString("hex");
const env = {...process.env, G44_LAB_DB_PASSWORD: randomBytes(32).toString("hex")};
const base = ["compose", "-p", project, "-f", composeFile];
const results = [];
let started = false;
let teardown = "NOT_RUN";
const context = {gitHead:"UNVERIFIED",gitBranch:"UNVERIFIED",imageId:"UNVERIFIED",dockerTarget:"UNVERIFIED"};

function docker(args, input = "", allowFailure = false) {
  const x = spawnSync("docker", args, {
    input, env, encoding:"utf8", timeout:60000, maxBuffer:2*1024*1024
  });
  if (x.error || (!allowFailure && x.status !== 0)) {
    throw new Error("Docker command failed (" + args.slice(0,3).join(" ") +
      "): " + String(x.error?.message || x.stderr || "no result").slice(0,400));
  }
  return x;
}
function scalar(query, role = null) {
  let sql = query.endsWith("\n") ? query : query + "\n";
  if (role) sql = "SET ROLE " + role + ";\n" + sql;
  return docker([...base, "exec", "-T", "-u", "postgres", "db", "psql",
    "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "g44_dba",
    "-d", "g44_lab", "-f", "-"], sql).stdout.trim();
}
function expectSqlFailure(query, pattern, role = null) {
  const sql = (role ? "SET ROLE " + role + ";\n" : "") +
    "\\set VERBOSITY verbose\n" + query + "\n";
  const x = docker([...base, "exec", "-T", "-u", "postgres", "db", "psql",
    "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "g44_dba",
    "-d", "g44_lab", "-f", "-"], sql, true);
  assert.notEqual(x.status, 0, "SQL unexpectedly succeeded");
  assert.match(x.stderr, pattern, "Unexpected SQL error");
}
function concurrentSql(query, role="g44_writer") {
  return new Promise((resolve, reject) => {
    const proc = spawn("docker", [...base, "exec", "-T", "-u", "postgres",
      "db", "psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
      "-U", "g44_dba", "-d", "g44_lab", "-f", "-"], {env,stdio:["pipe","pipe","pipe"]});
    let out="",err="";
    const watchdog=setTimeout(() => proc.kill("SIGKILL"),30000);
    proc.stdout.setEncoding("utf8").on("data",v=>out+=v);
    proc.stderr.setEncoding("utf8").on("data",v=>err+=v);
    proc.on("error",error=>{clearTimeout(watchdog);reject(error)});
    proc.on("close",code=>{
      clearTimeout(watchdog);
      if(code!==0)reject(new Error("Concurrent psql failed: "+err.slice(0,300)));
      else resolve(out.trim());
    });
    proc.stdin.end("SET ROLE "+role+";\n"+query+"\n");
  });
}
// A dedicated third psql session holds the same advisory lock used by
// submit_job until both independent contender sessions are confirmed waiting.
// This is a deterministic lock barrier, not a sequential Map simulation.
async function submissionBarrier(scope,actor) {
  const proc=spawn("docker", [...base,"exec","-T","-u","postgres","db",
    "psql","-X","-q","-A","-t","-v","ON_ERROR_STOP=1","-U","g44_dba",
    "-d","g44_lab","-f","-"], {env,stdio:["pipe","pipe","pipe"]});
  let output="",error="";
  const ready=new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error("Barrier readiness timeout")),15000);
    proc.stdout.on("data",chunk=>{
      output+=String(chunk);
      if(output.includes("G44_LOCK_READY")){clearTimeout(timeout);resolve();}
    });
    proc.stderr.on("data",chunk=>error+=String(chunk));
    proc.on("error",e=>{clearTimeout(timeout);reject(e)});
    proc.on("exit",code=>{
      if(!output.includes("G44_LOCK_READY")) {
        clearTimeout(timeout);
        reject(new Error("Barrier ended early: "+error.slice(0,150)+" code="+code));
      }
    });
  });
  const key=scope+":"+actor;
  proc.stdin.write("SELECT pg_advisory_lock(hashtextextended('"+key+
    "',0));\nSELECT 'G44_LOCK_READY';\n");
  try {await ready;} catch(e){
    proc.stdin.end();
    proc.kill("SIGKILL");
    throw e;
  }
  return async()=>{
    const finished=new Promise((resolve,reject)=>{
      proc.on("close",code=>code===0?resolve():reject(new Error("Barrier failed: "+error.slice(0,150))));
    });
    proc.stdin.end("SELECT pg_advisory_unlock(hashtextextended('"+key+"',0));\n");
    await finished;
  };
}
async function requireBlockedContenders(count) {
  for(let retry=0;retry<35;retry++){
    const blocked=Number(scalar(
      "SELECT count(*) FROM pg_stat_activity WHERE datname='g44_lab' "+
      "AND wait_event_type='Lock' AND query LIKE '%g44_lab.submit_job%';"));
    if(blocked>=count)return blocked;
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  throw new Error("Could not prove two blocked DB connections; INCONCLUSIVE");
}
function reset() {
  scalar("TRUNCATE g44_lab.idempotency_record,g44_lab.budget_reservation," +
    "g44_lab.job_outbox,g44_lab.scope_latest,g44_lab.analysis_snapshot," +
    "g44_lab.analysis_job,g44_lab.analysis_scope,g44_lab.budget_window " +
    "RESTART IDENTITY CASCADE;");
  scalar("UPDATE g44_lab.policy_gate SET approved_test=TRUE,revoked=FALSE," +
    "policy_epoch=policy_epoch+1;");
  scalar("INSERT INTO g44_lab.budget_window(actor_tag,remaining) VALUES" +
    "('customer-A',10),('customer-B',10);");
  return Number(scalar("INSERT INTO g44_lab.analysis_scope(" +
    "source,target_type,target_id,analysis_spec_version,observation_window_id," +
    "sampling_policy_version,locale,visibility,tenant_id) VALUES (" +
    "'YOUTUBE','VIDEO','Ab0_-123xyz','mock-0','20261001-20261008'," +
    "'mock-0','ko-KR','PUBLIC_REUSABLE',NULL) RETURNING scope_id;"));
}
function digest(id) {
  return createHash("sha256").update("synthetic-G44-request-"+id).digest("hex");
}
function submit(scope, actor="customer-A", key=randomUUID(), body=digest("base")) {
  return scalar("SELECT g44_lab.submit_job("+scope+",'"+actor+"','"+actor+
    "','"+key+"','"+body+"');", "g44_writer");
}
function claim(owner,ms=10000) {
  return scalar("SELECT g44_lab.claim_one('"+owner+"',"+ms+");","g44_writer");
}
function heartbeat(token,owner,ms=10000) {
  const [id,epoch,version]=token.split(":");
  return scalar("SELECT g44_lab.heartbeat("+id+",'"+owner+"',"+epoch+","+
    version+","+ms+");","g44_writer");
}
function complete(token,owner,snapshot) {
  const [id,epoch,version]=token.split(":");
  return scalar("SELECT g44_lab.complete_job("+id+",'"+owner+"',"+epoch+
    ","+version+",'synthetic-"+snapshot+"');","g44_writer");
}
async function verify(id, purpose, callback) {
  try {
    const detail=await callback();
    results.push({id,status:"PASS",purpose,detail:String(detail??"").slice(0,180)});
    process.stdout.write(id+": PASS\n");
  } catch(e) {
    results.push({id,status:"FAIL",purpose,detail:String(e.message).slice(0,300)});
    throw e;
  }
}
function checkManifest() {
  assert.ok(existsSync(composeFile)&&existsSync(schemaFile));
  const compose=readFileSync(composeFile,"utf8");
  assert.match(compose,/internal:\s*true/);
  assert.doesNotMatch(compose,/\n\s+ports:/);
  assert.match(compose,/pull_policy:\s*never/);
  assert.match(compose,/postgres:16-alpine/);
  const sql=readFileSync(schemaFile,"utf8");
  assert.match(sql,/UNIQUE NULLS NOT DISTINCT/);
  assert.match(sql,/WHERE state IN \('QUEUED','RUNNING'\)/);
  assert.match(sql,/SKIP LOCKED/);
  assert.match(sql,/lease_epoch=lease_epoch\+1/);
  assert.match(sql,/REVOKE ALL ON ALL FUNCTIONS/);
  return "STATIC_MANIFEST_VALIDATED_ONLY";
}
// Fail closed if Docker targets an unexpected (including remote) daemon.
// This first Lab version intentionally supports Windows Docker Desktop Linux only.
function verifyLocalDockerContext() {
  for (const name of ["DOCKER_HOST","DOCKER_CONTEXT","DOCKER_TLS_VERIFY","DOCKER_CERT_PATH"]) {
    if (process.env[name]) throw new Error("Docker endpoint override detected ("+name+"): STOP");
  }
  const active=docker(["context","show"]).stdout.trim();
  if (active!=="desktop-linux") throw new Error("G44 requires local desktop-linux context; got "+active);
  const detail=JSON.parse(docker(["context","inspect",active]).stdout);
  const host=detail?.[0]?.Endpoints?.docker?.Host;
  if (detail.length!==1 || typeof host!=="string" ||
      host.toLowerCase()!=="npipe:////./pipe/dockerdesktoplinuxengine") {
    throw new Error("Not a verified local Windows Docker Desktop Linux pipe: STOP");
  }
  const os=docker(["info","--format","{{.OSType}}"]).stdout.trim();
  if (os!=="linux") throw new Error("Linux Docker Engine required: STOP");
  return {context:active,endpointClass:"LOCAL_WINDOWS_NPIPE",os};
}

function preflight() {
  checkManifest();
  const checkout=path.resolve(root,"../../..");
  const git = args => {
    const x=spawnSync("git",args,{cwd:checkout,encoding:"utf8",timeout:10000});
    if(x.status!==0)throw new Error("Git preflight failed");
    return x.stdout.trim();
  };
  if(git(["status","--porcelain"]))
    throw new Error("Working tree is not clean: STOP");
  context.gitHead=git(["rev-parse","HEAD"]);
  context.gitBranch=git(["branch","--show-current"]);
  if(context.gitBranch!=="feature/yu32-g4-4-isolated-pg-worker-lab-v01")
    throw new Error("Unexpected checkout branch: STOP");
  if (process.env.CI) throw new Error("Lab must not run automatically in CI");
  context.dockerTarget=verifyLocalDockerContext();
  docker(["version","--format","{{.Server.Version}}"]);
  docker(["compose","version"]);
  // Refuse an implicit external image pull: operator must preload this exact tag.
  context.imageId=JSON.parse(docker(["image","inspect",image]).stdout)[0].Id;
  const cfg=JSON.parse(docker([...base,"config","--format","json"]).stdout);
  assert.equal(cfg.networks?.isolated?.internal,true,"Compose network not internal");
  assert.equal(cfg.services?.db?.pull_policy,"never");
  assert.ok(!cfg.services.db.ports?.length,"DB ports published");
  assert.ok(Object.keys(cfg.services).length===1&&cfg.services.db);
}
function checkIsolation() {
  const container=docker([...base,"ps","-q","db"]).stdout.trim();
  assert.ok(container,"Database container not created");
  const inspected=JSON.parse(docker(["inspect",container]).stdout)[0];
  const networks=Object.keys(inspected.NetworkSettings.Networks);
  assert.equal(networks.length,1,"Unexpected additional network");
  const net=JSON.parse(docker(["network","inspect",networks[0]]).stdout)[0];
  assert.equal(net.Internal,true,"Network has host egress");
  const route=docker([...base,"exec","-T","db","cat","/proc/net/route"]).stdout;
  assert.ok(!route.split("\n").slice(1).some(line=>{
    const fields=line.trim().split(/\s+/);
    return fields.length>1 && fields[1]==="00000000";
  }),"Container has an unexpected default IPv4 route");
  for(const bindings of Object.values(inspected.NetworkSettings.Ports||{}))
    assert.ok(!bindings?.length,"A host port was published");
  const rawVersion=Number(scalar("SHOW server_version_num;"));
  assert.ok(rawVersion>=160000&&rawVersion<170000,"Not PostgreSQL 16");
  return {postgresVersion:rawVersion,internalNetwork:true,hostPorts:0};
}
function count(table) {
  const allowed=new Set(["analysis_job","idempotency_record","budget_reservation",
    "job_outbox","analysis_snapshot","scope_latest"]);
  assert.ok(allowed.has(table));
  return Number(scalar("SELECT count(*) FROM g44_lab."+table+";"));
}
async function tests() {
  await verify("G44-P1","PostgreSQL 16, no host ports, isolated network",()=>{
    return JSON.stringify(checkIsolation());
  });
  await verify("G44-T29","PUBLIC NULL canonical scope uniqueness",()=>{
    reset();
    expectSqlFailure("INSERT INTO g44_lab.analysis_scope("+
      "source,target_type,target_id,analysis_spec_version,observation_window_id,"+
      "sampling_policy_version,locale,visibility,tenant_id) VALUES ("+
      "'YOUTUBE','VIDEO','Ab0_-123xyz','mock-0','20261001-20261008',"+
      "'mock-0','ko-KR','PUBLIC_REUSABLE',NULL);",/23505/);
    return "23505 as expected";
  });
  await verify("G44-T03","PUBLIC with tenant string is rejected",()=>{
    reset();
    expectSqlFailure("INSERT INTO g44_lab.analysis_scope("+
      "source,target_type,target_id,analysis_spec_version,observation_window_id,"+
      "sampling_policy_version,locale,visibility,tenant_id) VALUES ("+
      "'YOUTUBE','VIDEO','Zb0_-123xyz','mock-0','20261001-20261008',"+
      "'mock-0','ko-KR','PUBLIC_REUSABLE','tenant-A');",/23514/);
    return "23514 as expected";
  });
  await verify("G44-T04-DB","PRIVATE scope must have a non-NULL tenant (not an auth test)",()=>{
    reset();
    expectSqlFailure("INSERT INTO g44_lab.analysis_scope("+
      "source,target_type,target_id,analysis_spec_version,observation_window_id,"+
      "sampling_policy_version,locale,visibility,tenant_id) VALUES ("+
      "'YOUTUBE','VIDEO','Ab0_-123xyz','mock-0','20261001-20261008',"+
      "'mock-0','ko-KR','TENANT_PRIVATE',NULL);",/23514/);
    return "23514 for private NULL tenant; server BOLA NOT_RUN";
  });
  await verify("G44-T05","Same key/digest replays the same original decision",()=>{
    const id=reset(),key=randomUUID();
    const a=submit(id,"customer-A",key),b=submit(id,"customer-A",key);
    assert.equal(a,b);
    assert.match(a,/^CREATED:[0-9]+$/);
    assert.equal(count("analysis_job"),1);
    assert.equal(count("budget_reservation"),1);
    assert.equal(count("job_outbox"),1);
    return a;
  });
  await verify("G44-T06-DB_SUBSET","Same key with different digest is a conflict (not HTTP 409)",()=>{
    const id=reset(),key=randomUUID();
    const a=submit(id,"customer-A",key,digest("one"));
    const b=submit(id,"customer-A",key,digest("two"));
    assert.match(a,/^CREATED:/);
    assert.equal(b,"IDEMPOTENCY_CONFLICT");
    assert.equal(count("analysis_job"),1);
    return b;
  });
  await verify("G44-T07","Two concurrently blocked psql connections contend for one active Job",async()=>{
    const id=reset(),key1=randomUUID(),key2=randomUUID(),fp=digest("shared");
    const query=(key)=>"SELECT g44_lab.submit_job("+id+
      ",'customer-A','customer-A','"+key+"','"+fp+"');";
    const release=await submissionBarrier(id,"customer-A");
    const contenders=[concurrentSql(query(key1)),concurrentSql(query(key2))];
    let blocked;
    try {
      blocked=await requireBlockedContenders(2);
    } finally {
      await release();
    }
    const out=await Promise.all(contenders);
    assert.equal(out.filter(x=>/^CREATED:/.test(x)).length,1);
    assert.equal(out.filter(x=>/^JOINED:/.test(x)).length,1);
    assert.equal(count("analysis_job"),1);
    assert.equal(count("budget_reservation"),1);
    return "observed_blocked="+blocked+"; "+out.join(",");
  });
  await verify("G44-T08-DB_SUBSET","Same PUBLIC scope, isolated actors and jobs (DB only)",()=>{
    const id=reset();
    const a=submit(id,"customer-A");
    const b=submit(id,"customer-B");
    assert.match(a,/^CREATED:/);
    assert.match(b,/^CREATED:/);
    assert.notEqual(a,b);
    assert.equal(count("analysis_job"),2);
    return "2 actor partitions, no shared in-flight Job";
  });
  await verify("G44-T10","Transaction rollback erases Job/Idempotency/Budget/Outbox",()=>{
    const id=reset();
    const start=scalar("SELECT remaining FROM g44_lab.budget_window WHERE actor_tag='customer-A';");
    scalar("BEGIN; SELECT g44_lab.submit_job("+id+",'customer-A','customer-A','"+
      randomUUID()+"','"+digest("rollback")+"'); ROLLBACK;");
    assert.equal(count("analysis_job"),0);
    assert.equal(count("idempotency_record"),0);
    assert.equal(count("budget_reservation"),0);
    assert.equal(count("job_outbox"),0);
    assert.equal(scalar("SELECT remaining FROM g44_lab.budget_window WHERE actor_tag='customer-A';"),start);
    return "all four rolled back";
  });
  await verify("G44-T14-SMOKE","Two psql claim attempts; no deterministic claim barrier",async()=>{
    reset(); submit(1);
    const attempts=await Promise.all([
      concurrentSql("SELECT g44_lab.claim_one('worker-A',10000);"),
      concurrentSql("SELECT g44_lab.claim_one('worker-B',10000);")
    ]);
    assert.equal(attempts.filter(v=>v!=="NONE").length,1);
    return attempts.join(",");
  });
  await verify("G44-T15/T16-LEASE_SUBSET","Injected lease expiry, not a genuine process crash",()=>{
    reset();submit(1);
    const a=claim("worker-A");
    assert.match(a,/^\d+:\d+:\d+$/);
    const [jobid]=a.split(":");
    scalar("UPDATE g44_lab.analysis_job SET version=version+1,"+
      "lease_expires_at=clock_timestamp()-interval '1 second' WHERE job_id="+jobid+";");
    const b=claim("worker-B");
    assert.match(b,/^\d+:\d+:\d+$/);
    assert.equal(Number(b.split(":")[1]),Number(a.split(":")[1])+1);
    assert.equal(complete(a,"worker-A","stale"),"STALE");
    assert.equal(complete(b,"worker-B","fresh"),"SUCCEEDED");
    assert.equal(scalar("SELECT snapshot_id FROM g44_lab.scope_latest WHERE scope_id=1;"),"synthetic-fresh");
    return "A 0 publication; B one successful publication";
  });
  await verify("G44-T34","Old heartbeat version is refused",()=>{
    reset();submit(1);
    const a=claim("worker-A");
    const renewedVersion=heartbeat(a,"worker-A");
    assert.match(renewedVersion,/^\d+$/);
    assert.equal(complete(a,"worker-A","old-version"),"STALE");
    const parts=a.split(":");
    parts[2]=renewedVersion;
    assert.equal(complete(parts.join(":"),"worker-A","new-version"),"SUCCEEDED");
    return "fenced by expected_version";
  });
  await verify("G44-T18-SYNTHETIC_SUBSET","Synthetic policy revocation blocks completion/read",()=>{
    reset();submit(1);
    const a=claim("worker-A");
    scalar("UPDATE g44_lab.policy_gate SET revoked=TRUE,policy_epoch=policy_epoch+1;");
    assert.equal(complete(a,"worker-A","revoked"),"STALE");
    assert.equal(scalar("SELECT g44_lab.read_latest(1);"),"POLICY_BLOCKED");
    assert.equal(count("analysis_snapshot"),0);
    return "DB policy epoch only, not Spring/provider approval";
  });
  await verify("G44-T35","Cross-actor latest generation does not regress",()=>{
    reset();
    submit(1,"customer-A");submit(1,"customer-B");
    const a=claim("worker-A"),b=claim("worker-B");
    assert.match(a,/^\d+:\d+:\d+$/);
    assert.match(b,/^\d+:\d+:\d+$/);
    assert.equal(complete(b,"worker-B","newest"),"SUCCEEDED");
    assert.equal(complete(a,"worker-A","older"),"SUCCEEDED");
    assert.equal(scalar("SELECT snapshot_id FROM g44_lab.scope_latest WHERE scope_id=1;"),"synthetic-newest");
    return "DB order only: no production freshness claim";
  });
  await verify("G44-T38-STATE_SUBSET","Terminal Job cannot return to RUNNING",()=>{
    reset();submit(1);
    const token=claim("worker-A");
    assert.equal(complete(token,"worker-A","terminal"),"SUCCEEDED");
    const job=token.split(":")[0];
    expectSqlFailure("UPDATE g44_lab.analysis_job SET state='RUNNING',"+
      "version=version+1 WHERE job_id="+job+";",/23514/);
    assert.equal(scalar("SELECT state FROM g44_lab.analysis_job WHERE job_id="+job+";"),"SUCCEEDED");
    return "terminal update 23514";
  });
  await verify("G44-T39-DB_SUBSET","Replay after new-Job quota zero, then synthetic revocation",()=>{
    const id=reset(),key=randomUUID(),body=digest("replay");
    const a=submit(id,"customer-A",key,body);
    scalar("UPDATE g44_lab.budget_window SET remaining=0 WHERE actor_tag='customer-A';");
    assert.equal(submit(id,"customer-A",key,body),a);
    assert.equal(count("budget_reservation"),1);
    scalar("UPDATE g44_lab.policy_gate SET revoked=TRUE,policy_epoch=policy_epoch+1;");
    assert.equal(submit(id,"customer-A",key,body),"POLICY_BLOCKED");
    return "original decision preserved; revoked replay denied";
  });
  await verify("G44-T27-CLAIM_SUBSET","Repeated claim without duplicate Outbox delivery simulation",()=>{
    reset();submit(1);
    assert.equal(count("job_outbox"),1);
    assert.match(claim("worker-A"),/^\d+:\d+:\d+$/);
    assert.equal(claim("worker-B"),"NONE");
    assert.equal(count("analysis_job"),1);
    return "1 initial claim; 0 additional valid claims";
  });
  await verify("G44-T25/T37-ROLE_SUBSET","Lab NOLOGIN effective privileges, not real server account",()=>{
    reset();
    expectSqlFailure("CREATE TABLE g44_lab.should_fail(id int);",/42501/,"g44_writer");
    expectSqlFailure("UPDATE g44_lab.policy_gate SET approved_test=FALSE;",/42501/,"g44_writer");
    return "restricted effective role; not production account proof";
  });
}
function resourcesLeft() {
  return ["container","network","volume"].map(type=>{
    const args=type==="container"?["ps","-a","-q","--filter","label=com.docker.compose.project="+project]:
      [type,"ls","-q","--filter","label=com.docker.compose.project="+project];
    return docker(args).stdout.trim();
  }).filter(Boolean);
}
function evidence() {
  const summary={
    runId:project, evidenceClass:"ISOLATED_PG16_LAB_ONLY",
    head:context.gitHead,branch:context.gitBranch,imageId:context.imageId,
    dockerTarget:context.dockerTarget,
    testCount:results.length,
    statuses:{passed:results.filter(x=>x.status==="PASS").length,
      failed:results.filter(x=>x.status==="FAIL").length},
    scenarios:results, cleanup:teardown,
    actualYouTubeCalls:0, springAuthorization:"NOT_RUN",
    providerCompliance:"POLICY_HOLD", externalExactlyOnce:"NOT_PROVEN",
    notExecutedMatrixCases:"See G4-4 matrix; this subset never implies 40/40"
  };
  const evidenceDir=path.join(root,"evidence");
  mkdirSync(evidenceDir,{recursive:true});
  const data=JSON.stringify(summary,null,2)+"\n";
  writeFileSync(path.join(evidenceDir,project+".json"),data,{mode:0o600});
  process.stdout.write("Evidence SHA256="+createHash("sha256").update(data).digest("hex")+"\n");
  return summary;
}
async function main() {
  if(process.argv.includes("--check")) {
    process.stdout.write(checkManifest()+"\n");
    return;
  }
  if(!process.argv.includes("--run")||
    process.env.G44_LAB_CONFIRM!=="ISOLATED_ONLY")
    throw new Error("Run disabled. Require --run AND G44_LAB_CONFIRM=ISOLATED_ONLY.");
  preflight();
  let failure=null;
  try {
    started=true;
    docker([...base,"up","-d","--wait","--no-build","db"]);
    checkIsolation(); // STOP before any SQL if egress/port guard fails
    const init=readFileSync(schemaFile,"utf8");
    scalar(init);
    await tests();
  } catch (e) {
    failure=e;
    process.stderr.write("G44 LAB FAIL: "+String(e.message).slice(0,400)+"\n");
  } finally {
    if(started) {
      try {
        docker([...base,"down","-v","--remove-orphans"]);
        const remaining=resourcesLeft();
        if(remaining.length)throw new Error("Lab resources remain after down");
        teardown="PASS";
      } catch(e) {
        teardown="FAIL: "+String(e.message).slice(0,200);
        failure??=e;
      }
    }
    evidence();
  }
  if(failure)process.exitCode=1;
  else process.stdout.write("G44 subset lab PASS; 40-case full matrix remains separately gated.\n");
}
main().catch(e=>{process.stderr.write("G44 STOP: "+String(e.message).slice(0,400)+"\n");process.exitCode=1});

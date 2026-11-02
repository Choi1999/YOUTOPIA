"use strict";
/**
 * YOUTOPIA G45 offline demo. Fixed built-in synthetic fixtures only.
 * Never accepts a provider credential, URL, input file, --run, or HTTP action.
 */
const fs=require("node:fs");
const path=require("node:path");
const {buildSyntheticSnapshot}=require("../src/pipeline.cjs");
const allowed=Object.freeze({partial:"partial.json",ready:"ready.json",empty:"empty.json"});
const forbiddenEnv=["GOOGLE_API_KEY","YOUTUBE_API_KEY","YOUTOPIA_YOUTUBE_API_KEY",
  "GOOGLE_APPLICATION_CREDENTIALS","YOUTUBE_OAUTH_TOKEN"];
function stop(){
  process.stderr.write("G45_PIPELINE_STOP: offline synthetic fixtures only; external API and secrets are blocked\n");
  process.exitCode=3;
}
function run(args) {
  if(forbiddenEnv.some(k=>Object.hasOwn(process.env,k)))
    throw new Error("provider credentials not allowed in offline demo");
  if(args.length===1&&args[0]==="--check"){
    process.stdout.write(JSON.stringify({status:"OFFLINE_PIPELINE_ONLY",providerRequests:0,
      liveComments:0,allowedFixtures:Object.keys(allowed),derivedProviderMetricsApproved:false,
      policy:"POLICY_HOLD"})+"\n");
    return;
  }
  if(args.length===2&&args[0]==="--demo"&&Object.hasOwn(allowed,args[1])){
    const file=path.join(__dirname,"..","fixtures",allowed[args[1]]);
    if(fs.statSync(file).size>128*1024)throw new Error("fixture too large");
    const source=JSON.parse(fs.readFileSync(file,"utf8"));
    const result=buildSyntheticSnapshot(source);
    if(result.evidence.providerRequestsMade!==0||result.snapshot.sourceType!=="STATIC_FIXTURE"||
       result.snapshot.isSynthetic!==true)
      throw new Error("synthetic source check failed");
    // No raw comment text, author metadata or page token leaves this process.
    process.stdout.write(JSON.stringify(result)+"\n");
    return;
  }
  throw new Error("unknown command; --run and custom --input intentionally unsupported");
}
try{run(process.argv.slice(2));}catch{stop();}

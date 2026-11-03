"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const ps=fs.readFileSync(path.join(root,"scripts","g45-l8-cloud-metadata-preflight.ps1"),"utf8");
const doc=fs.readFileSync(path.resolve(root,"../../../docs/integration/YU32_G45_L8_CLOUD_EVIDENCE_FIRST_CALL_GATE_V01.md"),"utf8");
const workflow=fs.readFileSync(path.resolve(root,"../../../.github/workflows/g45-l8-windows-cloud-evidence.yml"),"utf8");
const policy=require("../policy-gates.json");

test("G45-L8-01: canonical policy still on hold with no live call",()=>{
  assert.equal(policy.status,"POLICY_HOLD");
  assert.equal(policy.verifiedCount,0);
  assert.equal(policy.liveCallsAuthorized,false);
  assert.equal(policy.derivedSentimentAuthorized,false);
  assert.equal(policy.externalDataCollected,false);
});
test("G45-L8-02: manual inspector defaults to Check with no gcloud",()=>{
  assert.match(ps,/DefaultParameterSetName = 'Check'/);
  assert.match(ps,/if \(\$PSCmdlet\.ParameterSetName -eq 'Check'\)/);
  assert.match(ps,/CHECK_ONLY_NO_GCLOUD/);
  assert.match(ps,/cloudCommandInvoked = \$CloudCommandInvoked/);
  assert.match(ps,/cloudCliMayUseExistingAuthentication = \$CloudCommandInvoked/);
});
test("G45-L8-03: explicit project and trusted executable required",()=>{
  assert.match(ps,/\[string\]\$ProjectId/);
  assert.match(ps,/ParameterSetName = 'Inspect', Mandatory = \$true/);
  assert.match(ps,/PROJECT_IDENTITY_MISMATCH/);
  assert.match(ps,/Get-Command -Name 'gcloud' -CommandType Application/);
  for(const forbidden of [/auth login/i,/auth print-access-token/i,/api-keys get-key-string/i,/GOOGLE_API_KEY/,/YOUTUBE_API_KEY/,/serviceusage\.services\.enable/])
    assert.doesNotMatch(ps,forbidden);
});
test("G45-L8-04: read-only Cloud metadata commands, no provider, key or logs",()=>{
  assert.match(ps,/'projects' 'describe'/);
  assert.match(ps,/'services' 'list' '--enabled'/);
  assert.match(ps,/'--quiet' '--verbosity=error'/);
  assert.match(ps,/2>\$null/);
  assert.doesNotMatch(ps,/https?:\/\/|commentThreads|Invoke-WebRequest|Invoke-RestMethod|Start-Process|New-Item|Set-Content|Export-Csv|Add-Content|Out-File|Remove-Item/);
});
test("G45-L8-05: local observations never claim independent approvals",()=>{
  for(const clause of ["projectOwnerVerified = $false","apiKeyRestrictionsVerified = $false","currentEgressIpVerified = $false","availableQuotaVerified = $false","sourceUsePolicyVerified = $false","lifecycleAndErasureVerified = $false","firstLiveCallApproved = $false","canonicalEvidenceVerifiedCount = 0","canonicalPolicy = 'POLICY_HOLD'","liveYouTubeRequestsMade = 0","apiKeyMaterialReadByThisScript = $false"])
    assert.ok(ps.includes(clause),clause);
});
test("G45-L8-06: evidence checklist separates project, quota, deletion and call",()=>{
  for(const id of ["E01","E02","E03","E04","E05","E07","E08","E11"])
    assert.ok(doc.includes(id),id);
  assert.match(doc,/별도 명시 승인/);
  assert.match(doc,/LIVE_YOUTUBE_0/);
  assert.match(doc,/비밀 제외 JSON/);
});
test("G45-L8-07: CI executes only Check on Windows",()=>{
  assert.match(workflow,/runs-on: windows-latest/);
  assert.match(workflow,/g45-l8-cloud-metadata-preflight\.ps1/);
  assert.match(workflow,/\$script -Check/);
  assert.doesNotMatch(workflow,/-Inspect|-ProjectId|gcloud\s+(?:projects|services|auth)|secrets\./);
});
test("G45-L8-08: L7 transport lock remains false",()=>{
  const source=fs.readFileSync(path.resolve(root,"../../experiments/yu32-g45-offline-pipeline-v0/src/first-page-provider-transport.cjs"),"utf8");
  assert.match(source,/const RELEASED_FOR_FIRST_REAL_CALL=false/);
  assert.match(source,/gates\.status!=="LIVE_FIRST_CALL_APPROVED"/);
  assert.match(source,/const REQUIRED_EVIDENCE=/);
});

test("G45-L8-09: report distinguishes existing Cloud CLI auth from direct API key inspection",()=>{
  assert.match(ps,/apiKeyMaterialReadByThisScript = \$false/);
  assert.match(ps,/cloudCliMayUseExistingAuthentication = \$CloudCommandInvoked/);
  assert.doesNotMatch(ps,/credentialsReadByThisScript = 0/);
  assert.match(doc,/기존 OAuth 인증/);
  assert.match(doc,/로그/);
});
test("G45-L8-10: missing Cloud CLI reports it was not invoked",()=>{
  assert.match(ps,/\$cloudCommandInvoked = \$false/);
  assert.match(ps,/\$cloudCommandInvoked = \$true/);
  assert.match(ps,/New-SafeReport 'LOCAL_METADATA_UNAVAILABLE' \$false \$false \$cloudCommandInvoked/);
  assert.doesNotMatch(ps,/New-SafeReport 'LOCAL_METADATA_UNAVAILABLE' \$false \$false \$true/);
});
test("G45-L8-11: service JSON array boundaries preserve empty and single-element results",()=>{
  assert.match(ps,/ConvertFrom-Json -InputObject \(\$rawServices -join \[Environment\]::NewLine\) -NoEnumerate/);
  assert.match(ps,/\$services -isnot \[System\.Array\]/);
  assert.match(ps,/foreach \(\$service in \$services\)/);
  assert.match(ps,/SERVICE_ITEM_INVALID/);
});
test("G45-L8-12: only explicitly ENABLED YouTube Data API may be observed",()=>{
  assert.match(ps,/\$service\.state -ceq 'ENABLED'/);
  assert.match(ps,/\$service\.config\.name -ceq 'youtube\.googleapis\.com'/);
  assert.match(ps,/PROJECT_IDENTITY_MISMATCH/);
  assert.match(wf,/cloudCliMayUseExistingAuthentication -ne \$false/);
  assert.match(wf,/apiKeyMaterialReadByThisScript -ne \$false/);
});

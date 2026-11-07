"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const script=fs.readFileSync(path.join(root,"scripts","g45-l9-windows-dpapi-vault.ps1"),"utf8");
const workflow=fs.readFileSync(path.resolve(root,
  "../../../.github/workflows/g45-l9-windows-dpapi-vault-validation.yml"),"utf8");
const doc=fs.readFileSync(path.resolve(root,
  "../../../docs/integration/YU32_G45_L9_WINDOWS_DPAPI_PROTECTED_KEY_STORE_V01.md"),"utf8");
const ignore=fs.readFileSync(path.resolve(root,"../../../.gitignore"),"utf8");
const gates=require("../policy-gates.json");

test("G45-L9-01: canonical policy and actual collector stay hard locked",()=>{
  assert.equal(gates.status,"POLICY_HOLD");
  assert.equal(gates.verifiedCount,0);
  assert.equal(gates.liveCallsAuthorized,false);
  assert.equal(gates.derivedSentimentAuthorized,false);
  assert.equal(gates.externalDataCollected,false);
  const transport=fs.readFileSync(path.resolve(root,
    "../../experiments/yu32-g45-offline-pipeline-v0/src/first-page-provider-transport.cjs"),"utf8");
  assert.match(transport,/const RELEASED_FOR_FIRST_REAL_CALL=false;/);
});
test("G45-L9-02: default status does not read, print or decrypt secret",()=>{
  assert.match(script,/DefaultParameterSetName = 'Status'/);
  assert.match(script,/if \(\$PSCmdlet\.ParameterSetName -eq 'Status'\)/);
  assert.match(script,/VAULT_PRESENT_NO_DECRYPT/);
  assert.match(script,/dpapiDecryptionPerformed = \$Decrypted/);
});
test("G45-L9-03: enrollment requires a local secure interactive prompt",()=>{
  assert.match(script,/Read-Host 'Enter DEV YouTube API key locally \(not in chat\)' -AsSecureString/);
  assert.match(script,/ConvertFrom-SecureString -SecureString \$Secret -ErrorAction Stop/);
  assert.doesNotMatch(script,/ConvertFrom-SecureString -SecureString \$Secret -(?:Key|SecureKey)/);
  assert.match(script,/Secret\.Length -lt 30/);
});
test("G45-L9-04: current-user DPAPI vault is outside repository",()=>{
  assert.match(script,/\[Environment\]::GetFolderPath\(\[Environment\+SpecialFolder\]::LocalApplicationData\)/);
  assert.match(script,/Join-Path \$root 'Secrets'/);
  assert.match(script,/youtube-dev\.dpapi/);
  assert.doesNotMatch(script,/Get-Location|GetCurrentDirectory|\.env|process\.env/);
});
test("G45-L9-05: restrict directory and vault file ACL before storing",()=>{
  assert.match(script,/SetAccessRuleProtection\(\$true, \$false\)/);
  assert.match(script,/Set-Acl -LiteralPath \$Path -AclObject \$acl/);
  assert.match(script,/Set-PrivateAcl \$Directory \$true/);
  assert.match(script,/Set-PrivateAcl \$temporary \$false/);
  assert.match(script,/Assert-PrivateAcl \$File/);
  assert.match(script,/S-1-5-18/);
  assert.match(script,/S-1-5-32-544/);
});
test("G45-L9-06: refuse symlink, existing secret overwrite and unsafe ACL",()=>{
  assert.match(script,/ReparsePoint/);
  assert.match(script,/ALREADY_ENROLLED/);
  assert.match(script,/INHERITED_ACL/);
  assert.match(script,/EXCESSIVE_ACL/);
  assert.match(script,/File\]::Move\(\$temporary, \$File\)/);
});
test("G45-L9-07: verification decrypts to SecureString and disposes it",()=>{
  assert.match(script,/ConvertTo-SecureString -String \$encrypted -ErrorAction Stop/);
  assert.match(script,/\$secret\.Dispose\(\)/);
  assert.match(script,/DEV_KEY_DECRYPTED_LOCALLY_NO_OUTPUT/);
  assert.doesNotMatch(script,/SecureStringToBSTR|PtrToStringBSTR|ConvertFrom-SecureString\s+-AsPlainText/);
});
test("G45-L9-08: only an explicitly named synthetic fixture uses AsPlainText",()=>{
  const lines=script.split("\n").filter(x=>x.includes("-AsPlainText"));
  assert.equal(lines.length,1);
  assert.match(lines[0],/G45_L9_SYNTHETIC_KEY_NOT_REAL_0123456789/);
  assert.match(script,/SYNTHETIC_DPAPI_ROUNDTRIP_PASS/);
});
test("G45-L9-09: all reports are sanitized and neither key nor cipher emitted",()=>{
  assert.match(script,/secretPrinted = \$false/);
  assert.match(script,/collectorCredentialReaderIntegrated = \$false/);
  assert.match(script,/liveCallsAuthorized = \$false/);
  assert.match(script,/cloudApiRequests = 0/);
  assert.match(script,/youtubeApiRequests = 0/);
  assert.doesNotMatch(script,/Write-Host \$secure|Write-Output \$secret|Write-Output \$cipher|ConvertFrom-Json|Invoke-WebRequest|Invoke-RestMethod|https?:\/\//);
});
test("G45-L9-10: Remove does not revoke provider key and requires explicit confirmation",()=>{
  assert.match(script,/ParameterSetName = 'Remove', Mandatory = \$true/);
  assert.match(script,/Type REMOVE/);
  assert.match(script,/if \(\$confirm -cne 'REMOVE'\)/);
  assert.match(script,/LOCAL_ENCRYPTED_COPY_REMOVED_NOT_REVOKED/);
  assert.match(doc,/Google Cloud에서 키 폐기/);
});
test("G45-L9-11: Git ignores accidental DPAPI credential file exports",()=>{
  assert.match(ignore,/^\*\.dpapi$/m);
  assert.match(ignore,/^\*\.dpapi\.\*$/m);
});
test("G45-L9-12: CI runs only status and synthetic DPAPI round-trip on Windows",()=>{
  assert.match(workflow,/runs-on: windows-latest/);
  assert.match(workflow,/-Status/);
  assert.match(workflow,/-SelfTest/);
  assert.doesNotMatch(workflow,/-Enroll|-Remove|-Verify|-Inspect|YOUTUBE_API_KEY|GOOGLE_API_KEY|secrets\./);
});
test("G45-L9-13: documentation states key stays out of PR and collector is still disconnected",()=>{
  assert.match(doc,/Read-Host -AsSecureString/);
  assert.match(doc,/collectorCredentialReaderIntegrated=false/);
  assert.match(doc,/원문 API 호출 0/);
  assert.match(doc,/GitHub/);
  assert.match(doc,/E03/);
});
test("G45-L9-14: data transfer does not use CLI arguments or env vars",()=>{
  assert.doesNotMatch(script,/ArgumentList|StandardOutput|StandardInput|API_KEY\s*=|Read-Host -Prompt '.*KEY.*'(?!.+-AsSecureString)/);
  assert.match(script,/Get-VaultLocation/);
  assert.match(script,/Test-DpapiSecret/);
});

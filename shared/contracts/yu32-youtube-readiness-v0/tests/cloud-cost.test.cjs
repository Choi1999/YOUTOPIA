"use strict";
/** No HTTP, Cloud SDK, Google Cloud credentials or resource creation. */
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const x=JSON.parse(fs.readFileSync(path.join(root,"cloud-cost-model.v01.json"),"utf8"));
const doc=fs.readFileSync(path.join(root,"../../../docs/integration/YU32_G4_5_CLOUD_RUN_COST_ESTIMATE_V01.md"),"utf8");
const within=(got,want)=>assert.ok(Math.abs(got-want)<0.00000001,
 "value "+got+" differs from expected "+want);

test("G45-COST01: estimate version, date, currency and disclosure",()=>{
  assert.equal(x.version,"YU32_G4_5_CLOUD_COST_MODEL_V01");
  assert.equal(x.pricingAsOf,"2026-11-02");
  assert.equal(x.currency,"USD");
  assert.equal(x.status,"OFFLINE_ESTIMATE_ONLY");
  assert.equal(x.candidateRegion,"asia-northeast3");
  assert.equal(x.regionIsApproved,false);
  assert.equal(x.officialRateConfirmationBeforeProcurementRequired,true);
});
test("G45-COST02: compute per job is precisely modeled before free-tier",()=>{
  const rate=x.ratesUSD;
  const one=x.scenarios.oneOffOneHourThenDelete;
  const g=one.inputs.vCpu*rate.cloudRunTier2VcpuSecond+
          one.inputs.ramGiB*rate.cloudRunTier2GiBSecond;
  within(one.components.cloudRunBeforeFreeTierUSD,g*one.inputs.secondsPerRun*one.inputs.runs);
  within(one.components.cloudRunBeforeFreeTierUSD,0.002736);
});
test("G45-COST03: Cloud NAT IP connected monthly is $3.60 at 720h",()=>{
  within(x.scenarios.thirtyManualRunsOneIPRetained.components.attachedNatIPv4USD,
    x.ratesUSD.natAttachedPublicIPv4Hour*720);
  within(x.scenarios.thirtyManualRunsOneIPRetained.components.attachedNatIPv4USD,3.6);
});
test("G45-COST04: reserved-but-unattached IPv4 is $7.20 at 720h",()=>{
  within(x.reservedUnattachedIP720hUSD,
    x.ratesUSD.reservedUnattachedPublicIPv4Hour*720);
  within(x.reservedUnattachedIP720hUSD,7.2);
});
test("G45-COST05: one-off model accounts for one hour static IP and NAT endpoint",()=>{
  const s=x.scenarios.oneOffOneHourThenDelete;
  assert.equal(s.inputs.runs,1);
  assert.equal(s.inputs.secondsPerRun,120);
  assert.equal(s.inputs.natBilledEndpointHours,1);
  assert.equal(s.inputs.attachedNatIPv4Hours,1);
  within(s.illustrativePartialGrossUSD,0.009179945);
});
test("G45-COST06: thirty runs low endpoint-hours scenario is internally consistent",()=>{
  const s=x.scenarios.thirtyManualRunsOneIPRetained;
  assert.equal(s.inputs.runs,30);
  assert.equal(s.inputs.natBilledEndpointHours,1);
  within(s.components.cloudRunBeforeFreeTierUSD,0.08208);
  within(s.components.natGatewayIllustrativeUSD,0.0014);
  within(s.illustrativePartialGrossUSD,3.683919453);
});
test("G45-COST07: continual NAT assignment scenario is not assumed actual bill",()=>{
  const s=x.scenarios.thirtyRunsOneNatEndpointFor720Hours;
  assert.equal(s.inputs.natBilledEndpointHours,720);
  within(s.components.natGatewayIllustrativeUSD,1.008);
  within(s.illustrativePartialGrossUSD,4.690519453);
  assert.ok(x.notActualPrices.some(v=>v.includes("proxy")||v.includes("confirmed")));
});
test("G45-COST08: NAT processing traffic conversion uses MiB/1024",()=>{
  for(const s of Object.values(x.scenarios))
    within(s.components.natDataProcessingUSD,
      s.inputs.natTrafficMiB/1024*x.ratesUSD.natProcessedGiB);
});
test("G45-COST09: all scenario subtotals equal their components",()=>{
  for(const s of Object.values(x.scenarios)) {
    const total=Object.values(s.components).reduce((a,b)=>a+b,0);
    within(total,s.illustrativePartialGrossUSD);
  }
});
test("G45-COST10: free tier is conditional and cannot be promised",()=>{
  assert.equal(x.freeTierAssumptions.assumeEntireFreeTierAvailable,false);
  assert.equal(x.freeTierAssumptions.secretManagerFreeActiveVersionsMonthly,6);
  assert.equal(x.freeTierAssumptions.secretManagerFreeAccessOperationsMonthly,10000);
  assert.equal(x.freeTierAssumptions.cloudRunJobsVcpuSecondsMonthlyBaselineUSDRegion,240000);
  assert.equal(x.freeTierAssumptions.cloudRunJobsGiBSecondsMonthlyBaselineUSDRegion,450000);
});
test("G45-COST11: proposed budget is not a hard spending limit or permission to spend",()=>{
  assert.equal(x.budgetProposal.alertOnlyMonthlyUSD,10);
  assert.deepEqual(x.budgetProposal.alertPercentages,[50,90,100]);
  assert.equal(x.budgetProposal.isHardSpendCap,false);
  assert.equal(x.budgetProposal.billingBudgetCreated,false);
  assert.equal(x.budgetProposal.cloudRunSelectiveSpendCapIfAvailableDoesNotCoverNatOrIp,true);
});
test("G45-COST12: cloud resource and provider usage remain zero and blocked",()=>{
  assert.equal(x.scope.cloudResourcesCreated,0);
  assert.equal(x.scope.apiKeysCreated,0);
  assert.equal(x.scope.providerRequestsMade,0);
  assert.equal(x.scope.realCommentsStored,0);
  assert.equal(x.scope.productionChanges,0);
  assert.equal(x.scope.prMerged,false);
  assert.equal(x.scope.providerPolicy,"POLICY_HOLD");
});
test("G45-COST13: pricing links and exclusions are explicit and no key is embedded",()=>{
  for(const endpoint of ["run/pricing","nat/pricing","vpc/network-pricing","secret-manager/pricing"])
    assert.ok(x.sourceURLs.some(v=>v.includes(endpoint)));
  assert.ok(x.notActualPrices.some(v=>v.includes("taxes")));
  assert.ok(doc.includes("부분 합계")&&doc.includes("POLICY_HOLD"));
  assert.doesNotMatch(JSON.stringify(x),/AIza[0-9A-Za-z_-]{25,}|youtopia-513507|oauthToken|PRIVATE KEY/);
});

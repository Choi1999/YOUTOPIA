'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sync=require('../g2d-playback-sync.js');
function fixture(){
 let clock=5000;
 const local={currentTime:88.803,duration:888.032,paused:true,playCalls:0,pauseCalls:0,
  play(){this.paused=false;this.playCalls++;return Promise.resolve();},
  pause(){this.paused=true;this.pauseCalls++;}};
 const youtube={currentTime:91,duration:888,state:2,seekCalls:[],playCalls:0,pauseCalls:0,
  getCurrentTime(){return this.currentTime;},getDuration(){return this.duration;},
  getPlayerState(){return this.state;},
  seekTo(time,buffer){this.seekCalls.push({time,buffer});this.currentTime=time;},
  playVideo(){this.playCalls++;this.state=1;},
  pauseVideo(){this.pauseCalls++;this.state=2;}};
 const s=sync.create({local,now:()=>clock});
 return {local,youtube,s,advance:ms=>{clock+=ms;}};
}
test('independent is default, never synchronizes or claims equality',()=>{
 const {local,youtube,s}=fixture();
 assert.equal(s.status().linked,false);
 assert.equal(s.status().calibrated,false);
 s.localSeeked();s.localPlayback(true);
 assert.equal(youtube.seekCalls.length,0);
 assert.throws(()=>s.setLinked(true),/YouTube 준비/);
});
test('reference requires valid two-player times; offset can be positive or negative',()=>{
 assert.ok(Math.abs(sync.offsetSeconds(88.803,91)-2.197)<.000001);
 assert.equal(sync.offsetSeconds(120,118),-2);
 assert.throws(()=>sync.offsetSeconds(NaN,10),/required/);
 assert.throws(()=>sync.offsetSeconds(-1,10),/required/);
});
test('calibration is blocked until official player ready and both are paused',()=>{
 const {s,local,youtube}=fixture();
 assert.throws(()=>s.capture(),/연결 후/);
 s.attach(youtube);
 youtube.state=1;s.youtubeStateChange(1);
 assert.throws(()=>s.capture(),/일시정지/);
 youtube.state=2;s.youtubeStateChange(2);
 local.paused=false;
 assert.throws(()=>s.capture(),/일시정지/);
});
test('after two paused aligned scenes, calibration records exact operator offset only in memory',()=>{
 const {s,youtube}=fixture();
 s.attach(youtube);
 const status=s.capture();
 assert.ok(Math.abs(status.offsetSeconds-2.197)<.000001);
 assert.equal(status.linked,false);
 assert.equal(status.calibrated,true);
 assert.equal('g3Authorized' in status,false);
 assert.equal('fullYoutubeEditionEquivalenceVerified' in status,false);
});
test('enabling linked mode sends calibrated local time to YouTube',()=>{
 const {s,youtube}=fixture();
 s.attach(youtube);s.capture();youtube.currentTime=100;
 s.setLinked(true);
 assert.equal(s.status().linked,true);
 assert.equal(youtube.seekCalls.length,1);
 assert.ok(Math.abs(youtube.seekCalls[0].time-91)<.000001);
});
test('local timeline seeks cause YouTube seek with offset while linked',()=>{
 const {s,local,youtube}=fixture();
 s.attach(youtube);s.capture();s.setLinked(true);
 local.currentTime=300.123;s.localSeeked();
 assert.equal(youtube.seekCalls.length,2);
 assert.ok(Math.abs(youtube.currentTime-302.32)<.000001);
});
test('independent mode disables coupled seeks but keeps manual offset',()=>{
 const {s,local,youtube}=fixture();
 s.attach(youtube);s.capture();s.setLinked(true);
 s.setLinked(false);local.currentTime=450;s.localSeeked();
 assert.equal(youtube.seekCalls.length,1);
 assert.ok(Math.abs(s.status().offsetSeconds-2.197)<.000001);
});
test('manual align local from YouTube does not bounce back to YouTube',()=>{
 const {s,local,youtube}=fixture();
 s.attach(youtube);s.capture();s.setLinked(true);
 const old=youtube.seekCalls.length;
 youtube.currentTime=500;
 const moved=s.alignLocal();
 assert.ok(Math.abs(moved-497.803)<.000001);
 s.localSeeked();
 assert.equal(youtube.seekCalls.length,old);
});
test('manual YouTube scrub discontinuity is detected while linked, local timing updated only',()=>{
 const {s,local,youtube,advance}=fixture();
 s.attach(youtube);s.capture();s.setLinked(true);
 advance(1600);s.poll();
 advance(650);youtube.currentTime=410;s.poll();
 assert.ok(Math.abs(local.currentTime-407.803)<.00001);
 const n=youtube.seekCalls.length;s.localSeeked();assert.equal(youtube.seekCalls.length,n);
});
test('normal YouTube playback progression does not cause seek feedback',()=>{
 const {s,local,youtube,advance}=fixture();
 s.attach(youtube);s.capture();s.setLinked(true);
 youtube.state=1;s.youtubeStateChange(1);
 advance(1800);youtube.currentTime=92.8;s.poll();
 assert.ok(Math.abs(local.currentTime-88.803)<.001);
});
test('play and pause propagate from local to YouTube in linked mode',()=>{
 const {s,youtube,advance}=fixture();
 s.attach(youtube);s.capture();s.setLinked(true);
 s.localPlayback(true);
 assert.equal(youtube.playCalls,1);
 advance(1000);
 s.localPlayback(false);
 assert.equal(youtube.pauseCalls,1);
});
test('YouTube play and pause events propagate to local after echo suppression',()=>{
 const {s,youtube,local,advance}=fixture();
 s.attach(youtube);s.capture();s.setLinked(true);
 advance(1200);
 s.youtubeStateChange(1);
 assert.equal(local.paused,false);
 advance(1300);s.youtubeStateChange(2);
 assert.equal(local.paused,true);
});
test('target seeks clamp near video boundaries',()=>{
 assert.equal(sync.targetYoutubeTime(880,25,888),888);
 assert.equal(sync.targetYoutubeTime(0,-5,888),0);
 assert.equal(sync.targetLocalTime(2,10,734),0);
 assert.equal(sync.targetLocalTime(850,-50,734),734);
});
test('on embed error, linked mode disables immediately and previous offset is cleared',()=>{
 const {s,youtube}=fixture();
 s.attach(youtube);s.capture();s.setLinked(true);s.failed();
 assert.equal(s.status().ready,false);assert.equal(s.status().linked,false);
 assert.equal(s.status().calibrated,false);
 assert.throws(()=>s.setLinked(true),/YouTube 준비/);
});
test('player with incomplete API cannot be attached',()=>{
 const {s}=fixture();
 assert.throws(()=>s.attach({getCurrentTime:()=>1}),/IFrame player/);
});
test('local static UI loads sync engine and official user-initiated iframe API',()=>{
 const dir=path.join(__dirname,'..');
 const html=fs.readFileSync(path.join(dir,'g2d-workspace.html'),'utf8');
 const js=fs.readFileSync(path.join(dir,'g2d-workspace-client.js'),'utf8');
 const server=fs.readFileSync(path.join(dir,'g2d-workspace-server.cjs'),'utf8');
 for(const id of ['independentMode','linkedMode','captureOffset','offsetReadout','alignYoutube','alignLocal','syncState']){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.ok(html.includes('src="/playback-sync.js"'));
 assert.ok(js.includes('www.youtube.com/iframe_api'));
 assert.ok(js.includes('enablejsapi=1'));
 assert.ok(js.includes('origin='));
 assert.ok(js.includes('G2DPlaybackSync.create'));
 assert.ok(server.includes("url.pathname==='/playback-sync.js'"));
 assert.ok(server.includes('https://www.youtube.com https://s.ytimg.com'));
 assert.ok(!js.includes('fetch(review.youtubeUrl)'));
});

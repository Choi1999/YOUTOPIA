'use strict';
// G2-D in-memory alignment of two already-open players.
// Time offset is operator-calibrated: youtubeTime = localTime + offsetSeconds.
// No player/network interaction is performed until the user opens the YouTube iframe.
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.G2DPlaybackSync=api;
})(typeof window!=='undefined'?window:null,function(){
 const MIN_DRIFT_S=1.6;
 function validTime(t){return Number.isFinite(t)&&t>=0;}
 function clamp(t,max){return Math.max(0,Math.min(t,max));}
 function offsetSeconds(localTime,youtubeTime){
  if(!validTime(localTime)||!validTime(youtubeTime))throw Error('Two observed player times required');
  return youtubeTime-localTime;
 }
 function targetYoutubeTime(localTime,offset,duration){
  if(!validTime(localTime)||!Number.isFinite(offset)||!validTime(duration)||duration<=0)throw Error('Invalid linked player timeline');
  return clamp(localTime+offset,duration);
 }
 function targetLocalTime(youtubeTime,offset,duration){
  if(!validTime(youtubeTime)||!Number.isFinite(offset)||!validTime(duration)||duration<=0)throw Error('Invalid linked player timeline');
  return clamp(youtubeTime-offset,duration);
 }
 function create({local,now=()=>Date.now(),onChange=()=>{}}){
  if(!local||typeof local.currentTime!=='number'||typeof local.pause!=='function')throw Error('Local player required');
  let youtube=null,ready=false,linked=false,offset=null,lastYTCommand=0,lastPlaybackCommand=0,lastYTObserved=null,
      pendingLocalSeek=null,selectedYoutubeState=-1,youtubeDuration=0,apiAvailable=false;
  function notify(){onChange(status());}
  function safeYoutubeTime(){if(!ready||!youtube)return null;const n=Number(youtube.getCurrentTime?.());return validTime(n)?n:null;}
  function safeYoutubeDuration(){if(!ready||!youtube)return 0;const n=Number(youtube.getDuration?.());return validTime(n)?n:0;}
  function localDuration(){const n=Number(local.duration);return validTime(n)&&n>0?n:0;}
  function status(){
   const yt=safeYoutubeTime();
   const ytDuration=safeYoutubeDuration();
   const predicted=offset!==null&&yt!==null?local.currentTime+offset:null;
   return {ready,linked,calibrated:offset!==null,offsetSeconds:offset,
    youtubeTime:yt,youtubeDuration:ytDuration,localTime:local.currentTime,
    driftSeconds:predicted===null?null:yt-predicted,
    youtubeState:selectedYoutubeState,apiAvailable};
  }
  function attach(player){
   if(!player||typeof player.seekTo!=='function'||typeof player.getCurrentTime!=='function')throw Error('Official IFrame player API required');
   youtube=player;ready=true;apiAvailable=true;linked=false;offset=null;selectedYoutubeState=Number(player.getPlayerState?.()??-1);
   lastYTObserved={time:safeYoutubeTime(),at:now()};notify();return status();
  }
  function failed(){youtube=null;ready=false;linked=false;offset=null;apiAvailable=false;lastYTObserved=null;notify();}
  function capture(){
   if(!ready)throw Error('YouTube 공식 임베드 플레이어 연결 후 기준점을 기록하세요.');
   if(!local.paused||selectedYoutubeState===1)throw Error('두 영상을 일시정지한 뒤 같은 장면에서 기준점을 기록하세요.');
   const yt=safeYoutubeTime();
   if(yt===null||localDuration()<=0||safeYoutubeDuration()<=0)throw Error('양쪽 플레이어가 로드된 후 다시 시도하세요.');
   offset=offsetSeconds(local.currentTime,yt);linked=false;lastYTObserved={time:yt,at:now()};notify();return status();
  }
  function setLinked(value){
   if(value){
    if(!ready||offset===null||safeYoutubeDuration()<=0)throw Error('YouTube 준비 후 같은 장면을 정렬해 기준점을 기록하세요.');
    linked=true;alignYoutube(); // align before playback, never infer edition identity
   }else linked=false;
   notify();return status();
  }
  function alignYoutube(){
   if(!ready||offset===null)throw Error('먼저 같은 장면에서 기준점을 기록하세요.');
   const dest=targetYoutubeTime(local.currentTime,offset,safeYoutubeDuration());
   lastYTCommand=now();lastYTObserved={time:dest,at:lastYTCommand};
   youtube.seekTo(dest,true);notify();return dest;
  }
  function alignLocal(){
   if(!ready||offset===null)throw Error('먼저 같은 장면에서 기준점을 기록하세요.');
   const yt=safeYoutubeTime();if(yt===null)throw Error('YouTube 재생시간을 읽을 수 없습니다.');
   const dest=targetLocalTime(yt,offset,localDuration());
   pendingLocalSeek=dest;
   local.currentTime=dest;lastYTObserved={time:yt,at:now()};notify();return dest;
  }
  function localSeeked(){
   if(pendingLocalSeek!==null){
    if(Math.abs(local.currentTime-pendingLocalSeek)<.25){pendingLocalSeek=null;return;}
    pendingLocalSeek=null;
   }
   if(linked)alignYoutube();
  }
  function localPlayback(isPlaying){
   if(!linked||!ready)return;
   const state=Number(youtube.getPlayerState?.());
   if(isPlaying&&state===1||!isPlaying&&state===2)return;
   lastPlaybackCommand=now();
   if(isPlaying)youtube.playVideo();else youtube.pauseVideo();
  }
  function youtubeStateChange(nextState){
   selectedYoutubeState=Number(nextState);
   if(!linked||!ready){notify();return;}
   // Don't immediately echo actions that originated from local player
   if(now()-lastPlaybackCommand<850){notify();return;}
   if(selectedYoutubeState===1&&local.paused){
    const p=local.play();if(p&&typeof p.catch==='function')p.catch(()=>{});
   }else if(selectedYoutubeState===2&&!local.paused)local.pause();
   notify();
  }
  function poll(){
   if(!ready)return status();
   const time=safeYoutubeTime(),at=now();
   if(time===null)return status();
   const prev=lastYTObserved;
   if(linked&&prev&&now()-lastYTCommand>1200){
    const elapsed=(at-prev.at)/1000;
    const expected=prev.time+(selectedYoutubeState===1?elapsed:0);
    const jump=Math.abs(time-expected);
    // The YouTube API doesn't expose a seek event. Only sizeable discontinuities
    // are interpreted as manual seeking; regular buffering/drift remains operator-reviewed.
    if(jump>MIN_DRIFT_S){
     const dest=targetLocalTime(time,offset,localDuration());
     pendingLocalSeek=dest;local.currentTime=dest;
    }
   }
   lastYTObserved={time,at};notify();return status();
  }
  return {attach,failed,capture,setLinked,alignYoutube,alignLocal,localSeeked,localPlayback,
   youtubeStateChange,poll,status};
 }
 return {offsetSeconds,targetYoutubeTime,targetLocalTime,create};
});

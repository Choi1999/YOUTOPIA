import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import { serviceApi } from "./api";
import { StatePanel, time, useResource } from "./components";
export function GamePublications({gameId}:{gameId:string}) {
  const [url,setUrl]=useSearchParams();
  const days=url.get("days")==="7"?7:30;
  const [selection,setSelection] = useState({gameId,days,date:"",page:0});
  const active=selection.gameId===gameId&&selection.days===days?selection:{gameId,days,date:"",page:0};
  const params=new URLSearchParams({days:String(active.days),page:String(active.page)});
  if(active.date)params.set("date",active.date);
  const resource=useResource(gameId+":"+params,s=>serviceApi.publications(gameId,params,s));
  const data=resource.data, videos=data?.videos;
  return <section className="trend-chart-panel publication-panel" aria-label="게임명 검색으로 관측한 게시 영상">
    <h2>게임명 검색으로 관측한 일별 신규 게시 영상</h2>
    <p className="chart-caption">게임의 검색어와 연결된 영상 기준이며 내용의 관련성은 미검증입니다. YouTube 전체 업로드 수가 아닙니다. 게시일은 한국 시간 기준, 같은 영상은 게임별 한 번만 계산합니다. 오늘은 진행 중이며 과거 집계도 추가 발견으로 바뀔 수 있습니다. 검색 범위·최근 수집 성공 여부는 미확인입니다.</p>
    <label>게시 영상 기간<select value={active.days} onChange={e=>{setSelection({gameId,days:Number(e.target.value),date:"",page:0});const next=new URLSearchParams(url);next.set("days",e.target.value);next.delete("videoDate");setUrl(next,{replace:true})}}><option value="7">최근 7일</option><option value="30">최근 30일</option></select></label>
    <StatePanel loading={resource.loading} error={resource.error} retry={resource.retry}/>
    {data && !["AVAILABLE","EMPTY"].includes(data.dataStatus) && <p role="status">게시 영상 상태 미확인 · {data.dataStatus==="PENDING_CONTRACT"?"게임-검색어-검색 결과의 승인된 조회 연결 준비가 필요합니다.":"조회 권한과 연결 상태 확인이 필요합니다."} 영상 0개를 뜻하지 않습니다.</p>}
    {data && videos && ["AVAILABLE","EMPTY"].includes(data.dataStatus) && <>
      <p className="chart-caption">기준 {time(data.asOf)} · 전체 연결 이력 중 게시 시각 누락 {data.missingPublishedAt}개(날짜 집계 제외) · 수집 범위 완전성 미확인</p>
      <div className="publication-days" role="group" aria-label="게시일별 영상 수 차트">
        {data.points.map(p=><button key={p.date} aria-pressed={data.selectedDate===p.date} onClick={()=>{setSelection({...active,date:p.date,page:0});const next=new URLSearchParams(url);next.set("videoDate",p.date);setUrl(next,{replace:true})}} aria-label={`${p.date} 관측 영상 ${p.observedVideos}개${p.inProgress?" 진행 중":""}`}>
          <span aria-hidden="true" className="publication-bar" style={{height:Math.max(2,80*p.observedVideos/Math.max(1,...data.points.map(x=>x.observedVideos)))}}/>
          <span>{p.date.slice(5)}</span><strong>{p.observedVideos}</strong>{p.inProgress&&<small>진행 중</small>}
        </button>)}
      </div>
      <h3>{data.selectedDate} 게시 영상 · {videos.page.totalElements}개 관측</h3>
      {videos.content.length===0?<p>선택 날짜에 관측한 게시 영상 없음 · 실제 게시량 0개를 뜻하지 않습니다.</p>:<ul className="publication-videos">{videos.content.map(v=><li key={v.videoId}><a href={"https://www.youtube.com/watch?v="+encodeURIComponent(v.videoId)} target="_blank" rel="noopener noreferrer">{v.title?.trim()||"제목 정보 없음"}</a><small>게시 {time(v.publishedAt)} · 최초 발견 {time(v.firstObservedAt)}</small></li>)}</ul>}
      <nav aria-label="게시 영상 페이지"><button disabled={videos.page.number===0} onClick={()=>setSelection({...active,page:active.page-1})}>이전 영상</button><button disabled={!videos.page.hasNext} onClick={()=>setSelection({...active,page:active.page+1})}>다음 영상</button></nav>
    </>}
  </section>;
}

import {useEffect,useMemo,useRef,useState,type FormEvent,type ChangeEvent} from "react";
import {searchPublicYoutubeVideos,type PublicSearchResult} from "../../features/trend/youtubeSearchClient";
import {collectPublicVideoComments,type CollectedCommentSample} from "../../features/trend/youtubeCommentClient";
import {compareVideoCommentSamples} from "../../features/trend/videoCommentComparison";
import {addRelatedExpression,analyzeExpandedKeyword,expressionExamples} from "../../features/trend/relatedKeywordAnalysis";
import {
  importKeywordCsv,inspectKeyword,userKeyword,MAX_CSV_BYTES,
  type Observation,type TrendWindow,
} from "../../features/trend/userKeywordTrend";
import "./KeywordTrendExplorerPage.css";

function readLocal(file:File):Promise<string>{
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>typeof reader.result==="string"
      ?resolve(reader.result):reject(new Error("text"));
    reader.onerror=()=>reject(new Error("read"));
    reader.readAsText(file,"UTF-8");
  });
}

/** G2-K: user queries are literal and local data is selected, never uploaded. */
export function KeywordTrendExplorerPage(){
  const [draft,setDraft]=useState("");
  const [keyword,setKeyword]=useState("");
  const [period,setPeriod]=useState<TrendWindow>(30);
  const [records,setRecords]=useState<readonly Observation[]>([]);
  const [fileName,setFileName]=useState("");
  const [notice,setNotice]=useState("");
  const reading=useRef(0);
  const searchVersion=useRef(0);
  const searchAbort=useRef<AbortController|null>(null);
  const [liveOrder,setLiveOrder]=useState<"relevance"|"date">("relevance");
  const [liveBusy,setLiveBusy]=useState(false);
  const [liveResult,setLiveResult]=useState<PublicSearchResult|null>(null);
  const [samples,setSamples]=useState<readonly CollectedCommentSample[]>([]);
  const [source,setSource]=useState<"CSV"|"YOUTUBE">("CSV");
  const [relatedDraft,setRelatedDraft]=useState("");
  const [selectedRelated,setSelectedRelated]=useState<readonly string[]>([]);
  const [relatedFeedback,setRelatedFeedback]=useState("");
  const [viewMode,setViewMode]=useState<"EXACT"|"EXPANDED">("EXACT");
  const [commentBusy,setCommentBusy]=useState<string|null>(null);
  const [commentError,setCommentError]=useState("");
  const commentVersion=useRef(0);
  const commentAbort=useRef<AbortController|null>(null);
  useEffect(()=>()=>{searchAbort.current?.abort();commentAbort.current?.abort();},[]);
  const activeRecords=useMemo(()=>source==="YOUTUBE"
    ?samples.flatMap(sample=>sample.comments):records,[source,samples,records]);
  const result=useMemo(()=>keyword?inspectKeyword(keyword,activeRecords,period):null,
    [keyword,activeRecords,period]);
  const videoComparisons=result?.kind==="READY"&&source==="YOUTUBE"
    ?compareVideoCommentSamples(keyword,samples,result.startDay,result.endDay):[];
  const expanded=useMemo(
    ()=>keyword&&selectedRelated.length
      ?analyzeExpandedKeyword(keyword,activeRecords,period,selectedRelated):null,
    [keyword,activeRecords,period,selectedRelated],
  );
  // Switching to expanded mode is a separate opt-in from selecting expressions.
  const expandedSelection=viewMode==="EXPANDED"&&selectedRelated.length>0&&expanded?.kind==="READY"
    ?expanded:null;
  const displayedDays=expandedSelection
    ?expandedSelection.daily.map(day=>({day:day.day,observed:day.observed,matched:day.combined}))
    :result?.kind==="READY"?result.days:[];
  const displayedVideos=expandedSelection
    ?expandedSelection.videos.map(item=>({id:item.id,label:item.label,count:item.combined}))
    :result?.kind==="READY"?result.videos:[];
  const displayedChannels=expandedSelection
    ?expandedSelection.channels.map(item=>({id:item.id,label:item.label,count:item.combined}))
    :result?.kind==="READY"?result.channels:[];
  const displayedEvidence=expandedSelection
    ?expandedSelection.evidence
    :result?.kind==="READY"
      ?result.evidence.map(record=>({record,matchType:"PRIMARY" as const,matchedRelatedTerms:[] as string[]}))
      :[];
  const displayedComparison=videoComparisons.map(video=>{
    if(!expandedSelection)return video;
    const count=expandedSelection.videos.find(item=>item.id===video.videoId)?.combined??0;
    return {...video,keywordMatches:count,matchPercent:video.periodTotal
      ?Number((count/video.periodTotal*100).toFixed(1)):null};
  });
  const max=Math.max(1,...displayedDays.map(x=>x.matched));

  function applyKeyword(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const term=userKeyword(draft);
    if(!term){setNotice("1~100자 이내의 키워드나 문구를 입력하세요.");return;}
    searchVersion.current++;
    searchAbort.current?.abort();
    setLiveBusy(false);
    setLiveResult(null);
    ++commentVersion.current;
    commentAbort.current?.abort();
    setCommentBusy(null);
    setCommentError("");
    setSamples([]);
    setSource("CSV");
    setKeyword(term);
    setRelatedDraft("");
    setSelectedRelated([]);
    setRelatedFeedback("");
    setViewMode("EXACT");
    setNotice("사용자가 입력한 문구 그대로 탐색합니다. 관련 표현은 사용자가 따로 선택한 경우에만 분석에 포함됩니다.");
  }
  async function loadFile(event:ChangeEvent<HTMLInputElement>){
    const file=event.currentTarget.files?.[0];
    event.currentTarget.value="";
    if(!file)return;
    const seq=++reading.current;
    if(!/\.csv$/i.test(file.name)||file.size===0||file.size>MAX_CSV_BYTES){
      setNotice("2MiB 이하의 CSV 파일만 선택하세요. 기존 자료는 유지됩니다.");return;
    }
    try{
      const parsed=importKeywordCsv(await readLocal(file));
      if(seq!==reading.current)return;
      if(parsed.kind==="INVALID"){setNotice(parsed.reason+" 기존 자료는 유지됩니다.");return;}
      setRecords(parsed.observations);
      setFileName(file.name);
      setSource("CSV");
      setNotice("관측 댓글 "+parsed.observations.length+"개를 로컬로 읽었습니다. 원본 진위는 별도 확인이 필요합니다.");
    }catch{
      if(seq===reading.current)setNotice("CSV를 읽지 못했습니다. 기존 자료는 유지됩니다.");
    }
  }
  async function discoverPublicVideos(){
    if(!keyword||liveBusy)return;
    const id=++searchVersion.current;
    searchAbort.current?.abort();
    const controller=new AbortController();
    searchAbort.current=controller;
    setLiveBusy(true);
    setLiveResult(null);
    ++commentVersion.current;
    commentAbort.current?.abort();
    setCommentBusy(null);
    setCommentError("");
    setSamples([]);
    setSource("CSV");
    const next=await searchPublicYoutubeVideos(keyword,liveOrder,controller.signal);
    if(id!==searchVersion.current)return;
    setLiveBusy(false);
    setLiveResult(next);
  }
  async function collectComments(videoId:string){
    if(!keyword||commentBusy||liveBusy||liveResult?.kind!=="READY"||
       !liveResult.videos.some(video=>video.videoId===videoId)||
       (samples.length>=3&&!samples.some(sample=>sample.videoId===videoId)))return;
    const seq=++commentVersion.current;
    commentAbort.current?.abort();
    const controller=new AbortController();
    commentAbort.current=controller;
    setCommentBusy(videoId);
    setCommentError("");
    const response=await collectPublicVideoComments(videoId,keyword,controller.signal);
    if(seq!==commentVersion.current)return;
    setCommentBusy(null);
    if(response.kind==="ERROR"){
      setCommentError(response.message);
      return;
    }
    setSamples(previous=>{
      const without=previous.filter(sample=>sample.videoId!==videoId);
      return [...without,response.sample];
    });
    setSource("YOUTUBE");
  }
  function chooseRelatedExpression(input:string){
    const selection=addRelatedExpression(keyword,selectedRelated,input);
    if(selection.kind==="INVALID"){
      setRelatedFeedback(selection.message);
      return;
    }
    setSelectedRelated(selection.terms);
    setRelatedDraft("");
    setRelatedFeedback("관련 표현을 선택했습니다. 원래 문구 분석은 변경되지 않습니다.");
  }
  function removeRelatedExpression(value:string){
    const remaining=selectedRelated.filter(item=>item!==value);
    setSelectedRelated(remaining);
    if(!remaining.length)setViewMode("EXACT");
    setRelatedFeedback("선택한 관련 표현을 제외했습니다.");
  }
  function clearRecords(){
    ++reading.current;setRecords([]);setFileName("");
    setNotice("현재 세션의 로컬 CSV만 비웠습니다. 원본 파일은 변경하지 않았습니다.");
  }
  function clearComments(){
    ++commentVersion.current;
    commentAbort.current?.abort();
    setCommentBusy(null);
    setCommentError("");
    setSamples([]);
    setSource("CSV");
  }

  return <div className="product-screen keyword-trend">
    <header className="product-heading">
      <p className="keyword-trend__eyebrow">YOUTOPIA · KEYWORD FIRST</p>
      <h1>키워드 트렌드 탐색</h1>
      <p>궁금한 주제를 직접 입력하여 영상·채널·댓글에서 관측된 반응을 살펴봅니다.</p>
    </header>
    <section className="keyword-trend__hero" aria-label="키워드 직접 입력">
      <form onSubmit={applyKeyword}>
        <label htmlFor="user-trend-keyword">어떤 키워드가 궁금한가요?</label>
        <div className="keyword-trend__search">
          <input id="user-trend-keyword" value={draft} maxLength={100}
            onChange={e=>setDraft(e.currentTarget.value)}
            placeholder="검색할 키워드 또는 문구를 입력하세요"/>
          <button type="submit">키워드 적용</button>
        </div>
      </form>
      <p>초기 키워드 목록 없음 · 검색어 자동 확장 없음 · 이용자가 직접 탐색 대상 결정</p>
    </section>
    {keyword&&<section className="keyword-trend__expressions" aria-label="사용자 선택형 관련 표현">
      <h2>관련 표현 탐색 <small>선택 사항</small></h2>
      <p>입력 키워드 “{keyword}”는 그대로 유지합니다. 관련 표현은 사용자가 선택하거나 직접 추가한 문구만
        별도 집계합니다. 아래 참고 후보는 사전 예시이며 의미상 동일하다고 검증한 결과가 아닙니다.</p>
      {expressionExamples(keyword).length>0&&<div className="keyword-trend__expression-examples">
        <strong>참고 표현 후보 (자동 적용 안 함)</strong>
        <div>{expressionExamples(keyword).map(term=><button
          key={term} type="button" aria-label={term+" 후보 선택"}
          disabled={selectedRelated.includes(term)}
          onClick={()=>chooseRelatedExpression(term)}>{term} 추가</button>)}</div>
      </div>}
      <form onSubmit={event=>{
        event.preventDefault();
        chooseRelatedExpression(relatedDraft);
      }} className="keyword-trend__expression-form">
        <label htmlFor="user-related-expression">관련 표현 직접 추가</label>
        <div>
          <input id="user-related-expression" maxLength={40} value={relatedDraft}
            placeholder="원하는 표현을 직접 입력 (최대 5개)"
            onChange={event=>setRelatedDraft(event.currentTarget.value)}/>
          <button type="submit">관련 표현 추가</button>
        </div>
      </form>
      {selectedRelated.length>0&&<div className="keyword-trend__selected-expressions">
        <strong>사용자가 승인한 표현 {selectedRelated.length}/5</strong>
        <div>{selectedRelated.map(term=><span key={term}>
          {term}<button type="button" aria-label={term+" 선택 해제"}
            onClick={()=>removeRelatedExpression(term)}>제외</button>
        </span>)}</div>
      </div>}
      <div className="keyword-trend__view-modes" role="group" aria-label="키워드 분석 보기">
        <button type="button" aria-pressed={viewMode==="EXACT"}
          onClick={()=>setViewMode("EXACT")}>원래 키워드만</button>
        <button type="button" aria-pressed={viewMode==="EXPANDED"}
          disabled={!selectedRelated.length} onClick={()=>setViewMode("EXPANDED")}>
          선택한 관련 표현 포함
        </button>
      </div>
      {relatedFeedback&&<p className="keyword-trend__related-feedback" role="status">{relatedFeedback}</p>}
    </section>}
    <section className="keyword-trend__sources" aria-label="자료 및 관측 기간">
      <div>
        <h2>관측 범위</h2>
        <p>키워드 언급 분석은 로컬 CSV 또는 사용자가 선택한 영상에서 가져온 YouTube 최상위 댓글 표본을 지원합니다. 두 자료는 분리되며, 전체 댓글이나 시청자 여론을 대표하지 않습니다.</p>
      </div>
      <label className="keyword-trend__upload">로컬 CSV 불러오기
        <input type="file" accept=".csv,text/csv" aria-label="키워드 관측 CSV"
          onChange={e=>{void loadFile(e);}}/>
      </label>
      <label className="keyword-trend__period">관측 기간
        <select aria-label="관측 기간" value={period}
          onChange={e=>setPeriod(Number(e.currentTarget.value) as TrendWindow)}>
          <option value={7}>기록 기준 7일</option>
          <option value={30}>기록 기준 30일</option>
          <option value={90}>기록 기준 90일</option>
        </select>
      </label>
      <label className="keyword-trend__period">댓글 분석 출처
        <select aria-label="댓글 분석 출처" value={source}
          onChange={e=>setSource(e.currentTarget.value as "CSV"|"YOUTUBE")}>
          <option value="CSV">로컬 CSV</option>
          <option value="YOUTUBE" disabled={!samples.length}>YouTube 최신 댓글 표본</option>
        </select>
      </label>
      {fileName&&<button type="button" className="keyword-trend__clear"
        onClick={clearRecords}>자료 비우기</button>}
      {samples.length>0&&<button type="button" className="keyword-trend__clear"
        onClick={clearComments}>댓글 표본 비우기</button>}
    </section>
    <section className="keyword-trend__live" aria-label="실제 YouTube 영상 검색">
      <div className="keyword-trend__live-header">
        <div>
          <h2>실제 YouTube 영상 후보</h2>
          <p>선택한 키워드로 YouTube의 공개 영상 제목·채널·게시일을 찾습니다. 사용자 버튼을 누를 때만 별도 로컬 서버에서 요청합니다.</p>
        </div>
        <div className="keyword-trend__live-actions">
          <label>정렬
            <select aria-label="YouTube 검색 정렬" value={liveOrder}
              onChange={e=>setLiveOrder(e.currentTarget.value as "relevance"|"date")}>
              <option value="relevance">관련도순</option>
              <option value="date">게시일순</option>
            </select>
          </label>
          <button type="button" disabled={!keyword||liveBusy}
            onClick={()=>{void discoverPublicVideos();}}>
            {liveBusy?"검색 중":"YouTube 영상 검색"}
          </button>
        </div>
      </div>
      {!keyword?<p className="keyword-trend__live-note">먼저 검색어를 직접 입력하고 적용하세요.</p>
      :liveBusy?<p className="keyword-trend__live-note" role="status">공개 영상 후보를 요청하고 있습니다.</p>
      :liveResult?.kind==="ERROR"?
        <p className="keyword-trend__live-error" role="alert">{liveResult.message}</p>
      :liveResult?.kind==="READY"?
        <div className="keyword-trend__live-results">
          <p>{liveResult.videos.length}개 공개 영상 후보 · 조회 시각 {liveResult.fetchedAt} ·
          첫 페이지 최대 10개. 이 목록은 인기 순위나 댓글 반응 분석 결과가 아닙니다.</p>
          {commentError&&<p className="keyword-trend__live-error" role="alert">{commentError}</p>}
          {liveResult.videos.length?
            <ol>{liveResult.videos.map(video=>
              <li key={video.videoId}>
                <a href={video.videoUrl} target="_blank" rel="noopener noreferrer">
                  {video.thumbnailUrl&&<img src={video.thumbnailUrl}
                    alt="" loading="lazy" referrerPolicy="no-referrer"/>}
                  <span><strong>{video.title||"제목 없음"}</strong>
                    <small>{video.channelTitle||"채널 정보 없음"} · {video.publishedAt||"게시일 미확인"}</small>
                  </span>
                </a>
                <div className="keyword-trend__comment-action">
                  <button type="button"
                    aria-label={video.title+" 댓글 표본 가져오기"}
                    disabled={Boolean(commentBusy)||liveBusy||
                      (samples.length>=3&&!samples.some(item=>item.videoId===video.videoId))}
                    onClick={()=>{void collectComments(video.videoId);}}>
                    {commentBusy===video.videoId?"댓글 조회 중":
                      samples.some(item=>item.videoId===video.videoId)
                        ?"댓글 표본 새로 조회":"최신 댓글 표본 가져오기"}
                  </button>
                  <small>{samples.find(item=>item.videoId===video.videoId)
                    ?samples.find(item=>item.videoId===video.videoId)?.sampledCount+"개 최상위 댓글 수집"
                    :"영상당 첫 페이지 최대 100개 · 최대 3개 영상"}</small>
                </div>
              </li>
            )}</ol>:<p>해당 검색에서 반환된 공개 영상이 없습니다.</p>}
        </div>
      :<p className="keyword-trend__live-note">아직 YouTube API 요청을 실행하지 않았습니다. 로컬 검색 서버와 키가 설정된 경우에만 동작합니다.</p>}
      {samples.length>0&&<p className="keyword-trend__live-note">
        {samples.length}개 영상의 최상위 댓글 첫 페이지를 가져왔습니다.
        검색 결과가 바뀌면 기존 API 댓글 표본도 초기화됩니다. 답글·전체 댓글은 포함하지 않습니다.
      </p>}
    </section>
    {notice&&<p className="keyword-trend__notice" role="status">{notice}</p>}
    {!keyword?(
      <section className="keyword-trend__empty" role="status">
        <h2>사용자 검색어에서 시작합니다</h2>
        <p>초기 추천 키워드나 가상의 급상승 순위를 표시하지 않습니다.</p>
      </section>
    ):result?.kind==="NO_DATA"?(
      <section className="keyword-trend__empty" role="status">
        <h2>“{keyword}” 관측 자료 없음</h2>
        <p>{source==="CSV"
          ?"로컬 CSV를 선택하거나 검색된 영상의 댓글 표본을 가져오면 근거를 탐색할 수 있습니다."
          :"현재 가져온 영상에서는 유효한 최신 최상위 댓글 표본이 없습니다."}</p>
      </section>
    ):result?.kind==="READY"?(
      <div className="keyword-trend__results" aria-label="키워드 관측 결과">
        <div className="keyword-trend__heading">
          <div>
            <p className="keyword-trend__eyebrow">USER QUERY · LOCAL SAMPLE</p>
            <h2>“{result.keyword}” 관측 결과</h2>
            <p>{result.startDay} ~ {result.endDay} · 기록의 마지막 UTC 게시 날짜 기준</p>
          </div>
          <small>{source==="CSV"?fileName+" · 로컬 CSV":
            samples.length+"개 영상 · YouTube Data API · 첫 페이지 최상위 댓글 표본"}</small>
        </div>
        <div className="keyword-trend__metrics">
          <article><span>표본 댓글</span><strong>{result.total.toLocaleString()}개</strong></article>
          <article><span>원래 문구 일치</span><strong>{result.matches.toLocaleString()}개</strong></article>
          <article><span>원래 문구 언급 비중</span><strong>{result.total
            ?(result.matches/result.total*100).toFixed(1)+"%":"산출 불가"}</strong></article>
        </div>
        {expanded?.kind==="READY"&&selectedRelated.length>0&&<section
          className="keyword-trend__panel keyword-trend__expanded-summary" aria-label="선택 표현 확장 집계">
          <h3>원래 문구와 선택 표현 비교</h3>
          <p>사용자가 선택한 관련 표현만 추가했습니다. 같은 댓글이 두 표현과 일치하더라도
            합계에는 한 번만 포함합니다. 표현별 일치 건수에는 중복 댓글이 포함될 수 있습니다.</p>
          <div className="keyword-trend__expanded-stats">
            <div><span>원래 문구</span><strong>{expanded.primaryCount}개</strong></div>
            <div><span>관련 표현만</span><strong>{expanded.relatedOnlyCount}개</strong></div>
            <div><span>중복 제외 합계</span><strong>{expanded.combinedCount}개</strong></div>
          </div>
          <ul>{expanded.terms.map(item=><li key={item.term}>
            <span>{item.term}</span><strong>{item.matched}개 (중복 가능)</strong>
          </li>)}</ul>
        </section>}
        {source==="YOUTUBE"&&<section className="keyword-trend__panel" aria-label="영상별 키워드 표본 비교">
          <h3>영상별 {expandedSelection?"선택 표현 포함":"원래 문구"} 언급 비중</h3>
          <p>분모는 해당 영상에서 가져온 첫 페이지 최상위 댓글 중 표시 기간에 해당하는 댓글입니다.
            각 영상의 전체 댓글이나 시청자 여론을 대표하지 않습니다.</p>
          <ol>{displayedComparison.map(video=><li key={video.videoId}>
            <span>{video.videoTitle}</span>
            <strong>{video.keywordMatches}/{video.periodTotal}개 ·
              {video.matchPercent===null?"산출 불가":video.matchPercent+"%"}</strong>
            <small>총 가져온 댓글 {video.sampledTotal}개 ·
              {video.hasMore?"추가 페이지 존재":"추가 페이지 미표시"} ·
              조회 {video.fetchedAt}</small>
          </li>)}</ol>
        </section>}
        <section className="keyword-trend__panel">
          <h3>관측 날짜별 {expandedSelection?"선택 표현 포함":"원래 문구"} 언급 분포</h3>
          <p>자료가 없는 날짜는 실제 언급 0건이 아니라 미관측일 수 있습니다.
            {source==="YOUTUBE"?" 최신 100개 상한의 편향된 표본으로 전 기간의 추세를 검증할 수 없습니다.":""}</p>
          <div className="keyword-trend__bars" role="list" aria-label="날짜별 관측 분포">
            {displayedDays.map(day=><div key={day.day} role="listitem"
              className="keyword-trend__bar-holder"
              aria-label={day.day+": 표본 "+day.observed+"건 중 언급 "+day.matched+"건"}
              title={day.day+" · 일치 "+day.matched+" / 표본 "+day.observed}>
              {day.matched>0&&<div className="keyword-trend__bar"
                style={{height:(day.matched/max*100)+"%"}}/>}
            </div>)}
          </div>
          <div className="keyword-trend__axis"><span>{result.startDay}</span><span>{result.endDay}</span></div>
        </section>
        <div className="keyword-trend__columns">
          <section className="keyword-trend__panel">
            <h3>{expandedSelection?"원래 문구 또는 선택 표현이 관측된 영상":"입력 문구가 관측된 영상"}</h3>
            {displayedVideos.length?<ol>{displayedVideos.map(x=><li key={x.id}>
              <span>{x.label}</span><strong>{x.count}건</strong></li>)}</ol>
              :<p>{expandedSelection
                ?"현재 표본에서 선택한 표현과 일치하는 댓글이 없습니다."
                :"현재 표본에서 입력 문구와 일치하는 댓글이 없습니다."}</p>}
          </section>
          <section className="keyword-trend__panel">
            <h3>{expandedSelection?"원래 문구 또는 선택 표현이 관측된 채널":"입력 문구가 관측된 채널"}</h3>
            {displayedChannels.length?<ol>{displayedChannels.map(x=><li key={x.id}>
              <span>{x.label}</span><strong>{x.count}건</strong></li>)}</ol>
              :<p>{expandedSelection
                ?"현재 표본에서 선택한 표현과 일치하는 댓글이 없습니다."
                :"현재 표본에서 입력 문구와 일치하는 댓글이 없습니다."}</p>}
          </section>
        </div>
        <section className="keyword-trend__panel">
          <h3>{expandedSelection?"선택 표현 포함 댓글 근거":"일치 댓글 근거"} <small>최신 최대 20건</small></h3>
          {displayedEvidence.length?<ol className="keyword-trend__evidence">
            {displayedEvidence.map(item=><li key={item.record.id}>
              <div><strong>{item.record.videoTitle}</strong>
                <time>{item.record.publishedAt}</time></div>
              <p>{item.record.text}</p>
              {expandedSelection&&<strong className="keyword-trend__evidence-match">
                {item.matchType==="PRIMARY"?"원래 키워드 일치":
                  "선택 표현만 일치: "+item.matchedRelatedTerms.join(", ")}
              </strong>}
              <small>{item.record.channelName} ·
                {source==="CSV"?"CSV 기록 ID":"YouTube 댓글 ID"} {item.record.id}</small>
            </li>)}</ol>:<p>표본에서 일치하는 댓글 근거가 없습니다.</p>
        </section>
      </div>
    ):null}
    <footer className="keyword-trend__disclosure">
      로컬 CSV와 공식 YouTube API의 최상위 댓글 첫 페이지는 서로 구분하여 표시하고 합산하지 않습니다.
      댓글 표본은 최대 3개 영상의 최근 100개 이내 공개 최상위 댓글만 포함하며 답글·전체 댓글 수집을 하지 않습니다.
      YouTube 검색과 댓글 조회는 사용자 버튼 클릭 시에만 수행합니다. API 키는 브라우저로 보내지 않습니다.
      영상 다운로드·외부 AI 분석·서버 영구 저장은 없으며, 관측 언급량은 실제 상승·확산·감성이나 여론을 증명하지 않습니다.
      관련 표현 후보는 선택 가능한 참고 예시일 뿐 AI 의미 분석이나 동의어 검증 결과가 아닙니다.
      원래 키워드와 사용자가 추가한 표현의 일치 수는 분리하고, 중복 댓글은 합계에서 제외합니다.
      검색어·관련 표현 선택·CSV·API 댓글 표본은 새로고침 시 초기화됩니다.
    </footer>
  </div>;
}

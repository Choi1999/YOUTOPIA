import {useMemo,useRef,useState,type FormEvent,type ChangeEvent} from "react";
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
  const result=useMemo(()=>keyword?inspectKeyword(keyword,records,period):null,
    [keyword,records,period]);
  const max=result?.kind==="READY"
    ?Math.max(1,...result.days.map(x=>x.matched)):1;

  function applyKeyword(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const term=userKeyword(draft);
    if(!term){setNotice("1~100자 이내의 키워드나 문구를 입력하세요.");return;}
    setKeyword(term);
    setNotice("사용자가 입력한 문구 그대로 탐색합니다. 추천 키워드나 자동 확장은 적용하지 않습니다.");
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
      setNotice("관측 댓글 "+parsed.observations.length+"개를 로컬로 읽었습니다. 원본 진위는 별도 확인이 필요합니다.");
    }catch{
      if(seq===reading.current)setNotice("CSV를 읽지 못했습니다. 기존 자료는 유지됩니다.");
    }
  }
  function clearRecords(){
    ++reading.current;setRecords([]);setFileName("");
    setNotice("현재 세션의 관측 자료만 비웠습니다. 원본 파일은 변경하지 않았습니다.");
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
    <section className="keyword-trend__sources" aria-label="자료 및 관측 기간">
      <div>
        <h2>관측 범위</h2>
        <p>현재는 직접 선택한 CSV 표본만 분석합니다. 실시간 YouTube 검색과 전체 트렌드 추정은 실행하지 않습니다.</p>
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
      {fileName&&<button type="button" className="keyword-trend__clear"
        onClick={clearRecords}>자료 비우기</button>}
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
        <p>키워드는 적용되었습니다. 로컬 CSV를 선택하면 해당 표본의 댓글 근거를 탐색합니다.</p>
      </section>
    ):result?.kind==="READY"?(
      <div className="keyword-trend__results" aria-label="키워드 관측 결과">
        <div className="keyword-trend__heading">
          <div>
            <p className="keyword-trend__eyebrow">USER QUERY · LOCAL SAMPLE</p>
            <h2>“{result.keyword}” 관측 결과</h2>
            <p>{result.startDay} ~ {result.endDay} · 기록의 마지막 UTC 게시 날짜 기준</p>
          </div>
          <small>{fileName} · 로컬 파일</small>
        </div>
        <div className="keyword-trend__metrics">
          <article><span>표본 댓글</span><strong>{result.total.toLocaleString()}개</strong></article>
          <article><span>문구 일치</span><strong>{result.matches.toLocaleString()}개</strong></article>
          <article><span>표본 내 언급 비중</span><strong>{result.total
            ?(result.matches/result.total*100).toFixed(1)+"%":"산출 불가"}</strong></article>
        </div>
        <section className="keyword-trend__panel">
          <h3>관측 날짜별 언급 분포</h3>
          <p>자료가 없는 날짜는 실제 언급 0건이 아니라 미관측일 수 있습니다.</p>
          <div className="keyword-trend__bars" role="list" aria-label="날짜별 관측 분포">
            {result.days.map(day=><div key={day.day} role="listitem"
              className="keyword-trend__bar-holder"
              aria-label={day.day+": 표본 "+day.observed+"건 중 언급 "+day.matched+"건"}
              title={day.day+" · 일치 "+day.matched+" / 표본 "+day.observed}>
              {day.observed>0&&<div className="keyword-trend__bar"
                style={{height:(day.matched/max*100)+"%"}}/>}
            </div>)}
          </div>
          <div className="keyword-trend__axis"><span>{result.startDay}</span><span>{result.endDay}</span></div>
        </section>
        <div className="keyword-trend__columns">
          <section className="keyword-trend__panel">
            <h3>연관 영상</h3>
            {result.videos.length?<ol>{result.videos.map(x=><li key={x.id}>
              <span>{x.label}</span><strong>{x.count}건</strong></li>)}</ol>
              :<p>해당 키워드가 관측되지 않았습니다.</p>}
          </section>
          <section className="keyword-trend__panel">
            <h3>연관 채널</h3>
            {result.channels.length?<ol>{result.channels.map(x=><li key={x.id}>
              <span>{x.label}</span><strong>{x.count}건</strong></li>)}</ol>
              :<p>해당 키워드가 관측되지 않았습니다.</p>}
          </section>
        </div>
        <section className="keyword-trend__panel">
          <h3>일치 댓글 근거 <small>최신 최대 20건</small></h3>
          {result.evidence.length?<ol className="keyword-trend__evidence">
            {result.evidence.map(x=><li key={x.id}>
              <div><strong>{x.videoTitle}</strong><time>{x.publishedAt}</time></div>
              <p>{x.text}</p>
              <small>{x.channelName} · CSV 기록 ID {x.id}</small>
            </li>)}</ol>:<p>표본에서 일치하는 댓글 근거가 없습니다.</p>}
        </section>
      </div>
    ):null}
    <footer className="keyword-trend__disclosure">
      이 화면은 사용자 CSV 표본의 언급만 계산합니다. 외부 YouTube 검색·API·모델 호출·업로드·영구 저장은 없습니다.
      댓글의 진위와 표본 대표성, 실제 관심도, 상승·확산·인과관계는 검증되지 않았으며
      검색어와 자료는 새로고침 시 사라집니다.
    </footer>
  </div>;
}

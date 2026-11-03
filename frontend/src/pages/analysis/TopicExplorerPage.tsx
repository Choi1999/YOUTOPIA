import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { createAnalysisTarget } from "../../features/analysis-target/analysisTarget";
import { demoChannelSelections } from "../../features/analysis/data/demoChannelSelection";
import { useAnalysisRepository } from "../../features/analysis/data/AnalysisRepositoryContext";
import { readDemoChannelAggregate } from "../../features/analysis/data/readDemoChannelAggregate";
import { exploreRegisteredTopic, type TopicExplorerResult } from "../../features/analysis/model/topicExplorer";
import "./channel-comparison.css";

type Request = Readonly<{topicId:string; channelIds:readonly string[]}>;

function parseTopicQuery(search: URLSearchParams): Request | null {
  const entries=[...search.entries()];
  if (entries.length===0) return {
    topicId:"RECIPE",channelIds:[demoChannelSelections[0].channelId],
  };
  const topics=search.getAll("topic");
  const ids=search.getAll("channel");
  // Preserve partially entered topic/channel controls as URL-backed drafts.
  // Missing fields never authorize data reads, but remain editable.
  // Unknown fields, duplicate nonempty channels and malformed IDs fail closed.
  if (topics.length!==1 || ids.length>2 ||
      entries.length!==topics.length+ids.length ||
      entries.some(([key])=>key!=="topic"&&key!=="channel") ||
      (topics[0]!=="" && !/^[A-Z0-9_]{1,64}$/.test(topics[0])) ||
      (ids.length===2 && ids[0]!=="" && ids[0]===ids[1]) ||
      !ids.every(id=>id==="" || createAnalysisTarget("CHANNEL",id)!==null))
    return null;
  return {topicId:topics[0],channelIds:ids.length ? ids : [""]};
}

export function TopicExplorerPage() {
  const repository=useAnalysisRepository();
  const [params,setParams]=useSearchParams();
  const request=parseTopicQuery(new URLSearchParams(params.toString()));
  const topicId=request?.topicId ?? "";
  const firstChannel=request?.channelIds[0] ?? "";
  const secondChannel=request?.channelIds[1] ?? "";
  const hasSelection=Boolean(topicId && firstChannel &&
    firstChannel !== secondChannel);
  const ids=hasSelection
    ? [firstChannel,...(secondChannel ? [secondChannel] : [])].join(",")
    : "";
  const requestKey=hasSelection ? topicId + "|" + ids : null;
  // Key resolved results to the exact URL selection: never show stale evidence
  // while another topic/channel is still being chosen.
  const [resolved,setResolved]=useState<
    {key:string; value:TopicExplorerResult}|null
  >(null);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    let cancelled=false;
    setResolved(null);
    setLoading(Boolean(requestKey));
    if (!requestKey) return;
    void Promise.all(ids.split(",").map(id=>
      readDemoChannelAggregate(repository,id)
    )).then(aggregates=>{
      if (cancelled) return;
      setResolved({key:requestKey,
        value:exploreRegisteredTopic(topicId,aggregates)});
      setLoading(false);
    });
    return ()=>{cancelled=true;};
  },[repository,topicId,ids,requestKey]);

  const result=resolved?.key===requestKey ? resolved.value : null;
  const ready=hasSelection&&result?.kind==="READY"?result:null;
  const waiting=Boolean(requestKey && (loading || !result));
  const available = ready ? [ready.topicId] : [];
  const opts=["RECIPE","PRICE","DELIVERY","QUALITY",...available];
  const options=[...new Set(opts)].sort();

  function updateDraft(nextTopic:string, channels:readonly string[]) {
    const next=new URLSearchParams();
    next.append("topic",nextTopic);
    next.append("channel",channels[0]??"");
    if (channels[1]) next.append("channel",channels[1]);
    setParams(next);
  }

  function pickTopic(nextTopic:string) {
    updateDraft(nextTopic,[firstChannel,secondChannel]);
  }

  function pickChannel(index:0|1, value:string) {
    const next:[string,string]=[firstChannel,secondChannel];
    if (value && next[1-index]===value) return;
    next[index]=value;
    updateDraft(topicId,next);
  }

  return (
    <div className="product-screen topic-explorer">
      <header className="product-heading">
        <div className="topic-explorer__eyebrow">YOUTOPIA · SYNTHETIC TOPIC EXPLORER</div>
        <h1>주제별 심층 탐색</h1>
        <p>선정 영상 집합의 합성 주제 언급 건수와 영상별 기여도만 제공합니다.
          댓글 원문·주제별 감성·시간 추이·실제 채널 전체 반응은 생성하지 않습니다.</p>
      </header>
      <section className="topic-explorer__panel">
        <nav className="topic-explorer__links" aria-label="주제 탐색 이동">
          <Link to="/analysis/youtube/channels/compare">
            채널 비교 화면
          </Link>
          {request?.channelIds.filter(Boolean).map(id=>(
            <Link key={id} to={"/analysis/youtube/channel/"+id}>채널 {id} 상세</Link>
          ))}
        </nav>
        <div className="topic-explorer__filters">
          <label htmlFor="topic-explorer-topic">주제 ID
            <select id="topic-explorer-topic" value={topicId}
              onChange={e=>pickTopic(e.target.value)}>
              <option value="">주제를 선택하세요</option>
              {topicId && !options.includes(topicId) &&
                <option value={topicId}>{topicId} (등록 확인 필요)</option>}
              {options.map(id=><option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          {([0,1] as const).map(index=>(
            <label key={index} htmlFor={"topic-explorer-channel-"+index}>
              채널 {index===0?"A":"B (선택 사항)"}
              <select id={"topic-explorer-channel-"+index}
                value={index===0?firstChannel:secondChannel}
                onChange={e=>pickChannel(index,e.target.value)}>
                <option value="">{index===0?"채널을 선택하세요":"추가 채널 없음"}</option>
                {(index===0?firstChannel:secondChannel) &&
                  !demoChannelSelections.some(c=>c.channelId===
                    (index===0?firstChannel:secondChannel)) && (
                    <option value={index===0?firstChannel:secondChannel}>
                      미등록 채널: {index===0?firstChannel:secondChannel}
                    </option>
                  )}
                {demoChannelSelections.map(c=>(
                  <option key={c.channelId} value={c.channelId}
                    disabled={c.channelId===(index===0?secondChannel:firstChannel)}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {!request ? (
          <p role="alert" className="topic-explorer__blocked">
            주제 1개와 유효한 채널 1~2개만 지정할 수 있습니다.
            잘못된 URL에서 임의 예시 분석을 표시하지 않습니다.
          </p>
        ) : !hasSelection ? (
          <p role="status" className="topic-explorer__blocked">
            주제와 채널 A를 선택하면 등록된 합성 영상의 주제 언급량을 확인할 수 있습니다.
            선택 중에는 미검증 분석 수치를 표시하지 않습니다.
          </p>
        ) : waiting ? (
          <p role="status">선정 채널의 합성 스냅샷과 주제 근거를 확인하고 있습니다.</p>
        ) : !ready ? (
          <p role="status" className="topic-explorer__blocked">
            검증된 주제 집계가 없거나 선정 영상의 자료가 불완전합니다.
            주제별 언급량을 0건으로 위장하지 않습니다.
            {result?.kind==="BLOCKED" && " 제한 사유: "+result.reason}
          </p>
        ) : (
          <>
            <section className="topic-explorer__section"
              aria-labelledby="topic-explorer-result">
              <h2 id="topic-explorer-result">
                주제 {ready.topicId} · 선정 영상별 언급량
              </h2>
              {ready.channels.map((channel,index)=>(
                <article key={channel.channelId} className="topic-explorer__card">
                  <h3>채널 {index===0?"A":"B"} · {channel.mentionCount}건</h3>
                  <p>채널 ID: <code>{channel.channelId}</code></p>
                  <p>선정 영상: {channel.selectedVideoIds.length}개 ·
                    분류 완료 표본: {channel.sampleClassified}건</p>
                  <p>관측 기간: {channel.windowStart} ~ {channel.windowEnd}</p>
                  <p>분류 버전: {channel.taxonomyVersion} · 분석 시각: {channel.analyzedAt}</p>
                  <ul className="topic-explorer__contribution" aria-label={
                    channel.channelId+" 주제별 영상 기여도"}>
                    {channel.perVideo.map(item=>(
                      <li key={item.videoId}>
                        <span>{item.videoId} · {item.mentionCount}건</span>
                        <Link to={"/analysis/youtube/video/"+item.videoId+"?channel="+channel.channelId}>
                          영상 상세 분석
                        </Link>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
              {ready.deltaCount!==null &&
                <p>채널 B − A 주제 언급 차이: {ready.deltaCount>0?"+":""}{ready.deltaCount}건</p>}
            </section>
            <p className="topic-explorer__notice">
              STATIC FIXTURE · 합성 DEMO · 주제는 다중 라벨이며
              이 수치는 실제 채널 소속·댓글 원문·주장 사실 여부·시청자 전체를 대표하지 않습니다.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

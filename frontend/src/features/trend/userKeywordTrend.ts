/** G2-K: Analyze only user-supplied keywords against user-selected local observations. */
export const MAX_CSV_BYTES = 2 * 1024 * 1024;
export type TrendWindow = 7 | 30 | 90;
export type Observation = Readonly<{
  id: string; videoId: string; channelId: string;
  videoTitle: string; channelName: string;
  publishedAt: string; text: string;
}>;
export type CsvResult =
  | Readonly<{kind:"READY"; observations:readonly Observation[]}>
  | Readonly<{kind:"INVALID"; reason:string}>;
export type TrendResult =
  | Readonly<{kind:"NO_DATA" | "INVALID_KEYWORD"}>
  | Readonly<{
    kind:"READY"; keyword:string; startDay:string; endDay:string;
    total:number; matches:number;
    days:readonly Readonly<{day:string; observed:number; matched:number}>[];
    videos:readonly Readonly<{id:string; label:string; count:number}>[];
    channels:readonly Readonly<{id:string; label:string; count:number}>[];
    evidence:readonly Observation[];
  }>;
const DAY_MS = 86400000;
const REQUIRED = ["comment_id","video_id","channel_id","published_at","text"];

function csvRows(input:string):string[][]|null {
  const s=input.replace(/^\uFEFF/,"").replace(/\r\n?/g,"\n");
  const rows:string[][]=[]; let row:string[]=[]; let field="";
  let mode:"plain"|"quoted"|"closed"="plain";
  const pushField=()=>{row.push(field);field="";mode="plain";};
  const pushRow=()=>{
    pushField();
    if(row.some(x=>x.trim()!==""))rows.push(row);
    row=[];
  };
  for(let i=0;i<s.length;i++){
    const ch=s[i];
    if(mode==="quoted"){
      if(ch==='"'&&s[i+1]==='"'){field+='"';i++;}
      else if(ch==='"')mode="closed";
      else field+=ch;
      continue;
    }
    if(ch===","){pushField();continue;}
    if(ch==="\n"){pushRow();if(rows.length>5001)return null;continue;}
    if(mode==="closed")return null;
    if(ch==='"'){
      if(field.length!==0)return null;
      mode="quoted";
    }else field+=ch;
  }
  if(mode==="quoted")return null;
  if(field!==""||row.length>0||mode==="closed")pushRow();
  return rows;
}
const fail=(reason:string):CsvResult=>({kind:"INVALID",reason});

export function importKeywordCsv(input:string):CsvResult {
  if(!input.trim()||input.length>MAX_CSV_BYTES)return fail("CSV 파일이 비어 있거나 너무 큽니다.");
  const rows=csvRows(input);
  if(!rows||rows.length<2||rows.length>5001)return fail("CSV 형식 또는 행 수가 올바르지 않습니다.");
  const keys=rows[0].map(x=>x.trim().toLowerCase());
  if(new Set(keys).size!==keys.length||REQUIRED.some(k=>!keys.includes(k)))
    return fail("필수 열: comment_id, video_id, channel_id, published_at, text");
  const found=new Set<string>();
  const observations:Observation[]=[];
  for(let i=1;i<rows.length;i++){
    const row=rows[i];
    if(row.length!==keys.length)return fail("CSV "+(i+1)+"행의 열 개수가 다릅니다.");
    const get=(k:string)=>{const n=keys.indexOf(k);return n<0?"":row[n].trim();};
    const id=get("comment_id"),videoId=get("video_id"),channelId=get("channel_id");
    const publishedAt=get("published_at"),text=get("text");
    if(!/^[\w-]{1,128}$/.test(id)||!/^[\w-]{1,128}$/.test(videoId)||
       !/^[\w-]{1,128}$/.test(channelId)||found.has(id)||!text||text.length>2000||
       !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(publishedAt)||
       !Number.isFinite(Date.parse(publishedAt)))
      return fail("CSV "+(i+1)+"행의 ID·날짜·텍스트가 잘못되었거나 중복입니다.");
    const videoTitle=get("video_title"),channelName=get("channel_name");
    if(videoTitle.length>300||channelName.length>200)return fail("표시 제목이 너무 깁니다.");
    found.add(id);
    observations.push({id,videoId,channelId,publishedAt,text,
      videoTitle:videoTitle||videoId,channelName:channelName||channelId});
  }
  return {kind:"READY",observations};
}

export function userKeyword(input:string):string|null {
  const s=input.trim().normalize("NFKC").replace(/\s+/g," ");
  return s.length>0&&s.length<=100&&!/[\u0000-\u001f\u007f]/.test(s)?s:null;
}

/** Use latest imported comment's UTC day as anchor; missing days are not true zero. */
export function inspectKeyword(input:string,records:readonly Observation[],window:TrendWindow):TrendResult {
  const keyword=userKeyword(input);
  if(!keyword||![7,30,90].includes(window))return {kind:"INVALID_KEYWORD"};
  if(!records.length)return {kind:"NO_DATA"};
  const maxEpoch=Math.max(...records.map(x=>Date.parse(x.publishedAt)));
  if(!Number.isFinite(maxEpoch))return {kind:"NO_DATA"};
  const endDay=new Date(maxEpoch).toISOString().slice(0,10);
  const endMs=Date.parse(endDay+"T00:00:00Z");
  const startMs=endMs-(window-1)*DAY_MS;
  const inWindow=records.filter(x=>Date.parse(x.publishedAt)>=startMs&&
    Date.parse(x.publishedAt)<endMs+DAY_MS);
  const needle=keyword.toLocaleLowerCase();
  const matched=inWindow.filter(x=>x.text.normalize("NFKC").toLocaleLowerCase().includes(needle));
  const dates=Array.from({length:window},(_,i)=>
    new Date(startMs+i*DAY_MS).toISOString().slice(0,10));
  const days=dates.map(day=>({
    day,observed:inWindow.filter(x=>x.publishedAt.slice(0,10)===day).length,
    matched:matched.filter(x=>new Date(x.publishedAt).toISOString().slice(0,10)===day).length,
  }));
  // Recalculate observed date from UTC for offset-bearing timestamps.
  for(const d of days)d.observed=inWindow.filter(x=>
    new Date(x.publishedAt).toISOString().slice(0,10)===d.day).length;
  const top=(idKey:"videoId"|"channelId",labelKey:"videoTitle"|"channelName")=>{
    const counts=new Map<string,{id:string;label:string;count:number}>();
    for(const x of matched){
      const id=x[idKey],previous=counts.get(id);
      counts.set(id,{id,label:x[labelKey],count:(previous?.count??0)+1});
    }
    return [...counts.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label)).slice(0,8);
  };
  return {kind:"READY",keyword,startDay:dates[0],endDay,
    total:inWindow.length,matches:matched.length,days,
    videos:top("videoId","videoTitle"),channels:top("channelId","channelName"),
    evidence:[...matched].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,20)};
}

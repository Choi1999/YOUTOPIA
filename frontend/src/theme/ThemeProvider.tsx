import{createContext,useContext,useEffect,useMemo,useRef,useState,type ReactNode}from"react";
import{ServiceSessionContext}from"../service/SessionProvider";
import{ApiError,errorText,serviceApi,type Settings,type Theme}from"../service/api";
export type{Theme}from"../service/api";
export const THEME_STORAGE_KEY="yutopia-theme";
type Value={theme:Theme;resolvedTheme:"dark"|"light";setTheme:(theme:Theme)=>void;allowSystem:boolean;pending:boolean;error:string};
const ThemeContext=createContext<Value|null>(null);
function read(service:boolean):Theme{try{const value=localStorage.getItem(THEME_STORAGE_KEY);return value==="dark"||value==="light"||service&&value==="system"?value as Theme:service?"system":"dark";}catch{return service?"system":"dark";}}
function valid(value:Settings){if(!value||!Number.isInteger(value.version)||!["system","light","dark"].includes(value.values?.theme))throw new ApiError(0,"INVALID_RESPONSE");return value;}
export function ThemeProvider({children}:{children:ReactNode}){
 const session=useContext(ServiceSessionContext);const account=session?.identity?.kind==="USER"?session.identity.id:null;const generation=session?.generation??0;
 const[anonymous,setAnonymous]=useState<Theme>(()=>read(Boolean(session)));const[saved,setSaved]=useState<{account:string;generation:number;settings:Settings}|null>(null);
 const[systemDark,setSystemDark]=useState(()=>typeof matchMedia!=="undefined"&&matchMedia("(prefers-color-scheme: dark)").matches);
 const[pending,setPending]=useState(false),[error,setError]=useState("");const scope=useRef({account,generation});scope.current={account,generation};
 const own=saved?.account===account&&saved?.generation===generation?saved.settings:null;
 const theme=account?(own?.values.theme??"system"):anonymous;const resolvedTheme=theme==="system"?(systemDark?"dark":"light"):theme;
 useEffect(()=>{if(typeof matchMedia==="undefined")return;const media=matchMedia("(prefers-color-scheme: dark)");const listener=()=>setSystemDark(media.matches);media.addEventListener("change",listener);return()=>media.removeEventListener("change",listener);},[]);
 useEffect(()=>{document.documentElement.dataset.theme=resolvedTheme;document.documentElement.style.colorScheme=resolvedTheme;},[resolvedTheme]);
 useEffect(()=>{setSaved(null);setError("");setPending(Boolean(account));if(!account){setPending(false);return;}const cancel=new AbortController();serviceApi.settings(account,cancel.signal).then(value=>{if(scope.current.account===account&&scope.current.generation===generation)setSaved({account,generation,settings:valid(value)});}).catch(e=>{if(!cancel.signal.aborted)setError(errorText(e));}).finally(()=>{if(scope.current.account===account&&scope.current.generation===generation)setPending(false);});return()=>cancel.abort();},[account,generation]);
 function setTheme(value:Theme){
  if(!["system","light","dark"].includes(value)||pending)return;
  if(!account){setAnonymous(value);try{localStorage.setItem(THEME_STORAGE_KEY,value);}catch{/* Local preference is optional. */}return;}
  if(!own){setError("서버 설정을 먼저 불러와 주세요.");return;}
  setPending(true);setError("");serviceApi.saveTheme(account,own.version,value).then(result=>{if(scope.current.account===account&&scope.current.generation===generation)setSaved({account,generation,settings:valid(result)});}).catch(async e=>{
   if(scope.current.account!==account||scope.current.generation!==generation)return;setError(errorText(e));
   if(e instanceof ApiError&&e.status===409&&e.code!=="ACCOUNT_CONTEXT_CHANGED")try{const latest=valid(await serviceApi.settings(account));if(scope.current.account===account&&scope.current.generation===generation)setSaved({account,generation,settings:latest});}catch{setSaved(null);}
  }).finally(()=>{if(scope.current.account===account&&scope.current.generation===generation)setPending(false);});
 }
 const value=useMemo(()=>({theme,resolvedTheme,setTheme,allowSystem:Boolean(session),pending,error}),[theme,resolvedTheme,session,pending,error,own]);
 return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useTheme(){const context=useContext(ThemeContext);if(!context)throw new Error("useTheme must be used within ThemeProvider");return context;}

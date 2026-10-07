"use client";

import { createContext,useCallback,useContext,useEffect,useMemo,useRef,useState } from "react";
import { Check,ChevronDown,Globe2 } from "lucide-react";
import { localeEnglishLabels,localeLabels,localeMeta,normalizeLocale,supportedLocales,t as translate,type Locale } from "@/lib/i18n";

type LocaleContextValue={locale:Locale;setLocale:(locale:Locale)=>void;t:(key:string,fallback?:string)=>string};
const LocaleContext=createContext<LocaleContextValue>({locale:"en",setLocale:()=>undefined,t:(key,fallback)=>fallback??key});

export default function LocaleProvider({children}:{children:React.ReactNode}){
 const[locale,setLocaleState]=useState<Locale>("en");
 useEffect(()=>{
  const stored=window.localStorage.getItem("tsid.locale");
  const browser=navigator.languages?.[0]||navigator.language;
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setLocaleState(normalizeLocale(stored||browser));
 },[]);
 const setLocale=useCallback((next:Locale)=>{
  setLocaleState(next);
  window.localStorage.setItem("tsid.locale",next);
  document.cookie=`tsid_locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
 },[]);
 useEffect(()=>{
  const meta=localeMeta[locale];
  document.documentElement.lang=meta.htmlLang;
  document.documentElement.dir=meta.dir;
  document.documentElement.dataset.locale=locale;
 },[locale]);
 const value=useMemo(()=>({locale,setLocale,t:(key:string,fallback?:string)=>translate(locale,key,fallback)}),[locale,setLocale]);
 return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
export function useLocale(){return useContext(LocaleContext)}

export function LanguageSwitcher({compact=false,className="",surface="light"}:{compact?:boolean;className?:string;surface?:"light"|"dark"}){
 const{locale,setLocale,t}=useLocale();
 const[open,setOpen]=useState(false);
 const root=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{
  function onPointer(event:MouseEvent){if(root.current&&!root.current.contains(event.target as Node))setOpen(false)}
  function onKey(event:KeyboardEvent){if(event.key==="Escape")setOpen(false)}
  document.addEventListener("mousedown",onPointer);document.addEventListener("keydown",onKey);
  return()=>{document.removeEventListener("mousedown",onPointer);document.removeEventListener("keydown",onKey)}
 },[]);
 const dark=surface==="dark";
 return <div ref={root} className={`relative ${className}`}>
  <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(v=>!v)} className={`flex min-w-[150px] items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition ${dark?"border-white/12 bg-white/[.08] text-white hover:bg-white/[.12]":"border-slate-200 bg-white text-slate-700 hover:border-emerald-700/30"}`}>
   <Globe2 className={`h-4 w-4 shrink-0 ${dark?"text-[#d8bb79]":"text-emerald-800"}`}/>
   <span className="min-w-0 flex-1"><span className="block truncate">{localeLabels[locale]}</span>{!compact?<span className={`mt-0.5 block truncate text-[9px] font-medium ${dark?"text-white/45":"text-slate-400"}`}>{localeEnglishLabels[locale]}</span>:null}</span>
   <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition ${open?"rotate-180":""} ${dark?"text-white/40":"text-slate-400"}`}/>
  </button>
  {open?<div role="menu" className={`absolute z-[90] mt-2 w-64 overflow-hidden rounded-2xl border p-1.5 shadow-2xl ${dark?"border-white/10 bg-[#0b3a31]":"border-slate-200 bg-white"}`}>
   {!compact?<div className={`px-3 py-2 text-[9px] font-black uppercase tracking-[.14em] ${dark?"text-white/35":"text-slate-400"}`}>{t("studio.language","Product language")}</div>:null}
   {supportedLocales.map(code=><button role="menuitemradio" aria-checked={locale===code} type="button" key={code} onClick={()=>{setLocale(code);setOpen(false)}} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${locale===code?(dark?"bg-white/12 text-white":"bg-emerald-50 text-emerald-950"):(dark?"text-white/75 hover:bg-white/[.07]":"text-slate-700 hover:bg-slate-50")}`}>
    <span className="w-7 text-center text-[10px] font-black uppercase tracking-[.08em] opacity-55">{code}</span>
    <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{localeLabels[code]}</span><span className={`mt-0.5 block text-[10px] ${dark?"text-white/40":"text-slate-400"}`}>{localeEnglishLabels[code]}</span></span>
    {locale===code?<Check className="h-4 w-4 shrink-0 text-emerald-500"/>:null}
   </button>)}
  </div>:null}
 </div>
}

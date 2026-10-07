"use client";

import { createContext,useCallback,useContext,useEffect,useMemo,useState } from "react";
import { localeLabels,localeMeta,normalizeLocale,supportedLocales,t as translate,type Locale } from "@/lib/i18n";

type LocaleContextValue={locale:Locale;setLocale:(locale:Locale)=>void;t:(key:string,fallback?:string)=>string};
const LocaleContext=createContext<LocaleContextValue>({locale:"en",setLocale:()=>undefined,t:(key,fallback)=>fallback??key});

export default function LocaleProvider({children}:{children:React.ReactNode}){
 const[locale,setLocaleState]=useState<Locale>("en");
 useEffect(()=>{
  const stored=window.localStorage.getItem("tsid.locale");
  const browser=navigator.languages?.[0]||navigator.language;
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
export function LanguageSwitcher({compact=false,className=""}:{compact?:boolean;className?:string}){
 const{locale,setLocale,t}=useLocale();
 return <label className={`inline-flex items-center gap-2 ${className}`}>
  {!compact?<span className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">{t("studio.language","Language")}</span>:null}
  <select aria-label={t("studio.language","Product language")} value={locale} onChange={e=>setLocale(e.target.value as Locale)} className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-700/40">
   {supportedLocales.map(code=><option key={code} value={code}>{localeLabels[code]}</option>)}
  </select>
 </label>
}

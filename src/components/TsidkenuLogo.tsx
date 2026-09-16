type Props={surface?:"dark"|"light";compact?:boolean;className?:string};

export default function TsidkenuLogo({surface="dark",compact=false,className=""}:Props){
 const text=surface==="dark"?"#F8F4E8":"#07372D";
 const muted=surface==="dark"?"rgba(255,255,255,.48)":"#718078";
 return <div className={`inline-flex items-center gap-2.5 ${className}`} aria-label="TSIDKENU Legal Operating System">
  <svg viewBox="0 0 76 54" className="h-9 w-12 shrink-0" aria-hidden="true"><g fill="none" stroke="#D5B16A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M8 45c17-7 27-19 38-35"/><path d="M22 35c-1-9 2-15 9-19 1 8-2 14-9 19Z" fill="#D5B16A" stroke="none"/><path d="M31 28c4-9 10-13 19-12-3 8-9 12-19 12Z" fill="#D5B16A" stroke="none"/><path d="M40 19c1-8 5-13 12-16 0 8-4 13-12 16Z" fill="#D5B16A" stroke="none"/><path d="M45 12c8-4 15-3 21 2-7 5-14 4-21-2Z" fill="#D5B16A" stroke="none"/><path d="M38 23c8 0 14 3 18 10-8 1-14-2-18-10Z" fill="#D5B16A" stroke="none"/></g></svg>
  {!compact&&<div className="min-w-0"><p className="font-serif text-[1.45rem] font-semibold leading-none tracking-[-.035em]" style={{color:text}}>Tsidkenu</p><p className="mt-1 text-[7px] font-black uppercase tracking-[.23em]" style={{color:muted}}>Legal operating system</p></div>}
 </div>
}

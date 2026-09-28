import TsidkenuLogo from "@/components/TsidkenuLogo";

export default function Loading(){
  return <main className="min-h-screen bg-[#eef2ef] p-4 text-slate-900 sm:p-6 lg:p-8">
    <div className="mx-auto max-w-[1680px]">
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <TsidkenuLogo surface="light"/>
        <span className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">Opening workspace…</span>
      </div>
      <div className="mt-5 animate-pulse space-y-5">
        <div className="h-52 rounded-[2rem] bg-[#dfe8e4]"/>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({length:4}).map((_,i)=><div key={i} className="h-28 rounded-[1.4rem] bg-white shadow-sm"/>)}
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {Array.from({length:3}).map((_,i)=><div key={i} className="h-72 rounded-[1.6rem] bg-white shadow-sm"/>)}
        </div>
      </div>
    </div>
  </main>
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, MessageSquareText, Mic, Phone,
  Search, ShieldCheck, Square, Trash2, UserPlus, UsersRound,
} from "lucide-react";

type Party = { id:string; display_name:string; phone?:string|null; email?:string|null; client_status:string; preferred_language:string };
type Interaction = { id:string; interaction_type:string; occurred_at:string; subject?:string|null; raw_note?:string|null; confidentiality_level:string; verification_status:string; primary_party_id?:string|null; matter_id?:string|null; client_cycle_stage?:string; consultation_status?:string };
type Policy = { call_recording_enabled?:boolean; transcription_enabled?:boolean; ai_extraction_enabled?:boolean; whatsapp_enabled?:boolean };
type Payload = { success:boolean; error?:string; parties?:Party[]; interactions?:Interaction[]; policy?:Policy|null };
type TranscriptionResult = { status?:string; configured?:boolean; error?:string|null };
type CaptureState = "idle" | "recording" | "ready" | "uploading";
const input = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#7ca799] focus:ring-4 focus:ring-emerald-900/5";
const types = [["walk_in","Walk-in / office"],["office_meeting","Office meeting"],["phone_call","Phone call"],["whatsapp","WhatsApp"],["email","Email"],["portal","Client portal"],["referral","Referral"],["court_encounter","Court / external encounter"],["other","Other"]] as const;

export default function InteractionsPage() {
  const [data,setData] = useState<Payload>({success:true,parties:[],interactions:[]});
  const [loading,setLoading] = useState(true);
  const [search,setSearch] = useState("");
  const [partyId,setPartyId] = useState("");
  const [type,setType] = useState("walk_in");
  const [subject,setSubject] = useState("");
  const [note,setNote] = useState("");
  const [confidentiality,setConfidentiality] = useState("firm");
  const [recordingConsent,setRecordingConsent] = useState(false);
  const [message,setMessage] = useState("");
  const [saving,setSaving] = useState(false);
  const [newName,setNewName] = useState("");
  const [newPhone,setNewPhone] = useState("");
  const [captureState,setCaptureState] = useState<CaptureState>("idle");
  const [captureSeconds,setCaptureSeconds] = useState(0);
  const [recordingBlob,setRecordingBlob] = useState<Blob|null>(null);
  const [recordingUrl,setRecordingUrl] = useState<string|null>(null);
  const mediaRecorderRef = useRef<MediaRecorder|null>(null);
  const mediaStreamRef = useRef<MediaStream|null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number|null>(null);

  async function load(q="") {
    const res = await fetch(`/api/interactions${q?`?q=${encodeURIComponent(q)}`:""}`, { cache:"no-store", credentials:"include" });
    const payload = await res.json() as Payload;
    setData(payload);
  }
  useEffect(() => { void load().catch(e => setData({success:false,error:e instanceof Error?e.message:"Unable to load."})).finally(() => setLoading(false)); }, []);
  useEffect(() => { const t=window.setTimeout(() => { void load(search.trim()).catch(()=>undefined); },250); return()=>window.clearTimeout(t); }, [search]);
  useEffect(() => () => { stopTracks(); if (recordingUrl) URL.revokeObjectURL(recordingUrl); }, [recordingUrl]);

  const parties = data.parties ?? [];
  const interactions = data.interactions ?? [];
  const selected = useMemo(() => parties.find(p => p.id===partyId),[parties,partyId]);
  const canRecord = Boolean(data.policy?.call_recording_enabled) && ["phone_call","office_meeting","walk_in"].includes(type);
  const canTranscribe = Boolean(data.policy?.transcription_enabled);

  function stopTracks() {
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }
  function clearRecording() {
    stopTracks();
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    setRecordingUrl(null); setRecordingBlob(null); setCaptureSeconds(0); setCaptureState("idle"); chunksRef.current=[];
  }

  async function startRecording() {
    setMessage("");
    if (!canRecord) { setMessage("Microphone capture is not enabled for this interaction type or firm policy."); return; }
    if (!recordingConsent) { setMessage("Record the participant's consent before starting microphone capture."); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setMessage("This browser does not support secure microphone recording. Use a current Chrome, Edge, Firefox or Safari version."); return; }
    try {
      clearRecording();
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      mediaStreamRef.current = stream;
      const preferred = ["audio/webm;codecs=opus","audio/webm","audio/mp4"].find(value => MediaRecorder.isTypeSupported(value));
      const recorder = preferred ? new MediaRecorder(stream,{mimeType:preferred}) : new MediaRecorder(stream);
      chunksRef.current=[];
      recorder.ondataavailable = event => { if (event.data.size>0) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const mime = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current,{type:mime});
        if (recordingUrl) URL.revokeObjectURL(recordingUrl);
        setRecordingBlob(blob); setRecordingUrl(URL.createObjectURL(blob)); setCaptureState("ready"); stopTracks();
      };
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setCaptureState("recording"); setCaptureSeconds(0);
      timerRef.current = window.setInterval(()=>setCaptureSeconds(value=>value+1),1000);
    } catch (caught) {
      clearRecording();
      setMessage(caught instanceof Error ? `Microphone could not start: ${caught.message}` : "Microphone could not start.");
    }
  }
  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  }

  async function createParty() {
    if(!newName.trim()) return;
    setSaving(true); setMessage("");
    try {
      const r=await fetch("/api/interactions",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"create_party",displayName:newName,phone:newPhone})});
      const p=await r.json(); if(!p.success) throw new Error(p.error);
      setPartyId(p.party.id); setNewName(""); setNewPhone(""); await load(search); setMessage("Contact created and selected.");
    } catch(e) { setMessage(e instanceof Error?e.message:"Unable to create contact."); } finally { setSaving(false); }
  }

  async function uploadCapturedRecording(interactionId:string): Promise<TranscriptionResult|undefined> {
    if (!recordingBlob) return undefined;
    setCaptureState("uploading");
    const ext = recordingBlob.type.includes("mp4") ? "m4a" : "webm";
    const form = new FormData();
    form.append("file", new File([recordingBlob],`interaction-${interactionId}.${ext}`,{type:recordingBlob.type || "audio/webm"}));
    form.append("transcribe", canTranscribe ? "true" : "false");
    const response = await fetch(`/api/interactions/${interactionId}/recording`,{method:"POST",credentials:"include",body:form});
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.error || "Audio upload failed.");
    return payload.transcription as TranscriptionResult | undefined;
  }

  async function saveInteraction() {
    if(!partyId && !note.trim() && !subject.trim() && !recordingBlob) { setMessage("Select a person, add a note, or capture audio."); return; }
    if(recordingBlob && !recordingConsent) { setMessage("Recording consent is required before audio can be stored."); return; }
    setSaving(true); setMessage("");
    try {
      const hadRecording = Boolean(recordingBlob);
      const r=await fetch("/api/interactions",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({interactionType:type,partyId:partyId||null,subject,note,confidentialityLevel:confidentiality,consentRecording:canRecord?recordingConsent:null,requestAnalysis:false,requestTranscription:false,clientCycleStage:"enquiry"})});
      const p=await r.json(); if(!p.success) throw new Error(p.error);
      let transcription: TranscriptionResult|undefined;
      if (recordingBlob) transcription = await uploadCapturedRecording(p.interaction.id);
      setSubject(""); setNote(""); setRecordingConsent(false); clearRecording(); await load(search);
      if (transcription?.status === "completed") setMessage("Interaction and audio saved. Transcription completed and is ready for review.");
      else if (hadRecording && transcription?.configured === false) setMessage("Interaction and audio saved. Transcription is not configured for this runtime.");
      else if (hadRecording && transcription?.status === "failed") setMessage(`Interaction and audio saved, but transcription failed: ${transcription.error || "provider error"}`);
      else setMessage(hadRecording ? "Interaction and authorized audio saved." : "Interaction saved.");
    } catch(e) { setMessage(e instanceof Error?e.message:"Unable to save interaction."); }
    finally { setSaving(false); }
  }

  if(loading) return <main className="grid min-h-screen place-items-center bg-[#eef2ef] p-6"><p className="text-sm font-semibold text-slate-600">Loading interaction desk…</p></main>;
  if(!data.success) return <main className="min-h-screen bg-[#eef2ef] p-6"><div className="mx-auto max-w-3xl rounded-3xl border border-red-200 bg-white p-8">{data.error||"Unable to load."}</div></main>;

  return <main className="min-h-screen bg-[#eef2ef] p-3 text-slate-800 sm:p-5 lg:p-7">
    <div className="mx-auto max-w-[1650px] space-y-5">
      <section className="overflow-hidden rounded-[1.8rem] bg-[#07372d] p-5 text-white shadow-[0_24px_70px_rgba(7,55,45,.15)] sm:p-7 lg:p-9">
        <Link href="/workspace" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-white/55"><ArrowLeft className="h-4 w-4"/>Workspace</Link>
        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-[#d7bd84]">Interaction desk</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] sm:text-4xl lg:text-5xl">Capture what actually happened.</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">Notes and microphone audio are separate, explicit sources. TSIDKENU never calls a database entry a recording unless audio was actually captured.</p></div><div className="rounded-2xl border border-white/10 bg-white/[.05] p-4 text-xs leading-5 text-white/65"><ShieldCheck className="mr-2 inline h-4 w-4 text-[#d7bd84]"/>Recording requires firm policy plus recorded participant consent. Transcription is requested only when the configured provider is enabled.</div></div>
      </section>
      {message&&<div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">{message}</div>}
      <div className="grid gap-5 xl:grid-cols-[minmax(300px,.72fr)_minmax(0,1.28fr)]">
        <section className="space-y-5">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><Search className="h-5 w-5 text-[#0b493b]"/><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Person</p><h2 className="text-lg font-semibold text-slate-950">Find existing contact</h2></div></div><input className={`${input} mt-4`} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, phone or email"/><div className="mt-3 max-h-72 space-y-2 overflow-auto">{parties.map(p=><button key={p.id} onClick={()=>setPartyId(p.id)} className={`w-full rounded-2xl border p-3 text-left ${partyId===p.id?"border-[#0b493b] bg-emerald-50":"border-slate-100 hover:border-slate-200"}`}><p className="text-sm font-semibold text-slate-900">{p.display_name}</p><p className="mt-1 text-xs text-slate-500">{[p.phone,p.email].filter(Boolean).join(" • ")||"No contact detail"}</p></button>)}</div></div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><UserPlus className="h-5 w-5 text-[#0b493b]"/><h2 className="text-lg font-semibold text-slate-950">New person</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><input className={input} value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Name"/><input className={input} value={newPhone} onChange={e=>setNewPhone(e.target.value)} placeholder="Phone (optional)"/></div><button onClick={createParty} disabled={saving||!newName.trim()} className="mt-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Create contact</button></div>
        </section>
        <section className="space-y-5">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3"><MessageSquareText className="h-5 w-5 text-[#0b493b]"/><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Capture</p><h2 className="text-xl font-semibold text-slate-950">{selected?`Interaction with ${selected.display_name}`:"New interaction"}</h2></div></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2"><select className={input} value={type} onChange={e=>{setType(e.target.value);setRecordingConsent(false);clearRecording();}}>{types.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><select className={input} value={confidentiality} onChange={e=>setConfidentiality(e.target.value)}><option value="firm">Firm</option><option value="restricted">Restricted</option><option value="highly_confidential">Highly confidential</option></select></div>
            <input className={`${input} mt-3`} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Short reason / subject (optional)"/>
            <textarea className={`${input} mt-3 min-h-32 resize-y`} value={note} onChange={e=>setNote(e.target.value)} placeholder="Type notes here, or use the microphone below for actual audio capture…"/>
            {canRecord ? <div className="mt-4 rounded-[1.35rem] border border-slate-200 bg-[#f8faf9] p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Mic className="h-5 w-5 text-[#0b493b]"/><p className="font-semibold text-slate-950">Microphone capture</p></div><p className="mt-1 text-xs leading-5 text-slate-500">This creates a real audio source, not just an interaction record.</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] ${captureState==="recording"?"bg-red-100 text-red-700":captureState==="ready"?"bg-emerald-100 text-emerald-700":"bg-slate-100 text-slate-500"}`}>{captureState==="recording"?`Recording ${formatTime(captureSeconds)}`:captureState==="ready"?`Audio ready · ${formatTime(captureSeconds)}`:captureState==="uploading"?"Uploading":"Idle"}</span></div>
              <label className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><input type="checkbox" checked={recordingConsent} onChange={e=>setRecordingConsent(e.target.checked)} disabled={captureState==="recording"} className="mt-1"/><span><strong>Participant consent confirmed.</strong> Required before microphone capture or storage.</span></label>
              <div className="mt-4 flex flex-wrap gap-2">{captureState==="idle"&&<button onClick={()=>void startRecording()} disabled={!recordingConsent||saving} className="inline-flex items-center gap-2 rounded-xl bg-[#07372d] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"><Mic className="h-4 w-4"/>Start recording</button>}{captureState==="recording"&&<button onClick={stopRecording} className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white"><Square className="h-4 w-4"/>Stop recording</button>}{captureState==="ready"&&<button onClick={clearRecording} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600"><Trash2 className="h-4 w-4"/>Discard audio</button>}{recordingUrl&&<audio controls src={recordingUrl} className="h-10 max-w-full sm:max-w-sm"/>}</div>
              <p className="mt-3 text-[11px] leading-5 text-slate-500">Transcription: {canTranscribe?"enabled — requested automatically when audio is saved":"not enabled for this firm/runtime"}.</p>
            </div> : <div className="mt-4 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-500"><Phone className="mr-2 inline h-4 w-4"/>Audio recording is not enabled for this interaction type or the firm policy.</div>}
            <div className="mt-5 flex flex-wrap items-center gap-3"><button onClick={()=>void saveInteraction()} disabled={saving||captureState==="recording"||captureState==="uploading"} className="rounded-2xl bg-[#07372d] px-5 py-3 text-sm font-bold text-white disabled:opacity-40">{saving?"Saving…":recordingBlob?"Save interaction + audio":"Save interaction"}</button>{recordingBlob&&<span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4"/>Actual audio attached</span>}</div>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><UsersRound className="h-5 w-5 text-[#0b493b]"/><h2 className="text-lg font-semibold text-slate-950">Recent interactions</h2></div><div className="mt-4 grid gap-2 lg:grid-cols-2">{interactions.length===0?<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No interaction records yet.</p>:interactions.slice(0,12).map(i=><Link href={`/interactions/${i.id}`} key={i.id} className="block rounded-2xl border border-slate-100 p-4 transition hover:border-emerald-300"><p className="text-sm font-semibold text-slate-900">{i.subject||i.interaction_type.replaceAll("_"," ")}</p><p className="mt-1 text-xs text-slate-500">{new Date(i.occurred_at).toLocaleString()} · {i.confidentiality_level.replaceAll("_"," ")}</p>{i.raw_note&&<p className="mt-2 line-clamp-2 text-sm text-slate-600">{i.raw_note}</p>}</Link>)}</div></div>
        </section>
      </div>
    </div>
  </main>;
}

function formatTime(total:number) { const m=Math.floor(total/60).toString().padStart(2,"0"); const s=(total%60).toString().padStart(2,"0"); return `${m}:${s}`; }

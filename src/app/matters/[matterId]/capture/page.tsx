"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, FileUp, Mic, Square, StickyNote, UploadCloud } from "lucide-react";

type CaptureState = "idle" | "recording" | "ready" | "uploading";

const field = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#7ca799] focus:ring-4 focus:ring-emerald-900/5";

export default function MatterCapturePage() {
  const params = useParams<{ matterId: string }>();
  const matterId = params.matterId;
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [captureState, setCaptureState] = useState<CaptureState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingAuthorized, setRecordingAuthorized] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function uploadFiles() {
    if (!files.length) return;
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      form.append("matterId", matterId);
      form.append("title", `Case capture · ${new Date().toLocaleString()}`);
      form.append("sourceType", files.some((file) => file.type.startsWith("image/")) ? "phone_scan" : "manual_upload");
      const response = await fetch("/api/digitisation", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Unable to capture files.");
      setBatchId(payload.batch?.id ?? null);
      setFiles([]);
      setMessage(`${payload.items?.length ?? 0} file(s) preserved and sent to governed review. Duplicates are flagged automatically.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to capture files.");
    } finally {
      setBusy(false);
    }
  }

  async function saveNote() {
    if (!subject.trim() && !note.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/interactions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matterId,
          interactionType: "other",
          subject: subject.trim() || "Case note",
          note: note.trim(),
          confidentialityLevel: "firm",
          clientCycleStage: "matter",
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Unable to save case note.");
      setSubject("");
      setNote("");
      setMessage("Case note added to the matter interaction record.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save case note.");
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    setMessage("");
    if (!recordingAuthorized) {
      setMessage("Confirm that this is your own voice memo or that recording permission has been obtained.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessage("Secure microphone capture is not available in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setCaptureState("ready");
        stopTracks();
      };
      recorder.start(1000);
      setSeconds(0);
      setCaptureState("recording");
      timerRef.current = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    } catch (error) {
      stopTracks();
      setCaptureState("idle");
      setMessage(error instanceof Error ? error.message : "Microphone could not start.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  async function saveVoiceMemo() {
    if (!audioBlob) return;
    setCaptureState("uploading");
    setMessage("");
    try {
      const interactionResponse = await fetch("/api/interactions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matterId,
          interactionType: "court_encounter",
          subject: subject.trim() || "Case voice memo",
          note: note.trim() || null,
          confidentialityLevel: "firm",
          consentRecording: true,
          clientCycleStage: "matter",
        }),
      });
      const interactionPayload = await interactionResponse.json();
      if (!interactionResponse.ok || !interactionPayload.success) throw new Error(interactionPayload.error ?? "Unable to create voice interaction.");

      const ext = audioBlob.type.includes("mp4") ? "m4a" : "webm";
      const form = new FormData();
      form.append("file", new File([audioBlob], `case-voice-${Date.now()}.${ext}`, { type: audioBlob.type || "audio/webm" }));
      form.append("transcribe", "true");
      const uploadResponse = await fetch(`/api/interactions/${interactionPayload.interaction.id}/recording`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const uploadPayload = await uploadResponse.json();
      if (!uploadResponse.ok || !uploadPayload.success) throw new Error(uploadPayload.error ?? "Voice memo upload failed.");

      setAudioBlob(null);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setSeconds(0);
      setSubject("");
      setNote("");
      setCaptureState("idle");
      const transcription = uploadPayload.transcription;
      setMessage(transcription?.status === "completed"
        ? "Voice memo saved to this case and transcribed for review."
        : "Voice memo saved to this case. Transcription will remain governed by the configured provider and review state.");
    } catch (error) {
      setCaptureState("ready");
      setMessage(error instanceof Error ? error.message : "Unable to save voice memo.");
    }
  }

  return (
    <main className="min-h-screen bg-[#eef2ef] p-4 text-slate-800 md:p-7">
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="rounded-[2rem] bg-[#082b22] p-6 text-white shadow-xl md:p-8">
          <Link href={`/matters/${matterId}`} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-white/55"><ArrowLeft className="h-4 w-4"/>Back to case</Link>
          <p className="mt-6 text-[10px] font-black uppercase tracking-[.22em] text-[#d7bd84]">Universal capture</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-.04em]">Capture it once. Put it in the right case.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">Photo, scan, document, note or authorized voice memo. Originals remain preserved, uncertain classification stays reviewable, and nothing becomes authoritative just because AI extracted it.</p>
        </section>

        {message ? <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">{message}</div> : null}

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3"><div className="rounded-xl bg-[#edf4f0] p-2.5 text-[#0b493b]"><Camera className="h-5 w-5"/></div><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-slate-400">Evidence & documents</p><h2 className="text-xl font-semibold">Camera / scan / upload</h2></div></div>
            <label className="mt-5 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-5 text-center">
              <UploadCloud className="h-8 w-8 text-[#0b493b]"/>
              <span className="mt-3 text-sm font-semibold">Choose photos, scans, PDFs or documents</span>
              <span className="mt-1 text-xs text-slate-500">On mobile, the camera can be used directly for image capture.</span>
              <input multiple type="file" accept="image/*,application/pdf,.doc,.docx" className="hidden" onChange={(event) => setFiles(Array.from(event.target.files ?? []))}/>
            </label>
            {files.length ? <div className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-900">{files.length} file(s) ready for governed intake.</div> : null}
            <button onClick={uploadFiles} disabled={!files.length || busy} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#082b22] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><FileUp className="h-4 w-4"/>{busy ? "Preserving…" : "Preserve & send to review"}</button>
            {batchId ? <Link href={`/digitisation?batchId=${encodeURIComponent(batchId)}`} className="mt-3 block text-center text-xs font-bold text-[#0b493b]">Open review queue →</Link> : null}
          </div>

          <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3"><div className="rounded-xl bg-[#edf4f0] p-2.5 text-[#0b493b]"><StickyNote className="h-5 w-5"/></div><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-slate-400">Case memory</p><h2 className="text-xl font-semibold">Quick note</h2></div></div>
            <input className={`${field} mt-5`} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="What happened? / short subject"/>
            <textarea className={`${field} mt-3 min-h-36 resize-y`} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Facts, instructions, hearing result, follow-up or observation…"/>
            <button onClick={saveNote} disabled={busy || (!subject.trim() && !note.trim())} className="mt-3 w-full rounded-2xl border border-[#0b493b] bg-white px-5 py-3 text-sm font-semibold text-[#0b493b] disabled:opacity-50">Add to case record</button>
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-slate-400">After court / meeting / call</p><h2 className="mt-1 text-xl font-semibold">Voice memo → governed transcription</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Record your own immediate case memo, or capture other participants only where recording is permitted and authorized. The audio remains the source; transcription is reviewable.</p></div><Mic className="h-6 w-6 text-[#0b493b]"/></div>
          <label className="mt-4 flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><input type="checkbox" checked={recordingAuthorized} onChange={(event) => setRecordingAuthorized(event.target.checked)} className="mt-1"/><span>This is my own voice memo, or I have the required permission to record the participants.</span></label>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {captureState === "recording" ? <button onClick={stopRecording} className="inline-flex items-center gap-2 rounded-2xl bg-red-700 px-5 py-3 text-sm font-semibold text-white"><Square className="h-4 w-4"/>Stop · {seconds}s</button> : <button onClick={startRecording} disabled={captureState === "uploading"} className="inline-flex items-center gap-2 rounded-2xl bg-[#082b22] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><Mic className="h-4 w-4"/>Record voice memo</button>}
            {audioUrl ? <audio controls src={audioUrl} className="max-w-full"/> : null}
            {audioBlob ? <button onClick={saveVoiceMemo} disabled={captureState === "uploading"} className="rounded-2xl border border-[#0b493b] px-5 py-3 text-sm font-semibold text-[#0b493b] disabled:opacity-50">{captureState === "uploading" ? "Saving…" : "Save to case & transcribe"}</button> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

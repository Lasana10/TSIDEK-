import path from "node:path";
import { readVaultFile } from "@/lib/file-vault";

export function getTranscriptionStatus() {
  const url = String(process.env.TSIDEK_TRANSCRIPTION_URL || "").trim();
  const model = String(process.env.TSIDEK_TRANSCRIPTION_MODEL || "whisper-1").trim();
  return { configured: Boolean(url), url, model, providerLabel: process.env.TSIDEK_TRANSCRIPTION_LABEL || "Configured transcription service" };
}

export async function transcribeVaultRecording(input:{storagePath:string;mimeType?:string|null;language?:string|null}) {
  const status=getTranscriptionStatus();
  if(!status.configured) throw new Error("No transcription service is configured for this firm runtime.");
  const buffer=await readVaultFile(input.storagePath);
  const fileName=path.basename(input.storagePath)||"recording.webm";
  const form=new FormData();
  form.append("file",new Blob([buffer],{type:input.mimeType||"application/octet-stream"}),fileName);
  form.append("model",status.model);
  if(input.language)form.append("language",input.language);
  const headers:Record<string,string>={};
  const apiKey=String(process.env.TSIDEK_TRANSCRIPTION_API_KEY||"").trim();
  if(apiKey)headers.Authorization=`Bearer ${apiKey}`;
  const response=await fetch(status.url,{method:"POST",headers,body:form,signal:AbortSignal.timeout(120000)});
  const raw=await response.text();
  if(!response.ok)throw new Error(`Transcription provider failed (${response.status}).`);
  let text=raw.trim();
  try{const parsed=JSON.parse(raw) as {text?:string;transcript?:string;data?:{text?:string}};text=String(parsed.text??parsed.transcript??parsed.data?.text??"").trim()}catch{/* plain-text providers are supported */}
  if(!text)throw new Error("Transcription provider returned no transcript text.");
  return {text,model:status.model,providerLabel:status.providerLabel};
}

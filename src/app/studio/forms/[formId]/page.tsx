"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, GripVertical, Plus, Save, Trash2, Workflow } from "lucide-react";

type FieldType = "text" | "textarea" | "email" | "phone" | "number" | "date" | "datetime" | "select" | "checkbox" | "file" | "party" | "legal_reference";
type FormField = { id:string; key:string; type:FieldType; labelEn:string; labelFr:string; required:boolean; placeholderEn?:string; placeholderFr?:string; options?:string[]; helpEn?:string; helpFr?:string; visibleWhen?:{field:string;equals:string}|null };
type FormRecord = { id:string; name:string; description?:string|null; module:string; status:string; version:number; schema?:{fields?:FormField[]}; workflow?:Record<string,unknown>; access_roles?:string[] };

const fieldTypes: FieldType[] = ["text","textarea","email","phone","number","date","datetime","select","checkbox","file","party","legal_reference"];
const roles = ["owner","partner","lawyer","paralegal","intern","administrator","finance","clerk","knowledge_manager"];
const inputClass="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700/40 focus:ring-4 focus:ring-emerald-900/5";

export default function StudioFormBuilder({ params }: { params: Promise<{ formId:string }> }) {
  const [formId,setFormId]=useState("");
  const [form,setForm]=useState<FormRecord|null>(null);
  const [fields,setFields]=useState<FormField[]>([]);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{void params.then(({formId})=>setFormId(formId));},[params]);
  const load=useCallback(async()=>{if(!formId)return;const r=await fetch(`/api/firm/studio/forms/${formId}`,{cache:"no-store"});const d=await r.json();if(!d.success){setMessage(d.error||"Unable to load form");return;}setForm(d.form);setFields(Array.isArray(d.form?.schema?.fields)?d.form.schema.fields:[]);},[formId]);
  useEffect(()=>{void load();},[load]);

  function addField(){const next=fields.length+1;setFields(current=>[...current,{id:crypto.randomUUID(),key:`field_${next}`,type:"text",labelEn:"New field",labelFr:"Nouveau champ",required:false,options:[],visibleWhen:null}]);}
  function updateField(id:string,patch:Partial<FormField>){setFields(current=>current.map(field=>field.id===id?{...field,...patch}:field));}
  function removeField(id:string){setFields(current=>current.filter(field=>field.id!==id));}
  function moveField(index:number,direction:-1|1){const target=index+direction;if(target<0||target>=fields.length)return;setFields(current=>{const copy=[...current];[copy[index],copy[target]]=[copy[target],copy[index]];return copy;});}

  async function save(status?:string){if(!form)return;setSaving(true);setMessage("");try{const response=await fetch(`/api/firm/studio/forms/${form.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:form.name,description:form.description,module:form.module,status:status||form.status,schema:{fields},workflow:form.workflow||{},accessRoles:form.access_roles||[]})});const data=await response.json();if(!data.success)throw new Error(data.error||"Unable to save form");setForm(data.form);setFields(data.form.schema?.fields||[]);setMessage(status==="published"?"Form published.":"Form saved.");}catch(error){setMessage(error instanceof Error?error.message:"Unable to save form");}finally{setSaving(false);}}

  if(!form)return <main className="min-h-screen bg-slate-50 p-6 text-slate-600">{message||"Loading Form Studio…"}</main>;

  return <main className="min-h-screen bg-[#f7f8f6] px-4 py-6 text-slate-700 md:px-6 xl:px-8"><div className="mx-auto max-w-[1500px] space-y-5">
    <header className="rounded-[2rem] border border-white bg-white p-6 shadow-sm"><Link href="/studio" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400"><ArrowLeft className="h-4 w-4"/>Back to Firm Studio</Link><div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Visual Form Builder · v{form.version}</p><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="mt-2 w-full border-0 bg-transparent p-0 text-3xl font-semibold text-emerald-950 outline-none"/><p className="mt-2 text-sm text-slate-500">Build firm-specific bilingual intake, KYC, conflict, engagement, matter, finance and closure workflows without code.</p></div><div className="flex flex-wrap gap-2"><button onClick={()=>void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-emerald-950 px-4 py-2 text-sm font-bold text-emerald-950"><Save className="h-4 w-4"/>Save draft</button><button onClick={()=>void save("published")} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-950 px-4 py-2 text-sm font-bold text-white"><Workflow className="h-4 w-4"/>Publish</button></div></div></header>
    {message?<div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">{message}</div>:null}

    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[1.8rem] border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Fields</p><h2 className="text-xl font-semibold text-emerald-950">Form structure</h2></div><button onClick={addField} className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900"><Plus className="h-4 w-4"/>Add field</button></div>
        <div className="mt-5 space-y-4">{fields.length===0?<button onClick={addField} className="w-full rounded-2xl border border-dashed border-slate-300 p-8 text-sm text-slate-500">No fields yet. Add the first controlled field.</button>:fields.map((field,index)=><div key={field.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><GripVertical className="h-4 w-4 text-slate-300"/><span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Field {index+1}</span></div><div className="flex gap-1"><button onClick={()=>moveField(index,-1)} className="rounded-lg border px-2 py-1 text-xs">↑</button><button onClick={()=>moveField(index,1)} className="rounded-lg border px-2 py-1 text-xs">↓</button><button onClick={()=>removeField(field.id)} className="rounded-lg border border-red-100 p-1.5 text-red-600"><Trash2 className="h-3.5 w-3.5"/></button></div></div>
          <div className="mt-3 grid gap-3 md:grid-cols-2"><input className={inputClass} value={field.labelEn} onChange={e=>updateField(field.id,{labelEn:e.target.value})} placeholder="English label"/><input className={inputClass} value={field.labelFr} onChange={e=>updateField(field.id,{labelFr:e.target.value})} placeholder="Libellé français"/><input className={inputClass} value={field.key} onChange={e=>updateField(field.id,{key:e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,"_")})} placeholder="field_key"/><select className={inputClass} value={field.type} onChange={e=>updateField(field.id,{type:e.target.value as FieldType})}>{fieldTypes.map(type=><option key={type} value={type}>{type}</option>)}</select><input className={inputClass} value={field.placeholderEn||""} onChange={e=>updateField(field.id,{placeholderEn:e.target.value})} placeholder="English placeholder"/><input className={inputClass} value={field.placeholderFr||""} onChange={e=>updateField(field.id,{placeholderFr:e.target.value})} placeholder="Indication française"/></div>
          {field.type==="select"?<input className={`${inputClass} mt-3`} value={(field.options||[]).join(", ")} onChange={e=>updateField(field.id,{options:e.target.value.split(",").map(v=>v.trim()).filter(Boolean)})} placeholder="Options separated by commas"/>:null}
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={field.required} onChange={e=>updateField(field.id,{required:e.target.checked})}/><span>Required before submission</span></label>
        </div>)}</div>
      </section>

      <section className="space-y-5"><div className="rounded-[1.8rem] border border-slate-200 bg-white p-5"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Preview</p><h2 className="mt-1 text-xl font-semibold text-emerald-950">Bilingual client/staff experience</h2><div className="mt-5 space-y-4">{fields.map(field=><label key={field.id} className="block"><span className="text-sm font-semibold text-slate-800">{field.labelEn}{field.required?" *":""}</span><span className="ml-2 text-xs text-slate-400">/ {field.labelFr}</span>{field.type==="textarea"?<textarea disabled className={`${inputClass} mt-2 min-h-20`} placeholder={field.placeholderEn}/>:field.type==="select"?<select disabled className={`${inputClass} mt-2`}><option>{field.placeholderEn||"Select / Choisir"}</option>{(field.options||[]).map(option=><option key={option}>{option}</option>)}</select>:field.type==="checkbox"?<div className="mt-2 flex items-center gap-2"><input disabled type="checkbox"/><span className="text-sm text-slate-500">{field.placeholderEn||field.labelEn}</span></div>:<input disabled className={`${inputClass} mt-2`} type={field.type==="number"?"number":field.type==="date"?"date":field.type==="email"?"email":"text"} placeholder={field.placeholderEn}/>}</label>)}{fields.length===0?<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Add fields to see the live form.</p>:null}</div></div>
        <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Access</p><h2 className="mt-1 text-xl font-semibold text-emerald-950">Who can use this form</h2><div className="mt-4 grid grid-cols-2 gap-2">{roles.map(role=><label key={role} className="flex items-center gap-2 rounded-xl border border-slate-100 p-3 text-xs"><input type="checkbox" checked={(form.access_roles||[]).includes(role)} onChange={e=>setForm({...form,access_roles:e.target.checked?[...(form.access_roles||[]),role]:(form.access_roles||[]).filter(r=>r!==role)})}/>{role}</label>)}</div></div>
      </section>
    </div>
  </div></main>;
}

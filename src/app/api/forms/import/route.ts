import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { persistUploadedFile, readVaultFile } from "@/lib/file-vault";

const allowedTypes = new Set(["text","textarea","email","number","date","datetime","select","checkbox","file"]);

function parseJsonObject(value:string){
  const cleaned=value.trim().replace(/^\`\`\`json\s*/i,"").replace(/\`\`\`$/i,"").trim();
  const first=cleaned.indexOf("{"), last=cleaned.lastIndexOf("}");
  if(first<0||last<first) throw new Error("Form extraction returned no JSON object.");
  return JSON.parse(cleaned.slice(first,last+1)) as Record<string,unknown>;
}
function slug(value:string){
  return value.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,70)||"imported_form";
}

export async function POST(request:Request){
  try{
    const scope=await resolveRequestScope(request);
    await assertFirmPermission({scope,permission:"manageFirm"});
    if(!scope.firmId||!scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const formData=await request.formData();
    const file=formData.get("file");
    if(!(file instanceof File)) return NextResponse.json({success:false,error:"A PDF, Word document, image or text file is required."},{status:400});
    if(file.size<=0||file.size>15_000_000) return NextResponse.json({success:false,error:"Form source must be between 1 byte and 15 MB."},{status:400});

    const saved=await persistUploadedFile({
      file,
      relativeDirectory:`storage/firms/${scope.firmId}/form-imports`
    });
    const bytes=await readVaultFile(saved.relativePath);
    const apiKey=process.env.GEMINI_API_KEY;
    if(!apiKey) throw new Error("Form import requires the configured document-intelligence provider.");
    const modelName=process.env.TSIDEK_DOCUMENT_AI_MODEL||"gemini-2.5-flash";
    const model=new GoogleGenerativeAI(apiKey).getGenerativeModel({model:modelName});
    const prompt=`You are TSIDKENU's law-firm form conversion engine. Convert the supplied existing office/legal form into a proposed editable structured form. Never invent facts or legal requirements that are not present. Preserve the purpose and important wording. Return JSON only with:
{
 "name": string,
 "description": string,
 "module": one of ["intake","kyc","conflict","engagement","matter","finance","closure","general"],
 "fields": [
   {"key": snake_case string, "type": one of ["text","textarea","email","number","date","datetime","select","checkbox","file"], "labelEn": string, "labelFr": string or "", "required": boolean, "placeholderEn": string or "", "placeholderFr": string or "", "options": string[]}
 ],
 "warnings": string[]
}
If the source is French, preserve French labels and provide concise English equivalents where reasonably direct; if English, do the reverse. Do not publish anything automatically. Original filename: ${JSON.stringify(file.name)}.`;
    const result=await model.generateContent([
      {text:prompt},
      {inlineData:{data:bytes.toString("base64"),mimeType:file.type||"application/octet-stream"}}
    ]);
    const parsed=parseJsonObject(result.response.text());
    const rawFields=Array.isArray(parsed.fields)?parsed.fields:[];
    const fields=rawFields.slice(0,120).map((raw,index)=>{
      const item=(raw&&typeof raw==="object"?raw:{}) as Record<string,unknown>;
      const key=slug(String(item.key||`field_${index+1}`));
      const type=allowedTypes.has(String(item.type))?String(item.type):"text";
      return {
        id:`${key}_${index+1}`,
        key,
        type,
        labelEn:String(item.labelEn||key.replaceAll("_"," ")).trim(),
        labelFr:String(item.labelFr||"").trim(),
        required:Boolean(item.required),
        placeholderEn:String(item.placeholderEn||"").trim(),
        placeholderFr:String(item.placeholderFr||"").trim(),
        options:Array.isArray(item.options)?item.options.filter(x=>typeof x==="string").map(String).slice(0,40):[]
      };
    });
    if(!fields.length) throw new Error("No usable form fields could be extracted from this file.");

    const name=String(parsed.name||file.name.replace(/\.[^.]+$/,"")).trim().slice(0,160);
    const formModule=["intake","kyc","conflict","engagement","matter","finance","closure","general"].includes(String(parsed.module))?String(parsed.module):"general";
    const formKey=`${slug(name)}_${Date.now().toString(36)}`;
    const supabase=createServerSupabaseClient();
    if(!supabase) throw new Error("Supabase server configuration is required.");
    const created=await supabase.from("firm_form_definitions").insert({
      firm_id:scope.firmId,
      form_key:formKey,
      name,
      description:String(parsed.description||"Imported from an existing firm form. Review before publishing.").trim(),
      module:formModule,
      version:1,
      status:"draft",
      schema:{fields},
      ui_schema:{source_kind:"imported_document"},
      workflow:{
        import_provenance:{
          original_name:file.name,
          storage_ref:saved.relativePath,
          mime_type:saved.mimeType,
          size_bytes:saved.sizeBytes,
          provider:"gemini",
          model:modelName,
          warnings:Array.isArray(parsed.warnings)?parsed.warnings.filter(x=>typeof x==="string").slice(0,20):[]
        },
        requires_human_review:true
      },
      access_roles:[],
      created_by:scope.actorLawyerId,
      updated_by:scope.actorLawyerId
    }).select("id,form_key,name,description,module,version,status,schema,workflow").single();
    if(created.error) throw new Error(created.error.message);
    return NextResponse.json({success:true,form:created.data,warnings:created.data.workflow?.import_provenance?.warnings??[]},{status:201});
  }catch(error){
    return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to import form."},{status:400});
  }
}

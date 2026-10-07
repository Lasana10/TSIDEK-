import { createHash } from "node:crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmModule, assertFirmPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createVaultSignedReadUrl, persistUploadedFile, readVaultFile } from "@/lib/file-vault";

function parseObject(value:string){
  const cleaned=value.trim().replace(/^```json\s*/i,"").replace(/```$/i,"").trim();
  const start=cleaned.indexOf("{"),end=cleaned.lastIndexOf("}");
  if(start<0||end<start) throw new Error("Receipt extraction returned no JSON object.");
  return JSON.parse(cleaned.slice(start,end+1)) as Record<string,unknown>;
}
function textOrNull(value:unknown){return typeof value==="string"&&value.trim()?value.trim():null}
function numberOrNull(value:unknown){const n=Number(value);return Number.isFinite(n)&&n>=0?Math.round(n):null}

export async function GET(request:Request){
  try{
    const scope=await resolveRequestScope(request);await assertFirmModule({scope,module:"finance"});
    if(!scope.authenticated||!scope.firmId) throw new Error("Authenticated firm context is required.");
    const supabase=createServerSupabaseClient(); if(!supabase) throw new Error("Supabase server configuration is required.");
    const url=new URL(request.url); const expenseId=url.searchParams.get("expenseId")||"";
    let query=supabase.from("firm_expense_receipts").select("*").eq("firm_id",scope.firmId).order("created_at",{ascending:false}).limit(200);
    if(expenseId) query=query.eq("expense_id",expenseId);
    const result=await query; if(result.error) throw new Error(result.error.message);
    const receipts=await Promise.all((result.data??[]).map(async receipt=>{
      let signedUrl:string|null=null;
      try{signedUrl=await createVaultSignedReadUrl(receipt.storage_path,300)}catch{}
      return {...receipt,signed_url:signedUrl};
    }));
    return NextResponse.json({success:true,receipts});
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to load receipt evidence."},{status:403})}
}

export async function POST(request:Request){
  try{
    const scope=await resolveRequestScope(request);await assertFirmModule({scope,module:"finance"});
    await assertFirmPermission({scope,permission:"viewBilling"});
    if(!scope.firmId||!scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const form=await request.formData();
    const expenseId=String(form.get("expenseId")??"").trim();
    const evidenceType=String(form.get("evidenceType")??"receipt").trim();
    const file=form.get("file");
    if(!expenseId) return NextResponse.json({success:false,error:"Expense is required."},{status:400});
    if(!(file instanceof File)||file.size<=0) return NextResponse.json({success:false,error:"Receipt or evidence file is required."},{status:400});
    if(file.size>15_000_000) return NextResponse.json({success:false,error:"Receipt evidence must be 15 MB or smaller."},{status:400});
    const supabase=createServerSupabaseClient(); if(!supabase) throw new Error("Supabase server configuration is required.");
    const expense=await supabase.from("firm_expenses").select("*").eq("id",expenseId).eq("firm_id",scope.firmId).maybeSingle();
    if(expense.error) throw new Error(expense.error.message);
    if(!expense.data) return NextResponse.json({success:false,error:"Expense not found."},{status:404});

    const saved=await persistUploadedFile({file,relativeDirectory:`storage/firms/${scope.firmId}/expenses/${expenseId}/receipts`});
    const bytes=await readVaultFile(saved.relativePath);
    const checksum=createHash("sha256").update(bytes).digest("hex");
    let extracted:Record<string,unknown>={};
    let extractionStatus="not_requested";
    const apiKey=process.env.GEMINI_API_KEY;
    if(apiKey){
      try{
        const modelName=process.env.TSIDEK_DOCUMENT_AI_MODEL||"gemini-2.5-flash";
        const model=new GoogleGenerativeAI(apiKey).getGenerativeModel({model:modelName});
        const result=await model.generateContent([
          {text:`Extract receipt/invoice evidence only from the attached file. Do not invent values. Return JSON only:
{"supplierName":string|null,"receiptNumber":string|null,"amountXaf":number|null,"issuedAt":"YYYY-MM-DD"|null,"currency":string|null,"taxAmountXaf":number|null,"description":string|null,"confidence":number,"warnings":string[]}.
If currency is not XAF/XAF-equivalent, set amountXaf null rather than converting. This is evidence extraction, not accounting approval. Original filename: ${JSON.stringify(file.name)}.`},
          {inlineData:{data:bytes.toString("base64"),mimeType:file.type||"application/octet-stream"}}
        ]);
        extracted=parseObject(result.response.text());
        extracted={...extracted,provider:"gemini",model:modelName};
        extractionStatus="completed";
      }catch(error){
        extracted={warnings:[error instanceof Error?error.message:"Receipt extraction failed."]};
        extractionStatus="failed";
      }
    }

    const supplier=textOrNull(extracted.supplierName)??expense.data.supplier_name;
    const receiptNumber=textOrNull(extracted.receiptNumber)??expense.data.reference;
    const amount=numberOrNull(extracted.amountXaf);
    const issued=textOrNull(extracted.issuedAt);
    const inserted=await supabase.from("firm_expense_receipts").insert({
      firm_id:scope.firmId,
      expense_id:expenseId,
      matter_id:expense.data.matter_id,
      evidence_type:["receipt","invoice","registration","tax","payment_proof","other"].includes(evidenceType)?evidenceType:"receipt",
      file_name:file.name,
      storage_provider:saved.provider,
      storage_path:saved.relativePath,
      mime_type:saved.mimeType,
      size_bytes:saved.sizeBytes,
      checksum,
      receipt_number:receiptNumber,
      supplier_name:supplier,
      amount_xaf:amount,
      issued_at:issued?new Date(issued+"T00:00:00Z").toISOString():null,
      extracted_data:extracted,
      extraction_status:extractionStatus,
      created_by:scope.actorLawyerId
    }).select("*").single();
    if(inserted.error) throw new Error(inserted.error.message);

    const update=await supabase.from("firm_expenses").update({
      receipt_storage_path:saved.relativePath,
      receipt_file_name:file.name,
      receipt_mime_type:saved.mimeType,
      receipt_checksum:checksum,
      supplier_name:supplier,
      reference:receiptNumber,
      updated_at:new Date().toISOString()
    }).eq("id",expenseId).eq("firm_id",scope.firmId);
    if(update.error) throw new Error(update.error.message);
    return NextResponse.json({success:true,receipt:inserted.data,extracted,extractionStatus},{status:201});
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to upload receipt evidence."},{status:400})}
}

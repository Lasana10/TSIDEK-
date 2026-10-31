import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmModule, assertMatterPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { defaultVaultBucket, persistUploadedFile } from "@/lib/file-vault";

type Context={params:Promise<{matterId:string}>};
const MAX_BYTES=8*1024*1024;
const VALID_TYPES=new Set(["application/pdf","image/jpeg","image/png"]);
async function permitted(request:Request,matterId:string){
 const scope=await resolveRequestScope(request);
 await assertFirmModule({scope,module:"finance"});
 await assertMatterPermission({scope,matterId,permission:"viewBilling"});
 // Scoped billing authority includes access to payment proofs for assigned finance staff.
 // General evidence and document permissions remain unchanged elsewhere.
 if(!scope.authenticated||scope.source!=="auth-user"||!scope.firmId||!scope.actorLawyerId)throw new Error("Authenticated member required.");
 const db=createServerSupabaseClient();
 if(!db)throw new Error("Private document storage unavailable.");
 const matter=await db.from("matters").select("id").eq("firm_id",scope.firmId).eq("id",matterId).maybeSingle();
 if(matter.error)throw new Error(matter.error.message);
 if(!matter.data)throw new Error("Matter not found.");
 return {scope,db};
}
export async function GET(request:Request,context:Context){
 try{
  const {matterId}=await context.params; const {db}=await permitted(request,matterId);
  const docs=await db.from("documents").select("id,title,checksum,created_at,storage_path")
   .eq("matter_id",matterId).eq("document_type","payment_proof").order("created_at",{ascending:false}).limit(40);
  if(docs.error)throw new Error(docs.error.message);
  return NextResponse.json({success:true,documents:(docs.data??[]).map(d=>({id:d.id,title:d.title,checksum:d.checksum,created_at:d.created_at}))},
   {headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return NextResponse.json({success:false,error:e instanceof Error?e.message:"Unable to load payment proof."},{status:403});}
}
export async function POST(request:Request,context:Context){
 try{
  const {matterId}=await context.params;const {scope,db}=await permitted(request,matterId);
  const size=Number(request.headers.get("content-length")??0);
  if(size>MAX_BYTES+1024*1024)return NextResponse.json({success:false,error:"File exceeds 8 MB."},{status:413});
  const form=await request.formData();const file=form.get("file");
  if(!(file instanceof File)||!file.size||file.size>MAX_BYTES||!VALID_TYPES.has(file.type))
   return NextResponse.json({success:false,error:"A PDF, PNG or JPEG proof up to 8 MB is required."},{status:400});
  const bytes=Buffer.from(await file.arrayBuffer());
  const isPdf=file.type==="application/pdf"&&bytes.subarray(0,5).toString()==="%PDF-";
  const isPng=file.type==="image/png"&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const isJpeg=file.type==="image/jpeg"&&bytes.subarray(0,3).equals(Buffer.from([255,216,255]));
  if(!isPdf&&!isPng&&!isJpeg)return NextResponse.json({success:false,error:"File content does not match the declared type."},{status:400});
  // The private storage bucket is a durable, non-public store. This is not external payment verification.
  const saved=await persistUploadedFile({
   file,relativeDirectory:`firms/${scope.firmId}/matters/${matterId}/payment-proof`,
  });
  const checksum=createHash("sha256").update(bytes).digest("hex");
  const document=await db.from("documents").insert({
   matter_id:matterId,uploaded_by:scope.actorLawyerId,title:file.name.slice(0,180),
   document_type:"payment_proof",storage_path:saved.relativePath,checksum,
   source_kind:"Uploaded",status:"Draft",review_status:"Not reviewed",
   sharing_policy:"Internal only",access_level:"Matter team",
  }).select("id,title,created_at,checksum").single();
  if(document.error){
   if(saved.provider==="supabase")await db.storage.from(defaultVaultBucket).remove([saved.relativePath]).catch(()=>{});
   throw new Error(document.error.message);
  }
  return NextResponse.json({success:true,document:document.data,verification:"pending_human_review"},{status:201});
 }catch(e){return NextResponse.json({success:false,error:e instanceof Error?e.message:"Unable to upload payment proof."},{status:403});}
}

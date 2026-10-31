import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmModule,assertMatterPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createVaultSignedReadUrl } from "@/lib/file-vault";
type Context={params:Promise<{matterId:string;documentId:string}>};
export async function GET(request:Request,{params}:Context){
 try{
  const {matterId,documentId}=await params;
  const scope=await resolveRequestScope(request);
  await assertFirmModule({scope,module:"finance"});
  await assertMatterPermission({scope,matterId,permission:"viewBilling"});
  await assertMatterPermission({scope,matterId,permission:"manageEvidence"});
  if(!scope.authenticated||scope.source!=="auth-user"||!scope.firmId)return NextResponse.json({success:false,error:"Authentication required."},{status:401});
  const db=createServerSupabaseClient();if(!db)throw new Error("Private vault not configured.");
  const matter=await db.from("matters").select("id").eq("id",matterId).eq("firm_id",scope.firmId).maybeSingle();
  if(matter.error||!matter.data)return NextResponse.json({success:false,error:"Matter unavailable."},{status:404});
  const result=await db.from("documents").select("id,storage_path").eq("id",documentId).eq("matter_id",matterId).eq("document_type","payment_proof").maybeSingle();
  if(result.error||!result.data?.storage_path)return NextResponse.json({success:false,error:"Proof not found."},{status:404});
  const path=String(result.data.storage_path);
  if(!path.startsWith(`firms/${scope.firmId}/matters/${matterId}/payment-proof/`))
   return NextResponse.json({success:false,error:"Proof is not in the governed firm vault."},{status:403});
  const signed=await createVaultSignedReadUrl(path,120);
  return NextResponse.redirect(signed,{status:302,headers:{"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to open payment proof."},{status:403});}
}

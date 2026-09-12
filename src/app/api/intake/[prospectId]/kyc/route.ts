import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Context={params:Promise<{prospectId:string}>};
const statuses=new Set(["draft","under_review","cleared","enhanced_due_diligence","rejected","expired"]);
const riskRatings=new Set(["low","medium","high","prohibited"]);
const screening=new Set(["unchecked","clear","potential_match","confirmed"]);

async function contextFor(request:Request,prospectId:string){
 const scope=await resolveRequestScope(request);
 if(!scope.authenticated||!scope.firmId||!scope.actorLawyerId)throw new Error("Authenticated firm context is required.");
 const supabase=createServerSupabaseClient();if(!supabase)throw new Error("Supabase server configuration is required.");
 const {data:prospect,error}=await supabase.from("prospects").select("id,firm_id,prospect_name,status,primary_party_id").eq("id",prospectId).eq("firm_id",scope.firmId).maybeSingle();
 if(error)throw new Error(error.message);if(!prospect)throw new Error("Assessment not found in the active firm.");
 return {scope,supabase,prospect};
}

export async function GET(request:Request,context:Context){
 try{
  const {prospectId}=await context.params;const {supabase,prospect}=await contextFor(request,prospectId);
  const reviewsResult=await supabase.from("prospect_kyc_reviews").select("*").eq("prospect_id",prospectId).order("created_at",{ascending:false});
  if(reviewsResult.error)throw new Error(reviewsResult.error.message);
  const reviewIds=(reviewsResult.data??[]).map(row=>row.id);
  let evidence:any[]=[];
  if(reviewIds.length){const evidenceResult=await supabase.from("kyc_evidence_items").select("*").in("kyc_review_id",reviewIds).order("created_at",{ascending:false});if(evidenceResult.error)throw new Error(evidenceResult.error.message);evidence=evidenceResult.data??[];}
  return NextResponse.json({success:true,prospect,reviews:reviewsResult.data??[],evidence});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to load KYC."},{status:403});}
}

export async function POST(request:Request,context:Context){
 try{
  const {prospectId}=await context.params;const {scope,supabase,prospect}=await contextFor(request,prospectId);await assertFirmPermission({scope,permission:"openMatters"});const body=await request.json();const action=String(body.action||"create_review");
  if(action==="create_review"){
   const legalName=String(body.legalName||prospect.prospect_name||"").trim();if(!legalName)return NextResponse.json({success:false,error:"Legal name is required."},{status:400});
   const riskRating=String(body.riskRating||"medium");if(!riskRatings.has(riskRating))return NextResponse.json({success:false,error:"Invalid risk rating."},{status:400});
   const {data,error}=await supabase.from("prospect_kyc_reviews").insert({firm_id:scope.firmId,prospect_id:prospectId,subject_type:String(body.subjectType||"individual"),legal_name:legalName,trading_name:body.tradingName||null,registration_number:body.registrationNumber||null,tax_identifier:body.taxIdentifier||null,nationality_or_country:body.nationalityOrCountry||null,date_of_birth_or_incorporation:body.dateOfBirthOrIncorporation||null,address:body.address||null,beneficial_owners:Array.isArray(body.beneficialOwners)?body.beneficialOwners:[],identity_evidence:Array.isArray(body.identityEvidence)?body.identityEvidence:[],source_of_funds:body.sourceOfFunds||null,source_of_wealth:body.sourceOfWealth||null,risk_rating:riskRating,risk_reason:body.riskReason||null,status:"draft",created_by:scope.actorLawyerId}).select("*").single();if(error)throw new Error(error.message);return NextResponse.json({success:true,review:data},{status:201});
  }
  if(action==="add_evidence"){
   const reviewId=String(body.reviewId||"");const title=String(body.title||"").trim();const evidenceType=String(body.evidenceType||"").trim();if(!reviewId||!title||!evidenceType)return NextResponse.json({success:false,error:"Review, evidence type and title are required."},{status:400});
   const {data:review,error:reviewError}=await supabase.from("prospect_kyc_reviews").select("id").eq("id",reviewId).eq("prospect_id",prospectId).eq("firm_id",scope.firmId).maybeSingle();if(reviewError)throw new Error(reviewError.message);if(!review)throw new Error("KYC review not found.");
   const {data,error}=await supabase.from("kyc_evidence_items").insert({firm_id:scope.firmId,kyc_review_id:reviewId,evidence_type:evidenceType,title,storage_path:body.storagePath||null,external_file_id:body.externalFileId||null,checksum:body.checksum||null,issuer:body.issuer||null,issued_at:body.issuedAt||null,expires_at:body.expiresAt||null,metadata:body.metadata&&typeof body.metadata==="object"?body.metadata:{}}).select("*").single();if(error)throw new Error(error.message);return NextResponse.json({success:true,evidence:data},{status:201});
  }
  return NextResponse.json({success:false,error:"Unsupported KYC action."},{status:400});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to update KYC."},{status:403});}
}

export async function PATCH(request:Request,context:Context){
 try{
  const {prospectId}=await context.params;const {scope,supabase}=await contextFor(request,prospectId);await assertFirmPermission({scope,permission:"openMatters"});const body=await request.json();const reviewId=String(body.reviewId||"");if(!reviewId)return NextResponse.json({success:false,error:"Review id is required."},{status:400});
  const patch:Record<string,unknown>={updated_at:new Date().toISOString()};
  if(body.status!==undefined){const status=String(body.status);if(!statuses.has(status))return NextResponse.json({success:false,error:"Invalid KYC status."},{status:400});patch.status=status;if(["cleared","enhanced_due_diligence","rejected"].includes(status)){patch.reviewed_by=scope.actorLawyerId;patch.reviewed_at=new Date().toISOString();}}
  if(body.riskRating!==undefined){const risk=String(body.riskRating);if(!riskRatings.has(risk))return NextResponse.json({success:false,error:"Invalid risk rating."},{status:400});patch.risk_rating=risk;}
  for(const [bodyKey,column] of [["riskReason","risk_reason"],["sourceOfFunds","source_of_funds"],["sourceOfWealth","source_of_wealth"]] as const)if(body[bodyKey]!==undefined)patch[column]=body[bodyKey]?String(body[bodyKey]):null;
  for(const [bodyKey,column] of [["pepStatus","pep_status"],["sanctionsStatus","sanctions_status"],["adverseMediaStatus","adverse_media_status"]] as const)if(body[bodyKey]!==undefined){const value=String(body[bodyKey]);if(!screening.has(value))return NextResponse.json({success:false,error:`Invalid ${bodyKey}.`},{status:400});patch[column]=value;}
  const {data,error}=await supabase.from("prospect_kyc_reviews").update(patch).eq("id",reviewId).eq("prospect_id",prospectId).eq("firm_id",scope.firmId).select("*").single();if(error)throw new Error(error.message);
  if(data.status==="cleared"){
   const [prospectUpdate,checklistUpdate]=await Promise.all([
    supabase.from("prospects").update({status:"Compliance & terms",risk_level:data.risk_rating==="high"?"High":data.risk_rating==="low"?"Low":"Medium",updated_at:new Date().toISOString()}).eq("id",prospectId).eq("firm_id",scope.firmId),
    supabase.from("matter_opening_checklists").update({kyc_complete:true,updated_at:new Date().toISOString()}).eq("prospect_id",prospectId).eq("firm_id",scope.firmId),
   ]);if(prospectUpdate.error)throw new Error(prospectUpdate.error.message);if(checklistUpdate.error)throw new Error(checklistUpdate.error.message);
  }else if(data.status==="rejected"||data.risk_rating==="prohibited"){
   const [prospectUpdate,checklistUpdate]=await Promise.all([
    supabase.from("prospects").update({status:"Compliance blocked",risk_level:"High",updated_at:new Date().toISOString()}).eq("id",prospectId).eq("firm_id",scope.firmId),
    supabase.from("matter_opening_checklists").update({kyc_complete:false,updated_at:new Date().toISOString()}).eq("prospect_id",prospectId).eq("firm_id",scope.firmId),
   ]);if(prospectUpdate.error)throw new Error(prospectUpdate.error.message);if(checklistUpdate.error)throw new Error(checklistUpdate.error.message);
  }
  return NextResponse.json({success:true,review:data});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to review KYC."},{status:403});}
}

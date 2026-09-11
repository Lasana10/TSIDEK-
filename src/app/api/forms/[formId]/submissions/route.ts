import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Context = { params: Promise<{ formId:string }> };

type Field = { key?:string; required?:boolean; type?:string };

async function loadForm(formId:string, firmId:string) {
  const supabase=createServerSupabaseClient();
  if(!supabase) throw new Error("Supabase server configuration is required.");
  const {data,error}=await supabase.from("firm_form_definitions").select("*").eq("id",formId).eq("firm_id",firmId).maybeSingle();
  if(error) throw new Error(error.message);
  if(!data) throw new Error("Form not found in the active firm.");
  return {supabase,form:data};
}

function validateSubmission(fields:Field[], values:Record<string,unknown>) {
  const errors:string[]=[];
  for(const field of fields){
    const key=String(field.key??""); if(!key) continue;
    const value=values[key];
    const empty=value===undefined||value===null||value===""||(Array.isArray(value)&&value.length===0);
    if(field.required&&empty) errors.push(`${key} is required.`);
    if(!empty&&field.type==="email"&&typeof value==="string"&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) errors.push(`${key} must be a valid email.`);
  }
  return errors;
}

export async function GET(request:Request, context:Context){
  try{
    const scope=await resolveRequestScope(request);
    if(!scope.authenticated||!scope.firmId) throw new Error("Authenticated firm context is required.");
    const {formId}=await context.params;
    const {supabase,form}=await loadForm(formId,scope.firmId);
    const roles=Array.isArray(form.access_roles)?form.access_roles:[];
    const actorRole=String(scope.actorRole??"").toLowerCase();
    if(roles.length&&actorRole&&!roles.map((role:string)=>role.toLowerCase()).includes(actorRole)) throw new Error("This role cannot use the selected form.");
    return NextResponse.json({success:true,form:{id:form.id,name:form.name,description:form.description,module:form.module,status:form.status,schema:form.schema,uiSchema:form.ui_schema,workflow:form.workflow}});
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to load form."},{status:403});}
}

export async function POST(request:Request, context:Context){
  try{
    const scope=await resolveRequestScope(request);
    if(!scope.authenticated||!scope.firmId||!scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const {formId}=await context.params;
    const {supabase,form}=await loadForm(formId,scope.firmId);
    if(form.status!=="published") return NextResponse.json({success:false,error:"Only published forms can be submitted."},{status:409});
    const roles=Array.isArray(form.access_roles)?form.access_roles:[];
    const actorRole=String(scope.actorRole??"").toLowerCase();
    if(roles.length&&actorRole&&!roles.map((role:string)=>role.toLowerCase()).includes(actorRole)) throw new Error("This role cannot submit the selected form.");
    const body=await request.json();
    const values=body.data&&typeof body.data==="object"&&!Array.isArray(body.data)?body.data as Record<string,unknown>:{};
    const fields=Array.isArray(form.schema?.fields)?form.schema.fields as Field[]:[];
    const errors=validateSubmission(fields,values);
    if(errors.length) return NextResponse.json({success:false,error:"Form validation failed.",validationErrors:errors},{status:400});
    const matterId=body.matterId?String(body.matterId):null;
    const prospectId=body.prospectId?String(body.prospectId):null;
    if(matterId){
      const {data:allowed,error:accessError}=await supabase.rpc("can_access_matter",{target_matter_id:matterId});
      if(accessError) throw new Error(accessError.message);
      if(!allowed) throw new Error("Matter access denied.");
    }
    const {data,error}=await supabase.from("firm_form_submissions").insert({firm_id:scope.firmId,form_definition_id:formId,matter_id:matterId,prospect_id:prospectId,submitted_by:scope.actorLawyerId,status:"submitted",data:values}).select("*").single();
    if(error) throw new Error(error.message);
    return NextResponse.json({success:true,submission:data},{status:201});
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to submit form."},{status:403});}
}

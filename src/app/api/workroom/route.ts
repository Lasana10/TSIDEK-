import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const scope=await resolveRequestScope(request);
    if(!scope.authenticated||!scope.firmId) throw new Error("Authenticated firm context is required.");
    const supabase=createServerSupabaseClient(); if(!supabase) throw new Error("Supabase server configuration is required.");
    const [work,matters]=await Promise.all([
      supabase.from("firm_work_items").select("id,matter_id,party_id,work_scope,title,description,status,priority,assigned_to,due_at,completed_at,tags,created_at,updated_at").eq("firm_id",scope.firmId).order("updated_at",{ascending:false}).limit(400),
      supabase.from("matters").select("id,title,client_name,status").eq("firm_id",scope.firmId).order("updated_at",{ascending:false}).limit(300)
    ]);
    if(work.error) throw new Error(work.error.message); if(matters.error) throw new Error(matters.error.message);
    return NextResponse.json({success:true,items:work.data??[],matters:matters.data??[]});
  } catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to load workroom."},{status:403})}
}

export async function POST(request:Request){
  try{
    const scope=await resolveRequestScope(request);
    if(!scope.authenticated||!scope.firmId||!scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const supabase=createServerSupabaseClient(); if(!supabase) throw new Error("Supabase server configuration is required.");
    const body=await request.json(); const action=String(body.action??"create");
    if(action==="create"){
      const title=String(body.title??"").trim(); if(!title) return NextResponse.json({success:false,error:"Work title is required."},{status:400});
      const created=await supabase.from("firm_work_items").insert({
        firm_id:scope.firmId,matter_id:body.matterId||null,party_id:body.partyId||null,
        work_scope:String(body.workScope??"office"),title,description:String(body.description??"").trim()||null,
        status:"open",priority:String(body.priority??"normal"),assigned_to:body.assignedTo||null,created_by:scope.actorLawyerId,
        due_at:body.dueAt||null,tags:Array.isArray(body.tags)?body.tags:[]
      }).select("*").single();
      if(created.error) throw new Error(created.error.message);
      return NextResponse.json({success:true,item:created.data},{status:201});
    }
    if(action==="status"){
      const status=String(body.status??"open"); const allowed=new Set(["open","in_progress","waiting","review","completed","cancelled"]);
      if(!allowed.has(status)) return NextResponse.json({success:false,error:"Unsupported work status."},{status:400});
      const updated=await supabase.from("firm_work_items").update({status,completed_at:status==="completed"?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq("id",String(body.id??"")).eq("firm_id",scope.firmId).select("*").single();
      if(updated.error) throw new Error(updated.error.message);
      return NextResponse.json({success:true,item:updated.data});
    }
    return NextResponse.json({success:false,error:"Unsupported workroom action."},{status:400});
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to update workroom."},{status:400})}
}

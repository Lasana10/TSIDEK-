import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertMatterPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Context={params:Promise<{matterId:string}>};

export async function GET(request:Request,context:Context){
  try{
    const scope=await resolveRequestScope(request);const {matterId}=await context.params;await assertMatterPermission({scope,matterId,allowAnyMember:true});
    const supabase=createServerSupabaseClient();if(!supabase)throw new Error("Supabase server configuration is required.");
    const [matter,time,expenses,invoices,reports]=await Promise.all([
      supabase.from("matters").select("id,title,client_name,case_reference,opened_at,created_at,status").eq("id",matterId).maybeSingle(),
      supabase.from("matter_time_entries").select("*").eq("matter_id",matterId).order("created_at",{ascending:false}),
      supabase.from("firm_expenses").select("*").eq("matter_id",matterId).order("expense_date",{ascending:false}),
      supabase.from("invoices").select("*").eq("matter_id",matterId).order("created_at",{ascending:false}),
      supabase.from("matter_activity_reports").select("id,activity_type,title,occurred_at,minutes,billable,amount_xaf,expense_xaf,status").eq("matter_id",matterId).order("occurred_at",{ascending:false}).limit(100)
    ]);
    for(const r of [matter,time,expenses,invoices,reports])if(r.error)throw new Error(r.error.message);
    if(!matter.data)return NextResponse.json({success:false,error:"Case not found."},{status:404});
    const timeRows=time.data??[],expenseRows=expenses.data??[],invoiceRows=invoices.data??[];
    const billableMinutes=timeRows.filter(x=>x.billable).reduce((s,x)=>s+Number(x.minutes||0),0);
    const unbilledMinutes=timeRows.filter(x=>x.billable&&x.billing_status==="unbilled").reduce((s,x)=>s+Number(x.minutes||0),0);
    const timeValue=timeRows.filter(x=>x.billable&&x.billing_status==="unbilled"&&x.hourly_rate_xaf).reduce((s,x)=>s+(Number(x.minutes||0)/60)*Number(x.hourly_rate_xaf||0),0);
    const recoverableExpenses=expenseRows.filter(x=>x.recoverable&&x.status!=="void").reduce((s,x)=>s+Number(x.amount_xaf||0),0);
    const allExpenses=expenseRows.filter(x=>x.status!=="void").reduce((s,x)=>s+Number(x.amount_xaf||0),0);
    const billed=invoiceRows.reduce((s,x)=>s+Number(x.amount_xaf||0),0);
    const paid=invoiceRows.reduce((s,x)=>s+Number(x.paid_xaf||0),0);
    const opened=matter.data.opened_at||matter.data.created_at;const ageDays=Math.max(0,Math.floor((Date.now()-new Date(opened).getTime())/86400000));
    const running=timeRows.find(x=>x.lawyer_id===scope.actorLawyerId&&x.started_at&&!x.ended_at)||null;
    return NextResponse.json({success:true,matter:matter.data,timeEntries:timeRows,expenses:expenseRows,invoices:invoiceRows,reports:reports.data??[],runningTimer:running,metrics:{ageDays,billableMinutes,unbilledMinutes,unbilledTimeValueXaf:Math.round(timeValue),recoverableExpensesXaf:recoverableExpenses,totalCaseExpensesXaf:allExpenses,billedXaf:billed,paidXaf:paid,outstandingXaf:Math.max(0,billed-paid),draftBillBasisXaf:Math.round(timeValue+recoverableExpenses)}});
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to load case accounting."},{status:403})}
}

export async function POST(request:Request,context:Context){
  try{
    const scope=await resolveRequestScope(request);const {matterId}=await context.params;await assertMatterPermission({scope,matterId,allowAnyMember:true});
    if(!scope.firmId||!scope.actorLawyerId)throw new Error("Authenticated firm context is required.");
    const supabase=createServerSupabaseClient();if(!supabase)throw new Error("Supabase server configuration is required.");
    const body=await request.json();const action=String(body.action??"");
    if(action==="start_timer"){
      const existing=await supabase.from("matter_time_entries").select("id").eq("matter_id",matterId).eq("lawyer_id",scope.actorLawyerId).not("started_at","is",null).is("ended_at",null).limit(1).maybeSingle();
      if(existing.error)throw new Error(existing.error.message);if(existing.data)return NextResponse.json({success:false,error:"A timer is already running for this case."},{status:409});
      const created=await supabase.from("matter_time_entries").insert({firm_id:scope.firmId,matter_id:matterId,lawyer_id:scope.actorLawyerId,activity_type:String(body.activityType??"legal_work"),description:String(body.description??"Case work").trim()||"Case work",started_at:new Date().toISOString(),ended_at:null,minutes:0,hourly_rate_xaf:body.hourlyRateXaf?Number(body.hourlyRateXaf):null,billable:body.billable!==false,billing_status:body.billable===false?"non_billable":"unbilled"}).select("*").single();
      if(created.error)throw new Error(created.error.message);return NextResponse.json({success:true,timeEntry:created.data},{status:201});
    }
    if(action==="stop_timer"){
      const entry=await supabase.from("matter_time_entries").select("*").eq("id",String(body.id??"")).eq("matter_id",matterId).eq("lawyer_id",scope.actorLawyerId).maybeSingle();
      if(entry.error)throw new Error(entry.error.message);if(!entry.data||!entry.data.started_at||entry.data.ended_at)return NextResponse.json({success:false,error:"Running timer not found."},{status:404});
      const endedAt=new Date();const minutes=Math.max(1,Math.round((endedAt.getTime()-new Date(entry.data.started_at).getTime())/60000));
      const updated=await supabase.from("matter_time_entries").update({ended_at:endedAt.toISOString(),minutes,updated_at:endedAt.toISOString()}).eq("id",entry.data.id).select("*").single();
      if(updated.error)throw new Error(updated.error.message);return NextResponse.json({success:true,timeEntry:updated.data});
    }
    if(action==="add_time"){
      const minutes=Math.max(1,Math.round(Number(body.minutes||0)));const billable=body.billable!==false;
      const created=await supabase.from("matter_time_entries").insert({firm_id:scope.firmId,matter_id:matterId,lawyer_id:scope.actorLawyerId,activity_type:String(body.activityType??"legal_work"),description:String(body.description??"Legal work").trim(),minutes,hourly_rate_xaf:body.hourlyRateXaf?Number(body.hourlyRateXaf):null,billable,billing_status:billable?"unbilled":"non_billable"}).select("*").single();
      if(created.error)throw new Error(created.error.message);return NextResponse.json({success:true,timeEntry:created.data},{status:201});
    }
    return NextResponse.json({success:false,error:"Unsupported case accounting action."},{status:400});
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Case accounting action failed."},{status:400})}
}

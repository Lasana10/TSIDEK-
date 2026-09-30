import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(request:Request){
  try{
    const scope=await resolveRequestScope(request);await assertFirmPermission({scope,permission:"viewBilling"});
    if(!scope.firmId) throw new Error("Authenticated firm context is required.");
    const supabase=createServerSupabaseClient();if(!supabase) throw new Error("Supabase server configuration is required.");
    const [suppliers,obligations,lawyers,bills,expenses]=await Promise.all([
      supabase.from("firm_suppliers").select("*").eq("firm_id",scope.firmId).order("name"),
      supabase.from("firm_operational_obligations").select("*").eq("firm_id",scope.firmId).order("due_at",{ascending:true}),
      supabase.from("lawyers").select("id,full_name,role").eq("firm_id",scope.firmId).order("full_name"),
      supabase.from("firm_supplier_bills").select("*").eq("firm_id",scope.firmId).order("created_at",{ascending:false}).limit(500),
      supabase.from("firm_expenses").select("id,supplier_name,amount_xaf,expense_date,status,description").eq("firm_id",scope.firmId).order("expense_date",{ascending:false}).limit(500)
    ]);
    for(const result of [suppliers,obligations,lawyers,bills,expenses]) if(result.error) throw new Error(result.error.message);
    return NextResponse.json({success:true,suppliers:suppliers.data??[],obligations:obligations.data??[],lawyers:lawyers.data??[],bills:bills.data??[],expenses:expenses.data??[]});
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to load business operations."},{status:403})}
}

export async function POST(request:Request){
  try{
    const scope=await resolveRequestScope(request);await assertFirmPermission({scope,permission:"viewBilling"});
    if(!scope.firmId||!scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const supabase=createServerSupabaseClient();if(!supabase) throw new Error("Supabase server configuration is required.");
    const body=await request.json();const action=String(body.action??"");
    if(action==="create_supplier"){
      const name=String(body.name??"").trim();if(!name)return NextResponse.json({success:false,error:"Supplier name is required."},{status:400});
      const created=await supabase.from("firm_suppliers").insert({
        firm_id:scope.firmId,name,category:String(body.category??"").trim()||null,contact_name:String(body.contactName??"").trim()||null,
        phone:String(body.phone??"").trim()||null,email:String(body.email??"").trim().toLowerCase()||null,tax_identifier:String(body.taxIdentifier??"").trim()||null,
        payment_details:{method:String(body.paymentMethod??"").trim()||null},created_by:scope.actorLawyerId
      }).select("*").single();
      if(created.error)throw new Error(created.error.message);return NextResponse.json({success:true,supplier:created.data},{status:201});
    }
    if(action==="create_obligation"){
      const title=String(body.title??"").trim();if(!title)return NextResponse.json({success:false,error:"Obligation title is required."},{status:400});
      const type=String(body.obligationType??"other");const allowed=["tax","registration","professional","licence","subscription","insurance","employment","premises","other"];
      const created=await supabase.from("firm_operational_obligations").insert({
        firm_id:scope.firmId,obligation_type:allowed.includes(type)?type:"other",title,authority:String(body.authority??"").trim()||null,
        description:String(body.description??"").trim()||null,frequency:String(body.frequency??"").trim()||null,due_at:body.dueAt||null,
        amount_xaf:body.amountXaf?Math.round(Number(body.amountXaf)):null,status:"upcoming",responsible_lawyer_id:body.responsibleLawyerId||null,
        external_reference:String(body.externalReference??"").trim()||null,created_by:scope.actorLawyerId
      }).select("*").single();
      if(created.error)throw new Error(created.error.message);return NextResponse.json({success:true,obligation:created.data},{status:201});
    }
    if(action==="mark_paid"){
      const id=String(body.id??"").trim();const obligation=await supabase.from("firm_operational_obligations").select("*").eq("id",id).eq("firm_id",scope.firmId).maybeSingle();
      if(obligation.error)throw new Error(obligation.error.message);if(!obligation.data)return NextResponse.json({success:false,error:"Obligation not found."},{status:404});
      const amount=Math.round(Number(body.amountXaf??obligation.data.amount_xaf??0));if(amount<=0)return NextResponse.json({success:false,error:"A positive paid amount is required."},{status:400});
      const expense=await supabase.from("firm_expenses").insert({
        firm_id:scope.firmId,matter_id:null,category:obligation.data.obligation_type,description:obligation.data.title,amount_xaf:amount,
        payment_method:String(body.paymentMethod??"").trim()||null,reference:String(body.reference??obligation.data.external_reference??"").trim()||null,
        expense_date:new Date().toISOString().slice(0,10),recoverable:false,tax_relevant:["tax","registration","professional","licence"].includes(obligation.data.obligation_type),
        status:"recorded",created_by:scope.actorLawyerId
      }).select("*").single();
      if(expense.error)throw new Error(expense.error.message);
      const ledger=await supabase.from("finance_ledger_entries").insert({
        firm_id:scope.firmId,matter_id:null,entry_type:"expense",source_table:"firm_expenses",source_id:expense.data.id,amount_xaf:amount,
        direction:"DEBIT",account_bucket:"OPERATING",status:"POSTED",description:obligation.data.title,provider_reference:expense.data.reference,
        created_by:scope.actorLawyerId,metadata:{obligation_id:id,obligation_type:obligation.data.obligation_type}
      });
      if(ledger.error)throw new Error(ledger.error.message);
      const updated=await supabase.from("firm_operational_obligations").update({
        status:"paid",expense_id:expense.data.id,amount_xaf:amount,completed_at:new Date().toISOString(),updated_at:new Date().toISOString()
      }).eq("id",id).eq("firm_id",scope.firmId).select("*").single();
      if(updated.error)throw new Error(updated.error.message);
      return NextResponse.json({success:true,obligation:updated.data,expense:expense.data});
    }
    if(action==="status"){
      const allowed=["upcoming","due","in_progress","paid","completed","overdue","waived","cancelled"];const status=String(body.status??"");
      if(!allowed.includes(status))return NextResponse.json({success:false,error:"Invalid obligation status."},{status:400});
      const updated=await supabase.from("firm_operational_obligations").update({status,updated_at:new Date().toISOString(),completed_at:["paid","completed","waived"].includes(status)?new Date().toISOString():null}).eq("id",String(body.id??"")).eq("firm_id",scope.firmId).select("*").single();
      if(updated.error)throw new Error(updated.error.message);return NextResponse.json({success:true,obligation:updated.data});
    }
    return NextResponse.json({success:false,error:"Unsupported business operations action."},{status:400});
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Business operations action failed."},{status:400})}
}

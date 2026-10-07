import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { assertFirmModule } from "@/lib/authorization";

export async function GET(request:Request){
  try{
    const scope=await resolveRequestScope(request); await assertFirmModule({scope,module:"finance"}); if(!scope.authenticated||!scope.firmId) throw new Error("Authenticated firm context is required.");
    const supabase=createServerSupabaseClient(); if(!supabase) throw new Error("Supabase server configuration is required.");
    const [expenses,invoices,ledger,matters,clientMoney,obligations]=await Promise.all([
      supabase.from("firm_expenses").select("*").eq("firm_id",scope.firmId).order("expense_date",{ascending:false}).limit(500),
      supabase.from("invoices").select("id,matter_id,invoice_number,amount_xaf,paid_xaf,status,due_date,created_at").eq("firm_id",scope.firmId).order("created_at",{ascending:false}).limit(500),
      supabase.from("finance_ledger_entries").select("*").eq("firm_id",scope.firmId).order("created_at",{ascending:false}).limit(500),
      supabase.from("matters").select("id,title,client_name,status").eq("firm_id",scope.firmId).order("updated_at",{ascending:false}).limit(300),
      supabase.from("client_money_transactions").select("*").eq("firm_id",scope.firmId).order("occurred_at",{ascending:false}).limit(500),
      supabase.from("firm_operational_obligations").select("id,title,obligation_type,status,due_at,amount_xaf").eq("firm_id",scope.firmId).order("due_at",{ascending:true}).limit(300)
    ]);
    for(const r of [expenses,invoices,ledger,matters,clientMoney,obligations]) if(r.error) throw new Error(r.error.message);
    const e=expenses.data??[], i=invoices.data??[], l=ledger.data??[], cm=clientMoney.data??[], ob=obligations.data??[];
    const metrics={
      officeExpenses:e.filter((x:any)=>!x.matter_id&&x.status!=="void").reduce((s:number,x:any)=>s+Number(x.amount_xaf??0),0),
      caseExpenses:e.filter((x:any)=>x.matter_id&&x.status!=="void").reduce((s:number,x:any)=>s+Number(x.amount_xaf??0),0),
      billed:i.reduce((s:number,x:any)=>s+Number(x.amount_xaf??0),0),
      outstanding:i.reduce((s:number,x:any)=>s+Math.max(0,Number(x.amount_xaf??0)-Number(x.paid_xaf??0)),0),
      cashIn:l.filter((x:any)=>x.direction==="CREDIT").reduce((s:number,x:any)=>s+Number(x.amount_xaf??0),0),
      cashOut:l.filter((x:any)=>x.direction==="DEBIT").reduce((s:number,x:any)=>s+Number(x.amount_xaf??0),0),
      clientMoneyHeld:cm.filter((x:any)=>x.status!=="reversed").reduce((s:number,x:any)=>s+(x.direction==="in"?Number(x.amount_xaf??0):-Number(x.amount_xaf??0)),0),
      upcomingObligations:ob.filter((x:any)=>!["paid","completed","waived","cancelled"].includes(String(x.status))).length
    };
    return NextResponse.json({success:true,metrics,expenses:e,invoices:i,ledger:l,matters:matters.data??[],clientMoney:cm,obligations:ob});
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to load firm business."},{status:403})}
}

export async function POST(request:Request){
  try{
    const scope=await resolveRequestScope(request); await assertFirmModule({scope,module:"finance"}); if(!scope.authenticated||!scope.firmId||!scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const supabase=createServerSupabaseClient(); if(!supabase) throw new Error("Supabase server configuration is required.");
    const body=await request.json();
    if(String(body.action??"")==="client_money"){
      const amount=Number(body.amountXaf??0); if(!Number.isFinite(amount)||amount<=0) throw new Error("A positive amount is required.");
      const type=String(body.transactionType??"received"); const allowed=["received","released","refunded","transferred","adjustment"];
      if(!allowed.includes(type)) return NextResponse.json({success:false,error:"Unsupported client money transaction."},{status:400});
      const direction=["received"].includes(type)?"in":"out";
      const created=await supabase.from("client_money_transactions").insert({
        firm_id:scope.firmId,matter_id:body.matterId||null,party_id:body.partyId||null,transaction_type:type,amount_xaf:Math.round(amount),direction,
        payment_method:String(body.paymentMethod??"").trim()||null,reference:String(body.reference??"").trim()||null,
        purpose:String(body.purpose??"Client money").trim()||"Client money",status:"recorded",created_by:scope.actorLawyerId
      }).select("*").single();
      if(created.error) throw new Error(created.error.message);
      return NextResponse.json({success:true,clientMoney:created.data},{status:201});
    }
    const amount=Number(body.amountXaf??0); if(!Number.isFinite(amount)||amount<=0) throw new Error("A positive amount is required.");
    const created=await supabase.from("firm_expenses").insert({
      firm_id:scope.firmId,matter_id:body.matterId||null,category:String(body.category??"office"),
      supplier_name:String(body.supplierName??"").trim()||null,description:String(body.description??"").trim()||"Firm expense",
      amount_xaf:Math.round(amount),payment_method:String(body.paymentMethod??"").trim()||null,reference:String(body.reference??"").trim()||null,
      expense_date:body.expenseDate||new Date().toISOString().slice(0,10),recoverable:Boolean(body.recoverable),tax_relevant:Boolean(body.taxRelevant),
      status:"recorded",created_by:scope.actorLawyerId
    }).select("*").single();
    if(created.error) throw new Error(created.error.message);
    const ledger=await supabase.from("finance_ledger_entries").insert({
      firm_id:scope.firmId,matter_id:body.matterId||null,entry_type:body.matterId?"disbursement":"expense",source_table:"firm_expenses",
      source_id:created.data.id,amount_xaf:Math.round(amount),direction:"DEBIT",account_bucket:body.matterId?"DISBURSEMENT":"OPERATING",
      status:"POSTED",description:created.data.description,provider_reference:created.data.reference,created_by:scope.actorLawyerId,metadata:{category:created.data.category}
    });
    if(ledger.error) throw new Error(ledger.error.message);
    return NextResponse.json({success:true,expense:created.data},{status:201});
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to record expense."},{status:400})}
}

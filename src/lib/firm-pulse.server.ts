import { createServerSupabaseClient } from "@/lib/supabase-server";
import { assertFirmPermission } from "@/lib/authorization";
import type { RequestScope } from "@/lib/request-scope";

type AttentionSeverity="critical"|"high"|"medium";
type AttentionItem={matterId:string;matterTitle:string;clientName:string;severity:AttentionSeverity;kind:string;label:string;detail:string};

function dueSeverity(dueAt:string|null){
 if(!dueAt)return null;
 const hours=(new Date(dueAt).getTime()-Date.now())/36e5;
 if(hours<0)return"critical" as const;
 if(hours<=24)return"critical" as const;
 if(hours<=72)return"high" as const;
 if(hours<=168)return"medium" as const;
 return null;
}

export async function getFirmPulse(scope:RequestScope){
 await assertFirmPermission({scope,permission:"manageFirm"});
 if(!scope.firmId)throw new Error("Authenticated firm context is required.");
 const supabase=createServerSupabaseClient();if(!supabase)throw new Error("Supabase persistence is required.");
 const mattersResult=await supabase.from("matters").select("id,title,client_name,status,risk_level,jurisdiction,record_state").eq("firm_id",scope.firmId).eq("record_state","active").order("updated_at",{ascending:false}).limit(500);
 if(mattersResult.error)throw new Error(mattersResult.error.message);
 const matters=mattersResult.data??[];
 const ids=matters.map(x=>x.id);
 const empty={data:[],error:null} as {data:never[];error:null};
 const [obligations,approvals,invoices,payments,timeEntries,expenses,communications,claims,executions,packs]=await Promise.all([
  ids.length?supabase.from("matter_obligations").select("id,matter_id,title,due_at,status,consequence,legal_basis").in("matter_id",ids).in("status",["OPEN","IN_PROGRESS","MISSED"]):Promise.resolve(empty),
  ids.length?supabase.from("matter_approvals").select("id,matter_id,approval_type,subject_type,status,requested_at").in("matter_id",ids).eq("status","PENDING"):Promise.resolve(empty),
  ids.length?supabase.from("invoices").select("id,matter_id,amount_xaf,status,due_date").in("matter_id",ids):Promise.resolve(empty),
  ids.length?supabase.from("matter_payments").select("id,matter_id,amount_xaf,status").in("matter_id",ids):Promise.resolve(empty),
  ids.length?supabase.from("matter_time_entries").select("matter_id,minutes,billable,billing_status,hourly_rate_xaf").in("matter_id",ids).eq("billable",true).eq("billing_status","unbilled"):Promise.resolve(empty),
  ids.length?supabase.from("firm_expenses").select("matter_id,amount_xaf,recoverable,status").in("matter_id",ids).eq("recoverable",true).neq("status","void"):Promise.resolve(empty),
  ids.length?supabase.from("matter_communication_ingest").select("matter_id,processing_status").in("matter_id",ids).eq("processing_status","review_required"):Promise.resolve(empty),
  ids.length?supabase.from("matter_legal_claims").select("matter_id,verification_status").in("matter_id",ids).in("verification_status",["unverified","disputed"]):Promise.resolve(empty),
  ids.length?supabase.from("matter_execution_actions").select("matter_id,title,status,last_error,target_system,execution_mode").in("matter_id",ids).in("status",["awaiting_approval","failed"]):Promise.resolve(empty),
  supabase.from("jurisdiction_packs").select("jurisdiction_key,status,firm_id,source_scope").eq("status","active"),
 ]);
 for(const result of[obligations,approvals,invoices,payments,timeEntries,expenses,communications,claims,executions,packs])if(result.error)throw new Error(result.error.message);
 const byId=new Map(matters.map(m=>[m.id,m]));
 const items:AttentionItem[]=[];
 const push=(matterId:string,severity:AttentionSeverity,kind:string,label:string,detail:string)=>{const matter=byId.get(matterId);if(!matter)return;items.push({matterId,matterTitle:matter.title,clientName:matter.client_name,severity,kind,label,detail});};

 for(const m of matters){
  const risk=String(m.risk_level??"").toLowerCase();
  if(["critical","high"].includes(risk))push(m.id,risk==="critical"?"critical":"high","risk",`${m.risk_level} risk matter`,`Current matter risk is marked ${m.risk_level}.`);
 }
 for(const o of obligations.data??[]){const severity=dueSeverity(o.due_at);if(severity)push(o.matter_id,severity,"deadline",o.title,o.due_at?`Due ${new Date(o.due_at).toLocaleDateString()}${o.consequence?` · ${o.consequence}`:""}`:"Time-sensitive obligation");}
 for(const a of approvals.data??[])push(a.matter_id,"medium","approval",`${a.approval_type} approval waiting`,`${a.subject_type} has been waiting for a management/professional decision.`);

 const paidStatuses=new Set(["Paid","Confirmed","Completed","Received"]);
 const invoiceByMatter=new Map<string,number>();const paidByMatter=new Map<string,number>();
 for(const i of invoices.data??[])invoiceByMatter.set(i.matter_id,(invoiceByMatter.get(i.matter_id)??0)+Number(i.amount_xaf??0));
 for(const p of payments.data??[])if(paidStatuses.has(String(p.status)))paidByMatter.set(p.matter_id,(paidByMatter.get(p.matter_id)??0)+Number(p.amount_xaf??0));
 let outstandingXaf=0;
 for(const m of matters){const outstanding=Math.max(0,(invoiceByMatter.get(m.id)??0)-(paidByMatter.get(m.id)??0));outstandingXaf+=outstanding;if(outstanding>0)push(m.id,outstanding>=5_000_000?"high":"medium","collections","Outstanding client balance",`XAF ${outstanding.toLocaleString()} remains outstanding.`);}

 let unbilledMinutes=0,unbilledValueXaf=0,recoverableExpensesXaf=0;
 const unbilledByMatter=new Map<string,{minutes:number;value:number}>();
 for(const t of timeEntries.data??[]){const minutes=Number(t.minutes??0);const value=(minutes/60)*Number(t.hourly_rate_xaf??0);unbilledMinutes+=minutes;unbilledValueXaf+=value;const curr=unbilledByMatter.get(t.matter_id)??{minutes:0,value:0};curr.minutes+=minutes;curr.value+=value;unbilledByMatter.set(t.matter_id,curr);}
 for(const [matterId,v] of unbilledByMatter)if(v.minutes>=480||v.value>=500_000)push(matterId,"medium","billing","Material unbilled work",`${v.minutes} minute(s) / about XAF ${Math.round(v.value).toLocaleString()} not yet billed.`);
 const recoverableByMatter=new Map<string,number>();
 for(const e of expenses.data??[]){const amount=Number(e.amount_xaf??0);recoverableExpensesXaf+=amount;recoverableByMatter.set(e.matter_id,(recoverableByMatter.get(e.matter_id)??0)+amount);}
 for(const [matterId,amount] of recoverableByMatter)if(amount>=250_000)push(matterId,"medium","expenses","Recoverable expenses pending",`XAF ${amount.toLocaleString()} recoverable case expenses remain open.`);

 const countByMatter=(rows:Array<{matter_id:string}>)=>{const map=new Map<string,number>();for(const r of rows)map.set(r.matter_id,(map.get(r.matter_id)??0)+1);return map;};
 for(const [matterId,count] of countByMatter(communications.data??[]))push(matterId,"medium","communications","Communication review queue",`${count} communication item(s) may contain instructions or evidence and need review.`);
 for(const [matterId,count] of countByMatter(claims.data??[]))push(matterId,"medium","evidence","Unresolved legal/factual propositions",`${count} proposition(s) remain unverified or disputed.`);
 for(const e of executions.data??[])push(e.matter_id,e.status==="failed"?"high":"medium","execution",e.status==="failed"?"Execution failed":"Execution awaiting approval",`${e.title}${e.last_error?` · ${e.last_error}`:e.target_system?` · ${e.target_system}`:""}`);

 const activePackKeys=(packs.data??[]).map(p=>String(p.jurisdiction_key??"").toLowerCase());
 for(const m of matters){const j=String(m.jurisdiction??"").trim();if(j&&!activePackKeys.some(key=>key.includes(j.toLowerCase())||j.toLowerCase().includes(key)))push(m.id,"medium","jurisdiction","Jurisdiction coverage gap",`No active reviewed jurisdiction pack currently matches ${j}.`);}

 const severityOrder={critical:0,high:1,medium:2};
 items.sort((a,b)=>severityOrder[a.severity]-severityOrder[b.severity]);
 const attentionMatterIds=new Set(items.map(x=>x.matterId));
 return {
  generatedAt:new Date().toISOString(),
  summary:{activeMatters:matters.length,attentionMatters:attentionMatterIds.size,criticalItems:items.filter(x=>x.severity==="critical").length,highItems:items.filter(x=>x.severity==="high").length,pendingApprovals:(approvals.data??[]).length,outstandingXaf,unbilledMinutes,unbilledValueXaf:Math.round(unbilledValueXaf),recoverableExpensesXaf,communicationReview:(communications.data??[]).length,unresolvedClaims:(claims.data??[]).length,executionBlocks:(executions.data??[]).length},
  attention:items.slice(0,30)
 };
}

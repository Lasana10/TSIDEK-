import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { RequestScope } from "@/lib/request-scope";
import { getMatterCommandCenter } from "@/lib/matter-command-center.server";
import { getMatterAdaptiveRuntime } from "@/lib/matter-adaptive-runtime";
import { getMatterIntelligence } from "@/lib/matter-intelligence.server";

export type MatterOperatingStage={key:string;label:string;state:"complete"|"active"|"attention"|"waiting";detail:string;count?:number};

export async function getMatterOperatingSystem(input:{matterId:string;scope:RequestScope}){
 const supabase=createServerSupabaseClient();if(!supabase)throw new Error("Supabase persistence is required.");
 const [command,adaptive,intelligence,workstreams,milestones,executions,outcomes,timeEntries,expenses]=await Promise.all([
  getMatterCommandCenter(input),
  getMatterAdaptiveRuntime(input),
  getMatterIntelligence(input),
  supabase.from("matter_workstreams").select("id,name,status,sequence_no").eq("matter_id",input.matterId).order("sequence_no"),
  supabase.from("matter_milestones").select("id,title,status,sequence_no,due_at").eq("matter_id",input.matterId).order("sequence_no"),
  supabase.from("matter_execution_actions").select("id,title,status,execution_mode,target_system,due_at,external_reference,evidence_reference,last_error").eq("matter_id",input.matterId).order("created_at",{ascending:false}),
  supabase.from("matter_outcomes").select("id,title,knowledge_status,client_result,reusable_lesson,result_summary,precedent_candidate").eq("matter_id",input.matterId).order("created_at",{ascending:false}),
  supabase.from("matter_time_entries").select("minutes,billable,billing_status,hourly_rate_xaf").eq("matter_id",input.matterId),
  supabase.from("firm_expenses").select("amount_xaf,recoverable,status").eq("matter_id",input.matterId),
 ]);
 for(const result of [workstreams,milestones,executions,outcomes,timeEntries,expenses])if(result.error)throw new Error(result.error.message);
 const ws=workstreams.data??[],ms=milestones.data??[],ex=executions.data??[],oc=outcomes.data??[];
 const time=timeEntries.data??[],expenseRows=expenses.data??[];
 const activePlan=ws.filter(x=>x.status!=="cancelled");
 const openWork=activePlan.filter(x=>x.status!=="completed");
 const verifiedEvidence=adaptive.evidence.filter((x:{verification_status:string})=>x.verification_status==="verified"||x.verification_status==="corroborated");
 const approvedDecisions=adaptive.decisions.filter((x:{status:string})=>x.status==="approved");
 const confirmedInstructions=adaptive.instructions.filter((x:{confirmation_status:string})=>x.confirmation_status==="confirmed");
 const activeExecutions=ex.filter(x=>!["completed","cancelled"].includes(x.status));
 const completedExecutions=ex.filter(x=>x.status==="completed");
 const verifiedClaims=intelligence.verifiedClaims.length;
 const commsReview=intelligence.reviewCommunications.length;
 const hasJurisdictionPack=intelligence.jurisdictionPacks.length>0;
 const approvedKnowledge=intelligence.knowledge.length;
 const unbilledTime=time.filter(x=>x.billable&&x.billing_status==="unbilled");
 const unbilledMinutes=unbilledTime.reduce((sum,x)=>sum+Number(x.minutes||0),0);
 const unbilledTimeValueXaf=Math.round(unbilledTime.reduce((sum,x)=>sum+(Number(x.minutes||0)/60)*Number(x.hourly_rate_xaf||0),0));
 const recoverableExpensesXaf=expenseRows.filter(x=>x.recoverable&&x.status!=="void").reduce((sum,x)=>sum+Number(x.amount_xaf||0),0);
 const totalCaseExpensesXaf=expenseRows.filter(x=>x.status!=="void").reduce((sum,x)=>sum+Number(x.amount_xaf||0),0);
 const economics={...command.finance,unbilledMinutes,unbilledTimeValueXaf,recoverableExpensesXaf,totalCaseExpensesXaf,draftBillBasisXaf:unbilledTimeValueXaf+recoverableExpensesXaf};
 const moneyAttention=command.finance.outstandingXaf>0||unbilledMinutes>0||recoverableExpensesXaf>0;
 const moneyDetail=command.finance.outstandingXaf>0?`XAF ${command.finance.outstandingXaf.toLocaleString()} outstanding`:unbilledMinutes>0?`${unbilledMinutes} unbilled minute(s) · XAF ${economics.draftBillBasisXaf.toLocaleString()} draft billing basis`:recoverableExpensesXaf>0?`XAF ${recoverableExpensesXaf.toLocaleString()} recoverable expenses not yet cleared`:"Billing, collections and recoverable expenses are current";
 const stages:MatterOperatingStage[]=[
  {key:"client",label:"Client",state:confirmedInstructions.length?"complete":commsReview?"attention":"active",detail:confirmedInstructions.length?`${confirmedInstructions.length} confirmed instruction(s)`:commsReview?`${commsReview} communication item(s) need review for instructions/evidence`:"Confirm material client instructions",count:adaptive.instructions.length},
  {key:"matter",label:"Matter",state:"complete",detail:command.matter.title},
  {key:"understanding",label:"Understanding",state:verifiedClaims||verifiedEvidence.length?"complete":(intelligence.claims.length||adaptive.evidence.length)?"attention":"active",detail:verifiedClaims?`${verifiedClaims} verified legal/factual claim(s)`:verifiedEvidence.length?`${verifiedEvidence.length} verified/corroborated evidence item(s)`:"Build and verify the factual, evidential and legal record",count:intelligence.claims.length+adaptive.evidence.length},
  {key:"jurisdiction",label:"Jurisdiction",state:hasJurisdictionPack?"complete":"attention",detail:hasJurisdictionPack?`${intelligence.jurisdictionPacks.length} active jurisdiction pack(s) matched`:"No active reviewed jurisdiction pack matched this matter",count:intelligence.jurisdictionPacks.length},
  {key:"plan",label:"Plan",state:activePlan.length?"complete":"attention",detail:activePlan.length?`${activePlan.length} governed workstream(s)`:"Matter plan needs workstreams",count:activePlan.length},
  {key:"work",label:"Work",state:openWork.length?"active":activePlan.length?"complete":"waiting",detail:openWork.length?`${openWork.length} open workstream(s)`:activePlan.length?"Planned workstreams completed":"No governed workstreams planned yet",count:openWork.length},
  {key:"judgment",label:"Judgment",state:approvedDecisions.length?"complete":adaptive.decisions.length?"attention":"active",detail:approvedDecisions.length?`${approvedDecisions.length} approved decision(s)`:"Record and approve material professional decisions",count:adaptive.decisions.length},
  {key:"approval",label:"Approval",state:command.summary.pendingApprovals?"attention":"complete",detail:command.summary.pendingApprovals?`${command.summary.pendingApprovals} approval(s) waiting`:"No pending approval bottleneck",count:command.summary.pendingApprovals},
  {key:"execution",label:"Execution",state:activeExecutions.length?"active":completedExecutions.length?"complete":"waiting",detail:activeExecutions.length?`${activeExecutions.length} execution action(s) open`:completedExecutions.length?`${completedExecutions.length} execution action(s) completed`:"No governed execution action yet",count:ex.length},
  {key:"money",label:"Money",state:moneyAttention?"attention":"complete",detail:moneyDetail},
  {key:"outcome",label:"Outcome",state:oc.length?"complete":"waiting",detail:oc.length?oc[0].title:"Outcome not yet recorded",count:oc.length},
  {key:"knowledge",label:"Knowledge",state:approvedKnowledge?"complete":oc.some(x=>x.knowledge_status==="approved_internal")?"active":oc.length?"active":"waiting",detail:approvedKnowledge?`${approvedKnowledge} approved firm knowledge entr${approvedKnowledge===1?"y":"ies"}`:oc.some(x=>x.knowledge_status==="approved_internal")?"Approved outcome is ready to promote into firm knowledge":oc.length?"Review outcome for reusable knowledge":"No reusable outcome captured"},
 ];
 return {stages,command,adaptive,intelligence,economics,workstreams:ws,milestones:ms,executions:ex,outcomes:oc};
}

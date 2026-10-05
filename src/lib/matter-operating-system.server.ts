import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { RequestScope } from "@/lib/request-scope";
import { getMatterCommandCenter } from "@/lib/matter-command-center.server";
import { getMatterAdaptiveRuntime } from "@/lib/matter-adaptive-runtime";

export type MatterOperatingStage={key:string;label:string;state:"complete"|"active"|"attention"|"waiting";detail:string;count?:number};

export async function getMatterOperatingSystem(input:{matterId:string;scope:RequestScope}){
 const supabase=createServerSupabaseClient();if(!supabase)throw new Error("Supabase persistence is required.");
 const [command,adaptive,workstreams,milestones,executions,outcomes]=await Promise.all([
  getMatterCommandCenter(input),
  getMatterAdaptiveRuntime(input),
  supabase.from("matter_workstreams").select("id,name,status,sequence_no").eq("matter_id",input.matterId).order("sequence_no"),
  supabase.from("matter_milestones").select("id,title,status,sequence_no,due_at").eq("matter_id",input.matterId).order("sequence_no"),
  supabase.from("matter_execution_actions").select("id,title,status,execution_mode,target_system,due_at").eq("matter_id",input.matterId).order("created_at",{ascending:false}),
  supabase.from("matter_outcomes").select("id,title,knowledge_status,client_result,reusable_lesson").eq("matter_id",input.matterId).order("created_at",{ascending:false}),
 ]);
 for(const result of [workstreams,milestones,executions,outcomes])if(result.error)throw new Error(result.error.message);
 const ws=workstreams.data??[],ms=milestones.data??[],ex=executions.data??[],oc=outcomes.data??[];
 const openWork=ws.filter(x=>x.status!=="completed"&&x.status!=="cancelled");
 const verifiedEvidence=adaptive.evidence.filter((x:{verification_status:string})=>x.verification_status==="verified"||x.verification_status==="corroborated");
 const approvedDecisions=adaptive.decisions.filter((x:{status:string})=>x.status==="approved");
 const confirmedInstructions=adaptive.instructions.filter((x:{confirmation_status:string})=>x.confirmation_status==="confirmed");
 const activeExecutions=ex.filter(x=>!["completed","cancelled"].includes(x.status));
 const completedExecutions=ex.filter(x=>x.status==="completed");
 const stages:MatterOperatingStage[]=[
  {key:"client",label:"Client",state:confirmedInstructions.length?"complete":"active",detail:confirmedInstructions.length?`${confirmedInstructions.length} confirmed instruction(s)`:"Confirm material client instructions",count:adaptive.instructions.length},
  {key:"matter",label:"Matter",state:"complete",detail:command.matter.title},
  {key:"understanding",label:"Understanding",state:verifiedEvidence.length?"complete":adaptive.evidence.length?"attention":"active",detail:verifiedEvidence.length?`${verifiedEvidence.length} verified/corroborated evidence item(s)`:"Verify the factual and evidential record",count:adaptive.evidence.length},
  {key:"plan",label:"Plan",state:ws.length?"complete":"attention",detail:ws.length?`${ws.length} governed workstream(s)`:"Matter plan needs workstreams",count:ws.length},
  {key:"work",label:"Work",state:openWork.length?"active":"complete",detail:openWork.length?`${openWork.length} open workstream(s)`:"Planned workstreams completed",count:openWork.length},
  {key:"judgment",label:"Judgment",state:approvedDecisions.length?"complete":adaptive.decisions.length?"attention":"active",detail:approvedDecisions.length?`${approvedDecisions.length} approved decision(s)`:"Record and approve material professional decisions",count:adaptive.decisions.length},
  {key:"approval",label:"Approval",state:command.summary.pendingApprovals?"attention":"complete",detail:command.summary.pendingApprovals?`${command.summary.pendingApprovals} approval(s) waiting`:"No pending approval bottleneck",count:command.summary.pendingApprovals},
  {key:"execution",label:"Execution",state:activeExecutions.length?"active":completedExecutions.length?"complete":"waiting",detail:activeExecutions.length?`${activeExecutions.length} execution action(s) open`:completedExecutions.length?`${completedExecutions.length} execution action(s) completed`:"No governed execution action yet",count:ex.length},
  {key:"money",label:"Money",state:command.finance.outstandingXaf>0?"attention":"complete",detail:command.finance.outstandingXaf>0?`XAF ${command.finance.outstandingXaf.toLocaleString()} outstanding`:"No outstanding invoiced balance"},
  {key:"outcome",label:"Outcome",state:oc.length?"complete":"waiting",detail:oc.length?oc[0].title:"Outcome not yet recorded",count:oc.length},
  {key:"knowledge",label:"Knowledge",state:oc.some(x=>x.knowledge_status==="approved_internal")?"complete":oc.length?"active":"waiting",detail:oc.some(x=>x.knowledge_status==="approved_internal")?"Reusable knowledge approved":oc.length?"Review outcome for reusable knowledge":"No reusable outcome captured"},
 ];
 return {stages,command,adaptive,workstreams:ws,milestones:ms,executions:ex,outcomes:oc};
}

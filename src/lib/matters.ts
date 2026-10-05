import { createClient } from "@supabase/supabase-js";
import { getSupabasePublishableKey } from "@/lib/supabase-config";
import { isDemoModeEnabled } from "@/lib/runtime-mode";

export type MatterTimelineItem = { date: string; title: string; owner: string };
export type MatterDocument = { name: string; type: string; state: string };
export type MatterCollaborationItem = { actor: string; role: string; note: string };
export type MatterWorkstream = { id: string; name: string; type: string; status: string; sequence: number; objective?: string };
export type MatterMilestone = { id: string; title: string; status: string; sequence: number; dueAt?: string; sourceKind?: string; sourceDetail?: string };

export type MatterWorkspaceData = {
  id: string; title: string; clientName: string; matterType: string; status: string; riskLevel: string; jurisdiction: string;
  leadLawyer: string; projectManager: string; physicalFileId: string; physicalLabel: string; physicalLocation: string; physicalCustody: string;
  synopsis: string; primaryTrack: string; riskToMonitor: string; aiUsageRule: string; nextDraft: string;
  engagementNature?: string; practiceArea?: string; serviceType?: string; clientObjective?: string; planLabel?: string;
  workstreams?: MatterWorkstream[]; milestones?: MatterMilestone[];
  timeline: MatterTimelineItem[]; documents: MatterDocument[]; researchNotes: string[]; collaboration: MatterCollaborationItem[];
  governanceChecks: string[]; approvedTools: string; escalationTrigger: string; trainingOwner: string; reviewForum: string;
  mentorshipPair: string; mentorshipFocus: string; mentorshipRhythm: string;
  securityClassification: "Standard" | "Confidential" | "Partner-only"; ethicalWallEnabled: boolean;
};

type MatterRow = {
  id:string; title:string; client_name:string; status:string|null; risk_level:string|null; jurisdiction:string|null; matter_type?:string|null;
  synopsis?:string|null; primary_track?:string|null; next_draft?:string|null; risk_to_monitor?:string|null; ai_usage_rule?:string|null;
  lead_lawyer_id:string|null; security_classification:MatterWorkspaceData["securityClassification"]|null; ethical_wall_enabled:boolean|null; case_reference:string|null;
  record_state?:string|null; engagement_nature?:string|null; practice_area?:string|null; service_type?:string|null; client_objective?:string|null; plan_label?:string|null;
};
type LawyerRow={id:string;full_name:string;role:string|null};
type TaskRow={matter_id:string;title:string;deadline:string|null;status:string|null};
type DocumentRow={matter_id:string;title?:string|null;name?:string|null;document_type?:string|null;status?:string|null};
type WorkstreamRow={id:string;matter_id:string;name:string;workstream_type:string;status:string;sequence_no:number;objective?:string|null};
type MilestoneRow={id:string;matter_id:string;title:string;status:string;sequence_no:number;due_at?:string|null;source_kind?:string|null;source_detail?:string|null};

export function buildMatterWorkspaceRecord(matter:MatterRow,lawyer?:LawyerRow,tasks:TaskRow[]=[],documents:DocumentRow[]=[],workstreams:WorkstreamRow[]=[],milestones:MilestoneRow=[]):MatterWorkspaceData{
 const matterTasks=tasks.filter(t=>t.matter_id===matter.id);
 const matterDocs=documents.filter(d=>d.matter_id===matter.id);
 const matterWorkstreams=workstreams.filter(w=>w.matter_id===matter.id).sort((a,b)=>a.sequence_no-b.sequence_no);
 const matterMilestones=milestones.filter(m=>m.matter_id===matter.id).sort((a,b)=>a.sequence_no-b.sequence_no);
 const type=matter.matter_type?.trim()||matter.service_type?.trim()||"General legal matter";
 const synopsis=matter.synopsis?.trim()||matter.client_objective?.trim()||"Matter scope and instructions are being confirmed.";
 return {
  id:matter.id,title:matter.title,clientName:matter.client_name,matterType:type,status:matter.status??"Onboarding",riskLevel:matter.risk_level??"Medium",jurisdiction:matter.jurisdiction??"Cameroon",
  leadLawyer:lawyer?.full_name??"Unassigned",projectManager:"Matter team",physicalFileId:matter.case_reference??`TSK-${matter.id.slice(0,8).toUpperCase()}`,
  physicalLabel:`${matter.client_name} — ${matter.title}`,physicalLocation:"Registry / check custody record",physicalCustody:"Registered",synopsis,
  primaryTrack:matter.primary_track?.trim()||matter.plan_label?.trim()||"Matter plan",riskToMonitor:matter.risk_to_monitor?.trim()||"Confirm material legal and factual risks",
  aiUsageRule:matter.ai_usage_rule?.trim()||"AI suggestions require human review",nextDraft:matter.next_draft?.trim()||matterTasks.find(t=>t.status!=="Done")?.title||"Confirm matter scope and next professional action",
  engagementNature:matter.engagement_nature?.trim()||"custom",practiceArea:matter.practice_area?.trim()||undefined,serviceType:matter.service_type?.trim()||type,
  clientObjective:matter.client_objective?.trim()||synopsis,planLabel:matter.plan_label?.trim()||matter.primary_track?.trim()||"Matter plan",
  workstreams:matterWorkstreams.map(w=>({id:w.id,name:w.name,type:w.workstream_type,status:w.status,sequence:w.sequence_no,objective:w.objective??undefined})),
  milestones:matterMilestones.map(m=>({id:m.id,title:m.title,status:m.status,sequence:m.sequence_no,dueAt:m.due_at??undefined,sourceKind:m.source_kind??undefined,sourceDetail:m.source_detail??undefined})),
  timeline:matterTasks.map(t=>({date:t.deadline??"Unscheduled",title:t.title,owner:lawyer?.full_name??"Matter team"})),
  documents:matterDocs.map(d=>({name:d.title??d.name??"Matter document",type:d.document_type??"Document",state:d.status??"Recorded"})),
  researchNotes:[],collaboration:[],governanceChecks:["Professional review before external reliance","Client instructions and material decisions must be recorded"],approvedTools:"Firm-approved tools only",escalationTrigger:"Material risk, deadline, authority or client decision requires attention",trainingOwner:"Supervising lawyer",reviewForum:"Matter review",mentorshipPair:"Assigned by firm",mentorshipFocus:"Professional judgment and execution",mentorshipRhythm:"As required",
  securityClassification:matter.security_classification??"Standard",ethicalWallEnabled:Boolean(matter.ethical_wall_enabled)
 };
}

export const seededMatterWorkspaceRecords:MatterWorkspaceData[]=[];

export async function loadMattersFromSupabase(firmId?:string):Promise<MatterWorkspaceData[]|null>{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=getSupabasePublishableKey(); if(!url||!key)return null;
 const supabase=createClient(url,key); let query=supabase.from("matters").select("id,title,client_name,status,risk_level,jurisdiction,matter_type,synopsis,primary_track,next_draft,risk_to_monitor,ai_usage_rule,lead_lawyer_id,security_classification,ethical_wall_enabled,case_reference,record_state,engagement_nature,practice_area,service_type,client_objective,plan_label").order("created_at",{ascending:false});
 if(firmId)query=query.eq("firm_id",firmId); query=query.eq("record_state","active"); const result=await query; if(result.error)return null;
 return (result.data??[]).map(row=>buildMatterWorkspaceRecord(row as MatterRow));
}

export async function getMatterById(id:string,firmId?:string){const matters=await loadMattersFromSupabase(firmId);if(matters)return matters.find(m=>m.id===id)??null;if(!isDemoModeEnabled())return null;return seededMatterWorkspaceRecords.find(m=>m.id===id)??null;}

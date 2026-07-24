import { createClient } from "@supabase/supabase-js";
import { getSupabasePublishableKey } from "@/lib/supabase-config";

export type MatterTimelineItem = {
  date: string;
  title: string;
  owner: string;
};

export type MatterDocument = {
  name: string;
  type: string;
  state: string;
};

export type MatterCollaborationItem = {
  actor: string;
  role: string;
  note: string;
};

export type MatterWorkspaceData = {
  id: string;
  title: string;
  clientName: string;
  matterType: string;
  status: string;
  riskLevel: string;
  jurisdiction: string;
  leadLawyer: string;
  projectManager: string;
  physicalFileId: string;
  physicalLabel: string;
  physicalLocation: string;
  physicalCustody: string;
  synopsis: string;
  primaryTrack: string;
  riskToMonitor: string;
  aiUsageRule: string;
  nextDraft: string;
  timeline: MatterTimelineItem[];
  documents: MatterDocument[];
  researchNotes: string[];
  collaboration: MatterCollaborationItem[];
  governanceChecks: string[];
  approvedTools: string;
  escalationTrigger: string;
  trainingOwner: string;
  reviewForum: string;
  mentorshipPair: string;
  mentorshipFocus: string;
  mentorshipRhythm: string;
  securityClassification: "Standard" | "Confidential" | "Partner-only";
  ethicalWallEnabled: boolean;
};

type MatterRow = {
  id: string;
  title: string;
  client_name: string;
  status: string | null;
  risk_level: string | null;
  jurisdiction: string | null;
  lead_lawyer_id: string | null;
  security_classification: MatterWorkspaceData["securityClassification"] | null;
  ethical_wall_enabled: boolean | null;
};

type LawyerRow = {
  id: string;
  full_name: string;
  role: string | null;
};

type TaskRow = {
  matter_id: string;
  title: string;
  deadline: string | null;
  is_completed: boolean | null;
};

type DocumentRow = {
  matter_id: string;
  title: string;
  ai_summary: string | null;
  requires_compliance_audit: boolean | null;
  created_at: string | null;
};

export const seededMatterWorkspaceRecords: MatterWorkspaceData[] = [
  {
    id: "tsk-cm-2026-041",
    title: "K-Metal SARL Debt Recovery",
    clientName: "K-Metal SARL",
    matterType: "Debt recovery / OHADA",
    status: "Pre-filing coordination",
    riskLevel: "Medium",
    jurisdiction: "Douala Commercial Chamber",
    leadLawyer: "Sarah Mvondo",
    projectManager: "Amina Bello",
    physicalFileId: "TSK-CM-2026-041",
    physicalLabel: "Blue archive jacket",
    physicalLocation: "Shelf B2 / Cabinet 4",
    physicalCustody: "Paralegal desk sign-out",
    synopsis:
      "K-Metal SARL is pursuing structured debt recovery after unsuccessful amicable follow-up. The matter is currently in pre-filing coordination, with service documents, exhibit pack, bilingual drafting, and hearing dependencies being aligned in one workspace.",
    primaryTrack: "Formal debt recovery with early pressure on service sequence",
    riskToMonitor: "Holiday overlap and missing certificate from prior exchange",
    aiUsageRule: "Suggestions visible, never final without lawyer review",
    nextDraft: "Partner-ready assignation with bilingual annex summary",
    timeline: [
      { date: "19 Jun", title: "Assignation finalized", owner: "Lead Lawyer" },
      { date: "21 Jun", title: "Bailiff service follow-up", owner: "Project Manager" },
      { date: "25 Jun", title: "Opposition deadline review", owner: "Partner" },
    ],
    documents: [
      { name: "Assignation_Paiement.docx", type: "Drafting", state: "Ready for partner review" },
      { name: "Mise_en_Demeure.pdf", type: "Evidence", state: "Stamped and indexed" },
      { name: "Board_Resolution.pdf", type: "Corporate", state: "Needs translation check" },
    ],
    researchNotes: [
      "OHADA debt recovery path confirmed under AUPSRVE sequence.",
      "Cameroon procedural holiday overlap requires manual human confirmation.",
      "Comparable commercial chamber reasoning found in 2024 Douala decision set.",
    ],
    collaboration: [
      { actor: "Amina Bello", role: "Project Manager", note: "Aligned hearing pack owners and renamed missing exhibits." },
      { actor: "Marie Ekani", role: "Intern", note: "Added precedent extracts and bilingual clause alternatives." },
      { actor: "Sarah Mvondo", role: "Partner", note: "Requested a tighter damages narrative before final approval." },
    ],
    governanceChecks: [
      "Confidentiality scope restricted to assigned matter team",
      "AI-assisted notes require human sign-off before client output",
      "Physical file custody and retrieval chain logged",
      "Internal training owner assigned for junior review handoff",
    ],
    approvedTools: "TSIDEK workspace, local drafting engine, firm cloud vault",
    escalationTrigger: "Any external dispatch requires partner-approved final state",
    trainingOwner: "Project manager confirms onboarding to matter workflow",
    reviewForum: "Weekly firm review includes active risks and team bottlenecks",
    mentorshipPair: "Marie Ekani shadowing Sarah Mvondo for pleadings logic",
    mentorshipFocus: "OHADA service sequence and bilingual annex standards",
    mentorshipRhythm: "15-minute weekly matter debrief with PM and lead lawyer",
    securityClassification: "Confidential",
    ethicalWallEnabled: true,
  },
  {
    id: "tsk-cm-2026-042",
    title: "Nexa Assurance Coverage Dispute",
    clientName: "Nexa Assurance",
    matterType: "Insurance recovery / Advisory-litigation bridge",
    status: "Evidence consolidation",
    riskLevel: "High",
    jurisdiction: "Yaounde Civil and Commercial Division",
    leadLawyer: "John Nkoa",
    projectManager: "Amina Bello",
    physicalFileId: "TSK-CM-2026-042",
    physicalLabel: "Red urgent hearing folder",
    physicalLocation: "Litigation room / Tray 2",
    physicalCustody: "Project manager overnight hold",
    synopsis:
      "Nexa Assurance is preparing a recovery strategy that may convert from advisory posture to court action. The current workspace tracks insurer correspondence, payment chronology, and decision points for escalation.",
    primaryTrack: "Pressure insurer with record-complete dossier before filing threshold",
    riskToMonitor: "Missing claims chronology and one uncertified annex",
    aiUsageRule: "AI may summarize correspondence, but legal positioning remains lawyer-owned",
    nextDraft: "Claims chronology memo and demand package for partner review",
    timeline: [
      { date: "20 Jun", title: "Claims chronology rebuilt", owner: "Intern" },
      { date: "22 Jun", title: "Coverage memo peer review", owner: "Lawyer" },
      { date: "24 Jun", title: "Escalation decision meeting", owner: "Partner" },
    ],
    documents: [
      { name: "Claims_Chronology.xlsx", type: "Operations", state: "Needs final validation" },
      { name: "Coverage_Correspondence.pdf", type: "Evidence", state: "Fully indexed" },
      { name: "Demand_Letter_Draft.docx", type: "Drafting", state: "Awaiting partner comments" },
    ],
    researchNotes: [
      "Coverage denial language conflicts with earlier acceptance wording.",
      "Need tighter proof chain for two reimbursement schedules.",
      "Advisory posture still preserves leverage before formal proceedings.",
    ],
    collaboration: [
      { actor: "John Nkoa", role: "Lawyer", note: "Mapped insurer contradictions and tagged disputed clauses." },
      { actor: "Amina Bello", role: "Project Manager", note: "Consolidated chronology gaps and assigned evidentiary follow-up." },
      { actor: "Linda Tabi", role: "Paralegal", note: "Confirmed physical annex order against cloud folder structure." },
    ],
    governanceChecks: [
      "External collaborator access remains disabled",
      "Financial exposure summary visible only to billing-authorized roles",
      "All outgoing letters must be partner-approved",
      "Evidence handling log reconciled with physical annex pack",
    ],
    approvedTools: "TSIDEK workspace, precedent search, secure document vault",
    escalationTrigger: "If insurer fails response window, filing route moves to urgent track",
    trainingOwner: "Lead lawyer briefs junior team on insurer dispute reasoning",
    reviewForum: "Biweekly strategic review with partner and PM",
    mentorshipPair: "Linda Tabi paired with John Nkoa on chronology discipline",
    mentorshipFocus: "Claims chronology verification and document reconciliation",
    mentorshipRhythm: "Twice-weekly 10-minute checkpoint until filing decision",
    securityClassification: "Partner-only",
    ethicalWallEnabled: true,
  },
];

function createPublicSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = getSupabasePublishableKey();

  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey);
}

function formatDateLabel(value: string | null) {
  if (!value) {
    return "Pending";
  }

  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
    }).format(new Date(value));
  } catch {
    return "Pending";
  }
}

export function buildMatterWorkspaceRecord(
  matter: MatterRow,
  leadLawyer: LawyerRow | undefined,
  tasks: TaskRow[],
  documents: DocumentRow[]
): MatterWorkspaceData {
  const recentDocuments = documents.slice(0, 3).map((document) => ({
    name: document.title,
    type: document.requires_compliance_audit ? "Compliance" : "Document",
    state: document.ai_summary ? "Indexed and summarized" : "Uploaded",
  }));

  const timeline = tasks.slice(0, 3).map((task) => ({
    date: formatDateLabel(task.deadline),
    title: task.title,
    owner: leadLawyer?.full_name ?? "Assigned team member",
  }));

  return {
    id: matter.id,
    title: matter.title,
    clientName: matter.client_name,
    matterType: matter.jurisdiction === "OHADA" ? "Debt recovery / OHADA" : `${matter.jurisdiction ?? "General"} matter`,
    status: matter.status ?? "Active",
    riskLevel: matter.risk_level ?? "Medium",
    jurisdiction: matter.jurisdiction ?? "OHADA",
    leadLawyer: leadLawyer?.full_name ?? "Unassigned lead lawyer",
    projectManager: "To be assigned",
    physicalFileId: `PHY-${matter.id.slice(0, 8).toUpperCase()}`,
    physicalLabel: "Physical file to register",
    physicalLocation: "Cabinet registry pending",
    physicalCustody: "Custody chain not yet recorded",
    synopsis: `Live matter synced from Supabase for ${matter.client_name}. The operational workspace is using current matter, task, and document data while richer collaboration and physical file tracking are still being wired in.`,
    primaryTrack: "Live matter workflow linked to Supabase core tables",
    riskToMonitor: `Risk level currently marked as ${matter.risk_level ?? "Medium"}`,
    aiUsageRule: "AI outputs remain assistive and require human review before client or court use",
    nextDraft: recentDocuments[0]?.name ?? "No draft document registered yet",
    timeline,
    documents: recentDocuments,
    researchNotes: documents.length
      ? documents.slice(0, 3).map((document) => document.ai_summary || `${document.title} uploaded with no AI summary yet.`)
      : ["No research or document summaries stored yet for this matter."],
    collaboration: [
      {
        actor: leadLawyer?.full_name ?? "System",
        role: leadLawyer?.role ?? "Lead Lawyer",
        note: "Live matter loaded from Supabase core tables.",
      },
      {
        actor: "TSIDEK Workspace",
        role: "System",
        note: "Collaboration persistence is the next backend layer to wire after matter sync.",
      },
    ],
    governanceChecks: [
      "Matter data is loaded through the shared firm database layer",
      "Role enforcement still needs full RLS-backed membership policies",
      "Physical file registry still needs dedicated persistence tables",
      "Comments and approvals still need backend storage",
    ],
    approvedTools: "TSIDEK workspace, Supabase matter store, secure document vault",
    escalationTrigger: "Any external dispatch still requires human approval",
    trainingOwner: "To be assigned when matter membership backend is live",
    reviewForum: "Weekly matter review recommended",
    mentorshipPair: "Not yet assigned",
    mentorshipFocus: "Not yet assigned",
    mentorshipRhythm: "Not yet scheduled",
    securityClassification: matter.security_classification ?? "Standard",
    ethicalWallEnabled: Boolean(matter.ethical_wall_enabled),
  };
}

export async function loadMattersFromSupabase(firmId?: string) {
  const supabase = createPublicSupabaseClient();

  if (!supabase) {
    return null;
  }

  let matterQuery = supabase
    .from("matters")
    .select("id,title,client_name,status,risk_level,jurisdiction,lead_lawyer_id,security_classification,ethical_wall_enabled")
    .order("created_at", { ascending: false });

  if (firmId) {
    matterQuery = matterQuery.eq("firm_id", firmId);
  }

  const matterResult = await matterQuery;

  if (matterResult.error || !matterResult.data) {
    return null;
  }

  const matters = matterResult.data as MatterRow[];
  const matterIds = matters.map((matter) => matter.id);
  const lawyerIds = matters
    .map((matter) => matter.lead_lawyer_id)
    .filter((value): value is string => Boolean(value));

  const [lawyerResult, taskResult, documentResult] = await Promise.all([
    lawyerIds.length
      ? supabase.from("lawyers").select("id,full_name,role").in("id", lawyerIds)
      : Promise.resolve({ data: [], error: null }),
    matterIds.length
      ? supabase.from("tasks").select("matter_id,title,deadline,is_completed").in("matter_id", matterIds).order("deadline", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    matterIds.length
      ? supabase.from("documents").select("matter_id,title,ai_summary,requires_compliance_audit,created_at").in("matter_id", matterIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const lawyers = (lawyerResult.data ?? []) as LawyerRow[];
  const tasks = (taskResult.data ?? []) as TaskRow[];
  const documents = (documentResult.data ?? []) as DocumentRow[];

  const lawyerById = new Map(lawyers.map((lawyer) => [lawyer.id, lawyer]));

  return matters.map((matter) =>
    buildMatterWorkspaceRecord(
      matter,
      matter.lead_lawyer_id ? lawyerById.get(matter.lead_lawyer_id) : undefined,
      tasks.filter((task) => task.matter_id === matter.id),
      documents.filter((document) => document.matter_id === matter.id)
    )
  );
}

export async function listMatterWorkspaces() {
  return (await loadMattersFromSupabase()) ?? seededMatterWorkspaceRecords;
}

export async function getMatterWorkspaceById(matterId: string) {
  const liveMatters = await loadMattersFromSupabase();
  return (
    liveMatters?.find((matter) => matter.id === matterId) ??
    seededMatterWorkspaceRecords.find((matter) => matter.id === matterId) ??
    null
  );
}

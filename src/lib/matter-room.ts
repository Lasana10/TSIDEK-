import { getMatterWorkspaceByIdServer } from "@/lib/matters.server";
import type { MatterWorkspaceData } from "@/lib/matters";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { readPrototypeCollection, writePrototypeCollection } from "@/lib/prototype-state.server";
import { isDemoModeEnabled } from "@/lib/runtime-mode";
import {
  loadBuiltinTemplateBody,
  personalizeTemplate,
  type TemplateProfile,
} from "@/lib/document-engine/personalize";

export type MatterRoomMember = {
  id: string;
  name: string;
  role: string;
  focus: string;
  isPrimary: boolean;
};

export type MatterRoomAssignableLawyer = {
  id: string;
  name: string;
  role: string;
  alreadyAssigned: boolean;
};

export type MatterRoomTask = {
  id: string;
  title: string;
  description: string;
  deadline: string | null;
  status: "Open" | "In Progress" | "Blocked" | "Done";
  assignedTo: string;
};

export type MatterRoomDocument = {
  id: string;
  title: string;
  documentType: string;
  documentStatus: "Draft" | "Final" | "Filed" | "Archived";
  reviewStatus: "Working" | "Internal review" | "Approved" | "Needs revision";
  accessLevel: "Matter team" | "Lead+Partner";
  sharingPolicy: "Internal only" | "Client-share ready" | "Blocked";
  versionLabel: string | null;
  storagePath: string;
  oneDriveFileId: string | null;
  syncStatus: "Local only" | "OneDrive linked";
  aiSummary: string;
  requiresComplianceAudit: boolean;
  reviewNote: string | null;
  filedAt: string | null;
  createdAt: string;
};

export type MatterRoomComment = {
  id: string;
  author: string;
  role: string;
  body: string;
  commentType: "note" | "ai" | "approval" | "warning";
  createdAt: string;
};

export type MatterRoomPhysicalFile = {
  fileCode: string;
  label: string;
  location: string;
  custodyStatus: string;
  qrPayload: string | null;
};

export type MatterRoomAuditItem = {
  id: string;
  actionType: string;
  description: string;
  createdAt: string;
  actorName: string;
};

export type MatterCasePreparationItem = {
  id: string;
  preparationType: "Hearing" | "Filing" | "Witness" | "Client briefing" | "Research";
  title: string;
  ownerName: string;
  dueDate: string | null;
  status: "Open" | "In progress" | "Ready" | "Blocked";
  notes: string;
};

export type MatterJurisprudenceEntry = {
  id: string;
  title: string;
  forum: string;
  jurisdiction: string;
  decisionDate: string | null;
  legalTopics: string[];
  holdingSummary: string;
  citation: string;
  sourceType: "Official reporter" | "Online research" | "Private scan" | "Internal memo";
  sourceUrl: string | null;
  relevanceLabel: "Core authority" | "Useful" | "Watchlist";
};

export type MatterCouncilRegisterEntry = {
  id: string;
  bodyName: string;
  registerType: string;
  referenceCode: string;
  jurisdiction: string;
  status: "Draft" | "Filed" | "Pending response" | "Resolved";
  filingDate: string | null;
  followUpDate: string | null;
  historyNote: string;
};

export type MatterComplianceChecklistItem = {
  id: string;
  label: string;
  ownerName: string;
  dueDate: string | null;
  status: "Pending" | "Satisfied" | "Escalated";
  evidenceNote: string;
};

export type MatterComplianceChecklist = {
  id: string;
  title: string;
  checklistType: string;
  overallStatus: "In progress" | "Ready for review" | "Completed";
  items: MatterComplianceChecklistItem[];
};

export type MatterKnowledgeEntry = {
  id: string;
  title: string;
  entryType: "Precedent note" | "Book scan" | "Statute extract" | "Checklist" | "Strategy note";
  tags: string[];
  summary: string;
  storagePath: string | null;
  sensitivity: "Internal" | "Restricted" | "Training-safe";
  createdAt: string;
};

export type MatterCaseField = {
  id: string;
  fieldKey: string;
  fieldLabel: string;
  fieldValue: string;
  fieldGroup: string;
};

export type MatterDigitalCaseFile = {
  id: string;
  fileLabel: string;
  fileCategory: string;
  storagePath: string | null;
  storageProvider: string;
  referenceCode: string | null;
  versionLabel: string | null;
  status: "Draft" | "Active" | "Archived";
  uploadedAt: string;
};

export type MatterTemplateProfile = TemplateProfile;

export type MatterTemplateGeneration = {
  id: string;
  title: string;
  contextNote: string | null;
  outputText: string;
  generatedAt: string;
};

export type MatterRoomCustodyEvent = {
  id: string;
  eventType: "registered" | "checked_out" | "checked_in" | "relocated";
  note: string;
  createdAt: string;
  actorName: string;
};

export type MatterRoomData = {
  source: "live" | "prototype" | "fallback";
  matter: MatterWorkspaceData;
  teamMembers: MatterRoomMember[];
  assignableLawyers: MatterRoomAssignableLawyer[];
  documents: MatterRoomDocument[];
  tasks: MatterRoomTask[];
  comments: MatterRoomComment[];
  physicalFile: MatterRoomPhysicalFile;
  custodyEvents: MatterRoomCustodyEvent[];
  auditTrail: MatterRoomAuditItem[];
  casePreparation: MatterCasePreparationItem[];
  jurisprudenceEntries: MatterJurisprudenceEntry[];
  councilRegisters: MatterCouncilRegisterEntry[];
  complianceChecklist: MatterComplianceChecklist | null;
  knowledgeEntries: MatterKnowledgeEntry[];
  caseFields: MatterCaseField[];
  digitalCaseFiles: MatterDigitalCaseFile[];
  templateProfiles: MatterTemplateProfile[];
  templateGenerations: MatterTemplateGeneration[];
};

type MatterMemberRow = {
  lawyer_id: string;
  firm_role_id: string | null;
  is_primary: boolean;
};

type LawyerLookupRow = {
  id: string;
  full_name: string;
  role: string | null;
};

type RoleLookupRow = {
  id: string;
  name: string;
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  status: MatterRoomTask["status"];
  assigned_to: string | null;
};

type DocumentRow = {
  id: string;
  title: string;
  document_type: string | null;
  document_status: MatterRoomDocument["documentStatus"] | null;
  review_status: MatterRoomDocument["reviewStatus"] | null;
  access_level: MatterRoomDocument["accessLevel"] | null;
  sharing_policy: MatterRoomDocument["sharingPolicy"] | null;
  version_label: string | null;
  storage_path: string | null;
  onedrive_file_id: string | null;
  ai_summary: string | null;
  requires_compliance_audit: boolean | null;
  review_note: string | null;
  filed_at: string | null;
  created_at: string | null;
};

type CommentRow = {
  id: string;
  author_id: string | null;
  body: string;
  comment_type: MatterRoomComment["commentType"];
  created_at: string;
};

type PhysicalFileRow = {
  id: string;
  file_code: string;
  label: string;
  location: string | null;
  custody_status: string | null;
  qr_payload: string | null;
};

type CustodyEventRow = {
  id: string;
  actor_id: string | null;
  event_type: MatterRoomCustodyEvent["eventType"];
  note: string | null;
  created_at: string;
};

type AuditRow = {
  id: string;
  action_type: string;
  description: string;
  created_at: string;
  actor_id: string | null;
};

type CasePreparationRow = {
  id: string;
  preparation_type: MatterCasePreparationItem["preparationType"];
  title: string;
  owner_name: string | null;
  due_date: string | null;
  status: MatterCasePreparationItem["status"];
  notes: string | null;
};

type JurisprudenceRow = {
  id: string;
  title: string;
  forum: string;
  jurisdiction: string;
  decision_date: string | null;
  legal_topics: string[] | null;
  holding_summary: string;
  citation: string | null;
  source_type: MatterJurisprudenceEntry["sourceType"];
  source_url: string | null;
  relevance_label: MatterJurisprudenceEntry["relevanceLabel"];
};

type CouncilRegisterRow = {
  id: string;
  body_name: string;
  register_type: string;
  reference_code: string;
  jurisdiction: string;
  status: MatterCouncilRegisterEntry["status"];
  filing_date: string | null;
  follow_up_date: string | null;
  history_note: string | null;
};

type ComplianceChecklistRow = {
  id: string;
  title: string;
  checklist_type: string;
  overall_status: MatterComplianceChecklist["overallStatus"];
};

type ComplianceChecklistItemRow = {
  id: string;
  checklist_id: string;
  label: string;
  owner_name: string | null;
  due_date: string | null;
  status: MatterComplianceChecklistItem["status"];
  evidence_note: string | null;
};

type KnowledgeEntryRow = {
  id: string;
  title: string;
  entry_type: MatterKnowledgeEntry["entryType"];
  tags: string[] | null;
  summary: string;
  storage_path: string | null;
  sensitivity: MatterKnowledgeEntry["sensitivity"];
  created_at: string;
};

type CaseFieldRow = {
  id: string;
  field_key: string;
  field_label: string;
  field_value: string;
  field_group: string;
};

type DigitalCaseFileRow = {
  id: string;
  file_label: string;
  file_category: string;
  storage_path: string | null;
  storage_provider: string;
  reference_code: string | null;
  version_label: string | null;
  status: MatterDigitalCaseFile["status"];
  uploaded_at: string;
};

type DocumentTemplateRow = {
  id: string;
  title: string;
  practice_area: string;
  jurisdiction: string;
  language: MatterTemplateProfile["language"];
  template_body: string;
  preserved_form_note: string | null;
};

type TemplateGenerationRow = {
  id: string;
  title: string;
  context_note: string | null;
  output_text: string;
  generated_at: string;
};

function buildFallbackMatterRoom(matter: MatterWorkspaceData): MatterRoomData {
  return {
    source: "fallback",
    matter,
    teamMembers: [
      {
        id: `${matter.id}-lead`,
        name: matter.leadLawyer,
        role: "Lead Lawyer",
        focus: "Owns strategy and client-facing legal judgment.",
        isPrimary: true,
      },
      {
        id: `${matter.id}-pm`,
        name: matter.projectManager,
        role: "Project Manager",
        focus: "Coordinates the operational lane and handoffs.",
        isPrimary: false,
      },
    ],
    assignableLawyers: [
      {
        id: `${matter.id}-lead`,
        name: matter.leadLawyer,
        role: "Lead Lawyer",
        alreadyAssigned: true,
      },
      {
        id: `${matter.id}-pm`,
        name: matter.projectManager,
        role: "Project Manager",
        alreadyAssigned: true,
      },
    ],
    documents: matter.documents.map((item, index) => ({
      id: `${matter.id}-document-${index + 1}`,
      title: item.name,
      documentType: item.type,
      documentStatus: item.state === "Finalized" ? "Final" : "Draft",
      reviewStatus: item.state === "Finalized" ? "Approved" : "Working",
      accessLevel: item.type === "Compliance" ? "Lead+Partner" : "Matter team",
      sharingPolicy: item.type === "Compliance" ? "Blocked" : "Internal only",
      versionLabel: "v1",
      storagePath: "Matter vault path pending live registry",
      oneDriveFileId: null,
      syncStatus: "Local only",
      aiSummary: item.state,
      requiresComplianceAudit: item.type === "Compliance",
      reviewNote: null,
      filedAt: null,
      createdAt: "Seeded record",
    })),
    tasks: matter.timeline.map((item, index) => ({
      id: `${matter.id}-task-${index + 1}`,
      title: item.title,
      description: `Derived from the seeded matter timeline for ${matter.title}.`,
      deadline: item.date,
      status: "In Progress",
      assignedTo: item.owner,
    })),
    comments: matter.collaboration.map((item, index) => ({
      id: `${matter.id}-comment-${index + 1}`,
      author: item.actor,
      role: item.role,
      body: item.note,
      commentType: "note",
      createdAt: `Seeded note ${index + 1}`,
    })),
    physicalFile: {
      fileCode: matter.physicalFileId,
      label: matter.physicalLabel,
      location: matter.physicalLocation,
      custodyStatus: matter.physicalCustody,
      qrPayload: null,
    },
    custodyEvents: [
      {
        id: `${matter.id}-custody-1`,
        eventType: "registered",
        note: "Fallback physical file record shown until live custody tracking is connected.",
        createdAt: "Now",
        actorName: "TSIDEK Workspace",
      },
    ],
    auditTrail: [
      {
        id: `${matter.id}-audit-1`,
        actionType: "fallback_view",
        description: "Matter room is rendering from seeded data while the live persistence layer is unavailable.",
        createdAt: "Now",
        actorName: "TSIDEK Workspace",
      },
    ],
    casePreparation: [
      {
        id: `${matter.id}-prep-1`,
        preparationType: "Filing",
        title: `Finalize ${matter.nextDraft}`,
        ownerName: matter.leadLawyer,
        dueDate: matter.timeline[0]?.date ?? null,
        status: "In progress",
        notes: "Fallback preparation lane derived from the matter synopsis and timeline.",
      },
      {
        id: `${matter.id}-prep-2`,
        preparationType: "Research",
        title: "Refresh local authorities and procedural checkpoints",
        ownerName: matter.projectManager,
        dueDate: matter.timeline[1]?.date ?? null,
        status: "Open",
        notes: "Keep hearing, filing, and annex dependencies aligned before external dispatch.",
      },
    ],
    jurisprudenceEntries: [
      {
        id: `${matter.id}-juris-1`,
        title: `${matter.jurisdiction} commercial reasoning pack`,
        forum: matter.jurisdiction,
        jurisdiction: matter.jurisdiction,
        decisionDate: null,
        legalTopics: ["Procedure", "Commercial recovery"],
        holdingSummary: matter.researchNotes[0] ?? "Research stack not yet synchronized from the live jurisprudence store.",
        citation: "Private research note",
        sourceType: "Internal memo",
        sourceUrl: null,
        relevanceLabel: "Useful",
      },
    ],
    councilRegisters: [
      {
        id: `${matter.id}-register-1`,
        bodyName: "Cabinet filing register",
        registerType: "Matter opening",
        referenceCode: matter.physicalFileId,
        jurisdiction: matter.jurisdiction,
        status: "Filed",
        filingDate: matter.timeline[0]?.date ?? null,
        followUpDate: matter.timeline[1]?.date ?? null,
        historyNote: "Fallback register history is shown until the live council/register log is connected.",
      },
    ],
    complianceChecklist: {
      id: `${matter.id}-compliance-1`,
      title: "Launch checklist",
      checklistType: "Matter compliance",
      overallStatus: "In progress",
      items: matter.governanceChecks.map((check, index) => ({
        id: `${matter.id}-compliance-item-${index + 1}`,
        label: check,
        ownerName: index === 0 ? matter.leadLawyer : matter.projectManager,
        dueDate: matter.timeline[index]?.date ?? null,
        status: index === 0 ? "Satisfied" : "Pending",
        evidenceNote: "Fallback checklist item based on the seeded governance baseline.",
      })),
    },
    knowledgeEntries: [
      {
        id: `${matter.id}-knowledge-1`,
        title: `${matter.clientName} strategic brief`,
        entryType: "Strategy note",
        tags: ["Matter summary", matter.jurisdiction],
        summary: matter.synopsis,
        storagePath: null,
        sensitivity: "Internal",
        createdAt: "Seeded note",
      },
      {
        id: `${matter.id}-knowledge-2`,
        title: "Private authority digest",
        entryType: "Precedent note",
        tags: ["Jurisprudence", "OHADA"],
        summary: matter.researchNotes.join(" "),
        storagePath: null,
        sensitivity: "Restricted",
        createdAt: "Seeded note",
      },
    ],
    caseFields: [
      {
        id: `${matter.id}-field-1`,
        fieldKey: "client_address",
        fieldLabel: "Client address",
        fieldValue: "Douala, Cameroun",
        fieldGroup: "Core facts",
      },
      {
        id: `${matter.id}-field-2`,
        fieldKey: "adversary_name",
        fieldLabel: "Adversary name",
        fieldValue: "To be confirmed",
        fieldGroup: "Opposition",
      },
      {
        id: `${matter.id}-field-3`,
        fieldKey: "amount_in_dispute",
        fieldLabel: "Amount in dispute",
        fieldValue: "0 XAF",
        fieldGroup: "Financial",
      },
    ],
    digitalCaseFiles: [
      {
        id: `${matter.id}-digital-file-1`,
        fileLabel: "Master digital case room",
        fileCategory: "Matter vault",
        storagePath: `vault/${matter.id}/master`,
        storageProvider: "TSIDEK Vault",
        referenceCode: matter.physicalFileId,
        versionLabel: "v1",
        status: "Active",
        uploadedAt: "Seeded record",
      },
    ],
    templateProfiles: [
      {
        id: `${matter.id}-template-1`,
        title: "Assignation Paiement Heritage",
        practiceArea: matter.matterType,
        jurisdiction: matter.jurisdiction,
        language: "FR",
        templateBody: "Assignation pour {{clientName}} contre {{adversary_name}} concernant {{matterTitle}}.",
        preservedFormNote: "Preserve chamber structure, signature block, and formal tone.",
      },
    ],
    templateGenerations: [
      {
        id: `${matter.id}-generation-1`,
        title: `${matter.nextDraft} preview`,
        contextNote: "Fallback generation shown until live template persistence is connected.",
        outputText: `Projet pour ${matter.clientName} dans ${matter.jurisdiction}.`,
        generatedAt: "Seeded record",
      },
    ],
  };
}

function formatStoredDate(value: string | null) {
  if (!value) {
    return "No deadline";
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function createMatterRoomClient() {
  return createServerSupabaseClient();
}

const matterRoomsCollectionKey = "matter-rooms";

async function readPrototypeMatterRooms() {
  return readPrototypeCollection<Record<string, MatterRoomData>>(matterRoomsCollectionKey, {});
}

async function getPrototypeMatterRoom(matterId: string, fallbackRoom: MatterRoomData) {
  const rooms = await readPrototypeMatterRooms();
  return rooms[matterId] ?? { ...fallbackRoom, source: "prototype" };
}

async function savePrototypeMatterRoom(room: MatterRoomData) {
  const rooms = await readPrototypeMatterRooms();
  rooms[room.matter.id] = room;
  await writePrototypeCollection(matterRoomsCollectionKey, rooms);
  return room;
}

async function mutatePrototypeMatterRoom<T>(
  matterId: string,
  fallbackRoom: MatterRoomData,
  mutate: (room: MatterRoomData) => { room: MatterRoomData; result: T }
) {
  if (!isDemoModeEnabled()) {
    throw new Error("Live Supabase persistence is required for matter-room writes in production.");
  }

  const current = await getPrototypeMatterRoom(matterId, fallbackRoom);
  const payload = mutate(current);
  await savePrototypeMatterRoom(payload.room);
  return payload.result;
}

async function resolveMatterFirmScope(matterId: string) {
  const supabase = createMatterRoomClient();
  if (!supabase) {
    return null;
  }

  const result = await supabase
    .from("matters")
    .select("firm_id")
    .eq("id", matterId)
    .single();

  if (result.error || !result.data) {
    return null;
  }

  return {
    supabase,
    firmId: result.data.firm_id as string,
  };
}

async function recordMatterAudit(input: {
  supabase: ReturnType<typeof createMatterRoomClient>;
  firmId: string;
  matterId: string;
  actionType: string;
  description: string;
}) {
  if (!input.supabase) {
    return;
  }

  await input.supabase.from("audit_logs").insert({
    firm_id: input.firmId,
    matter_id: input.matterId,
    actor_id: null,
    action_type: input.actionType,
    description: input.description,
    is_critical: false,
  });
}

export async function getMatterRoomById(matterId: string): Promise<MatterRoomData | null> {
  const matter = await getMatterWorkspaceByIdServer(matterId);
  if (!matter) {
    return null;
  }

  const fallbackRoom = buildFallbackMatterRoom(matter);

  const supabase = createMatterRoomClient();
  if (!supabase) {
    if (!isDemoModeEnabled()) {
      return null;
    }

    return getPrototypeMatterRoom(matterId, fallbackRoom);
  }

  const [
    memberResult,
    taskResult,
    commentResult,
    documentResult,
    physicalResult,
    auditResult,
    casePreparationResult,
    jurisprudenceResult,
    registerResult,
    checklistResult,
    checklistItemResult,
    knowledgeResult,
    caseFieldResult,
    digitalCaseFileResult,
    templateProfileResult,
    templateGenerationResult,
  ] = await Promise.all([
    supabase
      .from("matter_members")
      .select("lawyer_id,firm_role_id,is_primary")
      .eq("matter_id", matterId),
    supabase
      .from("tasks")
      .select("id,title,description,deadline,status,assigned_to")
      .eq("matter_id", matterId)
      .order("deadline", { ascending: true }),
    supabase
      .from("matter_comments")
      .select("id,author_id,body,comment_type,created_at")
      .eq("matter_id", matterId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("documents")
      .select(
        "id,title,document_type,document_status,review_status,access_level,sharing_policy,version_label,storage_path,onedrive_file_id,ai_summary,requires_compliance_audit,review_note,filed_at,created_at"
      )
      .eq("matter_id", matterId)
      .order("created_at", { ascending: false })
      .limit(24),
    supabase
      .from("physical_files")
      .select("id,file_code,label,location,custody_status,qr_payload")
      .eq("matter_id", matterId)
      .maybeSingle(),
    supabase
      .from("audit_logs")
      .select("id,action_type,description,created_at,actor_id")
      .eq("matter_id", matterId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("case_preparation_items")
      .select("id,preparation_type,title,owner_name,due_date,status,notes")
      .eq("matter_id", matterId)
      .order("due_date", { ascending: true }),
    supabase
      .from("jurisprudence_entries")
      .select("id,title,forum,jurisdiction,decision_date,legal_topics,holding_summary,citation,source_type,source_url,relevance_label")
      .eq("matter_id", matterId)
      .order("decision_date", { ascending: false })
      .limit(16),
    supabase
      .from("council_register_entries")
      .select("id,body_name,register_type,reference_code,jurisdiction,status,filing_date,follow_up_date,history_note")
      .eq("matter_id", matterId)
      .order("follow_up_date", { ascending: true }),
    supabase
      .from("compliance_checklists")
      .select("id,title,checklist_type,overall_status")
      .eq("matter_id", matterId)
      .maybeSingle(),
    supabase
      .from("compliance_checklist_items")
      .select("id,checklist_id,label,owner_name,due_date,status,evidence_note")
      .in(
        "checklist_id",
        (
          await supabase
            .from("compliance_checklists")
            .select("id")
            .eq("matter_id", matterId)
        ).data?.map((item) => item.id) ?? ["00000000-0000-0000-0000-000000000000"]
      ),
    supabase
      .from("knowledge_entries")
      .select("id,title,entry_type,tags,summary,storage_path,sensitivity,created_at")
      .or(`matter_id.eq.${matterId},matter_id.is.null`)
      .order("updated_at", { ascending: false })
      .limit(16),
    supabase
      .from("matter_case_fields")
      .select("id,field_key,field_label,field_value,field_group")
      .eq("matter_id", matterId)
      .order("field_group", { ascending: true }),
    supabase
      .from("digital_case_files")
      .select("id,file_label,file_category,storage_path,storage_provider,reference_code,version_label,status,uploaded_at")
      .eq("matter_id", matterId)
      .order("uploaded_at", { ascending: false }),
    supabase
      .from("document_templates")
      .select("id,title,practice_area,jurisdiction,language,template_body,preserved_form_note")
      .order("updated_at", { ascending: false })
      .limit(12),
    supabase
      .from("template_generations")
      .select("id,title,context_note,output_text,generated_at")
      .eq("matter_id", matterId)
      .order("generated_at", { ascending: false })
      .limit(8),
  ]);

  if (
    memberResult.error ||
    taskResult.error ||
    commentResult.error ||
    documentResult.error ||
    auditResult.error ||
    casePreparationResult.error ||
    jurisprudenceResult.error ||
    registerResult.error ||
    checklistResult.error ||
    checklistItemResult.error ||
    knowledgeResult.error ||
    caseFieldResult.error ||
    digitalCaseFileResult.error ||
    templateProfileResult.error ||
    templateGenerationResult.error
  ) {
    if (!isDemoModeEnabled()) {
      return null;
    }

    return fallbackRoom;
  }

  const members = (memberResult.data ?? []) as MatterMemberRow[];
  const tasks = (taskResult.data ?? []) as TaskRow[];
  const comments = (commentResult.data ?? []) as CommentRow[];
  const documents = (documentResult.data ?? []) as DocumentRow[];
  const auditRows = (auditResult.data ?? []) as AuditRow[];
  const physicalFile = (physicalResult.data ?? null) as PhysicalFileRow | null;
  const casePreparationRows = (casePreparationResult.data ?? []) as CasePreparationRow[];
  const jurisprudenceRows = (jurisprudenceResult.data ?? []) as JurisprudenceRow[];
  const registerRows = (registerResult.data ?? []) as CouncilRegisterRow[];
  const checklistRow = (checklistResult.data ?? null) as ComplianceChecklistRow | null;
  const checklistItemRows = (checklistItemResult.data ?? []) as ComplianceChecklistItemRow[];
  const knowledgeRows = (knowledgeResult.data ?? []) as KnowledgeEntryRow[];
  const caseFieldRows = (caseFieldResult.data ?? []) as CaseFieldRow[];
  const digitalCaseFileRows = (digitalCaseFileResult.data ?? []) as DigitalCaseFileRow[];
  const templateProfileRows = (templateProfileResult.data ?? []) as DocumentTemplateRow[];
  const templateGenerationRows = (templateGenerationResult.data ?? []) as TemplateGenerationRow[];

  const custodyResult = physicalFile
    ? await supabase
        .from("file_custody_events")
        .select("id,actor_id,event_type,note,created_at")
        .eq("physical_file_id", physicalFile.id)
        .order("created_at", { ascending: false })
        .limit(12)
    : { data: [], error: null };

  if (custodyResult.error) {
    if (!isDemoModeEnabled()) {
      return null;
    }

    return fallbackRoom;
  }

  const custodyEvents = (custodyResult.data ?? []) as CustodyEventRow[];

  const lawyerIds = Array.from(
    new Set(
      [
        ...members.map((member) => member.lawyer_id),
        ...comments.map((comment) => comment.author_id).filter((value): value is string => Boolean(value)),
        ...tasks.map((task) => task.assigned_to).filter((value): value is string => Boolean(value)),
        ...auditRows.map((item) => item.actor_id).filter((value): value is string => Boolean(value)),
        ...custodyEvents.map((event) => event.actor_id).filter((value): value is string => Boolean(value)),
      ]
    )
  );
  const roleIds = Array.from(
    new Set(members.map((member) => member.firm_role_id).filter((value): value is string => Boolean(value)))
  );

  const [lawyerResult, roleResult] = await Promise.all([
    lawyerIds.length
      ? supabase.from("lawyers").select("id,full_name,role").in("id", lawyerIds)
      : Promise.resolve({ data: [], error: null }),
    roleIds.length
      ? supabase.from("firm_roles").select("id,name").in("id", roleIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (lawyerResult.error || roleResult.error) {
    if (!isDemoModeEnabled()) {
      return null;
    }

    return fallbackRoom;
  }

  const lawyerById = new Map(
    ((lawyerResult.data ?? []) as LawyerLookupRow[]).map((lawyer) => [lawyer.id, lawyer])
  );
  const roleById = new Map(
    ((roleResult.data ?? []) as RoleLookupRow[]).map((role) => [role.id, role])
  );

  return {
    source: "live",
    matter,
    teamMembers: members.length
      ? members.map((member) => {
          const lawyer = lawyerById.get(member.lawyer_id);
          const firmRole = member.firm_role_id ? roleById.get(member.firm_role_id) : null;
          return {
            id: member.lawyer_id,
            name: lawyer?.full_name ?? "Unknown team member",
            role: firmRole?.name ?? lawyer?.role ?? "Matter team member",
            focus: member.is_primary
              ? "Primary owner of the matter lane."
              : "Assigned contributor inside this matter room.",
            isPrimary: member.is_primary,
          };
        })
      : fallbackRoom.teamMembers,
    assignableLawyers: ((lawyerResult.data ?? []) as LawyerLookupRow[]).map((lawyer) => ({
      id: lawyer.id,
      name: lawyer.full_name,
      role: lawyer.role ?? "Matter team member",
      alreadyAssigned: members.some((member) => member.lawyer_id === lawyer.id),
    })),
    documents: documents.length
      ? documents.map((document) => ({
          id: document.id,
          title: document.title,
          documentType: document.document_type ?? "Document",
          documentStatus: document.document_status ?? "Draft",
          reviewStatus: document.review_status ?? "Working",
          accessLevel: document.access_level ?? "Matter team",
          sharingPolicy: document.sharing_policy ?? "Internal only",
          versionLabel: document.version_label,
          storagePath: document.storage_path ?? "Storage path not recorded",
          oneDriveFileId: document.onedrive_file_id,
          syncStatus: document.onedrive_file_id ? "OneDrive linked" : "Local only",
          aiSummary: document.ai_summary ?? "No AI summary stored yet.",
          requiresComplianceAudit: Boolean(document.requires_compliance_audit),
          reviewNote: document.review_note,
          filedAt: document.filed_at ? formatStoredDate(document.filed_at) : null,
          createdAt: formatStoredDate(document.created_at),
        }))
      : fallbackRoom.documents,
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description ?? "No task detail recorded yet.",
      deadline: formatStoredDate(task.deadline),
      status: task.status,
      assignedTo: task.assigned_to
        ? (lawyerById.get(task.assigned_to)?.full_name ?? "Assigned team member")
        : "Unassigned",
    })),
    comments: comments.map((comment) => ({
      id: comment.id,
      author: comment.author_id
        ? (lawyerById.get(comment.author_id)?.full_name ?? "Unknown author")
        : "System",
      role: comment.author_id
        ? (lawyerById.get(comment.author_id)?.role ?? "Matter team")
        : "System",
      body: comment.body,
      commentType: comment.comment_type,
      createdAt: formatStoredDate(comment.created_at),
    })),
    physicalFile: physicalFile
      ? {
          fileCode: physicalFile.file_code,
          label: physicalFile.label,
          location: physicalFile.location ?? "Location not recorded",
          custodyStatus: physicalFile.custody_status ?? "Custody not recorded",
          qrPayload: physicalFile.qr_payload,
        }
      : fallbackRoom.physicalFile,
    custodyEvents: custodyEvents.length
      ? custodyEvents.map((event) => ({
          id: event.id,
          eventType: event.event_type,
          note: event.note ?? "No note recorded",
          createdAt: formatStoredDate(event.created_at),
          actorName: event.actor_id
            ? (lawyerById.get(event.actor_id)?.full_name ?? "Unknown actor")
            : "System",
        }))
      : fallbackRoom.custodyEvents,
    auditTrail: auditRows.map((item) => ({
      id: item.id,
      actionType: item.action_type,
      description: item.description,
      createdAt: formatStoredDate(item.created_at),
      actorName: item.actor_id
        ? (lawyerById.get(item.actor_id)?.full_name ?? "Unknown actor")
        : "System",
    })),
    casePreparation: casePreparationRows.length
      ? casePreparationRows.map((item) => ({
          id: item.id,
          preparationType: item.preparation_type,
          title: item.title,
          ownerName: item.owner_name ?? "Unassigned",
          dueDate: formatStoredDate(item.due_date),
          status: item.status,
          notes: item.notes ?? "No preparation note stored yet.",
        }))
      : fallbackRoom.casePreparation,
    jurisprudenceEntries: jurisprudenceRows.length
      ? jurisprudenceRows.map((item) => ({
          id: item.id,
          title: item.title,
          forum: item.forum,
          jurisdiction: item.jurisdiction,
          decisionDate: item.decision_date ? formatStoredDate(item.decision_date) : null,
          legalTopics: item.legal_topics ?? [],
          holdingSummary: item.holding_summary,
          citation: item.citation ?? "Citation not recorded",
          sourceType: item.source_type,
          sourceUrl: item.source_url,
          relevanceLabel: item.relevance_label,
        }))
      : fallbackRoom.jurisprudenceEntries,
    councilRegisters: registerRows.length
      ? registerRows.map((item) => ({
          id: item.id,
          bodyName: item.body_name,
          registerType: item.register_type,
          referenceCode: item.reference_code,
          jurisdiction: item.jurisdiction,
          status: item.status,
          filingDate: item.filing_date ? formatStoredDate(item.filing_date) : null,
          followUpDate: item.follow_up_date ? formatStoredDate(item.follow_up_date) : null,
          historyNote: item.history_note ?? "No history note stored yet.",
        }))
      : fallbackRoom.councilRegisters,
    complianceChecklist: checklistRow
      ? {
          id: checklistRow.id,
          title: checklistRow.title,
          checklistType: checklistRow.checklist_type,
          overallStatus: checklistRow.overall_status,
          items: checklistItemRows
            .filter((item) => item.checklist_id === checklistRow.id)
            .map((item) => ({
              id: item.id,
              label: item.label,
              ownerName: item.owner_name ?? "Unassigned",
              dueDate: formatStoredDate(item.due_date),
              status: item.status,
              evidenceNote: item.evidence_note ?? "No evidence note stored yet.",
            })),
        }
      : fallbackRoom.complianceChecklist,
    knowledgeEntries: knowledgeRows.length
      ? knowledgeRows.map((item) => ({
          id: item.id,
          title: item.title,
          entryType: item.entry_type,
          tags: item.tags ?? [],
          summary: item.summary,
          storagePath: item.storage_path,
          sensitivity: item.sensitivity,
          createdAt: formatStoredDate(item.created_at),
        }))
      : fallbackRoom.knowledgeEntries,
    caseFields: caseFieldRows.length
      ? caseFieldRows.map((item) => ({
          id: item.id,
          fieldKey: item.field_key,
          fieldLabel: item.field_label,
          fieldValue: item.field_value,
          fieldGroup: item.field_group,
        }))
      : fallbackRoom.caseFields,
    digitalCaseFiles: digitalCaseFileRows.length
      ? digitalCaseFileRows.map((item) => ({
          id: item.id,
          fileLabel: item.file_label,
          fileCategory: item.file_category,
          storagePath: item.storage_path,
          storageProvider: item.storage_provider,
          referenceCode: item.reference_code,
          versionLabel: item.version_label,
          status: item.status,
          uploadedAt: formatStoredDate(item.uploaded_at),
        }))
      : fallbackRoom.digitalCaseFiles,
    templateProfiles: templateProfileRows.length
      ? templateProfileRows.map((item) => ({
          id: item.id,
          title: item.title,
          practiceArea: item.practice_area,
          jurisdiction: item.jurisdiction,
          language: item.language,
          templateBody: item.template_body,
          preservedFormNote: item.preserved_form_note,
        }))
      : fallbackRoom.templateProfiles,
    templateGenerations: templateGenerationRows.length
      ? templateGenerationRows.map((item) => ({
          id: item.id,
          title: item.title,
          contextNote: item.context_note,
          outputText: item.output_text,
          generatedAt: formatStoredDate(item.generated_at),
        }))
      : fallbackRoom.templateGenerations,
  };
}

export async function createMatterComment(input: {
  matterId: string;
  authorId?: string | null;
  body: string;
  commentType?: MatterRoomComment["commentType"];
}) {
  const supabase = createMatterRoomClient();
  if (!supabase) {
    const fallbackRoom = await getMatterRoomById(input.matterId);
    if (!fallbackRoom) {
      throw new Error("Matter room not found for comment.");
    }

    return mutatePrototypeMatterRoom(input.matterId, fallbackRoom, (room) => {
      const createdAt = new Date().toISOString();
      const nextRoom = {
        ...room,
        source: "live" as const,
        comments: [
          {
            id: `comment-${Date.now()}`,
            author: "TSIDEK Operator",
            role: "Team member",
            body: input.body,
            commentType: input.commentType ?? "note",
            createdAt,
          },
          ...room.comments,
        ],
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            actionType: "comment_created",
            description: `A matter collaboration note was added to ${input.matterId}.`,
            createdAt,
            actorName: "TSIDEK Operator",
          },
          ...room.auditTrail,
        ].slice(0, 20),
      };

      return { room: nextRoom, result: nextRoom };
    });
  }

  const scope = await resolveMatterFirmScope(input.matterId);
  if (!scope) {
    throw new Error("Unable to resolve matter scope for comment.");
  }

  const result = await scope.supabase
    .from("matter_comments")
    .insert({
      matter_id: input.matterId,
      author_id: input.authorId ?? null,
      body: input.body,
      comment_type: input.commentType ?? "note",
    })
    .select("id")
    .single();

  if (result.error) {
    throw new Error(result.error.message);
  }

  await recordMatterAudit({
    supabase: scope.supabase,
    firmId: scope.firmId,
    matterId: input.matterId,
    actionType: "comment_created",
    description: `A matter collaboration note was added to ${input.matterId}.`,
  });

  return getMatterRoomById(input.matterId);
}

export async function createMatterTask(input: {
  matterId: string;
  title: string;
  description?: string;
  deadline?: string | null;
  assignedTo?: string | null;
}) {
  const supabase = createMatterRoomClient();
  if (!supabase) {
    const fallbackRoom = await getMatterRoomById(input.matterId);
    if (!fallbackRoom) {
      throw new Error("Matter room not found for task.");
    }

    return mutatePrototypeMatterRoom(input.matterId, fallbackRoom, (room) => {
      const createdAt = new Date().toISOString();
      const nextRoom = {
        ...room,
        source: "live" as const,
        tasks: [
          ...room.tasks,
          {
            id: `task-${Date.now()}`,
            title: input.title,
            description: input.description ?? "",
            deadline: input.deadline ?? null,
            status: "Open" as const,
            assignedTo: input.assignedTo ?? "Unassigned",
          },
        ],
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            actionType: "task_created",
            description: `A new matter task "${input.title}" was created.`,
            createdAt,
            actorName: "TSIDEK Operator",
          },
          ...room.auditTrail,
        ].slice(0, 20),
      };

      return { room: nextRoom, result: nextRoom };
    });
  }

  const scope = await resolveMatterFirmScope(input.matterId);
  if (!scope) {
    throw new Error("Unable to resolve matter scope for task.");
  }

  const result = await scope.supabase
    .from("tasks")
    .insert({
      matter_id: input.matterId,
      title: input.title,
      description: input.description ?? null,
      deadline: input.deadline ?? null,
      assigned_to: input.assignedTo ?? null,
      status: "Open",
      is_completed: false,
    })
    .select("id")
    .single();

  if (result.error) {
    throw new Error(result.error.message);
  }

  await recordMatterAudit({
    supabase: scope.supabase,
    firmId: scope.firmId,
    matterId: input.matterId,
    actionType: "task_created",
    description: `A new matter task "${input.title}" was created.`,
  });

  return getMatterRoomById(input.matterId);
}

export async function updateMatterTaskStatus(input: {
  matterId: string;
  taskId: string;
  status: MatterRoomTask["status"];
}) {
  const supabase = createMatterRoomClient();
  if (!supabase) {
    const fallbackRoom = await getMatterRoomById(input.matterId);
    if (!fallbackRoom) {
      throw new Error("Matter room not found for task update.");
    }

    return mutatePrototypeMatterRoom(input.matterId, fallbackRoom, (room) => {
      const createdAt = new Date().toISOString();
      const nextRoom = {
        ...room,
        source: "live" as const,
        tasks: room.tasks.map((task) =>
          task.id === input.taskId ? { ...task, status: input.status } : task
        ),
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            actionType: "task_status_updated",
            description: `A matter task was moved to ${input.status}.`,
            createdAt,
            actorName: "TSIDEK Operator",
          },
          ...room.auditTrail,
        ].slice(0, 20),
      };

      return { room: nextRoom, result: nextRoom };
    });
  }

  const scope = await resolveMatterFirmScope(input.matterId);
  if (!scope) {
    throw new Error("Unable to resolve matter scope for task update.");
  }

  const result = await scope.supabase
    .from("tasks")
    .update({
      status: input.status,
      is_completed: input.status === "Done",
    })
    .eq("id", input.taskId)
    .eq("matter_id", input.matterId)
    .select("id")
    .single();

  if (result.error) {
    throw new Error(result.error.message);
  }

  await recordMatterAudit({
    supabase: scope.supabase,
    firmId: scope.firmId,
    matterId: input.matterId,
    actionType: "task_status_updated",
    description: `A matter task was moved to ${input.status}.`,
  });

  return getMatterRoomById(input.matterId);
}

export async function upsertPhysicalFile(input: {
  matterId: string;
  fileCode: string;
  label: string;
  location: string;
  custodyStatus: string;
  qrPayload?: string | null;
}) {
  const supabase = createMatterRoomClient();
  if (!supabase) {
    const fallbackRoom = await getMatterRoomById(input.matterId);
    if (!fallbackRoom) {
      throw new Error("Matter room not found for physical file.");
    }

    return mutatePrototypeMatterRoom(input.matterId, fallbackRoom, (room) => {
      const createdAt = new Date().toISOString();
      const nextRoom = {
        ...room,
        source: "live" as const,
        physicalFile: {
          fileCode: input.fileCode,
          label: input.label,
          location: input.location,
          custodyStatus: input.custodyStatus,
          qrPayload: input.qrPayload ?? null,
        },
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            actionType: "physical_file_upserted",
            description: `Physical file ${input.fileCode} was registered.`,
            createdAt,
            actorName: "TSIDEK Operator",
          },
          ...room.auditTrail,
        ].slice(0, 20),
      };

      return { room: nextRoom, result: nextRoom };
    });
  }

  const scope = await resolveMatterFirmScope(input.matterId);
  if (!scope) {
    throw new Error("Unable to resolve matter scope for physical file.");
  }

  const existing = await scope.supabase
    .from("physical_files")
    .select("id")
    .eq("matter_id", input.matterId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  const payload = {
    matter_id: input.matterId,
    file_code: input.fileCode,
    label: input.label,
    location: input.location,
    custody_status: input.custodyStatus,
    qr_payload: input.qrPayload ?? null,
  };

  const query = existing.data?.id
    ? scope.supabase.from("physical_files").update(payload).eq("id", existing.data.id)
    : scope.supabase.from("physical_files").insert(payload);

  const result = await query.select("id").single();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Unable to save physical file");
  }

  const eventType: MatterRoomCustodyEvent["eventType"] = existing.data?.id ? "relocated" : "registered";

  await scope.supabase.from("file_custody_events").insert({
    physical_file_id: result.data.id,
    actor_id: null,
    event_type: eventType,
    note: existing.data?.id
      ? `Physical file updated to ${input.location} with custody state ${input.custodyStatus}.`
      : `Physical file ${input.fileCode} registered for the matter.`,
  });

  await recordMatterAudit({
    supabase: scope.supabase,
    firmId: scope.firmId,
    matterId: input.matterId,
    actionType: "physical_file_upserted",
    description: `Physical file ${input.fileCode} was ${existing.data?.id ? "updated" : "registered"}.`,
  });

  return getMatterRoomById(input.matterId);
}

export async function createCustodyEvent(input: {
  matterId: string;
  eventType: MatterRoomCustodyEvent["eventType"];
  note: string;
  custodyStatus?: string;
  location?: string;
}) {
  const supabase = createMatterRoomClient();
  if (!supabase) {
    const fallbackRoom = await getMatterRoomById(input.matterId);
    if (!fallbackRoom) {
      throw new Error("Matter room not found for custody event.");
    }

    return mutatePrototypeMatterRoom(input.matterId, fallbackRoom, (room) => {
      const createdAt = new Date().toISOString();
      const nextRoom = {
        ...room,
        source: "live" as const,
        physicalFile: {
          ...room.physicalFile,
          location: input.location ?? room.physicalFile.location,
          custodyStatus: input.custodyStatus ?? room.physicalFile.custodyStatus,
        },
        custodyEvents: [
          {
            id: `custody-${Date.now()}`,
            eventType: input.eventType,
            note: input.note,
            createdAt,
            actorName: "TSIDEK Operator",
          },
          ...room.custodyEvents,
        ],
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            actionType: "custody_event_created",
            description: `Physical file event ${input.eventType} recorded.`,
            createdAt,
            actorName: "TSIDEK Operator",
          },
          ...room.auditTrail,
        ].slice(0, 20),
      };

      return { room: nextRoom, result: nextRoom };
    });
  }

  const scope = await resolveMatterFirmScope(input.matterId);
  if (!scope) {
    throw new Error("Unable to resolve matter scope for custody event.");
  }

  const physicalResult = await scope.supabase
    .from("physical_files")
    .select("id,custody_status,location")
    .eq("matter_id", input.matterId)
    .single();

  if (physicalResult.error || !physicalResult.data) {
    throw new Error("Physical file must be registered before logging custody events.");
  }

  const physicalId = physicalResult.data.id as string;

  const eventResult = await scope.supabase.from("file_custody_events").insert({
    physical_file_id: physicalId,
    actor_id: null,
    event_type: input.eventType,
    note: input.note,
  });

  if (eventResult.error) {
    throw new Error(eventResult.error.message);
  }

  const nextPatch: Record<string, string> = {};
  if (input.custodyStatus) {
    nextPatch.custody_status = input.custodyStatus;
  }
  if (input.location) {
    nextPatch.location = input.location;
  }

  if (Object.keys(nextPatch).length) {
    const updateResult = await scope.supabase
      .from("physical_files")
      .update(nextPatch)
      .eq("id", physicalId);

    if (updateResult.error) {
      throw new Error(updateResult.error.message);
    }
  }

  await recordMatterAudit({
    supabase: scope.supabase,
    firmId: scope.firmId,
    matterId: input.matterId,
    actionType: "custody_event_created",
    description: `Physical file event ${input.eventType} recorded.`,
  });

  return getMatterRoomById(input.matterId);
}

export async function assignMatterMember(input: {
  matterId: string;
  lawyerId: string;
  firmRoleId?: string | null;
  isPrimary?: boolean;
}) {
  const supabase = createMatterRoomClient();
  if (!supabase) {
    const fallbackRoom = await getMatterRoomById(input.matterId);
    if (!fallbackRoom) {
      throw new Error("Matter room not found for membership.");
    }

    return mutatePrototypeMatterRoom(input.matterId, fallbackRoom, (room) => {
      const candidate = room.assignableLawyers.find((lawyer) => lawyer.id === input.lawyerId);
      if (!candidate || candidate.alreadyAssigned) {
        return { room, result: room };
      }

      const createdAt = new Date().toISOString();
      const nextRoom = {
        ...room,
        source: "live" as const,
        teamMembers: [
          ...room.teamMembers,
          {
            id: candidate.id,
            name: candidate.name,
            role: candidate.role,
            focus: "Assigned through the prototype backend.",
            isPrimary: Boolean(input.isPrimary),
          },
        ],
        assignableLawyers: room.assignableLawyers.map((lawyer) =>
          lawyer.id === input.lawyerId ? { ...lawyer, alreadyAssigned: true } : lawyer
        ),
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            actionType: "member_assigned",
            description: `${candidate.name} was assigned to the matter team.`,
            createdAt,
            actorName: "TSIDEK Operator",
          },
          ...room.auditTrail,
        ].slice(0, 20),
      };

      return { room: nextRoom, result: nextRoom };
    });
  }

  const scope = await resolveMatterFirmScope(input.matterId);
  if (!scope) {
    throw new Error("Unable to resolve matter scope for membership.");
  }

  const existing = await scope.supabase
    .from("matter_members")
    .select("id")
    .eq("matter_id", input.matterId)
    .eq("lawyer_id", input.lawyerId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  if (existing.data?.id) {
    return getMatterRoomById(input.matterId);
  }

  const insertResult = await scope.supabase.from("matter_members").insert({
    matter_id: input.matterId,
    lawyer_id: input.lawyerId,
    firm_role_id: input.firmRoleId ?? null,
    is_primary: Boolean(input.isPrimary),
  });

  if (insertResult.error) {
    throw new Error(insertResult.error.message);
  }

  await recordMatterAudit({
    supabase: scope.supabase,
    firmId: scope.firmId,
    matterId: input.matterId,
    actionType: "member_assigned",
    description: `A practitioner was assigned to the matter team.`,
  });

  return getMatterRoomById(input.matterId);
}

export async function removeMatterMember(input: {
  matterId: string;
  lawyerId: string;
}) {
  const supabase = createMatterRoomClient();
  if (!supabase) {
    const fallbackRoom = await getMatterRoomById(input.matterId);
    if (!fallbackRoom) {
      throw new Error("Matter room not found for membership removal.");
    }

    return mutatePrototypeMatterRoom(input.matterId, fallbackRoom, (room) => {
      const removed = room.teamMembers.find((member) => member.id === input.lawyerId);
      const createdAt = new Date().toISOString();
      const nextRoom = {
        ...room,
        source: "live" as const,
        teamMembers: room.teamMembers.filter((member) => member.id !== input.lawyerId),
        assignableLawyers: room.assignableLawyers.map((lawyer) =>
          lawyer.id === input.lawyerId ? { ...lawyer, alreadyAssigned: false } : lawyer
        ),
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            actionType: "member_removed",
            description: `${removed?.name ?? "Practitioner"} was removed from the matter team.`,
            createdAt,
            actorName: "TSIDEK Operator",
          },
          ...room.auditTrail,
        ].slice(0, 20),
      };

      return { room: nextRoom, result: nextRoom };
    });
  }

  const scope = await resolveMatterFirmScope(input.matterId);
  if (!scope) {
    throw new Error("Unable to resolve matter scope for membership removal.");
  }

  const deleteResult = await scope.supabase
    .from("matter_members")
    .delete()
    .eq("matter_id", input.matterId)
    .eq("lawyer_id", input.lawyerId);

  if (deleteResult.error) {
    throw new Error(deleteResult.error.message);
  }

  await recordMatterAudit({
    supabase: scope.supabase,
    firmId: scope.firmId,
    matterId: input.matterId,
    actionType: "member_removed",
    description: `A practitioner was removed from the matter team.`,
  });

  return getMatterRoomById(input.matterId);
}

export async function createMatterDocument(input: {
  matterId: string;
  title: string;
  documentType: string;
  documentStatus?: MatterRoomDocument["documentStatus"];
  reviewStatus?: MatterRoomDocument["reviewStatus"];
  accessLevel?: MatterRoomDocument["accessLevel"];
  sharingPolicy?: MatterRoomDocument["sharingPolicy"];
  versionLabel?: string | null;
  storagePath?: string | null;
  oneDriveFileId?: string | null;
  aiSummary?: string | null;
  requiresComplianceAudit?: boolean;
  reviewNote?: string | null;
}) {
  const supabase = createMatterRoomClient();
  if (!supabase) {
    const fallbackRoom = await getMatterRoomById(input.matterId);
    if (!fallbackRoom) {
      throw new Error("Matter room not found for document.");
    }

    return mutatePrototypeMatterRoom(input.matterId, fallbackRoom, (room) => {
      const createdAt = new Date().toISOString();
      const nextRoom = {
        ...room,
        source: "live" as const,
        documents: [
          {
            id: `document-${Date.now()}`,
            title: input.title,
            documentType: input.documentType,
            documentStatus: input.documentStatus ?? "Draft",
            reviewStatus: input.reviewStatus ?? "Working",
            accessLevel: input.accessLevel ?? "Matter team",
            sharingPolicy: input.sharingPolicy ?? "Internal only",
            versionLabel: input.versionLabel ?? "v1",
            storagePath: input.storagePath ?? `vault/${input.matterId}/documents/${input.title}`,
            oneDriveFileId: input.oneDriveFileId ?? null,
            syncStatus: input.oneDriveFileId ? ("OneDrive linked" as const) : ("Local only" as const),
            aiSummary: input.aiSummary ?? "Document registered in the prototype backend.",
            requiresComplianceAudit: Boolean(input.requiresComplianceAudit),
            reviewNote: input.reviewNote ?? null,
            filedAt: input.documentStatus === "Filed" ? createdAt : null,
            createdAt,
          },
          ...room.documents,
        ],
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            actionType: "document_registered",
            description: `Document "${input.title}" was registered in the matter vault.`,
            createdAt,
            actorName: "TSIDEK Operator",
          },
          ...room.auditTrail,
        ].slice(0, 20),
      };

      return { room: nextRoom, result: nextRoom };
    });
  }

  const scope = await resolveMatterFirmScope(input.matterId);
  if (!scope) {
    throw new Error("Unable to resolve matter scope for document.");
  }

  const insertResult = await scope.supabase.from("documents").insert({
    matter_id: input.matterId,
    uploaded_by: null,
    title: input.title,
    document_type: input.documentType,
    document_status: input.documentStatus ?? "Draft",
    review_status: input.reviewStatus ?? "Working",
    access_level: input.accessLevel ?? "Matter team",
    sharing_policy: input.sharingPolicy ?? "Internal only",
    version_label: input.versionLabel ?? "v1",
    storage_path: input.storagePath ?? null,
    onedrive_file_id: input.oneDriveFileId ?? null,
    ai_summary: input.aiSummary ?? null,
    requires_compliance_audit: Boolean(input.requiresComplianceAudit),
    review_note: input.reviewNote ?? null,
    filed_at: input.documentStatus === "Filed" ? new Date().toISOString() : null,
  });

  if (insertResult.error) {
    throw new Error(insertResult.error.message);
  }

  await recordMatterAudit({
    supabase: scope.supabase,
    firmId: scope.firmId,
    matterId: input.matterId,
    actionType: "document_registered",
    description: `Document "${input.title}" was registered in the matter vault.`,
  });

  return getMatterRoomById(input.matterId);
}

export async function updateMatterDocumentControl(input: {
  matterId: string;
  documentId: string;
  documentStatus: MatterRoomDocument["documentStatus"];
  reviewStatus: MatterRoomDocument["reviewStatus"];
  accessLevel?: MatterRoomDocument["accessLevel"];
  sharingPolicy?: MatterRoomDocument["sharingPolicy"];
  versionLabel?: string | null;
  reviewNote?: string | null;
}) {
  const supabase = createMatterRoomClient();
  const updatedAt = new Date().toISOString();

  if (!supabase) {
    const fallbackRoom = await getMatterRoomById(input.matterId);
    if (!fallbackRoom) {
      throw new Error("Matter room not found for document control.");
    }

    return mutatePrototypeMatterRoom(input.matterId, fallbackRoom, (room) => {
      const nextRoom = {
        ...room,
        source: "live" as const,
        documents: room.documents.map((document) =>
          document.id === input.documentId
            ? {
                ...document,
                documentStatus: input.documentStatus,
                reviewStatus: input.reviewStatus,
                accessLevel: input.accessLevel ?? document.accessLevel,
                sharingPolicy: input.sharingPolicy ?? document.sharingPolicy,
                versionLabel: input.versionLabel ?? document.versionLabel,
                reviewNote: input.reviewNote ?? document.reviewNote,
                filedAt: input.documentStatus === "Filed" ? updatedAt : document.filedAt,
              }
            : document
        ),
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            actionType: "document_control_updated",
            description: `Document control moved to ${input.documentStatus} / ${input.reviewStatus}.`,
            createdAt: updatedAt,
            actorName: "TSIDEK Operator",
          },
          ...room.auditTrail,
        ].slice(0, 20),
      };

      return { room: nextRoom, result: nextRoom };
    });
  }

  const scope = await resolveMatterFirmScope(input.matterId);
  if (!scope) {
    throw new Error("Unable to resolve matter scope for document control.");
  }

  const result = await scope.supabase
    .from("documents")
    .update({
      document_status: input.documentStatus,
      review_status: input.reviewStatus,
      access_level: input.accessLevel ?? null,
      sharing_policy: input.sharingPolicy ?? null,
      version_label: input.versionLabel ?? null,
      review_note: input.reviewNote ?? null,
      filed_at: input.documentStatus === "Filed" ? updatedAt : null,
    })
    .eq("id", input.documentId)
    .eq("matter_id", input.matterId);

  if (result.error) {
    throw new Error(result.error.message);
  }

  await recordMatterAudit({
    supabase: scope.supabase,
    firmId: scope.firmId,
    matterId: input.matterId,
    actionType: "document_control_updated",
    description: `Document control moved to ${input.documentStatus} / ${input.reviewStatus}.`,
  });

  return getMatterRoomById(input.matterId);
}

export async function createCasePreparationItem(input: {
  matterId: string;
  preparationType: MatterCasePreparationItem["preparationType"];
  title: string;
  ownerName?: string | null;
  dueDate?: string | null;
  status?: MatterCasePreparationItem["status"];
  notes?: string | null;
}) {
  const supabase = createMatterRoomClient();
  if (!supabase) {
    const fallbackRoom = await getMatterRoomById(input.matterId);
    if (!fallbackRoom) {
      throw new Error("Matter room not found for case preparation.");
    }

    return mutatePrototypeMatterRoom(input.matterId, fallbackRoom, (room) => {
      const createdAt = new Date().toISOString();
      const nextRoom = {
        ...room,
        source: "live" as const,
        casePreparation: [
          ...room.casePreparation,
          {
            id: `prep-${Date.now()}`,
            preparationType: input.preparationType,
            title: input.title,
            ownerName: input.ownerName ?? "Unassigned",
            dueDate: input.dueDate ?? null,
            status: input.status ?? "Open",
            notes: input.notes ?? "",
          },
        ],
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            actionType: "case_preparation_created",
            description: `Case preparation item "${input.title}" was added.`,
            createdAt,
            actorName: "TSIDEK Operator",
          },
          ...room.auditTrail,
        ].slice(0, 20),
      };
      return { room: nextRoom, result: nextRoom };
    });
  }

  const scope = await resolveMatterFirmScope(input.matterId);
  if (!scope) {
    throw new Error("Unable to resolve matter scope for case preparation.");
  }

  const insertResult = await scope.supabase.from("case_preparation_items").insert({
    firm_id: scope.firmId,
    matter_id: input.matterId,
    preparation_type: input.preparationType,
    title: input.title,
    owner_name: input.ownerName ?? null,
    due_date: input.dueDate ?? null,
    status: input.status ?? "Open",
    notes: input.notes ?? null,
  });

  if (insertResult.error) {
    throw new Error(insertResult.error.message);
  }

  await recordMatterAudit({
    supabase: scope.supabase,
    firmId: scope.firmId,
    matterId: input.matterId,
    actionType: "case_preparation_created",
    description: `Case preparation item "${input.title}" was added.`,
  });

  return getMatterRoomById(input.matterId);
}

export async function createJurisprudenceEntry(input: {
  matterId: string;
  title: string;
  forum: string;
  jurisdiction: string;
  decisionDate?: string | null;
  legalTopics: string[];
  holdingSummary: string;
  citation?: string | null;
  sourceType: MatterJurisprudenceEntry["sourceType"];
  sourceUrl?: string | null;
  relevanceLabel?: MatterJurisprudenceEntry["relevanceLabel"];
}) {
  const supabase = createMatterRoomClient();
  if (!supabase) {
    const fallbackRoom = await getMatterRoomById(input.matterId);
    if (!fallbackRoom) {
      throw new Error("Matter room not found for jurisprudence.");
    }

    return mutatePrototypeMatterRoom(input.matterId, fallbackRoom, (room) => {
      const createdAt = new Date().toISOString();
      const nextRoom = {
        ...room,
        source: "live" as const,
        jurisprudenceEntries: [
          {
            id: `juris-${Date.now()}`,
            title: input.title,
            forum: input.forum,
            jurisdiction: input.jurisdiction,
            decisionDate: input.decisionDate ?? null,
            legalTopics: input.legalTopics,
            holdingSummary: input.holdingSummary,
            citation: input.citation ?? "Prototype source",
            sourceType: input.sourceType,
            sourceUrl: input.sourceUrl ?? null,
            relevanceLabel: input.relevanceLabel ?? "Useful",
          },
          ...room.jurisprudenceEntries,
        ],
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            actionType: "jurisprudence_added",
            description: `Jurisprudence entry "${input.title}" was added to the matter intelligence stack.`,
            createdAt,
            actorName: "TSIDEK Operator",
          },
          ...room.auditTrail,
        ].slice(0, 20),
      };
      return { room: nextRoom, result: nextRoom };
    });
  }

  const scope = await resolveMatterFirmScope(input.matterId);
  if (!scope) {
    throw new Error("Unable to resolve matter scope for jurisprudence.");
  }

  const insertResult = await scope.supabase.from("jurisprudence_entries").insert({
    firm_id: scope.firmId,
    matter_id: input.matterId,
    title: input.title,
    forum: input.forum,
    jurisdiction: input.jurisdiction,
    decision_date: input.decisionDate ?? null,
    legal_topics: input.legalTopics,
    holding_summary: input.holdingSummary,
    citation: input.citation ?? null,
    source_type: input.sourceType,
    source_url: input.sourceUrl ?? null,
    relevance_label: input.relevanceLabel ?? "Useful",
  });

  if (insertResult.error) {
    throw new Error(insertResult.error.message);
  }

  await recordMatterAudit({
    supabase: scope.supabase,
    firmId: scope.firmId,
    matterId: input.matterId,
    actionType: "jurisprudence_added",
    description: `Jurisprudence entry "${input.title}" was added to the matter intelligence stack.`,
  });

  return getMatterRoomById(input.matterId);
}

export async function createCouncilRegisterEntry(input: {
  matterId: string;
  bodyName: string;
  registerType: string;
  referenceCode: string;
  jurisdiction: string;
  status?: MatterCouncilRegisterEntry["status"];
  filingDate?: string | null;
  followUpDate?: string | null;
  historyNote?: string | null;
}) {
  const supabase = createMatterRoomClient();
  if (!supabase) {
    const fallbackRoom = await getMatterRoomById(input.matterId);
    if (!fallbackRoom) {
      throw new Error("Matter room not found for register history.");
    }

    return mutatePrototypeMatterRoom(input.matterId, fallbackRoom, (room) => {
      const createdAt = new Date().toISOString();
      const nextRoom = {
        ...room,
        source: "live" as const,
        councilRegisters: [
          {
            id: `register-${Date.now()}`,
            bodyName: input.bodyName,
            registerType: input.registerType,
            referenceCode: input.referenceCode,
            jurisdiction: input.jurisdiction,
            status: input.status ?? "Draft",
            filingDate: input.filingDate ?? null,
            followUpDate: input.followUpDate ?? null,
            historyNote: input.historyNote ?? "",
          },
          ...room.councilRegisters,
        ],
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            actionType: "register_entry_added",
            description: `Register entry "${input.referenceCode}" was logged for follow-up.`,
            createdAt,
            actorName: "TSIDEK Operator",
          },
          ...room.auditTrail,
        ].slice(0, 20),
      };
      return { room: nextRoom, result: nextRoom };
    });
  }

  const scope = await resolveMatterFirmScope(input.matterId);
  if (!scope) {
    throw new Error("Unable to resolve matter scope for register history.");
  }

  const insertResult = await scope.supabase.from("council_register_entries").insert({
    firm_id: scope.firmId,
    matter_id: input.matterId,
    body_name: input.bodyName,
    register_type: input.registerType,
    reference_code: input.referenceCode,
    jurisdiction: input.jurisdiction,
    status: input.status ?? "Draft",
    filing_date: input.filingDate ?? null,
    follow_up_date: input.followUpDate ?? null,
    history_note: input.historyNote ?? null,
  });

  if (insertResult.error) {
    throw new Error(insertResult.error.message);
  }

  await recordMatterAudit({
    supabase: scope.supabase,
    firmId: scope.firmId,
    matterId: input.matterId,
    actionType: "register_entry_added",
    description: `Register entry "${input.referenceCode}" was logged for follow-up.`,
  });

  return getMatterRoomById(input.matterId);
}

export async function createComplianceChecklistItem(input: {
  matterId: string;
  checklistTitle: string;
  checklistType: string;
  label: string;
  ownerName?: string | null;
  dueDate?: string | null;
  status?: MatterComplianceChecklistItem["status"];
  evidenceNote?: string | null;
}) {
  const supabase = createMatterRoomClient();
  if (!supabase) {
    const fallbackRoom = await getMatterRoomById(input.matterId);
    if (!fallbackRoom) {
      throw new Error("Matter room not found for compliance checklist.");
    }

    return mutatePrototypeMatterRoom(input.matterId, fallbackRoom, (room) => {
      const createdAt = new Date().toISOString();
      const currentChecklist =
        room.complianceChecklist ?? {
          id: `checklist-${Date.now()}`,
          title: input.checklistTitle,
          checklistType: input.checklistType,
          overallStatus: "In progress" as const,
          items: [],
        };

      const nextChecklist: MatterComplianceChecklist = {
        ...currentChecklist,
        items: [
          ...currentChecklist.items,
          {
            id: `checklist-item-${Date.now()}`,
            label: input.label,
            ownerName: input.ownerName ?? "Unassigned",
            dueDate: input.dueDate ?? null,
            status: input.status ?? "Pending",
            evidenceNote: input.evidenceNote ?? "",
          },
        ],
      };

      const nextRoom = {
        ...room,
        source: "live" as const,
        complianceChecklist: nextChecklist,
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            actionType: "compliance_item_added",
            description: `Compliance checklist item "${input.label}" was added.`,
            createdAt,
            actorName: "TSIDEK Operator",
          },
          ...room.auditTrail,
        ].slice(0, 20),
      };
      return { room: nextRoom, result: nextRoom };
    });
  }

  const scope = await resolveMatterFirmScope(input.matterId);
  if (!scope) {
    throw new Error("Unable to resolve matter scope for compliance checklist.");
  }

  let checklistId: string | null = null;
  const checklistResult = await scope.supabase
    .from("compliance_checklists")
    .select("id")
    .eq("matter_id", input.matterId)
    .maybeSingle();

  if (checklistResult.error) {
    throw new Error(checklistResult.error.message);
  }

  if (checklistResult.data?.id) {
    checklistId = checklistResult.data.id as string;
  } else {
    const createChecklistResult = await scope.supabase
      .from("compliance_checklists")
      .insert({
        firm_id: scope.firmId,
        matter_id: input.matterId,
        title: input.checklistTitle,
        checklist_type: input.checklistType,
        overall_status: "In progress",
      })
      .select("id")
      .single();

    if (createChecklistResult.error || !createChecklistResult.data) {
      throw new Error(createChecklistResult.error?.message ?? "Unable to create compliance checklist.");
    }

    checklistId = createChecklistResult.data.id as string;
  }

  const itemResult = await scope.supabase.from("compliance_checklist_items").insert({
    checklist_id: checklistId,
    label: input.label,
    owner_name: input.ownerName ?? null,
    due_date: input.dueDate ?? null,
    status: input.status ?? "Pending",
    evidence_note: input.evidenceNote ?? null,
  });

  if (itemResult.error) {
    throw new Error(itemResult.error.message);
  }

  await recordMatterAudit({
    supabase: scope.supabase,
    firmId: scope.firmId,
    matterId: input.matterId,
    actionType: "compliance_item_added",
    description: `Compliance checklist item "${input.label}" was added.`,
  });

  return getMatterRoomById(input.matterId);
}

export async function updateComplianceChecklistItemStatus(input: {
  matterId: string;
  checklistItemId: string;
  status: MatterComplianceChecklistItem["status"];
}) {
  const supabase = createMatterRoomClient();
  if (!supabase) {
    const fallbackRoom = await getMatterRoomById(input.matterId);
    if (!fallbackRoom) {
      throw new Error("Matter room not found for compliance update.");
    }

    return mutatePrototypeMatterRoom(input.matterId, fallbackRoom, (room) => {
      const createdAt = new Date().toISOString();
      const nextRoom = {
        ...room,
        source: "live" as const,
        complianceChecklist: room.complianceChecklist
          ? {
              ...room.complianceChecklist,
              items: room.complianceChecklist.items.map((item) =>
                item.id === input.checklistItemId ? { ...item, status: input.status } : item
              ),
            }
          : room.complianceChecklist,
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            actionType: "compliance_item_updated",
            description: `Compliance checklist item moved to ${input.status}.`,
            createdAt,
            actorName: "TSIDEK Operator",
          },
          ...room.auditTrail,
        ].slice(0, 20),
      };
      return { room: nextRoom, result: nextRoom };
    });
  }

  const scope = await resolveMatterFirmScope(input.matterId);
  if (!scope) {
    throw new Error("Unable to resolve matter scope for compliance update.");
  }

  const result = await scope.supabase
    .from("compliance_checklist_items")
    .update({ status: input.status })
    .eq("id", input.checklistItemId);

  if (result.error) {
    throw new Error(result.error.message);
  }

  await recordMatterAudit({
    supabase: scope.supabase,
    firmId: scope.firmId,
    matterId: input.matterId,
    actionType: "compliance_item_updated",
    description: `Compliance checklist item moved to ${input.status}.`,
  });

  return getMatterRoomById(input.matterId);
}

export async function createKnowledgeEntry(input: {
  matterId: string;
  title: string;
  entryType: MatterKnowledgeEntry["entryType"];
  tags: string[];
  summary: string;
  storagePath?: string | null;
  sensitivity?: MatterKnowledgeEntry["sensitivity"];
}) {
  const supabase = createMatterRoomClient();
  if (!supabase) {
    const fallbackRoom = await getMatterRoomById(input.matterId);
    if (!fallbackRoom) {
      throw new Error("Matter room not found for knowledge entry.");
    }

    return mutatePrototypeMatterRoom(input.matterId, fallbackRoom, (room) => {
      const createdAt = new Date().toISOString();
      const nextRoom = {
        ...room,
        source: "live" as const,
        knowledgeEntries: [
          {
            id: `knowledge-${Date.now()}`,
            title: input.title,
            entryType: input.entryType,
            tags: input.tags,
            summary: input.summary,
            storagePath: input.storagePath ?? null,
            sensitivity: input.sensitivity ?? "Internal",
            createdAt,
          },
          ...room.knowledgeEntries,
        ],
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            actionType: "knowledge_entry_added",
            description: `Knowledge entry "${input.title}" was stored in the firm brain.`,
            createdAt,
            actorName: "TSIDEK Operator",
          },
          ...room.auditTrail,
        ].slice(0, 20),
      };
      return { room: nextRoom, result: nextRoom };
    });
  }

  const scope = await resolveMatterFirmScope(input.matterId);
  if (!scope) {
    throw new Error("Unable to resolve matter scope for knowledge entry.");
  }

  const insertResult = await scope.supabase.from("knowledge_entries").insert({
    firm_id: scope.firmId,
    matter_id: input.matterId,
    title: input.title,
    entry_type: input.entryType,
    tags: input.tags,
    summary: input.summary,
    storage_path: input.storagePath ?? null,
    sensitivity: input.sensitivity ?? "Internal",
  });

  if (insertResult.error) {
    throw new Error(insertResult.error.message);
  }

  await recordMatterAudit({
    supabase: scope.supabase,
    firmId: scope.firmId,
    matterId: input.matterId,
    actionType: "knowledge_entry_added",
    description: `Knowledge entry "${input.title}" was stored in the firm brain.`,
  });

  return getMatterRoomById(input.matterId);
}

export async function upsertMatterCaseField(input: {
  matterId: string;
  fieldKey: string;
  fieldLabel: string;
  fieldValue: string;
  fieldGroup?: string | null;
}) {
  const supabase = createMatterRoomClient();
  if (!supabase) {
    const fallbackRoom = await getMatterRoomById(input.matterId);
    if (!fallbackRoom) {
      throw new Error("Matter room not found for case fields.");
    }

    return mutatePrototypeMatterRoom(input.matterId, fallbackRoom, (room) => {
      const createdAt = new Date().toISOString();
      const nextField: MatterCaseField = {
        id: room.caseFields.find((field) => field.fieldKey === input.fieldKey)?.id ?? `field-${Date.now()}`,
        fieldKey: input.fieldKey,
        fieldLabel: input.fieldLabel,
        fieldValue: input.fieldValue,
        fieldGroup: input.fieldGroup ?? "Core facts",
      };

      const nextRoom = {
        ...room,
        source: "live" as const,
        caseFields: [
          nextField,
          ...room.caseFields.filter((field) => field.fieldKey !== input.fieldKey),
        ],
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            actionType: "case_field_upserted",
            description: `Case field "${input.fieldLabel}" was saved.`,
            createdAt,
            actorName: "TSIDEK Operator",
          },
          ...room.auditTrail,
        ].slice(0, 20),
      };
      return { room: nextRoom, result: nextRoom };
    });
  }

  const scope = await resolveMatterFirmScope(input.matterId);
  if (!scope) {
    throw new Error("Unable to resolve matter scope for case fields.");
  }

  const existing = await scope.supabase
    .from("matter_case_fields")
    .select("id")
    .eq("matter_id", input.matterId)
    .eq("field_key", input.fieldKey)
    .maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  const payload = {
    firm_id: scope.firmId,
    matter_id: input.matterId,
    field_key: input.fieldKey,
    field_label: input.fieldLabel,
    field_value: input.fieldValue,
    field_group: input.fieldGroup ?? "Core facts",
  };

  const result = existing.data?.id
    ? await scope.supabase.from("matter_case_fields").update(payload).eq("id", existing.data.id)
    : await scope.supabase.from("matter_case_fields").insert(payload);

  if (result.error) {
    throw new Error(result.error.message);
  }

  await recordMatterAudit({
    supabase: scope.supabase,
    firmId: scope.firmId,
    matterId: input.matterId,
    actionType: "case_field_upserted",
    description: `Case field "${input.fieldLabel}" was saved.`,
  });

  return getMatterRoomById(input.matterId);
}

export async function createDigitalCaseFile(input: {
  matterId: string;
  fileLabel: string;
  fileCategory: string;
  storagePath?: string | null;
  storageProvider?: string | null;
  referenceCode?: string | null;
  versionLabel?: string | null;
  status?: MatterDigitalCaseFile["status"];
}) {
  const supabase = createMatterRoomClient();
  if (!supabase) {
    const fallbackRoom = await getMatterRoomById(input.matterId);
    if (!fallbackRoom) {
      throw new Error("Matter room not found for digital case file.");
    }

    return mutatePrototypeMatterRoom(input.matterId, fallbackRoom, (room) => {
      const createdAt = new Date().toISOString();
      const nextRoom = {
        ...room,
        source: "live" as const,
        digitalCaseFiles: [
          {
            id: `digital-case-file-${Date.now()}`,
            fileLabel: input.fileLabel,
            fileCategory: input.fileCategory,
            storagePath: input.storagePath ?? null,
            storageProvider: input.storageProvider ?? "TSIDEK Vault",
            referenceCode: input.referenceCode ?? null,
            versionLabel: input.versionLabel ?? null,
            status: input.status ?? "Draft",
            uploadedAt: createdAt,
          },
          ...room.digitalCaseFiles,
        ],
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            actionType: "digital_case_file_added",
            description: `Digital case file "${input.fileLabel}" was registered.`,
            createdAt,
            actorName: "TSIDEK Operator",
          },
          ...room.auditTrail,
        ].slice(0, 20),
      };
      return { room: nextRoom, result: nextRoom };
    });
  }

  const scope = await resolveMatterFirmScope(input.matterId);
  if (!scope) {
    throw new Error("Unable to resolve matter scope for digital case file.");
  }

  const result = await scope.supabase.from("digital_case_files").insert({
    firm_id: scope.firmId,
    matter_id: input.matterId,
    file_label: input.fileLabel,
    file_category: input.fileCategory,
    storage_path: input.storagePath ?? null,
    storage_provider: input.storageProvider ?? "TSIDEK Vault",
    reference_code: input.referenceCode ?? null,
    version_label: input.versionLabel ?? null,
    status: input.status ?? "Draft",
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  await recordMatterAudit({
    supabase: scope.supabase,
    firmId: scope.firmId,
    matterId: input.matterId,
    actionType: "digital_case_file_added",
    description: `Digital case file "${input.fileLabel}" was registered.`,
  });

  return getMatterRoomById(input.matterId);
}

export async function createDocumentTemplate(input: {
  matterId: string;
  title: string;
  practiceArea: string;
  jurisdiction: string;
  language: MatterTemplateProfile["language"];
  templateBody?: string | null;
  preservedFormNote?: string | null;
}) {
  const supabase = createMatterRoomClient();
  if (!supabase) {
    const fallbackRoom = await getMatterRoomById(input.matterId);
    if (!fallbackRoom) {
      throw new Error("Matter room not found for template creation.");
    }

    const templateBody = input.templateBody?.trim() || (await loadBuiltinTemplateBody());

    return mutatePrototypeMatterRoom(input.matterId, fallbackRoom, (room) => {
      const createdAt = new Date().toISOString();
      const nextRoom = {
        ...room,
        source: "live" as const,
        templateProfiles: [
          {
            id: `template-${Date.now()}`,
            title: input.title,
            practiceArea: input.practiceArea,
            jurisdiction: input.jurisdiction,
            language: input.language,
            templateBody,
            preservedFormNote: input.preservedFormNote ?? null,
          },
          ...room.templateProfiles,
        ],
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            actionType: "template_created",
            description: `Document template "${input.title}" was stored for personalization.`,
            createdAt,
            actorName: "TSIDEK Operator",
          },
          ...room.auditTrail,
        ].slice(0, 20),
      };
      return { room: nextRoom, result: nextRoom };
    });
  }

  const scope = await resolveMatterFirmScope(input.matterId);
  if (!scope) {
    throw new Error("Unable to resolve matter scope for template creation.");
  }

  const templateBody = input.templateBody?.trim() || (await loadBuiltinTemplateBody());

  const result = await scope.supabase.from("document_templates").insert({
    firm_id: scope.firmId,
    title: input.title,
    practice_area: input.practiceArea,
    jurisdiction: input.jurisdiction,
    language: input.language,
    template_body: templateBody,
    preserved_form_note: input.preservedFormNote ?? null,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  await recordMatterAudit({
    supabase: scope.supabase,
    firmId: scope.firmId,
    matterId: input.matterId,
    actionType: "template_created",
    description: `Document template "${input.title}" was stored for personalization.`,
  });

  return getMatterRoomById(input.matterId);
}

export async function generatePersonalizedMatterDraft(input: {
  matterId: string;
  templateId?: string | null;
  title?: string | null;
  contextNote?: string | null;
}) {
  const supabase = createMatterRoomClient();
  const room = await getMatterRoomById(input.matterId);
  if (!room) {
    throw new Error("Matter room not found for draft generation.");
  }

  let templateProfile: MatterTemplateProfile | null =
    room.templateProfiles.find((item) => item.id === input.templateId) ??
    room.templateProfiles[0] ??
    null;

  if (!templateProfile) {
    const builtinBody = await loadBuiltinTemplateBody();
    templateProfile = {
      id: "builtin-assignation",
      title: input.title?.trim() || "Built-in Heritage Template",
      practiceArea: room.matter.matterType,
      jurisdiction: room.matter.jurisdiction,
      language: "FR",
      templateBody: builtinBody,
      preservedFormNote: "Preserve the original chamber structure and signature flow.",
    };
  }

  const personalized = personalizeTemplate({
    matter: room.matter,
    fields: room.caseFields,
    template: templateProfile,
    contextNote: input.contextNote,
  });

  if (!supabase) {
    const nextRoom = await mutatePrototypeMatterRoom(input.matterId, room, (currentRoom) => {
      const createdAt = new Date().toISOString();
      const generation: MatterTemplateGeneration = {
        id: `generation-${Date.now()}`,
        title: input.title?.trim() || personalized.title,
        contextNote: personalized.contextNote,
        outputText: personalized.outputText,
        generatedAt: createdAt,
      };

      const updatedRoom = {
        ...currentRoom,
        source: "live" as const,
        templateGenerations: [generation, ...currentRoom.templateGenerations],
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            actionType: "personalized_draft_generated",
            description: `A personalized draft was generated from ${templateProfile.title}.`,
            createdAt,
            actorName: "TSIDEK Operator",
          },
          ...currentRoom.auditTrail,
        ].slice(0, 20),
      };

      return {
        room: updatedRoom,
        result: updatedRoom,
      };
    });

    return {
      room: nextRoom,
      draft: {
        title: input.title?.trim() || personalized.title,
        outputText: personalized.outputText,
        contextNote: personalized.contextNote,
      },
    };
  }

  const scope = await resolveMatterFirmScope(input.matterId);
  if (!scope) {
    throw new Error("Unable to resolve matter scope for draft generation.");
  }

  if (input.templateId) {
    const saveResult = await scope.supabase.from("template_generations").insert({
      firm_id: scope.firmId,
      matter_id: input.matterId,
      template_id: input.templateId,
      title: input.title?.trim() || personalized.title,
      context_note: personalized.contextNote,
      output_text: personalized.outputText,
    });

    if (saveResult.error) {
      throw new Error(saveResult.error.message);
    }
  }

  await recordMatterAudit({
    supabase: scope.supabase,
    firmId: scope.firmId,
    matterId: input.matterId,
    actionType: "personalized_draft_generated",
    description: `A personalized draft was generated from ${templateProfile.title}.`,
  });

  return {
    room: await getMatterRoomById(input.matterId),
    draft: {
      title: input.title?.trim() || personalized.title,
      outputText: personalized.outputText,
      contextNote: personalized.contextNote,
    },
  };
}

export async function archivePersonalizedDraft(input: {
  matterId: string;
  title: string;
  outputText: string;
  contextNote?: string | null;
  storagePath?: string | null;
  oneDriveFileId?: string | null;
}) {
  const supabase = createMatterRoomClient();
  if (!supabase) {
    const fallbackRoom = await getMatterRoomById(input.matterId);
    if (!fallbackRoom) {
      throw new Error("Matter room not found for draft archive.");
    }

    return mutatePrototypeMatterRoom(input.matterId, fallbackRoom, (room) => {
      const createdAt = new Date().toISOString();
      const storagePath = input.storagePath ?? `vault/${input.matterId}/drafts/${input.title}`;
      const nextRoom = {
        ...room,
        source: "live" as const,
        digitalCaseFiles: [
          {
            id: `digital-case-file-${Date.now()}`,
            fileLabel: input.title,
            fileCategory: "Personalized draft",
            storagePath,
            storageProvider: "TSIDEK Vault",
            referenceCode: input.oneDriveFileId ?? null,
            versionLabel: "v1",
            status: "Active" as const,
            uploadedAt: createdAt,
          },
          ...room.digitalCaseFiles,
        ],
        documents: [
          {
            id: `document-${Date.now()}`,
            title: input.title,
            documentType: "Drafting",
            documentStatus: "Draft" as const,
            reviewStatus: "Approved" as const,
            accessLevel: "Lead+Partner" as const,
            sharingPolicy: "Internal only" as const,
            versionLabel: "v1",
            storagePath,
            oneDriveFileId: input.oneDriveFileId ?? null,
            syncStatus: input.oneDriveFileId ? ("OneDrive linked" as const) : ("Local only" as const),
            aiSummary: input.contextNote ?? "Personalized draft archived from the matter studio.",
            requiresComplianceAudit: true,
            reviewNote: input.contextNote ?? "Personalized draft archived from the matter studio.",
            filedAt: null,
            createdAt,
          },
          ...room.documents,
        ],
        knowledgeEntries: [
          {
            id: `knowledge-${Date.now()}`,
            title: `${input.title} archive note`,
            entryType: "Strategy note" as const,
            tags: ["Personalized draft", "Archived"],
            summary: input.outputText.slice(0, 1200),
            storagePath,
            sensitivity: "Restricted" as const,
            createdAt,
          },
          ...room.knowledgeEntries,
        ],
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            actionType: "personalized_draft_archived",
            description: `Personalized draft "${input.title}" was archived into the digital case store.`,
            createdAt,
            actorName: "TSIDEK Operator",
          },
          ...room.auditTrail,
        ].slice(0, 20),
      };

      return { room: nextRoom, result: nextRoom };
    });
  }

  const scope = await resolveMatterFirmScope(input.matterId);
  if (!scope) {
    throw new Error("Unable to resolve matter scope for draft archive.");
  }

  const [caseFileResult, documentResult, knowledgeResult] = await Promise.all([
    scope.supabase.from("digital_case_files").insert({
      firm_id: scope.firmId,
      matter_id: input.matterId,
      file_label: input.title,
      file_category: "Personalized draft",
      storage_path: input.storagePath ?? `vault/${input.matterId}/drafts/${input.title}`,
      storage_provider: "TSIDEK Vault",
      reference_code: input.oneDriveFileId ?? null,
      version_label: "v1",
      status: "Active",
    }),
    scope.supabase.from("documents").insert({
      matter_id: input.matterId,
      uploaded_by: null,
      title: input.title,
      document_type: "Drafting",
      onedrive_file_id: input.oneDriveFileId ?? null,
      storage_path: input.storagePath ?? `vault/${input.matterId}/drafts/${input.title}`,
      ai_summary: input.contextNote ?? "Personalized draft archived from the matter studio.",
      requires_compliance_audit: true,
    }),
    scope.supabase.from("knowledge_entries").insert({
      firm_id: scope.firmId,
      matter_id: input.matterId,
      title: `${input.title} archive note`,
      entry_type: "Strategy note",
      tags: ["Personalized draft", "Archived"],
      summary: input.outputText.slice(0, 1200),
      storage_path: input.storagePath ?? null,
      sensitivity: "Restricted",
    }),
  ]);

  if (caseFileResult.error) {
    throw new Error(caseFileResult.error.message);
  }
  if (documentResult.error) {
    throw new Error(documentResult.error.message);
  }
  if (knowledgeResult.error) {
    throw new Error(knowledgeResult.error.message);
  }

  await recordMatterAudit({
    supabase: scope.supabase,
    firmId: scope.firmId,
    matterId: input.matterId,
    actionType: "personalized_draft_archived",
    description: `Personalized draft "${input.title}" was archived into the digital case store.`,
  });

  return getMatterRoomById(input.matterId);
}

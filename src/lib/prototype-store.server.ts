import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { seededMatterWorkspaceRecords, type MatterWorkspaceData } from "@/lib/matters";

type PrototypeState = {
  matters: MatterWorkspaceData[];
};

const stateFilePath = path.join(process.cwd(), ".runtime", "tsidkenu-prototype-state.json");

async function readState(): Promise<PrototypeState> {
  try {
    const raw = await readFile(stateFilePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<PrototypeState>;
    if (Array.isArray(parsed.matters) && parsed.matters.length) {
      return { matters: parsed.matters as MatterWorkspaceData[] };
    }
  } catch {
    // Fall through to default seed data.
  }

  return { matters: seededMatterWorkspaceRecords };
}

async function writeState(state: PrototypeState) {
  await mkdir(path.dirname(stateFilePath), { recursive: true });
  await writeFile(stateFilePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function nextMatterId(existingIds: string[]) {
  const currentYear = new Date().getFullYear();
  const prefix = `tsk-cm-${currentYear}-`;
  const nextSequence = existingIds
    .map((id) => {
      const match = id.match(/^tsk-cm-\d{4}-(\d{3})$/i);
      return match ? Number(match[1]) : 0;
    })
    .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `${prefix}${String(nextSequence).padStart(3, "0")}`;
}

function buildNewMatterWorkspace(input: {
  title: string;
  clientName: string;
  matterType: string;
  jurisdiction: string;
  riskLevel: string;
  status: string;
  synopsis: string;
  primaryTrack: string;
  riskToMonitor: string;
  aiUsageRule: string;
  nextDraft: string;
  securityClassification?: "Standard" | "Confidential" | "Partner-only";
  ethicalWallEnabled?: boolean;
}, existingIds: string[]): MatterWorkspaceData {
  const nowLabel = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(new Date());

  const matterId = nextMatterId(existingIds);

  return {
    id: matterId,
    title: input.title,
    clientName: input.clientName,
    matterType: input.matterType,
    status: input.status,
    riskLevel: input.riskLevel,
    jurisdiction: input.jurisdiction,
    leadLawyer: "Unassigned lead lawyer",
    projectManager: "To be assigned",
    physicalFileId: matterId.replace(/^tsk/i, "TSK").toUpperCase(),
    physicalLabel: "Physical file to register",
    physicalLocation: "Registry pending",
    physicalCustody: "No custody event recorded yet",
    synopsis: input.synopsis,
    primaryTrack: input.primaryTrack,
    riskToMonitor: input.riskToMonitor,
    aiUsageRule: input.aiUsageRule,
    nextDraft: input.nextDraft,
    timeline: [
      {
        date: nowLabel,
        title: "Matter created",
        owner: "TSIDEK Workspace",
      },
      {
        date: nowLabel,
        title: "Assign team and register file",
        owner: "Project Manager",
      },
      {
        date: nowLabel,
        title: "Prepare first working draft",
        owner: "Lead Lawyer",
      },
    ],
    documents: [
      {
        name: "Matter intake summary",
        type: "Drafting",
        state: "Newly created",
      },
    ],
    researchNotes: [
      "Matter created in the prototype store before live database wiring is connected.",
      "Use the matter room to add tasks, documents, and case facts immediately.",
    ],
    collaboration: [
      {
        actor: "TSIDEK Workspace",
        role: "System",
        note: "Matter opened and ready for first operational updates.",
      },
    ],
    governanceChecks: [
      "Assign the lead lawyer before external dispatch",
      "Register the physical file before filing activity",
      "Validate the first draft with human review",
      "Keep the client update log matter-specific",
    ],
    approvedTools: "TSIDEK workspace, prototype store, local drafting engine",
    escalationTrigger: "Any external dispatch requires human approval",
    trainingOwner: "To be assigned",
    reviewForum: "Weekly matter review",
    mentorshipPair: "Not yet assigned",
    mentorshipFocus: "Matter onboarding and first draft preparation",
    mentorshipRhythm: "Weekly review",
    securityClassification: input.securityClassification ?? "Standard",
    ethicalWallEnabled: Boolean(input.ethicalWallEnabled),
  };
}

export async function listPrototypeMatterWorkspaces() {
  const state = await readState();
  return state.matters;
}

export async function getPrototypeMatterWorkspaceById(matterId: string) {
  const state = await readState();
  return state.matters.find((matter) => matter.id === matterId) ?? null;
}

export async function createPrototypeMatterWorkspace(input: {
  title: string;
  clientName: string;
  matterType: string;
  jurisdiction: string;
  riskLevel: string;
  status: string;
  synopsis: string;
  primaryTrack: string;
  riskToMonitor: string;
  aiUsageRule: string;
  nextDraft: string;
  securityClassification?: "Standard" | "Confidential" | "Partner-only";
  ethicalWallEnabled?: boolean;
}) {
  const state = await readState();
  const matter = buildNewMatterWorkspace(input, state.matters.map((item) => item.id));
  const matters = [matter, ...state.matters.filter((item) => item.id !== matter.id)];
  await writeState({ matters });
  return matter;
}

export async function upsertPrototypeMatterWorkspace(matter: MatterWorkspaceData) {
  const state = await readState();
  const matters = [matter, ...state.matters.filter((item) => item.id !== matter.id)];
  await writeState({ matters });
  return matter;
}

export function generatePrototypeMatterIdSeed() {
  return randomUUID();
}

import path from "node:path";
import { readFile } from "node:fs/promises";
import type { MatterWorkspaceData } from "@/lib/matters";
import type { MatterCaseField } from "@/lib/matter-room";

export type TemplateProfile = {
  id: string;
  title: string;
  practiceArea: string;
  jurisdiction: string;
  language: "FR" | "EN" | "Bilingual";
  templateBody: string;
  preservedFormNote: string | null;
};

export type PersonalizedDraft = {
  title: string;
  outputText: string;
  contextNote: string | null;
};

const BUILTIN_TEMPLATE_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "templates",
  "Assignation_Paiement.txt"
);

export async function loadBuiltinTemplateBody() {
  return readFile(BUILTIN_TEMPLATE_PATH, "utf8");
}

function normalizeFieldKey(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_")
    .toLowerCase();
}

function buildTemplateVariables(matter: MatterWorkspaceData, fields: MatterCaseField[]) {
  const entries = new Map<string, string>([
    ["matterTitle", matter.title],
    ["clientName", matter.clientName],
    ["matterType", matter.matterType],
    ["jurisdiction", matter.jurisdiction],
    ["leadLawyer", matter.leadLawyer],
    ["projectManager", matter.projectManager],
    ["synopsis", matter.synopsis],
    ["primaryTrack", matter.primaryTrack],
    ["riskToMonitor", matter.riskToMonitor],
    ["nextDraft", matter.nextDraft],
    ["currentDate", new Date().toLocaleDateString("fr-FR")],
  ]);

  for (const field of fields) {
    entries.set(field.fieldKey, field.fieldValue);
    entries.set(normalizeFieldKey(field.fieldLabel), field.fieldValue);
  }

  return entries;
}

export function personalizeTemplate(input: {
  matter: MatterWorkspaceData;
  fields: MatterCaseField[];
  template: TemplateProfile;
  contextNote?: string | null;
}) {
  const variables = buildTemplateVariables(input.matter, input.fields);
  let outputText = input.template.templateBody;

  for (const [key, value] of variables.entries()) {
    outputText = outputText.replace(new RegExp(`{{${key}}}`, "g"), value);
  }

  const unresolved = Array.from(outputText.matchAll(/{{([^}]+)}}/g)).map((item) => item[1]);
  if (unresolved.length) {
    for (const key of unresolved) {
      outputText = outputText.replace(new RegExp(`{{${key}}}`, "g"), `[${key}]`);
    }
  }

  if (input.contextNote?.trim()) {
    outputText = `${outputText}\n\n[Context note]\n${input.contextNote.trim()}`;
  }

  return {
    title: `${input.template.title} • ${input.matter.clientName}`,
    outputText,
    contextNote: input.contextNote?.trim() || null,
  } satisfies PersonalizedDraft;
}

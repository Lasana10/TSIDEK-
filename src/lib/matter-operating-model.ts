export type MatterNature = "contentious" | "transactional" | "registration" | "advisory" | "diligence" | "compliance" | "custom";

export type MatterOperatingModel = {
  nature: MatterNature;
  practiceArea: string;
  serviceType: string;
  objective: string;
  planLabel: string;
  workstreams: string[];
  milestones: string[];
};

const textHas = (text: string, terms: string[]) => terms.some((term) => text.includes(term));

export function inferMatterOperatingModel(input: { matterType?: string; synopsis?: string; title?: string; jurisdiction?: string; objective?: string }): MatterOperatingModel {
  const text = `${input.matterType ?? ""} ${input.synopsis ?? ""} ${input.title ?? ""} ${input.jurisdiction ?? ""}`.toLowerCase();
  let nature: MatterNature = "custom";
  let practiceArea = "General legal practice";
  let serviceType = input.matterType?.trim() || "Custom legal instruction";
  let planLabel = "Matter plan";
  let workstreams = ["Instructions & scope", "Facts & documents", "Legal analysis", "Client decisions", "Deliverable & closure"];
  let milestones = ["Scope confirmed", "Core record assembled", "Legal position reviewed", "Client decision recorded", "Instruction completed"];

  if (textHas(text, ["due diligence", "diligence", "dd "])) {
    nature = "diligence"; practiceArea = "Due diligence"; planLabel = "Review plan";
    workstreams = ["Scope & request list", "Document coverage", "Verification", "Findings & risk", "Final report"];
    milestones = ["Scope approved", "Request list issued", "Material reviewed", "High-impact findings verified", "Report approved"];
  } else if (textHas(text, ["incorporat", "company registration", "register company", "rccm", "business registration"])) {
    nature = "registration"; practiceArea = "Corporate"; planLabel = "Registration plan";
    workstreams = ["KYC & founders", "Structure & ownership", "Corporate documents", "Authority filing", "Post-registration handover"];
    milestones = ["Requirements complete", "Structure approved", "Documents executed", "Filing acknowledged", "Registration evidence delivered"];
  } else if (textHas(text, ["trademark", "patent", "oapi", "intellectual property", "design registration"])) {
    nature = "registration"; practiceArea = "Intellectual property"; planLabel = "Registration plan";
    workstreams = ["Asset & ownership", "Search & classification", "Application dossier", "Examination / opposition", "Registration & renewal"];
    milestones = ["Asset verified", "Search completed", "Application filed", "Authority outcome recorded", "Registration evidence delivered"];
  } else if (textHas(text, ["land title", "mutation", "conveyanc", "property transfer", "title transfer"]) && !textHas(text, ["dispute", "court", "litigation", "claim"])) {
    nature = "registration"; practiceArea = "Land & property"; planLabel = "Property formalities plan";
    workstreams = ["Ownership chain", "Technical / cadastral record", "Notarial formalities", "Fiscal & authority steps", "Mutation / title handover"];
    milestones = ["Title verified", "Transfer authority confirmed", "Formalities executed", "Registration acknowledged", "Updated title delivered"];
  } else if (textHas(text, ["contract review", "draft contract", "legal opinion", "advisory", "advice", "opinion"])) {
    nature = "advisory"; practiceArea = textHas(text, ["contract"]) ? "Contracts" : "Advisory"; planLabel = "Analysis plan";
    workstreams = ["Question & scope", "Facts & authorities", "Analysis / drafting", "Review & client options", "Delivery"];
    milestones = ["Question confirmed", "Record complete", "Analysis prepared", "Professional review complete", "Advice / document delivered"];
  } else if (textHas(text, ["acquisition", "merger", "share purchase", "investment", "transaction", "closing"])) {
    nature = "transactional"; practiceArea = "Corporate / transactions"; planLabel = "Deal plan";
    workstreams = ["Structure & scope", "Due diligence", "Negotiation & documents", "Approvals / conditions", "Signing & closing"];
    milestones = ["Structure agreed", "Diligence position known", "Documents agreed", "Conditions satisfied", "Closing completed"];
  } else if (textHas(text, ["compliance", "retainer", "corporate secretary", "renewal", "regulatory monitoring"])) {
    nature = "compliance"; practiceArea = "Compliance / regulatory"; planLabel = "Obligations plan";
    workstreams = ["Applicable obligations", "Calendar & owners", "Evidence & gaps", "Filings / remediation", "Recurring monitoring"];
    milestones = ["Obligations mapped", "Owners assigned", "Evidence current", "Due actions completed", "Next cycle scheduled"];
  } else if (textHas(text, ["divorce", "custody", "succession", "probate", "family"])) {
    nature = "contentious"; practiceArea = "Family / persons"; planLabel = "Resolution plan";
    workstreams = ["Sensitive intake & parties", "Status / family evidence", "Issues & options", "Settlement / procedure", "Orders & follow-through"];
    milestones = ["Instructions confirmed", "Core evidence verified", "Resolution route chosen", "Procedure / settlement progressed", "Outcome implemented"];
  } else if (textHas(text, ["criminal", "complaint", "prosecution", "bail", "police", "investigation"])) {
    nature = "contentious"; practiceArea = "Criminal"; planLabel = "Defence / complaint plan";
    workstreams = ["Allegation & chronology", "Evidence & investigation", "Immediate safeguards", "Procedure & advocacy", "Outcome / follow-through"];
    milestones = ["Instructions secured", "Evidence position known", "Immediate action completed", "Procedural stage prepared", "Outcome recorded"];
  } else if (textHas(text, ["employment", "labour", "dismissal", "employee", "employer"])) {
    nature = "contentious"; practiceArea = "Employment / labour"; planLabel = "Resolution plan";
    workstreams = ["Employment record", "Claims & remedies", "Conciliation / Labour Inspector", "Proceedings if required", "Resolution & enforcement"];
    milestones = ["Employment record complete", "Claims assessed", "Pre-court route completed", "Proceedings / settlement progressed", "Remedy implemented"];
  } else if (textHas(text, ["debt", "recovery", "dispute", "litigation", "court", "claim", "civil", "commercial", "hearing"])) {
    nature = "contentious"; practiceArea = textHas(text, ["commercial", "ohada", "debt"]) ? "Commercial / OHADA" : "Civil litigation"; planLabel = "Case strategy";
    workstreams = ["Facts & chronology", "Claims / defences", "Evidence & authorities", "Procedure / negotiation", "Decision & enforcement"];
    milestones = ["Theory of case reviewed", "Evidence gaps resolved", "Procedural route confirmed", "Hearing / resolution progressed", "Outcome enforced / closed"];
  }

  return {
    nature,
    practiceArea,
    serviceType,
    objective: input.objective?.trim() || input.synopsis?.trim() || `Complete the client's ${serviceType.toLowerCase()} instruction with a verified professional record.`,
    planLabel,
    workstreams,
    milestones,
  };
}

export type FirmOperatingProfile = {
  practice_model: string;
  professional_count_band: string;
  practice_areas: string[];
  office_count: number;
  approval_model: string;
  billing_models: string[];
  client_types: string[];
  litigation_mix: string;
  support_staff_model: string;
  confidentiality_mode: string;
  profile_notes?: string | null;
  configuration?: Record<string, unknown>;
};

export type OperatingRecommendation = {
  recommendation_key: string;
  category: "client_onboarding" | "litigation" | "team_work" | "billing" | "documents" | "client_updates" | "confidentiality";
  title: string;
  description: string;
  rationale: string;
  source_kind: "profile" | "observed" | "manual";
  suggested_configuration: Record<string, unknown>;
};

function includesAny(items: string[], values: string[]) {
  const normalized = new Set(items.map((item) => item.toLowerCase()));
  return values.some((value) => normalized.has(value.toLowerCase()));
}

export function buildOperatingRecommendations(profile: FirmOperatingProfile): OperatingRecommendation[] {
  const recommendations: OperatingRecommendation[] = [];
  const litigationHeavy = profile.litigation_mix === "litigation_heavy" || includesAny(profile.practice_areas, ["litigation", "dispute_resolution", "criminal", "employment"]);
  const corporateHeavy = includesAny(profile.practice_areas, ["corporate", "commercial", "m_and_a", "banking", "ip", "tax"]);
  const partnerApproval = profile.approval_model === "partner_review" || profile.approval_model === "partner_final";
  const largerTeam = ["15_30", "31_plus"].includes(profile.professional_count_band);
  const higherConfidentiality = ["strict", "high"].includes(profile.confidentiality_mode);

  recommendations.push({
    recommendation_key: "client_onboarding_conflict_kyc",
    category: "client_onboarding",
    title: "Client onboarding",
    description: "Conflict check before engagement, KYC before matter activation, and governed matter opening.",
    rationale: partnerApproval
      ? "Your approval model uses partner review, so high-risk onboarding should preserve a partner decision point."
      : "This creates a consistent intake path without forcing one rigid firm template.",
    source_kind: "profile",
    suggested_configuration: {
      sequence: ["intake", "conflict_check", "kyc", "engagement", "matter_opening"],
      conflict_required: true,
      kyc_required_before_activation: true,
      high_risk_partner_approval: partnerApproval,
    },
  });

  if (litigationHeavy) {
    recommendations.push({
      recommendation_key: "litigation_court_reporting",
      category: "litigation",
      title: "Litigation work",
      description: "Consultation → Instructions → Filing → Hearing → Compte Rendu → Follow-up → Billing.",
      rationale: "Your practice mix is litigation-heavy, so court activity should create a clear reporting and follow-up trail.",
      source_kind: "profile",
      suggested_configuration: {
        stages: ["consultation", "instructions", "filing", "hearing", "compte_rendu", "follow_up", "billing"],
        require_compte_rendu_after_hearing: true,
        require_follow_up_owner: true,
      },
    });
  }

  recommendations.push({
    recommendation_key: "team_work_assignment_approvals",
    category: "team_work",
    title: "Team work",
    description: "Matter conversations, assigned work, review points and partner approvals stay tied to the file.",
    rationale: largerTeam
      ? "A larger professional team benefits from explicit ownership and review points."
      : "This keeps delegation simple while preserving accountability.",
    source_kind: "profile",
    suggested_configuration: {
      assignment_required: true,
      review_required_for_external_output: partnerApproval,
      matter_conversations_enabled: true,
      escalation_on_overdue: largerTeam,
    },
  });

  recommendations.push({
    recommendation_key: "billing_expense_controls",
    category: "billing",
    title: "Billing and disbursements",
    description: "Separate fees from disbursements, require approval for exceptional expenses, and preserve matter-linked evidence.",
    rationale: "This reduces ambiguity around client money, office expenses and recoverable disbursements.",
    source_kind: "profile",
    suggested_configuration: {
      separate_disbursements: true,
      expense_approval: partnerApproval || largerTeam,
      evidence_required_for_reimbursement: true,
      billing_models: profile.billing_models,
    },
  });

  if (corporateHeavy) {
    recommendations.push({
      recommendation_key: "corporate_document_review",
      category: "documents",
      title: "Corporate and transactional review",
      description: "Use structured document review, approval checkpoints and controlled execution packs for transactional work.",
      rationale: "Your practice areas include transactional/corporate work where document versioning and approval discipline matter.",
      source_kind: "profile",
      suggested_configuration: {
        version_control_required: true,
        approval_before_external_share: partnerApproval,
        execution_pack_required: true,
      },
    });
  }

  recommendations.push({
    recommendation_key: "client_update_rules",
    category: "client_updates",
    title: "Client updates",
    description: "Set clear update expectations by matter type, with important milestones recorded before external communication.",
    rationale: "A predictable update rhythm reduces missed communication without over-notifying clients.",
    source_kind: "profile",
    suggested_configuration: {
      milestone_updates_required: true,
      litigation_hearing_update: litigationHeavy,
      approval_for_sensitive_update: partnerApproval,
    },
  });

  if (higherConfidentiality) {
    recommendations.push({
      recommendation_key: "confidentiality_restricted_default",
      category: "confidentiality",
      title: "Confidentiality controls",
      description: "Use stricter defaults for sensitive matters, with explicit access and AI/storage restrictions.",
      rationale: "Your confidentiality requirement is set above standard, so sensitive work should inherit stronger defaults.",
      source_kind: "profile",
      suggested_configuration: {
        restricted_matter_default: true,
        explicit_access_for_highly_confidential: true,
        ai_mode_for_highly_confidential: "private_or_disabled",
      },
    });
  }

  return recommendations;
}

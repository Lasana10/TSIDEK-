import { GoogleGenerativeAI } from "@google/generative-ai";
import { readVaultFile } from "@/lib/file-vault";

export type DocumentExtraction = {
  title: string | null;
  documentType: string | null;
  documentDate: string | null;
  language: string | null;
  parties: string[];
  identifiers: string[];
  keyFacts: string[];
  obligations: string[];
  datesAndDeadlines: string[];
  monetaryTerms: string[];
  legalReferences: string[];
  contradictionsOrGaps: string[];
  suggestedMatterActions: string[];
  summary: string | null;
  confidence: number;
  warnings: string[];
};

type DocumentProvider = "openrouter" | "gemini";

function parseJsonObject(value: string): Record<string, unknown> {
  const cleaned = value.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first < 0 || last < first) throw new Error("Document intelligence returned no JSON object.");
  return JSON.parse(cleaned.slice(first, last + 1)) as Record<string, unknown>;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()).slice(0, 50)
    : [];
}

function normalizeExtraction(parsed: Record<string, unknown>): DocumentExtraction {
  const confidenceRaw = Number(parsed.confidence);
  return {
    title: stringOrNull(parsed.title),
    documentType: stringOrNull(parsed.documentType),
    documentDate: stringOrNull(parsed.documentDate),
    language: stringOrNull(parsed.language),
    parties: stringArray(parsed.parties),
    identifiers: stringArray(parsed.identifiers),
    keyFacts: stringArray(parsed.keyFacts),
    obligations: stringArray(parsed.obligations),
    datesAndDeadlines: stringArray(parsed.datesAndDeadlines),
    monetaryTerms: stringArray(parsed.monetaryTerms),
    legalReferences: stringArray(parsed.legalReferences),
    contradictionsOrGaps: stringArray(parsed.contradictionsOrGaps),
    suggestedMatterActions: stringArray(parsed.suggestedMatterActions),
    summary: stringOrNull(parsed.summary),
    confidence: Number.isFinite(confidenceRaw) ? Math.min(1, Math.max(0, confidenceRaw)) : 0,
    warnings: stringArray(parsed.warnings),
  };
}

function promptFor(originalName: string) {
  return `You are TSIDKENU's governed document-intelligence engine for a law firm. Extract only what is supported by the document and never invent facts, law, authority, deadlines, obligations or amounts. Return JSON only with keys: title, documentType, documentDate (YYYY-MM-DD or null), language, parties (array), identifiers (array), keyFacts (array), obligations (array), datesAndDeadlines (array), monetaryTerms (array), legalReferences (array), contradictionsOrGaps (array), suggestedMatterActions (array), summary, confidence (0 to 1), warnings (array). Suggested actions must be framed as reviewable proposals, never as completed acts. The original filename is ${JSON.stringify(originalName)}. Flag uncertainty explicitly.`;
}

function openRouterMessageText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (!Array.isArray(value)) return "";
  return value.map((part) => {
    if (!part || typeof part !== "object") return "";
    const text = (part as { text?: unknown }).text;
    return typeof text === "string" ? text : "";
  }).join("\n").trim();
}

function providerOrder(): DocumentProvider[] {
  const configured = String(process.env.TSIDEK_DOCUMENT_AI_PROVIDER || "auto").trim().toLowerCase();
  if (configured === "gemini") return ["gemini", "openrouter"];
  if (configured === "openrouter") return ["openrouter", "gemini"];
  return ["openrouter", "gemini"];
}

async function runOpenRouterVision(input: { data: Buffer; mimeType: string; originalName: string }) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OpenRouter document intelligence is not configured.");
  if (!input.mimeType.startsWith("image/")) throw new Error("OpenRouter vision currently supports image scans only; the original remains preserved for human review.");

  const modelName = process.env.TSIDEK_OPENROUTER_VISION_MODEL || "google/gemini-3-flash-preview";
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://tsidek-os.onrender.com",
      "X-OpenRouter-Title": "TSIDKENU document intelligence",
    },
    body: JSON.stringify({
      model: modelName,
      temperature: 0,
      provider: { data_collection: "deny" },
      messages: [{ role: "user", content: [
        { type: "text", text: promptFor(input.originalName) },
        { type: "image_url", image_url: { url: `data:${input.mimeType};base64,${input.data.toString("base64")}` } },
      ] }],
    }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({})) as { choices?: Array<{ message?: { content?: unknown } }> };
  if (!response.ok) throw new Error(`OpenRouter document intelligence failed (${response.status}).`);
  const text = openRouterMessageText(payload.choices?.[0]?.message?.content);
  if (!text) throw new Error("OpenRouter document intelligence returned no usable extraction.");
  return { extraction: normalizeExtraction(parseJsonObject(text)), provider: "openrouter" as const, model: modelName };
}

async function runGemini(input: { data: Buffer; mimeType: string; originalName: string }) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("Gemini document intelligence is not configured.");
  const modelName = process.env.TSIDEK_DOCUMENT_AI_MODEL || "gemini-2.5-flash";
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent([
    { text: promptFor(input.originalName) },
    { inlineData: { data: input.data.toString("base64"), mimeType: input.mimeType || "application/octet-stream" } },
  ]);
  return { extraction: normalizeExtraction(parseJsonObject(result.response.text())), provider: "gemini" as const, model: modelName };
}

export async function extractDocumentIntelligence(input: { storageRef: string; mimeType: string; originalName: string }) {
  const data = await readVaultFile(input.storageRef);
  const maxBytes = Number(process.env.TSIDEK_DOCUMENT_AI_MAX_BYTES || 12_000_000);
  if (data.byteLength > maxBytes) throw new Error(`Document exceeds the configured document-intelligence limit (${maxBytes} bytes).`);

  const failures: string[] = [];
  for (const provider of providerOrder()) {
    try {
      if (provider === "openrouter" && process.env.OPENROUTER_API_KEY) return await runOpenRouterVision({ data, mimeType: input.mimeType || "application/octet-stream", originalName: input.originalName });
      if (provider === "gemini" && process.env.GEMINI_API_KEY) return await runGemini({ data, mimeType: input.mimeType || "application/octet-stream", originalName: input.originalName });
    } catch (error) {
      failures.push(`${provider}: ${error instanceof Error ? error.message : "provider failed"}`);
    }
  }

  const detail = failures.length ? ` (${failures.join("; ")})` : "";
  throw new Error(`No permitted document-intelligence provider completed the extraction. The original remains preserved for human review${detail}.`);
}

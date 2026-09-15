import { GoogleGenerativeAI } from "@google/generative-ai";
import { readVaultFile } from "@/lib/file-vault";

export type DocumentExtraction = {
  title: string | null;
  documentType: string | null;
  documentDate: string | null;
  language: string | null;
  parties: string[];
  identifiers: string[];
  summary: string | null;
  confidence: number;
  warnings: string[];
};

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
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()).slice(0, 30) : [];
}

export async function extractDocumentIntelligence(input: { storageRef: string; mimeType: string; originalName: string }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Document intelligence requires GEMINI_API_KEY or a future configured private document provider.");
  const data = await readVaultFile(input.storageRef);
  const maxBytes = Number(process.env.TSIDEK_DOCUMENT_AI_MAX_BYTES || 12_000_000);
  if (data.byteLength > maxBytes) throw new Error(`Document exceeds the configured document-intelligence limit (${maxBytes} bytes).`);

  const modelName = process.env.TSIDEK_DOCUMENT_AI_MODEL || "gemini-2.5-flash";
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  const prompt = `You are TSIDKENU's document intake classifier for a law firm operating in Cameroon/OHADA/CEMAC/OAPI contexts. Extract only what is supported by the document. Never invent facts. Return JSON only with keys: title, documentType, documentDate (YYYY-MM-DD or null), language, parties (array), identifiers (array), summary, confidence (0 to 1), warnings (array). The original filename is ${JSON.stringify(input.originalName)}. Use concise professional labels and flag uncertainty in warnings.`;
  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { data: data.toString("base64"), mimeType: input.mimeType || "application/octet-stream" } },
  ]);
  const parsed = parseJsonObject(result.response.text());
  const confidenceRaw = Number(parsed.confidence);
  const extraction: DocumentExtraction = {
    title: stringOrNull(parsed.title),
    documentType: stringOrNull(parsed.documentType),
    documentDate: stringOrNull(parsed.documentDate),
    language: stringOrNull(parsed.language),
    parties: stringArray(parsed.parties),
    identifiers: stringArray(parsed.identifiers),
    summary: stringOrNull(parsed.summary),
    confidence: Number.isFinite(confidenceRaw) ? Math.min(1, Math.max(0, confidenceRaw)) : 0,
    warnings: stringArray(parsed.warnings),
  };
  return { extraction, provider:"gemini" as const, model:modelName };
}

import { envHealth } from "./types";

export type NextcloudCredentials = { baseUrl?: string; username?: string; appPassword?: string };

function resolved(credentials?: NextcloudCredentials) {
  return {
    baseUrl: (credentials?.baseUrl || process.env.NEXTCLOUD_BASE_URL || "").replace(/\/$/, ""),
    username: credentials?.username || process.env.NEXTCLOUD_USERNAME || "",
    appPassword: credentials?.appPassword || process.env.NEXTCLOUD_APP_PASSWORD || "",
  };
}

function authHeader(credentials?: NextcloudCredentials) {
  const value = resolved(credentials);
  return `Basic ${Buffer.from(`${value.username}:${value.appPassword}`).toString("base64")}`;
}

function assertConfigured(credentials?: NextcloudCredentials) {
  const value = resolved(credentials);
  const missing = [!value.baseUrl && "baseUrl", !value.username && "username", !value.appPassword && "appPassword"].filter(Boolean);
  if (missing.length) throw new Error(`Nextcloud not configured: ${missing.join(", ")}`);
  return value;
}

export const nextcloudHealth = () =>
  envHealth("nextcloud", "storage", ["NEXTCLOUD_BASE_URL", "NEXTCLOUD_USERNAME", "NEXTCLOUD_APP_PASSWORD"], "hybrid");

function target(path: string, credentials?: NextcloudCredentials) {
  const value = assertConfigured(credentials);
  const user = encodeURIComponent(value.username);
  return `${value.baseUrl}/remote.php/dav/files/${user}${path.startsWith("/") ? path : `/${path}`}`;
}

const TRANSIENT_UPSTREAM_STATUSES = new Set([502, 503, 504]);

async function nextcloudFetch(path: string, init: RequestInit, credentials?: NextcloudCredentials) {
  const attempts = 3;
  let response: Response | undefined;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    response = await fetch(target(path, credentials), { ...init, cache: "no-store" });
    if (!TRANSIENT_UPSTREAM_STATUSES.has(response.status) || attempt === attempts) return response;
    await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
  }
  throw new Error("Nextcloud request did not produce a response.");
}

function assertNextcloudResponse(response: Response, operation: string, allowedStatuses: number[] = []) {
  if (response.ok || allowedStatuses.includes(response.status)) return;
  if (TRANSIENT_UPSTREAM_STATUSES.has(response.status)) {
    throw new Error(`Nextcloud upstream unavailable after retries during ${operation} (${response.status})`);
  }
  throw new Error(`Nextcloud ${operation} failed (${response.status})`);
}

export async function nextcloudList(path = "/", credentials?: NextcloudCredentials) {
  const response = await nextcloudFetch(path, {
    method: "PROPFIND",
    headers: { Authorization: authHeader(credentials), Depth: "1", "Content-Type": "application/xml; charset=utf-8" },
    body: `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/><d:getcontentlength/><d:getlastmodified/><d:resourcetype/></d:prop></d:propfind>`,
  }, credentials);
  assertNextcloudResponse(response, "PROPFIND");
  return response.text();
}

export async function nextcloudPut(path: string, data: BodyInit, contentType = "application/octet-stream", credentials?: NextcloudCredentials) {
  const response = await nextcloudFetch(path, {
    method: "PUT",
    headers: { Authorization: authHeader(credentials), "Content-Type": contentType },
    body: data,
  }, credentials);
  assertNextcloudResponse(response, "upload");
  return { ok: true, status: response.status, path };
}

export async function nextcloudDelete(path: string, credentials?: NextcloudCredentials) {
  const response = await nextcloudFetch(path, { method: "DELETE", headers: { Authorization: authHeader(credentials) } }, credentials);
  assertNextcloudResponse(response, "cleanup", [404]);
  return { ok: true, status: response.status };
}

export async function verifyNextcloud(credentials?: NextcloudCredentials) {
  const xml = await nextcloudList("/", credentials);
  const marker = `/.tsidkenu-health-${Date.now()}.txt`;
  const uploaded = await nextcloudPut(marker, "TSIDKENU integration verification", "text/plain", credentials);
  await nextcloudDelete(marker, credentials);
  return { ok: true, rootAccessible: xml.includes("multistatus") || xml.includes("response"), uploadStatus: uploaded.status };
}

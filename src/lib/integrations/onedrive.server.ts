import { envHealth } from "./types";

type OneDriveCredentials = {
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  driveId?: string;
  userId?: string;
  userPrincipalName?: string;
};

function envValue(primary: string, legacy: string) {
  return process.env[primary] || process.env[legacy] || "";
}

function credentials(override?: OneDriveCredentials) {
  return {
    tenantId: override?.tenantId || envValue("ONEDRIVE_TENANT_ID", "MICROSOFT_TENANT_ID"),
    clientId: override?.clientId || envValue("ONEDRIVE_CLIENT_ID", "MICROSOFT_CLIENT_ID"),
    clientSecret: override?.clientSecret || envValue("ONEDRIVE_CLIENT_SECRET", "MICROSOFT_CLIENT_SECRET"),
    driveId: override?.driveId || process.env.ONEDRIVE_DRIVE_ID || "",
    userId: override?.userId || process.env.ONEDRIVE_USER_ID || "",
    userPrincipalName: override?.userPrincipalName || process.env.ONEDRIVE_USER_PRINCIPAL_NAME || "",
  };
}

export const oneDriveHealth = () => {
  const c = credentials();
  const missing = [
    !c.tenantId ? "ONEDRIVE_TENANT_ID" : null,
    !c.clientId ? "ONEDRIVE_CLIENT_ID" : null,
    !c.clientSecret ? "ONEDRIVE_CLIENT_SECRET" : null,
  ].filter(Boolean) as string[];
  if (!missing.length) return { provider: "onedrive", category: "storage", configured: true, missing: [], mode: "cloud" };
  return envHealth("onedrive", "storage", missing, "cloud");
};

async function appAccessToken(override?: OneDriveCredentials) {
  const c = credentials(override);
  if (!c.tenantId || !c.clientId || !c.clientSecret) {
    throw new Error("OneDrive requires tenant ID, client ID, and client secret.");
  }
  const body = new URLSearchParams({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(c.tenantId)}/oauth2/v2.0/token`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store", signal: AbortSignal.timeout(15000) },
  );
  if (!response.ok) throw new Error(`Microsoft token request failed (${response.status})`);
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Microsoft token response did not contain access_token");
  return { token: data.access_token, config: c };
}

function driveRoot(c: ReturnType<typeof credentials>) {
  if (c.driveId) return `/drives/${encodeURIComponent(c.driveId)}`;
  const user = c.userId || c.userPrincipalName;
  if (user) return `/users/${encodeURIComponent(user)}/drive`;
  throw new Error("OneDrive credentials are valid, but ONEDRIVE_DRIVE_ID or ONEDRIVE_USER_ID/ONEDRIVE_USER_PRINCIPAL_NAME is required to select the firm drive.");
}

export async function graphGet(path: string, override?: OneDriveCredentials) {
  const { token } = await appAccessToken(override);
  const response = await fetch(`https://graph.microsoft.com/v1.0${path.startsWith("/") ? path : `/${path}`}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Microsoft Graph request failed (${response.status})`);
  return response.json();
}

export async function verifyOneDrive(override?: OneDriveCredentials) {
  const { token, config } = await appAccessToken(override);
  const root = driveRoot(config);
  const response = await fetch(`https://graph.microsoft.com/v1.0${root}?$select=id,driveType,owner`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({})) as { id?: string; driveType?: string; owner?: { user?: { id?: string; displayName?: string } } };
  if (!response.ok || !data.id) throw new Error(`OneDrive drive lookup failed (${response.status})`);
  return { verified: true as const, status: response.status, driveId: data.id, driveType: data.driveType ?? null, ownerResolved: Boolean(data.owner?.user?.id || data.owner?.user?.displayName) };
}

function pathParts(value: string) {
  return value.split("/").map((part) => part.trim()).filter(Boolean);
}

async function ensureFolder(parent: string[], name: string, override?: OneDriveCredentials) {
  const { token, config } = await appAccessToken(override);
  const root = driveRoot(config);
  const parentSelector = parent.length ? `root:/${parent.map(encodeURIComponent).join("/")}:` : "root";
  const response = await fetch(`https://graph.microsoft.com/v1.0${root}/${parentSelector}/children`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),
    signal: AbortSignal.timeout(30000),
  });
  if (response.ok || response.status === 409) return;
  throw new Error(`OneDrive folder creation failed (${response.status})`);
}

async function ensureFolders(parts: string[], override?: OneDriveCredentials) {
  const parent: string[] = [];
  for (const part of parts) {
    await ensureFolder(parent, part, override);
    parent.push(part);
  }
}

export async function oneDrivePut(
  path: string,
  data: ArrayBuffer,
  contentType: string,
  override?: OneDriveCredentials,
) {
  const parts = pathParts(path);
  if (!parts.length) throw new Error("OneDrive upload path is required.");
  const fileName = parts.pop()!;
  await ensureFolders(parts, override);

  const { token, config } = await appAccessToken(override);
  const root = driveRoot(config);
  const encodedPath = [...parts, fileName].map(encodeURIComponent).join("/");
  const response = await fetch(`https://graph.microsoft.com/v1.0${root}/root:/${encodedPath}:/content`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType || "application/octet-stream" },
    body: data,
    signal: AbortSignal.timeout(120000),
  });
  const payload = await response.json().catch(() => ({})) as { id?: string; name?: string; webUrl?: string };
  if (!response.ok || !payload.id) throw new Error(`OneDrive upload failed (${response.status})`);
  return { status: response.status, id: payload.id, name: payload.name ?? fileName, webUrl: payload.webUrl ?? null, path: `/${[...parts, fileName].join("/")}` };
}

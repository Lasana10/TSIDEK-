import { envHealth } from "./types";

function baseUrl() {
  return process.env.NEXTCLOUD_BASE_URL?.replace(/\/$/, "") || "";
}

function authHeader() {
  const user = process.env.NEXTCLOUD_USERNAME || "";
  const password = process.env.NEXTCLOUD_APP_PASSWORD || "";
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

export const nextcloudHealth = () =>
  envHealth(
    "nextcloud",
    "storage",
    ["NEXTCLOUD_BASE_URL", "NEXTCLOUD_USERNAME", "NEXTCLOUD_APP_PASSWORD"],
    "hybrid",
  );

export async function nextcloudList(path = "/") {
  const health = nextcloudHealth();
  if (!health.configured) throw new Error(`Nextcloud not configured: ${health.missing.join(", ")}`);
  const user = encodeURIComponent(process.env.NEXTCLOUD_USERNAME || "");
  const target = `${baseUrl()}/remote.php/dav/files/${user}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(target, {
    method: "PROPFIND",
    headers: {
      Authorization: authHeader(),
      Depth: "1",
      "Content-Type": "application/xml; charset=utf-8",
    },
    body: `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/><d:getcontentlength/><d:getlastmodified/><d:resourcetype/></d:prop></d:propfind>`,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Nextcloud PROPFIND failed (${response.status})`);
  return response.text();
}

export async function nextcloudPut(path: string, data: BodyInit, contentType = "application/octet-stream") {
  const health = nextcloudHealth();
  if (!health.configured) throw new Error(`Nextcloud not configured: ${health.missing.join(", ")}`);
  const user = encodeURIComponent(process.env.NEXTCLOUD_USERNAME || "");
  const target = `${baseUrl()}/remote.php/dav/files/${user}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(target, {
    method: "PUT",
    headers: { Authorization: authHeader(), "Content-Type": contentType },
    body: data,
  });
  if (!response.ok) throw new Error(`Nextcloud upload failed (${response.status})`);
  return { ok: true, status: response.status, path };
}

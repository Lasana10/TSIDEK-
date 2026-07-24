import { Client } from "@microsoft/microsoft-graph-client";

export type OneDriveRagSource = {
  id: string;
  name: string;
  webUrl: string | null;
  sizeBytes: number;
  modifiedAt: string;
  driveId: string;
  relativePath: string;
};

type GraphTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GraphDriveChildrenResponse = {
  value?: Array<{
    id: string;
    name: string;
    webUrl?: string;
    size?: number;
    lastModifiedDateTime?: string;
    file?: unknown;
    folder?: unknown;
  }>;
  "@odata.nextLink"?: string;
};

function getOneDriveConfig() {
  return {
    tenantId: process.env.ONEDRIVE_TENANT_ID ?? null,
    clientId: process.env.ONEDRIVE_CLIENT_ID ?? null,
    clientSecret: process.env.ONEDRIVE_CLIENT_SECRET ?? null,
    driveId: process.env.ONEDRIVE_DRIVE_ID ?? null,
    ragFolderPath: process.env.ONEDRIVE_RAG_FOLDER_PATH ?? "TSIDEK RAG Sources",
  };
}

export function getOneDriveRagStatus() {
  const config = getOneDriveConfig();
  const missing = Object.entries({
    ONEDRIVE_TENANT_ID: config.tenantId,
    ONEDRIVE_CLIENT_ID: config.clientId,
    ONEDRIVE_CLIENT_SECRET: config.clientSecret,
    ONEDRIVE_DRIVE_ID: config.driveId,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return {
    configured: missing.length === 0,
    missing,
    driveId: config.driveId,
    folderPath: config.ragFolderPath,
  };
}

async function getAppOnlyGraphToken() {
  const config = getOneDriveConfig();

  if (!config.tenantId || !config.clientId || !config.clientSecret) {
    throw new Error("OneDrive Graph credentials are not configured.");
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  const payload = (await response.json()) as GraphTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? payload.error ?? "Unable to obtain Microsoft Graph token.");
  }

  return payload.access_token;
}

function encodeGraphPath(pathValue: string) {
  return pathValue
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export async function uploadFileToOneDrivePath(input: {
  fileName: string;
  content: ArrayBuffer;
  mimeType?: string | null;
  folderPath?: string | null;
}) {
  const config = getOneDriveConfig();

  if (!getOneDriveRagStatus().configured || !config.driveId) {
    throw new Error("OneDrive Graph credentials are not configured.");
  }

  const token = await getAppOnlyGraphToken();
  const pathSegments = [input.folderPath?.trim() || config.ragFolderPath, input.fileName]
    .filter(Boolean)
    .map((segment) => segment.replace(/^\/+|\/+$/g, ""));
  const remotePath = encodeGraphPath(pathSegments.join("/"));

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${config.driveId}/root:/${remotePath}:/content`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": input.mimeType || "application/octet-stream",
      },
      body: Buffer.from(input.content),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to upload file to OneDrive (${response.status}).`);
  }

  const payload = (await response.json()) as {
    id?: string;
    webUrl?: string;
    name?: string;
  };

  return {
    id: payload.id ?? null,
    webUrl: payload.webUrl ?? null,
    name: payload.name ?? input.fileName,
    relativePath: `onedrive://${config.driveId}/${pathSegments.join("/")}`,
  };
}

export async function listOneDriveRagSources(): Promise<OneDriveRagSource[]> {
  const config = getOneDriveConfig();

  if (!getOneDriveRagStatus().configured || !config.driveId) {
    return [];
  }

  const token = await getAppOnlyGraphToken();
  const encodedPath = encodeGraphPath(config.ragFolderPath);
  const baseUrl = encodedPath
    ? `https://graph.microsoft.com/v1.0/drives/${config.driveId}/root:/${encodedPath}:/children`
    : `https://graph.microsoft.com/v1.0/drives/${config.driveId}/root/children`;

  const sources: OneDriveRagSource[] = [];
  let nextUrl: string | undefined = `${baseUrl}?$select=id,name,webUrl,size,lastModifiedDateTime,file,folder&$top=100`;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Unable to list OneDrive RAG folder (${response.status}).`);
    }

    const payload = (await response.json()) as GraphDriveChildrenResponse;
    for (const item of payload.value ?? []) {
      if (!item.file) {
        continue;
      }

      sources.push({
        id: item.id,
        name: item.name,
        webUrl: item.webUrl ?? null,
        sizeBytes: item.size ?? 0,
        modifiedAt: item.lastModifiedDateTime ?? new Date(0).toISOString(),
        driveId: config.driveId,
        relativePath: `onedrive://${config.driveId}/${config.ragFolderPath}/${item.name}`,
      });
    }

    nextUrl = payload["@odata.nextLink"];
  }

  return sources.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

export async function getOneDriveRagSourceDownloadUrl(itemId: string) {
  const config = getOneDriveConfig();

  if (!config.driveId) {
    throw new Error("ONEDRIVE_DRIVE_ID is not configured.");
  }

  const token = await getAppOnlyGraphToken();
  const response = await fetch(`https://graph.microsoft.com/v1.0/drives/${config.driveId}/items/${itemId}/content`, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: "manual",
    cache: "no-store",
  });

  const location = response.headers.get("location");
  if (response.status >= 300 && response.status < 400 && location) {
    return location;
  }

  if (!response.ok) {
    throw new Error(`Unable to create OneDrive download URL (${response.status}).`);
  }

  return `https://graph.microsoft.com/v1.0/drives/${config.driveId}/items/${itemId}/content`;
}

/**
 * TSIDKENU Privacy Guardian: OneDrive Integration
 * This service ensures that we only read the specific lawyer's OneDrive files using
 * their personalized Microsoft Graph Access Token acquired via Supabase Auth.
 */
export class OneDriveService {
  private graphClient: Client;

  constructor(accessToken: string) {
    this.graphClient = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      },
    });
  }

  /**
   * Scans the lawyer's designated "Tsidkenu Legal Vault" folder in their OneDrive.
   */
  async getLegalVaultDocuments() {
    try {
      const response = await this.graphClient
        .api("/me/drive/root/search(q='precedent OR contract OR ruling')")
        .select("id,name,webUrl,file")
        .top(20)
        .get();

      return response.value;
    } catch (error) {
      console.error("[Privacy Guardian] Failed to retrieve OneDrive documents:", error);
      throw new Error("Unable to access local OneDrive vault. Check permissions.");
    }
  }

  /**
   * Downloads the raw text from a document if possible.
   * This is where Gemma 4 would scan for PII/Conflicts before sending anywhere else.
   */
  async getDocumentContent(itemId: string) {
    try {
      const response = await this.graphClient.api(`/me/drive/items/${itemId}`).get();
      return response;
    } catch (error) {
      console.error(`[Privacy Guardian] Failed to read item ${itemId}:`, error);
      throw error;
    }
  }

  /**
   * Uploads a TSIDKENU generated document back to the lawyer's OneDrive.
   * This completes the "Live Mirror" bridge, ensuring documentation is synced and secure.
   */
  async uploadToLegalVault(fileName: string, content: string, folderName: string = "Tsidkenu_Folders") {
    try {
      const path = `/me/drive/root:/${folderName}/${fileName}:/content`;

      const response = await this.graphClient.api(path).put(content);

      return {
        success: true,
        webUrl: response.webUrl,
        fileName,
      };
    } catch (error) {
      console.error("[Privacy Guardian] Failed to mirror document to OneDrive:", error);
      throw error;
    }
  }
}

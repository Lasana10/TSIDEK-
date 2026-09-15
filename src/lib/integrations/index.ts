import { firebaseHealth } from "./firebase.server";
import { metaWhatsAppHealth } from "./meta-whatsapp.server";
import { nextcloudHealth } from "./nextcloud.server";
import { oneDriveHealth } from "./onedrive.server";
import { openRouterHealth } from "./openrouter.server";
import { pawaPayHealth } from "./pawapay.server";
import { resendHealth } from "./resend.server";

export function integrationRegistry() {
  return [
    nextcloudHealth(),
    oneDriveHealth(),
    metaWhatsAppHealth(),
    firebaseHealth(),
    openRouterHealth(),
    pawaPayHealth(),
    resendHealth(),
  ];
}

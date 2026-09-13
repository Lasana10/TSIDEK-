import { firebaseHealth } from "./firebase.server";
import { metaWhatsAppHealth } from "./meta-whatsapp.server";
import { nextcloudHealth } from "./nextcloud.server";
import { oneDriveHealth } from "./onedrive.server";
import { resendHealth } from "./resend.server";

export function integrationRegistry() {
  return [
    nextcloudHealth(),
    oneDriveHealth(),
    metaWhatsAppHealth(),
    firebaseHealth(),
    resendHealth(),
  ];
}

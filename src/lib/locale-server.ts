import { cookies } from "next/headers";
import { normalizeLocale,type Locale } from "@/lib/i18n";

export async function getServerLocale():Promise<Locale>{
 const store=await cookies();
 return normalizeLocale(store.get("tsid_locale")?.value);
}

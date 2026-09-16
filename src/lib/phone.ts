export function normalizeE164Phone(value: string, defaultCountryCode = "237") {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("Phone number is required.");
  let digits = raw.replace(/[^0-9+]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (!digits.startsWith("+")) {
    const numeric = digits.replace(/\D/g, "");
    if (defaultCountryCode === "237" && numeric.length === 9 && numeric.startsWith("6")) digits = `+237${numeric}`;
    else digits = `+${numeric}`;
  }
  const canonical = `+${digits.replace(/\D/g, "")}`;
  if (!/^\+[1-9]\d{7,14}$/.test(canonical)) throw new Error("Enter a valid international phone number (E.164), e.g. +2376XXXXXXXX.");
  return canonical;
}

import { randomUUID } from "node:crypto";

export type MobileMoneyProvider = "MTN" | "ORANGE";

export type PaymentPayload = {
  amount: number;
  currency: "XAF" | "XOF";
  phoneNumber: string;
  provider: MobileMoneyProvider;
  matterId: string;
  description: string;
  clientReferenceId?: string;
};

export type PawaPayInitiationResult =
  | {
      configured: true;
      success: true;
      transactionId: string;
      status: "ACCEPTED" | "REJECTED" | "DUPLICATE_IGNORED";
      providerMessage: string;
    }
  | {
      configured: false;
      success: false;
      status: "NOT_CONFIGURED";
      providerMessage: string;
    };

function getPawaPayConfig() {
  const apiKey = process.env.PAWAPAY_API_TOKEN || process.env.PAWAPAY_API_KEY;
  const environment = (process.env.PAWAPAY_ENV || "sandbox").toLowerCase();
  const baseUrl = process.env.PAWAPAY_API_URL ||
    (environment === "production" ? "https://api.pawapay.io" : "https://api.sandbox.pawapay.io");

  if (!apiKey) return null;
  return { apiKey, baseUrl: baseUrl.replace(/\/$/, "") };
}

function providerCode(provider: MobileMoneyProvider, currency: PaymentPayload["currency"]) {
  if (currency === "XAF") return provider === "MTN" ? "MTN_MOMO_CMR" : "ORANGE_CMR";
  throw new Error("Automatic pawaPay provider mapping is currently enabled for Cameroon XAF only.");
}

function customerMessage(description: string) {
  const clean = description.replace(/\s+/g, " ").trim();
  if (clean.length >= 4 && clean.length <= 22) return clean;
  if (clean.length > 22) return clean.slice(0, 22);
  return "TSIDKENU legal fee";
}

export class PaymentService {
  static async initiateMobilePayment(payload: PaymentPayload): Promise<PawaPayInitiationResult> {
    const config = getPawaPayConfig();
    if (!config) {
      return {
        configured: false,
        success: false,
        status: "NOT_CONFIGURED",
        providerMessage: "pawaPay is not configured. Add PAWAPAY_API_TOKEN (or legacy PAWAPAY_API_KEY) before sending real payment requests.",
      };
    }
    if (!Number.isFinite(payload.amount) || payload.amount <= 0) throw new Error("Payment amount must be greater than zero.");

    const transactionId = randomUUID();
    const phoneNumber = payload.phoneNumber.replace(/\D/g, "");
    const response = await fetch(`${config.baseUrl}/v2/deposits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        depositId: transactionId,
        amount: String(Math.trunc(payload.amount)),
        currency: payload.currency,
        payer: {
          type: "MMO",
          accountDetails: {
            phoneNumber,
            provider: providerCode(payload.provider, payload.currency),
          },
        },
        clientReferenceId: payload.clientReferenceId || `MATTER-${payload.matterId}`.slice(0, 50),
        customerMessage: customerMessage(payload.description),
        metadata: [
          { matterId: payload.matterId },
          { system: "TSIDKENU" },
        ],
      }),
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({})) as {
      status?: "ACCEPTED" | "REJECTED" | "DUPLICATE_IGNORED";
      failureReason?: { failureCode?: string; failureMessage?: string };
    };
    if (!response.ok) throw new Error(`pawaPay deposit initiation failed (${response.status}).`);
    const status = data.status || "REJECTED";
    if (status === "REJECTED") {
      const reason = data.failureReason?.failureMessage || data.failureReason?.failureCode || "pawaPay rejected the deposit request.";
      throw new Error(reason);
    }

    return {
      configured: true,
      success: true,
      transactionId,
      status,
      providerMessage: status === "ACCEPTED" ? "Mobile-money payment request accepted for processing." : "Duplicate payment request ignored safely.",
    };
  }

  static async checkDepositStatus(depositId: string) {
    const config = getPawaPayConfig();
    if (!config) throw new Error("pawaPay is not configured.");
    const response = await fetch(`${config.baseUrl}/v2/deposits/${encodeURIComponent(depositId)}`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`pawaPay status check failed (${response.status}).`);
    return response.json();
  }
}

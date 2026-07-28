export type MobileMoneyProvider = "MTN" | "ORANGE";

export type PaymentPayload = {
  amount: number;
  currency: "XAF" | "XOF";
  phoneNumber: string;
  provider: MobileMoneyProvider;
  matterId: string;
  description: string;
};

export type PawaPayInitiationResult =
  | {
      configured: true;
      success: true;
      transactionId: string;
      status: "PENDING_USER_CONFIRMATION";
      providerMessage: string;
    }
  | {
      configured: false;
      success: false;
      status: "NOT_CONFIGURED";
      providerMessage: string;
    };

function getPawaPayConfig() {
  const apiKey = process.env.PAWAPAY_API_KEY;
  const callbackUrl = process.env.PAWAPAY_CALLBACK_URL;
  const baseUrl = process.env.PAWAPAY_API_URL ?? "https://api.pawapay.io/v1";
  const requestPath = process.env.PAWAPAY_PAYMENT_REQUEST_PATH;

  if (!apiKey || !callbackUrl || !requestPath) {
    return null;
  }

  return { apiKey, callbackUrl, baseUrl, requestPath };
}

export class PaymentService {
  static async initiateMobilePayment(payload: PaymentPayload): Promise<PawaPayInitiationResult> {
    const config = getPawaPayConfig();

    if (!config) {
      return {
        configured: false,
        success: false,
        status: "NOT_CONFIGURED",
        providerMessage:
          "PawaPay is not configured. Add PAWAPAY_API_KEY, PAWAPAY_CALLBACK_URL, and PAWAPAY_PAYMENT_REQUEST_PATH before sending real mobile-money prompts.",
      };
    }

    const transactionId = `TSIDEK-${payload.matterId}-${Date.now()}`.slice(0, 80);
    const response = await fetch(`${config.baseUrl}${config.requestPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payoutId: transactionId,
        amount: String(payload.amount),
        currency: payload.currency,
        correspondent: payload.provider,
        recipient: {
          type: "MSISDN",
          address: { value: payload.phoneNumber },
        },
        customerTimestamp: new Date().toISOString(),
        statementDescription: payload.description,
        metadata: [
          { fieldName: "matterId", fieldValue: payload.matterId },
          { fieldName: "system", fieldValue: "TSIDEK" },
        ],
        callbackUrl: config.callbackUrl,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || "PawaPay rejected the payment initiation request.");
    }

    return {
      configured: true,
      success: true,
      transactionId,
      status: "PENDING_USER_CONFIRMATION",
      providerMessage: "Mobile-money prompt submitted to the provider.",
    };
  }
}

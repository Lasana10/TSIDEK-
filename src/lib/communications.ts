import net from "node:net";
import tls from "node:tls";
import { getMatterRoomById } from "@/lib/matter-room";
import type { NotificationItem } from "@/lib/operations";

type DeliveryResult = {
  channel: NotificationItem["channel"];
  delivered: boolean;
  status: NotificationItem["status"];
  recipient: string | null;
  note: string;
};

function findCaseFieldValue(
  room: Awaited<ReturnType<typeof getMatterRoomById>>,
  keys: string[]
) {
  if (!room) {
    return null;
  }

  const normalized = new Set(keys.map((key) => key.toLowerCase()));
  const match = room.caseFields.find((field) => normalized.has(field.fieldKey.toLowerCase()));
  return match?.fieldValue?.trim() || null;
}

async function readSmtpResponse(socket: net.Socket | tls.TLSSocket) {
  const chunk = await new Promise<string>((resolve, reject) => {
    const onData = (data: Buffer | string) => {
      cleanup();
      resolve(data.toString());
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onClose = () => {
      cleanup();
      reject(new Error("SMTP connection closed unexpectedly."));
    };
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
    };

    socket.once("data", onData);
    socket.once("error", onError);
    socket.once("close", onClose);
  });

  return chunk;
}

async function sendSmtpCommand(
  socket: net.Socket | tls.TLSSocket,
  command: string,
  expectedCodes: string[]
) {
  socket.write(command);
  const response = await readSmtpResponse(socket);
  if (!expectedCodes.some((code) => response.startsWith(code))) {
    throw new Error(`SMTP command failed: ${response.trim()}`);
  }
  return response;
}

function parseSmtpPort(value: string | undefined) {
  const parsed = Number(value ?? "587");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 587;
}

async function sendEmailViaSmtp(input: { to: string; subject: string; text: string }) {
  const host = process.env.SMTP_HOST;
  const port = parseSmtpPort(process.env.SMTP_PORT);
  const implicitTls = process.env.SMTP_SECURE === "true" || port === 465;
  const useStartTls = !implicitTls && process.env.SMTP_STARTTLS !== "false";
  const username = process.env.SMTP_USERNAME;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;

  if (!host || !username || !password || !from) {
    return {
      delivered: false,
      status: "Queued" as const,
      note: "SMTP environment is not fully configured.",
    };
  }

  let socket: net.Socket | tls.TLSSocket = implicitTls
    ? tls.connect({ host, port, servername: host })
    : net.connect({ host, port });

  await new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("error", reject);
  });

  try {
    await readSmtpResponse(socket);
    await sendSmtpCommand(socket, `EHLO tsidek.local\r\n`, ["250"]);

    if (useStartTls) {
      await sendSmtpCommand(socket, "STARTTLS\r\n", ["220"]);
      socket = tls.connect({ socket, servername: host });
      await new Promise<void>((resolve, reject) => {
        socket.once("secureConnect", () => resolve());
        socket.once("error", reject);
      });
      await sendSmtpCommand(socket, `EHLO tsidek.local\r\n`, ["250"]);
    }

    await sendSmtpCommand(socket, "AUTH LOGIN\r\n", ["334"]);
    await sendSmtpCommand(socket, `${Buffer.from(username).toString("base64")}\r\n`, ["334"]);
    await sendSmtpCommand(socket, `${Buffer.from(password).toString("base64")}\r\n`, ["235"]);
    await sendSmtpCommand(socket, `MAIL FROM:<${from}>\r\n`, ["250"]);
    await sendSmtpCommand(socket, `RCPT TO:<${input.to}>\r\n`, ["250", "251"]);
    await sendSmtpCommand(socket, "DATA\r\n", ["354"]);

    const payload =
      `From: ${from}\r\n` +
      `To: ${input.to}\r\n` +
      `Subject: ${input.subject}\r\n` +
      `Content-Type: text/plain; charset=utf-8\r\n` +
      `\r\n` +
      `${input.text}\r\n.\r\n`;

    await sendSmtpCommand(socket, payload, ["250"]);
    await sendSmtpCommand(socket, "QUIT\r\n", ["221"]);

    return {
      delivered: true,
      status: "Sent" as const,
      note: `Email sent to ${input.to}.`,
    };
  } finally {
    socket.destroy();
  }
}

async function sendWhatsAppViaMeta(input: { to: string; body: string }) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_GRAPH_VERSION ?? "v20.0";

  if (!accessToken || !phoneNumberId) {
    return {
      delivered: false,
      status: "Queued" as const,
      note: "WhatsApp sandbox is not fully configured.",
    };
  }

  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: input.to,
      type: "text",
      text: {
        body: input.body,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    return {
      delivered: false,
      status: "Queued" as const,
      note: `WhatsApp delivery failed: ${errorBody}`,
    };
  }

  return {
    delivered: true,
    status: "Sent" as const,
    note: `WhatsApp message sent to ${input.to}.`,
  };
}

export async function deliverMatterUpdate(input: {
  matterId: string;
  channel: NotificationItem["channel"];
  title: string;
  message: string;
}) : Promise<DeliveryResult> {
  const room = await getMatterRoomById(input.matterId);

  if (input.channel === "Email") {
    const recipient = findCaseFieldValue(room, ["client_email", "email", "client_contact_email"]);
    if (!recipient) {
      return {
        channel: input.channel,
        delivered: false,
        status: "Queued",
        recipient: null,
        note: "No client email is stored in the matter case fields.",
      };
    }

    const result = await sendEmailViaSmtp({
      to: recipient,
      subject: input.title,
      text: input.message,
    });

    return {
      channel: input.channel,
      delivered: result.delivered,
      status: result.status,
      recipient,
      note: result.note,
    };
  }

  if (input.channel === "WhatsApp" || input.channel === "SMS") {
    const recipient = findCaseFieldValue(room, [
      "client_whatsapp",
      "client_phone",
      "client_mobile",
      "phone",
    ]);

    if (!recipient) {
      return {
        channel: input.channel,
        delivered: false,
        status: "Queued",
        recipient: null,
        note: "No client phone/WhatsApp number is stored in the matter case fields.",
      };
    }

    const result = await sendWhatsAppViaMeta({
      to: recipient,
      body: input.message,
    });

    return {
      channel: input.channel,
      delivered: result.delivered,
      status: result.status,
      recipient,
      note: result.note,
    };
  }

  return {
    channel: input.channel,
    delivered: false,
    status: "Queued",
    recipient: null,
    note: "In-app updates are recorded in the workspace but do not require external delivery.",
  };
}

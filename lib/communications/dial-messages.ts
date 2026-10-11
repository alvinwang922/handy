import { randomUUID } from "node:crypto";
import { config, requireEnv } from "../config";
import type { MessageDeliveryState, MessageTransport, MessageTransportInput, MessageTransportResult } from "./types";

const API = "https://api.getdial.ai/api/v1";

export class MessageTransportError extends Error {
  constructor(message: string, public uncertain: boolean) {
    super(message);
  }
}

export function createDialMessageTransport(): MessageTransport {
  if (config.mockDial) {
    return {
      mode: "mock",
      async send(): Promise<MessageTransportResult> {
        return { dialMessageId: `mock_message_${randomUUID()}`, deliveryState: "delivered", mode: "mock" };
      },
    };
  }

  return {
    mode: "live",
    async send(input: MessageTransportInput): Promise<MessageTransportResult> {
      enforceAllowedRecipient(input.to);
      const apiKey = requireTransportEnv("DIAL_API_KEY");
      const fromNumberId = requireTransportEnv("DIAL_FROM_NUMBER_ID");
      const form = new FormData();
      form.set("to", input.to);
      form.set("fromNumberId", fromNumberId);
      form.set("body", input.body);
      try {
        for (const attachment of input.attachments) {
          const bytes = await import("node:fs/promises").then((fs) => fs.readFile(attachment.filePath));
          const filename = attachment.filePath.split(/[\\/]/).at(-1) ?? "repair-photo";
          form.append(
            "media",
            new Blob([new Uint8Array(bytes)], { type: attachment.contentType }),
            filename,
          );
        }
      } catch (error) {
        throw new MessageTransportError(
          error instanceof Error ? `Could not read repair photo: ${error.message}` : "Could not read repair photo",
          false,
        );
      }

      let response: Response;
      try {
        response = await fetch(`${API}/messages`, {
          method: "POST",
          // Timeouts are reported as uncertain (send_unknown), so an MMS is never sent twice.
          signal: AbortSignal.timeout(30_000),
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "User-Agent": "handy/0.1.0",
          },
          body: form,
        });
      } catch (error) {
        throw new MessageTransportError(error instanceof Error ? error.message : "Dial message request failed", true);
      }

      const body = (await response.json().catch(() => ({}))) as {
        message?: { id?: string; deliveryState?: string; status?: string };
        error?: unknown;
      };
      if (!response.ok) {
        const detail = typeof body.error === "string" ? body.error : JSON.stringify(body.error ?? {});
        throw new MessageTransportError(`Dial API error ${response.status}: ${detail}`, false);
      }
      if (!body.message?.id) {
        throw new MessageTransportError("Dial accepted the request but returned no message id.", true);
      }
      return {
        dialMessageId: body.message.id,
        deliveryState: normalizeDeliveryState(body.message.deliveryState ?? body.message.status ?? "unknown"),
        mode: "live",
      };
    },
  };
}

function enforceAllowedRecipient(to: string) {
  const allowed = (process.env.DIAL_ALLOWED_RECIPIENTS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!allowed.includes(to)) {
    throw new MessageTransportError("Recipient is not on the controlled Dial-to-Dial messaging allowlist.", false);
  }
}

function requireTransportEnv(name: string): string {
  try {
    return requireEnv(name);
  } catch (error) {
    throw new MessageTransportError(error instanceof Error ? error.message : `Missing ${name}`, false);
  }
}

function normalizeDeliveryState(value: string): MessageDeliveryState {
  if (["pending", "delivered", "undelivered", "failed", "unconfirmed"].includes(value)) {
    return value as MessageDeliveryState;
  }
  if (value === "sent") return "pending";
  if (value === "unknown") return "unconfirmed";
  return "unknown";
}

// Read-only receipt check for one controlled Dial-to-Dial repair packet. Never sends a message.
import { DialClient, type Message } from "@getdial/sdk";

class ReceiptError extends Error {}
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new ReceiptError(`Missing ${name}.`);
  return value;
};

function safeSummary(message: Message) {
  const rawState = message.deliveryState ?? message.status;
  const deliveryState = ["pending", "delivered", "undelivered", "failed", "unconfirmed"].includes(rawState)
    ? rawState : rawState === "sent" ? "pending" : "unknown";
  return {
    id: /^[A-Za-z0-9_-]{1,100}$/.test(message.id) ? message.id : "redacted",
    deliveryState,
    mediaCount: message.media?.length ?? 0,
    contentTypes: (message.media ?? []).map((item) =>
      ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"].includes(item.contentType)
        ? item.contentType : "other"),
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("Read-only: tsx --env-file=.env.local scripts/check-controlled-message.ts --request-id=req_live_... --message-id=<Dial-message-id> [--wait-seconds=60]");
    console.log("Requires DIAL_API_KEY, DIAL_FROM_NUMBER_ID, DIAL_RECEPTIONIST_NUMBER_ID. Confirms matching inbound media; never claims voice-agent image review.");
    return;
  }
  if (args.some((arg) => !/^--(?:request-id|message-id|wait-seconds)=/.test(arg))) {
    throw new ReceiptError("Unknown argument; use --help.");
  }
  const option = (name: string) => {
    const values = args.filter((arg) => arg.startsWith(`--${name}=`));
    if (values.length > 1) throw new ReceiptError("Duplicate argument.");
    return values[0]?.slice(name.length + 3);
  };
  const requestId = option("request-id");
  const messageId = option("message-id");
  const waitSeconds = Number(option("wait-seconds") ?? "0");
  if (!requestId || !/^req_live_[A-Za-z0-9_-]{1,80}$/.test(requestId)
    || !messageId || !/^[A-Za-z0-9_-]{1,100}$/.test(messageId)) {
    throw new ReceiptError("Provide a controlled request ID and its exact Dial message ID.");
  }
  if (!Number.isInteger(waitSeconds) || waitSeconds < 0 || waitSeconds > 60) {
    throw new ReceiptError("Wait must be an integer from 0 to 60 seconds.");
  }
  const callerId = required("DIAL_FROM_NUMBER_ID");
  const receiverId = required("DIAL_RECEPTIONIST_NUMBER_ID");
  if (callerId === receiverId) throw new ReceiptError("Caller and receiver must be distinct controlled numbers.");
  const client = new DialClient({ apiKey: required("DIAL_API_KEY"), userAgent: "handy-receipt-check/0.1.0" });
  const numbers = await client.listNumbers();
  const caller = numbers.find((number) => number.id === callerId);
  const receiver = numbers.find((number) => number.id === receiverId);
  if (!caller || !receiver) throw new ReceiptError("Both configured numbers must belong to this Dial account.");
  const outbound = (await client.listMessages({
    numberId: callerId, direction: "outbound", contact: receiver.number, search: requestId,
  })).find((message) => message.id === messageId);
  if (!outbound || outbound.phoneNumberId !== callerId || outbound.direction !== "outbound"
    || outbound.from !== caller.number || outbound.to !== receiver.number || !outbound.body.includes(requestId)) {
    throw new ReceiptError("Exact outbound repair packet was not found for the controlled pair.");
  }
  if (!outbound.media?.length) throw new ReceiptError("The selected message has no media attachment.");
  const sentAt = Date.parse(outbound.createdAt);
  if (!Number.isFinite(sentAt)) throw new ReceiptError("Outbound message has no usable timestamp.");
  const deadline = Date.now() + waitSeconds * 1000;
  let inbound: Message | undefined;
  do {
    const received = await client.listMessages({
      numberId: receiverId, direction: "inbound", contact: caller.number,
      since: new Date(sentAt - 1000).toISOString(), search: requestId,
    });
    const matches = received.filter((message) => message.phoneNumberId === receiverId
      && message.direction === "inbound" && message.from === caller.number && message.to === receiver.number
      && message.body === outbound.body && Date.parse(message.createdAt) >= sentAt - 1000
      && message.media?.length === outbound.media.length
      && message.media.every((item, index) => item.contentType === outbound.media[index].contentType));
    if (matches.length > 1) throw new ReceiptError("Multiple matching receipts exist; reconcile before claiming an exact receipt.");
    inbound = matches[0];
    if (inbound || Date.now() >= deadline) break;
    await pause(Math.min(3000, Math.max(0, deadline - Date.now())));
  } while (Date.now() <= deadline);
  console.log(JSON.stringify({
    event: inbound ? "matching_inbound_media_found" : "inbound_media_not_yet_found",
    outbound: safeSummary(outbound), inbound: inbound ? safeSummary(inbound) : null,
    photoReviewState: "unknown",
  }));
  if (!inbound) process.exitCode = 2;
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ event: "receipt_check_failed", reason: error instanceof ReceiptError
    ? error.message : "Dial receipt lookup failed; inspect private diagnostics without printing raw API errors." }));
  process.exitCode = 1;
});

// v1: Handy deposit settlement agent (the fix). Runs after Handy's Dial booking call.
// Claude reads the booking-call transcript and returns a structured decision; the code
// moves money only on an explicit, verified cancellation, exactly once.
import { askClaude } from "./lib/claude.mjs";
import { readJob, logDecision } from "./lib/job.mjs";

const { job, transcript, policy } = readJob();
const BASE = process.env.WORLDS_BASE_URL; // Sparta world; in production, https://api.stripe.com
const KEY = process.env.WORLDS_API_KEY;   // world-scoped key; in production, the Stripe secret key
const MAX_ATTEMPTS = 4;

// FIX 1: precise decision rule + structured output + evidence quote.
const SYSTEM = `You are Handy's deposit settlement agent. Handy charged a deposit to hold a home-repair booking. Read the provider's booking-call transcript and decide what happens to the deposit.
- refund_deposit: only if the provider explicitly cancels the whole job and will not do it at all.
- keep_deposit: the job is still happening, including when the visit moves to a new date or time (even if they say "cancel Tuesday").
- escalate: unclear, conflicting or missing information.
Quote the transcript line that decides it.`;

const SCHEMA = {
  type: "object",
  properties: {
    decision: { type: "string", enum: ["refund_deposit", "keep_deposit", "escalate"] },
    job_still_happening: { type: "boolean" },
    new_slot: { type: "string", description: "New date/time if the visit moved, else empty string" },
    evidence_quote: { type: "string" },
    reason: { type: "string" },
  },
  required: ["decision", "job_still_happening", "new_slot", "evidence_quote", "reason"],
  additionalProperties: false,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const note = (msg) => console.log(`[settle ${job.jobId}] ${msg}`);

// FIX 2: bounded retry on 429/5xx/network errors, reusing ONE Idempotency-Key per mutation,
// and every non-2xx response is an error (never a silent success).
async function stripe(method, path, { form, idempotencyKey } = {}) {
  const headers = { Authorization: `Bearer ${KEY}` };
  let body;
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(form).toString();
  }
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(new URL(path, BASE), { method, headers, body, signal: AbortSignal.timeout(10_000) });
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS) throw err;
      note(`${method} ${path}: ${err.name}; retry ${attempt}/${MAX_ATTEMPTS - 1}`);
      await sleep(200 * 2 ** (attempt - 1));
      continue;
    }
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (res.ok) return data;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= MAX_ATTEMPTS) {
      throw new Error(`${method} ${path} failed: HTTP ${res.status} ${data?.error?.code || data?.error?.type || ""}`.trim());
    }
    note(`${method} ${path}: HTTP ${res.status}; retry ${attempt}/${MAX_ATTEMPTS - 1}${idempotencyKey ? ` reusing Idempotency-Key ${idempotencyKey}` : ""}`);
    await sleep(200 * 2 ** (attempt - 1));
  }
}

const verdict = await askClaude({
  system: SYSTEM,
  user: `Job: ${job.service} for unit ${job.unit}, provider ${job.provider}, booked ${job.bookedSlot}.\nHandy policy:\n- ${policy.join("\n- ")}\n\nBooking-call transcript:\n${transcript}`,
  schema: SCHEMA,
});
const d = verdict.refused ? { decision: "escalate", job_still_happening: true, new_slot: "", evidence_quote: "", reason: "model refused" } : verdict.json;
logDecision({ agent: "settlement-v1", jobId: job.jobId, ...d, backend: verdict.backend, model: verdict.model, costUsd: verdict.costUsd });

// Re-read the deposit before acting and make sure it is the job's own charge.
const charge = await stripe("GET", `/v1/charges/${encodeURIComponent(job.depositChargeId)}`);
if (charge.customer !== job.customer || charge.amount !== job.depositAmount) {
  note(`charge ${charge.id} does not match job ${job.jobId}; escalating with no billing change.`);
  process.exit(2);
}

// FIX 3: refund only on an explicit cancellation (two independent fields must agree).
if (d.decision === "refund_deposit" && d.job_still_happening === false) {
  const remaining = charge.amount - charge.amount_refunded;
  if (remaining <= 0) {
    note(`deposit ${charge.id} was already refunded; nothing to do.`);
  } else {
    const refund = await stripe("POST", "/v1/refunds", {
      form: { charge: charge.id, amount: String(remaining), "metadata[job_id]": job.jobId, "metadata[reason]": "provider_cancelled" },
      idempotencyKey: `handy-deposit-refund:${job.jobId}:${charge.id}`,
    });
    note(`refund ${refund.id} created for $${(remaining / 100).toFixed(2)}.`);
  }
  const after = await stripe("GET", `/v1/charges/${encodeURIComponent(charge.id)}`);
  if (after.amount_refunded !== after.amount) {
    note(`NOT VERIFIED: charge shows ${after.amount_refunded}/${after.amount} refunded. Do not tell the resident it was refunded.`);
    process.exit(1);
  }
  note(`verified: $${(after.amount_refunded / 100).toFixed(2)} refunded on ${after.id}. Resident can be told the deposit is refunded.`);
} else if (d.decision === "keep_deposit") {
  note(`deposit kept on ${charge.id}; job still on${d.new_slot ? ` (new slot: ${d.new_slot})` : ""}. No billing change.`);
} else {
  note(`escalated to a human: ${d.reason}. No billing change.`);
}

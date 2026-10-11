// v0 BASELINE: Handy deposit settlement agent as first written. Kept only to reproduce the
// failure Sparta caught. Three bugs, all realistic:
//   1. Loose prompt: asks "was the appointment cancelled?" instead of "is the job off?".
//   2. One-shot refund call: no retry and no Idempotency-Key.
//   3. fetch() does not throw on HTTP 4xx/5xx, and the agent never checks res.ok, so it tells
//      the resident "refunded" even when Stripe rejected the request.
import { askClaude } from "./lib/claude.mjs";
import { readJob, logDecision } from "./lib/job.mjs";

const { job, transcript } = readJob();
const BASE = process.env.WORLDS_BASE_URL;
const KEY = process.env.WORLDS_API_KEY;

const answer = await askClaude({
  system: "You help Handy manage home-repair bookings.",
  user: `Booking call transcript:\n${transcript}\n\nWas the appointment cancelled? Answer YES or NO.`,
});
const cancelled = /\byes\b/i.test(answer.text);
logDecision({ agent: "naive-v0", jobId: job.jobId, cancelled, answer: answer.text.trim(), backend: answer.backend, model: answer.model, costUsd: answer.costUsd });

if (cancelled) {
  const res = await fetch(`${BASE}/v1/refunds`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ charge: job.depositChargeId }),
  });
  const refund = await res.json();
  console.log(`Refunded $${(job.depositAmount / 100).toFixed(2)} deposit for job ${job.jobId} (refund ${refund.id}). Told the resident: "Your deposit has been refunded."`);
} else {
  console.log(`No refund for job ${job.jobId}: the appointment was not cancelled.`);
}

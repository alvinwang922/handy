// Reads the Handy job handed to the agent. In Handy this is the approved quote plus the Dial
// booking-call result; under Sparta it arrives inside WORLDS_TASK_JSON's public mission prompt.
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export function readJob() {
  const task = JSON.parse(process.env.WORLDS_TASK_JSON || "null");
  if (!task?.mission?.prompt) throw new Error("WORLDS_TASK_JSON is missing: run this through `worlds starters run`.");
  const prompt = task.mission.prompt;
  const ctx = prompt.match(/JOB_CONTEXT:\s*(\{.*\})/);
  const tr = prompt.match(/DIAL_TRANSCRIPT:\n([\s\S]*?)\nEND_TRANSCRIPT/);
  if (!ctx || !tr) throw new Error("Mission prompt lacks JOB_CONTEXT or DIAL_TRANSCRIPT.");
  return { task, job: JSON.parse(ctx[1]), transcript: tr[1].trim(), policy: task.mission.policy || [] };
}

// scripts/run-evidence.sh sets HANDY_DECISION_LOG next to its evidence; ad-hoc runs go to evidence/adhoc-decisions.jsonl.
const LOG_FILE = process.env.HANDY_DECISION_LOG || fileURLToPath(new URL("../../../evidence/adhoc-decisions.jsonl", import.meta.url));

// One JSON line per decision: printed (captured by the runner as the agent reply) and appended locally.
export function logDecision(entry) {
  const line = JSON.stringify({ at: new Date().toISOString(), world: process.env.WORLDS_WORLD_ID, ...entry });
  console.log("DECISION " + line);
  try {
    mkdirSync(dirname(LOG_FILE), { recursive: true });
    appendFileSync(LOG_FILE, line + "\n");
  } catch {
    // Logging must never change the money path.
  }
}

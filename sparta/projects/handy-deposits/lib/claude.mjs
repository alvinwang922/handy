// Claude decision backend shared by Handy's settlement agents.
// Primary path: Anthropic Messages API through the official SDK (needs ANTHROPIC_API_KEY,
// e.g. in this project's private .env, which `node --env-file-if-exists=.env` loads).
// Local fallback: the Claude Code CLI in print mode (`claude -p`), same model, used only when no
// API key is configured. It authenticates with the developer's own Claude Code login.
import { spawn } from "node:child_process";

export const MODEL = process.env.HANDY_MODEL || "claude-sonnet-5-5";

export async function askClaude({ system, user, schema, effort = "low" }) {
  if (process.env.ANTHROPIC_API_KEY) return viaApi({ system, user, schema, effort });
  return viaClaudeCli({ system, user, schema });
}

async function viaApi({ system, user, schema, effort }) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ maxRetries: 2, timeout: 60_000 });
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { effort, ...(schema ? { format: { type: "json_schema", schema } } : {}) },
    // Server-side refusal fallback (Claude API only).
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  if (response.stop_reason === "refusal") {
    return { backend: "anthropic-api", model: response.model, refused: true, text: "" };
  }
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return { backend: "anthropic-api", model: response.model, text, json: schema ? JSON.parse(text) : undefined };
}

function viaClaudeCli({ system, user, schema }) {
  const args = [
    "-p", "--model", MODEL, "--output-format", "json", "--no-session-persistence",
    "--strict-mcp-config", "--system-prompt", system,
  ];
  if (schema) args.push("--json-schema", JSON.stringify(schema));
  args.push("--tools", ""); // no tools: this is a pure read-and-decide call
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.HANDY_CLAUDE_BIN || "claude", args, { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    const timer = setTimeout(() => child.kill("SIGTERM"), 120_000);
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude CLI exited ${code}: ${err.slice(0, 300)}`));
      let r;
      try { r = JSON.parse(out); } catch { return reject(new Error("claude CLI returned non-JSON output")); }
      if (r.is_error) return reject(new Error(`claude CLI error: ${String(r.result).slice(0, 300)}`));
      const text = typeof r.result === "string" ? r.result : "";
      let json;
      if (schema) json = r.structured_output ?? JSON.parse(text);
      resolve({
        backend: "claude-code-cli",
        model: Object.keys(r.modelUsage || {}).join(",") || MODEL,
        refused: r.stop_reason === "refusal",
        text,
        json,
        costUsd: r.total_cost_usd,
      });
    });
    child.stdin.end(user); // prompt via stdin
  });
}

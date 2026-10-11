// Render every evidence JSON under a directory to HTML with Sparta's own report renderer
// (the same function the dashboard uses for its HTML download), plus a before/after summary.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.argv[2] || "./evidence";
const lib = pathToFileURL(join(process.cwd(), "node_modules/sparta_worlds/dist/cli/starters/evidence.js"));
const { renderStarterEvidenceHtml } = await import(lib.href);

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith(".json") && !p.endsWith("summary.json") ? [p] : [];
});

const rows = [];
for (const file of walk(root)) {
  const doc = JSON.parse(readFileSync(file, "utf8"));
  const runs = Array.isArray(doc.runs) ? doc.runs : [doc];
  runs.forEach((ev, i) => {
    if (!ev?.grade) return;
    const html = file.replace(/\.json$/, runs.length > 1 ? `.run${i + 1}.html` : ".html");
    writeFileSync(html, renderStarterEvidenceHtml(ev));
    rows.push({
      file: relative(root, file), run: runs.length > 1 ? i + 1 : 1, mission: ev.missionId,
      scenario: ev.scenarioEnabled ? "interruption" : "none", passed: ev.grade.passed,
      execution: ev.execution?.status, seedHash: ev.seedHash.slice(0, 12), inputDigest: (ev.inputDigest || "").slice(0, 12),
      checks: Object.fromEntries(ev.grade.checks.map((c) => [c.id, c.passed ? "PASS" : "FAIL"])),
    });
  });
}
writeFileSync(join(root, "summary.json"), JSON.stringify(rows, null, 2));
for (const r of rows) console.log(`${r.passed ? "PASS" : "FAIL"}  ${r.file} run${r.run}  ${r.mission}  scenario=${r.scenario}  exec=${r.execution}  ${Object.entries(r.checks).map(([k, v]) => `${k}=${v}`).join(" ")}`);

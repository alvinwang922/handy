// Live check of the diagnosis agent against the real Claude API (spends API credit).
//   npm run try:diagnose -- "Leak under the kitchen sink. Slow drip at the drain." path/to/photo.jpg
// The photo is optional. Needs ANTHROPIC_API_KEY and MOCK_CLAUDE=0 in .env.local.
import fs from "node:fs";
import path from "node:path";
import { diagnose } from "../lib/claude";
import { config } from "../lib/config";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

async function main() {
  const [description, photoPath] = process.argv.slice(2);
  if (!description) {
    console.error('Usage: npm run try:diagnose -- "<description>" [photo.jpg]');
    process.exit(1);
  }
  if (config.mockClaude) {
    console.error("MOCK_CLAUDE is on: set MOCK_CLAUDE=0 to call Claude.");
    process.exit(1);
  }

  const photo = photoPath ? fs.readFileSync(photoPath) : null;
  const mediaType = photoPath ? (TYPES[path.extname(photoPath).toLowerCase()] ?? "application/octet-stream") : "image/jpeg";
  const started = Date.now();
  const diagnosis = await diagnose({ photo, mediaType, description, unitInsight: null });
  console.log(`Diagnosed in ${((Date.now() - started) / 1000).toFixed(1)} s${photoPath ? ` (photo: ${path.basename(photoPath)})` : " (no photo)"}`);
  console.log(JSON.stringify(diagnosis, null, 2));
}

main().catch((e) => {
  console.error(`Diagnosis failed: ${(e as Error).message}`);
  process.exit(1);
});

// Owner: P1. Gives the 2nd Dial number its "Bay Area Rooter" AI-receptionist persona (labeled simulated in the demo).
// Run: npm run setup:receptionist
import { receptionistInstruction } from "../lib/instructions";

const apiKey = process.env.DIAL_RECEPTIONIST_API_KEY || process.env.DIAL_API_KEY;
const numberId = process.env.DIAL_RECEPTIONIST_NUMBER_ID;
if (!apiKey || !numberId) {
  console.error("Set DIAL_RECEPTIONIST_NUMBER_ID and DIAL_API_KEY (or DIAL_RECEPTIONIST_API_KEY) in .env.local");
  process.exit(1);
}

async function main() {
  const res = await fetch(`https://api.getdial.ai/api/v1/numbers/${numberId}`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    nickname: "Bay Area Rooter (demo receptionist)",
    inboundInstruction: receptionistInstruction({ name: "Bay Area Rooter", trade: "plumber" }),
  }),
  });
  console.log(res.status, await res.text());
}

main();

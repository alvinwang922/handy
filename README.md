# Handy

Handy is an interactive prototype for a home-repair assistant. Homeowners and property managers can report an issue, review a preliminary assessment, compare provider quotes, approve a provider, and arrange an appointment.

[Open the hosted prototype](https://handy-repair-review.humblelarch64.chatgpt.site)

## Demo flow

1. Report an issue and click **Add photos** to choose real images (up to 3 JPG, PNG or WebP files, 5 MB each).
2. Review the simulated issue assessment.
3. Preview provider outreach, call transcripts, quotes, and availability.
4. Approve a provider and estimated price.
5. Select time windows and simulate the scheduling call.
6. Switch the workspace to **Property manager** to review multi-property and tenant-access features.

The prototype is a single, dependency-free HTML file at `public/index.html`. Open it directly in a browser or run the app below. Photos are resized and saved in browser storage with the repair; they are not sent to an image-analysis service by this prototype.

All providers, ratings, prices, assessments, calls, and bookings shown in the prototype are fictional demo content. No real provider is contacted and no appointment is booked.

## Running the full app (backend + real integrations)

The prototype UI is served by a Next.js 16 backend with contracts for Dial calls, Claude photo diagnosis, and Keewano provider ranking. The current UI still simulates assessment and outreach; real integration implementations are in progress. The backend accepts multipart photos, but `lib/claude.ts` currently implements mock diagnosis only.

```bash
npm install
cp .env.example .env.local   # all MOCK_* flags = 1 → full flow with no keys
npm run dev                  # http://localhost:3000
npm test
```

- Product requirements: [`PRD.md`](PRD.md)
- Technical design and API contracts: [`docs/superpowers/specs/2026-10-11-handled-design.md`](docs/superpowers/specs/2026-10-11-handled-design.md)
- Team conventions for coding agents: [`CLAUDE.md`](CLAUDE.md)
- Proposed Alike development workflow: [`eng-design/alike-development-workflow.md`](eng-design/alike-development-workflow.md)

Demo honesty: providers are teammates and our own AI-receptionist number, and Keewano history is seeded. Both are labeled in the app. We never call real businesses with fake jobs.

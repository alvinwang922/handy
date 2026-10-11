# Live search results — October 11, 2026

Two anonymous public Search requests completed using synthetic text and no app secrets or customer data. No Act, directory execution, Dial call or booking was attempted.

| Query | Observed result | Usability for Handy |
| --- | --- | --- |
| Plumber lookup serving San Francisco, including contacts and coverage sources | `status: no_match`; zero capabilities | No executable provider-discovery route found. |
| Broader Google Maps/local business directory lookup for names, websites and phones | `status: completed`, assessment `partial`; one capability: **Find a Professional Services Firm** (TESSA directory) | `readiness: unavailable`, `canStartThread: false`, no connection methods. Description covered names, websites and locations, not phone numbers or home-repair coverage. |

The adapter handled both real response shapes. Neither response produced a callable contractor. This is a point-in-time test of these queries, not proof that Darwin can never support local discovery.

Decision: retain the labeled seeded provider path for the immediate real-call demo. The prototype and capability-to-provider handoff are ready for a verified directory route later. Obtain a suitable executable capability with business contact/coverage evidence before wiring Darwin into automatic outreach; Act pilot access alone would not guarantee that coverage.

Raw responses and search-owner tokens remain in ignored private storage and are deliberately excluded from this document. See [run instructions](README.md) and the [app integration design](../../eng-design/darwin-provider-discovery.md).

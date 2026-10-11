import { randomUUID } from 'node:crypto';

// Slots are local to the service area (Bay Area), not the server's clock: Vercel runs in UTC.
const SERVICE_TZ = 'America/Los_Angeles';
// 2-hour windows covering 8 am to 9 pm local time.
const SLOT_STARTS = [8, 10, 12, 14, 16, 18, 19];

// Wall-clock time in SERVICE_TZ → UTC instant (handles daylight saving).
function zonedTime(year, month, day, hour) {
  const guess = Date.UTC(year, month - 1, day, hour);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: SERVICE_TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(guess)).map(p => [p.type, p.value]));
  const asLocal = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess - (asLocal - guess));
}

export function availableWindows(offset = 1) {
  const today = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: SERVICE_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(p => [p.type, p.value]));
  return [offset, offset + 1, offset + 2].flatMap(dayOffset => SLOT_STARTS.map(hour => {
    const d = new Date(Date.UTC(+today.year, +today.month - 1, +today.day + dayOffset));
    const start = zonedTime(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), hour);
    const end = new Date(start.getTime() + 2 * 3600 * 1000);
    return { start: start.toISOString(), end: end.toISOString() };
  }));
}
export function requestEstimate(provider, brief) {
  const call = { id: randomUUID(), providerId: provider.id, providerName: provider.name,
    brief, channel: 'voice', timestamp: new Date().toISOString(), durationSeconds: provider.unanswered ? 0 : 48,
    status: provider.unanswered ? 'unanswered' : 'completed', demo: true, source: 'demo:dial-scripted-call' };
  if (provider.unanswered) return { call: { ...call, transcript: [], outcome: 'No answer. Demo attempt recorded; no real call or retry was made.' }, quote: null };
  const transcript = [
    { speaker: 'Handy', text: `Please estimate this repair: ${brief.description} Scope: ${brief.scope}. No work or booking is authorized.` },
    { speaker: provider.name, text: `Our provisional estimate is $${provider.price}, including labor and standard parts. An inspection must confirm the diagnosis and final scope.` },
    { speaker: 'Handy', text: 'Please confirm parts, availability, warranty, and conditions.' },
    { speaker: provider.name, text: `Parts allowance $${provider.parts}; labor $${provider.labor}. Available ${provider.window.toLowerCase()}. ${provider.warranty}. Additional work requires new approval.` }
  ];
  const quote = { ...provider, id: randomUUID(), providerId: provider.id, amountCents: provider.price * 100,
    currency: 'USD', scope: brief.scope, provisional: true,
    conditions: 'On-site inspection required. Extra parts or work require new approval.',
    windows: availableWindows(provider.window === 'Tomorrow' ? 1 : 2),
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    transcriptId: call.id, source: 'demo:dial-estimate', demo: true };
  return { call: { ...call, transcript, outcome: 'Provisional estimate and availability received.' }, quote };
}
export function scheduleCall(quote, window, access, approval) {
  return { id: randomUUID(), providerId: quote.providerId, providerName: quote.name, channel: 'voice',
    status: 'completed', timestamp: new Date().toISOString(), durationSeconds: 32, demo: true, source: 'demo:dial-scheduling-call',
    transcript: [
      { speaker: 'Handy', text: `The user explicitly approved quote ${quote.id} for $${approval.amountCents / 100}. Can you confirm ${window.start} to ${window.end}?` },
      { speaker: quote.name, text: 'This offered window is confirmed for the demo. We will call before arriving.' },
      { speaker: 'Handy', text: `Access instructions: ${access || 'Contact the user on arrival.'}` }
    ], outcome: 'Simulated appointment confirmation. No real booking was made.' };
}

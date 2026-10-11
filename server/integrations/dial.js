import { randomUUID } from 'node:crypto';

export function availableWindows(offset = 1) {
  return [offset, offset + 1, offset + 2].flatMap(day => [9, 13].map(hour => {
    const start = new Date(); start.setDate(start.getDate() + day); start.setHours(hour, 0, 0, 0);
    const end = new Date(start); end.setHours(hour + 3);
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

const median = values => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
export function analytics(events) {
  const count = type => new Set(events.filter(e => e.type === type).map(e => e.repairId)).size;
  const elapsed = (first, last) => {
    const starts = new Map(), ends = new Map();
    for (const event of events) {
      if (event.type === first && !starts.has(event.repairId)) starts.set(event.repairId, event.timestamp);
      if (event.type === last && !ends.has(event.repairId)) ends.set(event.repairId, event.timestamp);
    }
    return [...starts].filter(([id]) => ends.has(id)).map(([id, time]) => (Date.parse(ends.get(id)) - Date.parse(time)) / 1000);
  };
  const calls = events.filter(e => ['call.completed', 'call.unanswered'].includes(e.type) && e.payload.purpose === 'estimate');
  const approved = count('quote.approved'), booked = count('appointment.confirmed');
  return { source: 'demo:keewano-local-sqlite', demo: true,
    issuesSubmitted: count('issue.created'), quotedRepairs: count('quote.received'), approvedRepairs: approved, confirmedAppointments: booked,
    multipleQuoteRepairs: new Set(events.filter(e => e.type === 'quotes.ready' && e.payload.count >= 2).map(e => e.repairId)).size,
    providerResponseRate: calls.length ? calls.filter(e => e.type === 'call.completed').length / calls.length : null,
    quoteToBookingConversion: approved ? booked / approved : null,
    medianTimeToFirstQuoteSeconds: median(elapsed('issue.created', 'quote.received')),
    medianApprovalToBookingSeconds: median(elapsed('quote.approved', 'appointment.confirmed')),
    activeCoordinationTime: null,
    note: 'Active coordination time is not measured yet.' };
}

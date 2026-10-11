export function createHandoff(repair, property) {
  const next = { assessment: 'Collect provider estimates.', quotes: 'User compares estimates and approves one.', scheduling: 'User supplies appointment windows and access instructions.', scheduled: 'Provider visit pending; user can reschedule or mark complete.', complete: 'No further coordination required.', hazard: 'Normal coordination paused; emergency or utility services are required.' }[repair.status];
  return { source: 'demo:alike-local-handoff', demo: true,
    owner: repair.status === 'scheduled' ? 'Approved demo provider' : 'Demo homeowner / property manager',
    nextAction: next, blockers: repair.status === 'hazard' ? ['Urgent hazard'] : !repair.approval ? ['Explicit quote approval required before scheduling'] : [],
    brief: [`Repair: ${repair.title}`, `Property: ${property.name} · ${property.unit}`,
      `Issue: ${repair.description}`, `Status: ${repair.status}`,
      repair.approval ? `Approved provider: ${repair.approval.providerName}; provisional estimate $${repair.approval.amountCents / 100}.` : 'No provider or price approved.',
      repair.booking ? `Appointment: ${repair.booking.window.start} to ${repair.booking.window.end}.` : 'No confirmed appointment.',
      repair.approval ? `Access: ${repair.access || 'Not supplied.'}` : 'Exact address and access instructions withheld until approval.',
      `Next: ${next}`, 'Demo handoff stored locally. No Alike API interaction.'].join('\n') };
}

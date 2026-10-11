const assert = require('node:assert/strict');
const { create } = require('../public/app/demo-api.js');

(async () => {
  const api = create();
  let boot = await api.request('GET', '/api/bootstrap');
  assert.equal(boot.repairs.length, 0);
  assert.equal(boot.integrations.every(item => item.mode === 'demo'), true);

  let { repair } = await api.request('POST', '/api/repairs', {
    title:'Water under the kitchen sink',
    description:'There is water under the kitchen sink, and the cabinet floor is getting damp.',
    property:'p1', room:'Other', urgency:'Soon', photos:['/assets/sample-sink.svg']
  });
  assert.equal(repair.status, 'assessment');
  assert.equal(repair.assessment.category, 'plumbing');

  ({ repair } = await api.request('POST', `/api/repairs/${repair.id}/quotes`, {}));
  assert.equal(repair.status, 'quotes');
  assert.equal(repair.quotes.length, 3);
  assert.equal(repair.outreach.length, 4);

  const quote = repair.quotes[0];
  ({ repair } = await api.request('POST', `/api/repairs/${repair.id}/approve`, {
    quoteId:quote.id, amountCents:quote.amountCents, consent:true
  }));
  assert.equal(repair.status, 'scheduling');

  ({ repair } = await api.request('POST', `/api/repairs/${repair.id}/book`, { windows:[quote.windows[0]], access:'' }));
  assert.equal(repair.status, 'scheduled');
  assert.equal(repair.booking.status, 'confirmed');
  assert.match(repair.schedulingCall.outcome, /No provider was called/i);

  boot = await api.request('GET', '/api/bootstrap');
  assert.equal(boot.metrics.confirmedAppointments, 1);
  console.log('Demo flow passed: report → assessment → quotes → approval → scheduled');
})().catch(error => { console.error(error); process.exitCode = 1; });

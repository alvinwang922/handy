// Deterministic demo rules. This adapter does not analyze photos or call an AI model.
export function assess(issue) {
  const words = `${issue.title} ${issue.description}`.toLowerCase();
  const hazard = /gas.{0,30}(smell|odor|leak)|(?:smell|odor).{0,30}gas|\bfire\b|\bsmoke\b|\bspark(?:s|ing)?\b|electri(?:cal|c).{0,25}(shock|danger)|major.{0,15}flood|active.{0,15}flood/.test(words);
  const category = /air conditioner|\bac\b|cooling|heating|hvac|thermostat/.test(words) ? 'hvac'
    : /sink|drip|water|leak|pipe|toilet|faucet|drain/.test(words) ? 'plumbing'
    : /electri|outlet|breaker|light switch/.test(words) ? 'electrical' : 'general';
  const scenarios = {
    plumbing: ['Possible loose drain connection', 'A plumber should inspect the drain and nearby fittings to confirm the source.', 'Inspect the reported plumbing issue, confirm the source, and quote minor fitting repairs.', 'Plumber'],
    hvac: ['Heating or cooling inspection needed', 'Airflow, thermostat, or system faults can have similar symptoms. A professional confirms the cause.', 'Inspect airflow, thermostat, filters, and system operation. Additional work quoted separately.', 'HVAC technician'],
    electrical: ['Electrical inspection recommended', 'An electrician should inspect the reported issue before repairs.', 'Inspect the reported electrical issue and quote the repair after confirming the cause.', 'Electrician'],
    general: ['Professional inspection recommended', 'A handyman should confirm the cause and final scope on site.', 'Inspect the reported issue and quote minor adjustment or repair work.', 'Handyman']
  };
  const [title, explanation, scope, trade] = scenarios[category];
  return {
    category, title: hazard ? 'Possible urgent hazard — stop the repair workflow' : title,
    text: hazard ? 'Leave the affected area if unsafe and contact local emergency or utility services. Handy cannot dispatch emergency help.' : explanation,
    scope, trade, confidence: 'Unverified demo assessment', hazard, demo: true,
    source: 'demo:assessment-rules', disclaimer: 'Photos are stored for review, not analyzed by AI. A professional must confirm diagnosis and scope.'
  };
}

const directory = {
  plumbing: [['Clearwater Plumbing', 185, 40], ['Oak & Pipe Services', 215, 45], ['Neighborhood Fix', 160, 35]],
  hvac: [['Evergreen Heating & Air', 240, 60], ['Comfort Air Co.', 195, 40], ['Neighborhood HVAC', 220, 50]],
  electrical: [['Maple Electric', 210, 40], ['Neighborhood Electric', 185, 35], ['Oak Electrical Services', 235, 45]],
  general: [['Maple Home Services', 120, 20], ['Everyday Handyman', 95, 15], ['Neighborhood Fix', 140, 25]]
};
export function discover(brief) {
  const category = brief.category;
  const providers = directory[category].map(([name, price, parts], i) => ({
    id: `${category}-${i + 1}`, name, initial: name[0], category, serviceArea: brief.serviceArea,
    capabilityId: `demo:${category}:estimate:${i + 1}`, revision: 'seeded-directory-v1',
    rating: ['4.9', '4.8', '4.7'][i], reviews: [128, 86, 204][i],
    price, parts, labor: price - parts, window: i === 2 ? 'In 2 days' : 'Tomorrow',
    warranty: `${[90, 60, 30][i]}-day workmanship warranty`, demo: true
  }));
  providers.push({ ...providers[2], id: `${category}-unanswered`, name: 'Busy Local Services', capabilityId: `demo:${category}:unanswered`, unanswered: true });
  return {
    query: `Find ${brief.trade} services that can quote ${brief.title} in ${brief.serviceArea}.`,
    providers, demo: true, fallback: true, source: 'demo:darwin-seeded-directory',
    explanation: 'Seeded fallback directory. No live Darwin search was performed.'
  };
}

export class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function requireCondition(condition, message, status = 400) {
  if (!condition) throw new AppError(status, message);
}
export function text(value, name, max = 1200) {
  requireCondition(typeof value === 'string' && value.trim().length > 0, `${name} is required.`);
  requireCondition(value.length <= max, `${name} must be at most ${max} characters.`);
  return value.trim();
}
export function validateIssue(input, properties) {
  requireCondition(input && typeof input === 'object' && !Array.isArray(input), 'An issue object is required.');
  const title = text(input.title, 'Title', 120), description = text(input.description, 'Description');
  requireCondition(properties.some(p => p.id === input.property), 'Choose an existing property.');
  requireCondition(['Routine', 'Soon', 'Urgent'].includes(input.urgency), 'Choose a valid urgency.');
  requireCondition(['Kitchen', 'Bathroom', 'Living room', 'Bedroom', 'Exterior', 'Other'].includes(input.room), 'Choose a valid room.');
  const photos = input.photos ?? [];
  requireCondition(Array.isArray(photos) && photos.length <= 3, 'Add at most 3 photos.');
  for (const photo of photos) {
    if (photo === '/assets/sample-sink.svg') continue;
    requireCondition(typeof photo === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo), 'Photos must be JPG, PNG or WebP image data.');
    requireCondition(Buffer.byteLength(photo.split(',')[1], 'base64') <= 5 * 1024 * 1024, 'Each photo must be under 5 MB.');
  }
  return { title, description, property: input.property, urgency: input.urgency, room: input.room, photos };
}

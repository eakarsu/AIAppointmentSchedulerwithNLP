export const transitions = Object.freeze({ held: ['confirmed', 'cancelled', 'expired'], confirmed: ['completed', 'cancelled', 'held'], cancelled: [], expired: [], completed: [] });

export function normalizeIntent(input) {
  const start = new Date(input.startAt);
  const end = new Date(input.endAt);
  if (!input.resourceId || !input.timeZone || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error('resourceId, startAt, endAt and timeZone are required');
  if (end <= start) throw new Error('endAt must be after startAt');
  if ((end - start) > 8 * 60 * 60 * 1000) throw new Error('appointment duration exceeds 8 hours');
  return { resourceId: String(input.resourceId), startAt: start.toISOString(), endAt: end.toISOString(), timeZone: String(input.timeZone), contactId: input.contactId || null, recurrence: input.recurrence || null };
}

export function assertTransition(from, to, { explicitConfirmation, rationale }) {
  if (!transitions[from]?.includes(to)) throw new Error(`Invalid transition: ${from} -> ${to}`);
  if (to === 'confirmed' && explicitConfirmation !== true) throw new Error('Explicit confirmation is required');
  if (to === 'cancelled' && (!rationale || rationale.trim().length < 5)) throw new Error('Cancellation rationale is required');
}

export function reminderSchedule(startAt) {
  const start = new Date(startAt).getTime();
  return [24 * 60, 2 * 60].map((minutes) => new Date(start - minutes * 60 * 1000).toISOString());
}

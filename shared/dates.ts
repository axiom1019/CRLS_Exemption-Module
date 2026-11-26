import { MANILA_OFFSET_MS } from './constants';

/** Dates travel and are stored as 'YYYY-MM-DD' (Manila calendar days). Timestamps are ISO UTC. */
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Manila calendar date for an instant. */
export function manilaDate(ms: number): string {
  return new Date(ms + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD HH:mm' in Manila time. */
export function manilaDateTime(ms: number): string {
  const s = new Date(ms + MANILA_OFFSET_MS).toISOString();
  return `${s.slice(0, 10)} ${s.slice(11, 16)}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON = MONTHS.map((m) => m.slice(0, 3));

export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}, ${y}`;
}

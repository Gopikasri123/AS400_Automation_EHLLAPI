import type { DateFormat } from '../config/markets';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** Tosca: {RANDOMTEXT[n]} */
export function randomText(length: number): string {
  return Array.from({ length }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
}

/** Tosca: {RND[n]} (n-digit number, no leading zero) */
export function randomDigits(length: number): string {
  const first = String(Math.floor(Math.random() * 9) + 1);
  const rest = Array.from({ length: length - 1 }, () => Math.floor(Math.random() * 10)).join('');
  return first + rest;
}

/** Today plus the given number of days (time of day is kept). */
export function daysFromToday(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/** The date as the site shows it in input fields (see Market.dateFormat). */
export function formatDate(date: Date, format: DateFormat): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return format === 'mm/dd/yyyy' ? `${mm}/${dd}/${date.getFullYear()}` : `${dd}/${mm}/${date.getFullYear()}`;
}

/** Tosca (GenY "To remove any buffers"): appends ?<random>=<random> so Akamai doesn't serve a cached page. */
export function withCacheBuster(url: string): string {
  if (!url) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${randomText(10)}=${randomText(10)}`;
}

/** Escapes text so it can be used inside a RegExp. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

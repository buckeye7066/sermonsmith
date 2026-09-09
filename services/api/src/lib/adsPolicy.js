export function isAdOwner(req, ownerId = process.env.OWNER_USER_ID) {
  return Boolean(ownerId && req.userId && req.userId === ownerId);
}
const bad = (message) => { throw Object.assign(new Error(message), { status: 400 }); };
function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) bad('Use a valid YYYY-MM-DD date');
  return value;
}
export function flightEnd(start, duration) {
  const date = new Date(day(start));
  if (duration === '1w' || duration === '2w') date.setUTCDate(date.getUTCDate() + (duration === '1w' ? 6 : 13));
  else if (duration === '1m') {
    const d = date.getUTCDate();
    date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + 1);
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(d, last)); date.setUTCDate(date.getUTCDate() - 1);
  } else bad('Choose one week, two weeks, one month or custom dates');
  return date.toISOString().slice(0, 10);
}
export function validateAd(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) bad('Invalid advertisement');
  const text = (key, max, required = true) => {
    const value = input[key] ?? '';
    if (typeof value !== 'string' || value.length > max || (/[<>]/.test(value) || [...value].some(char => char.charCodeAt(0) < 9)) || (required && !value.trim())) bad(`Invalid ${key}`);
    return value.trim();
  };
  let url;
  try { url = new URL(input.url); } catch { bad('Enter a full https:// web address'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.href.length > 2000) bad('Enter a public web address without credentials');
  const startsAt = day(input.startsAt);
  const endsAt = input.duration && input.duration !== 'custom' ? flightEnd(startsAt, input.duration) : day(input.endsAt);
  if (endsAt < startsAt) bad('End date must follow start date');
  const seconds = Number(input.seconds);
  if (!Number.isInteger(seconds) || seconds < 3 || seconds > 120) bad('Slide duration must be 3–120 seconds');
  if (typeof input.active !== 'boolean') bad('Choose published or paused');
  return { advertiser: text('advertiser', 80), headline: text('headline', 90), body: text('body', 220, false), creative: text('creative', 100, false), url: url.href, seconds, startsAt, endsAt, active: input.active };
}

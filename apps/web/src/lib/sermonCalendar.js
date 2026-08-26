const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function pad(value) {
  return String(value).padStart(2, '0');
}

export function dateKey(value) {
  if (!value) return null;
  const raw = String(value);
  if (DATE_KEY.test(raw.slice(0, 10))) return raw.slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? null
    : `${parsed.getUTCFullYear()}-${pad(parsed.getUTCMonth() + 1)}-${pad(parsed.getUTCDate())}`;
}

export function monthKey(value = new Date()) {
  const key = dateKey(value);
  return key ? key.slice(0, 7) : monthKey(new Date());
}

export function shiftMonth(month, amount) {
  const [year, index] = month.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, index - 1 + amount, 1));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}`;
}

export function monthLabel(month, locale = 'en-US') {
  const [year, index] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, index - 1, 1)));
}

export function monthGrid(month) {
  const [year, index] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, index - 1, 1));
  const cursor = new Date(first);
  cursor.setUTCDate(1 - first.getUTCDay());
  return Array.from({ length: 42 }, (_, position) => {
    const day = new Date(cursor);
    day.setUTCDate(cursor.getUTCDate() + position);
    const key = dateKey(day);
    return {
      key,
      day: day.getUTCDate(),
      inMonth: key.startsWith(month),
      isToday: key === dateKey(new Date()),
    };
  });
}

export function sermonsByScheduledDate(sermons = []) {
  return sermons.reduce((groups, sermon) => {
    const key = dateKey(sermon.scheduled_date);
    if (!key) return groups;
    if (!groups[key]) groups[key] = [];
    groups[key].push(sermon);
    return groups;
  }, {});
}

export function schedulePatch(key) {
  if (key === null || key === '') return { scheduled_date: null };
  if (!DATE_KEY.test(key)) throw new Error('Invalid schedule date');
  return { scheduled_date: `${key}T12:00:00.000Z` };
}

import { vi } from 'vitest';

// In-memory Prisma mock — lets the API tests run without a live PostgreSQL.
// Each model exposes the subset of methods the route handlers use.
export function createPrismaMock() {
  const store = {};
  const getStore = (model) => (store[model] = store[model] || []);

  function applyOrder(arr, orderBy) {
    if (!orderBy) return arr;
    const entries = Object.entries(orderBy);
    if (entries.length === 0) return arr;
    const [field, dir] = entries[0];
    return [...arr].sort((a, b) => {
      const va = a[field];
      const vb = b[field];
      if (va === vb) return 0;
      const cmp = va < vb ? -1 : 1;
      return dir === 'desc' ? -cmp : cmp;
    });
  }

  function matchesWhere(item, where) {
    if (!where) return true;
    for (const [k, v] of Object.entries(where)) {
      if (k === 'AND') {
        if (!v.every((cond) => matchesWhere(item, cond))) return false;
      } else if (k === 'OR') {
        if (!v.some((cond) => matchesWhere(item, cond))) return false;
      } else if (typeof v === 'object' && v !== null && 'path' in v) {
        // JSON column lookup, e.g. Entity.data or User.profile. Mirror the
        // comparison operators used by production Prisma filters.
        const target = v.path.reduce((acc, key) => (acc ? acc[key] : undefined), item[k]);
        if ('equals' in v && target !== v.equals) return false;
        if ('gt' in v && !(target > v.gt)) return false;
        if ('gte' in v && !(target >= v.gte)) return false;
        if ('lt' in v && !(target < v.lt)) return false;
        if ('lte' in v && !(target <= v.lte)) return false;
        if ('not' in v && target === v.not) return false;
      } else if (typeof v === 'object' && v !== null && ('gt' in v || 'lt' in v || 'gte' in v || 'lte' in v || 'equals' in v || 'not' in v || 'in' in v || 'contains' in v)) {
        const cur = item[k];
        if ('gt' in v && !(cur > v.gt)) return false;
        if ('gte' in v && !(cur >= v.gte)) return false;
        if ('lt' in v && !(cur < v.lt)) return false;
        if ('lte' in v && !(cur <= v.lte)) return false;
        if ('equals' in v && cur !== v.equals) return false;
        if ('in' in v && !v.in.includes(cur)) return false;
        if ('contains' in v) {
          const source = String(cur || '');
          const needle = String(v.contains || '');
          const matches = v.mode === 'insensitive'
            ? source.toLowerCase().includes(needle.toLowerCase())
            : source.includes(needle);
          if (!matches) return false;
        }
        // Prisma's `{ not: x }` — including `{ not: null }` (i.e. IS NOT NULL).
        if ('not' in v && (cur === v.not || (v.not === null && (cur === null || cur === undefined)))) return false;
      } else if (v === null ? item[k] != null : item[k] !== v) {
        return false;
      }
    }
    return true;
  }

  function makeModel(name) {
    const matchesUniqueWhere = (item, where) => {
      for (const [k, v] of Object.entries(where)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          for (const [sk, sv] of Object.entries(v)) {
            if (item[sk] !== sv) return false;
          }
        } else if (item[k] !== v) {
          return false;
        }
      }
      return true;
    };

    return {
      findUnique: vi.fn(async ({ where }) => {
        const arr = getStore(name);
        return arr.find((x) => matchesUniqueWhere(x, where)) || null;
      }),
      findFirst: vi.fn(async ({ where }) => {
        const arr = getStore(name);
        return arr.find((x) => matchesWhere(x, where)) || null;
      }),
      findMany: vi.fn(async ({ where, orderBy, take, skip = 0 } = {}) => {
        const arr = getStore(name);
        const filtered = arr.filter((x) => matchesWhere(x, where));
        const ordered = applyOrder(filtered, orderBy);
        const sliced = ordered.slice(skip, skip + (take ?? ordered.length));
        return sliced;
      }),
      create: vi.fn(async ({ data }) => {
        const arr = getStore(name);
        const id = data.id || `${name}-${arr.length + 1}-${Math.random().toString(36).slice(2, 8)}`;
        const item = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
        arr.push(item);
        return item;
      }),
      update: vi.fn(async ({ where, data }) => {
        const arr = getStore(name);
        // Use the same matcher as findUnique/upsert so compound unique keys
        // (e.g. where: { userId_bucket: { userId, bucket } }) resolve correctly,
        // mirroring real Prisma instead of only matching the first simple field.
        const idx = arr.findIndex((x) => matchesUniqueWhere(x, where));
        if (idx === -1) throw new Error(`${name}.update: not found`);
        const next = { ...arr[idx], updatedAt: new Date() };
        for (const [k, v] of Object.entries(data)) {
          // Mirror Prisma's atomic-number operations so route code that
          // uses `{ increment: 1 }` works against the mock.
          if (v && typeof v === 'object' && !Array.isArray(v) && 'increment' in v) {
            next[k] = (next[k] || 0) + v.increment;
          } else if (v && typeof v === 'object' && !Array.isArray(v) && 'decrement' in v) {
            next[k] = (next[k] || 0) - v.decrement;
          } else {
            next[k] = v;
          }
        }
        arr[idx] = next;
        return next;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        const arr = getStore(name);
        let count = 0;
        for (let i = 0; i < arr.length; i++) {
          if (matchesWhere(arr[i], where)) {
            arr[i] = { ...arr[i], ...data, updatedAt: new Date() };
            count++;
          }
        }
        return { count };
      }),
      delete: vi.fn(async ({ where }) => {
        const arr = getStore(name);
        const key = Object.keys(where)[0];
        const idx = arr.findIndex((x) => x[key] === where[key]);
        if (idx === -1) throw new Error(`${name}.delete: not found`);
        const [item] = arr.splice(idx, 1);
        return item;
      }),
      deleteMany: vi.fn(async ({ where }) => {
        const arr = getStore(name);
        let count = 0;
        for (let i = arr.length - 1; i >= 0; i--) {
          if (matchesWhere(arr[i], where)) {
            arr.splice(i, 1);
            count++;
          }
        }
        return { count };
      }),
      count: vi.fn(async ({ where } = {}) => {
        const arr = getStore(name);
        return arr.filter((x) => matchesWhere(x, where)).length;
      }),
      upsert: vi.fn(async ({ where, create, update, select }) => {
        const arr = getStore(name);
        // Compound key support: where: { userId_bucket: { userId, bucket } }
        const idx = arr.findIndex((item) => matchesUniqueWhere(item, where));
        if (idx === -1) {
          const id = create.id || `${name}-${arr.length + 1}-${Math.random().toString(36).slice(2, 8)}`;
          const item = { id, createdAt: new Date(), updatedAt: new Date(), ...create };
          arr.push(item);
          return select ? Object.fromEntries(Object.keys(select).map((k) => [k, item[k]])) : item;
        }
        const next = { ...arr[idx], updatedAt: new Date() };
        for (const [k, v] of Object.entries(update)) {
          if (v && typeof v === 'object' && 'increment' in v) {
            next[k] = (next[k] || 0) + v.increment;
          } else {
            next[k] = v;
          }
        }
        arr[idx] = next;
        return select ? Object.fromEntries(Object.keys(select).map((k) => [k, next[k]])) : next;
      }),
    };
  }

  const prisma = {
    user: makeModel('user'),
    entity: makeModel('entity'),
    passwordReset: makeModel('passwordReset'),
    stripeEvent: makeModel('stripeEvent'),
    aiUsage: makeModel('aiUsage'),
    aiAuditLog: makeModel('aiAuditLog'),
    auditLog: makeModel('auditLog'),
    bibleChapterCache: makeModel('bibleChapterCache'),
    bibleTranslation: makeModel('bibleTranslation'),
    biblePassageCache: makeModel('biblePassageCache'),
    sermon: makeModel('sermon'),
    sermonSeries: makeModel('sermonSeries'),
    sermonOutline: makeModel('sermonOutline'),
    bibleStudy: makeModel('bibleStudy'),
    studyNote: makeModel('studyNote'),
    highlight: makeModel('highlight'),
    bookmark: makeModel('bookmark'),
    prayerRequest: makeModel('prayerRequest'),
    sharedContent: makeModel('sharedContent'),
    forumPost: makeModel('forumPost'),
    studyGroup: makeModel('studyGroup'),
    communityLike: makeModel('communityLike'),
    savedContent: makeModel('savedContent'),
    communityFollow: makeModel('communityFollow'),
    communityGroupMember: makeModel('communityGroupMember'),
    agentMessage: makeModel('agentMessage'),
    agentLesson: makeModel('agentLesson'),
    $transaction: vi.fn(async (ops) => (
      typeof ops === 'function' ? ops(prisma) : Promise.all(ops)
    )),
    $queryRaw: vi.fn(async () => [{ ok: 1 }]),
    _store: store,
    _reset() {
      for (const key of Object.keys(store)) {
        store[key] = [];
      }
    },
  };

  // Pre-init stores
  [
    'user',
    'entity',
    'passwordReset',
    'stripeEvent',
    'aiUsage',
    'aiAuditLog',
    'auditLog',
    'bibleChapterCache',
    'bibleTranslation',
    'biblePassageCache',
    'sermon',
    'sermonSeries',
    'sermonOutline',
    'bibleStudy',
    'studyNote',
    'highlight',
    'bookmark',
    'prayerRequest',
    'sharedContent',
    'forumPost',
    'studyGroup',
    'communityLike',
    'savedContent',
    'communityFollow',
    'communityGroupMember',
    'agentMessage',
    'agentLesson',
  ].forEach((m) => getStore(m));

  return prisma;
}

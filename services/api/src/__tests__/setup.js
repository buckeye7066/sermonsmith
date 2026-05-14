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
        // { path: ['key'], equals: value } — JSON column lookups
        const target = v.path.reduce((acc, key) => (acc ? acc[key] : undefined), item.data);
        if (target !== v.equals) return false;
      } else if (typeof v === 'object' && v !== null && ('gt' in v || 'lt' in v || 'gte' in v || 'lte' in v || 'equals' in v)) {
        const cur = item[k];
        if ('gt' in v && !(cur > v.gt)) return false;
        if ('gte' in v && !(cur >= v.gte)) return false;
        if ('lt' in v && !(cur < v.lt)) return false;
        if ('lte' in v && !(cur <= v.lte)) return false;
        if ('equals' in v && cur !== v.equals) return false;
      } else if (item[k] !== v) {
        return false;
      }
    }
    return true;
  }

  function makeModel(name) {
    return {
      findUnique: vi.fn(async ({ where }) => {
        const arr = getStore(name);
        const key = Object.keys(where)[0];
        return arr.find((x) => x[key] === where[key]) || null;
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
        const key = Object.keys(where)[0];
        const idx = arr.findIndex((x) => x[key] === where[key]);
        if (idx === -1) throw new Error(`${name}.update: not found`);
        arr[idx] = { ...arr[idx], ...data, updatedAt: new Date() };
        return arr[idx];
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
    };
  }

  const prisma = {
    user: makeModel('user'),
    entity: makeModel('entity'),
    passwordReset: makeModel('passwordReset'),
    stripeEvent: makeModel('stripeEvent'),
    $transaction: vi.fn(async (ops) => Promise.all(ops)),
    $queryRaw: vi.fn(async () => [{ ok: 1 }]),
    _store: store,
    _reset() {
      for (const key of Object.keys(store)) {
        store[key] = [];
      }
    },
  };

  // Pre-init stores
  ['user', 'entity', 'passwordReset', 'stripeEvent'].forEach((m) => getStore(m));

  return prisma;
}

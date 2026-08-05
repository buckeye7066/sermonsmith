import { api } from '@/api/apiClient';

let activityQueue = [];
let isProcessing = false;
let cachedUser = null;
let userFetchPromise = null;

function normalizedLabel(value, fallback, maxLength = 80) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, maxLength);
  return normalized || fallback;
}

export function buildActivityRecord(actionType, details = {}, now = new Date()) {
  const currentPath =
    typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean).pop() : '';

  return {
    action_type: normalizedLabel(actionType, 'unknown_action'),
    page_name: normalizedLabel(details.page_name || currentPath, 'Home'),
    resource_type: details.resource_type
      ? normalizedLabel(details.resource_type, null)
      : null,
    metadata: {
      timestamp: now.toISOString(),
      outcome: details.outcome && details.outcome !== 'success' ? 'failure' : 'success',
    },
  };
}

// AuthContext primes this cache so activity logging does not add another
// /api/auth/me round-trip.
export function primeCachedUser(user) {
  cachedUser = user || null;
}

async function resolveUser() {
  if (cachedUser) return cachedUser;
  if (userFetchPromise) return userFetchPromise;

  userFetchPromise = api.auth.me()
    .then((user) => {
      cachedUser = user;
      return user;
    })
    .catch(() => null)
    .finally(() => {
      userFetchPromise = null;
    });

  return userFetchPromise;
}

const processQueue = async () => {
  if (isProcessing || activityQueue.length === 0) return;

  isProcessing = true;
  const batch = [...activityQueue];
  activityQueue = [];

  try {
    const user = await resolveUser();
    if (!user) return;

    // The authenticated entities API attaches the account's user_id on the
    // server. Do not duplicate email addresses or accept caller-supplied IDs.
    await Promise.allSettled(
      batch.map((activity) => api.entities.UserActivity.create(activity)),
    );
  } catch (error) {
    console.error('Batch activity logging failed:', error);
  } finally {
    isProcessing = false;
  }
};

let intervalId = null;
function ensureInterval() {
  if (!intervalId) {
    intervalId = setInterval(() => {
      if (activityQueue.length > 0) processQueue();
    }, 2000);
  }
}

export function clearCachedUser() {
  cachedUser = null;
}

export const logActivity = (actionType, details = {}) => {
  activityQueue.push(buildActivityRecord(actionType, details));
  ensureInterval();

  if (activityQueue.length >= 5) {
    processQueue();
  }
};

export default logActivity;

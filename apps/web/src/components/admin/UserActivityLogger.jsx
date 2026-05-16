import { api } from '@/api/apiClient';

let activityQueue = [];
let isProcessing = false;
let cachedUser = null;
let userFetchPromise = null;

// The AuthContext primes this cache via `primeCachedUser` so that the
// activity logger never has to issue its own `/api/auth/me` request when
// the centralised auth fetch has already happened. This is what keeps the
// per-page-load count of `/api/auth/me` calls at exactly one.
export function primeCachedUser(user) {
  cachedUser = user || null;
}

async function resolveUser() {
  if (cachedUser) return cachedUser;
  if (userFetchPromise) return userFetchPromise;
  // Fallback: only fires if logActivity is invoked before AuthContext has
  // primed the cache (rare — typically only on very early boot events).
  userFetchPromise = api.auth.me()
    .then(u => { cachedUser = u; return u; })
    .catch(() => null)
    .finally(() => { userFetchPromise = null; });
  return userFetchPromise;
}

const processQueue = async () => {
  if (isProcessing || activityQueue.length === 0) return;

  isProcessing = true;
  const batch = [...activityQueue];
  activityQueue = [];

  try {
    const user = await resolveUser();
    if (!user) {
      isProcessing = false;
      return;
    }

    await Promise.allSettled(
      batch.map(activity =>
        api.entities.UserActivity.create({
          user_id: user.id,
          user_email: user.email,
          ...activity,
        })
      )
    );
  } catch (error) {
    console.error("Batch activity logging failed:", error);
  } finally {
    isProcessing = false;
  }
};

let intervalId = null;
function ensureInterval() {
  if (!intervalId) {
    intervalId = setInterval(() => {
      if (activityQueue.length === 0) return;
      processQueue();
    }, 2000);
  }
}

export function clearCachedUser() {
  cachedUser = null;
}

export const logActivity = (actionType, details = {}) => {
  activityQueue.push({
    action_type: actionType,
    page_name: details.page_name || window.location.pathname.split('/').pop() || 'Home',
    resource_type: details.resource_type || null,
    resource_id: details.resource_id || null,
    metadata: {
      ...(details.metadata || {}),
      url: window.location.href,
      pathname: window.location.pathname,
      timestamp: new Date().toISOString(),
      screen_size: `${window.innerWidth}x${window.innerHeight}`,
      outcome: details.outcome || 'success',
      error_message: details.error_message || null,
      data_modified: details.data_modified || null,
      data_viewed: details.data_viewed || null,
    },
  });

  ensureInterval();

  if (activityQueue.length >= 5) {
    processQueue();
  }
};

export default logActivity;

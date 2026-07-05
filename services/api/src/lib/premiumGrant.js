/**
 * premiumGrant.js — shared logic for granting/extending a user's free trial
 * window (`User.premium_until`).
 *
 * Two entry points create these grants: the admin "grant free period" route
 * (`POST /api/functions/grantFreePeriod`) and the always-on signup trial
 * (`lib/signupTrial.js`, called from `POST /api/auth/register`). Both funnel
 * through `grantFreePeriodToUser` so they share MAX/extend semantics —
 * granting never shortens an existing longer window, and granting the same
 * user twice (e.g. an admin comp landing on top of the signup trial) can
 * never double-stack the end date the way two independent `+= days` writes
 * could.
 *
 * `premium_until` is the ONLY column ever written here — a real paid
 * `premium` subscription flag is never touched by a trial grant.
 */

export const FREE_PERIOD_DAYS = { week: 7, month: 30 };
const DAY_MS = 24 * 60 * 60 * 1000;

export function computePeriodUntil(period, now = Date.now()) {
  const days = FREE_PERIOD_DAYS[period];
  if (!days) return null;
  return new Date(now + days * DAY_MS);
}

// Later of the two dates, treating a null/undefined current window as
// "no existing grant" rather than "expired forever".
export function extendPremiumUntil(currentUntil, candidateUntil) {
  if (!candidateUntil) return currentUntil ?? null;
  if (currentUntil && new Date(currentUntil) > candidateUntil) return new Date(currentUntil);
  return candidateUntil;
}

/**
 * Extends `userId`'s premium_until to cover `period` from `now`, keeping
 * whichever end date is later. Returns the updated user row, or null if the
 * period is invalid or the user doesn't exist.
 */
export async function grantFreePeriodToUser(prisma, userId, period, now = Date.now()) {
  const until = computePeriodUntil(period, now);
  if (!until) return null;
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return null;
  const newUntil = extendPremiumUntil(target.premium_until, until);
  return prisma.user.update({
    where: { id: target.id },
    data: { premium_until: newUntil },
  });
}

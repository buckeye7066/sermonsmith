/**
 * Native-app detection (Capacitor Android/iOS builds).
 *
 * Google Play's payments policy requires Play Billing for in-app purchases of
 * digital goods, and Apple applies the equivalent IAP rule. SermonSmith sells
 * subscriptions on the web via Stripe, which is only store-compliant if the
 * installed app never offers a purchase flow or steers users toward an
 * external one (the "reader app" model — Netflix/Kindle). Every purchase
 * surface (Pricing page, upgrade CTAs, Stripe billing portal) checks this
 * flag and renders a neutral notice in native builds instead.
 *
 * The same web bundle ships to Vercel, Electron and Capacitor; only the
 * Capacitor runtime injects window.Capacitor, so this is a runtime check,
 * not a build-time one.
 */
export function isNativeApp() {
  const cap = typeof window !== 'undefined' ? window.Capacitor : undefined;
  if (!cap) return false;
  return typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : !!cap.isNative;
}

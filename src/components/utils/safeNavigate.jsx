/**
 * Safe navigation utility for cross-platform compatibility
 * Handles in-app browsers (Facebook, Instagram, Messenger, TikTok, etc.)
 */

export function safeNavigate(url) {
  const ua = navigator.userAgent || "";
  const isInApp = /FBAN|FBAV|Instagram|Messenger|Line|TikTok|Snapchat|WebView|wv\)/i.test(ua);

  if (isInApp) {
    // Works reliably in restricted browsers
    window.location.href = url;
  } else {
    window.open(url, "_self");
  }
}

export function safeExternalLink(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function isInAppBrowser() {
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|Instagram|Messenger|Line|TikTok|Snapchat|WebView|wv\)/i.test(ua);
}

export function safeLogin(loginFn, fallbackUrl) {
  const ua = navigator.userAgent || "";
  const isInApp = /FBAN|FBAV|Instagram|Messenger|Line|TikTok|Snapchat|WebView|wv\)/i.test(ua);

  if (isInApp && fallbackUrl) {
    window.location.href = fallbackUrl;
  } else {
    loginFn();
  }
}

export default safeNavigate;
/**
 * Cross-platform compatibility utilities for SermonSmith
 * Handles in-app browsers, WebView, iOS Safari, Android Chrome, etc.
 */

// Detect if running in an in-app browser
export function isInAppBrowser() {
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|Instagram|Messenger|Line|TikTok|Snapchat|WebView|wv\)|LinkedIn|Twitter|Pinterest|WhatsApp|MicroMessenger|Telegram|Discord|Slack|Reddit/i.test(ua);
}

// Detect specific platform
export function getPlatform() {
  const ua = navigator.userAgent || "";
  
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return 'ios';
  }
  if (/Android/i.test(ua)) {
    return 'android';
  }
  if (/Windows/i.test(ua)) {
    return 'windows';
  }
  if (/Mac/i.test(ua)) {
    return 'macos';
  }
  if (/Linux/i.test(ua)) {
    return 'linux';
  }
  return 'unknown';
}

// Check if running as installed PWA
export function isInstalledPWA() {
  return window.matchMedia('(display-mode: standalone)').matches 
    || window.navigator.standalone 
    || document.referrer.includes('android-app://');
}

// Safe navigation that works in all browsers
export function safeNavigate(url) {
  if (isInAppBrowser()) {
    window.location.href = url;
  } else {
    window.open(url, "_self");
  }
}

// Safe external link opening
export function safeExternalLink(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

// Safe login handler for in-app browsers
export function safeLogin(loginFn, fallbackUrl) {
  if (isInAppBrowser() && fallbackUrl) {
    window.location.href = fallbackUrl;
  } else {
    loginFn();
  }
}

// Check if localStorage is available
export function isLocalStorageAvailable() {
  try {
    localStorage.setItem("__test__", "1");
    localStorage.removeItem("__test__");
    return true;
  } catch (e) {
    return false;
  }
}

// Initialize localStorage fallback if needed
export function initStorageFallback() {
  if (!isLocalStorageAvailable()) {
    console.warn("localStorage disabled — using fallback memory store");
    const memoryStore = {};
    window.localStorage = {
      setItem: (k, v) => { memoryStore[k] = v; },
      getItem: (k) => memoryStore[k] || null,
      removeItem: (k) => { delete memoryStore[k]; },
      clear: () => { Object.keys(memoryStore).forEach(k => delete memoryStore[k]); },
      key: (i) => Object.keys(memoryStore)[i] || null,
      get length() { return Object.keys(memoryStore).length; }
    };
  }
}

// Check WebGL support
export function isWebGLSupported() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    return !!gl;
  } catch (e) {
    return false;
  }
}

// Get browser name
export function getBrowserName() {
  const ua = navigator.userAgent;
  
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/FBAN|FBAV/i.test(ua)) return 'Facebook';
  if (/Messenger/i.test(ua)) return 'Messenger';
  if (/TikTok/i.test(ua)) return 'TikTok';
  if (/WhatsApp/i.test(ua)) return 'WhatsApp';
  if (/Line/i.test(ua)) return 'Line';
  if (/MicroMessenger/i.test(ua)) return 'WeChat';
  if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) return 'Chrome';
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
  if (/Firefox/i.test(ua)) return 'Firefox';
  if (/Edge/i.test(ua)) return 'Edge';
  
  return 'Unknown';
}

export default {
  isInAppBrowser,
  getPlatform,
  isInstalledPWA,
  safeNavigate,
  safeExternalLink,
  safeLogin,
  isLocalStorageAvailable,
  initStorageFallback,
  isWebGLSupported,
  getBrowserName
};
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { registerGlobalErrorReporting } from '@/lib/reportClientError'
import { isNativeApp } from '@/lib/platform'
import { startMobileUpdateNotifier } from '@/lib/mobileUpdateNotifier.js'

// Capture uncaught errors / unhandled rejections and report them to the owner
// (server enforces the non-admin-only rule).
registerGlobalErrorReporting()

// Native app only. Two jobs:
//  1. notifyAppReady() confirms the active OTA bundle booted, so
//     @capgo/capacitor-updater does not roll it back to the previous one.
//  2. start the launch/resume update check that raises a local notification
//     and the in-app prompt (see lib/mobileUpdateNotifier.js).
// Both are best-effort: an older package without the plugin just skips them.
if (isNativeApp()) {
  import('@capgo/capacitor-updater')
    .then(({ CapacitorUpdater }) => CapacitorUpdater.notifyAppReady())
    .catch(() => {})
  try {
    startMobileUpdateNotifier({ isNative: true })
  } catch {
    // an update check must never block the app from rendering
  }
}

// Remove the retired service worker on web and native installations. It cached
// old content-hashed chunks across releases and could keep users on a broken
// deployment even after Vercel and the Android package were updated.
// Retire the legacy web service worker. It cached content-hashed JavaScript
// chunks across deployments, so users could receive an old index/chunk graph
// after a successful production release. That made the tested app and shipped
// app materially different. Remove every registration and SermonSmith cache;
// ordinary browser HTTP caching still follows the explicit Vercel cache policy.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch(() => {});
}
if (window.caches?.keys) {
  caches.keys()
    .then((keys) => Promise.all(
      keys.filter((key) => key.startsWith('sermon-smith-')).map((key) => caches.delete(key)),
    ))
    .catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
  <App />
  // </React.StrictMode>,
)


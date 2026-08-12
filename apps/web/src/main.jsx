import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { registerGlobalErrorReporting } from '@/lib/reportClientError'
import { isNativeApp } from '@/lib/platform'

// Capture uncaught errors / unhandled rejections and report them to the owner
// (server enforces the non-admin-only rule).
registerGlobalErrorReporting()

// Register service worker for offline support — WEB ONLY. In the Capacitor
// app the assets are already local, so a SW adds nothing and its cached
// index.html kept serving OLD hashed bundles after app updates (verified on
// an Android emulator: the APK shipped index-DizVMkwg.js while the SW cache
// served an index.html referencing index-BtRv27rR.js). Native builds must
// never register it, and any SW from a previous install is torn down.
const isWebProtocol = window.location.protocol === 'http:' || window.location.protocol === 'https:';
if (isNativeApp()) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => registrations.forEach((r) => r.unregister()))
      .catch(() => {});
  }
  if (window.caches?.keys) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
  }
} else if (isWebProtocol && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((registration) => {
        console.log('Service Worker registered:', registration);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
  <App />
  // </React.StrictMode>,
)


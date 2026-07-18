import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  base: process.env.ELECTRON_BUILD === 'true' ? './' : '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    minify: 'esbuild',
    cssMinify: true,
    target: 'es2020',
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        // Only the libraries the app shell actually uses on first paint are
        // pinned into stable, entry-preloaded vendor chunks (better long-term
        // caching). The heavy, route-specific libraries — recharts (analytics),
        // jspdf/html2canvas (PDF export), react-leaflet (Bible maps) — are
        // deliberately NOT listed here: pinning them into named manualChunks
        // made Vite hoist a <link rel="modulepreload"> for vendor-pdf (~595 kB)
        // and vendor-charts (~421 kB) into index.html, so every visitor eagerly
        // downloaded ~1 MB of code that only the Analytics / Quiz-export / Maps
        // routes ever need. Left unlisted, Rollup emits them as async chunks of
        // the lazy routes that import them (deduped across routes), loaded on
        // navigation and never preloaded on the landing page.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-accordion',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
          ],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-motion': ['framer-motion'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
})

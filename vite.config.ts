// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  // Release injecté au build pour Sentry (observabilité). Vercel expose
  // VERCEL_GIT_COMMIT_SHA ; fallback 'dev' en local. Statique → tree-shaké.
  define: {
    __APP_RELEASE__: JSON.stringify(
      (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7) || 'dev',
    ),
  },
  server: {
    // Bind to all interfaces only when explicitly requested (mobile testing).
    // Otherwise loopback to keep the dev server off shared networks. Faille N10.
    host: process.env.VITE_HOST_ALL === 'true' ? '0.0.0.0' : 'localhost',
    port: 3000,
    strictPort: true,
    // Replaces `allowedHosts: true` (DNS-rebinding bypass). Add hostnames
    // here when developing on a LAN, e.g. ['my-laptop.local'].
    allowedHosts: ['localhost', '127.0.0.1'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  esbuild: {
    drop: ['debugger'],
    // En prod, drop tous les console.* — évite le leak de stack traces / IDs
    // (cf. faille §14). Pour debug en local, utiliser le serveur dev (vite).
    pure: ['console.log', 'console.debug', 'console.info', 'console.warn', 'console.error'],
  },
  build: {
    rollupOptions: {
      output: {
        // Audit perf 2026-05-29 — chunking strategy revised. Goals:
        // 1. Isolate `recharts` (was bleeding 321 kB into auto-split
        //    chunks shared by Landing/Dashboard/Statistics). Now lazy and
        //    paid only by pages that actually render a chart.
        // 2. Pull `@supabase/supabase-js` and `@sentry/react` out of the
        //    main entry — both are bulky and were defaulting to `index`.
        // 3. Split `react-router` from `react`/`react-dom` to parallelize
        //    over HTTP/2.
        manualChunks(id) {
          if (id.includes('node_modules/react-router')) {
            return 'vendor-router';
          }
          if (id.includes('node_modules/react') ||
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/scheduler')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/@radix-ui')) {
            return 'vendor-radix';
          }
          if (id.includes('node_modules/@fullcalendar')) {
            return 'vendor-calendar';
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-animation';
          }
          // GSAP réservé à la landing (importé uniquement via src/lib/gsap.ts
          // depuis LandingPage, déjà React.lazy) → chunk chargé seulement
          // sur /welcome, zéro impact sur le bundle de l'app connectée.
          if (id.includes('node_modules/gsap') ||
              id.includes('node_modules/@gsap')) {
            return 'vendor-gsap';
          }
          if (id.includes('node_modules/recharts') ||
              id.includes('node_modules/d3-') ||
              id.includes('node_modules/victory-vendor')) {
            return 'vendor-charts';
          }
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase';
          }
          if (id.includes('node_modules/@sentry')) {
            return 'vendor-sentry';
          }
          if (id.includes('node_modules/date-fns') ||
              id.includes('node_modules/lucide-react')) {
            return 'vendor-utils';
          }
          if (id.includes('node_modules/@tanstack')) {
            return 'vendor-query';
          }
        }
      }
    },
    chunkSizeWarningLimit: 400,
  }
})

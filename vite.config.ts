// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
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
        manualChunks(id) {
          if (id.includes('node_modules/react') ||
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react-router')) {
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

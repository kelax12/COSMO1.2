// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Séparer les vendors React
          if (id.includes('node_modules/react') || 
              id.includes('node_modules/react-dom') || 
              id.includes('node_modules/react-router')) {
            return 'vendor-react';
          }
          // Séparer les composants Radix UI
          if (id.includes('node_modules/@radix-ui')) {
            return 'vendor-radix';
          }
          // Séparer FullCalendar
          if (id.includes('node_modules/@fullcalendar')) {
            return 'vendor-calendar';
          }
          // Séparer Framer Motion
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-animation';
          }
          // Séparer les utilitaires
          if (id.includes('node_modules/date-fns') || 
              id.includes('node_modules/lucide-react')) {
            return 'vendor-utils';
          }
          // Séparer TanStack Query
          if (id.includes('node_modules/@tanstack')) {
            return 'vendor-query';
          }
        }
      }
    },
    chunkSizeWarningLimit: 400,
  }
})

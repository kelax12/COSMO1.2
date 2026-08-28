// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Écrit `dist/version.json` avec le même identifiant de build que celui compilé
// dans le bundle (`__APP_RELEASE__`). C'est le seul moyen pour un onglet resté
// ouvert de savoir qu'il exécute du code périmé : une SPA ne recharge jamais
// son bundle toute seule.
//
// POURQUOI ÇA COMPTE ICI : le 2026-08-26, 91,5 % du trafic Supabase de la
// journée venait de DEUX onglets qui exécutaient encore le bundle d'avant la
// suppression des sondes. Un correctif de performance n'atteint que ceux qui
// rouvrent l'application — et les utilisateurs les plus assidus, ceux qui ne
// ferment jamais l'onglet, sont les derniers servis et les plus coûteux.
//
// Le fichier n'est PAS servi depuis /assets : il ne doit pas hériter du
// `max-age=31536000, immutable`, sans quoi il annoncerait éternellement la
// version du jour du déploiement. Cf. l'en-tête dédié dans `vercel.json`.
const emitVersionFile = (release: string) => ({
  name: 'cosmo-emit-version',
  apply: 'build' as const,
  generateBundle(this: { emitFile: (f: { type: 'asset'; fileName: string; source: string }) => void }) {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ release }),
    });
  },
});

const APP_RELEASE = (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7) || 'dev';

export default defineConfig({
  plugins: [react(), emitVersionFile(APP_RELEASE)],
  // Release injecté au build pour Sentry (observabilité). Vercel expose
  // VERCEL_GIT_COMMIT_SHA ; fallback 'dev' en local. Statique → tree-shaké.
  define: {
    // ⚠️ MÊME valeur que celle écrite dans `version.json` par le plugin
    // ci-dessus : c'est la comparaison des deux qui détecte un onglet périmé.
    // Deux sources distinctes ne se compareraient jamais qu'à elles-mêmes.
    __APP_RELEASE__: JSON.stringify(APP_RELEASE),
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
          // ⚠️ PAS de chunk `vendor-radix`, et c'est délibéré.
          //
          // Regrouper les 20+ primitives Radix dans un chunk unique en faisait
          // un import STATIQUE de l'entrée dès qu'UNE seule était utilisée par
          // le shell (`TooltipProvider`, monté dans `App.tsx`). Vite préchargeait
          // alors les 45 ko du lot pour tout visiteur, y compris les 90 % de
          // primitives qui ne servent que dans une modale de page lazy.
          //
          // En laissant Rollup décider, chaque primitive part avec la page qui
          // l'utilise, et seules celles du shell restent dans l'entrée.
          //
          // Mesuré le 2026-08-26 : chemin critique 420,3 → 393,9 ko gzip
          // (−26,4 ko pour TOUT visiteur), contre +5,5 ko de duplication
          // répartie sur l'ensemble des chunks de page. On échange 5 ko payés
          // par quelques-uns contre 26 ko payés par tout le monde.
          //
          // 🔴 Ne pas « réoptimiser » en recréant un chunk Radix : ce serait
          // refaire exactement le bug. `npm run check:bundle` mesure désormais
          // le chemin critique COMPLET, pas la seule taille de l'entrée, donc
          // la régression serait attrapée.
          if (id.includes('node_modules/@radix-ui')) {
            return undefined;
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
          // OGL : micro-runtime WebGL (~25 kB gzip) utilisé par UN seul
          // composant, le fond `LightRays` du hero entreprise, lui-même
          // React.lazy dans la landing. Chunk séparé pour qu'il ne parte
          // jamais avec `vendor-gsap` (chargé, lui, dès le track perso).
          if (id.includes('node_modules/ogl')) {
            return 'vendor-ogl';
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
          // ⚠️ `clsx` / `tailwind-merge` / `cva` DOIVENT être assignés
          // explicitement, et c'est le correctif le plus rentable du fichier.
          //
          // `cn()` (src/lib/utils.ts) est appelé par presque chaque composant,
          // donc `clsx` est dans le graphe de l'entrée. Mais recharts l'importe
          // AUSSI, et un module partagé entre l'entrée et un chunk manuel est
          // absorbé par le chunk manuel. `clsx` atterrissait donc dans
          // `vendor-charts` (117 ko gzip), ce qui en faisait un import STATIQUE
          // de l'entrée : Vite émettait `<link rel="modulepreload">` sur
          // `vendor-charts` dans `index.html`, et TOUT visiteur téléchargeait
          // recharts + d3, sur la landing, sur /login, partout, pour une
          // fonction utilitaire de 500 octets.
          //
          // Mesuré le 2026-08-25 : 117,6 ko gzip préchargés pour rien.
          // Le contrôle qui l'empêche de revenir est `npm run check:bundle`.
          if (id.includes('node_modules/date-fns') ||
              id.includes('node_modules/lucide-react') ||
              id.includes('node_modules/clsx') ||
              id.includes('node_modules/tailwind-merge') ||
              id.includes('node_modules/class-variance-authority')) {
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

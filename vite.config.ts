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

export default defineConfig(({ mode }) => ({
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
    // ⚠️ L'ORDRE COMPTE : Vite essaie les alias dans l'ordre déclaré, et
    // `@/modules/billing/premium-config` doit être vu AVANT le `@` générique.
    alias: [
      // ─── Le drapeau de facturation, retourné pour le SEUL mode e2e-stub ───
      //
      // 🔴 POURQUOI CE DÉTOUR PLUTÔT QU'UNE VARIABLE D'ENVIRONNEMENT.
      //
      // `ENTERPRISE_BILLING_ENFORCED` vaut `false`, et la règle écrite du dépôt
      // est que « le flag est la SEULE condition, jamais “actif si les variables
      // d'environnement existent” » : on doit pouvoir dire d'un coup d'œil si le
      // produit facture. Faire dériver le drapeau d'un `import.meta.env` casserait
      // exactement ça, et pour de bon — dans le produit livré, pas seulement ici.
      //
      // Conséquence : le bouton « Résilier et être remboursé » n'est monté NULLE
      // PART dans l'app servie, donc aucun parcours de bout en bout ne pouvait le
      // cliquer. C-27 exige pourtant que C-65, qui touche à de l'argent, ne parte
      // pas sans son parcours. On substitue donc le MODULE ENTIER, dans le seul
      // mode `e2e-stub`, exactement comme le fait `vi.mock(..., importOriginal)`
      // du test unitaire : le module de remplacement réexporte le produit et ne
      // change qu'un booléen. Les paliers, les montants et `ORG_FREE_SEATS`
      // restent ceux du produit — une grille recopiée serait une seconde grille
      // de tarifs, ce que `org-tiers.parity.test.ts` existe pour empêcher.
      //
      // ❌ Ne jamais étendre cette substitution à un autre mode : `npm run build`
      //    et `npm run dev` doivent voir le drapeau du produit, sans exception.
      ...(mode === 'e2e-stub'
        ? [
            {
              find: /^@\/modules\/billing\/premium-config$/,
              replacement: path.resolve(__dirname, './e2e/stubs/premium-config.e2e-stub.ts'),
            },
          ]
        : []),
      // Forme chaine, exactement comme l'ancien objet `{'@': …}` : Vite fait le
      // meme remplacement de prefixe. Une expression reguliere ici obligerait a
      // recoller le separateur a la main, et sous Windows a melanger `\` et `/`
      // dans le chemin rendu au scanner d'esbuild.
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
  // ─── Un cache de dependances PAR MODE ─────────────────────────────
  //
  // 🔴 Les deux serveurs de la suite E2E tournent EN MEME TEMPS (port 3000 en
  // mode par defaut, port 3210 en mode `e2e-stub`) et partageaient
  // `node_modules/.vite`. Depuis que leurs alias different — l'un substitue
  // `premium-config`, l'autre non — leurs dependances pre-empaquetees ne
  // s'accordent plus : chacun invalidait le cache de l'autre et se redemarrait,
  // en boucle. Mesure du 2026-09-08 : « The server is being restarted or
  // closed » a repetition, et une page blanche pour Playwright.
  //
  // ⚠️ Ne pas confondre avec un probleme de port : les serveurs demarraient
  // bien, c'est leur cache commun qui les faisait tourner en rond.
  cacheDir: mode === 'e2e-stub' ? 'node_modules/.vite-e2e-stub' : 'node_modules/.vite',
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
          // @sentry N'EST PLUS force dans un chunk nomme : il est charge en
          // import() dynamique (monitoring.ts). Un manualChunk le hissait et
          // Vite le `modulepreload`ait depuis index.html — donc telecharge
          // par tout le monde au chargement, ce qui annulait la mise en
          // differe. Rollup lui donne desormais son propre chunk async.
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
}))

# Performance bundle — `vite.config.ts manualChunks`

État après audit 2026-05-30 ([`../audit-perf.md`](../audit-perf.md)) — **entry chunk 124 kB (34 kB gzip)**, First Load Landing 474 kB (145 kB gzip).

## Vendor chunks isolés (commenter toute modif)

| Chunk | Contenu | Taille (gzip) | Quand chargé |
|---|---|---|---|
| `vendor-react` | react + react-dom + scheduler | 227 kB (72 kB) | Toujours (entry) |
| `vendor-router` | react-router-dom | 22 kB (8 kB) | Toujours (entry, split pour parallel HTTP/2) |
| `vendor-radix` | @radix-ui/* | 101 kB (31 kB) | Toujours |
| `vendor-supabase` | @supabase/supabase-js | 191 kB (50 kB) | Toujours (entry — extrait pour cache CDN) |
| `vendor-sentry` | @sentry/react | 82 kB (28 kB) | Toujours (entry — extrait pour cache CDN) |
| `vendor-animation` | framer-motion | 137 kB (45 kB) | Toujours |
| `vendor-utils` | date-fns + lucide-react | 48 kB (15 kB) | Toujours |
| `vendor-query` | @tanstack/* | 55 kB (16 kB) | Toujours |
| `vendor-charts` | **recharts + d3-* + victory-vendor** | 374 kB (110 kB) | **Lazy** (StatisticsPage, DashboardChart, scroll bottom Landing) |
| `vendor-calendar` | @fullcalendar/* | 263 kB (76 kB) | **Lazy** (`/agenda` uniquement) |

## Règles non négociables

- ❌ **Ne jamais importer Recharts ou un composant qui l'utilise (DashboardChart/StatsShowcase) sans `React.lazy`** — sinon il retombe dans le chunk du caller et pollue le critical path. Faille P-2.
- ❌ **Ne pas réintroduire GSAP** — supprimé (P-1), Framer Motion couvre tous les cas. Cursor blink → CSS keyframe.
- ❌ **Toute nouvelle dep > 50 kB minified doit être ajoutée à `manualChunks`** avec une règle explicite et commentée.
- ✅ `lucide-react` : imports nominaux uniquement (`import { Icon } from 'lucide-react'`). Jamais `import * as`.
- ✅ `date-fns/locale/fr` : import nominal. Jamais `import * as locales`.
- ✅ Tout composant globalement monté dans App.tsx (CommandPalette, etc.) qui n'apparaît qu'après un geste utilisateur → **lazy avec Suspense**.

## Budget bundle (objectif)

- Entry chunk : **< 150 kB gzip** (actuellement ~50 kB — large marge).
- Chaque chunk lazy : **< 80 kB gzip** (exception documentée : `vendor-charts` 110 kB gzip, `vendor-calendar` 76 kB gzip).
- Si `npm run build` warning ré-apparaît sur `index` > 400 kB → audit P-2/P-3 régressé.

## Limites de requêtes

Les `getAll()` à fort volume (**tasks, events, habits, okrs**) utilisent l'auto-pagination `fetchAllPages()` (`src/lib/fetch-all-pages.ts`) : pagination via `.range(from, to)` par pages de `PAGE_SIZE` (1000) jusqu'à épuisement, plafonné à `MAX_ROWS` (5000). Pour ≤ 1000 items → **une seule requête**. Ordre stable garanti par un tiebreak `.order('id')`.

- Les `getAll()` à faible volume (categories, lists, friends) gardent `.limit(200)`.
- ❌ Ne pas réintroduire un `.limit(500)` sec sur tasks/events/habits/okrs.
- ✅ Tout nouveau `getAll()` volumineux doit passer par `fetchAllPages()`.

## Ne jamais faire — Performance

- ❌ Réintroduire `gsap` (supprimé P-1) — utiliser Framer Motion ou CSS keyframes.
- ❌ Importer un composant Recharts sans `React.lazy` — fait retomber `vendor-charts` (374 kB) dans le critical path.
- ❌ Ajouter une dépendance > 50 kB minified sans règle `manualChunks`.
- ❌ Importer `* as locales` de `date-fns/locale` ou `* as Icons` de `lucide-react` — casse le tree-shaking.
- ❌ Monter un composant gros au niveau App qui ne s'affiche qu'après un geste — il doit être `lazy` + Suspense.

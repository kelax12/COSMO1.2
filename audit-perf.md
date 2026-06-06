# Audit Performance Bundle — COSMO 1.2

> **Statut** : P-1→P-5 résolus · P-6/P-7/P-8 info (déjà OK) · **P-9/P-10/P-11 ouverts** (future / low)
> **Date** : 2026-05-29 · **Branche** : `main` · **Outils** : `vite build` output, grep dépendances, inspection visuelle.
> **Lié depuis CLAUDE.md** : oui (§Performance bundle, lignes 10, 27, 934, 1269). Les règles `manualChunks` et le budget
> bundle sont déjà codifiés dans CLAUDE.md — ce fichier garde le détail des findings et la roadmap résiduelle.

---

## ⏳ Ouvert / actionnable

### P-9 — `vendor-charts` 374 kB (110 kB gzip) reste lourd (Medium, future)
Recharts est un poids lourd intrinsèque (`d3-*` derrière). Acceptable pour les routes payantes
(Statistics, Dashboard) mais gros pour le scroll du showcase landing.
- **Option A** : remplacer `StatsShowcase` par un SVG statique mockup (zéro JS) → gain ~110 kB gzip sur les
  visiteurs landing qui scrollent jusqu'au bas. **Effort** : ~1 jour.
- **Option B** : migrer `DashboardChart` / `DashboardBarChart` vers `visx` (~30 kB) ou `chart.js` (~60 kB),
  choix selon besoins de customisation tooltips. **Effort** : 2-3 jours.

### P-10 — `DashboardPage` reste gros (Low)
Après le split charts, DashboardPage est à 64 kB (vs 135 kB). Largement acceptable — surveillance seulement.

### P-11 — Pas de Lighthouse CI configuré (Low, hors scope)
Mesurer LCP/TBT/CLS par route via Lighthouse CI. À câbler quand le CI sera étendu (actuellement Playwright local).

### Roadmap suite
1. ~~Immédiat~~ : P-1 à P-5 ✅ faits.
2. **Sous 30 j** : remplacer `StatsShowcase` par mockup SVG (P-9 option A).
3. **Sous 90 j** : Lighthouse CI dans GitHub Actions (P-11).
4. **Continu** : surveiller l'entry chunk via `npm run build` — si re-passe au-dessus de **150 kB gzip**, alerte
   (déjà documenté dans CLAUDE.md §Checklist push prod).

---

## ✅ Résolu (historique condensé)

| ID | Sévérité | Finding | Fix appliqué |
|---|---|---|---|
| **P-1** | Critical | `gsap` (3.14.2) inclus en prod **uniquement** pour faire clignoter un curseur (`TextType.tsx:91-105`), runtime ~50 kB minifié chargé sur toutes les pages via Landing. | Remplacé `gsap.to()` par CSS `@keyframes text-type-blink` (`TextType.css`, durée via `--text-type-blink-duration`) + `npm uninstall gsap`. Bonus a11y : `prefers-reduced-motion` peut neutraliser le keyframe (WCAG 2.2.2). |
| **P-2** | Critical | 5 fichiers importaient `recharts` au top-level (dont `showcase/StatsShowcase.tsx` ← landing publique, + `ui/chart.tsx`, `DashboardChart.tsx`, `DashboardBarChart.tsx`, `StatisticsPage.tsx`). Sans règle dédiée, Rollup formait un chunk partagé géant (`CartesianChart`, 321 kB) téléchargé sur toute route avec un seul import recharts. | `manualChunks` bucket `vendor-charts` (recharts + `d3-*` + `victory-vendor`) dans `vite.config.ts` ; `StatsShowcase` lazy via `React.lazy` (Landing + GuidePage, skeleton 340 px). → vendor-charts (374 kB / 110 kB gzip) n'arrive plus sur la landing avant scroll. |
| **P-3** | High | Aucune règle `manualChunks` pour `@supabase/supabase-js` (~190 kB) ni `@sentry/react` (~82 kB) → ~270 kB du chunk entry de 403 kB. | 2 buckets `vendor-supabase` + `vendor-sentry` (`vite.config.ts`). Bénéfice secondaire : cache CDN plus efficace (une MAJ applicative ne purge plus ces caches). |
| **P-4** | Medium | `vendor-react` (250 kB) combinait react-core + router → moins bon pour le first paint sur HTTP/2. | Split `vendor-router` (22 kB) hors `vendor-react` (227 kB) ; scheduler React explicitement attaché à `vendor-react`. |
| **P-5** | Medium | `CommandPalette.tsx` monté eagerly (`App.tsx:200`) — pull framer-motion/lucide/next-themes/fuzzy — alors qu'il ne s'affiche que sur Ctrl/Cmd+K (<5 % des visiteurs). | `lazy(() => import('@/components/CommandPalette'))` + `Suspense fallback={null}`. |
| **P-6** | Info (OK) | `date-fns/locale/fr` importé dans 9 fichiers via import nominal `import { fr }`. Tree-shaking correct, pas de `import * as locales`. | Aucun fix nécessaire (vérifié en grep). |
| **P-7** | Info (OK) | `lucide-react` : tous imports nominaux. | Aucun fix nécessaire. |
| **P-8** | Info (acceptable) | `vendor-calendar` 263 kB (FullCalendar) lourd mais chargé **uniquement** sur `/agenda` (route lazy) ; les 4 plugins (core/daygrid/timegrid/interaction) sont tous utilisés. | Aucun fix. Reco future : si mode read-only agenda partagé, lazy `interaction` selon le rôle (hors scope). |

---

## 📌 Posture bundle (avant → après fixes)

**Avant** (warnings Vite sur 2 chunks > 400 kB) :
```
Entry chunk (index)             403.0 kB   113.9 kB gzip   ⚠
CartesianChart (shared chart)   321.1 kB    97.7 kB gzip   ⚠
vendor-calendar (FullCalendar)  263.1 kB    76.4 kB gzip
vendor-react (react + router)   250.0 kB    79.9 kB gzip
vendor-animation                137.0 kB    45.4 kB gzip   ← framer + gsap
DashboardPage                   134.7 kB    43.7 kB gzip
vendor-radix                    101.4 kB    31.4 kB gzip
TasksPage                        87.8 kB    21.4 kB gzip
TaskModal                        74.8 kB    17.4 kB gzip
OKRPage                          69.9 kB    15.7 kB gzip
```

**Après** :
```
Entry chunk (index)             123.7 kB    34.3 kB gzip   ↓ -69%
vendor-charts (lazy)            374.0 kB   110.2 kB gzip   ← Stats/Dashboard/scroll-Landing uniquement
vendor-calendar (lazy /agenda)  263.1 kB    76.4 kB gzip   (inchangé)
vendor-react                    226.9 kB    71.9 kB gzip   ↓ split router
vendor-supabase                 191.1 kB    50.5 kB gzip   ← extrait de l'entry
vendor-animation (Framer seul)  137.0 kB    45.4 kB gzip   (gsap supprimé)
vendor-radix                    100.5 kB    31.0 kB gzip   (inchangé)
vendor-sentry                    82.0 kB    28.1 kB gzip   ← extrait de l'entry
vendor-router                    22.0 kB     8.2 kB gzip   ← split de vendor-react
CommandPalette (lazy Ctrl+K)      7.5 kB     2.9 kB gzip
StatsShowcase wrapper             3.5 kB     1.3 kB gzip
```

**First Load (Landing publique)** :
- Avant : `index + vendor-react + vendor-radix` = **754 kB / 225 kB gzip**.
- Après : `index + vendor-react + vendor-router + vendor-radix` = **474 kB / 145 kB gzip**.
- **Gain : −280 kB, −35 % gzip.** Sur 4G 3 Mbps (~350 ko/s), TTI estimée ~2.1 s → ~1.4 s **avant** parsing JS.

**Vérifications** :

| Vérif | Avant | Après |
|---|---|---|
| `npm run lint` (fichiers touchés) | 0 err | 0 err ✅ |
| `npm run build` | warnings (2 chunks > 400 kB) | warning (1 chunk : vendor-charts lazy) ✅ |
| `npm run test:e2e` chromium | 3/3 | 3/3 ✅ |
| `npm uninstall gsap` | présent | absent ✅ |
| Vendor chunks isolés | 6 | 9 (+ supabase, sentry, charts) ✅ |

---

## 🔧 Annexe — commandes utiles

```bash
# Chunks par taille décroissante après build
npm run build 2>&1 | grep "kB" | sort -k2 -h -r | head -20

# Visualiser le contenu d'un chunk
npm i -D rollup-plugin-visualizer   # puis visualizer({open:true}) dans vite.config.ts plugins

# Mesurer le bundle d'une dep
npx pkg-size <dep-name>
```

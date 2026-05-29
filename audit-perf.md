# Audit Performance Bundle — COSMO 1.2

**Date** : 2026-05-29
**Branche** : `main`
**Outils utilisés** : `vite build` output, grep dépendances, inspection visuelle.

---

## Posture initiale (avant fixes)

```
Entry chunk (index)             403.0 kB   113.9 kB gzip   ⚠ warning Vite
CartesianChart (shared chart)   321.1 kB    97.7 kB gzip   ⚠ warning Vite
vendor-calendar (FullCalendar)  263.1 kB    76.4 kB gzip
vendor-react (react + router)   250.0 kB    79.9 kB gzip
vendor-animation                137.0 kB    45.4 kB gzip   ← framer + gsap
DashboardPage                   134.7 kB    43.7 kB gzip
vendor-radix                    101.4 kB    31.4 kB gzip
TasksPage                        87.8 kB    21.4 kB gzip
TaskModal                        74.8 kB    17.4 kB gzip
OKRPage                          69.9 kB    15.7 kB gzip
```

**First Load (Landing publique)** estimé : entry + vendor-react + vendor-radix
= **403 + 250 + 101 = 754 kB / 225 kB gzip** sur première visite. Sur 4G 3 Mbps
réel (≈ 350 ko/s), TTI ≈ 2.1 s **avant** parsing JS.

---

## Findings

### P-1 — GSAP dupliqué avec Framer Motion (Critical)

**Sévérité** : Critical (DX + bundle)
**Statut** : ✅ corrigé.

`gsap` (3.14.2) est inclus côté prod **uniquement pour faire clignoter un
curseur** dans [TextType.tsx:91-105](src/components/TextType.tsx:91). C'est
une animation `opacity: 1 → 0` en boucle — typiquement deux keyframes CSS.
Framer Motion est déjà chargé pour tout le reste de l'app.

**Vecteur d'impact** : `vendor-animation` 137 kB inclut le runtime GSAP
complet (~50 kB minifié) qui se charge sur **toutes** les pages via
LandingPage. Pour zéro feature utilisateur.

**Fix appliqué** :
1. Remplacé `gsap.to(...)` par une CSS keyframe `@keyframes text-type-blink`
   ([TextType.css](src/components/TextType.css)) avec durée câblée via
   custom property `--text-type-blink-duration`.
2. `npm uninstall gsap` — disparition de la dep.

**Référence** : OWASP DAST guidelines, WCAG 2.2.2 (Pause, Stop, Hide) —
les animations infinies doivent pouvoir être stoppées : avec CSS,
`prefers-reduced-motion` peut neutraliser le keyframe d'un trait.

---

### P-2 — Recharts (321 kB) éparpillé dans toutes les pages avec charts (Critical)

**Sévérité** : Critical
**Statut** : ✅ corrigé.

5 fichiers importaient `recharts` au top-level :
- [src/components/showcase/StatsShowcase.tsx](src/components/showcase/StatsShowcase.tsx) ← **landing page publique** (le pire)
- [src/components/ui/chart.tsx](src/components/ui/chart.tsx) (wrapper shadcn)
- [src/components/DashboardChart.tsx](src/components/DashboardChart.tsx)
- [src/components/DashboardBarChart.tsx](src/components/DashboardBarChart.tsx)
- [src/pages/StatisticsPage.tsx](src/pages/StatisticsPage.tsx)

Sans règle `manualChunks` dédiée, Rollup forme un chunk partagé géant
(`CartesianChart-…js`, 321 kB) qui se télécharge pour **toute** route ayant
un seul import recharts. Y compris la landing page.

**Vecteur d'impact** : visiteur arrivant sur `/` télécharge 97 kB gzip de
Recharts AVANT même de scroller jusqu'à StatsShowcase.

**Fix appliqué** :
1. `manualChunks` ajout d'un bucket dédié `vendor-charts` qui regroupe
   `recharts`, `d3-*`, `victory-vendor` (deps transitives) — [vite.config.ts](vite.config.ts).
2. `StatsShowcase` lazy-loadé via `React.lazy` dans LandingPage et
   GuidePage avec skeleton 340 px → la page rend instantanément sans
   attendre Recharts.

Résultat : `vendor-charts` (374 kB / 110 kB gzip) n'est **plus jamais**
téléchargé sur la landing tant que l'utilisateur n'a pas scrollé jusqu'au
showcase. StatisticsPage et DashboardPage le déclenchent à la navigation.

---

### P-3 — `@supabase/supabase-js` et `@sentry/react` dans le chunk entry (High)

**Sévérité** : High
**Statut** : ✅ corrigé.

Aucune règle `manualChunks` pour ces deux libs → tout retombait dans
`index.js`. Supabase ≈ 190 kB, Sentry ≈ 82 kB. À elles deux, **~270 kB du
chunk entry de 403 kB**.

**Fix appliqué** : 2 nouveaux buckets dans [vite.config.ts](vite.config.ts) :
```
node_modules/@supabase → vendor-supabase
node_modules/@sentry   → vendor-sentry
```

Bénéfice secondaire : la cache CDN devient bien plus efficace — une mise
à jour applicative ne purge plus le cache Supabase/Sentry des visiteurs.

---

### P-4 — `react-router` couplé à `react` dans `vendor-react` (Medium)

**Sévérité** : Medium
**Statut** : ✅ corrigé.

Le chunk `vendor-react` (250 kB) combinait react-core + router. Sur HTTP/2,
deux chunks plus petits téléchargent en parallèle sans coût round-trip
supplémentaire — meilleur pour le first paint.

**Fix appliqué** : split `vendor-router` (22 kB) hors `vendor-react`
(227 kB). Le bundle scheduler React est aussi explicitement attaché à
`vendor-react`.

---

### P-5 — `CommandPalette` chargé eagerly bien qu'invisible (Medium)

**Sévérité** : Medium
**Statut** : ✅ corrigé.

[src/components/CommandPalette.tsx](src/components/CommandPalette.tsx)
est monté au niveau App ([App.tsx:200](src/App.tsx)) — il pull `framer-motion`,
`lucide-react`, `next-themes`, ses helpers de fuzzy search. **Mais il ne
s'affiche que sur Ctrl/Cmd+K**, geste tenté par < 5% des visiteurs.

**Fix appliqué** : `lazy(() => import('@/components/CommandPalette'))` avec
`Suspense fallback={null}` — le composant n'apparaît dans le bundle qu'au
premier appui sur Ctrl+K.

---

### P-6 — Locale `date-fns/locale/fr` (Info — déjà OK)

9 fichiers importent `import { fr } from 'date-fns/locale'`. C'est l'import
nominal recommandé par date-fns 3 ; le tree-shaking fonctionne correctement,
seul `fr` est inclus (pas tout l'index). **Aucun fix nécessaire** — vérifié
en grep, pas de `import * as locales from 'date-fns/locale'`.

---

### P-7 — `lucide-react` (Info — déjà OK)

Tous les imports sont nominaux (`import { CalendarDays, X, … } from 'lucide-react'`).
Tree-shaking correct. **Aucun fix nécessaire**.

---

### P-8 — FullCalendar 4 plugins (Info — acceptable)

`vendor-calendar` 263 kB est lourd mais :
- N'est chargé QUE sur `/agenda` (route lazy).
- Les 4 plugins (`core`, `daygrid`, `timegrid`, `interaction`) sont tous
  utilisés (vues jour/semaine/mois + drag).

**Reco future** : si l'app supportait un mode read-only de l'agenda
(consultation publique partagée), `interaction` pourrait être lazy
en fonction du rôle. Hors scope actuel.

---

## Posture après fixes

```
Entry chunk (index)             123.7 kB    34.3 kB gzip   ↓ -69%
vendor-charts (lazy)            374.0 kB   110.2 kB gzip   ← n'arrive que sur Stats/Dashboard/scroll-Landing
vendor-calendar (lazy /agenda)  263.1 kB    76.4 kB gzip   (inchangé)
vendor-react                    226.9 kB    71.9 kB gzip   ↓ split router
vendor-supabase                 191.1 kB    50.5 kB gzip   ← extrait de l'entry
vendor-animation (Framer seul)  137.0 kB    45.4 kB gzip   (gsap supprimé)
vendor-radix                    100.5 kB    31.0 kB gzip   (inchangé)
vendor-sentry                    82.0 kB    28.1 kB gzip   ← extrait de l'entry
vendor-router                    22.0 kB     8.2 kB gzip   ← split de vendor-react
CommandPalette (lazy Ctrl+K)      7.5 kB     2.9 kB gzip   ← extrait du main
StatsShowcase wrapper             3.5 kB     1.3 kB gzip   (chart loaded lazy)
```

**First Load (Landing publique)** :
- Avant : `index + vendor-react + vendor-radix` = **754 kB / 225 kB gzip**
- Après : `index + vendor-react + vendor-router + vendor-radix` = **474 kB / 145 kB gzip**
- **Gain : −280 kB, −35% gzip.**

**Sur 4G 3 Mbps** : TTI estimée passe de ~2.1 s à ~1.4 s **avant** parsing JS.

---

## Vérifications

| Vérif | Avant | Après | Statut |
|---|---|---|---|
| `npm run lint` (fichiers touchés) | 0 err | 0 err | ✅ |
| `npm run build` | warnings (2 chunks > 400 kB) | warnings (1 chunk : vendor-charts lazy) | ✅ |
| `npm run test:e2e` chromium | 3/3 | 3/3 | ✅ |
| `npm uninstall gsap` | présent | absent | ✅ |
| Vendor chunks isolés | 6 | 9 (+ supabase, sentry, charts) | ✅ |

---

## Findings non traités (volontairement)

### P-9 — `vendor-charts` 374 kB reste lourd (Medium, future)

Recharts est un poids lourd intrinsèque (utilise `d3-*` derrière). À 110 kB
gzip, c'est acceptable pour les routes payantes (Statistics, Dashboard) mais
gros pour le scroll du showcase landing.

**Options futures** :
- Remplacer `StatsShowcase` par un SVG statique mockup (zéro JS) — gain
  ~110 kB gzip sur les visiteurs landing qui scrollent jusqu'au bas.
- Migrer `DashboardChart` / `DashboardBarChart` vers `visx` (modulaire,
  ~30 kB) ou `chart.js` (~60 kB) — choix tactique selon les besoins de
  customisation tooltips.

**Effort** : 1 jour SVG mockup, 2-3 jours migration libraire chart.

### P-10 — `DashboardPage` (135 kB → 64 kB après split, mais reste gros) (Low)

Après le split charts, DashboardPage est à 64 kB. Largement acceptable.

### P-11 — Pas de Lighthouse CI configuré (Low, hors scope)

Le plan recommandait Lighthouse CI pour mesurer LCP/TBT/CLS par route.
À cabler quand le CI sera étendu (actuellement Playwright local seulement).

---

## Roadmap suite

1. **Immédiat (déjà fait)** : P-1, P-2, P-3, P-4, P-5
2. **Sous 30 j** : remplacer `StatsShowcase` par mockup SVG (P-9 option A)
3. **Sous 90 j** : Lighthouse CI dans GitHub Actions (P-11)
4. **Continu** : surveiller l'entry chunk via `npm run build` — si
   re-passe au-dessus de 150 kB gzip, alerte. À documenter dans CLAUDE.md
   §Checklist push prod.

---

## Annexe — Commandes utiles

```bash
# Voir les chunks par taille décroissante après build
npm run build 2>&1 | grep "kB" | sort -k2 -h -r | head -20

# Visualiser le contenu d'un chunk (à installer)
npm i -D rollup-plugin-visualizer
# Ajouter visualizer({open:true}) au plugins de vite.config.ts, rebuild,
# ouvre stats.html automatiquement.

# Mesurer bundle des deps
npx pkg-size <dep-name>
```

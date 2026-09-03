# Étude de faisabilité — React 19 + `react-router` 8

**Écrite le 2026-09-03**, audit **A-6** de `a-faire-code.md` §10. C'est une ÉTUDE : rien n'a été
migré, aucune version majeure n'a bougé dans `package.json`. Le livrable est ce plan, et deux
correctifs bornés livrés dans la foulée (cf. `a-faire-code.md` C-58 → C-60).

> ⚠️ **Le point le plus important de cette étude change la prémisse de `CLAUDE.md`/`faille.md`** :
> la migration n'est **plus** forcée par un blocage sécurité. Elle redevient un chantier de
> modernisation ordinaire, à planifier sans urgence. Détail au §1.

---

## 1. Le blocage sécurité qui forçait React 19 est déjà levé

`CLAUDE.md` et `faille.md` décrivent depuis le 2026-09-02/03 un piège à deux CVE sans issue sous
React 18 :

> `GHSA-qwww-vcr4-c8h2` (`react-router` ≥ 7.12.0 < 8.3.0, CSRF en mode RSC) […] Aucune version ne
> clôt les deux familles à la fois sous React 18 → la sortie est la migration React 19 +
> `react-router` 8.

**Mesuré aujourd'hui, contre trois sources indépendantes**, ce n'est plus vrai :

1. **L'avis GitHub lui-même** (`GHSA-qwww-vcr4-c8h2`, interrogé via l'API), pas le résumé qu'en
   fait `faille.md`, porte **deux plages disjointes avec chacune son propre correctif** :
   `[7.12.0, 7.18.2)` corrigée en **7.18.2**, et `[8.0.0, 8.3.0)` corrigée en 8.3.0. `faille.md` les
   avait fusionnées en une seule plage (« ≥ 7.12.0 < 8.3.0 »), ce qui masquait le correctif
   intermédiaire.
2. **`react-router@7.18.2`** (publié le 2026-07-28, un mois après les dernières versions encore
   vulnérables) est **déjà celui installé** : `package.json` porte `^7.18.2`, `package-lock.json`
   l'épingle exactement à cette version.
3. **Deux bases de vulnérabilités interrogées en direct pour cette version précise** rendent
   toutes les deux zéro résultat : `npm audit` local (les 2 seules alertes actuelles du dépôt
   viennent de `shadcn`, une devDependency — cf. `a-faire-code.md` C-18, sans rapport) et l'API OSV
   interrogée pour `react-router@7.18.2` (`{"vulns": []}`). L'open redirect
   `GHSA-wrjc-x8rr-h8h6` est lui aussi fermé, dès **7.18.0**.

Chronologie qui explique l'écart avec la doc, reconstituée version par version via OSV :

| Version | Date de publication | `GHSA-qwww-vcr4-c8h2` | `GHSA-wrjc-x8rr-h8h6` |
|---|---|---|---|
| 7.17.0 | 2026-06-04 | vulnérable | vulnérable |
| 7.18.0 | 2026-06-16 | vulnérable | **corrigé** |
| 7.18.1 | 2026-06-29 | vulnérable | corrigé |
| **7.18.2** | **2026-07-28** | **corrigé** | corrigé |
| 7.18.3 | 2026-08-28 | corrigé | corrigé |

L'énoncé « aucune version ne clôt les deux familles sous React 18 » était vrai tant que la version
publiée la plus récente était 7.18.0 ou 7.18.1. Il a cessé de l'être à la publication de 7.18.2, et
personne n'est revenu vérifier depuis.

**Conséquence directe** : le dépôt ferme déjà les deux CVE, aujourd'hui, sous React 18, sans avoir
rien changé. La migration React 19 + `react-router` 8 n'est plus une urgence sécurité — elle
redevient un chantier de modernisation ordinaire (accès aux nouvelles API, alignement avec la
source shadcn amont), à planifier sans la contrainte « CVE ouverte ». `faille.md` a été corrigé en
conséquence (§ Ouvert · à planifier).

❌ **Ça ne change rien à la règle `npm audit fix`** : ne toujours pas la lancer sur ce paquet sans
relire l'avis à la main — un lockfile différent peut encore proposer une rétrogradation.

---

## 2. Ce que la migration React 19 casserait réellement dans CE code

Balayage complet de `src/**/*.tsx` et `src/**/*.ts` contre la liste officielle des ruptures React 19
(`react`/`CHANGELOG.md`, section « Breaking Changes » de la 19.0.0), pas une lecture de mémoire :

| Rupture React 19 | Présente dans ce code ? | Mesuré par |
|---|---|---|
| `ReactDOM.render` / `.hydrate` / `unmountComponentAtNode` / `findDOMNode` | **Non**, 0 occurrence | `grep` sur tout `src/` |
| `react-dom/test-utils` | **Non**, 0 occurrence | idem |
| `propTypes` / `defaultProps` (composants fonction) / `contextTypes` / `getChildContext` | **Non**, 0 occurrence | idem |
| Refs string, `React.createFactory`, `react-test-renderer/shallow` | **Non**, 0 occurrence | idem |
| Nouvelle transformation JSX requise | **Déjà en place** : `tsconfig.app.json` porte `"jsx": "react-jsx"` | lecture directe |
| Espace de noms global `JSX` (remplacé par `import { JSX } from 'react'`) | **Non utilisé** : 0 occurrence de `JSX.Element`/`JSX.IntrinsicElements` hors `React.JSX` | `grep` |
| `useRef<T>()` sans argument initial (obligatoire sous les types React 19) | **Un seul site** : `src/lib/hooks/useDebounce.ts:69` (`usePrevious`) | `grep -rn "useRef<[^>]*>()"` |
| Retour implicite non-`void` d'un callback ref (désormais une erreur de type) | **Non** : le seul callback ref multi-usage (`EventModalFormMobile.tsx:90`) a déjà un corps de bloc, et `register()` a une signature `=> void` | lecture de `event-modal-form.types.ts` + `grep` |
| `ref` comme prop ordinaire (composant fonction recevant un `ref` sans `forwardRef`) | **Deux composants** touchés dans tout `src/`, cf. §3 | balayage exhaustif, détail ci-dessous |

**`React.FC` (174 fichiers)** : pas une rupture. Cosmétique, ne bloque rien.

**Aucun `<React.StrictMode>` n'est monté** (`src/main.tsx` fait un `createRoot(...).render(<App/>)`
direct) : la double invocation des callbacks ref au montage, l'un des changements de comportement
de StrictMode en React 19, ne peut donc rien casser aujourd'hui — mais si StrictMode est ajouté
plus tard, dans la même PR ou une autre, il faudra revérifier les callbacks ref à effet de bord
(aucun trouvé en dehors des refs déjà couvertes par des hooks `useRef`).

**Rendu serveur** : sans objet. `prerender.mjs` ne fait AUCUN rendu React (ni `renderToString` ni
`renderToStaticMarkup`) — c'est un script Node qui réécrit le `<head>` du `dist/index.html` déjà
buildé, en chaîne de caractères. Toutes les ruptures React 19 côté `react-dom/server` (`prerender`,
`prerenderToNodeStream`, hydratation) sont donc hors sujet pour ce dépôt.

---

## 3. Les composants shadcn recopiés, ref par ref (répond à C-19)

Balayage de **tout** `ref={` dans `src/**/*.tsx` (125 occurrences) : 113 posent un ref sur un
élément DOM natif (`<div>`, `<input>`, `<section>`…), toujours valide quelle que soit la version de
React. Sur les 12 restantes, posées sur un composant (majuscule), un seul groupe touche
`src/components/ui/` — les fichiers recopiés depuis shadcn :

| Composant | Recevait un ref ? | État avant cette session | État après |
|---|---|---|---|
| `Button` | Oui (`ui/calendar.tsx`, en interne) | ✅ déjà `forwardRef` (corrigé le 2026-08-30, C-18 historique) | inchangé |
| `Input` | Oui (`AdminMfaGate.tsx:106`) | ❌ pas de `forwardRef` — **cassé**, cf. C-59 | ✅ corrigé cette session |
| `DialogPrimitive.Overlay` (wrapper `ui/dialog.tsx`) | Oui (test de non-régression) | ✅ déjà `forwardRef` | inchangé |
| Les 22 autres fichiers (`avatar`, `badge`, `alert-dialog`, `calendar` le composant top-level, `chart`, `checkbox`, `command`, `dropdown-menu`, `label`, `popover`, `scroll-area`, `select`, `separator`, `sheet`, `skeleton`, `slider`, `textarea`, `tooltip`) | **Non, aucun** | — | — |

**Conclusion falsifiable** : la classe de bug que C-19 redoutait (« composant shadcn recopié sans
vérifier sa cible React, symptôme silencieux ») n'a **aucune autre instance vivante** aujourd'hui
dans `src/components/ui/`. Elle en avait deux, `Button` (déjà fermé) et `Input` (fermé cette
session, cf. C-59 dans `a-faire-code.md`).

⚠️ **Ce que cette conclusion ne garantit pas** : c'est un état de CE JOUR, pas une propriété
permanente. Le jour où un futur composant de `src/components/ui/` reçoit un `ref` pour la première
fois, il faut revérifier qu'il est bien un `forwardRef` — la classe de bug reste silencieuse par
nature (pas d'erreur au build, un avertissement console facile à manquer, un symptôme qui ne se
voit qu'en testant le clavier ou le focus programmatique).

Les composants Radix sous-jacents (`@radix-ui/react-*`, 39 paquets installés) déclarent tous, dans
leur `package.json` déjà présent dans `node_modules`, un peer `react` couvrant
`^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc` — ils gèrent `forwardRef` en interne et ne sont pas
concernés par cette classe de bug.

---

## 4. `react-router` 7 → 8 : ce que ça change vraiment pour CE dépôt

Lu le CHANGELOG officiel de la 8.0.0 (`remix-run/react-router`, section « Major Changes ») ligne par
ligne et confronté à l'usage réel du dépôt (61 fichiers important depuis `'react-router'`, inventaire
exhaustif des symboles importés) :

| Rupture v8 | Concerne ce dépôt ? | Pourquoi |
|---|---|---|
| `react-router-dom` supprimé | **Non** | Le dépôt importe déjà tout depuis `'react-router'` bare, jamais `'react-router-dom'` (`grep` : 0 occurrence) |
| Champs `data`/`meta` de route retirés | **Non** | Aucun `meta()` de route, aucun fichier de route module — le dépôt n'utilise pas le mode framework (`@react-router/dev`) |
| `future.v8_middleware` toujours actif, `context` toujours un `RouterContextProvider` | **Non** | Aucun `loader`/`action`/`middleware` — 0 usage du routeur de données (`createBrowserRouter`, `RouterProvider`) |
| `splitRouteModules` (config `@react-router/dev`) | **Non** | Le dépôt n'a pas de dépendance `@react-router/dev` ; le build passe par `vite build` + `prerender.mjs` maison |
| Node 22.22.0+ minimum | **Mécanique** | `package.json` porte `"node": ">=22"` (non borné) ; à resserrer à `>=22.22.0` au moment de la bascule. Aucune action avant |
| Vite 7+ minimum | **Déjà satisfait** | `vite@7.3.2` installé |
| React 19.2.7+ (peer) | **C'est LA dépendance réelle** | `react-router` 8 ne s'installe pas sans React 19 déjà en place — ce n'est pas un travail parallèle, c'est séquentiel |

**Sur nos usages précis** (61 imports recensés : `useNavigate` ×28, `Link` ×18, `useLocation` ×9,
`useSearchParams` ×7, `Navigate` ×7, `MemoryRouter` ×7 en tests, `Routes`/`Route` ×4 chacun,
`useParams` ×3, `Outlet`/`NavLink` ×2 chacun, `useResolvedPath`/`useMatch`/`BrowserRouter` ×1
chacun) — **ce sont tous des symboles du mode déclaratif**, celui que les ruptures de la v8
ne touchent pas :

- **`basename`** (`<BrowserRouter basename={routerBasename}>`, `src/main.tsx:208`, figé au montage
  par `src/i18n/bootstrap.ts`) : API stable depuis longtemps, absente du CHANGELOG v8. Rien à
  changer.
- **Routes lazy** (`<Route element={<Suspense><AppErrorBoundary><LazyPage/></AppErrorBoundary></Suspense>}>`,
  `React.lazy` standard, pas `lazy()` de route module) : mécanisme React, pas React Router. Rien à
  changer.
- **`ErrorBoundary`** : le dépôt n'utilise **jamais** `errorElement`/`ErrorBoundary` de React
  Router — chaque route est enveloppée dans le composant maison `AppErrorBoundary`
  (`src/components/AppErrorBoundary.tsx`), monté explicitement dans `App.tsx`. Le retrait du champ
  interne `hasErrorBoundary` (v8) ne concerne que le routeur de données. Rien à changer.
- **Slugs localisés** (`src/i18n/routes.ts`, `useLocalizedPath()`) : construisent des chaînes de
  chemin ordinaires passées à `<Link to=>` / `navigate()`. Aucune dépendance à une API de
  `react-router` qui bouge en v8.

**Conclusion falsifiable** : il n'y a pas de migration `react-router` 7 → 8 indépendante à
chiffrer. Une fois React 19 en place, la bascule de `react-router` est une **montée de version**,
pas un chantier — bump `package.json`, réinstalle, relance des tests.

### La garde anti-open-redirect n'est pas concernée

`src/lib/no-open-redirect.test.ts` verrouille une propriété du CODE de ce dépôt (aucune navigation
n'est alimentée par un paramètre lu depuis l'URL courante), pas une propriété de la bibliothèque.
Rien dans la migration ne peut la faire régresser ; elle continuera de tourner à l'identique après
comme avant.

---

## 5. Chiffrage

Étant donné que la quasi-totalité des ruptures listées aux §2 et §4 ne touchent pas ce code, le
chiffrage est nettement plus léger que ce que « React 19 + react-router 8 » suggère en général :

| Étape | Contenu | Effort |
|---|---|---|
| **PR 1 — React 18 → 19** | Bump `react`, `react-dom`, `@types/react`, `@types/react-dom` en 19.x. Fix mécanique de `useRef<T>()` (`useDebounce.ts:69`, cf. C-60). Relancer `npm test`, `npm run typecheck`, `npm run lint`. Parcours manuel des écrans qui utilisent `createPortal` (13 fichiers), le calendrier (`ui/calendar.tsx`), et l'audit clavier `e2e/a11y-keyboard-audit.spec.ts` (le témoin qu'il embarque doit rester vert) | **0,5 à 1 jour** |
| **PR 2 — `react-router` 7 → 8** | Bump `react-router`, resserrer `"node": ">=22.22.0"` dans `package.json`. Relancer `src/lib/no-open-redirect.test.ts` et la suite complète. Fumée manuelle : navigation, `basename` (bascule de langue), routes lazy, slugs localisés | **< 1 heure**, une fois PR 1 posée et stable |

**Pourquoi deux PR et pas une** : `react-router` 8 exige React ≥ 19.2.7 en peer — la coupe est donc
imposée par la dépendance elle-même, pas un choix arbitraire. PR 1 doit être posée et éprouvée en
prod avant PR 2.

**Ce qui n'est délibérément PAS inclus** dans ce chiffrage : l'ajout de `<React.StrictMode>` (aucune
des deux montées de version ne l'exige), et l'adoption des nouvelles API React 19 (`use()`,
`useActionState`, métadonnées de document natives) — aucune n'est requise, ce sont des chantiers
séparés à instruire pour eux-mêmes si intéressant.

**Pré-requis avant de lancer PR 1** : aucun. La justification « urgence sécurité » ayant disparu
(§1), le moment de la migration redevient un arbitrage produit ordinaire — cf.
`a-faire-manuel.md` M-33.

---

## 6. Ce qui a été vérifié en dehors du périmètre strict de la migration

- **`npm run typecheck`, `npm run lint`, `npm run i18n:check`** : verts sur l'état actuel (avant
  toute bascule), avec le correctif `Input` inclus.
- **Suite complète (`npx vitest run`)** : 2 112 → 2 114 tests (2 nouveaux, `input.test.tsx`), 0
  avertissement « cannot be given refs » sur l'ensemble du run. Les deux échecs préexistants
  (`demo-engagement.test.ts`, `org-loading-states.test.tsx`) sont des flakys temporels sans rapport
  avec cette étude — non touchés.
- **Dépendances directes et transitives de l'UI** (`framer-motion`, `@tanstack/react-query`,
  `@tanstack/react-virtual`, `recharts`, `react-day-picker`, `sonner`, `cmdk`,
  `@fullcalendar/react`, `@sentry/react`, `@gsap/react`, `lucide-react`,
  `@testing-library/react`, les 39 paquets `@radix-ui/*`) : **toutes**, dans les versions
  actuellement installées, déclarent déjà un peer `react` couvrant `^19.0.0` — zéro blocage de
  dépendance à lever avant la bascule.

# Migration React 19 + `react-router` 8 : FAITE le 2026-10-23, et l'étude qui l'a préparée

## ✅ 0. Migration faite le 2026-10-23 (branche `claude/sleepy-mendel-ganczp`)

**Ce § décrit l'état courant. Les §1 à §6 sont l'étude du 2026-09-03 et la tentative du
2026-09-12, archivées à leur date** (section en bas de ce document) : elles expliquent les choix, elles ne
décrivent plus le dépôt. Les renvois « §N » ci-dessous les visent.

| Paquet | Avant | Après |
|---|---|---|
| `react`, `react-dom` | 18.3.1 | **19.3.1** |
| `@types/react`, `@types/react-dom` | 18.3.x | **19.3.0** |
| `react-router` | 7.18.2 | **8.5.0** |
| `@testing-library/react` | 16.3.2 | 16.3.3 |
| `engines.node` | `>=22` | **`>=22.22.0`** (exigé par `react-router` 8) |

Le lockfile ne bouge **que** pour ces paquets et leurs dépendances directes (`scheduler`,
`cookie-es`, `@remix-run/route-pattern` ; `loose-envify`, `@types/prop-types`, `cookie`,
`set-cookie-parser` sortent). ⚠️ Un `npm install <paquets>` naïf remontait en plus
`@radix-ui/react-dialog` 1.1 → 1.3 et dupliquait une trentaine de primitives Radix : le lockfile a
été reconstruit en ne retirant que les entrées des paquets montés.

**Les deux PR prévues au §5 n'en font qu'une** : `react-router` 8 exige React ≥ 19.2.7 en peer, et
rien dans le code n'a bougé pour lui (le §4 l'avait établi : 0 symbole du mode données, 0 import de
`react-router-dom`, 0 drapeau `future`). Séparer aurait fait jouer deux fois la même vérification.

### Ce qui a changé dans le code

1. **`RefObject<T>` → `RefObject<T | null>`** (§4bis.a), 13 déclarations : `TaskModalDesktopBody`,
   `ScrollReveal`, `OKRDeadlineReviewModal`, `use-modal-a11y` (×2), `use-bottom-sheet`,
   `AgendaDesktopHeader`, `AgendaCalendarSection` (×2), `useFocusableScrollers`,
   `use-external-task-drag`, `HeroBackdrop` (×2). Plus `MutableRefObject<boolean>` → `RefObject`
   (`TaskListsBar`), déprécié sous React 19. `tsc -b` : 17 erreurs → 0.
2. **`forwardRef` retiré de `Button`, `Input` et `DialogOverlay`** (`src/components/ui/`), les trois
   composants du §3 qui reçoivent un ref : `ref` y est une prop ordinaire, comme dans la source
   shadcn amont. La classe de bug « composant amont recopié, ref jamais attaché » est donc **fermée
   par construction**. Témoins : `button.test.tsx` (nouveau), `input.test.tsx`, `dialog.test.tsx`.
   Les `forwardRef` des composants métier (`TaskCard`, `TeamTaskCardLite`, `TeamTasksTableRow`,
   `TouchTarget`) restent : ils fonctionnent à l'identique sous React 19, et l'étude ne les visait pas.
3. **Aucune autre API dépréciée** : 0 `ElementRef`, 0 `defaultProps`/`propTypes`, 0
   `react-dom/test-utils`, 0 `future=`/`v7_*` (`grep` sur `src/`, `e2e/`, `scripts/`).

### 🔴 Le blocage du §4bis.b est levé, et sa cause n'était pas React

Le §4bis.b concluait : React 19 coûte +23,3 ko, seul `vendor-animation` peut les rendre. **C'était
faux, mesuré le 2026-10-23.** `vite.config.ts` rangeait dans `vendor-react` tout module dont le
chemin contient `node_modules/react`, donc AUSSI `react-day-picker`, `react-redux` (recharts),
`react-remove-scroll`, `react-is`, `react-style-singleton`, et Rollup y hissait leurs dépendances
(`date-fns` 4 de react-day-picker, `@date-fns/tz`, `use-sidecar`…). Tout cela partait dans le
**chemin critique** alors que seuls des écrans lazy s'en servent. Le défaut existait sous React 18 ;
il n'était simplement pas visible tant que la marge suffisait.

Correctif : chemins exacts (`node_modules/react/`, `react-dom/`, `scheduler/`) et deux chunks lazy
nommés (`vendor-daypicker`, `vendor-scroll-lock`). Mesuré par `npm run check:bundle` sur un build
avec `VITE_SENTRY_DSN` posée (la forme de prod) :

| | React 18, config d'avant | React 19, config d'avant | **React 19, config corrigée** |
|---|---|---|---|
| chemin critique (gzip) | 305,6 ko | 328,8 ko ✖ | **302,6 ko** (plafond 323,0, marge 6,3 %) |
| `vendor-react` | 72,1 ko | 95,4 ko ✖ | **69,2 ko** (plafond 76,0) |
| entrée | 68,2 ko | 68,3 ko | 68,3 ko (plafond 70,5) |
| barils `index` | 86,8 ko | 86,8 ko | 86,8 ko (plafond 89,5) |

**Aucun plafond n'a été touché**, et le critère de sortie de C-14 (5 % de marge) tient. Le seuil de
reprise de 283,5 ko du §4bis.c ne s'applique plus : il supposait que React 19 ajoutait 23,3 ko au
chemin critique, il en retire 3. `MotionConfig` reste dans `App.tsx`, inchangé.

### Ce qui a été vérifié

- `npm run typecheck` 0 erreur · `npm run lint` 0 erreur (33 avertissements, les mêmes que `main`)
  · `npm run build` vert · `npm run check:bundle` vert.
- `npm test` et `npm run test:coverage` : **363 fichiers sur 363 au glob, 4 095 tests**, exit 0,
  seuils de couverture tenus. Les 18 autres gardes de `lint-test-build` rejouées en local : vertes.
- Copies prérendues du hero (`scripts/landing-hero/*.html`), recapturées sous React 19 : **seule
  différence**, React 19 pose l'attribut `src` d'un `<img>` après les autres. Même balisage, même
  texte, même classes. La capture a révélé un défaut du script, corrigé : sans `locale`, Playwright
  parle `en-US` et `perso-fr.html` recevait la landing anglaise.
- Régression visuelle (`--project=visual`) : **20 sur 20 identiques à React 18**, mesuré en A/B sur
  la même machine. Les références du dépôt viennent du runner GitHub (autre Chromium, autres
  polices) : contre elles, `main` lui-même diffère ici sur 18 écrans. Les références ont donc été
  régénérées dans une copie jetable de `main`, rejouées contre `main` (20/20, le banc est stable),
  puis contre cette branche (20/20). ❌ Les références suivies n'ont PAS été régénérées : c'est le
  job `Visual` de la PR qui tranche contre elles.
- Mode démo (`--project=chromium`) et mode Supabase (`--project=supabase-stub`) : **155 passés, 3 ignorés, 0 échec, 0 instable**, exit 0 (13,3 min, chauffes comprises).
  Non joués ici : `mobile-safari` (WebKit absent de la machine), `mobile-chrome` ; la CI les joue.

### Ce qui reste

- **Fumée manuelle en prévisualisation Vercel** (Axel) : bascule de langue (`basename`), routes
  lazy, slugs localisés, connexion réelle Supabase. La CI ne joue que le mode démo et le stub.
- `check:study` est recalé sur React 19 / `react-router` 8 : ce § décrit désormais ces versions-là, les §1 à
  §6 archivés décrivent React 18.

---


## 🕳️ Angles morts · ce que ce document NE mesure PAS (2026-09-16)

> Ce document affirme des choses que rien ne pèse : chaque ligne nomme une affirmation qui n'était vérifiée
> par rien, et la garde qui la vérifie depuis. 🔴 **Une garde posée n'est pas un angle mort fermé** : la
> dernière colonne dit ce que son vert ne prouve pas. L'énoncé du 2026-09-16, la colonne « État » du
> 2026-09-21 et les mesures datées sont archivés sans une coupe :
> [`archive/ANGLES-MORTS-2026-09-16-docs-vivantes.md`](./archive/ANGLES-MORTS-2026-09-16-docs-vivantes.md).

| # | Angle mort (énoncé du 2026-09-16) | Garde qui le couvre | 🔴 Ce qu'elle ne prouve pas |
|---|---|---|---|
| AM-1 | **C'est une ÉTUDE, et une étude périme** : écrite le 2026-09-03 contre les versions de ce jour, les composants shadcn audités « ref par ref », le chiffrage et la chronologie CVE décrivent un instant | `npm run check:study` : échoue si une majeure citée ici bouge (`C-108`) | Le coût de **ne pas** migrer, qui se compte en incidents |
| AM-2 | **La chronologie CVE n'est surveillée par rien de ciblé** (Dependabot n'alerte pas sur « React 18 approche de sa fin de support », l'argument central de l'étude) | `check:study` (`C-108`) | Idem AM-1 |
| AM-3 | **Le coût de NE PAS migrer n'est pas mesuré** (le piège `Button`/`forwardRef` est venu d'une source shadcn écrite pour React 19 ; rien ne compte ces incidents) | `check:study` (`C-108`) | Idem AM-1 : la migration est faite (§ 0), le seuil de reprise de 283,5 ko ne s'applique plus |

---

## L'étude du 2026-09-03 et la tentative du 2026-09-12 : archivées

Les §1 à §6 (audit `A-6` de `a-faire-code.md`) sont l'étude qui a préparé cette migration. Elles expliquent les
choix, elles ne décrivent plus le dépôt : texte repris sans une coupe dans
[`archive/MIGRATION-REACT19-etude-2026-09-03-au-2026-09-13.md`](./archive/MIGRATION-REACT19-etude-2026-09-03-au-2026-09-13.md).
Ce que chaque § a établi, en une ligne :

- **§1** : le blocage sécurité qui forçait React 19 était levé par `react-router@7.18.2` (l'avis
  `GHSA-qwww-vcr4-c8h2` porte deux plages disjointes, chacune avec son correctif ; `faille.md` les avait fusionnées).
- **§2** : ce que React 19 casserait dans ce code. **§3** : les composants shadcn recopiés, ref par ref (`C-19`) ;
  seuls `Button`, `Input` et `DialogOverlay` recevaient un ref.
- **§4** : `react-router` 7 → 8 ne touche ce dépôt par aucun symbole du mode données, aucun import de
  `react-router-dom`, aucun drapeau `future` ; la garde `src/lib/no-open-redirect.test.ts` verrouille une
  propriété du code, pas de la bibliothèque, et n'est pas concernée.
- **§4bis** : ce que l'étude avait manqué, mesuré en exécutant la migration le 2026-09-12 : la classe de types
  `RefObject<T>`, et un surcoût de 23,3 ko gzip jugé bloquant, **levé le 2026-10-23** (§ 0 : la cause était le
  regroupement de `vite.config.ts`, pas React). L'arbitrage du 2026-09-13, différer, est caduc.
- **§5** : chiffrage, deux PR prévues, devenues une seule (§ 0). **§6** : vérifications hors périmètre strict.

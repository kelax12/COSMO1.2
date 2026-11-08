> ⚠️ **ARCHIVE : audit mobile / direction artistique du 2026-08-14, extrait de `docs/MOBILE.md` le 2026-11-08, non maintenu.**
> Chaque passage décrit l'état **à sa date**, y compris ses listes « ce qui reste » : une bonne part a été faite depuis.
> État courant : [`docs/MOBILE.md`](../MOBILE.md). Les notes /100 ont cessé (ADR 0012) : [`docs/INDICATEURS.md`](../INDICATEURS.md).
> Les liens relatifs et les ancres de ce passage sont ceux de son document d'origine : certains ne résolvent plus.

## Audit mobile / direction artistique — 2026-08-14

**Méthode** : mesures DOM/CSS sur l'app en mode démo (viewport 375×812) + comptage statique de
l'adhérence au design system. Remplace les trois audits du 2026-07-25 archivés
([impeccable](../AUDIT-IMPECCABLE-MOBILE-2026-07-25.md),
[design-skill](../AUDIT-DESIGN-SKILL-MOBILE-2026-07-25.md),
[DA brief](../MOBILE-DA-BRIEF.md)), 161 commits plus tôt.

### ✅ 1. Sous `prefers-reduced-motion` — bien pire que deux bannières (corrigé le 2026-08-24)

> **Ce finding était sous-évalué, et la liste « plus de 20 fichiers à risque, tous ne sont pas
> cassés » n'avait jamais été vérifiée. Elle l'a été le 2026-08-24, dans le navigateur, avec
> `prefers-reduced-motion: reduce` RÉELLEMENT actif** (le réglage est activé sur la machine
> d'Axel — cf. mémoire projet), viewport 375×812, mode démo.
>
> **Ce qui était réellement cassé :**
>
> | Élément | Mesure | Conséquence |
> |---|---|---|
> | `MobileMoreSheet` (« Plus d'options ») | `matrix(1, 0, 0, 1, 0, 510)`, `top: 812` pour `vh: 812` | **0 px visible.** Le voile s'affiche, la feuille non |
> | 10 blocs de `/dashboard` (cascade `staggerChildren`) | `matrix(1, 0, 0, 1, 0, 20)` | 20 px trop bas, définitivement |
> | `ListActionsSheet`, 3 feuilles de `TaskModalMobileBody` | même motif (`initial` avec un `y` SEUL) | feuille hors écran |
> | `CookieBanner`, `DemoBridgePrompt` | `transform: none` | ✅ le correctif du 14/08 tient |
> | `WeeklyCheckinModal` (`y: '100%'` **+ `opacity`**) | `transform: none`, 812 px visibles | ✅ se résout correctement |
>
> `MobileMoreSheet` est le **seul** accès mobile à OKR, Statistiques, Paramètres et à la
> déconnexion : la navigation mobile était **sans issue** pour ces utilisateurs. Invisible pour
> tous les autres — d'où la survie du bug.
>
> **Correctif** : `useSheetMotion()` et `useRevealVariants()` dans
> `src/components/mobile/mobile-motion.ts`. Sous mouvement réduit, ils n'émettent **aucune clé de
> transform** : rien ne peut rester coincé sur `initial`. Vérifié après correctif, même
> environnement : `MobileMoreSheet` → `transform: none`, **510 px visibles** ; `/dashboard` →
> **0 transform figé** (contre 10 avant).
>
> **Garde** : `src/design-system.guard.test.ts` refuse toute NOUVELLE feuille écrite à la main
> (cliquet sur les 17 fichiers restants, qui ne peut que rétrécir).

### Le diagnostic d'origine (2026-08-14)

**Mesuré** : avec `prefers-reduced-motion: reduce` actif, deux `<aside>` en `position: fixed`
conservent `transform: matrix(1, 0, 0, 1, 0, 120)` — un décalage de **120 px vers le bas qui ne
disparaît jamais**, même 2,5 s après le chargement. Conséquence sur `/entreprise` en 375×812 : le
bouton **« Créer mon compte »** de la bannière démo est à `bottom: 835` pour un viewport de 812.
Il est **hors écran et inatteignable** — l'élément étant `fixed`, aucun scroll ne le ramène.

Composants touchés : `CookieBanner.tsx`, `DemoBridgePrompt.tsx`.

**Mécanisme** : `App.tsx` monte `<MotionConfig reducedMotion="user">`, ce qui neutralise les
animations de **transform**. Un composant écrit `initial={{ y: 120 }} animate={{ y: 0 }}` compte
sur l'animation pour atteindre sa position finale ; l'animation ne jouant pas, la valeur `initial`
**reste appliquée**. Le réglage censé aider les utilisateurs sensibles au mouvement casse donc la
mise en page pour eux — et pour eux seuls, ce qui explique que le bug ait survécu : il est
invisible sur une machine sans le réglage.

⚠️ Le pattern à risque (`initial` avec `x`/`y` non nul sur un élément `fixed` ou `sticky`) est
présent dans **plus de 20 fichiers** (`CommandPalette`, `QuickAddBar`, `InboxMenu`,
`SmartListMenu`, `ColorSettingsModal`…). Tous ne sont pas cassés — seuls le sont
ceux dont la **position finale** dépend du transform plutôt que du CSS.

**Correction** : la position finale doit venir du CSS (`bottom-[…]`), l'animation ne doit porter
que sur l'opacité — ou déclarer le décalage d'entrée dans une variante neutralisée par
`useReducedMotion()`. **Règle** : ne jamais faire dépendre une position d'arrivée d'une animation
de transform.

### 🟠 2. Le design system mobile · adopté à moitié (remesuré le 2026-08-25)

> ### ✅ La migration a repris, et elle a révélé que `MobileHeader` était cassé
>
> **Comptage au 2026-08-25**, après migration des six pages restantes :
>
> | Primitive | 08-14 | **08-25** |
> |---|---|---|
> | `MobileHeader` | 2 | **8** · `/dashboard`, `/habits`, `/okr`, `/statistics`, `/settings`, `/entreprise` + les deux d'origine |
> | `MobileScreen` | 0 | **0** |
> | `ListRow` | 0 | **0** |
> | `TouchTarget` | 2 | 2 |
> | `BottomSheet`, `Segmented`, `SectionHeader` | 2 chacun | inchangés |
>
> 🔴 **Et `MobileHeader` n'avait JAMAIS fonctionné.** Il écoutait `window.scroll`, alors que
> `Layout.tsx` place tout le contenu dans un `<main class="flex-1 overflow-auto">` : c'est LUI qui
> scrolle, et l'événement `scroll` d'un conteneur **ne remonte pas** jusqu'à `window`. Mesuré sur
> `/tasks` avant correctif : après 500 px de scroll, `window.scrollY` valait **0**, le titre
> restait à 28 px, le fond du header restait transparent. Le composant créé pour porter la
> compaction au scroll ne l'a jamais portée, sur la seule page qui l'utilisait. Il remonte
> désormais les ancêtres jusqu'au premier conteneur réellement scrollable, avec repli sur
> `window` pour les pages hors `Layout`.
>
> **C'est l'argument le plus fort de cet audit contre le code sans consommateur** : deux
> consommateurs, c'est assez pour croire qu'une brique marche, et pas assez pour s'en apercevoir
> quand elle ne marche pas. Cf. [`ARCHITECTURE.md`](../ARCHITECTURE.md) §4.
>
> **Adhérence typographique, remesurée** : **243 usages de l'échelle fermée contre 1 684 de
> Tailwind brut**, soit **13 %** (contre 10 % au 08-14). La proportion monte, le **stock aussi**
> (1 487 → 1 684). Migrer les titres de page a traité le cas le plus visible, pas le plus
> volumineux : le mode entreprise, qui n'a jamais été migré, continue de contourner l'échelle
> badge par badge, c'est ce que la garde `design-system.guard.test.ts` attrape à répétition
> (cf. [`TESTING.md`](../TESTING.md)).

### Le diagnostic d'origine (2026-08-14)

Les primitives de `src/components/mobile/` ont été créées en juillet 2026 pour unifier le rendu
mobile. Comptage au 2026-08-14 :

| Primitive | Consommateurs |
|---|---|
| `MobileHeader` | 2 (`TasksHeader`, `TasksInboxMenu`) |
| `TouchTarget` | 2 (les mêmes) |
| `BottomSheet` | 2 (`PremiumPage`, `WeeklyRecapSheet`) |
| `Segmented` | 2 (`MobileAgenda`, `ThemeToggle`) |
| `SectionHeader` | 2 (`primitives.tsx`, `GuidePage`) |
| `MobileScreen` | **0** |
| `ListRow` | **0** |

Et sur l'échelle typographique fermée (`text-display/title/headline/body/label/caption`) :
**169 usages contre 1 487 usages de Tailwind brut** (`text-xs` → `text-5xl`), soit **10 %
d'adhérence**.

La migration s'était volontairement limitée à la page Tâches, en vitrine. Elle ne s'est jamais
poursuivie, et deux primitives n'ont jamais servi. Résultat : il n'y a pas un langage visuel
mobile mais **deux** — la page Tâches, et tout le reste. C'est la cause structurelle du finding
« quatre tailles de titre » relevé dans [`UI-PATTERNS.md`](../UI-PATTERNS.md).

**Correction** : soit finir la migration page par page, soit supprimer `MobileScreen` et `ListRow`
et assumer que les primitives ne couvrent que Tâches. L'état intermédiaire actuel est le pire des
trois : il coûte de la maintenance sans rendre de cohérence.

> ✅ **Tranché le 2026-09-05 (C-10) : la seconde branche.** `MobileScreen` et `ListRow` sont
> supprimés. Les mesures ci-dessus restent celles de leur date — c'est leur intérêt — mais l'état
> courant est celui-ci. Ce qui a emporté la décision n'est pas le poids du code (163 lignes) :
> c'est qu'une primitive que rien ne contraint ne peut pas être jugée. Elles se réécriront contre
> un écran le jour où un écran les demande.

### 🟠 3. Onze bottom-sheets réimplémentés à la main, et cinq mentent sur leur geste

`docs/MOBILE.md` (plus bas) présente `BottomSheet` comme « réutilisée telle quelle par toute
nouvelle feuille modale » et documente **une** exception (`AdModal`, supprimée depuis par C-04).
La réalité mesurée :
**11 feuilles réimplémentent le pattern à la main** contre 2 qui utilisent la primitive.

Pire que la duplication, leur comportement diverge :

| | Poignée de glissement | Glisser-pour-fermer |
|---|---|---|
| `ColorSettingsModal`, `HabitModal`, `MobileMoreSheet`, `PremiumGateModal` | ✅ | ✅ |
| `CreateTeamModal`, `NewTeamProjectModal`, `RecurrenceDaysModal`, `TeamTaskModal`, `DeleteObjectiveConfirm` | ✅ | ❌ |
| `LoginModal` | ❌ | ✅ |
| `ShareInviteClaimer` | ❌ | ❌ |

**Cinq feuilles affichent une poignée de glissement qui ne fait rien** — une affordance qui promet
un geste inexistant, ce qui est moins bon que de ne rien afficher. Une en a le geste sans le
signaler. Les trois modales du mode entreprise sont toutes dans le groupe « poignée sans geste ».

**Correction, partielle au 2026-08-24.** `useSheetDrag()` (`mobile-motion.ts`) porte désormais le
geste — mêmes valeurs que `BottomSheet` (80 px de course ou 500 px/s), pour que toutes les feuilles
se ferment au même geste. Il est câblé sur les deux feuilles qui mentaient ET qui utilisaient déjà
Framer : `RecurrenceDaysModal` et `DeleteObjectiveConfirm`.

**Les trois dernières, tranchées le 2026-08-24 : poignée RETIRÉE.**

`CreateTeamModal`, `NewTeamProjectModal` et `TeamTaskModal` n'utilisent pas Framer : ce sont des
`DialogContent` Radix en variante bottom-sheet, avec une poignée purement décorative. Deux
options existaient, et ce n'est pas la difficulté technique qui a tranché.

| Option | Coût | Pourquoi elle n'a pas été retenue |
|---|---|---|
| Ajouter le geste | Introduire du drag Framer dans un dialogue Radix sans casser le piège de focus, `aria-modal` ni la fermeture par Échap | **Ces trois feuilles sont des FORMULAIRES.** Un glissement accidentel sur une saisie à moitié remplie la perd. Les quatre feuilles qui ont le geste (`ColorSettingsModal`, `HabitModal`, `MobileMoreSheet`, `PremiumGateModal`) sont des menus et des sélecteurs : il n'y a rien à y perdre |
| **Retirer la poignée** ✅ | 5 min | Retenue. La feuille se ferme par la croix et par un tap sur le voile, comme avant. Elle arrête simplement de promettre un geste qui n'existe pas |

> ⚠️ **Ne pas la remettre « pour faire natif ».** Une affordance qui ment coûte plus cher que pas
> d'affordance : l'utilisateur tire, rien ne bouge, il en conclut que l'app est cassée. Sans la
> barre, il cherche la croix et la trouve. Si le geste est ajouté un jour, il devra venir AVEC
> une garde contre la perte de saisie (confirmation si le formulaire est sale).

### ✅ Vérifié sain

- **Zones sûres** : 9 pages réservent `env(safe-area-inset-bottom)`. L'absence sur `/agenda` est
  **intentionnelle et commentée dans le code** (le conteneur `flex-1` s'arrête déjà au-dessus de
  la tab bar ; l'ancien `pb-64px` volait 64 px à la grille pour rien).
- **Fond des feuilles** : `backdrop-blur` présent sur les 11, cohérent.
- **Tokens de thème** : aucune couleur Tailwind en dur dans l'app (cf. `UI-PATTERNS.md`).
- **Débordement horizontal** : zéro sur les 8 routes testées en 375 px.


> **Aucun bug mobile ouvert connu au 2026-08-14.** L'ancien fichier `a-faire.md` listait 5 points :
> 4 sont corrigés, le 5ᵉ est une limitation plateforme (pas de `navigator.vibrate()` sur Safari iOS —
> le code garde un `if (navigator.vibrate)`, no-op propre sur iOS). Les leçons de test tactile qui en
> sont issues vivent désormais dans [`TESTING.md`](../TESTING.md) (§Playwright E2E).

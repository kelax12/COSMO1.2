# Mobile-first — patterns et conventions

## Note mobile / DA : 62 → 72 → 74 → **76 / 100** (2026-08-24 → 2026-08-25 → 2026-08-27 → 2026-08-29) · inchangée au 2026-09-03

> ### 2026-09-03 · note inchangée, et rien de mobile n'a été mesuré
>
> Les 71 commits des 08-30 au 09-03 touchent le socle, la CI, la sécurité et la landing desktop.
> Trois choses seulement concernent cette note, et aucune ne rapporte de point :
>
> - **Les deux `input[type=date]` natifs qui restent sont ASSUMÉS**, et ce sont des champs mobiles :
>   ceux d'`EventModalForm` (desktop en `md:hidden`, plus l'overlay mobile). Le calendrier COSMO a
>   remplacé le picker natif sur les six surfaces où il était visible, mais **pas** sur téléphone :
>   la roue système vaut mieux que n'importe quel calendrier maison. C'est un arbitrage écrit, pas
>   un oubli, cf. [`UI-PATTERNS.md`](./UI-PATTERNS.md) ;
> - `FirstRunSetup` est monté dans `Layout`, donc il s'affiche aussi sur mobile. **Son rendu
>   téléphone n'a pas été vérifié écran par écran** ;
> - l'entrée du hero de la landing est passée en CSS. Le gain mesuré (deux secondes d'écran blanc à
>   4× de bridage CPU) profite d'abord aux appareils lents, donc aux mobiles, mais il a été mesuré
>   **au bureau, avec un bridage simulé**, jamais sur un vrai téléphone.
>
> ⚠️ **Ni l'adhérence à l'échelle typographique fermée, ni les libellés sous le plancher de 11 px,
> ni les cibles tactiles n'ont été recomptés** depuis le 2026-08-27. Les lignes correspondantes du
> tableau ci-dessous portent donc toujours leur date d'origine.

> ### 2026-08-29 · +2, sept onglets qui tenaient dans 335 px visibles
>
> Mesuré à 375 px : le rail de l'espace entreprise fait **832 px pour 335 visibles**, soit quatre
> destinations sur sept hors champ, dans un conteneur `hide-scrollbar`, donc sans barre de
> défilement ni le moindre indice qu'il y a autre chose.
>
> Le défaut qui comptait n'était pas le confort : ouvrir un lien profond `?tab=members` laissait
> l'onglet **actif** hors de l'écran. L'utilisateur voyait le contenu de Membres avec « Aperçu »
> comme seul onglet visible, sans pouvoir dire où il se trouvait.
>
> `OrgTabsBar` ramène l'onglet actif dans le champ et pose des dégradés de continuation. Deux
> mesures ont été nécessaires pour le faire tenir : la `ResizeObserver` observe le conteneur **et**
> le rail, parce que la boîte du conteneur ne bouge pas quand son contenu s'élargit (l'arrivée
> d'une pastille de compteur décalait l'onglet actif de 27 px hors champ, ce qui se lisait comme
> de la flakiness) ; et le premier positionnement est **instantané**, parce qu'un
> `behavior: smooth` est annulable et s'arrête en chemin.
>
> Vérifié dans le navigateur et par deux tests Playwright, **avec témoin** : les deux échouent
> contre l'ancienne barre.

| Ce qui compose la note | 08-24 | 08-25 | **08-27** |
|---|---|---|---|
| Feuilles cassées sous `prefers-reduced-motion` | 0 (corrigées le 24) | **0** | **0**, et pour la première fois **mesuré** sur 3 feuilles (cf. §1bis) |
| Consommateurs de `MobileHeader` | 2 sur 7 pages | **8** | 8, non remesuré |
| Pages avec un titre mobile hors échelle | 6 | **0** | 0 |
| Poignées de glissement qui ne font rien | 3 | **0** · retirées | 0 |
| Adhérence à l'échelle typographique fermée | 169 / 1 656 = **10 %** | 243 / 1 927 = **13 %** | **non remesurée** · le stock de tailles arbitraires passe de 202 à **196** |
| Libellés sous le plancher de 11 px | · | 79 | **75** |
| Niveau de navigation de l'espace entreprise | 3ᵉ (Plus → feuille → Entreprise) | 3ᵉ | ✅ **1ᵉʳ** · onglet de la barre du bas |
| Primitives à 0 consommateur | `MobileScreen`, `ListRow` | **inchangé** | ✅ **0** · supprimées le 2026-09-05 (C-10) |

### 2026-08-27 · +2, un point de navigation et une rétractation

> **Note inchangée à 74 après la rétractation du soir** (§1bis). Le +2 était porté par B2 et F3,
> deux points de navigation mesurés ; la « rechute » annoncée le matin n'a jamais existé. Une
> feuille qu'on croyait cassée puis qui ne l'est pas ne rend aucun point : elle en avait été
> retirée zéro, la ligne du tableau valant déjà 0.

**B2 · « Entreprise » entre dans la barre d'onglets, et REMPLACE « Habitudes ».** L'espace
collaboratif était au **troisième** niveau de navigation sur mobile (Plus → feuille →
Entreprise), alors que c'est la seule zone multi-utilisateurs du produit.

Le remplacement plutôt que l'ajout est **mesuré, pas supposé** : à 375 px la barre porte 5
éléments de **75 × 64 px**. Un sixième les ramène à ~62 px et tronque les libellés. « Habitudes »
est un module **optionnel** (`RequireModule`), donc déjà absent pour une partie des comptes, et il
reste listé dans « Plus » ; l'onglet n'apparaît que pour un membre d'une organisation.
Vérifié dans le navigateur sur le build de production, démo neuve : 5 éléments de 75 × 64.

**F3 · l'onglet ne change plus d'identité pendant le chargement** (commit `f32d080`). L'entrée
entreprise était montée sur `{myOrg && …}` : la barre du bas affichait « Habitudes » le temps de
la requête d'organisations, puis la remplaçait par « Entreprise ». *Un onglet qui change
d'identité pendant qu'on le vise est pire qu'un onglet qui manque*, et sur mobile la cible est
tactile, donc le doigt est déjà parti. Correctif : `ActiveOrgContext` expose `wasOrgMember`, lu
une fois au montage depuis la préférence d'organisation déjà persistée, et les deux barres
réservent la place tant que la requête vole.

> ⚠️ **Honnêteté sur la mesure de F3** : le décalage **n'est pas reproductible en mode démo**, le
> repository local lisant `localStorage` de façon synchrone. CLS mesuré à **0 avant comme après**,
> indice posé comme effacé : cela prouve l'absence de régression, **pas** la présence d'un gain.
> La preuve du correctif est dans les tests, qui exercent l'état transitoire directement
> (`ActiveOrgContext.test.tsx`, 5 cas, + 3 sur `MobileTabBar`), eux-mêmes vérifiés en neutralisant
> tour à tour la lecture puis l'écriture de l'indice. Aucun point n'est attribué pour un gain non
> mesuré.

### 1bis. La feuille « cassée » ne l'était pas · rétractation mesurée (2026-08-27, soir)

`LoginModal` écrivait son mouvement de feuille à la main (`initial={{ y: '100%', opacity: 0 }}`)
et est passé par `useSheetMotion()` (commit `a1debe3`). **La migration reste juste** : c'est la
convention du dossier, et un chemin par défaut vaut mieux que dix-sept variantes.

🔴 **En revanche la justification était fausse, et elle est rétractée ici.** Le commit affirmait
que « sous `prefers-reduced-motion` la valeur initiale reste appliquée et le modal s'ouvrait
entièrement hors écran ». Ce n'était pas une mesure, c'était une déduction depuis la règle.
L'expérience a été faite le soir même : `LoginModal` **remis dans sa forme exacte d'avant le
correctif**, puis ouvert sous `reducedMotion: 'reduce'` réellement émulé, dans un navigateur qui
composite. Résultat : **il s'ouvre normalement**, opacité 1, entièrement à l'écran.

La raison tient à la forme de l'`initial`, et c'est ce que le cliquet de
`src/design-system.guard.test.ts` disait déjà : un `initial` **mixte**, qui contient une clé
non-transform (`opacity`) à côté du `y`, se résout ; c'est l'`initial` **transform seul** de
`MobileMoreSheet` qui restait coincé le 2026-08-24. Les dix-sept feuilles écrites à la main sont
toutes mixtes.

> ⚠️ **Et une mesure de la même journée avait été fausse aussi, dans l'autre sens.** Une première
> tentative, faite dans un panneau navigateur **non affiché**, avait conclu que `HabitModal`
> s'ouvrait à `opacity: 0` et 379 px trop bas. C'était un artefact : dans un onglet
> `document.visibilityState === 'hidden'`, `requestAnimationFrame` ne tourne pas et **tout** reste
> sur `initial`, y compris le voile d'une feuille saine. Le harnais gelait la page et rendait un
> rapport parfaitement convaincant.
>
> Les deux erreurs de la journée, celle du commit et celle-ci, sont la même : **conclure sans
> témoin**. D'où la forme du test qui referme le sujet.

Au passage, la popup d'inscription **tient sans scroll** : largeur desktop 28rem → 33,6rem et
formulaire resserré. Mesuré dans le navigateur, viewport 1000 × 760, inscription, mot de passe
saisi : `scrollHeight` **699 → 675 = clientHeight**, le bouton « Se connecter » finit à 691 px
pour 760 px de hauteur. Mobile 375 × 812 : **694 = clientHeight**.

> ✅ **La ligne « 0 feuille cassée » cesse d'être une présomption** (2026-08-27, soir).
> `e2e/reduced-motion-sheets.spec.ts` ouvre des feuilles sous `reducedMotion: 'reduce'` réellement
> émulé et **mesure** l'état peint : opacité calculée, et hauteur effectivement dans le viewport.
> Ni `toBeVisible()` ni une garde statique ne voient ces deux défauts, l'un considérant visible un
> élément à `opacity: 0`, l'autre ne comptant que des chaînes dans des fichiers.
>
> Le fichier porte **deux protections contre lui-même**, parce que les deux erreurs de la journée
> venaient du harnais et pas du produit :
> 1. il refuse de tourner si la page se déclare `hidden` (l'artefact de l'onglet non composité) ;
> 2. il embarque un **témoin positif** ; si la feuille de contrôle ne s'ouvre pas non plus, le
>    verdict n'est pas « le produit est cassé » mais « le harnais ment », et le message le dit.
>
> ⚠️ **Périmètre honnête : 2 feuilles écrites à la main sur 16**, plus le témoin. `HabitModal` et
> `CompletedOKRsModal` s'ouvrent, mesurées. Les 14 autres partagent le même `initial` mixte au
> caractère près, ce qui rend leur bon fonctionnement très probable, **mais probable n'est pas
> mesuré** : les ajouter au fichier est la dette ouverte de ce point.

**+10, le deuxième plus gros mouvement.** Le finding structurel de cet audit, « le design system
mobile n'a jamais été adopté », a reculé pour la première fois depuis sa création en juillet :
six pages migrées, et surtout **le composant qui portait la migration s'est révélé cassé depuis le
début** (§2). Un mois de « il suffit de finir la migration » reposait sur une brique qui ne
fonctionnait pas.

**Ce qui plafonne la note :** l'adhérence typographique est passée de 10 % à 13 %, ce qui veut
dire que **1 684 usages de Tailwind brut subsistent**, le chiffre absolu a même augmenté. Migrer
les titres de page était le geste le plus visible, pas le plus large. Et il y a toujours deux
langages visuels mobiles, pas un.

---

## Audit mobile / direction artistique — 2026-08-14

**Méthode** : mesures DOM/CSS sur l'app en mode démo (viewport 375×812) + comptage statique de
l'adhérence au design system. Remplace les trois audits du 2026-07-25 archivés
([impeccable](./archive/AUDIT-IMPECCABLE-MOBILE-2026-07-25.md),
[design-skill](./archive/AUDIT-DESIGN-SKILL-MOBILE-2026-07-25.md),
[DA brief](./archive/MOBILE-DA-BRIEF.md)), 161 commits plus tôt.

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
> quand elle ne marche pas. Cf. [`ARCHITECTURE.md`](./ARCHITECTURE.md) §4.
>
> **Adhérence typographique, remesurée** : **243 usages de l'échelle fermée contre 1 684 de
> Tailwind brut**, soit **13 %** (contre 10 % au 08-14). La proportion monte, le **stock aussi**
> (1 487 → 1 684). Migrer les titres de page a traité le cas le plus visible, pas le plus
> volumineux : le mode entreprise, qui n'a jamais été migré, continue de contourner l'échelle
> badge par badge, c'est ce que la garde `design-system.guard.test.ts` attrape à répétition
> (cf. [`TESTING.md`](./TESTING.md)).

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
« quatre tailles de titre » relevé dans [`UI-PATTERNS.md`](./UI-PATTERNS.md).

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
> sont issues vivent désormais dans [`TESTING.md`](./TESTING.md) (§Playwright E2E).

## Breakpoint et hook

- Tailwind breakpoint mobile = `< md` (768 px). Le `sm` (640 px) sépare "petit mobile" et "grand mobile / phablette".
- Hook React : `useIsMobile()` depuis `@/lib/hooks/use-mobile` — boolean réactif basé sur `window.innerWidth < 768`. À utiliser quand une logique JS doit diverger mobile/desktop (ex. vue par défaut d'un calendrier). Préférer Tailwind responsive classes (`md:hidden`, `md:flex`) quand c'est purement visuel.
- Détection viewport en JS pur : `window.matchMedia('(min-width: 768px)')`.

## Layout shell mobile

- **`MobileTabBar`** (bottom tab bar, hauteur ~64 px) — visible sur mobile uniquement : `Accueil / Tâches / Agenda / Habitudes / Plus`.
- **Padding-bottom obligatoire** sur les pages : `pb-[calc(64px+env(safe-area-inset-bottom)+88px)] md:pb-8` (avec FAB) ou `+24px` (sans FAB). **Toutes les pages protégées doivent l'avoir** — sinon le dernier élément est caché derrière la tab bar.
- **`min-h-[100dvh]`** (jamais `min-h-screen`/`100vh`) sur les wrappers de page — sinon Safari iOS rogne le contenu.
- **FAB global** (`src/components/Layout.tsx`) : `fixed bottom-20 right-4 z-40 w-14 h-14 rounded-2xl`, unique bouton de création sur toutes les pages protégées. Il dispatch un `CustomEvent` différent selon la route : `open-task-create` sur `/tasks` (formulaire complet), `open-agenda-create` sur `/agenda` (modal d'ajout d'événement, écoutée par `AgendaPage` via `useEffect`), `open-quick-add` ailleurs (capture rapide). **Ne jamais** dupliquer un bouton "+" dans l'en-tête d'une page tant que le FAB peut couvrir le même besoin — cf. l'ancien bouton "+" de l'en-tête Agenda, retiré le 2026-07-23 au profit du FAB seul (évitait un doublon flottant au-dessus du calendrier).

## Design system mobile (2026-07-22, étendu 2026-07-23)

Le mobile n'avait aucun système : 10 tailles de texte arbitraires (`text-[8px]` → `text-[17px]`) en plus des 9 tailles Tailwind, 4 gouttières de page différentes, 9 rayons arbitraires, 176 boutons sous la cible tactile. Tout est désormais adossé à des **tokens**.

**Les 8 pages mobiles sont migrées** : Tâches (page vitrine, 3 passes), Réglages, OKR, Statistiques, Premium, Habitudes, Dashboard, Agenda. Voir `git log --oneline -- 'src/pages/*' 'src/components/mobile'` pour l'historique. Le budget d'arbitraire et le plancher 11px (`design-system.guard.test.ts`) sont passés de 294/143 à 204/85 sur cette dernière vague.

### Échelle typographique — FERMÉE à 6 crans

Tokens dans `src/index.css` (`:root`), exposés en utilitaires Tailwind (`tailwind.config.js`).

| Utilitaire | Token | Taille | Usage |
|---|---|---|---|
| `text-display` | `--t-display` | 28 px | Titre de page (`MobileHeader`) |
| `text-title` | `--t-title` | 22 px | Titre de section majeur |
| `text-headline` | `--t-headline` | 17 px | Titre de carte, header compacté |
| `text-body` | `--t-body` | 15 px | Texte courant, titre de ligne |
| `text-label` | `--t-label` | 13 px | Labels, boutons, chips |
| `text-caption` | `--t-caption` | 11 px | Meta, badges, labels de tab bar |

> **11 px est le plancher absolu.** Le test `src/design-system.guard.test.ts` échoue si une taille sous 11 px apparaît, et plafonne le stock de `text-[Npx]` restants (budget qui ne doit que baisser).

### Grille, rayons, cible tactile

| Utilitaire | Token | Valeur |
|---|---|---|
| `p-gutter` / `gap-gutter` | `--gutter` | 16 px — gouttière unique de toutes les pages |
| `gap-row` | `--gap-row` | 12 px — entre deux lignes de liste |
| `gap-section` | `--gap-section` | 28 px — entre deux sections |
| `rounded-row` / `rounded-card` / `rounded-sheet` | `--r-row` / `--r-card` / `--r-sheet` | 12 / 16 / 20 px |
| `min-h-touch` / `min-w-touch` | `--touch-min` | 44 px (WCAG 2.5.5) |

### ⚠️ tailwind-merge doit connaître ces tailles

`cn()` (`src/lib/utils.ts`) utilise `extendTailwindMerge` pour déclarer `text-display/title/headline/body/label/caption` dans le groupe `font-size`. **Sans cette config**, tailwind-merge les prend pour des couleurs de texte et les **supprime silencieusement** dès qu'une couleur suit dans le même `cn()` — symptôme constaté : les libellés de `MobileTabBar` retombés à 16 px, sans erreur. Toute nouvelle taille custom doit être ajoutée à cette liste.

### Primitives — `src/components/mobile/`

| Primitive | Rôle |
|---|---|
| `MobileHeader` | Grand titre qui se compacte au scroll (motif « large title » iOS) + slot actions |
| `SectionHeader` | Titre de section discret + compte + action |
| `Segmented` | Contrôle segmenté (pastille active animée via `layoutId`) |
| `TouchTarget` | Bouton-icône dont la zone tactile fait réellement 44×44 px |
| `BottomSheet` | Feuille bas-d'écran mobile / dialogue centré desktop (`sm:`), drag-to-dismiss, extrait de la modale de choix Premium — réutilisée telle quelle par toute nouvelle feuille modale à 2 choix ou plus |

> 🗑️ **`MobileScreen` et `ListRow` ont été supprimés le 2026-09-05** (C-10) : six semaines
> d'existence, zéro écran les montant. Ils sont restés dans cette table tout ce temps, et une
> table qui liste une primitive que rien n'utilise décrit une architecture qui n'existe pas.
>
> ❌ **Ne pas les recréer d'après cette note.** Si le besoin revient, ils se réécrivent CONTRE un
> écran réel : c'est la seule façon de savoir ce qu'ils doivent porter, et c'est précisément ce
> qui manquait à `MobileHeader` — utilisé par une page, et cassé pendant un mois sans que
> personne le voie.
| `mobile-motion.ts` | Courbes partagées (`SHEET_SPRING`…) + `haptic()` + `prefersReducedMotion()` |

Composer ces briques plutôt que redessiner. Tests : `src/components/mobile/mobile-primitives.test.tsx`.

> **Le pattern bottom-sheet existe aussi hors de `BottomSheet`** : le hook `useBottomSheet` (`src/hooks/use-bottom-sheet.ts`), avec drag-to-dismiss, est antérieur à la primitive partagée et sert encore quelques feuilles maison. Son premier porteur, `AdModal.tsx`, a été supprimé le 2026-09-04 avec le mur-pub (C-04). Ne pas fusionner les deux implémentations sans un passage dédié.

### Champs de saisie — 16 px obligatoire

`src/index.css` impose `font-size: 16px` à tous les champs texte sous 768 px. En dessous de 16 px, **iOS Safari zoome automatiquement** au focus et la page reste décalée. Ne pas rétablir un `text-xs` sur un input mobile.

### Listes bord à bord — `.card-plain-mobile`

Une liste mobile ne vit pas dans une carte : la carte ajoute une 2ᵉ gouttière et vole ~24 px de largeur utile par ligne. `.card-plain-mobile` (dans `src/index.css`) neutralise le chrome de `.card` sous 768 px ; au-delà, `.card` reprend à l'identique. Utilisé par `TasksPage`, `OKRCard`, et les 4 widgets Dashboard (`TodayTasks`, `TodayHabits`, `CollaborativeTasks`, `ActiveOKRs` + `DashboardCardSkeleton`).

**Piège `MobileCollapsible`** (`src/components/MobileCollapsible.tsx`, Dashboard uniquement) : le composant enveloppait chaque widget déplié dans un hack `[&>div]:rounded-t-none [&>div]:border-t-0` pour masquer la couture entre son en-tête (bg/bordure pleins) et la carte `.card` de l'enfant. Depuis que les 4 widgets utilisent `.card-plain-mobile` (transparents sous 768 px), il n'y a plus de couture à masquer — le hack a été retiré. **Ne pas le réintroduire** si un futur widget wrappé garde encore un fond/bordure plein sur mobile ; corriger plutôt le widget lui-même. La classe `.mobile-collapsible-body` reste nécessaire (elle masque le titre dupliqué du widget via `src/index.css`), seul le child-selector de couture a disparu.

### Exceptions documentées (densité / mimique volontaire — ne pas "corriger")

- **`HabitHeatmap`** (`src/pages/statistics/HabitHeatmap.tsx`) : labels de jour/mois à 8-9px dans des cellules de calendrier de 13-20px. Forcer 11px ferait déborder une grille de 26 semaines × 7 jours sur un écran de 393px. Densité de données assumée, pas une dette.
- **Toggle iOS** (`src/pages/SettingsPage.tsx`, rappel habitudes du soir) : `w-[51px] h-[31px]` mimant les proportions natives iOS. Seule occurrence dans l'app (pas de `Toggle` partagé créé pour un seul appelant).
- **Rayons de graphique** (`DashboardBarChart.tsx` barres/légende `rounded-[2px]`/`rounded-t-[3px]`, dormant derrière `SHOW_REPARTITION_CHART=false`) : accents décoratifs sub-pixel sur des barres fines, hors de l'échelle `rounded-row/card/sheet` qui vise les cartes/lignes, pas les micro-détails de chart.

### Thèmes

3 thèmes : `light`, `dark`, `black` (graphite + accent bleu). Résolution et application centralisées dans **`src/lib/theme.ts`** (`resolveInitialTheme` / `applyTheme`), consommées par `src/main.tsx` (avant le premier paint) ET `src/hooks/useDarkMode.ts`. **Sur mobile, un visiteur sans choix explicite démarre en `black`** ; un choix utilisateur reste toujours prioritaire. Les anciennes valeurs `midnight` / `monochrome` sont migrées vers `black`. Tests : `src/lib/theme.test.ts`.

### CSS injecté non-Tailwind — FullCalendar mobile

`src/pages/agenda/MobileAgenda.tsx` exporte `mobileCalendarStyles`, un bloc `<style>` brut injecté pour surcharger le CSS interne de FullCalendar (les classes `.fc-*` ne sont pas atteignables en Tailwind). Le garde-fou `design-system.guard.test.ts` ne voit **pas** ces occurrences (ce n'est pas la syntaxe `text-[Npx]`) — `font-size: 11px !important` sur `.fc-timegrid-slot-label` a été corrigé manuellement (était 10px). Si une autre valeur y est ajoutée, l'aligner à la main sur l'échelle mobile ; le garde-fou ne le fera pas pour vous.

### Tutoriels et rendus mobile/desktop séparés

Quand une page rend deux en-têtes (`md:hidden` + `hidden md:flex`), un même `data-tutorial-id` existe deux fois. `findTarget` (`src/components/tutorial/page-tutorial-helpers.ts`) renvoie le premier élément **visible** (rect non nul), pas le premier du DOM — sinon le spotlight vise la version masquée.

## Modals — pattern bottom-sheet

Tous les modals tâche (TaskModal, AddTaskForm, AddToListModal, EventModal, ColorSettingsModal, confirms de suppression) suivent ce pattern :

```tsx
<motion.div
  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
  className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
  onClick={onClose}
>
  <motion.div
    initial={{ y: '100%', opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    exit={{ y: '100%', opacity: 0 }}
    transition={{ type: 'spring', damping: 28, stiffness: 280 }}
    onClick={(e) => e.stopPropagation()}
    className="w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh]"
    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
  >
    <div className="sm:hidden flex justify-center pt-2 pb-1">
      <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
    </div>
    <div className="px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0">…</div>
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">…</div>
    <div className="px-4 pt-3 pb-3 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-2">…</div>
  </motion.div>
</motion.div>
```

Règles non négociables :
- ✅ ESC pour fermer + clic backdrop + verrouillage `body.overflow` quand ouvert
- ✅ Drag handle visuel sur mobile
- ✅ Sticky header + sticky footer ; le body scrolle seul
- ✅ Boutons footer empilés sur mobile (`flex-col-reverse`), inline sur desktop
- ✅ Touch targets ≥ 44×44 px (`min-w-11 min-h-11` ou icônes ≥ 22 px dans wrapper 11)
- ✅ `env(safe-area-inset-bottom)` partout
- ❌ Pas de modal centré avec marge sur mobile — toujours bottom-sheet

`TaskModal` et `AddTaskForm` sont **full-screen** sur mobile (override des classes shadcn Dialog avec `top-0 left-0 translate-x-0 translate-y-0 max-w-none w-full h-[100dvh] sm:rounded-2xl sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-2xl`). Utiliser `100dvh` plutôt que `100vh`.

> **Structure TaskModal** (refactor 2026-06-06) : le corps mobile full-screen est extrait dans `src/components/task-modal/` (`TaskModalMobileBody.tsx` + `primitives.tsx` pour `Cell`/`SectionCard`/… + `constants.ts` pour `PRIORITY_OPTIONS`/`priorityColor`). `TaskModalMobileBody` est **entièrement piloté par props** (`MobileBodyProps`) — il ne lit aucun état du parent par closure. Ne pas refusionner ces fichiers.

## TaskCard mobile (`src/components/TaskTable.tsx → TaskCard`)

Layout style "agenda" :
- Barre verticale colorée à gauche (`w-1` rounded, `self-stretch`) — rouge pour retard, jaune pour favori, sinon couleur de catégorie
- Checkbox de complétion **inline avec le titre**
- Titre tronqué + ligne meta `date · temps` en dessous
- Badge `P{priorité}` à droite
- **Pas de TaskCategoryIndicator** (carré coloré supprimé sur mobile)
- **Toutes les icônes d'action cachées par défaut** (Bookmark, UserPlus, Calendar, MoreHorizontal, Trash2). Révélation via :
  1. **Long press** (500 ms) — `navigator.vibrate(15)` si dispo
  2. **Swipe à gauche** > 80 px (Framer Motion `drag="x"`) → `setActionsVisible(true)`
- **Swipe à droite** > 80 px → bascule `completed` (haptique + handle dans `onDragEnd`)
- Le `<TaskCard>` est wrappé dans `md:hidden` ; la `<table>` desktop dans `hidden md:block`

## TaskFilter mobile (`src/components/TaskFilter.tsx`)

- Lien `+ d'options` (texte bleu, `md:hidden`) toggle `showQuickFilters` (Favoris/Terminées/Retard/Collaboration dans `<TaskTable>`).
- Sur desktop (`md:flex`), ces 4 boutons sont **toujours** visibles.
- Bouton "Filtres" caché sur mobile (`hidden sm:inline-flex`).
- Label de tri compacté : `<span className="hidden sm:inline">Trier par :</span><span className="sm:hidden">Tri :</span>`.

## DeadlineCalendar mobile (`src/components/DeadlineCalendar.tsx`)

- Mobile = vue **agenda** (liste verticale par jour) **uniquement**. Boutons Sem./Mois masqués (`hidden sm:flex`).
- Le toggle "Agenda" est masqué sur mobile (`hidden sm:inline-flex`).
- `useEffect` force `currentView = 'agenda'` quand `isMobile` devient true.
- Bouton "Aujourd'hui" pour retour rapide.

## Modules touchés par les conventions mobile

| Composant | Particularité mobile |
|---|---|
| `TasksPage.tsx` | H1 réduit (`text-lg sm:text-3xl`), Calendrier inline, padding-bottom safe-area |
| `TaskTable.tsx → TaskCard` | Voir section dédiée |
| `TaskFilter.tsx` | Voir section dédiée |
| `TaskModal.tsx` | Full-screen, single-column, Supprimer comme icône, pas de "Marquer complétée" |
| `AddTaskForm.tsx` | `h-[100dvh]` full-screen, sticky footer empilé |
| `DeadlineCalendar.tsx` | Vue agenda forcée |
| `AddToListModal.tsx`, `EventModal.tsx`, `ColorSettingsModal.tsx` | Bottom-sheet pattern |

## Drag-to-reorder — desktop only

Sur la barre de chips des listes (TasksPage), le drag-to-reorder Framer Motion est **désactivé sur mobile** :
```tsx
drag={isEditing || isMobile ? false : 'x'}
```
Raison : la barre a `overflow-x-auto`. Le drag horizontal capturerait le swipe de scroll → conflit. Même logique pour toute barre scrollable horizontale avec items draggables.

## iOS Safari — bug WebKit fetches parallèles (`src/main.tsx`)

iOS Safari WebKit a un bug documenté ([WebKit #171501](https://bugs.webkit.org/show_bug.cgi?id=171501), [supabase-js #684](https://github.com/supabase/supabase-js/issues/684)) : quand une page charge et lance **plusieurs fetches cross-origin en parallèle** avant que la connexion HTTP/2 soit stabilisée, le navigateur accepte le 1er stream mais **rejette silencieusement les suivants** avec `TypeError: Load failed` / DOMException.

**Symptômes** : page `/tasks` ou `/habits` plante après ~8 s sur iOS Safari uniquement, "Impossible de charger les tâches", **aucune requête Supabase visible** dans Network. Ne se reproduit **que** la première fois (connexion HTTP/2 ensuite en keep-alive).

**Fix obligatoire** dans `src/main.tsx`, **avant `createRoot()`** :

```ts
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
if (supabaseUrl) {
  const preconnect = document.createElement('link');
  preconnect.rel = 'preconnect';
  preconnect.href = supabaseUrl;
  preconnect.crossOrigin = 'anonymous';
  document.head.appendChild(preconnect);

  fetch(`${supabaseUrl}/auth/v1/health`, { method: 'GET', mode: 'cors', credentials: 'omit' }).catch(() => {});
  fetch(`${supabaseUrl}/rest/v1/`,        { method: 'GET', mode: 'cors', credentials: 'omit' }).catch(() => {});
}
```

⚠️ **Règles non négociables** :
- ✅ Garder **les deux** warmup fetches — un seul n'amorce qu'un seul pool de streams
- ✅ Garder le `.catch(() => {})` — la requête peut échouer (401, CORS), peu importe
- ✅ Tester sur un vrai iPhone (Eruda console + `?debug=1`)
- ❌ **Ne JAMAIS** retirer ces fetches — la régression est invisible en CI/dev/desktop
- ❌ Remplacer par `<link rel="preconnect">` seul — ne committe pas de stream HTTP
- ❌ Centraliser les premières requêtes dans un seul fetch — le bug reviendra dès qu'une autre fetch sera ajoutée

**Cache localStorage complémentaire** : `src/modules/auth/AuthContext.tsx` persiste `tasks` et `habits` (clés `cosmo:qcache:{userId}:{key}`, TTL 24 h, write-through via `queryCache.subscribe`). Cleaning : `clearLocalCache(userId)` sur logout et user-change.

**Skip retry sur timeout** : `src/App.tsx` retire le retry sur `timeout` / `aborted` / `Délai` — sinon worst-case 17 s avant erreur.

**Debug iOS sans Mac** : ajouter `?debug=1` → Eruda console flottante (CDN). Logs `[AUTH] @Xms` et `[FETCH→] /path`. Zéro overhead sans le query param.

## Tester le mobile

- DevTools responsive → **375 × 812**, **393 × 852**, **412 × 915**
- Touch targets : `document.querySelectorAll('button').forEach(b => { const r = b.getBoundingClientRect(); if (r.width < 44 || r.height < 44) console.warn(b); })`
- Mode démo : 100 tâches seedées sur 12 mois — stress-test du rendu

## Ne jamais faire (mobile)

- ❌ **Écrire `text-[Npx]` sur du mobile** — utiliser l'échelle à 6 crans (`design-system.guard.test.ts` bloque sous 11 px)
- ❌ **Ajouter une taille custom à `tailwind.config.js` sans l'ajouter aussi à `extendTailwindMerge`** dans `src/lib/utils.ts` — elle disparaîtra silencieusement du DOM
- ❌ **Oublier la réserve de bas de page** — une page mobile pose `px-gutter` et
  `pb-[calc(64px+env(safe-area-inset-bottom)+24px)]`, ou `+88px` si elle porte un FAB. Sans elle,
  le dernier élément passe sous la tab bar. ⚠️ `MobileScreen` portait ce calcul et a été supprimé
  le 2026-09-05 (C-10, zéro consommateur) : la règle est donc à appliquer à la main, comme le font
  déjà toutes les pages
- ❌ **Enfermer une liste mobile dans une `.card`** — utiliser `.card-plain-mobile`
- ❌ Mettre un input mobile sous 16 px (iOS zoome au focus)
- ❌ Redessiner un en-tête / une ligne / un contrôle segmenté au lieu de composer `src/components/mobile/`
- ❌ Modal centré sur mobile (toujours bottom-sheet)
- ❌ Touch target < 44 × 44 px (WCAG 2.5.5)
- ❌ Lire `window.innerWidth` en boucle dans le render — utiliser `useIsMobile()`
- ❌ `100vh` pour un modal full-screen (utiliser `100dvh`)
- ❌ Action (validation, suppression) accessible **que** par swipe — toujours un fallback visible
- ❌ Faire diverger mobile/desktop dans le même composant sans `md:hidden` / `md:flex` / `useIsMobile()`
- ❌ Modifier `<TaskCard>` (`md:hidden`) sans vérifier que la table desktop reste intacte (`hidden md:block`)
- ❌ Réintroduire `TaskCategoryIndicator` ou des icônes inline sur la TaskCard mobile
- ❌ Retirer le warmup `fetch()` iOS Safari, le cache `cosmo:qcache:*`, ou le skip-retry sur timeout
- ❌ Lancer > 5-6 requêtes Supabase en parallèle au mount sans tester sur vrai iPhone
- ❌ Activer un `Reorder.Group` / `drag` Framer Motion sur une barre `overflow-x-auto` mobile sans guard `drag={isMobile ? false : 'x'}`

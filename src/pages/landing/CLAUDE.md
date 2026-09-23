# Landing · règles du dossier

> Repris de `CLAUDE.md` le 2026-09-16, **sans une coupe**. Chargé automatiquement dès
> qu un fichier de ce dossier est touché. Règles transversales : [`CLAUDE.md`](../../../CLAUDE.md) à la racine.

---

### Landing — deux parcours exclusifs (2026-08-15)

La landing n'est plus une page linéaire. Après le header, un **aiguillage**
(`landing/LandingGateway`) fait choisir entre deux parcours **mutuellement exclusifs** :

| Parcours | Composant | Servi par | DA |
|---|---|---|---|
| perso | `landing/PersoTrack` | `/` | **blanc** (2026-09-22), encre `slate-900`, boutons `blue-600` ; accents bleu → violet → fuchsia |
| entreprise | `landing/entreprise/EnterpriseTrack` (lazy) | `/entreprise-presentation` | `#08090C`, cyan `#22D3EE`, or `#F5B942` |

- Le parcours affiché est **dérivé de l'URL**, pas d'un état local (`useLandingTrack`) : le
  bouton retour marche sans code de synchronisation. Les deux routes rendent le **même
  composant à la même profondeur**, donc basculer ne remonte pas la page.
- `TrackSwitcher` (header) et `TrackAnchors` (sommaire, par parcours) garantissent
  qu'on ne peut jamais rester coincé dans un parcours. Les listes d'ancres vivent dans
  `landing/anchors.ts` — une par track, pour qu'aucun lien ne vise une section absente.
- 🔴 **Le header est rendu par `LandingPage`, pas par les parcours** (2026-09-23). Le sommaire
  perso est DANS la rangée du header dès `lg`. Le sommaire entreprise n'y tient pas (7 ancres),
  il reste une capsule collée dessous, calée sur `--landing-header-h`, mesurée par
  `ResizeObserver`. ❌ Jamais de `top-[…]` en dur sous le header : le `4.5rem` d'avant
  passait 9,6 px sous l'îlot. ❌ Jamais de hauteur variable sur le header collant : il est
  dans le flux, donc tout changement de sa hauteur fait sauter la page au scroll.
  La rangée mobile du sélecteur est hors du header pour cette raison.
  ⚠️ Pastille active du sommaire : en `left`/`width`, mesurée par `offsetLeft` depuis le
  `<ul>`. Un `<li>` en `relative` ramène `offsetLeft` à 0.
  ⚠️ Le suivi de section (`use-active-anchor.ts`) tourne sur `requestAnimationFrame`, qui ne
  se déclenche pas dans un panneau de navigateur masqué : mesurer en Playwright headless.
- ❌ **Ne jamais ajouter une section entreprise dans `PersoTrack`** (ni l'inverse) : la
  séparation des deux parcours EST la structure de la page.
- 🔴 **Le parcours perso est BLANC depuis le 2026-09-22, et il ne doit plus dépendre de
  `--color-accent-solid`.** Ce token suit le thème du visiteur : en thème `noir` il vaut
  `#F0F0F0`, soit un bouton blanc sur une page blanche. Les surfaces perso écrivent donc
  `blue-600` / `blue-700` en clair. Deux corollaires : un accent de texte se pose en `-600`
  ou plus foncé (un `-400` ne passe pas 3:1 sur blanc, cf. `landing/data.ts`), et le squelette
  de `/` (`LandingSkeleton` dans `App.tsx`) est CLAIR — il est peint avant le chunk de la page,
  un squelette sombre rouvrirait les deux secondes d'écran noir que la refonte du 2026-08-30 a
  supprimées.
- 🔴 **Le mouvement du parcours perso se fait par le TRAIT, jamais par la lumière**
  (2026-09-22). Sur blanc, un faisceau translucide, un orbe flouté ou un halo n'émettent plus
  rien de visible — mais ils coûtent toujours, un flou se rastérisant à chaque frame qu'on le
  voie ou non. Les faisceaux du hero sont devenus des **traces d'encre** (`.hero-trace-h/v`),
  les orbes des **noeuds** qui respirent sur place (`.hero-node`), la lueur d'arrimage un
  **filet** qui se dessine (`.hero-dock-settle`), et le halo conique de la CTA finale **deux
  filets** révélés une fois (`.cta-rule`). Les quatre aurores sont FIXES : elles oscillaient
  entre 0,82 et 1 d'opacité sur des dégradés à `alpha 0.16` posés sur du blanc, soit sous le
  seuil de perception, en boucle permanente.
  ❌ **Ne jamais réintroduire un `filter: blur()` animé ici** : le halo de la CTA était la
  dernière survivance du motif retiré par l'audit A-8, et la DA blanche l'avait rendu presque
  invisible — il ne restait que la facture.
  ⚠️ **Un filet animé en `scaleX` ne se centre pas par `-translate-x-1/2`** : GSAP fige alors
  le centrage en pixels, et la ligne se décale au premier redimensionnement. `inset-x-0 mx-auto`.
  ⚠️ **Une opacité Tailwind n'existe qu'en multiples de 5** : `via-slate-900/16` ne produit
  AUCUN stop, et le dégradé perd son encre **sans erreur ni avertissement**. Mesuré en relisant
  le `background-image` calculé, pas en relisant le JSX.
  🔴 **La couche de fond du hero perso est en `z-0`, JAMAIS en `-z-10`.** Elle a porté
  `-z-10` depuis l'origine et n'a **jamais été visible** : un descendant en z négatif se peint
  avant le fond des blocs non positionnés, et le `<div>` racine du parcours porte un fond
  (`bg-white` aujourd'hui, un dégradé `slate-900` avant) sans créer de contexte d'empilement.
  Grille, aurores, bruit et traceurs étaient donc **rasterisés puis recouverts** — c'est le
  coût que l'audit A-8 mesurait sur des couches que personne ne voyait. Les alphas des quatre
  aurores ont été **divisés par deux** en même temps : réglés pour du `slate-900`, ils
  lavaient la page blanche en pastel.
  ⚠️ **Un effet de fond ne se vérifie pas en relisant sa couleur.** Celui-ci a été trouvé en
  forçant un traceur en rouge plein de 3 px : invisible. Et le forcer par `el.style` ne tient
  pas sur cette page — React réécrit la prop `style` à chaque rendu, et cette page en déclenche
  un toutes les 2,5 s. Seule une règle CSS `!important` survit (même piège que
  `scripts/landing-motion-probe.mjs`).
  Version « lumière » archivée intégralement :
  [`docs/archive/LANDING-MOTION-DA-SOMBRE-2026-09-22.md`](../../../docs/archive/LANDING-MOTION-DA-SOMBRE-2026-09-22.md).
- 🔴 **Les vitrines de `FeaturesSection` sont en CLAIR depuis le 2026-09-22**, sous
  `<ShowcaseTheme theme="light">` (`src/components/showcase/`). Elles étaient restées sombres
  « pour garder leur cadre » : sur la page blanche, c'étaient cinq trous noirs. Le cadre tient
  désormais par un filet `slate-900/10` et l'ombre portée.
  ⚠️ **Le SOMBRE reste la valeur par défaut, au pixel près** : `/guide` monte les mêmes vitrines
  sans fournisseur. Le JSX garde donc ses classes sombres, et `showcase-light.css` les re-teint
  une par une sous `[data-sc-theme="light"]` ; les valeurs passées en JS (`style`, Recharts,
  couleurs animées par Framer) lisent `useShowcasePalette()`.
  ❌ **Ne jamais re-teindre `.text-white` globalement** : du blanc sur un événement ou une coche
  d'accent doit rester blanc. L'encre à inverser porte en plus `sc-ink`.
  ⚠️ **Une classe sombre ajoutée à une vitrine sans sa règle claire reste noire, en silence.**
  Cliquet : `src/components/showcase/showcase-light.guard.test.ts`, vu rouge sur 3 sabotages.
  Il comparait d'abord par `includes()` et trouvait `.bg-slate-950` dans `.bg-slate-950\/40` :
  un cliquet qui compare par préfixe laisse passer exactement la classe qu'on vient d'ajouter.
- 🔴 **`TaskTableShowcase` suit `TaskTableDesktop` / `TaskRow`** : l'UI desktop change, la
  vitrine se refait (dans l'app, la priorité **1** est la plus urgente). ❌ Pas de `layout`
  Framer dans une maquette mise à l'échelle. ⚠️ Son bouton de pause vit hors de la maquette.
  Pourquoi : en-tête du composant.
- 🔴 **L'entrée du hero perso est en CSS, et elle doit le rester** (refonte du 2026-08-30).
  Mesuré à 4× de bridage CPU : la landing affichait **deux secondes d'écran blanc avec un
  spinner**, puis le hero apparaissait déjà fini. Le fallback de page était clair sur une page
  sombre, et toute la chorégraphie GSAP jouait derrière lui. Trois règles en sont sorties :
  **(1)** l'entrée du hero ne dépend ni de GSAP, ni du chunk de page, ni des fontes — elle est en
  keyframes CSS (`src/index.css`, section « Hero de la landing ») pilotées par `--d` / `--tx` ;
  **(2)** chaque règle n'a qu'un `from`, donc **l'état final est l'état par défaut** : une
  animation qui ne joue pas laisse le contenu visible ; **(3)** la route `/` a son propre
  squelette (`LandingSkeleton` dans `App.tsx`), jamais le `PageLoader` générique — il était
  sombre jusqu'à la refonte blanche, il est CLAIR depuis, cf. la règle de DA plus haut.
- ❌ **Ne jamais remettre `SplitText` sur le H1 du parcours perso.** Il imposait une re-découpe au
  chargement des fontes et une recopie des classes de gradient sur chaque mot, `bg-clip-text` ne
  survivant pas aux transforms des ENFANTS. Le titre est maintenant révélé ligne par ligne, le
  gradient et le transform portés par le **même** élément — le seul cas que `bg-clip-text`
  supporte. C'est ce qui a fait réapparaître le dégradé bleu → fuchsia, affiché en bleu plat
  depuis le passage à SplitText.
- 🔴 **Hero ENTREPRISE : un seul axe, celui de la lumière** (maquette 124, 2026-09-23). Titre,
  CTA et pile (`HeroStack`) centrés SOUS l'origine `top-center` du faisceau, la pile remonte
  vers elle. ❌ Pas de mise en page en deux colonnes sans déplacer l'origine ; le cyan n'a que deux
  rôles (lumière, CTA). La pile a sa pause (C-69). Pourquoi : en-tête d'`EnterpriseHero`.
- 🔴 **Le shader du hero ENTREPRISE (`LightRays`) se regle tout seul, et il ne doit jamais
  redevenir fixe** (C-68). Il descend d'un palier tant que la frame ne tient pas, et les rayons
  restent visibles dans tous les cas : c'est le mouvement qui se retire, jamais l'image.
  ❌ Ne jamais le remplacer par une detection de rasteriseur logiciel, ni faire repartir
  l'echelle de la pleine resolution. Mesure, chronologie et pourquoi de chaque palier :
  [`docs/PERFORMANCE.md`](../../../docs/PERFORMANCE.md) § Shader du hero ENTREPRISE.
- 🔴 **La vitrine du hero DOIT pouvoir être arrêtée** (C-69, WCAG 2.2.2, **niveau A**, fermé le
  2026-09-22). Depuis le hero centré, c'est **`HeroAppIcon`** qui porte le mécanisme : la tuile
  EST le bouton (96 px, bien au-delà des 44 px mesurés par `e2e/touch-targets.spec.ts`), avec les
  trois états `auto` / `pause` / `lecture` du module partagé `showcase/rotation-state.ts`. Elle
  suspend au survol ET au focus, et n'auto-démarre PAS sous `prefers-reduced-motion`.
  ❌ **Déplacer le mouvement d'un composant à l'autre n'annule pas le critère**, et sa taille n'y
  change rien : ce qui compte est qu'une information change seule, indéfiniment.
  ⚠️ **Le troisième état n'est pas un luxe** : sans lui, une personne en mouvement réduit verrait
  la fenêtre figée sur « Tâches » pour toujours, et le message du hero — quatre vues de la même
  app — ne tiendrait plus pour elle. WCAG 2.3.3 interdit le mouvement **non demandé**.
  ❌ **`aria-hidden="true"` ne dispense de rien** : le critère parle des gens qui ne peuvent pas
  lire une page pendant que quelque chose bouge à côté, pas des lecteurs d'écran. L'attribut vit
  donc sur le cadre décoratif, et le bouton de pause reste annoncé.
  ⚠️ **Le bouton fait 44 × 44 px RÉELS**, pas un débord de `tap-area` : `/` est mesurée par
  `e2e/touch-targets.spec.ts`. Règle : `rotation-state.ts` (module pur), témoin 13 cas.
- ⚠️ **`HeroModuleDock` n'est pas une décoration** : les quatre puces suivent le module affiché
  par `HeroAppIcon` (`onModuleChange`), et c'est ce qui fait comprendre que Tâches, Habitudes,
  Agenda et OKR sont quatre vues de la MÊME application. Sous `prefers-reduced-motion` elles sont
  déjà arrimées et libellées : **le sens survit à l'absence de mouvement**, c'est le critère qui a
  fait retenir cette idée plutôt qu'un effet.
- ⚠️ Les tarifs affichés viennent de `ENTERPRISE_PRICING_TIERS` — **jamais de montant en dur** :
  la landing et le produit doivent annoncer le même prix le jour de l'activation du paywall.
  Et le montant n'est **pas** animé par un compteur à ressort (il passerait par 48 € avant de
  se poser sur 50 €).
- **Offre de lancement (2026-08-24)** : `landing/entreprise/free-offer.ts` expose
  `ENTERPRISE_FREE_OFFER`, **dérivé de `ENTERPRISE_BILLING_ENFORCED`** — jamais une constante
  indépendante, sinon la landing et le produit peuvent diverger. Tant qu'il est vrai, la section
  tarifs affiche « Gratuit » à la place de chaque montant, le tarif d'après restant visible barré
  (« au lieu de 20 € / mois »), sous un badge « Offre de lancement ». Les textes payants ne sont
  pas remplacés : les variantes `promo*` / `*Free` **s'ajoutent** dans les catalogues, donc
  rebasculer le drapeau restitue la page d'origine mot pour mot.
- ⚠️ **Une page qui dit « gratuit » ne doit plus annoncer de plafond nulle part.** Quatre textes
  décrivaient une limite de sièges qui n'est plus appliquée (`hero.reassurance`,
  `pricing.ctaNote`, `cta.note`, `faq.a4`/`a5`) : tous ont leur variante d'offre. Toute nouvelle
  phrase qui promet « jusqu'à 5 membres » doit en avoir une aussi.

---


---

## GSAP : landing page UNIQUEMENT

```typescript
import { gsap, ScrollTrigger, SplitText, useGSAP } from '@/lib/gsap';  // ✅
import { gsap } from 'gsap';                                            // ❌ jamais
```

- **Point d'entrée unique** : `src/lib/gsap.ts` (registration des plugins + isolation du chunk
  `vendor-gsap`, chargé seulement par la LandingPage lazy).
- **Périmètre** : `src/pages/LandingPage.tsx`, `src/pages/landing/*`, `src/lib/hooks/use-magnetic.ts`.
  Le reste de l'app reste sur **Framer Motion**.
- Toute animation doit respecter `prefers-reduced-motion` (`gsap.matchMedia()` ou guard équivalent).


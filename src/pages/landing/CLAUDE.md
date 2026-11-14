# Landing · deux parcours, GSAP, shader

**Quand lire** : en touchant `src/pages/LandingPage.tsx`, `src/pages/landing/**`, `src/components/showcase/**`, `src/lib/gsap.ts`. Perf : [`docs/PERFORMANCE.md`](../../../docs/PERFORMANCE.md). **Fait foi** : le code.
Règles transversales : [`CLAUDE.md`](../../../CLAUDE.md).

## Deux parcours exclusifs

Après le header, `landing/LandingGateway` aiguille vers l'un des deux :

| Parcours | Composant | Servi par | DA |
|---|---|---|---|
| perso | `landing/PersoTrack` | `/` | blanc, encre `slate-900`, boutons `blue-600`, accents bleu, violet, fuchsia |
| entreprise | `landing/entreprise/EnterpriseTrack` (lazy) | `/entreprise-presentation` | `#08090C`, cyan `#22D3EE`, or `#F5B942` |

- ✅ Le parcours se dérive de l'URL (`useLandingTrack`), pas d'un état local. Les deux routes rendent le même composant à la même profondeur : basculer ne remonte pas la page.
- ✅ `TrackSwitcher` et `TrackAnchors` empêchent de rester coincé ; ancres dans `landing/anchors.ts`, une liste par parcours.
- ❌ Une section entreprise dans `PersoTrack` (ou l'inverse) : la séparation EST la structure.
- ❌ Un état périodique dans `PersoTrack` : la rotation de la tuile passe par `hero-module-actif.ts`, sinon tout le parcours se re-rend toutes les 2,6 s (TBT mobile).

## Header

- 🔴 Le header est rendu par `LandingPage`, pas par les parcours. Sommaire perso dans la rangée dès `lg` ; sommaire entreprise en capsule dessous, calée sur `--landing-header-h` (`ResizeObserver`).
- ❌ Un `top-[…]` en dur sous le header. ❌ Une hauteur variable sur le header collant (il est dans le flux : la page saute au scroll). La rangée mobile du sélecteur est hors du header pour cela.
- ⚠️ Pastille active du sommaire : `left`/`width` mesurés par `offsetLeft` depuis le `<ul>` ; un `<li>` en `relative` ramène `offsetLeft` à 0.
- ⚠️ `use-active-anchor.ts` tourne sur `requestAnimationFrame`, absent d'un panneau de navigateur masqué : mesurer en Playwright headless.

## DA perso : blanc, mouvement par le trait

- 🔴 Le parcours perso ne dépend plus de `--color-accent-solid` (il suit le thème du visiteur : `#F0F0F0` en `noir`, bouton blanc sur page blanche). Surfaces en `blue-600` / `blue-700` ; texte d'accent en `-600` ou plus foncé (un `-400` échoue 3:1 sur blanc, `landing/data.ts`).
- 🔴 `LandingSkeleton` (`App.tsx`, route `/`) est CLAIR : il est peint avant le chunk de la page.
- 🔴 Le mouvement se fait par le TRAIT, jamais par la lumière : traces d'encre (`.hero-trace-h/v`), noeuds (`.hero-node`), filet (`.hero-dock-settle`), deux filets (`.cta-rule`). Les quatre aurores sont FIXES. Un flou coûte à chaque frame, vu ou non.
- ❌ Un `filter: blur()` animé. Version « lumière » : [`docs/archive/LANDING-MOTION-DA-SOMBRE-2026-09-22.md`](../../../docs/archive/LANDING-MOTION-DA-SOMBRE-2026-09-22.md).
- ⚠️ Un filet animé en `scaleX` ne se centre pas par `-translate-x-1/2` (GSAP fige des pixels) : `inset-x-0 mx-auto`.
- ⚠️ Une opacité Tailwind n'existe qu'en multiples de 5 : `via-slate-900/16` ne produit AUCUN stop, sans erreur. Relire le `background-image` calculé.
- 🔴 La couche de fond du hero perso est en `z-0`, JAMAIS `-z-10` : un descendant en z négatif est peint avant le fond du `<div>` racine et disparaît, rasterisé pour rien. Alphas des aurores calés pour du blanc.
- ⚠️ Un effet de fond ne se vérifie pas en relisant sa couleur : forcer un traceur en rouge par règle CSS `!important` (React réécrit `style` à chaque rendu ; même piège que `scripts/landing-motion-probe.mjs`).
- 🔴 L'entrée du hero perso est en CSS (`src/index.css`, « Hero de la landing », keyframes pilotées par `--d` / `--tx`) : indépendante de GSAP, du chunk de page et des fontes. Chaque règle n'a qu'un `from` : l'état final est l'état par défaut. La route `/` a son squelette, jamais le `PageLoader` générique.
- ❌ `SplitText` sur le H1 perso : le titre est révélé ligne par ligne, gradient et transform portés par le MÊME élément (`bg-clip-text` ne survit pas aux transforms des enfants).

## Vitrines (`FeaturesSection`, `/guide`)

- 🔴 Vitrines en CLAIR sous `<ShowcaseTheme theme="light">` (`src/components/showcase/`). ⚠️ Le SOMBRE reste le défaut (`/guide` monte les vitrines sans fournisseur) : le JSX garde ses classes sombres, `showcase-light.css` les re-teint sous `[data-sc-theme="light"]`, les valeurs JS lisent `useShowcasePalette()`.
- ❌ Re-teindre `.text-white` globalement : l'encre à inverser porte `sc-ink`.
- ⚠️ Une classe sombre ajoutée sans sa règle claire reste noire en silence. Cliquet : `showcase-light.guard.test.ts` (comparer par classe exacte, jamais par préfixe).
- 🔴 `TaskTableShowcase` suit `TaskTableDesktop` / `TaskRow` (priorité **1** = la plus urgente). ❌ `layout` Framer dans une maquette mise à l'échelle. Son bouton de pause vit hors de la maquette.

## Hero entreprise

- 🔴 Un seul axe, celui de la lumière : titre, CTA et pile (`HeroStack`) centrés SOUS l'origine `top-center` du faisceau. ❌ Deux colonnes sans déplacer l'origine ; le cyan n'a que deux rôles (lumière, CTA). Raisons : en-tête d'`EnterpriseHero`.
- 🔴 Le shader `LightRays` se règle tout seul (C-68) : il descend d'un palier tant que la frame ne tient pas ; le mouvement se retire, jamais l'image. ❌ Le rendre fixe, le remplacer par une détection de rasteriseur logiciel, relancer l'échelle à pleine résolution. Mesures : `docs/PERFORMANCE.md` § Shader du hero ENTREPRISE.
- 🔴 La vitrine du hero s'arrête (C-69, WCAG 2.2.2, niveau A) : `HeroAppIcon` est le bouton (96 px, 44 px réels mesurés par `e2e/touch-targets.spec.ts`), trois états `auto` / `pause` / `lecture` de `showcase/rotation-state.ts` (module pur, 13 cas), suspend au survol ET au focus, ne démarre PAS sous `prefers-reduced-motion`.
- ❌ Déplacer le mouvement d'un composant à l'autre n'annule pas le critère. ❌ `aria-hidden` sur le bouton de pause : il vit sur le cadre décoratif.
- ⚠️ `HeroModuleDock` n'est pas décoratif : ses quatre puces suivent le module de `HeroAppIcon` (`onModuleChange`) et disent que Tâches, Habitudes, Agenda, OKR sont une seule application ; sous mouvement réduit elles sont déjà arrimées.

## Prix et offre

- ❌ Un montant en dur : `ENTERPRISE_PRICING_TIERS`. ❌ Un compteur à ressort sur un prix (il passerait par 48 € avant 50 €).
- 🔴 Prix masqués par `ENTERPRISE_PRICES_SHOWN` → [`src/modules/billing/CLAUDE.md`](../../modules/billing/CLAUDE.md).
- ✅ `landing/entreprise/free-offer.ts` : `ENTERPRISE_FREE_OFFER` est DÉRIVÉ de `ENTERPRISE_BILLING_ENFORCED`, jamais une constante indépendante. Les variantes `promo*` / `*Free` s'ajoutent aux catalogues : rebasculer le drapeau restitue la page d'origine.
- ⚠️ Une page qui dit « gratuit » n'annonce aucun plafond (`hero.reassurance`, `pricing.ctaNote`, `cta.note`, `faq.a4`/`a5`) ; toute phrase « jusqu'à 5 membres » a sa variante d'offre.

## GSAP

```typescript
import { gsap, ScrollTrigger, SplitText, useGSAP } from '@/lib/gsap';  // ✅
import { gsap } from 'gsap';                                            // ❌
```

- ✅ Point d'entrée unique `src/lib/gsap.ts` (plugins + chunk `vendor-gsap`). Périmètre : `src/pages/LandingPage.tsx`, `src/pages/landing/*`, `src/lib/hooks/use-magnetic.ts`. Le reste de l'app : Framer Motion.
- ✅ Toute animation respecte `prefers-reduced-motion` (`gsap.matchMedia()` ou équivalent).

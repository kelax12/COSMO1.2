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
- `TrackSwitcher` (header) et `TrackAnchors` (sommaire collant, par parcours) garantissent
  qu'on ne peut jamais rester coincé dans un parcours. Les listes d'ancres vivent dans
  `landing/anchors.ts` — une par track, pour qu'aucun lien ne vise une section absente.
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
- ⚠️ **Les `showcase/*` restent en sombre, exprès** : ce sont des captures du produit, encadrées
  sur la page blanche. Les recolorer en clair ferait disparaître leur cadre.
- 🔴 **L'entrée du hero perso est en CSS, et elle doit le rester** (refonte du 2026-08-30).
  Mesuré à 4× de bridage CPU : la landing affichait **deux secondes d'écran blanc avec un
  spinner**, puis le hero apparaissait déjà fini. Le fallback de page était clair sur une page
  sombre, et toute la chorégraphie GSAP jouait derrière lui. Trois règles en sont sorties :
  **(1)** l'entrée du hero ne dépend ni de GSAP, ni du chunk de page, ni des fontes — elle est en
  keyframes CSS (`src/index.css`, section « Hero de la landing ») pilotées par `--d` / `--tx` ;
  **(2)** chaque règle n'a qu'un `from`, donc **l'état final est l'état par défaut** : une
  animation qui ne joue pas laisse le contenu visible ; **(3)** la route `/` a son propre
  squelette sombre (`LandingSkeleton` dans `App.tsx`), jamais le `PageLoader` clair.
- ❌ **Ne jamais remettre `SplitText` sur le H1 du parcours perso.** Il imposait une re-découpe au
  chargement des fontes et une recopie des classes de gradient sur chaque mot, `bg-clip-text` ne
  survivant pas aux transforms des ENFANTS. Le titre est maintenant révélé ligne par ligne, le
  gradient et le transform portés par le **même** élément — le seul cas que `bg-clip-text`
  supporte. C'est ce qui a fait réapparaître le dégradé bleu → fuchsia, affiché en bleu plat
  depuis le passage à SplitText.
- 🔴 **Le shader du hero ENTREPRISE se règle tout seul, et il ne doit jamais redevenir fixe**
  (finding C-68, corrigé le 2026-09-05). `LightRays` peint le viewport entier dans un fragment
  shader à chaque frame, indéfiniment. Quand la machine ne tient pas la frame, les commandes
  s'empilent, le tampon se remplit, et **le fil principal BLOQUE** dans
  `CommandBufferProxyImpl::WaitForGetOffset` en attendant qu'il se vide. Mesuré sur le build de
  prod, rastérisation logicielle : **3 637 ms bloquées sur 4 000 au repos**, dont ~2 800 de pure
  attente. **Aucun de nos JavaScript ne tournait** — c'est pour ça que couper les flous, les 23
  `ScrollTrigger` et les 8 tweens infinis ne déplaçait pas la mesure d'un point, et pourquoi la
  cause a mis quatre jours à être nommée. Le composant mesure désormais la cadence qu'il obtient et
  le temps qu'il passe **dans** `render`, et descend d'un palier tant que ça ne tient pas :
  demi-résolution (le **départ**) → un huitième des pixels → 20 img/s → **gel**, la dernière frame
  restant affichée. **Les rayons restent visibles dans tous les cas** ; c'est le mouvement qui se
  retire, jamais l'image.
  ❌ **Ne jamais remplacer ça par une détection de rastériseur logiciel** (`SwiftShader`,
  `llvmpipe`) : ça verdit la sonde sans rien rendre à un téléphone d'entrée de gamme, qui a bien un
  GPU et n'en sature pas moins.
  ❌ **Ne jamais faire repartir l'échelle de la pleine résolution.** Descendre depuis le haut coûte
  la descente : mesuré, un résidu **stable** de 315 à 393 ms sur six passes, là où la même page
  sans canvas rendait 0 sur six. Ces frames-là tombent dans les premières secondes, le seul moment
  où quelqu'un regarde.
  ⚠️ **Une file qui sature n'a pas un coût progressif, elle a deux états.** C'est ce qui rendait la
  mesure BIMODALE, et aucune moyenne ne pouvait l'expliquer. Toute mesure de cette page se lit
  passe par passe, jamais en médiane.
- ⚠️ **`HeroModuleDock` n'est pas une décoration** : les quatre puces suivent la vue affichée par
  `AppWindowShowcase` (`onSlideChange`), et c'est ce qui fait comprendre que Tâches, Habitudes,
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


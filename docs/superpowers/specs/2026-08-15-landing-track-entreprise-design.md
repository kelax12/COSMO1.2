# Landing — track Entreprise (l'aiguillage)

**Date** : 2026-08-15 · **Statut** : validé, en implémentation

## Problème

Le mode entreprise est livré (organisations, pyramide managériale, équipes, projets, OKR
d'équipe, statistiques collectives) mais **la landing n'en dit pas un mot**. Or c'est là que se
fait la monétisation : le mode particulier est le produit d'appel, les paliers tarifaires
(`ENTERPRISE_PRICING_TIERS`, 0/20/50/100/200 €) portent sur l'organisation.

## Décision structurante : deux tracks exclusifs, pas une section de plus

Le contenu entreprise n'est **ni avant ni après** le contenu perso : la page se sépare en deux
parcours mutuellement exclusifs, choisis par le visiteur juste après le header.

```
┌──────────────────── header (sticky) ─────────────────────┐
│  logo      nav       [ Perso |▸Entreprise ]      CTA      │  ← switcher, visible après choix
└──────────────────────────────────────────────────────────┘
┌──────────────────── L'AIGUILLAGE (100dvh) ───────────────┐
│   POUR MOI            │            POUR MON ORGANISATION │
│   cosmique bleu       │            graphite + cyan + or  │
│        (hover = 60/40, chaque moitié a son fond vivant)   │
└──────────────────────────────────────────────────────────┘
                     ↓ clic = masque plein écran
        track perso  XOR  track entreprise
```

**Ne pas perdre l'utilisateur** — trois garanties :

1. Le switcher segmenté reste collé dans le header une fois le choix fait ; il ne recharge pas
   la page, il rejoue une transition de masque.
2. Le choix est dans l'URL, donc partageable et réversible par le bouton retour.
3. L'aiguillage reste atteignable (retour en haut de page).

## URLs et SEO

| URL | Rend |
|---|---|
| `/` | aiguillage + track **perso** (SEO actuel strictement préservé) |
| `/entreprise-presentation` (slug localisé) | aiguillage + track **entreprise**, forcé |

La nouvelle route est ajoutée à `ROUTES` (`prerender.mjs`) et au sitemap. `en` est servie mais
reste hors `INDEXABLE_LOCALES` — règle inchangée, le corps est en français.

> Distinct de `/entreprise`, qui est l'**application** (protégée). La landing est publique.

## Direction artistique — la rupture est le message

| | Perso (inchangé) | Entreprise (nouveau) |
|---|---|---|
| Fond | `slate-900`, halos bleu→violet→fuchsia | `#08090C`, grille 1px visible |
| Accent | bleu → violet | **cyan `#22D3EE`** |
| Accent « argent » | — | **or `#F5B942`** (tarifs, CTA payants uniquement) |
| Formes | arrondis 2rem, glow généreux | angles nets, 1px, glow rare |
| Type | display, aéré | serré, tabulaire, éditorial |

Registre visé : Linear × Stripe × Palantir. Le visiteur doit *sentir* qu'il a changé de produit
sans avoir changé de site.

## Narratif — ce qu'on vend réellement

L'argument différenciant, vérifié dans le code : **la pyramide managériale est une primitive de
premier ordre**. Le périmètre de lecture de chacun (projets, OKR, statistiques) découle de la
hiérarchie réelle, pas d'un partage manuel. Corollaire d'adoption : chaque collaborateur garde
son COSMO personnel — ce n'est pas un outil de plus imposé, c'est celui qu'il utilise déjà.

Sections, dans l'ordre :

1. **Hero** — promesse + fond shader `LightRays`, CTA démo.
2. **Bandeau preuve** — compteurs (`CountUp`), pas de faux logos clients.
3. **La pyramide** — organigramme SVG qui se construit au scroll (tracé des liens puis nœuds
   staggerés), et périmètre managérial qui s'illumine au survol d'un nœud.
4. **Le cockpit** — section pinnée : les 6 onglets de l'espace entreprise défilent en scrub,
   chaque onglet affichant sa maquette (Aperçu, Pyramide, Projets, OKR, Stats, Membres).
5. **OKR en cascade** — objectif d'organisation → OKR d'équipe → KR, avec le journal
   append-only `kr_completions` comme preuve d'historique.
6. **Sécurité & cloisonnement** — RLS, périmètre managérial, RGPD, hébergement UE.
7. **Tarifs** — les 5 paliers de `ENTERPRISE_PRICING_TIERS`, pilotés par un curseur « combien
   êtes-vous ? » qui aimante le palier atteint. Palier recommandé cerclé (`ElectricBorder`).
8. **FAQ entreprise** puis **CTA final**.

Les tarifs affichés viennent de `ENTERPRISE_PRICING_TIERS` — **jamais de valeurs en dur** : le
paywall est dormant (`ENTERPRISE_BILLING_ENFORCED = false`), la landing et le produit doivent
annoncer le même prix le jour de l'activation.

## Contraintes techniques

- **Bundle** : nouvelle dépendance `ogl` seule (~25 kB gzip), chunk `vendor-ogl` dédié dans
  `manualChunks`, chargé uniquement par la landing. Pas de `three`, pas de `lenis` (le smooth
  scroll casse le pinning ScrollTrigger — cf. commentaire racine de `LandingPage`).
- **GSAP** : tout passe par `@/lib/gsap`. Les composants react-bits vendorisés dans
  `src/components/reactbits/` ont été patchés en ce sens ; `InertiaPlugin` ajouté au point
  d'enregistrement unique.
- **Reduced-motion** : chaque effet est gaté par `gsap.matchMedia()`. **Aucune position finale
  ne dépend d'un transform** — le garde-fou issu du bug `CookieBanner` s'applique intégralement
  à l'aiguillage, dont les deux panneaux sont positionnés en CSS.
- **i18n** : toute la copie sous `enterprise.*` dans `src/locales/{fr,en}/landing.json`.
  `npm run i18n:check` est bloquant en CI.
- **A11y** : l'aiguillage est deux `<button>` réels dans un `<nav>` étiqueté, navigables au
  clavier ; le switcher est un groupe de `role="tab"`. Les fonds animés sont `aria-hidden`.

## Hors périmètre

Activer le paywall, brancher Stripe récurrent, câbler `EnterprisePaywallPage` dans une route
applicative. La landing **annonce** les paliers ; elle ne les encaisse pas.

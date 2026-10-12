# Audit SEO, thecosmo.app (2026-10-09, mis à jour le 2026-10-12)

> **Historique de la note** · 2026-10-09 : **76** · après `69a972d0` (même jour) : **78** ·
> après `dc243383` (2026-10-12) : **81**. Chaque passe est déployée et vérifiée en production
> (curl sur le HTML servi, Lighthouse sur la prod), pas seulement commitée.

Outil : skill `seo-audit` (claude-seo v2.4.2), exécuté en local. Périmètre : les 40 URLs du
sitemap (20 FR + 20 EN), toutes en 200, plus robots.txt, redirections, 404 et rendu client.

⚠️ Limites : PageSpeed Insights refuse toujours (quota anonyme épuisé les 2026-10-09 et 10-12),
pas de données CrUX/GSC (aucune clé Google), pas de données backlinks (aucune clé Moz/Bing).
**La performance est désormais lue sur le Lighthouse mobile de la CI** (run `38151250177` du
2026-10-11), seule mesure fiable : `docs/PERFORMANCE.md` établit qu'un Lighthouse local sur ce
poste ne reproduit pas les écarts (charge machine). Mesuré localement le 10-12, l'accueil sortait
à 55 ; la CI dit 70.

## Note globale : 81 / 100

| Catégorie | Poids | 10-09 | après `69a972d0` | **10-12** |
|---|---|---|---|---|
| SEO technique | 22 % | 85 | 90 | **90** |
| Qualité du contenu | 23 % | 65 | 65 | **70** |
| On-page | 20 % | 85 | 87 | **92** |
| Schema / données structurées | 10 % | 75 | 75 | **77** |
| Performance | 10 % | 70 (estimée) | 70 (estimée) | **75 (mesurée, CI)** |
| Préparation recherche IA | 10 % | 75 | 75 | **75** |
| Images | 5 % | 70 | 70 | **88** |
| **Total pondéré** | | **76** | **78** | **81** |

Type détecté : SaaS B2C/B2B (productivité), bilingue fr/en.

**Lecture d'ensemble.** Tout ce qui se corrige dans le code est corrigé, sauf deux décisions
documentées (slugs anglais, statut 404) et la performance de la landing, chantier à part (T-51).
Ce qui retient la note se trouve hors du dépôt : auteur identifié, profils externes de la marque,
backlinks. La mesure GSC du 2026-08-19 (position 88, 0 clic hors marque) le disait déjà.

## SEO technique (90)

Ce qui marche
- robots.txt soigné, routes applicatives bloquées en fr et en, sitemap déclaré.
- `http://` et `www.` redirigent en 308 vers `https://thecosmo.app/`.
- Prérendu : le HTML serveur porte le texte complet (480 à 2 140 mots selon la page).
- TTFB 94 ms (cache Vercel HIT, région cdg1).

Constats
- ✅ **CORRIGÉ le 2026-10-09** : `app.html` sort en `noindex` sans canonical vers `/`.
  Reste le statut HTTP 200 des URL inconnues, limite SPA assumée dans `docs/SEO.md`.
- ⏸️ **[Bas] Variantes à slash final en 200** (`/guide/`, `/en`). Volontairement non traité :
  le canonical les couvre déjà, et `trailingSlash: false` dans `vercel.json` redirigerait aussi
  `/en/`, dont le canonical et le sitemap portent le slash. Gain nul, risque réel.

## Qualité du contenu (70, était 65)

Ce qui marche
- 11 articles de 780 à 2 180 mots, FAQ balisée sur 9, maillage interne dense (17 à 27 liens).
- ✅ **2026-10-12** : une capture produit légendée dans chacun des 11 articles, fr et en
  (22 figures). Deux captures neuves, agenda et OKR, pour les articles time-blocking et OKR.
  Légende honnête : « Capture du mode démo, données fictives ».
- ✅ **2026-10-12** : `/pour-managers` ne reprend plus l'intertitre de `/pour-equipes`. Les deux
  pages visaient déjà des intentions distinctes (productivité d'un manager vs gestion d'équipe
  en PME) ; le seul recouvrement réel était cet intertitre, en fr et en en.

Constats restants
- **[Élevé] Aucun auteur humain.** `BlogPosting.author` = Organization « Cosmo ». Bloqué sur une
  information d'Axel (nom affiché, bio, profil public) : rien ne s'invente ici.
- **[Bas] Captures en français dans les articles anglais.** L'interface filmée est en français ;
  la légende anglaise décrit l'écran. À refaire si l'anglais prend du trafic.
- **[Bas] Dates figées.** `dateModified` = `datePublished` sur plusieurs articles. Volontairement
  non bougé : ajouter une capture n'est pas une révision du texte.

## On-page (92, était 87)

Ce qui marche
- Titles 23 à 66 caractères, descriptions 113 à 160, aucune duplication sur 40 pages.
- ✅ **CORRIGÉ le 2026-10-12, trouvé par Lighthouse en prod** : `/entreprise-presentation` (et
  `/en/for-companies`) déclarait l'ACCUEIL comme canonical après exécution du JS. Le HTML prérendu
  était juste, puis `LandingPage`, qui sert les deux parcours, réécrivait titre, description et
  canonical avec ceux de la racine. Google rend le JS : la page qui porte l'offre payante se
  déclarait doublon de l'accueil. SEO Lighthouse 92 → **100**. Témoin : `src/lib/useSeoMeta.test.ts`.
- ✅ **CORRIGÉ le 2026-10-12** : lien « Learn more » du bandeau cookies (audit `link-text`),
  `/en/` à 92 en SEO dans la CI → **100** en prod. Devenu « Read our privacy policy » /
  « Lire notre politique de confidentialité ».
- ✅ 2026-10-09 : description de `/entreprise-presentation` 177 → 152, title `/en/about` 23 → 49.

Constat restant
- ⏸️ **[Moyen] Slugs français sur les articles anglais.** Décision contraire documentée dans
  `docs/I18N.md` : à rouvrir le jour où l'anglais a du trafic, au prix d'une table de 301.

## Schema (77, était 75)

- ✅ **2026-10-12** : `BlogPosting`, `TechArticle` (guide) et la liste `Blog` pointent chacun sur
  l'image de leur page, plus sur `og-card.png`.
- **[Moyen] `Organization.sameAs` vide.** Bloqué sur les URLs des profils de la marque.
- **[Bas] FAQPage** sans rich result depuis 2023 ; inoffensif, utile aux moteurs IA.
- **[Bas] Pas d'`aggregateRating`** : seulement avec de vrais avis vérifiables.

## Performance (75, mesurée)

Lighthouse **mobile de la CI**, run `38151250177` (2026-10-11), avant les correctifs du 10-12 qui
ne touchent pas au JS :

| Page | Perf | LCP | TBT |
|---|---|---|---|
| `/` | 70 | 3,3 s | 606 ms |
| `/en/` | 69 | 3,3 s | 652 ms |
| `/entreprise-presentation/` | 68 | 3,3 s | 693 ms |
| `/guide/` | 85 | 3,3 s | 140 ms |
| `/blog/`, articles, cas d'usage, `/a-propos/` | 86 à 87 | 3,3 s | 13 à 24 ms |

En desktop (même run) : 99-100 partout, une passe de l'accueil à 71 (TBT 678 ms).

- **[Moyen] La landing est la seule page lente**, par le travail que ses animations demandent au
  fil principal (GSAP, Framer Motion, shader), pas par son poids : le même `vendor-animation`
  coûte 40× moins sur `/guide/`. Suivi en **T-51** (`docs/ROADMAP-60J.md`), chantier de conception,
  hors de cette passe. Sentry, en tête du bootup local, est déjà chargé en différé : il porte le
  coût des rappels `requestAnimationFrame` qu'il instrumente, pas un coût propre.
- **[Bas] LCP mobile à 3,3 s partout**, landing comprise : plancher du bridage 4G, pas d'une page.

## Images (88, était 70)

- Alt text sur 100 % des images, dimensions déclarées, `loading="lazy"`, WebP.
- ✅ **2026-10-12 : une image Open Graph par page.** 39 cartes 1200×630 dans `public/og/`
  (~50 ko en JPEG), titre de la page incrusté, rendues par `scripts/capture-og-images.mjs` et
  commitées (le build Vercel n'a pas de navigateur). L'accueil FR garde `og-card.png`, dessinée à
  la main. Garde : `src/og-images.guard.test.ts`, vue rouge en retirant une image.
- ✅ 2026-10-12 : 22 captures dans les articles (cf. Contenu).

## Préparation recherche IA (75)

- `llms.txt` présent, robots.txt ouvert à tous les agents, contenu servi en HTML statique,
  FAQ structurées : bonne citabilité de passage.
- Faiblesse principale inchangée : signaux de marque externes (mentions, backlinks, `sameAs`)
  quasi nuls. Rien de ce qui la lève ne se trouve dans le dépôt.

## Hors périmètre SEO, vu au passage

- Lighthouse accessibilité à 97 sur les pages landing : `color-contrast` et
  `label-content-name-mismatch` en échec. Relève de `docs/ACCESSIBILITY.md`.
- `npm run i18n:pages -- --pages` échoue sur deux pluriels `_many` manquants en `fr`
  (`orgAdmin.customRoles.*`), travail en cours d'une autre session, non commité au 2026-10-12.

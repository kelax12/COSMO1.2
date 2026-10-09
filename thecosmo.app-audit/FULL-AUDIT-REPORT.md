# Audit SEO, thecosmo.app (2026-10-09, mis à jour après correctifs)

> **Mise à jour du même jour** : commit `69a972d0` déployé et vérifié en production (curl).
> Note **76 → 78**. Corrigés : soft-404 dans le HTML serveur, description de
> `/entreprise-presentation`, title de `/en/about`.

Outil : skill `seo-audit` (claude-seo v2.4.2), exécuté en local. Périmètre : les 40 URLs du
sitemap (20 FR + 20 EN), toutes en 200, plus robots.txt, redirections, 404 et rendu client.

⚠️ Limites : PageSpeed Insights a refusé (quota anonyme épuisé), pas de données CrUX/GSC
(aucune clé Google configurée), pas de données backlinks (aucune clé Moz/Bing). La performance
est mesurée en navigateur, sans throttling mobile.

## Note globale : 78 / 100 (76 avant correctifs)

| Catégorie | Poids | Note |
|---|---|---|
| SEO technique | 22 % | 90 (85) |
| Qualité du contenu | 23 % | 65 |
| On-page | 20 % | 87 (85) |
| Schema / données structurées | 10 % | 75 |
| Performance | 10 % | 70 (estimée) |
| Préparation recherche IA | 10 % | 75 |
| Images | 5 % | 70 |

Type détecté : SaaS B2C/B2B (productivité), bilingue fr/en.

**Lecture d'ensemble.** La base technique et on-page est très propre : aucun doublon de title ou
de description, une H1 par page, canonicals auto-référents, hreflang réciproques (fr-FR, en-US,
x-default), JSON-LD valide partout, HSTS preload, CSP stricte. Ce qui retient le site est ailleurs :
signaux d'autorité (E-E-A-T, entité, backlinks) et richesse des contenus. Ce constat rejoint la
mesure GSC du 2026-08-19 (position 88, 0 clic hors marque) : le levier n'est pas technique.

## SEO technique (90, était 85)

Ce qui marche
- robots.txt soigné, routes applicatives bloquées en fr et en, sitemap déclaré.
- `http://` et `www.` redirigent en 308 vers `https://thecosmo.app/`.
- Variantes `/guide/` et `/en` servies en 200 mais canonisées vers `/guide` et `/en/`.
- Prérendu : le HTML serveur porte le texte complet (480 à 2 140 mots selon la page).
- TTFB 94 ms (cache Vercel HIT, région cdg1).

Constats
- ✅ **CORRIGÉ le 2026-10-09** : `app.html` sort en `noindex` sans canonical vers `/`, vérifié
  en prod. Reste le statut HTTP 200 (limite SPA). Constat d'origine :
  **[Moyen] Soft 404.** `/page-inexistante-xyz` répond **HTTP 200**. Le HTML serveur porte
  `robots: index, follow` et un canonical vers `/` ; le `noindex` et le titre « Page introuvable »
  n'arrivent qu'après exécution JS. Google rend le JS donc l'effet est limité, mais Bing, les
  crawlers IA et les outils d'audit voient une page d'accueil dupliquée indexable.
  → Servir un vrai 404 (fonction Vercel ou `404.html` prérendu avec `noindex` dans le HTML).
- **[Bas] Variantes à slash final en 200.** `/guide/`, `/en` : couvertes par canonical, une
  redirection 308 serait plus nette (`trailingSlash` dans `vercel.json`).

## Qualité du contenu (65)

Ce qui marche
- 11 articles de blog de 750 à 2 140 mots, FAQ balisée sur 9 d'entre eux, maillage interne
  dense (17 à 27 liens internes par page), 4 pages persona (freelances, étudiants, managers, équipes).

Constats
- **[Élevé] Aucun auteur humain.** `BlogPosting.author` = Organization « Cosmo ». Aucune bio,
  aucune page auteur, aucune preuve d'expérience. Pour des sujets méthode (OKR, habitudes), c'est
  le premier manque E-E-A-T.
  → Page auteur (Axel, fondateur), `author: Person` avec `url` et `sameAs` (LinkedIn), encart
  auteur en bas d'article.
- **[Moyen] Articles sans aucune image.** 0 `<img>` dans les 22 pages d'articles. Pas de
  capture produit, pas de schéma, pas de visuel citable.
  → 1 à 3 visuels par article (captures COSMO annotées, schéma de la matrice Eisenhower, etc.).
- **[Moyen] Dates figées.** Plusieurs `dateModified` égales à `datePublished` (ex. 2026-08-12).
  → Mettre à jour au fil des révisions réelles, pas artificiellement.
- **[Bas] Pages persona courtes** (670 à 960 mots) et proches entre elles : risque de
  cannibalisation entre `/pour-managers` et `/pour-equipes`.

## On-page (87, était 85)

Ce qui marche
- Titles 23 à 66 caractères, descriptions 113 à 177, aucune duplication sur 40 pages.

Constats
- **[Moyen] Slugs français sur les articles anglais.** `/en/blog/gestion-du-temps-efficace`,
  `/en/blog/suivi-des-habitudes`, `/en/blog/combien-de-temps-prendre-habitude`… L'URL est un
  signal de pertinence et de clic pour une requête anglaise.
  → Slugs anglais (`/en/blog/time-management`, `/en/blog/habit-tracking`…) avec redirection 301
  depuis l'ancien slug, hreflang mis à jour. Les pages hors blog le font déjà (`for-companies`).
- ✅ **CORRIGÉ** : `/entreprise-presentation` 177 → 152 caractères. Constat d'origine :
  **[Bas] Descriptions longues** : `/entreprise-presentation` (177 caractères) dépasse 160,
  `/blog/cosmo-vs-todoist` est à 160 pile : risque de troncature.
- ✅ **CORRIGÉ** : title de `/en/about` 23 → 49 caractères.

## Schema (75)

Ce qui marche
- SoftwareApplication (offre à 0 €, captures, featureList), Organization, WebSite, BreadcrumbList,
  BlogPosting, FAQPage, TechArticle : valides et cohérents.

Constats
- **[Moyen] `Organization.sameAs` vide.** Aucun lien vers un profil externe (LinkedIn, GitHub,
  Product Hunt, X). Google ne peut pas rattacher l'entité « Cosmo » à autre chose que le site,
  alors que la marque est très concurrencée (11 marques COSMO actives).
- **[Bas] FAQPage** : n'ouvre plus de rich result pour un site non gouvernemental/santé depuis
  2023. Inoffensif, utile aux moteurs IA, ne pas en attendre d'affichage enrichi.
- **[Bas] Pas d'`aggregateRating`** sur SoftwareApplication : à ajouter seulement avec de vrais
  avis vérifiables, jamais inventés.

## Performance (70, estimée)

- Accueil : TTFB 94 ms, `load` 1,16 s, CLS 0,000 (mesure navigateur, réseau non bridé).
- **[Moyen] 41 fichiers JS, 516 Ko transférés sur la landing**, plus un appel Supabase et Sentry
  au chargement d'une page publique. Sur mobile 4G bridé, c'est le poste qui pèsera sur LCP/INP.
  → Vérifier avec PageSpeed (clé API ou demain, quota) ; viser moins de 200 Ko JS sur la landing,
  différer Supabase/Sentry tant que l'utilisateur n'est pas connecté.
- LCP/FCP non mesurés (onglet en arrière-plan) : à refaire via PSI.

## Images (70)

- Alt text présent sur 100 % des images (les 7 de la page entreprise compris), dimensions déclarées,
  `loading="lazy"`, WebP.
- **[Moyen] Une seule image OG pour les 40 pages** (`/og-card.png`). Un partage d'article montre
  la même vignette que l'accueil. → OG par article (titre incrusté), générable au build.

## Préparation recherche IA (75)

- `llms.txt` présent, robots.txt ouvert à tous les agents, contenu servi en HTML statique,
  FAQ structurées : bonne citabilité de passage.
- Faiblesse principale : signaux de marque externes (mentions, backlinks, `sameAs`) quasi nuls,
  donc peu de raison pour un moteur IA de citer Cosmo plutôt que Todoist ou Notion.

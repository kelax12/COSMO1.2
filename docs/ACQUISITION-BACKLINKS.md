# Backlinks — kit de soumission annuaires et places de marché

**Créé le 2026-08-19**, après lecture des données Search Console sur 3 mois.

> Ce document ne contient **aucune action que Claude puisse exécuter**. Tout ce qui suit
> demande un compte, un formulaire et une validation humaine. Le kit existe pour qu'Axel
> ne réécrive pas 14 fois la même description : elle est déjà écrite, il reste à coller.

---

## 1. Pourquoi ce chantier passe avant tout le reste

Mesuré dans Search Console, du 2026-05-18 au 2026-08-18 :

| Périmètre | Clics | Impressions | Position moyenne |
|---|---|---|---|
| Toutes requêtes | 17 | 328 | 15,5 |
| **Requêtes ne contenant pas « cosmo »** | **0** | **13** | **88,1** |

96 % des impressions et 100 % des clics viennent du mot « cosmo », qui est générique
(Cosmopolitan, cosmos) et ne nous appartient pas. Sur le contenu éditorial — 11 articles,
techniquement irréprochables, prérendus, balisés — la position réelle est **88, soit la
page 9**.

Le diagnostic est mécanique : la technique est propre (vérifié en prod le 2026-08-19 :
sitemap servi, `index, follow`, canonicals, JSON-LD complet), la profondeur éditoriale est
correcte, il ne reste qu'une variable non satisfaite — **l'autorité de domaine**. Un domaine
sans lien entrant ne se classe sur rien, quelle que soit la qualité de ses pages.

**Objectif : 20 domaines référents.** En dessous de ce seuil, aucun contenu ne remontera.
Au-dessus, les 11 articles déjà écrits remontent **sans qu'on y touche** : c'est le moment où
le travail éditorial déjà payé se met à rendre.

> ❌ **Ne pas écrire de nouvel article tant que ce seuil n'est pas approché.** Onze articles
> ont produit 13 impressions non-marque en trois mois ; le douzième en produira autant.

---

## 2. Blocs de copie prêts à coller

Coller **tel quel**. Une description réécrite à chaque site produit des fiches incohérentes,
et certains annuaires pénalisent le contenu dupliqué avec leur propre base — d'où les
plusieurs longueurs ci-dessous plutôt qu'une seule tronquée à la main.

### Identité

| Champ | Valeur |
|---|---|
| Nom | Cosmo |
| Nom long (si un mot seul est refusé) | Cosmo — Productivité |
| URL | `https://thecosmo.app` (jamais de `www.`, jamais de slash final ailleurs qu'à la racine) |
| Catégorie principale | Productivity / Task Management |
| Catégories secondaires | Habit Tracker · OKR & Goal Setting · Calendar |
| Année de lancement | 2026 |
| Pays | France |
| Modèle | Gratuit (offre entreprise payante à partir de 6 membres) |
| Plateformes | Web (application responsive, installable en PWA) |
| Langues | Français, anglais |
| Logo | `public/logo.png` (512×512) · `public/logo.svg` |
| Image sociale / bannière | `public/og-card.png` (1200×630) |
| Captures | `public/screenshots/dashboard.png` · `taches.png` · `habitudes.png` · dossier `entreprise/` pour les fiches B2B |

### Accroche — 60 caractères

> Tâches, habitudes, agenda et OKR dans une seule app gratuite.

*EN* : Tasks, habits, calendar and OKRs in one free app.

### Description courte — ~150 caractères

> Cosmo réunit tâches, habitudes, agenda et objectifs OKR dans une seule application
> gratuite. Démo instantanée, sans inscription, avec 12 mois de données.

*EN* : Cosmo brings tasks, habits, calendar and OKR goals together in one free app.
Instant demo, no sign-up, preloaded with 12 months of data.

### Description moyenne — ~300 caractères

> La plupart des gens organisent leur vie dans quatre outils : une todo-list, une app
> d'habitudes, un agenda et un tableur d'objectifs. Cosmo réunit les quatre. Les tâches se
> glissent dans l'agenda en time-blocking, les habitudes se suivent en heatmap, les OKR
> calculent leur progression seuls. Gratuit, en français, démo sans inscription.

*EN* : Most people run their life across four tools: a to-do list, a habit app, a calendar
and a spreadsheet of goals. Cosmo merges all four. Drag a task into the calendar to
time-block it, track habits on a heatmap, and let OKRs compute their own progress. Free,
instant demo, no sign-up.

### Description longue — ~600 caractères

> Cosmo est une application de productivité française et gratuite qui réunit quatre briques
> habituellement éclatées entre plusieurs outils : la gestion de tâches (priorités 1 à 5,
> catégories colorées, listes, récurrence), le suivi d'habitudes (heatmap sur 26 semaines,
> séries, taux de complétion), l'agenda (les tâches se glissent dans un créneau pour faire du
> time-blocking, l'événement reste lié à la tâche) et les OKR (progression calculée
> automatiquement à chaque mise à jour d'un résultat clé, historique des complétions).
>
> Une page Statistiques montre où part réellement le temps, par catégorie et par semaine. Le
> partage de tâches entre comptes est gratuit et sans limite.
>
> Un mode entreprise structure projets, OKR et statistiques d'équipe selon la pyramide
> managériale de l'organisation, chaque collaborateur conservant son espace personnel.
>
> La démo s'ouvre sans créer de compte, avec 12 mois de données réalistes.

### Points forts (bullets pour les fiches à puces)

- Quatre outils en un : tâches, habitudes, agenda, OKR — plus de recopie entre applications
- Time-blocking natif : glisser une tâche dans l'agenda crée l'événement, qui reste lié
- Suivi d'habitudes en heatmap 26 semaines, avec séries et taux de complétion
- OKR avec progression automatique et historique des résultats clés atteints
- Statistiques de temps investi par catégorie
- Partage de tâches gratuit et illimité
- Mode entreprise calqué sur l'organigramme réel
- Démo complète sans inscription ni carte bancaire
- Hébergement européen, conforme RGPD

### Tarifs (à recopier tel quel — source : `ENTERPRISE_PRICING_TIERS`)

| Offre | Prix |
|---|---|
| Particulier | Gratuit |
| Organisation, jusqu'à 5 membres | Gratuit |
| Organisation, 6 à 10 membres | 20 €/mois |
| Organisation, 11 à 20 membres | 50 €/mois |
| Organisation, 21 à 50 membres | 100 €/mois |
| Organisation, plus de 50 membres | 200 €/mois |

> ⚠️ **Ne jamais saisir un montant de mémoire.** Les tarifs vivent dans
> `src/modules/billing/premium-config.ts` et sont affichés par la landing. Une fiche annuaire
> qui annonce un autre prix que le site est un motif de rejet fréquent, et de réclamation
> légitime le jour où le paiement s'active.

### Audiences à cocher

Freelances · Étudiants · Managers · Petites équipes · TPE/PME · Particuliers

---

## 3. Où soumettre, dans quel ordre

Classé par rapport valeur / effort. Les deux premières colonnes se remplissent en une
session ; le reste s'étale.

| # | Site | Coût | Ce qu'il faut préparer | Note |
|---|---|---|---|---|
| 1 | **Appvizer** (FR) | Gratuit | Fiche longue, tarifs, 3 captures | Le plus fort en SEO français sur les requêtes « logiciel + métier ». À faire en premier. |
| 2 | **AlternativeTo** | Gratuit | Description moyenne, logo, alternatives déclarées (Todoist, Notion, TickTick) | Rapide, et alimente les requêtes « alternative à » que le blog vise déjà. |
| 3 | **SaaSHub** | Gratuit | Description moyenne, catégories | Quelques minutes. |
| 4 | **Capterra / GetApp / Software Advice** | Gratuit | Un seul dossier Gartner pour les trois, tarifs obligatoires, captures | Le plus long (validation manuelle, parfois un appel) mais trois domaines d'un coup. |
| 5 | **Product Hunt** | Gratuit | Voir §4 | Le pic de visibilité le plus fort ; ne se joue qu'une fois, donc à préparer. |
| 6 | **BetaList** | Gratuit | Description courte, capture | Accepte les produits jeunes ; complémentaire de Product Hunt. |
| 7 | **IndieHackers** | Gratuit | Un post honnête, pas une annonce | Le lien vaut par la discussion, pas par la fiche. |
| 8 | **Slant / Softpedia / Startupbase / annuaires FR de SaaS** | Gratuit | Description courte | Faible valeur unitaire, mais c'est le volume qui fait le seuil de 20. |

**Règles communes :**

- Toujours la même URL exacte : `https://thecosmo.app`. Une fiche qui pointe vers une
  variante (`www.`, `http://`, slash final) dilue le signal sur deux URL différentes.
- Ajouter `?ref=<nom-du-site>` **uniquement** sur les liens de fiche non canoniques (Product
  Hunt, posts de forum), jamais sur le lien principal d'un annuaire : le paramètre affaiblit
  la reconnaissance du lien vers la racine.
- Ne jamais accepter une offre « fiche premium payante » avant d'avoir mesuré ce que la
  fiche gratuite rapporte.
- Refuser les annuaires qui promettent « 200 backlinks » : ce sont des fermes de liens, et
  elles nuisent.

---

## 4. Préparer Product Hunt

C'est le seul de la liste qui ne se rattrape pas : un lancement raté ne se refait pas.

- **Titre** : Cosmo — l'accroche de 60 caractères ci-dessus.
- **Tagline** : reprendre la description courte.
- **Première image** : `public/og-card.png`.
- **Galerie** : `dashboard.png`, `taches.png`, `habitudes.png`, plus deux captures
  entreprise (`screenshots/entreprise/pyramide.webp`, `okr.webp`).
- **Commentaire du maker** : écrire le « pourquoi », pas la liste de fonctionnalités.
  L'argument qui porte est celui de la description moyenne : quatre outils réunis, et la
  friction de recopie qui disparaît.
- **Lien** : `https://thecosmo.app` — et vérifier ce jour-là que la démo sans inscription
  fonctionne, c'est ce que 90 % des visiteurs essaieront en premier.
- **Jour** : mardi ou mercredi, tôt le matin heure du Pacifique.

> ⚠️ Avant le lancement, vérifier que la landing charge vite sur mobile et que le parcours
> « démo sans inscription » n'a pas régressé. Un pic de trafic sur une démo cassée coûte
> plus qu'il ne rapporte.

---

## 5. Tableau de suivi (à remplir au fur et à mesure)

| Date | Site | Statut | URL de la fiche | Lien en `dofollow` ? |
|---|---|---|---|---|
| | Appvizer | | | |
| | AlternativeTo | | | |
| | SaaSHub | | | |
| | Capterra | | | |
| | GetApp | | | |
| | Software Advice | | | |
| | Product Hunt | | | |
| | BetaList | | | |
| | IndieHackers | | | |

**Vérifier l'effet, pas l'effort** : brancher Ahrefs Webmaster Tools (gratuit sur sa propre
propriété) et relever le nombre de domaines référents une fois par mois. C'est la seule
métrique qui compte pour ce chantier — pas le nombre de fiches soumises.

---

## 6. Ce qu'on saura quand le seuil sera franchi

Le premier signal ne sera pas des clics : ce sera **une page qui passe sous la position 30**
dans Search Console sur une requête non-marque. À ce moment-là, et pas avant :

1. reprendre la production éditoriale, sur de la longue traîne réellement atteignable ;
2. approfondir les articles les plus courts (`okr-vs-smart-vs-kpi` 663 mots,
   `glossaire-productivite` 681, `matrice-eisenhower` 747) ;
3. décliner les pages « alternative à X » sur le modèle de `cosmo-vs-todoist`.

Voir [`SEO.md`](./SEO.md) pour l'état technique et les règles permanentes.

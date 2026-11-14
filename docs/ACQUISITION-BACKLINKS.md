# Backlinks : kit de soumission

**Quand lire** : avant de soumettre une fiche annuaire ou de toucher `scripts/seo-signals.mjs` ou `scripts/check-acquisition.mjs`. **Fait foi** : le tableau des annuaires ci-dessous, lu par ces deux scripts. Aucune action ici n'est exécutable par un agent : chaque ligne demande un compte, un formulaire et une validation humaine d'Axel.

## Objectif

- 🔴 Le blocage SEO est l'autorité de domaine, pas la technique ni l'éditorial : sans lien entrant, aucune page ne se classe. Cible : 20 domaines référents.
- ❌ Ne pas écrire de nouvel article tant que la cible n'est pas approchée.
- ✅ Mesure : `npm run check:acquisition` (état des lignes) et `scripts/seo-signals.mjs` (chaque lundi, `seo-signals.yml`, relié à `ci-alert.yml`) ; série datée `docs/seo-signals-series.json`.
- ⚠️ `seo-signals` relit chaque ligne `fait` : la page source (première URL hors `thecosmo.app` de la colonne Note) doit répondre et contenir un lien vers `thecosmo.app`. Page disparue, lien retiré, `fait` sans page source ou lien `nofollow` = rouge. Elle ne voit pas une page rendue en JavaScript (à relire à la main) ni un backlink jamais déclaré ici.
- ⚠️ Domaines référents et liens entrants : API Bing Webmaster (`BING_WEBMASTER_API_KEY`, geste d'Axel) ; rouge si un domaine disparaît d'un point au suivant. Bing ne compte que ce qu'il a exploré : ce n'est pas l'autorité vue par Google.
- ⚠️ La garde exige une date sur `fait` et `refuse`, pas que l'état déclaré soit vrai.

## Blocs de copie

Coller tel quel : une description réécrite à chaque site produit des fiches incohérentes, et certains annuaires pénalisent le contenu dupliqué.

### Identité

| Champ | Valeur |
|---|---|
| Nom | Cosmo |
| Nom long (si un mot seul est refusé) | Cosmo : Productivité |
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

### Accroche : 60 caractères

> Tâches, habitudes, agenda et OKR dans une seule app gratuite.

*EN* : Tasks, habits, calendar and OKRs in one free app.

### Description courte : ~150 caractères

> Cosmo réunit tâches, habitudes, agenda et objectifs OKR dans une seule application
> gratuite. Démo instantanée, sans inscription, avec 12 mois de données.

*EN* : Cosmo brings tasks, habits, calendar and OKR goals together in one free app.
Instant demo, no sign-up, preloaded with 12 months of data.

### Description moyenne : ~300 caractères

> La plupart des gens organisent leur vie dans quatre outils : une todo-list, une app
> d'habitudes, un agenda et un tableur d'objectifs. Cosmo réunit les quatre. Les tâches se
> glissent dans l'agenda en time-blocking, les habitudes se suivent en heatmap, les OKR
> calculent leur progression seuls. Gratuit, en français, démo sans inscription.

*EN* : Most people run their life across four tools: a to-do list, a habit app, a calendar
and a spreadsheet of goals. Cosmo merges all four. Drag a task into the calendar to
time-block it, track habits on a heatmap, and let OKRs compute their own progress. Free,
instant demo, no sign-up.

### Description longue : ~600 caractères

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

- Quatre outils en un : tâches, habitudes, agenda, OKR, plus de recopie entre applications
- Time-blocking natif : glisser une tâche dans l'agenda crée l'événement, qui reste lié
- Suivi d'habitudes en heatmap 26 semaines, avec séries et taux de complétion
- OKR avec progression automatique et historique des résultats clés atteints
- Statistiques de temps investi par catégorie
- Partage de tâches gratuit et illimité
- Mode entreprise calqué sur l'organigramme réel
- Démo complète sans inscription ni carte bancaire
- Hébergement européen, conforme RGPD

### Tarifs

- 🔴 Ne jamais saisir un montant de mémoire : source `ENTERPRISE_PRICING_TIERS` dans `src/modules/billing/premium-config.ts`, affichée par la landing. Une fiche qui annonce un autre prix que le site est un motif de rejet et de réclamation. Particulier : gratuit ; organisation : gratuite jusqu'à 5 membres, puis par paliers.

### Audiences à cocher

Freelances · Étudiants · Managers · Petites équipes · TPE/PME · Particuliers

## Où soumettre

Classé par rapport valeur sur effort.

### Colonne « État »

Cinq états, et cinq seulement : `npm run check:acquisition` refuse une ligne qui n'en porte pas un, et refuse un `fait` ou un `refuse` sans date.

| État | Sens | Appelle |
|---|---|---|
| `a-faire` | Jamais tenté. | Y aller. |
| `en-cours` | Dossier déposé, en attente. | Attendre, relancer après trois semaines. |
| `fait` | Fiche en ligne. **Date obligatoire.** | Vérifier que le lien existe encore. |
| `refuse` | Refusé ou retiré. **Date obligatoire.** | Ne pas revenir sans raison neuve. |
| `abandonne` | Décision de ne pas y aller. **Raison obligatoire dans la note.** | Rien. |

❌ Ne jamais écrire `fait` sans date : c'est le même défaut qu'un ✅ sans date dans le tableau de `LEGAL.md`. Si une soumission a été faite sans être notée, la corriger ici avec sa date.

| # | Site | Coût | État | Fait le | Ce qu'il faut préparer | Note |
|---|---|---|---|---|---|---|
| 1 | **Appvizer** (FR) | Gratuit | `a-faire` | - | Fiche longue, tarifs, 3 captures | Le plus fort en SEO français sur les requêtes « logiciel + métier ». À faire en premier. |
| 2 | **AlternativeTo** | Gratuit | `a-faire` | - | Description moyenne, logo, alternatives déclarées (Todoist, Notion, TickTick) | Rapide, et alimente les requêtes « alternative à » que le blog vise déjà. |
| 3 | **SaaSHub** | Gratuit | `a-faire` | - | Description moyenne, catégories | Quelques minutes. |
| 4 | **Capterra / GetApp / Software Advice** | Gratuit | `a-faire` | - | Un seul dossier Gartner pour les trois, tarifs obligatoires, captures | Le plus long (validation manuelle, parfois un appel) mais trois domaines d'un coup. |
| 5 | **Product Hunt** | Gratuit | `a-faire` | - | Voir « Préparer Product Hunt » | Le pic de visibilité le plus fort ; ne se joue qu'une fois, donc à préparer. |
| 6 | **BetaList** | Gratuit | `a-faire` | - | Description courte, capture | Accepte les produits jeunes ; complémentaire de Product Hunt. |
| 7 | **IndieHackers** | Gratuit | `a-faire` | - | Un post honnête, pas une annonce | Le lien vaut par la discussion, pas par la fiche. |
| 8 | **Slant / Softpedia / Startupbase / annuaires FR de SaaS** | Gratuit | `a-faire` | - | Description courte | Faible valeur unitaire, mais c'est le volume qui fait le seuil de 20. |


Règles communes :

- ✅ Toujours l'URL exacte `https://thecosmo.app` : `www.`, `http://` ou slash final dilue le signal.
- ✅ `?ref=<nom-du-site>` seulement sur les liens de fiche non canoniques (Product Hunt, posts de forum), jamais sur le lien principal d'un annuaire.
- ❌ Ne jamais accepter une « fiche premium payante » avant d'avoir mesuré ce que rapporte la gratuite.
- ❌ Refuser les annuaires qui promettent « 200 backlinks » : fermes de liens, nuisibles.
- ✅ Relever les domaines référents une fois par mois (Ahrefs Webmaster Tools, gratuit sur sa propre propriété) : c'est la métrique du chantier, pas le nombre de fiches.

## Préparer Product Hunt

Un lancement raté ne se refait pas.

- Titre : l'accroche de 60 caractères. Tagline : la description courte. Première image : `public/og-card.png`.
- Galerie : `dashboard.png`, `taches.png`, `habitudes.png`, plus `screenshots/entreprise/pyramide.webp` et `okr.webp`.
- Commentaire du maker : le pourquoi (quatre outils réunis, fin de la recopie), pas la liste de fonctionnalités.
- Lien : `https://thecosmo.app`.
- Jour : mardi ou mercredi, tôt le matin heure du Pacifique.
- 🔴 La veille : vérifier que la landing charge vite sur mobile et que la démo sans inscription n'a pas régressé.

## Quand la cible est franchie

Signal : une page passe sous la position 30 dans Search Console sur une requête non-marque. Alors, et pas avant : reprendre la production éditoriale sur de la longue traîne atteignable, approfondir les articles les plus courts, décliner les pages « alternative à X » sur le modèle de `cosmo-vs-todoist`.

Voir [`SEO.md`](./SEO.md).

# SEO — état mesuré, règles et dette

**Audit refait le 2026-08-14** contre le **prérendu réel** (`dist/` après `npm run build`), le
`sitemap.xml` généré, `vercel.json`, `robots.txt` et le socle i18n. Remplace
[`archive/AUDIT-SEO-2026-07-18.md`](./archive/AUDIT-SEO-2026-07-18.md) (note 54/100 à l'époque,
216 commits de retard).

> ⚠️ **Ce que cet audit ne peut pas mesurer** : positions, impressions, clics, backlinks, et Core
> Web Vitals terrain. Ces données vivent dans Search Console, Ahrefs et PageSpeed Insights — hors
> du dépôt. Tout ce qui suit porte donc sur ce que le site **émet**, pas sur ce qu'il **obtient**.

---

## 1. État technique — les findings de juillet sont fermés

Mesuré sur les 24 pages prérendues :

| Contrôle | Résultat |
|---|---|
| Pages prérendues | **24** (accueil, guide, à-propos, 4 use-cases, index blog, 11 articles, 5 pages transactionnelles/légales) |
| `sitemap.xml` généré au build | **19 URLs** — les 5 absentes (login, signup, 3 pages légales) le sont **volontairement** et c'est commenté dans la source |
| `<title>` uniques | ✅ 24/24, longueurs 40–63 caractères |
| `meta description` uniques | ✅ 24/24 — une seule dépasse la limite d'affichage (`pour-equipes`, 161 car.) |
| `<h1>` | ✅ exactement 1 par page |
| `rel="canonical"` | ✅ par page, absolu |
| Images sans `alt` | ✅ 0 |
| JSON-LD | ✅ `SoftwareApplication`, `Organization`, `WebSite`, `FAQPage` (accueil), `BlogPosting` + `BreadcrumbList` (articles) |
| `robots.txt` | ✅ routes applicatives bloquées, sitemap déclaré, `Allow:` redondants retirés |
| `X-Robots-Tag` | ✅ `noindex` sur invitations, reset de mot de passe, pages légales |
| `rss.xml` | ✅ généré au build |
| Maillage interne depuis l'accueil | ✅ les 4 use-cases, le guide, le blog et un article |
| 404 | ✅ vraie page + `noindex` client (statut HTTP 200 — limite SPA assumée et documentée) |

**Le grief central de juillet — « le prérendu ne sort que 161 mots » — est corrigé** : l'accueil
émet ~600 mots de contenu propre, les pages use-case 680–900.

## 2. International — correct et délibéré, une seule faille

**Ce n'est pas un oubli**, contrairement à ce que la seule lecture du `dist/` laisse croire.
`INDEXABLE_LOCALES = ['fr']` dans `src/i18n/seo-urls.mjs` est un choix documenté dans le fichier
lui-même : `/en/` **est servi** depuis la phase 2, mais le **corps** des pages est encore en
français — seules les méta sont traduites. Indexer ça produirait du contenu français sur des URLs
anglaises, soit exactement le duplicate content que le chantier i18n cherche à éviter.

La décision est appliquée de bout en bout, et c'est cohérent :

- pas de prérendu `/en/`, pas d'URL `/en/` au sitemap, pas de `hreflang="en"` ;
- `vercel.json` pose `X-Robots-Tag: noindex` sur `/en/(.*)`.

**🟠 La faille** : la règle est `/en/(.*)` — elle exige la barre oblique. **`https://thecosmo.app/en`
(sans slash final) ne la déclenche pas** et sort donc sans `noindex`. C'est précisément l'URL de
l'accueil anglais, la plus susceptible d'être liée ou découverte. Le risque reste modéré (le
rewrite SPA sert `/index.html`, qui porte un canonical vers `/`), mais la protection voulue n'est
pas complète.
**Correction** : `/en` et `/es` dans la même règle, ou source `/(en|es)(/.*)?`. 5 min.

> `es` est déclaré dans `ALL_LOCALES` et dans `route-slugs.json` mais **absent de
> `SUPPORTED_LOCALES`** — la langue n'est donc pas servie. C'est le mécanisme prévu (« ouvrir une
> langue = l'ajouter à `SUPPORTED_LOCALES`, et rien d'autre »), pas une incohérence.

## 3. 🟠 La profondeur éditoriale est deux fois sous la cible que l'audit s'était fixée

Le plan éditorial de juillet fixait **1 500–2 500 mots par article**. Mesuré sur le prérendu, en
retranchant la base de navigation + pied de page (~740 mots, estimée sur les pages sans contenu
propre : login 742, signup 755, mentions légales 735) :

| Article | Contenu propre |
|---|---|
| `methode-okr-exemples` | ~1 540 mots ✅ |
| `suivi-des-habitudes` | ~1 180 |
| `time-blocking-guide` | ~1 150 |
| `tableau-de-bord-productivite` | ~1 140 |
| `gestion-du-temps-efficace` | ~1 100 |
| `combien-de-temps-prendre-habitude` | ~930 |
| `cosmo-vs-todoist` | ~920 |
| `matrice-eisenhower` | ~770 |
| `glossaire-productivite` | ~730 |
| `okr-vs-smart-vs-kpi` | ~700 |
| `template-okr-gratuit` | ~560 |

**Un seul article sur onze atteint le plancher fixé** ; la médiane est à ~930 mots. Sur des
requêtes où les pages en tête font 2 000+ mots, c'est le facteur limitant — pas la technique.

**Correction** : approfondir les 5 articles les plus courts avant d'en publier de nouveaux. Un
article de 700 mots qui ne se classe pas ne rapporte rien ; le même porté à 1 800 peut basculer.
Priorité aux trois qui visent des requêtes commerciales : `template-okr-gratuit`,
`cosmo-vs-todoist`, `okr-vs-smart-vs-kpi`.

## 4. Ce qu'il faut mesurer hors du dépôt

Ces questions décident de la suite et **aucune ne se répond depuis le code** :

| Question | Outil | Statut |
|---|---|---|
| Combien de pages réellement indexées ? | Search Console | à connecter |
| Quelles requêtes rapportent des impressions ? | Search Console | à connecter |
| Le profil de liens est-il vide ? | Ahrefs Webmaster Tools (gratuit) | à connecter |
| Core Web Vitals terrain | PageSpeed Insights / CrUX | jamais mesuré |

Tant que Search Console n'est pas branchée, toute affirmation sur « le SEO marche ou ne marche
pas » est une conjecture. Le rappel de contexte : la prod compte **27 comptes et 0 actif sur
7 jours** — le SEO n'a encore produit aucun signal mesurable, ce qui est normal à ce stade et ne
prouve rien dans un sens ou dans l'autre.

---

## Règles permanentes

### Ajouter une page publique indexable

1. Créer la route dans `src/App.tsx` **et** son slug dans `src/i18n/route-slugs.json`.
2. Ajouter ses méta dans `src/locales/<locale>/seo.json` (titre 50–60 car., description 140–155).
3. Vérifier qu'elle sort dans `dist/` après `npm run build` — **le prérendu est la source de
   vérité de ce que Google voit**, pas le code React.
4. Ne pas la lister à la main dans `public/sitemap.xml` : `prerender.mjs` s'en charge à partir des
   registres. Le fichier source ne contient que les pages sans registre.
5. Un `<h1>` et un seul. Un `alt` sur chaque image.

> **Cas particulier : `/entreprise-presentation`** (2026-08-15). Cette route rend le **même
> composant que `/`** (`LandingPage`), avec le parcours entreprise au lieu du parcours perso.
> Elle a donc son propre `<h1>`, ses propres méta et son propre bloc `content` dans
> `prerender.mjs` — 492 mots indexables — parce que « Cosmo pour une organisation » et « Cosmo
> pour moi » ne répondent pas à la même requête. Priorité sitemap 0.9, juste sous la home.
> ⚠️ Le corps prérendu reprend les arguments du track : **le retoucher quand la copie de
> `src/pages/landing/entreprise/` change**, sinon le prérendu ment sur ce que la page affiche.

### Ouvrir une langue à l'indexation

Dans cet ordre, sinon on publie du duplicate content :

1. Traduire **le corps** des pages, pas seulement les méta.
2. Ajouter la locale à `SUPPORTED_LOCALES` (`src/i18n/locale.ts`) — elle devient servie.
3. Ajouter la locale à `INDEXABLE_LOCALES` (`src/i18n/seo-urls.mjs`) — elle devient prérendue,
   déclarée au sitemap et annoncée en `hreflang`.
4. Retirer la règle `X-Robots-Tag: noindex` correspondante dans `vercel.json`.

❌ Ne jamais ajouter une locale à `INDEXABLE_LOCALES` avant que son contenu soit réellement
traduit : c'est le scénario que toute l'architecture i18n a été conçue pour empêcher.

### Ne jamais faire

- ❌ Déclarer au sitemap une URL qu'on désindexe par ailleurs (contradiction signalée par Search Console).
- ❌ Ajouter un `Allow:` par page dans `robots.txt` — `Allow: /` les rend redondants et la liste
  se périme en silence.
- ❌ Bloquer au crawl une page qu'on veut désindexer : Google doit pouvoir **lire** le `noindex`.
  C'est pourquoi `/invite/` et les pages légales sont crawlables mais `noindex` par en-tête.
- ❌ Publier un nouvel article tant que ceux de moins de 900 mots n'ont pas été approfondis.

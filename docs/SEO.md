# SEO — état mesuré, règles et dette

**Audit refait le 2026-08-14** contre le **prérendu réel** (`dist/` après `npm run build`), le
`sitemap.xml` généré, `vercel.json`, `robots.txt` et le socle i18n. Remplace
[`archive/AUDIT-SEO-2026-07-18.md`](./archive/AUDIT-SEO-2026-07-18.md) (note 54/100 à l'époque,
216 commits de retard).

**Complété le 2026-08-19** par les premières données Search Console réelles (§4), qui renversent
l'ordre des priorités : ce que le site **émet** est propre, ce qu'il **obtient** est nul, et la
cause n'est pas dans le dépôt.

> ⚠️ Restent hors de portée du dépôt : le nombre de pages réellement indexées, le profil de
> liens et les Core Web Vitals terrain. Ces données vivent dans Search Console, Ahrefs et
> PageSpeed Insights.

## Note SEO : 73 → 73 → 75 → 80 → **75 / 100** (2026-08-25 → 2026-08-27 → 2026-08-29 → 2026-09-14 → 2026-09-16) · inchangée au 2026-09-03, **VÉRIFIÉE inchangée le 2026-09-14 au soir**

> ### 🟠 2026-09-16 · -5 : la note comptait ce qui était mesuré, jamais ce qui ne l'était pas
>
> **Ce n'est pas une régression.** Rien n'a cassé depuis la dernière passe. Les angles morts
> listés juste en dessous **existaient tous** pendant que cette note montait : elle était
> surévaluée parce qu'elle ne comptait que ce que les gardes regardent. C'est exactement ce qui
> s'est produit le 2026-09-14, où cinq notes ont baissé sans qu'aucun défaut ne soit récent.
>
> **Barème, déclaré pour être contestable ligne par ligne :**
>
> | Situation | Effet |
> |---|---|
> | angle mort **structurel**, de portée large, qu'aucun outil ne regarde | −2 |
> | angle mort réel mais de portée limitée, ou partiellement couvert | −1 |
> | angle mort **assumé** (arbitrage documenté), ou déjà compté dans une passe antérieure | 0 |
> | angle mort **comblé** le jour même, avec garde **et** témoin | +1 |
>
> **Le calcul pour cette note :**
>
> | Angle mort | Effet | Pourquoi |
> |---|---|---|
> | AM-2 · **rien ne relie le SITEMAP aux pages réellement prérendues** | −2 | les 10 pages hors sitemap ont dû être expliquées à la main |
> | AM-1 · Lighthouse note le SEO de 4 URLs sur 45 | −1 | `lighthouserc.json` |
> | AM-3 · aucune garde sur les balises par page | −1 | `title`, `canonical`, `hreflang` vérifiés à la main |
> | AM-4 · le RÉSULTAT n'est pas mesuré, seulement la conformité | −1 | note 80 et **0 clic non marqué** coexistent depuis le 2026-08-19 |
> | AM-5 · `robots.txt` et les `noindex` entre deux passes | 0 | portée limitée |
>
> 🔴 **Une note baisse UNE FOIS, quand l'angle mort est nommé ; elle remonte quand il est
> outillé.** Sans cette règle, nommer un angle mort deviendrait punitif, et la passe du
> 2026-09-16 serait la dernière à en chercher. Un angle mort reconduit sans être comblé ne
> re-coûte rien : il est **déjà payé**.
>
> ⚠️ Un transversal (T-1 à T-10 du [tableau de bord](./README.md)) est compté dans **chaque** audit
> qu'il touche, parce que chaque note prétend quelque chose de différent. Les 36 témoins jamais
> rejoués coûtent donc à la fois aux tests et à la sécurité, et ce n'est pas un double comptage.



### 🕳️ Angles morts · ce que cet audit NE mesure PAS (2026-09-16)

> **Pourquoi cette section existe.** Cette note est justifiée par des points **nommés** (« ce qui
> retient à N », suivi d'une liste). Une note construite ainsi ne peut baisser que sur un défaut
> que quelqu'un a d'abord nommé : **un angle mort ne pèse rien tant qu'il reste anonyme**, et ce
> n'est pas un oubli d'auditeur, c'est une propriété de la méthode de notation.
>
> Le prototype du problème est daté : `CLAUDE.md` a pesé 150 ko et ~43 000 tokens sans qu'aucune
> note ne bouge, alors qu'il est cité **13 fois** dans [`ARCHITECTURE.md`](./ARCHITECTURE.md), dont **9**
> dans la seule colonne « Où il est écrit » du tableau des invariants, et **jamais** dans ce
> qui est mesuré. Il était le mètre,
> jamais l'objet.
>
> Ces lignes entrent donc **dans ce qui est mesuré**. La prochaine passe les traite comme les
> invariants ci-dessus : chacune est soit comblée, soit reconduite avec sa date.

| # | Angle mort | Vérifié le 2026-09-16 | Outillable ? |
|---|---|---|---|
| AM-1 | **Lighthouse note le SEO de 4 URLs sur les 40 du sitemap** | `lighthouserc.json` (4 URLs, `preset: desktop`) vs le sitemap : 🔴 **40 `<loc>`, pas 45**, recomptés le 2026-09-20 **sur la production** (`https://thecosmo.app/sitemap.xml`) **et** sur le build local du 09-17, qui donnaient déjà 40. Aucune source du sitemap n'a bougé depuis le 2026-09-10 : **« 45 » n'a jamais été mesuré**, c'est un chiffre estimé le 09-16, dans la passe même qui interdit de recopier un « avant ». La proportion, elle, ne change pas | oui, au prix du temps de job |
| AM-2 | 🔴 **Rien ne relie le SITEMAP aux pages réellement prérendues.** Une route ajoutée à l'un sans l'autre ne fait échouer aucun job, et les 10 pages prérendues hors sitemap ont dû être expliquées à la main le 2026-09-14 | aucun script ne compare `dist/sitemap.xml` à la sortie de `prerender.mjs` | oui, et c'est peu coûteux |
| AM-3 | **Aucune garde sur les balises par page.** `title`, `description`, `canonical` et `hreflang` sont vérifiés lors des passes manuelles, pas en CI (Lighthouse n'en voit que 4) | 40 `hreflang` recomptés à la main le 2026-09-14 | oui : une garde sur `dist/**/*.html` |
| AM-4 | **Le résultat n'est pas mesuré, seulement la conformité.** Position, impressions et clics viennent de la Search Console, à la main. Un audit peut donc monter pendant que le trafic reste nul, ce qui est l'état constaté depuis le 2026-08-19 | note 80 et 0 clic non marqué coexistent | partiellement : l'API GSC |
| AM-5 | **`robots.txt` et les `noindex` ne sont vérifiés qu'au moment où on ouvre une locale.** Entre deux passes, rien ne signale un `Disallow` devenu trop large | aucune garde | oui |


> ### ⚪ 2026-09-14 (soir) · 0 : l'infrastructure tient, et le seul chiffre de RÉSULTAT disponible est mauvais
>
> **Rejoué sur un build neuf de ce soir**, et complété par ce que l'entrée du matin n'avait pas
> regardé : le rapport entre les pages prérendues et le sitemap, et la production elle-même.
>
> | Contrôle | Résultat |
> |---|---|
> | Pages HTML prérendues dans `dist/` | **50** |
> | URLs déclarées au sitemap | **40** |
> | Écart, page par page | **exactement 10** : les 6 pages contractuelles (CGU, confidentialité, mentions légales × 2 locales) et les 4 pages d'authentification (`/login`, `/signup` × 2 locales) |
> | Pages prérendues portant `noindex` | **0** |
> | Production : `/`, `/entreprise-presentation`, `/en`, `/blog`, `/sitemap.xml` | **200** sur les cinq |
>
> ✅ **L'écart de 10 est cohérent et voulu** : ces pages sont désindexées par en-tête
> (`X-Robots-Tag` dans `vercel.json`) et non par `robots.txt`, précisément pour que Google puisse
> les crawler et LIRE le `noindex`. La vérification manquait : compter 40 URLs ne dit rien tant
> qu'on n'a pas expliqué les 10 qui n'y sont pas.
>
> 🔴 **Ce que ce document doit maintenant porter, parce que la question se pose cette semaine.**
> Mesuré en base ce soir, sur `auth.users` : **28 comptes au total, 1 seule inscription sur les 30
> derniers jours, 0 sur les 7 derniers**, et **2 connexions** sur 7 jours. Le plan d'acquisition du
> 2026-08-13 mesurait 27 comptes lifetime. **Un mois de travail SEO, d'i18n et de produit a produit
> un inscrit.**
>
> ⚠️ **Ce n'est pas une baisse de note, et il faut dire pourquoi**, sinon c'est de la complaisance.
> Cette note mesure ce que le dépôt contrôle : le prérendu, le sitemap, les `hreflang`,
> `robots.txt`, la structure éditoriale. Tout cela est mesuré et tenu. Le facteur limitant est
> nommé depuis le 2026-08-19 et il est **hors du dépôt** : l'autorité de domaine, donc les
> backlinks, donc [`ACQUISITION-BACKLINKS.md`](./ACQUISITION-BACKLINKS.md) et des gestes manuels
> d'Axel. Faire payer ce chiffre à la note SEO reviendrait à noter le travail par un levier qu'il
> ne tient pas.
>
> **Mais l'inscrire ici est nécessaire** : un 80/100 sur un domaine qui rend un inscrit par mois
> doit se lire avec son résultat à côté, sans quoi la note dit « tout va bien » à qui s'apprête à
> lancer une campagne. *Une note d'infrastructure n'est pas une note d'audience.*
>
> ⚠️ **Deux comptes sur 28 ne sont pas des utilisateurs** : `demo@cosmo.app`
> (`aaaaaaaa-aaaa-…`, créé le 2026-01-10, **jamais connecté**, et pourtant porteur de 120 tâches,
> 67 événements, 6 habitudes et 4 OKR en PRODUCTION) et `testemail@gmail.com`. La base compte donc
> **26 comptes réels**, et **16 % des tâches de la plateforme appartiennent au compte de
> démonstration**. Toute statistique tirée de `/admin` ou d'un comptage brut avant une campagne doit
> retrancher ces deux lignes, sous peine de mesurer un fantôme.
>
> 🟠 **Angle mort · les onze articles anglais portent des slugs français**
> (`/en/blog/combien-de-temps-prendre-habitude`, …). C'est un arbitrage écrit et défendable, posé
> dans `src/content/blog/*.mjs` (« une seule publication traduite, pas deux articles »), mais il
> n'était consigné dans **aucun audit**. Un slug est un signal de pertinence : la décision est sans
> coût tant que l'anglais n'a pas de trafic, et doit être rouverte le jour où il en a. Le prix d'un
> changement ultérieur est une table de redirections 301. Même constat côté
> [`I18N.md`](./I18N.md).


> ### 🟢 2026-09-14 · +5, et c'est un rattrapage : la bascule C-20 (09-08) n'avait jamais été notée
>
> La § 2 de ce document décrit une bascule technique majeure — l'anglais ouvert à l'indexation, et
> trois vrais défauts trouvés au passage (sitemap muet sur `/` et `/guide`, `robots.txt` aveugle
> aux routes applicatives sous `/en`, et surtout `Disallow: /entreprise` qui bloquait par PRÉFIXE
> la page publique payante `/entreprise-presentation`). Elle est datée du **2026-09-08** et n'a
> **jamais reçu de point** : le score est resté « inchangée » pendant six jours sur un domaine qui
> venait de doubler de taille.
>
> **Revérifié aujourd'hui sur un build réel** (`npm run build`, `dist/`, pas déduit de la lecture
> de `prerender.mjs`), et c'est tenu, pas seulement écrit :
>
> | Contrôle | Résultat le 2026-09-14 |
> |---|---|
> | URLs au sitemap | **40**, dont 61 occurrences `/en/` (URLs + alternates) |
> | Entrées `hreflang` dans le sitemap | **80** |
> | Pages prérendues portant `noindex` | **0** |
> | `robots.txt` : `/entreprise-presentation` | déclarée au sitemap, **hors** de toute règle `Disallow` — vérifié, `/entreprise$` et `/entreprise/` ne la couvrent pas |
>
> **Pourquoi +5 et pas plus** : ce que ce domaine ne peut toujours pas mesurer reste le facteur
> limitant, et il n'a pas bougé — position moyenne, clics non-marque et domaines référents vivent
> dans Search Console, lue pour la dernière fois le **2026-08-19**. Ouvrir une locale à
> l'indexation crée l'OPPORTUNITÉ d'un classement, elle ne le prouve pas. C'est le même écart que
> l'accessibilité pose entre « câblé » et « annoncé ».

> ### 2026-09-03 · toujours 75, et la raison n'a pas changé depuis le 2026-08-19
>
> Les 71 commits des 08-30 au 09-03 ne produisent **aucun contenu indexable** et ne touchent ni au
> prérendu, ni au `sitemap.xml`, ni aux canonicals, ni aux `hreflang`. Deux mouvements les
> effleurent sans rien changer au référencement :
>
> - les trois pages contractuelles existent désormais en anglais, mais `en` **n'est toujours pas
>   dans `INDEXABLE_LOCALES`** : servie aux utilisateurs, fermée à Google, exactement comme prévu
>   tant que le corps des pages reste français ;
> - quatre liens vers ces pages rendaient une **404 en anglais** (slug localisé écrit en dur dans
>   un `to=`, alors que le préfixe de locale est porté par le `basename`). Corrigé. C'est un défaut
>   d'expérience et de liens internes, sur des pages **non indexables** : il ne rapporte pas de
>   point SEO.
>
> **Ce qui décide de la note n'a pas été remesuré** : la position moyenne, les clics non-marque et
> les domaines référents vivent dans Search Console, et la dernière lecture date du **2026-08-19**.
> Le facteur limitant reste l'autorité de domaine, et le seul levier reste
> [`ACQUISITION-BACKLINKS.md`](./ACQUISITION-BACKLINKS.md), intégralement manuel.

> ### 2026-08-29 · +2, et le gain vient d'un défaut trouvé, pas d'un contenu écrit
>
> **Une barre finale renvoyait quatre pages vers l'accueil.** Vérifié en production, pas déduit :
> `thecosmo.app/pour-freelances/` servait le fichier prérendu, puis l'application redirigeait vers
> `/`. Le visiteur atterrissait sur la page d'accueil, sans erreur, sans 404, sans trace. Quatre
> pages concernées : freelances, étudiants, managers, équipes.
>
> 🔴 **Pourquoi ça vaut deux points maintenant et pas dans six mois** : les annuaires normalisent
> presque tous les URL avec une barre finale, et leurs soumissions (T-21) sont **le seul levier
> d'acquisition** de ces 60 jours. Chaque backlink obtenu à la main aurait envoyé son visiteur
> ailleurs que sur la page qui le concerne.
>
> Second acquis, plus discret : les pages prérendues sont désormais **mesurées** en CI, et elles
> sortent à **100 de SEO** (`/`, `/blog/`, `/guide/`, `/pour-freelances/`). Le job Lighthouse
> mesurait jusqu'ici la page 404 de la SPA, qui se marque `noindex` : il annonçait 0,66 sur des
> pages dont le fichier prérendu porte `index, follow`.
>
> **Ce qui ne bouge pas, et qui décide de la note** : toujours aucun domaine référent, et la
> position moyenne n'a pas été remesurée depuis le 2026-08-19. Le facteur limitant reste
> l'autorité de domaine, pas le contenu ni la technique.

> **2026-08-27 · toujours 73, pour la même raison.** Les dix-neuf commits de la journée sont tous
> dans le produit connecté (mode entreprise, navigation, accessibilité) ou sur la landing **derrière le
> clic** (confirmation de démo, popup d'inscription). Aucun n'ajoute de contenu indexable, aucun
> ne touche au prérendu, au `sitemap.xml`, aux canonicals ni aux `hreflang`. La position moyenne
> et les clics non-marque **n'ont pas été remesurés** depuis le 2026-08-19 : ces chiffres vivent
> dans Search Console, pas dans le dépôt. Le seul levier reste
> [`ACQUISITION-BACKLINKS.md`](./ACQUISITION-BACKLINKS.md), intégralement manuel.

**Aucun travail SEO n'a eu lieu entre le 2026-08-24 et le 2026-08-25**, et la note ne bouge donc
pas. C'est une information, pas un trou dans l'audit.

| Ce qui compose la note | 08-24 | 08-25 |
|---|---|---|
| Technique (prérendu, sitemap, canonical, JSON-LD, `robots.txt`) | ✅ 24/24 pages propres | ✅ inchangé |
| Profondeur éditoriale | 🟠 deux fois sous la cible (§3) | 🟠 inchangée |
| Position moyenne Google, requêtes non-marque | **88** | non remesurée |
| Clics non-marque | **0** | · |
| Backlinks (le seul levier) | ❌ chantier manuel non entamé | ❌ **non entamé** |

**La seule chose qui déplacerait cette note ne se trouve pas dans le dépôt.** Ce que le site
**émet** est propre, c'est mesuré, page par page, et c'est ce que la note de 73 récompense. Ce
qu'il **obtient** est nul, et la cause est l'autorité de domaine. Sept migrations et un système de
permissions n'y changent rien, par construction.

> ⚠️ **À ne pas confondre avec un audit « à jour ».** Une note qui ne bouge pas parce que rien n'a
> été mesuré et une note qui ne bouge pas parce que rien n'a été fait sont deux états différents.
> Ici c'est le second : la partie code a été vérifiée, la partie terrain (position, indexation)
> date du **2026-08-19** et demande une relecture de Search Console, trente minutes, côté Axel.
>
> Une nouveauté du 2026-08-25 mérite d'être notée : le job CI `lighthouse` rend le score **SEO
> bloquant** sur les 4 routes prérendues. C'est la première garde automatique côté SEO ; elle
> protège l'acquis technique, elle ne crée pas d'audience.

Le plan d'action reste [`ACQUISITION-BACKLINKS.md`](./ACQUISITION-BACKLINKS.md), intégralement
manuel.

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

## 2. International : l'anglais est OUVERT à l'indexation (2026-09-08)

> 🔄 **Bascule C-20, le 2026-09-08.** Ce paragraphe décrivait `INDEXABLE_LOCALES = ['fr']` comme
> un choix délibéré : `/en/` était servi, mais son **corps** restait français, et l'indexer aurait
> produit du duplicate content. Cette raison a cessé d'être vraie : le corps anglais a été écrit.

`INDEXABLE_LOCALES = ['fr', 'en']`. La condition de sortie était le **contenu**, pas la config, et
elle a été mesurée avant la bascule, pas déduite : accueil, guide, à-propos et entreprise
(430 à 700 mots), les 4 pages métier (579 à 815 mots) et les 11 articles (657 à 1 985 mots) ont
tous un corps anglais réel. Aucune page ne restait en français.

Vérifié dans `dist/` après `npm run build`, jamais depuis la lecture de `prerender.mjs` :

| Contrôle | Résultat |
|---|---|
| Pages prérendues | **50**, dont **26 sous `/en`** |
| URLs au sitemap | **40**, dont **20 sous `/en`** |
| `lastmod` manquant | **0** |
| `hreflang` réciproques (`fr-FR` + `en-US` + `x-default`), `<head>` et sitemap | **50/50 pages**, et chaque alternate pointe vers un fichier qui existe |
| `canonical` / `lang` / `og:locale` conformes à la locale | **50/50** |
| URL au sitemap **et** `noindex` (contradiction) | **0** |
| FAQPage JSON-LD | suit la locale (`faqSchemaFor`), FAQ anglaise sur `/en/`, française sur `/` |

`vercel.json` ne pose donc plus de `noindex` sur `/en`, et le conserve sur `/es`, sur
`/en/(terms|legal-notice|privacy-policy)` (le français fait foi contractuellement), sur les
invitations et sur les pages de mot de passe.

> ⚠️ **Trois défauts trouvés par la bascule. Les deux premiers étaient invisibles tant que `fr`
> était seule indexable ; le troisième était là depuis toujours :**
>
> 1. **`/` et `/guide` étaient absents du sitemap en anglais.** Ils venaient du socle statique
>    `public/sitemap.xml`, pas de `sitemapGroup` : une entrée écrite à la main ne porte qu'une URL,
>    donc ni `/en/…` ni alternates. Les deux pages les plus importantes du site étaient les seules
>    au groupe de langue muet. Le socle est désormais **vide** et tout passe par le générateur.
> 2. **`robots.txt` ne couvrait pas les routes applicatives sous `/en`.** `Disallow:` est un
>    préfixe : `/dashboard` ne matche pas `/en/dashboard`. Le `noindex` global sur `/en/(.*)` les
>    bouchait ; le retirer découvrait les dix. Elles sont maintenant nommées.
> 3. **`robots.txt` interdisait au crawl `/entreprise-presentation`**, la page publique qui porte
>    l'offre payante, prérendue et déclarée au sitemap en **priorité 0.9**, la plus haute après
>    l'accueil. `Disallow: /entreprise` visait la route applicative, mais `Disallow:` matche par
>    **préfixe** et le slug public partage ses onze premiers caractères. C'est la contradiction du
>    § « Ne jamais faire » ci-dessous, en pire : la page n'était pas seulement déclarée puis
>    désindexée, elle était déclarée puis **rendue incrawlable**. Corrigé par `Disallow:
>    /entreprise$` plus `Disallow: /entreprise/`. Préexistant, sans rapport avec l'ouverture de
>    `en` ; c'est l'audit des 40 URLs du sitemap contre les 20 règles qui l'a sorti, et c'était la
>    seule collision. Le slug anglais est `for-companies`, il n'a jamais eu le problème.

**✅ La faille est refermée (2026-08-19).** La règle était `/en/(.*)`, qui exige la barre
oblique : **`https://thecosmo.app/en` sortait sans `noindex`** — précisément l'URL de l'accueil
anglais, la plus susceptible d'être liée. Vérifié en prod le 2026-08-19 (`curl -I` → aucun
`X-Robots-Tag`) avant correction. `vercel.json` porte désormais **deux** règles, `/(en|es)` et
`/(en|es)/(.*)`.

Surtout, `npm run i18n:check` (bloquant en CI) exigeait le motif exact `/xx/(.*)` : **il ne
pouvait structurellement pas voir ce trou**, et ne l'a pas vu pendant cinq jours. Le contrôle
distingue maintenant la **racine** du **sous-arbre** et réclame les deux, en acceptant les
sources groupées (`/(en|es)…`). Régression rejouée : en retirant la règle racine, la CI casse
avec le bon message.

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
| ~~`template-okr-gratuit`~~ | **2 040 mots** ✅ — porté de 560 à 2 040 le 2026-08-19 (§4 : c'est le seul actif téléchargeable, donc le seul qui puisse attirer un lien) |

**Un seul article sur onze atteint le plancher fixé** ; la médiane est à ~930 mots. Sur des
requêtes où les pages en tête font 2 000+ mots, c'est le facteur limitant — pas la technique.

**Correction, telle qu'elle était formulée le 14/08** : approfondir les 5 plus courts avant d'en
publier de nouveaux.

> 🔴 **Le §4 renverse cette priorité.** Mesure faite : le contenu se classe en position 88, pas
> en position 15 — un article allongé y reste. Seul `template-okr-gratuit` a été traité, et pour
> une autre raison que sa longueur : c'est le seul **actif linkable** du site. Les autres
> attendront que le domaine ait des liens entrants.

## 4. 🔴 Ce que Search Console mesure — le contenu ne se classe sur rien

Données relevées le **2026-08-19**, période 2026-05-18 → 2026-08-18 :

| Périmètre | Clics | Impressions | CTR | Position moyenne |
|---|---|---|---|---|
| Toutes requêtes | 17 | 328 | 5,2 % | 15,5 |
| **Requêtes ne contenant pas « cosmo »** | **0** | **13** | **0 %** | **88,1** |

**La position moyenne de 15,5 est un artefact.** 96 % des impressions et 100 % des clics
viennent du mot « cosmo », qui est générique (Cosmopolitan, cosmos) et ne nous appartient pas.
Sur le contenu éditorial, la position réelle est **88 — la page 9**. Le CTR de 5,2 %, cinq fois
au-dessus de la normale à la position 15, est le symptôme de ce mélange, pas une bonne nouvelle :
❌ **ne pas « optimiser les titles pour le CTR »**, le CTR non-marque est nul faute d'impressions.

La courbe des impressions non-marque est plate, avec deux pics isolés à mi-juillet et mi-août —
les deux dates de publication. C'est le cycle complet d'un contenu indexé, testé, classé vers la
position 88, jamais cliqué, puis plus montré.

**Le facteur limitant n'est donc ni la technique ni la longueur des articles, mais l'autorité de
domaine.** Un domaine sans lien entrant ne se classe sur rien. Conséquence directe sur les
priorités, et elle est contre-intuitive :

❌ **Ne pas approfondir les articles courts pour l'instant.** Un article de 2 000 mots en
position 88 reste en position 88. La règle du §3 (« ne rien publier tant que les courts ne sont
pas montés ») devient : **ne rien publier ni approfondir tant que le seuil de ~20 domaines
référents n'est pas approché.**

Le chantier, entièrement manuel, est décrit dans
[`ACQUISITION-BACKLINKS.md`](./ACQUISITION-BACKLINKS.md) : kit de soumission prêt à coller,
ordre des annuaires, suivi. Le premier signal à guetter n'est pas un clic, c'est **une page qui
passe sous la position 30 sur une requête non-marque**.

### Ce qui reste à mesurer hors du dépôt

| Question | Outil | Statut |
|---|---|---|
| Combien de pages réellement indexées ? | Search Console → Indexation des pages | 🔴 jamais relevé — 13 impressions pour 20 URLs laisse l'hypothèse ouverte |
| La propriété GSC est-elle de type *domaine* ? | Search Console | à vérifier (une propriété *préfixe d'URL* n'en montre qu'une fraction) |
| Combien de domaines référents ? | Ahrefs Webmaster Tools (gratuit) | 🔴 à connecter — attendu : 0 à 2 |
| Core Web Vitals terrain | PageSpeed Insights / CrUX | jamais mesuré, non prioritaire |

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

### Reprendre les captures de la landing entreprise

`public/screenshots/entreprise/*.webp` sont de **vraies captures** de l'espace entreprise, prises
sur l'application en mode démo. Elles sont affichées par `landing/entreprise/AppShot` (hero et
section cockpit) et référencées dans le prérendu de `/entreprise-presentation`.

> ⚠️ Une capture périmée ment sur le produit. À reprendre dès que l'UI entreprise change.

Procédure (Playwright, dev server sur le port de `dev-verify`) :

1. `localStorage.theme = 'noir'` **avant** le login démo — la landing est graphite, une capture
   en thème clair y fait une tache blanche.
2. `loginDemo()` puis `/entreprise`, et fermer le bandeau démo, l'avis de tarification et
   replier la barre latérale : on ne montre que le produit.
3. Viewport **1280 de large** et cadrage depuis la barre d'onglets, en 16/10. La largeur compte :
   au-delà, l'UI devient trop petite une fois réduite à la taille d'affichage et le texte n'est
   plus lisible.
4. Encoder en WebP 1500 px (`ffmpeg -c:v libwebp -quality 80`) — l'ensemble tient sous 250 kB.
5. Mettre à jour les `alt` (`enterprise.cockpit.a1…a6`) si le contenu des écrans a changé.

### `lastmod` et `dateModified` — jamais la date du build

Le sitemap déclarait `lastmod = aujourd'hui` sur **toutes** les URLs à chaque déploiement, et le
JSON-LD global faisait de même sur `dateModified`. Un sitemap qui annonce « tout a changé
aujourd'hui » à chaque `git push` apprend à Google à ignorer le champ, et un `dateModified` qui
avance sans que la copie bouge est un signal de fraîcheur artificielle. Corrigé le 2026-08-19.

Chaque page tire désormais sa date de son contenu :

| Page | Source de la date |
|---|---|
| Articles de blog | `dateModified` du registre `ARTICLES` (déjà le cas) |
| Pages use-case | `dateModified` du registre `USE_CASES` (champ ajouté) |
| Index du blog | la plus récente des `dateModified` des articles, calculée au build |
| `/`, `/guide`, `/a-propos`, `/entreprise-presentation` | `CONTENT_LASTMOD` dans `prerender.mjs` |

❌ **Ne jamais réintroduire `TODAY` dans le sitemap ni dans un `dateModified`.** `TODAY` ne sert
plus qu'au `lastBuildDate` du flux RSS, où « date du build » est la bonne réponse.
✅ Retoucher la copie d'une page sans registre = bouger sa ligne dans `CONTENT_LASTMOD`, au même
titre qu'on met à jour son titre.

### Maillage interne du blog — par sujet, jamais par date

La suite de lecture (« À lire ensuite ») était `ARTICLES.slice(0, 3)`, soit **les 3 articles les
plus récents, identiques depuis les 11 pages**. Effet mesuré le 2026-08-19 : 4 articles ne
recevaient aucun lien entrant interne, dont `cosmo-vs-todoist`, la page à intention commerciale.

Chaque article porte maintenant un champ `related: [slug, slug, slug]`, résolu par
`relatedArticles()` (`src/content/blog/index.mjs`) et consommé **aux deux endroits** :
`BlogArticlePage.tsx` et `prerender.mjs`. Repli sur la récence si un slug devient inconnu.

- ✅ Un nouvel article déclare ses `related` **et** se fait citer en corps de texte par au moins
  deux articles existants. Un article qu'on publie sans toucher aux autres naît orphelin.
- ✅ Le blog pointe vers les pages commerciales (`/pour-*`, `/entreprise-presentation`) : elles
  ne recevaient aucun lien depuis les articles avant le 2026-08-19.
- ❌ Ne pas recalculer la suite de lecture par date : c'est la version qu'on vient de retirer.

### Ouvrir une langue à l'indexation

Dans cet ordre, sinon on publie du duplicate content :

1. Traduire **le corps** des pages, pas seulement les méta.
2. Ajouter la locale à `SUPPORTED_LOCALES` (`src/i18n/locale.ts`) — elle devient servie.
3. Ajouter la locale à `INDEXABLE_LOCALES` (`src/i18n/seo-urls.mjs`) — elle devient prérendue,
   déclarée au sitemap et annoncée en `hreflang`.
4. Retirer la règle `X-Robots-Tag: noindex` correspondante dans `vercel.json`.
5. Nommer les routes applicatives sous le nouveau préfixe dans `robots.txt` : `Disallow:` est un
   **préfixe**, `/dashboard` ne couvre pas `/xx/dashboard`, et c'est le `noindex` global qu'on
   vient de retirer qui les bouchait.
6. Faire tourner `npm run build` et vérifier dans `dist/`, jamais dans `prerender.mjs`.

🔴 **Les points 3 et 4 se commitent ENSEMBLE.** L'état à moitié ouvert (contenu prérendu et
`noindex` retiré, mais locale absente d'`INDEXABLE_LOCALES`) est le plus dangereux des trois :
Google peut indexer `/xx` sans hreflang ni sitemap. `npm run i18n:check` le refuse, et c'est cette
gate qui rattrape l'oubli, pas la relecture.

❌ Ne jamais ajouter une locale à `INDEXABLE_LOCALES` avant que son contenu soit réellement
traduit : c'est le scénario que toute l'architecture i18n a été conçue pour empêcher.

### Ne jamais faire

- ❌ Déclarer au sitemap une URL qu'on désindexe par ailleurs (contradiction signalée par Search Console).
- ❌ Ajouter un `Allow:` par page dans `robots.txt` — `Allow: /` les rend redondants et la liste
  se périme en silence.
- ❌ **Écrire une règle `robots.txt` en préfixe nu quand un slug public commence par les mêmes
  lettres.** `Disallow:` matche par préfixe : `/entreprise` bloquait `/entreprise-presentation`.
  Utiliser `$` (fin d'URL) et une règle explicite pour le sous-arbre. Vaut aussi à l'ouverture
  d'une langue : `/dashboard` ne couvre pas `/en/dashboard`.
- ❌ Bloquer au crawl une page qu'on veut désindexer : Google doit pouvoir **lire** le `noindex`.
  C'est pourquoi `/invite/` et les pages légales sont crawlables mais `noindex` par en-tête.
- ❌ Publier un nouvel article tant que ceux de moins de 900 mots n'ont pas été approfondis.

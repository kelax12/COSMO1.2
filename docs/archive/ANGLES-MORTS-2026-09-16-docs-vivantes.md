> ⚠️ **ARCHIVE : section « Angles morts » du 2026-09-16, extraite de neuf docs vivants le 2026-11-08 (V19.4, DOC-02), non maintenue.**
> Chaque tableau décrit l'état **à sa date** (énoncé du 2026-09-16, colonne « État » réécrite le 2026-09-21,
> puis mises à jour jusqu'au 2026-10-24). Les docs d'origine portent l'état courant : une ligne par angle
> mort, avec sa garde et ce qu'elle ne prouve pas. Texte repris **sans une coupe** ; le préambule, identique
> dans les neuf docs (vérifié par octet), n'est écrit qu'une fois. Les notes /100 dont il parle ont cessé
> (ADR 0012, ADR 0014). Le code et la production font foi contre ce fichier.

# Angles morts du 2026-09-16 · tableaux d'origine de neuf docs

## Préambule commun (identique dans les neuf docs)


> 🔎 **Colonne « État » réécrite le 2026-09-21.** La quatrième colonne posait « Outillable ? »,
> c'est-à-dire une **prédiction** faite le 2026-09-16. La passe du 2026-09-20 au soir (`2b4c4304`)
> y a répondu : elle porte donc maintenant l'**état réel**, la garde qui couvre la ligne, et
> 🔴 **ce que cette garde ne prouve pas** — la moitié qui manque d'habitude.
>
> ❌ **La colonne « Angle mort » n'est PAS touchée.** C'est l'énoncé, daté du 2026-09-16, et
> c'est lui qui, nommé, a permis d'outiller : le réécrire effacerait la seule chose qui explique
> pourquoi la garde existe. Un seul endroit porte l'état, et c'est la colonne de droite.
>
> ⚠️ **Une garde posée n'est pas un angle mort fermé**, et `M-56` (« ce que chaque angle mort
> coûte en points ») ne change rien ici : **aucune note ne bouge** sur cette base.



> **Pourquoi cette section existe.** Demande d'Axel, après le constat qui a ouvert la journée :
> `CLAUDE.md` a pesé 150 ko sans qu'aucune note ne bouge, parce qu'il était **cité comme source**
> par les audits et **jamais mesuré par eux**. Il était le mètre, jamais l'objet.
>
> 🔴 **Ce document n'a PAS de note, et c'est son premier angle mort.** Les onze documents notés
> entrent dans le tableau de bord de [`README.md`](./README.md) et peuvent donc monter ou baisser.
> Celui-ci ne le peut pas : rien ne le pèse, donc rien ne signale qu'il a vieilli. Les angles morts
> ci-dessous ne sont **pas** des défauts du produit ; ce sont les endroits où **ce document affirme
> sans que rien ne vérifie**.
>
> Chaque ligne est vérifiée par une commande, jamais supposée. Elle se **referme** ou se
> **reconduit avec sa date**, jamais ne se recopie.


---

## ACQUISITION-BACKLINKS.md · tableau d'origine (énoncé du 2026-09-16, état du 2026-09-21 au 2026-10-24)

| # | Angle mort · **énoncé du 2026-09-16, non réécrit** | Vérifié le 2026-09-16 | 🔎 État au 2026-09-21 |
|---|---|---|---|
| AM-1 | 🔴 **Aucun suivi des backlinks obtenus ni PERDUS.** Ce document liste des actions manuelles ; rien ne vérifie qu'un lien posé existe encore. Un backlink retiré est invisible, alors que c'est le seul levier que ce document déclare débloquant | données Search Console lues à la main le 2026-08-19, jamais depuis | ✅ **OUTILLÉ le 2026-10-23** · `scripts/seo-signals.mjs`, chaque lundi (`seo-signals.yml`, relié à `ci-alert.yml`) : chaque ligne `fait` du tableau des annuaires est relue, sa page source (première URL hors thecosmo.app de la colonne Note) doit répondre et contenir un lien vers thecosmo.app, `rel` noté en série ; page disparue, lien retiré, `fait` sans page source ou lien suivi devenu `nofollow` = **rouge**. Témoin vu rouge au rejeu. 🔴 ne prouve PAS : un lien d'une page rendue en JavaScript (rouge à relire à la main), ni un backlink jamais déclaré ici : pour ceux-là, voir AM-2 |
| AM-2 | **L'autorité de domaine n'est mesurée par rien en continu**, alors que le document en fait le blocage principal | aucun job | 🟡 **OUTILLÉ le 2026-10-23, rouge jusqu'au secret** · même script : domaines référents et liens entrants vus par l'**API Bing Webmaster** (`BING_WEBMASTER_API_KEY`), gratuits et reproductibles, en série datée `docs/seo-signals-series.json` ; un domaine présent au point précédent et absent du suivant = **rouge** (`M-55`). 🔴 ne prouve PAS : rien tant que la clé n'est pas posée (geste d'Axel) ; ensuite, Bing ne compte que les liens que Bing a explorés, ce n'est pas l'autorité vue par Google |
| AM-3 | **Les actions d'Axel n'ont ni date ni état.** Une liste d'actions manuelles sans colonne « fait le » ne permet pas de distinguer « pas encore tenté » de « tenté sans effet », et les deux appellent des décisions opposées | relevé dans ce document | ✅ **OUTILLÉ le 2026-09-20** · colonne **État** (5 valeurs, date obligatoire) + `npm run check:acquisition` (`C-101`) — 🔴 ne prouve PAS : que l'état déclaré soit vrai : la garde exige une date, pas une vérification |

---

## ACQUISITION.md · tableau d'origine (énoncé du 2026-09-16, état du 2026-09-21 au 2026-10-24)

| # | Angle mort · **énoncé du 2026-09-16, non réécrit** | Vérifié le 2026-09-16 | 🔎 État au 2026-09-21 |
|---|---|---|---|
| AM-1 | 🔴 **Les chiffres datent du 2026-08-14 et ne sont rejoués par rien.** Un audit d'acquisition dont les mesures ont un mois décrit un marché qui a bougé, et il n'existe aucun job qui les remesure | mesures datées dans l'en-tête, aucun workflow d'acquisition | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:acquisition` + marqueur `<!-- chiffres-remesures: -->` (`C-101`) — 🔴 ne prouve PAS : ⚠️ **un énoncé du 09-16 était FAUX** : « le tracking `?ref=` reste un développement ouvert ». La chaîne est complète depuis la mig. `097`, testée de bout en bout. Ce qui manquait était de **regarder les chiffres** |
| AM-2 | **Aucune action n'est reliée à son résultat.** Ce document liste des leviers ; rien n'attribue une inscription à un levier. C'est le même motif que T-5 du tableau de bord : on mesure la conformité, pas le résultat | le tracking `?ref=` reste un développement ouvert | ✅ **OUTILLÉ le 2026-09-20** · colonne **État** (5 valeurs, date obligatoire sur `fait` / `refuse`) (`C-101`) — 🔴 ne prouve PAS : qu'un backlink posé **existe encore** : ça demande l'API Search Console, donc un geste — **`M-55`** |
| AM-3 | ✅ **COMBLÉ le 2026-09-20.** Était : les comptes de TEST ne sont retranchés d'aucun chiffre, `demo@cosmo.app` portant **120 tâches** en production, soit 16 % des tâches de la plateforme | 🔴 Le 2026-09-20 au matin, **pire que « non appliquée » : la mig. `149` n'était pas COMMITÉE**, fichier non suivi de l'arbre de travail, et `admin_stats_excluded_uids()` absente de la base. ✅ **Commitée (`297ddd14`) puis appliquée le jour même** (ledger `20260920105522`), prouvée d'abord en transaction annulée : `/admin` passe de 30 · 779 · 454 · 32 à **28 utilisateurs · 658 tâches · 387 événements · 26 habitudes**, avec une clé `excluded_accounts = 2` qui **dit** la correction, et un non-admin toujours refusé en 42501 | ✅ **FERMÉ le 2026-09-20** · mig. `149` au ledger `20260920105522` (`C-100`, `M-46`) — `/admin` passe de 30·779·454·32 à 28·658·387·26, plus une clé `excluded_accounts = 2` qui **dit** la correction |

---

## RGPD-REGISTRE.md · tableau d'origine (énoncé du 2026-09-16, état du 2026-09-21 au 2026-10-24)

| # | Angle mort · **énoncé du 2026-09-16, non réécrit** | Vérifié le 2026-09-16 | 🔎 État au 2026-09-21 |
|---|---|---|---|
| AM-1 | 🔴 **Les durées de conservation déclarées ne sont confrontées à AUCUNE donnée réelle.** Dix traitements annoncent une durée ; rien ne vérifie qu'aucune ligne ne la dépasse. C'est pourtant la pièce produite en contrôle CNIL, donc celle où un écart se paie | aucun script ne lit les dates de création par table | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:retention` (`C-93`) — 🔴 ne prouve PAS : que ce registre soit juste : la garde confronte la base à ce qu'il déclare, pas l'inverse |
| AM-2 | **Un traitement NOUVEAU n'entre pas au registre tout seul.** Une table de données personnelles ajoutée par migration, ou un sous-traitant ajouté par une dépendance, ne déclenche rien | ni `validate:migrations` ni la CI ne testent ce lien | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:erasure` (`C-92`) — 🔴 ne prouve PAS : dérivé des migrations, pas de la base |
| AM-3 | **La liste des sous-traitants est tenue à la main.** Un service SaaS ajouté au produit (analytics, mail, hébergement d'images) est un sous-traitant au sens de l'art. 28, et rien ne le signale | liste statique dans ce document | ✅ **OUTILLÉ le 2026-10-24** · `npm run check:subprocessors` (étape `ci.yml`, témoin `scripts/check-subprocessors.guard.test.mjs`, vu rouge) : les tiers sont dérivés de la CSP, des hôtes en littéral (`api/`, `supabase/functions/`, `src/`), des SDK et des workflows de sauvegarde, puis comparés au tableau des transferts de ce registre et au § 6 de `LEGAL.md`, dans les deux sens. Première exécution : **écart réel**, Resend, Cloudflare Turnstile, Google et GitHub étaient au registre mais absents de `LEGAL.md` § 6 (corrigé). 🔴 ne prouve PAS : qu'un DPA soit signé (ligne A5), ni les tiers à hôte non littéral (URL de webhook d'organisation, `OPS_ALERT_WEBHOOK_URL`), ni le SMTP et l'OAuth portés par le serveur Supabase ; Anthropic et IONOS (T11) vivent hors dépôt et sont déclarés tels quels dans la garde |

---

## POST-AUDIT-GUIDE.md · tableau d'origine (énoncé du 2026-09-16, état du 2026-09-21 au 2026-10-24)

| # | Angle mort · **énoncé du 2026-09-16, non réécrit** | Vérifié le 2026-09-16 | 🔎 État au 2026-09-21 |
|---|---|---|---|
| AM-1 | 🔴 **Les points cochés ✅ sont des réglages de DASHBOARD, et rien ne vérifie qu'ils le sont ENCORE.** « Leaked Password Protection », l'index `048` : tout cela vit hors du dépôt, se désactive en deux clics, sans commit et sans trace. Un ✅ daté décrit un instant, pas un état | aucun workflow ne lit les réglages Supabase (cf. [`SECURITY.md`](./SECURITY.md) AM-2) | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:supabase-posture` (`C-88`) — 🔴 ne prouve PAS : 🔴 elle échoue tant que la référence n'est pas posée (**`M-58`**). Le volet purement manuel reste `M-15` / `M-16` / `M-17` |
| AM-2 | **Un guide de chantiers ne dit pas lesquels sont périmés.** Le point 3 a été tranché le 2026-09-03 et exécuté le 09-04 (suppression des jetons, C-04) : ce qui reste ici en décrit le **contexte**, pas l'état | « Point 3 · TRANCHÉE le 2026-09-03 » | 🟠 **TOUJOURS OUVERT** au 2026-09-21 · **aucun item ne le porte.** Un guide de chantiers ne dit toujours pas lesquels sont périmés, et le point 3 en est l'exemple : tranché le 09-03, exécuté le 09-04 — *(jugé outillable le 09-16 : oui : une date de dernière revérification par point)* · ✅ **OUTILLÉ le 2026-10-24** · chaque « Point N » porte un marqueur `<!-- chantier: actif relu=… -->` (péremption à **90 jours**) ou `clos le=…` (exempt, mais daté). `npm run check:peremption-chantiers` en CI, témoin vu rouge. Le relevé du jour a trouvé deux autres chantiers périmés (4 et 5, exécutés) et un ouvert (2). **Point 3 marqué TRANCHÉ/CLOS.** 🔴 ne prouve PAS que la relecture a eu lieu, seulement qu'une date est écrite |
| AM-3 | **Ce document n'a pas de note et n'entre dans aucun tableau de bord**, alors qu'il porte la séquence de réactivation du premium | absent du tableau de bord de [`README.md`](./README.md) | ✅ **SANS OBJET le 2026-11-08** : les notes /100 ont cessé (ADR 0012) et `check:docs-scored` (`C-109`) est retirée ; `npm run check:docs` refuse leur retour. L'énoncé de gauche est celui du 2026-09-16, conservé |

---

## STRIPE-LIVE.md · tableau d'origine (énoncé du 2026-09-16, état du 2026-09-21 au 2026-10-24)

| # | Angle mort · **énoncé du 2026-09-16, non réécrit** | Vérifié le 2026-09-16 | 🔎 État au 2026-09-21 |
|---|---|---|---|
| AM-1 | 🔴 **AUCUNE garde ne compare la grille STRIPE au code.** `org-tiers.parity.test.ts` verrouille le Deno sur le TypeScript, donc **deux copies du dépôt l'une contre l'autre** ; rien ne confronte l'une ou l'autre aux prix réellement enregistrés chez Stripe. Or c'est le seul endroit où COSMO **annonce un montant** et où un tiers **en facture un autre** | aucun workflow ne contient `STRIPE_ORG_PRICE` ni d'appel à l'API Stripe | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:stripe-prices` · grille **lue** dans `premium-config.ts` (`C-106`) — ✅ **PLANIFIÉ le 2026-10-20** avec la bascule : secret live posé, `schedule:` décommenté, `Grille Stripe` dans `ci-alert.yml` |
| AM-2 | **Les 8 prix live ont été vérifiés UNE FOIS, le 2026-08-26.** Un prix désactivé ou dupliqué depuis ne serait vu par personne. La dérivation annuelle refuse d'ailleurs de choisir entre deux candidates (`yearly_unavailable`), donc un doublon **coupe l'encaissement annuel en silence** | vérification datée dans ce document, jamais rejouée | ✅ **OUTILLÉ le 2026-09-20** · doublon de prix et `tax_behavior` vérifiés (`C-106`) — 🔴 ne prouve PAS : idem AM-1 : la garde existe et ne tourne pas encore |
| AM-3 | **La liste des events du webhook live ne sera vérifiée par rien après enregistrement.** Ils sont **SIX** ; ce dépôt a écrit « 5 » pendant six jours, et en enregistrer 5 couperait le **remboursement** sans aucun signal | recompté dans le code le 2026-09-12 | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:stripe-prices` (`C-106`) — 🔴 ne prouve PAS : idem AM-1 |
| AM-4 | **Le passage en live n'a pas de répétition à blanc.** La séquence (remettre à zéro les identifiants par la mig. `140`, recréer les prix, réenregistrer le webhook, remplacer trois secrets) n'a jamais été parcourue, et chaque étape manquante échoue **après** encaissement | mig. `140` écrite, **non appliquée**, par construction | ✅ **PARCOURUE le 2026-10-20** (bascule réelle, cf. « Ce qui reste à faire avant d'encaisser ») · avant : 🟠 ouvert au 2026-09-21 · **`M-48`** : la séquence de bascule n'a jamais été parcourue, même à blanc. Elle recoupe `M-43`, `M-06`, `M-07` et `M-08` — la répétition est ce qui transforme quatre lignes espérées en une séquence éprouvée — *(jugé outillable le 09-16 : partiellement : le compte de test permet la répétition)* |

---

## SUPPORT.md · tableau d'origine (énoncé du 2026-09-16, état du 2026-09-21 au 2026-10-24)

| # | Angle mort · **énoncé du 2026-09-16, non réécrit** | Vérifié le 2026-09-16 | 🔎 État au 2026-09-21 |
|---|---|---|---|
| AM-1 | 🔴 **Aucune mesure du support lui-même** : ni volume reçu, ni délai de première réponse, ni taux de résolution. Un canal de support qu'on n'instrumente pas ne se distingue pas d'un canal que personne n'utilise | aucun job, aucun compteur | ✅ **OUTILLÉ le 2026-09-20** · mig. `150` · `support_reports` + `record_support_report` + `get_support_stats`, **appliquée le 2026-09-21** (ledger `20260921075529`) (`C-110`) — 🔴 ne prouve PAS : 🔴 **que le compteur compte.** `report-bug` n'est pas redéployée (**`M-61`**), donc **rien n'appelle `record_support_report`** : la table restera vide. `/admin` passe de « non installé » à **zéro**, et zéro se lit « aucun rapport » — c'est le plus trompeur des trois états |
| AM-2 | **Rien ne vérifie que l'adresse de contact publiée reçoit vraiment.** `check:mail` vérifie SPF, DKIM et DMARC de l'expédition **sortante** ; la réception n'est testée par rien | `scripts/check-auth-email.mjs` mesure le DNS d'envoi | 🟡 **OUTILLÉ le 2026-10-23** · **`M-53`** : `check:mail` mesure aussi la **réception** (`scripts/check-mail-reception.mjs`). Les adresses publiées sont relues dans `src/locales`, `src/pages`, `src/components`, `contact.mjs`, `index.html` (JSON-LD) et `prerender.mjs`, hors exemples de saisie : `contact@thecosmo.app` et l'adresse de l'éditeur. Pour chaque domaine : MX présents (un MX nul RFC 7505 compte comme absent) et hôtes résolus ; pour chaque adresse : domaine à MX valide ; puis dialogue SMTP jusqu'à `RCPT TO` et `QUIT`, **jamais `DATA`**. Témoin `check-mail-reception.guard.test.mjs`, 18 cas, vu rouge sur 3 sabotages (`check:sabotages`). **Mesuré le 2026-10-23 par `--doh`** : `thecosmo.app` → `mx00` / `mx01.ionos.fr`, `gmail.com` → 5 MX, les deux adresses OK. 🔴 ne prouve PAS : **(1)** le `RCPT TO` n'a jamais été joué en vrai : le conteneur Claude Code bloque le port 25 sortant (rapport « NON MESURÉ », jamais « refusé ») ; les runners GitHub hébergés le bloquent en général aussi (non mesuré ici) ; il reste à lancer `npm run check:mail` depuis une connexion qui laisse sortir le 25 (Axel) ; **(2)** même un `250` ne dit ni que la boîte n'est pas pleine au dépôt réel, ni que le courrier évite le spam, ni **qu'un humain lise la boîte** : cela, seul un envoi daté vers `contact@thecosmo.app` et sa réponse le prouvent (Axel) |
| AM-3 | **`report-bug` est déployée, mais ce que ses rapports deviennent n'est mesuré par rien.** `notDeployed` est vide depuis le 2026-09-12, donc la fonction est en ligne ; aucun compteur ne dit si un rapport a été lu | `.github/edge-deploy.json` | ✅ **OUTILLÉ le 2026-09-20** · encart « Support » sur `/admin`, à **trois états distincts** (`null` ≠ `0` ≠ n) (`C-110`) — 🔴 ne prouve PAS : idem AM-1. ⚠️ Et `first_response_at` / `resolved_at` resteront **NULL** : ils se posent à la main, la réponse partant d'une boîte mail que ce dépôt ne lit pas |

---

## LEGAL.md · tableau d'origine (énoncé du 2026-09-16, état du 2026-09-21 au 2026-10-24)

| # | Angle mort · **énoncé du 2026-09-16, non réécrit** | Vérifié le 2026-09-16 | 🔎 État au 2026-09-21 |
|---|---|---|---|
| AM-1 | 🔴 **`npm run check:legal` vérifie l'ARITHMÉTIQUE du tableau, jamais la CONFORMITÉ.** Il recompte les lignes et refuse un total faux, parce que ce total l'a été trois fois dans la même journée. Mais **une ligne marquée ✅ à tort laisse la garde verte** : rien ne confronte une ligne à la réalité | en-tête de `scripts/check-legal-table.mjs` : « Garde du tableau de conformité », sur le **bloc de synthèse** | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:legal-journal` · une ligne ✅ doit porter une **date** (`C-107`) — 🔴 ne prouve PAS : 🔴 **la CONFORMITÉ.** Une ligne ✅ à tort **et datée** reste verte. 1ʳᵉ exécution : `C10` était la seule sans date, et sa relecture a trouvé une affirmation **fausse** |
| AM-2 | **Les échéances légales ne sont surveillées par rien.** 15 lignes sont ❌ au tableau ; aucune ne porte de date butoir opposable dans un outil | tableau : ✅ 13 · 🟡 13 · ❌ 15 · ⬜ 5 | ✅ **OUTILLÉ le 2026-09-20** · cliquet à **21 lignes datées** (`C-107`) — 🔴 ne prouve PAS : idem AM-1 : la traçabilité, jamais le fond |
| AM-3 | **Rien ne relie une modification des documents contractuels à leur préavis de 30 jours.** Les CGU, la politique de confidentialité et les mentions légales vivent dans le namespace `legal` : une modification de fond est un **changement de contrat**, et le préavis de l'article 11 ne se déclenche pas tout seul | `src/locales/{fr,en}/legal.json` est un catalogue i18n ordinaire pour la CI | ✅ **OUTILLÉ le 2026-09-20** · `docs/LEGAL-JOURNAL.md` + empreinte de `src/locales/{fr,en}/legal.json` exigée à chaque modification (`C-107`) — 🔴 ne prouve PAS : que le préavis de 30 jours de l'article 11 ait été servi : le journal date le changement, il ne notifie personne |
| AM-4 | **Ce document n'a pas de note**, donc il ne peut ni monter ni baisser, alors qu'il porte les obligations dont le non-respect coûte le plus cher | absent du tableau de bord de [`README.md`](./README.md) | ✅ **SANS OBJET le 2026-11-08** : les notes /100 ont cessé (ADR 0012) et `check:docs-scored` (`C-109`) est retirée ; `npm run check:docs` refuse leur retour. L'énoncé de gauche est celui du 2026-09-16, conservé |

---

## AUDIT-VOICEOVER-IOS.md · tableau d'origine (énoncé du 2026-09-16, état du 2026-09-21 au 2026-10-24)

| # | Angle mort · **énoncé du 2026-09-16, non réécrit** | Vérifié le 2026-09-16 | 🔎 État au 2026-09-21 |
|---|---|---|---|
| AM-1 | 🔴 **CE DOCUMENT EST LUI-MÊME UN ANGLE MORT.** Il l'écrit en tête : « Statut : à jouer. Rien dans ce fichier n'est coché ». Un audit jamais joué ne peut rien révéler, et il ne fait baisser aucune note : [`ACCESSIBILITY.md`](./ACCESSIBILITY.md) est noté 82 **sans** que ce quatrième audit ait été passé | statut inchangé depuis le 2026-09-03 | 🟠 **TOUJOURS OUVERT** au 2026-09-21 · **`M-40`** (jouer la check-list) et **`M-52`** (lui donner une date). ❌ Il ne s'outille pas : `axe-core` voit des attributs, pas ce que VoiceOver prononce — *(jugé outillable le 09-16 : non : il se **joue**, il ne s'outille pas)* · 🟡 **2026-10-24 : l'exécution reste humaine (`M-40`), tout le reste est outillé.** Échéance **2026-12-15**, 94 étapes à résultat attendu vérifié, registre des séances, garde `npm run check:lecteurs-ecran` en CI (témoin vu rouge : échéance dépassée, séance absente, attendu vide). 🔴 ne prouve PAS qu'une séance a été bien faite, seulement qu'elle est consignée |
| AM-2 | **Le coût de son absence n'est pas nommé dans la note d'accessibilité.** VoiceOver est la seule mesure de ce que le produit **annonce réellement** à une personne aveugle, et c'est aussi AM-3 de [`ACCESSIBILITY.md`](./ACCESSIBILITY.md) | ce document n'est cité par aucun point de plafond | 🟠 **TOUJOURS OUVERT** au 2026-09-21 · **`M-56`** : tant que le coût d'un angle mort en points n'est pas arbitré, l'absence de ce quatrième audit ne fait baisser **aucune** note — `ACCESSIBILITY.md` est noté 84 sans qu'il ait jamais été passé — *(jugé outillable le 09-16 : oui : le nommer dans le plafond de la note)* · ✅ **ARBITRÉ le 2026-10-24** (`M-56`, volet lecteur d'écran) : [`ACCESSIBILITY.md`](./ACCESSIBILITY.md) § « Arbitrage du coût de l'absence de séance lecteur d'écran ». Le coût est écrit, la note est appliquée par la coordination, pas ici |
| AM-3 | **Aucune échéance.** « À jouer » sans date se reconduit indéfiniment, et c'est exactement ce qui s'est produit depuis le 2026-09-03 | 13 jours | 🟠 **TOUJOURS OUVERT** au 2026-09-21 · **`M-52`**, et c'est le seul des trois qui se ferme sans matériel : « à jouer » sans date se reconduit indéfiniment, et c'est ce qui s'est produit depuis le 2026-09-03 — *(jugé outillable le 09-16 : oui)* · ✅ **OUTILLÉ le 2026-10-24** · échéance **2026-12-15** dans le marqueur d'en-tête, `npm run check:lecteurs-ecran` échoue le lendemain sans séance consignée · 🔴 ne prouve PAS que la séance a lieu : elle rend son absence **rouge**, pas impossible |

---

## MIGRATION-REACT19.md · tableau d'origine (énoncé du 2026-09-16, état du 2026-09-21 au 2026-10-24)

| # | Angle mort · **énoncé du 2026-09-16, non réécrit** | Vérifié le 2026-09-16 | 🔎 État au 2026-09-21 |
|---|---|---|---|
| AM-1 | 🔴 **C'est une ÉTUDE, et une étude périme.** Écrite le 2026-09-03 contre les versions de ce jour-là. Les composants shadcn audités « ref par ref », le chiffrage et la chronologie CVE décrivent un instant. Rien ne signale qu'une version a bougé depuis | aucune garde ne relit `package.json` contre ce document | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:study` · échoue si une majeure citée ici bouge (`C-108`) — 🔴 ne prouve PAS : le coût de **ne pas** migrer, qui se compte en incidents. Relu le 2026-09-21 : **5 comparaisons sur 5**, l'étude décrit encore les versions installées |
| AM-2 | **La chronologie CVE n'est surveillée par rien de ciblé.** Dependabot alerte sur une vulnérabilité déclarée, jamais sur « React 18 approche de sa fin de support », qui est l'argument central de cette étude | `npm audit --omit=dev` ne voit pas une fin de support | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:study` (`C-108`) — 🔴 ne prouve PAS : idem AM-1 |
| AM-3 | **Le coût de NE PAS migrer n'est pas mesuré.** Le piège `Button`/`forwardRef` (les flèches qui ne déplaçaient pas le focus dans le calendrier) est venu d'une source shadcn écrite **pour React 19**. Rien ne compte ces incidents, donc l'étude n'a pas de contrepartie chiffrée | l'incident est documenté, jamais agrégé | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:study` (`C-108`) — 🔴 ne prouve PAS : idem AM-1 : l'étude est fraîche, la décision de migrer reste différée (seuil de reprise : 283,5 ko) |

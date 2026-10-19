# Sécurité — findings ouverts & priorités — COSMO 1.2

**Source de vérité sécurité du projet.** Ce fichier ne contient que ce qui est **encore ouvert**
et les **règles durables** tirées des audits.

- Historique complet (preuve des corrections, audits datés 2026-04 → 2026-08, anciens ordres de
  priorité) : [`docs/archive/faille-historique.md`](./docs/archive/faille-historique.md) — **archive, non maintenue**.
- Procédures et patterns : [`docs/SECURITY.md`](./docs/SECURITY.md).
- **Passe documentaire du 2026-09-03** : les 71 commits postérieurs au 2026-08-29 relus, la note
  portée à **86**, et les deux tableaux d'actions relus ligne par ligne (A-9 et les réglages de
  console : **trois lignes sur cinq étaient périmées**). ⚠️ **Aucune mesure nouvelle contre la
  production** ce jour-là : les chiffres cités sont ceux des commits qui les ont produits.
- Dernière vérification de ce fichier contre le code **et contre la prod** : **2026-10-02** au soir, et avant elle **2026-10-01** (mig.
  `204`, `207`-`210` appliquées et relues au catalogue, cinq Edge Functions redéployées, `Edge deploy
  drift` vert, audit A-1 des 23 tables `160`-`207` acteur par acteur, § « Surface entreprise »),
  puis `212`. ✅ **Remesuré le 2026-10-19** (`TR-1`) : mig. `223` appliquée (ledger
  `20261019122246`, **173** entrées) et relue au catalogue, advisors **`13 / 84 / 2 / 1`**, sonde
  `anon` sur `track_hit` refusée. Note **86 → 87**.
  ✅ **Remesuré le 2026-10-18** (dernière passe avant l'acquisition) : advisors
  **`13 / 85 / 3 / 1`**, `Posture` rouge depuis 09:29 UTC, les six objets des mig. `221` et `222`
  relus au catalogue, dont `track_hit` (finding **`TR-1`**) ; 79 tables toutes sous RLS, 205
  policies, ledger 172, 12 Edge Functions inchangées ; 0 alerte CodeQL et Dependabot. Note **87 → 86**.
  ✅ **Remesuré le 2026-10-16** : advisors `11 / 82 / 2 / 1` inchangés, 77 tables,
  205 policies, ledger 170, 12 Edge Functions ; `M-68` vérifié en base (0 session et 0 jeton
  antérieurs au chiffrement) ; AM-6 rejoué en CI ; une alerte CodeQL neuve (n° 14). Note **82 → 86**.
  ✅ **Remesuré le 2026-10-15** : advisors **`11 / 82 / 2 / 1`** (égaux à la référence
  de `Posture`, vert chaque jour depuis le 10-08), **77** tables toutes sous RLS, **205** policies,
  ledger **170**, 12 Edge Functions, dépôt de nouveau public (privé du 10-13 au 10-14), une alerte
  CodeQL et quatre Dependabot de développement ouvertes. Note **84 → 82** (`BK-1`).
  ✅ **Remesuré le 2026-10-02 au soir** : advisors **`11 / 80 / 2 / 1`** inchangés, **74**
  tables (mig. `211`, deux tables vides retirées), **194** policies, ledger **162**, 12 Edge Functions,
  CodeQL et Dependabot à **0** ; et la garde `check:supabase-posture` comptait **zéro** pour chaque
  advisor depuis sa pose (corrigée, cf. note). Relevé du 10-01 :
  ✅ **Advisors relus par l'API le 2026-10-01 au soir : `11 / 80 / 2 / 1`** ; les deux
  `authenticated_security_definer_function_executable` de plus que le 09-30 sont exactement
  `can_manage_team_okr_audience` et `set_team_okr_links`, voulues par la mig. `212`. Base : **76**
  tables, toutes sous RLS, **202** policies, ledger **161** entrées, **0** encaissement.
  Passe précédente : **2026-09-30**
  (ledger, catalogue objet par objet des migrations `164`-`204`, les 12 Edge Functions par l'API
  et par `check:edge-smoke`, alertes CodeQL et Dependabot). Passes précédentes contre la prod :
  2026-09-22 (advisors, RLS, `C-77`), 2026-09-14 (gardes et isolation), 2026-09-02 (Edge
  Functions Stripe, `S-1` à `S-6`). ⚠️ Advisors **non relus** le 2026-09-30 : `11 / 78 / 2 / 1`
  est le relevé du même jour par la session d'audit (`prompt-audit-failles-acquisition-2026-09-30.md`).

Légende : 🔴 bloquant · 🟠 important · 🟡 à planifier · ✅ corrigé


> 🗂️ **Allégé le 2026-10-11** (135 ko, 1 586 lignes). Sont partis, **à l'identique**, dans
> **[`docs/archive/faille-jusqua-2026-10-11.md`](./docs/archive/faille-jusqua-2026-10-11.md)** : les entrées de note antérieures au 2026-10-02, les angles morts
> du 2026-09-16, les états de gardes datés, l'état global du 08-25 et le détail des findings
> **refermés** (`B-1`, `B-2`, `B-3`, `G-1`, `G-3`, `E-3`, `W-1` → `W-4`, `S-1` → `S-6`, audit A-1
> des tables `160`-`207`), plus l'état des migrations au 09-30. **Un finding qui se referme
> quitte ce fichier dans le même commit.**

---

## Note de sécurité : 82 → 86 → 84 → 86 → 88 → 83 → 83 → 78 → 84 → 84 → 82 → 86 → 87 → 86 → **87 / 100** (2026-08-24 → 09-02 → 09-03 → 09-14 → 09-16 → 09-22 soir → 09-30 → 2026-10-01 → 2026-10-02 soir → 2026-10-15 → 2026-10-16 → 2026-10-16 soir → 2026-10-18 → **2026-10-19**)

> ### 🟢 2026-10-19 · +1 : `TR-1` refermé, `track_hit` n'a plus qu'un appelant
>
> **Même règle** : un défaut ne se rembourse que corrigé et vérifié. Mesures du 2026-10-19 : CI de
> la PR n° 79 à `62f8ba98` (run `39163166665`, cinq jobs verts) et de `main` à `11039a44`,
> production (catalogue, ledger, advisors par l'API, sondes HTTP, `traffic_hits`). Tableau de
> bord : [`docs/README.md`](./docs/README.md).
>
> | Item | Effet | Mesuré le 2026-10-19 |
> |---|---|---|
> | ✅ `TR-1` · `track_hit` appelable par `anon` sans passer par le collecteur (−1 le 10-18) | **+1** | collecteur à la clé secrète servi (`11039a4`, `check:deploy` : `égal`) ; mig. `223` appliquée à 12:22 UTC (ledger `20261019122246`), relue au catalogue : corps identique à celui de la preuve (md5 `2087347b…`), ACL `postgres` + `service_role`, `INVOKER`, `search_path` vide. Sonde `anon` sur `/rest/v1/rpc/track_hit` : **401** `42501`, y compris avec un chemin valide (HTTP 200 la veille). Visite par le collecteur après application : 204, une ligne |
> | `Posture` | 0 | advisors **`13 / 84 / 2 / 1`** : `track_hit` est sortie des deux listes. Restent au-dessus de la référence `traffic_hits`, `traffic_salts`, `get_admin_revenue` et `get_admin_traffic`, relus sains le 10-18. Rouge jusqu'au `--update` (geste d'Axel) : légitime, non débité |
> | Trois lignes de test dans `traffic_hits` | 0 | `/verification-tr1`, `/verification-tr1-collecteur`, `/verification-tr1-apres-223` (12:12 à 12:23 UTC) : elles comptent dans la page Trafic de `/admin`. Laissées : les retirer est une écriture en base |
>
> **86 → 87.**

> ### 🟠 2026-10-18 · −1 : une écriture anonyme dont seul le plafond global tient
>
> **Même règle** : un angle mort ne se rembourse que sur un verdict rendu en CI, un défaut que
> lorsqu'il est corrigé et vérifié. Dernière passe avant l'acquisition. Mesures du 2026-10-18 : CI
> de `main` à `e69cb729` (run `39139204925`, cinq jobs verts) et à `15d40bea`, production
> (advisors par l'API, catalogue, cron, Edge Functions, sondes HTTP), alertes GitHub. Tableau de
> bord : [`docs/README.md`](./docs/README.md).
>
> | Item | Effet | Mesuré le 2026-10-18 |
> |---|---|---|
> | 🟠 `TR-1` · `track_hit` (mig. `222`) appelable par `anon` sans passer par le collecteur | **−1** | § [`TR-1`](#-tr-1--track_hit-réservée-au-collecteur-refermé-2026-10-19) ci-dessous (✅ refermé le 2026-10-19). Le collecteur filtre origine, taille et robots ; la RPC se joint **sans lui** avec la clé publique, et prend l'IP **dans le corps** : le plafond par visiteur se contourne, reste le global, **3 000 par minute**, soit 4,3 M lignes par jour gardées 13 mois, pour une base de **24 Mo** en plan Free (plafond 500 Mo). L'autre écriture anonyme, `record_demo_visit`, plafonne à 60 par minute |
> | 🔴 `Posture` rouge depuis le 2026-10-18 à 09:29 UTC (run `39115503952`, alerte poussée) | 0 | `11 / 82 / 2 / 1` → **`13 / 85 / 3 / 1`**. Les six objets, **relus un par un au catalogue** : `get_admin_revenue` (mig. `221`) et `get_admin_traffic` (`222`) testent `is_admin()` en tête, fermées à `anon` ; `traffic_hits` et `traffic_salts` sous RLS sans policy, ACL réduite à `postgres` et `service_role` ; `track_hit`, c'est `TR-1`. **Pas de recalage** : il attend la décision sur `TR-1`, sinon la référence absorberait le seul objet qui pose question. Non débité à part : la garde a parlé, son objet l'est |
> | ✅ `V-1` refermé, script de mesure tiers débranché (`23a12fdb`) | 0 | origine retirée de `script-src` et `connect-src`, relu dans l'en-tête CSP **servi** en production. Pas de débit en cours depuis la mitigation du 2026-09-01 : rien à rembourser |
> | `M-32` · `baggage` / `sentry-trace` vers les Edge Functions (`ef694ac5`) | 0 | témoin `src/sentry-propagation.guard.test.ts` |
> | Alertes GitHub | 0 | **0** CodeQL, **0** Dependabot ; secret scanning : la seule n° 1, connue, inerte ; dépôt `public` |
> | Production | 0 | **79** tables (77 et les deux de la `222`), toutes sous RLS, **205** policies, ledger **172** (dernière `20261017230922`) ; **12** Edge Functions, versions inchangées, `Edge deploy drift` vert le 10-18 ; job `cosmo-purge-traffic` actif ; collecteur en ligne : 405 en GET, 403 sans origine, 400 sur un type inconnu, trois sondes qui n'écrivent rien |
>
> **87 → 86.**

> ### 🟢 2026-10-16 (soir) · +1 : plus aucune alerte de code ouverte
>
> | Item | Effet | Mesuré le 2026-10-16 (soir) |
> |---|---|---|
> | ✅ CodeQL n° 14 · `high`, sans décision (−1 le matin) | **+1** | `eb6ee7ba` : `job` validé avant d'entrer dans la `RegExp` ; alerte `fixed` à 14 h 27 UTC. API relue : **0** alerte CodeQL ouverte, **0** Dependabot |
> | CI de `main` | 0 | les runs de `main` ne s'annulent plus (`eb6ee7ba`) : quatre runs complets de suite, tous verts (`38907264016` à `38941369233`) |
>
> **86 → 87.** Reste ouvert côté `BK-1` : la moitié RGPD (`M-69`, `M-70`, `M-71`).

> ### 🟢 2026-10-16 · +4 : les sessions révoquées, la surface entreprise rejouée en CI
>
> **Même règle** : un angle mort ne se rembourse que sur un verdict rendu en CI, un défaut que
> lorsqu'il est corrigé et vérifié. Mesures du 2026-10-16 : CI de `main` à `a4878cab` (run
> `38902071817`, cinq jobs verts), production (advisors par l'API, catalogue, comptage agrégé sur
> `auth`), alertes GitHub. Tableau de bord : [`docs/README.md`](./docs/README.md).
>
> | Item | Effet | Mesuré le 2026-10-16 |
> |---|---|---|
> | ✅ `BK-1` · sessions et jetons pouvant sortir des dumps (−2 le 10-15) | **+2** | `M-68` fait par Axel le 2026-10-16. **Relu par cette passe en production**, par un comptage sans aucune donnée personnelle : **0** session et **0** jeton de rafraîchissement vivant créés avant le chiffrement des sauvegardes (2026-10-13, 11 h 47 UTC). Mot de passe de la base non changé, décision motivée : un `pg_dump` ne le contient pas, il vit dans le secret masqué `SUPABASE_DB_URL` |
> | ✅ AM-6 · surface entreprise jamais rejouée en CI (−2 le 09-30) | **+2** | `e2e/rls/org-surface-entreprise.test.ts` (`b89e1b3f`, `1ace166f`) : **24 tables × 6 acteurs × 4 opérations, 624 cellules**, toutes vues **rouges** sur deux sabotages en CI (runs `38859320682`, `38859843934`, PR brouillon n° 72), vertes sur `main` (`38860697711`, puis `38902071817`) |
> | ✅ CodeQL n° 13 (−1 le 10-15) | **+1** | `fixed` le 2026-10-15 à 17 h 52 UTC |
> | 🔴 CodeQL n° 14 · `high`, sans décision | **−1** | `js/regex-injection`, `scripts/ci-toutes-les-gardes.mjs` (posé le 10-15) : une `RegExp` construite depuis l'argument `--job`. **Trié par lecture** : `--job` est un littéral écrit dans `ci.yml`, exploitation nulle. Même règle que pour le n° 13 : une alerte `high` sans décision coûte le point. Correctif : échapper `job`, ou le valider par `/^[a-z-]+$/` |
> | Dependabot, secret scanning | 0 | **0** alerte Dependabot ouverte (31 à 34 fermées par `3a645c11`). `braces` (haute, sans version corrigée publiée) et `fast-uri` (PR n° 75, non fusionnée) relevés par `npm audit`, dépendances de développement. Secret scanning : la seule n° 1, connue, inerte |
> | Production | 0 | advisors **`11 / 82 / 2 / 1`**, égaux à la référence (`Posture` vert le 10-16) ; **77** tables toutes sous RLS, **205** policies, ledger **170**, **12** Edge Functions |
>
> **82 → 86.** Le BK-1 n'est pas clos pour autant : sa moitié RGPD (`M-69`, `M-70`) reste ouverte,
> et l'échéance de la notification CNIL est passée sans trace au registre (cf. `docs/RGPD.md`).
>
> ✅ **2026-10-16 (soir) · CodeQL n° 14 `fixed`** à 14 h 27 UTC, par `eb6ee7ba` (analyse CodeQL de
> `main` verte) : `lireEtapes` valide l'identifiant de job (`/^[A-Za-z_][A-Za-z0-9_-]*$/`) et compare
> des chaînes, plus aucune `RegExp` construite depuis `--job`. Le témoin `--job .*` a été vu rouge
> avant le correctif : le script lisait alors les étapes d'un AUTRE job, sans le dire. Le point débité
> ci-dessus est à créditer par la prochaine passe (86 → 87), pas ici.

> ### 🟠 2026-10-15 · −2 : `BK-1` entre dans la note, la garde des advisors est enfin remboursée
>
> **Même règle** : un angle mort ne se rembourse que sur un verdict rendu en CI, un défaut que
> lorsqu'il est corrigé et vérifié. Mesures de la nuit du 14 au 15 : CI de `main` à `6847bbf3`,
> production (advisors par l'API, catalogue, Edge Functions), dépôt à `HEAD`. Tableau de bord :
> [`docs/README.md`](./docs/README.md).
>
> | Item | Effet | Mesuré le 2026-10-15 |
> |---|---|---|
> | ✅ AM-1 · advisors lus à la main (non remboursé le 09-22, « `M-58` pas fait ») | **+1** | `M-58` fait le 2026-10-08 : référence posée depuis le run `37773471782`, recalée le 10-10 (81 → 82, `claim_acquisition_source`, mig. `217`, relue). `Posture` **vert chaque jour depuis**, et sur des comptes **réels** depuis le correctif du 10-02. Relu ce soir par l'API : **`11 / 82 / 2 / 1`**, exactement la référence. Les deux de plus qu'au 10-02 sont nommés : `get_admin_onboarding_funnel` (mig. `213`, gardée par `is_admin()`) et `claim_acquisition_source` |
> | 🔴 `BK-1` · dumps en clair dans les artefacts d'un dépôt public | **−2** | défaut refermé et vérifié (`8c6a971d`, `db-backup` vert et chiffré les 10-13 et 10-14). Mais ce qu'il a pu exposer ne l'est pas : `M-68`, **révoquer les sessions et changer le mot de passe de la base**, est ouvert à `a-faire-manuel.md`. Tant qu'un jeton de rafraîchissement lu dans un dump peut encore ouvrir une session, c'est structurel. ⚠️ Non relu en base : la lecture de `auth.sessions` a été refusée à l'agent, à juste titre |
> | 🔴 CodeQL n° 13 · `high`, sans décision depuis le 2026-10-12 | **−1** | `js/double-escaping`, `scripts/capture-og-images.mjs`, fonction `unescape` : `&amp;` est décodé **avant** les autres entités, donc `&amp;lt;` devient `<`. **Trié par lecture** : script de build (images OG), entrée = notre propre prérendu, rien n'atteint un navigateur ; défaut de justesse réel, exploitation nulle. Le +1 de `M-60` (09-22) avait été crédité sur « chaque alerte porte une décision » : celle-ci n'en porte pas. Correctif : décoder `&amp;` en dernier |
> | ⚠️ Dépôt **privé** du 2026-10-13 au 2026-10-14 (21:51 UTC) | 0 | CodeQL rouge sur quatre pushs (« Code scanning is not enabled »), secret scanning coupé. Rendu public par Axel : relu ce soir, `visibility: public`, secret scanning actif, **une** alerte (n° 1, connue, inerte). Les rouges CodeQL de la fenêtre ne sont pas des alertes |
> | Dependabot | 0 | **4** alertes ouvertes le 10-13, toutes en dépendances de **développement** : `proxy-addr` (critique), `source-map-js` et `@modelcontextprotocol/sdk` (hautes), `postcss-selector-parser` (moyenne). Job `audit` (dépendances de production) vert. À trier, non débitées : rien n'est expédié. ✅ **2026-10-16 : les quatre fermées d'elles-mêmes** (`fixed` à 06:35 UTC, relu par l'API) après `3a645c11` : `proxy-addr` 2.0.8, `source-map-js` 1.2.2 et `@modelcontextprotocol/sdk` 1.32.1 dans leurs plages ; `postcss-selector-parser` 7.1.6 par `overrides`, tailwindcss 3 tirant la ligne 6.x sans version corrigée (sortie Tailwind identique octet pour octet avant et après). Job `audit` vert sur `main` |
> | Base et fonctions | 0 | **77** tables, toutes sous RLS, **205** policies, ledger **170** (dernière `20261013150941`, mig. `220`) ; **12** Edge Functions actives, `send-org-invite` v3 déployée le 2026-10-13, `Edge deploy drift` vert le 10-14 |
>
> **84 → 82.** ⚠️ L'arbitrage `BK-1` à −2 et non plus : la grille ne connaît que « structurel » et
> « limité », et le défaut lui-même est refermé. Ce qui reste ouvert est la conséquence, et elle se
> rembourse au geste `M-68` vérifié.

> ### ⚪ 2026-10-02 (soir) · 0 : production inchangée, et la garde des advisors était aveugle depuis sa pose
>
> **Même règle que le 2026-09-22** : un angle mort ne se rembourse que sur un verdict rendu en CI, un
> défaut que lorsqu'il est corrigé et vérifié. Mesures du soir : CI de `main` à `9ea33927` (dernier
> `e2e` complet : `f301f0bf`, run `37019682064`), production (advisors par l'API, catalogue, ledger),
> dépôt à `HEAD`.
>
> | Item | Effet | Mesuré le 2026-10-02 (soir) |
> |---|---|---|
> | Advisors, relus par l'API | 0 | **11 / 80 / 2 / 1** (`rls_enabled_no_policy` · `authenticated_security_definer_function_executable` · `anon_security_definer_function_executable` · mots de passe compromis, même ordre que plus haut) : identiques au 10-01 |
> | Base et fonctions | 0 | **74** tables (la `211` en retire deux, vides), toutes sous RLS, **194** policies, ledger **162** ; **12** Edge Functions, `Edge deploy drift` vert le 10-02 ; **0** alerte CodeQL, **0** Dependabot ; secret scanning : la seule alerte ouverte est la n° 1, connue (clé du commit initial, projet supprimé, inerte) |
> | 🔴 `check:supabase-posture` comptait **zéro** partout | 0 | l'API Management rend **une entrée par occurrence**, sans `count` ni `findings` ; le script écrasait chaque entrée et retombait sur 0. Les douze runs de `Posture` relus (09-22 → 10-02) impriment tous `0 (-9)`, `0 (-52)`, `0 (-2)`, `0 (-1)` alors que la base était à 10 / 53 / 2 / 1, puis 11 / 80 / 2 / 1. **La hausse 52 → 80 des fonctions DEFINER du mode entreprise est passée sous une garde qui ne pouvait voir aucune hausse** : sa raison d'être, écrite dans sa référence, est pourtant de signaler « la 53ᵉ ». Rouge pour une autre raison (`M-58`), elle n'a jamais rendu de faux vert, et n'avait jamais été remboursée (AM-1) : ni débit ni crédit. ✅ **Corrigé** (`resumerAdvisors` additionne par nom), cas témoin à la forme réelle de l'API, **vu rouge sans le correctif** |
>
> **84 → 84.** ⚠️ Conséquence pour `M-58` : le premier `--update` fera bouger les deux mêmes comptes,
> mais **beaucoup plus loin** : `rls_enabled_no_policy` **9 → 11** (`support_reports`, mig. `150` ;
> `org_webhook_deliveries`, mig. `199`) et `authenticated_…` **52 → 80** (`get_support_stats`,
> mig. `150` ; 25 fonctions `160`-`207` relues le 10-01 par l'audit A-1 ; 2 de la `212`). Tous
> identifiés : le recalage est légitime. Un 81ᵉ ne le serait pas sans réponse à « quel objet ».


## 🔴 BK-1 · sauvegardes de la base EN CLAIR dans un dépôt public · contenu le 2026-10-13, 2 gestes ouverts

**Trouvé par l'audit juridique du 2026-10-13.** `db-backup.yml` déposait chaque jour un `pg_dump`
complet, non chiffré, en artefact GitHub Actions. Le dépôt est public : un artefact s'y télécharge
depuis **n'importe quel compte GitHub connecté**. Le commentaire du workflow affirmait l'inverse.
Exposé du 2026-08-29 au 2026-10-13. C'est une **violation de données** (RGPD art. 4.12) : registre
et brouillons **hors dépôt** (dossier privé d'Axel), procédure [`docs/RGPD-VIOLATION.md`](./docs/RGPD-VIOLATION.md).

| | |
|---|---|
| ✅ Contenu le 2026-10-13 | dump chiffré avant dépôt (gpg AES-256, secret `BACKUP_PASSPHRASE`), relu à l'identique par sha256 avant dépôt, échec FERMÉ sans phrase secrète (`8c6a971d`) ; run `38392672092` vert ; les dumps en clair **supprimés**, l'API publique ne liste plus qu'un artefact, chiffré ; `restore-drill.yml` déchiffre |
| ✅ Fait le 2026-10-16 | `M-68` : sessions révoquées. Relu en base le même jour : 0 session et 0 jeton vivant antérieurs au chiffrement. Mot de passe de la base non changé, décision motivée (un dump ne le contient pas). `dump-check` de `restore-drill` vert sur le dump chiffré, et une garde refuse désormais tout artefact de données de production non chiffré (`467d5115`) |
| ✅ Fait le 2026-10-16 (soir) | `M-69` : notification initiale soumise à la CNIL, **tardive** (échéance de 72 h passée vers 11 h 26 UTC), avec les motifs du retard (art. 33.1). Consignée au registre privé. Notification complémentaire à suivre |
| ✅ Décidé le 2026-10-16 (soir) | `M-70` : **pas d'information des personnes**, décision d'Axel consignée au registre privé avec son motif (gravité déclarée « limitée », l'art. 34 ne l'impose qu'en cas de risque élevé). À rouvrir sur un indice d'usage des données ou sur demande de la CNIL |
| 🔴 Ouvert | `M-71` la phrase secrète est toujours en clair dans le dossier privé |
| ❌ Règle durable | **aucune donnée personnelle en clair dans un artefact, un log ou un fichier d'un dépôt public.** « Il faut être connecté pour télécharger » ne protège rien : tout le monde a un compte GitHub |

✅ **Note recalculée le 2026-10-15** : −2, en entrée de la note ci-dessus. Le −2 se rembourse à
`M-68` vérifié. ⚠️ `docs/DEPLOYMENT.md` § 7 portait encore, le 2026-10-15, la phrase fausse du
workflow (« les artefacts d'un run exigent une authentification ») : corrigée le même jour. Et
`restore-drill.yml`, qui doit désormais **déchiffrer** le dump, est désactivé depuis le 2026-09-01 :
le chemin de récupération chiffré n'a été parcouru que par `db-backup` lui-même (aller-retour
sha256 avant dépôt), jamais par une restauration.

## ✅ TR-1 · `track_hit` réservée au collecteur, REFERMÉ (2026-10-19)

Ouvert le 2026-10-18 sous le titre « la mesure d'audience accepte 3 000 écritures anonymes par
minute ». Refermé le 2026-10-19 : mig. `223` appliquée et relue au catalogue, sonde `anon` refusée.

**Trouvé par la passe du 2026-10-18**, en lisant le rouge de `Posture`
(`anon_security_definer_function_executable` 2 → 3).

| État au 2026-10-19 | |
|---|---|
| ✅ Collecteur à la clé secrète, en production | PR n° 79, fusion `11039a44`, servie (`check:deploy` : `égal`). `api/collect.ts` appelle `track_hit` avec `SUPABASE_SECRET_KEY` (posée par l'intégration Vercel ↔ Supabase, production seulement, type sensible, jamais préfixée `VITE_`), dans l'en-tête `apikey` seulement. Aucun repli sur la clé publique : sans secret, 503 ; base qui refuse, 502, journalisé sans la clé. Relu en production le 2026-10-19 : GET 405, POST sans origine 403, origine étrangère 403, `Origin: null` 403 (un **500** avant, comme un corps `null`) ; une visite de test écrite (204, une ligne à 12:13:11 UTC), donc la clé de l'intégration vise la bonne base |
| ✅ Mig. `223` écrite et prouvée | `REVOKE` à PUBLIC, `anon` et `authenticated`, `GRANT` à `service_role` ; `SECURITY INVOKER` ; plafonds 60 par visiteur et par minute, **300** par minute, **5 000** sur 24 h glissantes. Preuve `supabase/proofs/223.proof.sql` jouée en production dans un bloc qui ne peut que s'annuler : **8 sur 8**, témoin (la 222 en place) rouge sur les six cas attendus, rien laissé. Choix du secret justifié dans l'en-tête de la migration |
| ✅ Mig. `223` appliquée le 2026-10-19 | 12:22 UTC, par `db query -f` sur le fichier lui-même, dans une transaction explicite qui inscrit aussi sa ligne de ledger (`20261019122246`). Corps vivant sauvegardé AVANT (md5 `88325db8…`, le seul retour arrière d'un `CREATE OR REPLACE`). Relue APRÈS : corps md5 `2087347b138e057717adca013b9fef3b`, celui de la preuve ; ACL `{postgres=X/postgres,service_role=X/postgres}` ; `INVOKER`, `search_path` vide ; `anon` et `authenticated` sans `EXECUTE` |
| ✅ Vu de l'extérieur | `POST /rest/v1/rpc/track_hit` avec la clé publique : **200** `false` le 2026-10-18 au soir (chemin invalide, rien d'écrit), **401** `42501 permission denied for function track_hit` le 2026-10-19, y compris avec un chemin valide. Visite par le collecteur après application : 204, une ligne. Advisors : **`13 / 84 / 2 / 1`** |
| ⏳ Reste | recaler `Posture` par `--update` (geste d'Axel, avec son jeton) : attendu exactement ces quatre comptes |

`track_hit(p jsonb)` (mig. `222`) est `SECURITY DEFINER` et exécutable par `anon`. C'est voulu
par l'en-tête de la migration : le collecteur `api/collect.ts` l'appelle avec la clé **publique**.
Mais ce que vérifie le collecteur se contourne en appelant la RPC directement, et la RPC prend
`ip` et `ua` **dans le corps de la requête** :

| Défense | Ce qu'elle tient | Ce qui la contourne |
|---|---|---|
| Même origine, corps ≤ 2 Ko, robots écartés (`api/collect.ts`) | les appels passés par `/api/collect` | `POST /rest/v1/rpc/track_hit` avec la clé publique |
| 60 évènements par visiteur et par minute | un vrai navigateur | un `ip` différent à chaque appel : `visitor` change avec lui |
| 3 000 évènements par minute au total | ✅ tient | rien, mais c'est **4,3 M lignes par jour**, gardées **13 mois** |

**Effet.** Aucune fuite : les deux tables ne se lisent que par `service_role` et par
`get_admin_traffic` (`is_admin()`). Le risque est la **disponibilité** : la base pèse **24 Mo**
(relu le 2026-10-18), le plan Free plafonne à 500 Mo, et une base pleine passe en lecture seule,
**toute l'application avec**. À quelques centaines d'octets la ligne, index compris (estimation,
non mesurée), quelques heures d'appels y suffisent. Second effet : des statistiques d'acquisition
empoisonnables, au moment précis où elles vont servir.
✅ **Mesuré le 2026-10-18 par la preuve `223`** : **442** octets pour une ligne réaliste, **1 810**
au maximum de ce que les `CHECK` admettent, index compris. Au plafond de la `222`, la base se
remplit donc en **1 h 30 à 6 h**. Au plafond journalier de la `223`, au pire 8,6 Mo par jour : 54
jours d'abus continu.

**Correctif proposé, dans cet ordre :**

1. le collecteur appelle la RPC avec un secret **serveur** (variable Vercel sans préfixe `VITE_`,
   jamais servie au navigateur), puis `REVOKE EXECUTE ON FUNCTION public.track_hit(jsonb) FROM
   anon, authenticated` ; ✅ collecteur en production et `REVOKE` appliqué le 2026-10-19 ;
2. plafond global ramené à l'ordre de grandeur réel (quelques centaines par minute), plus un
   plafond journalier ; ✅ 300 par minute, 5 000 sur 24 h, appliqués le 2026-10-19 ;
3. recaler `Posture` par `--update` : attendu **`13 / 84 / 2 / 1`**, les deux fonctions de plus
   que la référence étant `get_admin_revenue` et `get_admin_traffic`, relues.

❌ Ne pas recaler `Posture` avant le point 1 : la référence absorberait `track_hit` sans décision.

## 🟠 G-2 · aucune vérification de l'adresse email à l'inscription (2026-08-27)

> **DÉCISION D'AXEL, 2026-08-29 : la confirmation d'adresse NE SERA PAS activée pour l'instant.**
> Motif : la friction à l'inscription, sur un produit dont le problème mesuré est l'activation
> (0 compte actif sur 7 jours pour 28 comptes). Chaque étape entre « je veux essayer » et
> « j'utilise » coûte des inscrits, et ce coût-là est certain, quand le risque ci-dessous est
> probabiliste.
>
> **Ce n'est donc plus une tâche en attente, c'est un risque accepté**, et il doit être lu comme
> tel : la moitié « délivrabilité » de G-2 est traitée (SMTP Resend en service le 2026-08-29,
> `npm run check:mail` vert pour la première fois), la moitié « vérification d'identité » reste
> ouverte **par choix**.
>
> Ce que la décision NE change pas : l'interrupteur reste à un clic, le front est prêt
> (`AuthForm` affiche « Vérifiez votre boîte mail », verrouillé par test), et les quatre gabarits
> sont posés en production. Réactivable à tout moment, sans développement.
>
> ⚠️ **À rouvrir si l'un de ces trois faits apparaît** : un compte injoignable signalé au support,
> une inscription avec l'adresse d'un tiers, ou l'arrivée du premier client payant (un compte qui
> paie et qu'on ne peut pas joindre est un litige, plus un désagrément).


**Mesuré en base, pas déduit.** Sur les 28 comptes : `confirmation_sent_at` est renseigné sur
**un seul**, et le délai entre `created_at` et `email_confirmed_at` descend à **15 millisecondes**
(< 10 min sur 27 comptes). Ce n'est pas quelqu'un qui clique vite, c'est de l'auto-confirmation :
**les confirmations d'inscription sont désactivées** sur le projet.

**Ce que ça ouvre.** N'importe qui peut créer un compte portant l'adresse d'un tiers — COSMO
traite alors la donnée personnelle de quelqu'un qui n'a rien demandé, et l'adresse est ensuite
inutilisable par son propriétaire légitime. Symétriquement, une faute de frappe crée un compte
**définitivement injoignable** : sans adresse valide, la réinitialisation de mot de passe ne peut
plus rien pour lui.

**Ce n'est pas une élévation de privilège** : l'inscrit contrôle son propre compte, pas celui d'un
autre, et le tiers ne reçoit rien (aucun email ne part). C'est un défaut de **vérification
d'identité déclarative**, avec un versant RGPD (base légale du traitement d'une adresse fournie
par un tiers).

**Pourquoi ça n'a pas été corrigé en le lisant.** Activer les confirmations sans SMTP applicatif
est **pire** que le défaut : chaque inscription partirait par l'expéditeur intégré de Supabase,
plafonné à quelques envois par heure. GoTrue répond alors `over_email_send_rate_limit`, que
`safeAuthError` traduit par « Trop de tentatives. Réessayez dans quelques minutes. » — exact côté
serveur, **trompeur** côté inscrit, qui n'a rien fait de trop et repart. Les deux gestes ne se
séparent pas.

| État | Détail |
|---|---|
| Front | ✅ **Prêt** : `register()` rapporte `needsEmailConfirmation` quand `signUp` ne renvoie pas de session, et `AuthForm` affiche « Vérifiez votre boîte mail » au lieu de pousser l'inscrit vers un écran protégé qui le rejetterait. Verrouillé par `src/components/AuthForm.confirmation.test.tsx`, **vu rouge** sans le correctif (2 cas sur 3), avec un **témoin** pour le régime actuel |
| Gabarits | ✅ Écrits et versionnés (`supabase/templates/`, quatre emails, en français) |
| Garde | ✅ `npm run check:mail` — **rouge aujourd'hui**, 3 contrôles DNS en échec |
| **Production** | 🟠 **Rien n'est changé.** Le SMTP et le réglage vivent dans deux consoles, hors dépôt |
| Marche à suivre | [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) §2ter — **le SMTP d'abord, les confirmations ensuite** |

> ⚠️ **Le sous-domaine d'envoi n'est pas un détail de confort.** La racine `thecosmo.app` porte
> déjà les MX et le SPF d'IONOS, qui servent `contact@thecosmo.app`. Vérifier la racine chez
> Resend et remplacer son SPF couperait l'émission légitime d'IONOS. C'est `send.thecosmo.app`
> qui se vérifie, et la racine ne bouge pas — `check:mail` contrôle les deux, précisément pour
> attraper cette erreur-là.


## 🟠 Surface entreprise `160`-`207` · relecture du 2026-09-30, audit du 2026-10-01 (A-1)

> ✅ **2026-10-01** : la relecture partielle ci-dessous est complétée par un audit **joué en
> production** (tables acteur par acteur, sept fonctions DEFINER de plus). Résultat : § « Audit A-1
> des tables » plus bas. Un défaut nouveau, **E-3**, ouvert et soumis à l'arbitrage d'Axel.

> ✅ **2026-10-16 · AM-6 rejoué en CI** : `e2e/rls/org-surface-entreprise.test.ts`, joué par
> `npm run test:rls` (job `rls-integration`), rejoue **24 tables** (toutes celles que créent les
> mig. `160`-`220` et qui existent encore) pour **6 acteurs** (anonyme, sans organisation, membre,
> manager, admin, admin d'une AUTRE organisation) et **4 opérations** : **624 cellules**, 147
> accordées et 477 refusées, chacune constatée en base sous `service_role` après la tentative du
> client de l'acteur. Vert sur la PR brouillon n° 72 (run `38810405159`, 0 écart). **Vu rouge
> sur deux sabotages** joués sur cette PR, base de CI seulement : policies relâchées
> (`USING (true)`, parentes comprises, run `38859320682`) : les 477 refus deviennent des
> acceptations ; policies retirées (run `38859843934`) : les 147 accès deviennent des refus. Le
> premier passage a trouvé un défaut **du test**, pas du produit : le décor effaçait en cascade
> les lignes filles de trois tables, dont la lecture valait alors 0 pour tout le monde.

🔴 **Aucun audit n'avait relu cette surface** avant le 2026-09-30 : c'est l'angle mort **AM-6**
de la note. La relecture de ce jour est **partielle**, et c'est dit : elle couvre les fonctions
nommées par la session d'audit, les quatre Edge Functions et la file de webhooks. **Elle ne vaut
pas audit** : ni preuve acteur par acteur en base, ni revue des 25 tables et de leurs policies.

| Objet | Garde relue | Verdict |
|---|---|---|
| `set_member_access`, `offboard_org_member` (`194`), `member_departure_impact`, `purge_team_task`, `purge_team_okr`, `trash_team_okr`, `restore_team_okr` | `is_org_admin`, `my_org_perm`, `can_restore_team_okr`, « introuvable » identique à « invisible » | ✅ rien trouvé |
| `create_org_email_invitations` | admin, ou manager avec `member.invite` sous son sous-arbre ; 50 adresses par appel | ✅ rien trouvé (le débit d'ENVOI est W-4) |
| `get_org_billing_history` | propriétaire de l'organisation seulement | ✅ rien trouvé |
| `purge_archived_team_project` | `SECURITY INVOKER`, la policy DELETE décide | ✅ rien trouvé |
| `enqueue_team_task_webhook` | `can_access_team_task`, mais **appelable en RPC** | ✅ **W-3**, mig. `207` **appliquée** le 2026-10-01 (ledger `20261001100535`) |
| `insert_kr_checkin_row` | `can_access_team_okr` (le commentaire dit « peut MODIFIER » : c'est la même règle, la policy UPDATE de `team_key_results` est `can_access_team_okr`) | ✅ **E-1** (appelée seule, elle écrivait un point d'étape **sans** changer la valeur du KR) : mig. `209` **appliquée** (ledger `20261001102425`), la ligne n'est acceptée que si le KR porte cette valeur et cet état posés **dans la même transaction**. En prod : appel direct **accepté avant** (2 points pour 1), **refusé après** (42501), `post_kr_checkin` intact |
| `get_org_member_last_activity` | membre de l'org, admin ou sous-arbre | ✅ **E-2** (un admin suspendu ou expiré relisait toute l'organisation) : mig. `208` **appliquée** (ledger `20261001102420`), même règle que `is_org_member`. En prod : admin suspendu **5 lignes avant, 0 après**, admin expiré idem ; admin actif 5, manager 1 (son sous-arbre), membre 0, autre organisation 0 |
| `send-org-invite` | JWT, lien créé par l'appelant ou admin, relance 1 h | ✅ **W-4**, plafond **déployé** (v2, 2026-10-01) |
| `verify-org-domain` | JWT, admin actif, domaine d'autrui = introuvable | ✅ rien trouvé ; **redéployée** (v2) le 2026-10-01 : elle embarquait l'ancienne `_shared/org-integrations.ts` |
| `org-digest` | `x-cron-secret`, échec fermé | ✅ rien trouvé |
| `org-webhook-dispatch` | `x-cron-secret`, `redirect: 'manual'` | ✅ **W-1** et **W-2**, **déployée** v2 (`verify_jwt = false`) après la `207`, HTTP 200 en CI |
| `get_my_team_kr_projects`, `get_my_team_project_members`, `get_my_team_project_progress`, `get_team_okr_trash`, `leave_organization`, `remove_member`, `my_project_role` (relues le 2026-10-01) | `my_team_project_ids` (passe par `is_org_member`, qui écarte suspendu et expiré), `can_access_team_okr`, `can_restore_team_okr`, `is_org_admin` | ✅ rien trouvé |
| **14** fonctions de trigger en `SECURITY DEFINER` (`validate:migrations` : 19 avertissements), **relues une par une le 2026-10-01** au catalogue | toutes `AFTER` (donc après le `WITH CHECK`), `search_path` vide, aucune exécutable par `anon`/`authenticated`, **aucun `RAISE`** (pas d'oracle B-3), chacune écrit un journal ou une notification au-delà des droits de l'appelant | ✅ légitimes. 🟠 **E-4** : trois d'entre elles (`notify_team_task_status`, `notify_team_project_archived`, `notify_task_comment`) notifiaient un membre **suspendu**, qui lisait encore statuts, commentaires et nom des projets archivés (`org_notifications` se lit par `user_id` seul). Refermé mig. `212` : 3 notifications avant, 0 après |


## ✅ V-1 · script de mesure tiers sur les pages publiques — REFERMÉ (2026-10-18)

Le script de mesure d'audience tiers chargé sur les pages publiques s'était mis, le 2026-09-01,
à lire l'**email** et le **nom** saisis dans les formulaires d'inscription. Mitigé à l'époque en
l'excluant des pages d'identifiants.

**Refermé le 2026-10-18 : le fournisseur est débranché.** La mesure d'audience est internalisée.
Plus aucun script tiers de mesure n'est chargé : `src/lib/audience.ts`, son test, l'empreinte
surveillée et `vendor-watch.yml` sont supprimés, l'origine retirée de la CSP (`script-src` et
`connect-src`). Reste Vercel Analytics, monté après consentement (`ConsentedAnalytics`, `src/App.tsx`).

⚠️ La leçon reste valable : une garde planifiée sans destinataire n'est pas une garde. Les échecs
de garde sont poussés sur `OPS_ALERT_WEBHOOK_URL` (`ci-alert.yml`).

---

## 🟠 Audit des Edge Functions Stripe — 2026-09-02

**Périmètre** : `stripe-webhook` (662 l.), `stripe-org-checkout`, `stripe-org-portal`,
`stripe-create-checkout`, `_shared/org-tiers.ts`, `_shared/org-stripe-prices.ts`, `_shared/alert.ts`,
et `renewal-notice` parce qu'il dépend du même état. Vérifié en base : contraintes, RPC, volumes.

**Aucun finding critique, et ce n'est pas une politesse.** Les gardes qui comptent sont là et sont
justes : signature vérifiée avant toute lecture du corps, marqueur d'idempotence écrit APRÈS le
handler, palier redérivé du price ID et jamais des metadata, refus explicite d'un prix inconnu
plutôt qu'une dégradation au palier gratuit, `getUidFromCustomer` qui refuse un customer portant
`org_id`. Les six findings ci-dessous portent tous sur des chemins d'ERREUR, pas sur le chemin
nominal.

**Mesuré en production le 2026-09-02** : 8 événements Stripe traités (4 `invoice.payment_succeeded`
le 02/07, 4 `customer.subscription.deleted` le 31/07), 0 ligne dans `payment_records`,
0 dans `org_subscriptions`, 54 dans `subscriptions`, 0 doublon de `stripe_customer_id`.

> ⚠️ **Le journal fiscal ne couvre pas ces 8 événements**, et c'est normal : `payment_records`
> naît avec la mig. `125` du 2026-08-26, un mois après. Aucun euro réel n'est concerné (clé Stripe
> de TEST), donc aucune obligation n'a été manquée — mais « le journal couvre tout » est faux, et
> une phrase pareille se dit vite devant un contrôleur.

> ⚠️ **Les numéros de version de ce tableau ont été RECORRIGÉS le 2026-09-14**, relus par l'API
> Management : `stripe-webhook` est en **v33** et `renewal-notice` en **v13**, pas v32 et v12. Ils
> étaient décalés d'une unité — et c'est un défaut instructif : la règle « cite la version
> déployée » a bien été appliquée, mais le chiffre a été **écrit de mémoire juste après un
> déploiement**, donc avant que l'API ne le confirme. Une version se relit, elle ne se déduit pas
> d'un « je viens de déployer ». Le CONTENU, lui, était juste : le job `Edge deploy drift` est vert.
>
> 📋 **Les huit fonctions, relevées par l'API le 2026-09-14 à 15:30 UTC** — `stripe-webhook` **v33**
> (09-13 16:12) · `delete-account` **v17** (09-13 10:16) · `renewal-notice` **v13** (09-13 10:12) ·
> `report-bug` **v12** (09-12 23:08) · `stripe-org-refund` **v6** (**09-14 15:24**) ·
> `stripe-org-checkout` **v15** (09-08 06:31) · `stripe-org-portal` **v12** (09-08 06:32) ·
> `stripe-create-checkout` **v23** (09-06 19:28).
>
> 📋 **Relevé du 2026-09-30 : DOUZE fonctions**, les huit ci-dessus aux mêmes versions, plus les
> quatre du mode entreprise, jamais citées ici avant ce jour (A-2) : `send-org-invite` **v1**
> (09-25), `org-digest` **v2** (09-27, `verify_jwt = false`), `verify-org-domain` **v1** (09-27),
> `org-webhook-dispatch` **v1** (09-27, 🔴 `verify_jwt = true`, W-1). Trois lisent
> `SUPABASE_SERVICE_ROLE_KEY`, deux envoient par Resend, une appelle des URL saisies par les
> clients (W-2). 🔴 `stripe-org-checkout` v15 et `stripe-org-portal` v12 **ne sont plus le dépôt**
> depuis le 2026-09-25 (A-4, `_shared/org-billing-contact.ts` absent de la prod).
>
> 🔴 **Chaque état ci-dessous cite désormais la VERSION DÉPLOYÉE, pas le commit.** Jusqu'au
> 2026-09-13 ils disaient « ✅ corrigé » en décrivant `main`, et trois d'entre eux étaient FAUX
> de la production : `renewal-notice` en ligne portait encore le défaut S-4, et `stripe-webhook`
> tournait sur un `org-stripe-prices.ts` antérieur. C'est la règle de `CLAUDE.md` — *un « ✅ corrigé »
> qui ne dit pas « déployé le … » décrit un commit, pas la production* — et elle n'était tenue
> nulle part ici. Depuis le 2026-09-13, `npm run check:edge` rend **8 fonctions identiques au
> dépôt** et le job `Edge deploy drift` est vert : ces dates sont désormais vérifiées en continu.

| # | Finding | Gravité | État |
|---|---|---|---|
| S-1 | Le pré-contrôle d'idempotence avalait son erreur → rejeu possible de `bump_win_streak` | 🟡 | ✅ corrigé · **`stripe-webhook` v33, déployée le 2026-09-13 à 16:12 UTC** |
| S-2 | `getUidFromCustomer` avalait son erreur → paiement encaissé, abonnement jamais appliqué | 🟠 | ✅ corrigé · **`stripe-webhook` v33, déployée le 2026-09-13 à 16:12 UTC** |
| S-3 | `subscriptions.stripe_customer_id` sans contrainte UNIQUE, alors que le code en dépend | ✅ | mig. `134` **appliquée en prod le 2026-09-02**, doublon refusé en 23505 (vérifié) |
| S-4 | `renewal-notice` : expéditeur par défaut sur un domaine que Resend ne signera jamais | 🟠 | ✅ corrigé · **`renewal-notice` v13, déployée le 2026-09-13 à 10:12 UTC**. 🔴 Ce « ✅ corrigé » était écrit depuis le 2026-09-02 et la PROD portait toujours le défaut : mesuré le 09-13, la v11 en ligne avait encore `?? 'Cosmo <bug@thecosmo.app>'` |
| S-5 | Un event tardif d'un ANCIEN abonnement peut dégrader l'org qui vient de repayer | 🟠 | ✅ corrigé · **`stripe-webhook` v33, déployée le 2026-09-13 à 16:12 UTC** |
| S-6 | La renonciation au droit de rétractation ne quitte jamais le navigateur | ✅ | corrigé · mig. `135` **appliquée en prod le 2026-09-02**, immuabilité et cloisonnement vérifiés |


### 🆕 Hors périmètre de l'audit du 09-02 : `stripe-org-refund` — le chemin qui REND de l'argent

Cette fonction **n'existait pas** le 2026-09-02 : elle est née le 09-12. L'audit ne pouvait donc
pas la voir, et il ne faut pas lire son « aucun finding critique » comme couvrant ce chemin-là.
État relevé le **2026-09-14**, version déployée **v6** (09-14 15:24 UTC), identique au dépôt
(`Edge deploy drift` vert, run `34861975638`).

**Ce qui la protège, et ce que chaque verrou couvre exactement** — ils ne se remplacent pas :

| Verrou | Ce qu'il arrête | Ce qu'il n'arrête PAS |
|---|---|---|
| clé d'idempotence Stripe dérivée de l'`invoice_id` | deux appels **concurrents** | un rejeu tardif : **la clé d'idempotence Stripe expire** |
| pré-contrôle qui RETRANCHE le déjà-rendu (`_shared/refund-replay.ts`) | le rejeu tardif, et le remboursement partiel réémis | rien de ce qui précède l'appel |
| double bornage par l'encaissé (ici + `refundAmount`) | rendre plus que perçu | — |

🔴 **Le deuxième verrou n'a eu AUCUN test jusqu'au 2026-09-14**, alors que cet item déclarait
« une borne » depuis le 09-04. Son arithmétique vivait en ligne dans l'entrypoint Deno, entre deux
appels réseau : inexécutable par quoi que ce soit. Elle est désormais un module TS pur, couvert
par 10 cas (nominal, rejeu, période déjà remboursée, plus un **témoin** qui refuse un zéro
constant), et **vu rouge sur trois sabotages** avant d'être commité.

⚠️ **Deux erreurs symétriques y sont couvertes nommément**, parce qu'elles coûtent de l'argent dans
les deux sens : un remboursement `pending` compte comme rendu (sinon on rembourse par-dessus un
virement en vol) ; un `failed` ou `canceled` ne compte pas (sinon on prive la personne de son
argent après un échec bancaire, définitivement, sans qu'aucun écran ne le dise).

🔴 **Ce qui reste NON PROUVÉ, et qu'aucun test de ce dépôt ne peut prouver** : `refunds.create`, la
résiliation immédiate et la ligne compensatoire négative du journal **n'ont jamais tourné contre
Stripe**. `org_subscriptions` et `payment_records` sont à zéro ligne, il n'existe aucune facture à
rembourser. Et un doute mesurable reste ouvert : le webhook traite **six** types d'events, or
`charge.refunded` n'est arrivé qu'avec la v27 du 09-06 — **rien ne dit que l'endpoint a été mis à
jour avec elle**. Si l'event n'est pas souscrit, la branche est en ligne et ne reçoit jamais rien :
le journal montrerait un encaissement sans son remboursement. Gestes : `a-faire-manuel.md`
**M-37c** puis **M-37b**.

---

### ⚠️ Deux angles morts que cet audit ne pouvait pas couvrir

1. **Le passage en compte live.** `stripe-org-checkout` et `stripe-org-portal` réutilisent le
   `stripe_customer_id` et le `stripe_subscription_id` enregistrés. Ceux d'aujourd'hui vivent dans
   le compte de TEST : le jour où `STRIPE_SECRET_KEY` devient une clé live, un identifiant de test
   présenté à une clé live répond `resource_missing` (404).

   ✅ **Le CODE n'en fait plus un 500** (finding C-71, livré) : `_shared/stripe-errors.ts` expose
   `isResourceMissing`, et les deux fonctions traitent ce cas-là comme « pas de customer » /
   « pas d'abonnement en cours » plutôt que de lever. **Toute autre** erreur Stripe continue de
   relancer — « en cas de doute, faire retenter Stripe, jamais deviner ». Testé
   (`src/modules/billing/stripe-errors.test.ts`).

   🔴 **La DONNÉE, elle, reste à nettoyer**, et c'est la mig. `140` (`reset_stripe_identifiers`),
   **non appliquée**, à jouer DANS la fenêtre de bascule — jamais avant : tant que la clé est une
   clé de test, chaque checkout réécrit un identifiant de test. Geste suivi en `a-faire-manuel.md`
   **M-43**.

   🔴 **« Aujourd'hui `org_subscriptions` est vide, donc le coût est nul » était FAUX d'une table
   sur deux**, et cette phrase portait la décision. Mesuré en prod le 2026-09-04 : `org_subscriptions`
   = 0 ligne, mais **`subscriptions` porte 5 `cus_…` et 2 `sub_…`** du compte de test. Le coût
   n'est pas nul, il est faible — ce qui ne change pas la conclusion (« c'est le bon moment »)
   mais change ce qu'il faut vérifier après la bascule.
2. **Le cache `productIndex`** (`org-stripe-prices.ts`) n'est jamais invalidé en production
   (`resetProductIndex` n'a aucun appelant hors test). Un isolate Deno survit longtemps : après une
   rotation des secrets de prix, il continue d'indexer les anciens produits jusqu'à son recyclage.
   Conséquence bornée (le webhook alerte et Stripe retente), mais elle tombera pile pendant le
   basculement live.

---


## 🔴 Ouvert — bloquant

### A-9 — Plan Supabase `free` : pas de PITR (drill de restauration ✅ exécuté le 2026-09-01)
~~Rétention de backup minimale, aucun Point-In-Time Recovery, et le drill de restauration n'a
jamais été exécuté. **RPO réel jusqu'à 24 h, RTO inconnu.**~~

**Mis à jour le 2026-09-03.** Deux des trois branches sont refermées :

- ✅ **Le drill a été exécuté et réussi le 2026-09-01** : **RTO mesuré 163 s**, 0 table sans RLS,
  129 policies, isolation vérifiée (289 des 724 tâches visibles par un seul utilisateur). Détail
  et bugs de script corrigés en route dans [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) §7. Le
  parcours de mutation n'a pas été rejoué à la main : risque résiduel assumé, décision consignée ;
- ✅ **Le RPO est ramené à 24 h** par un dump quotidien (T-46), et non plus mensuel. Le secret est
  posé et la sauvegarde **tourne** : 4 runs quotidiens verts au 2026-09-02, artefact de 385 ko,
  rétention 30 jours ;
- 🔴 **Aucun PITR, et c'est une décision, pas un retard** : rester en plan Free est un arbitrage
  d'Axel du 2026-08-29 (Pro 25 $/mois, PITR 100 $/mois de plus, pour 19 Mo de base et 28 comptes).
  Conséquence à porter en clair, **le plan Free n'inclut AUCUNE sauvegarde** : ce dump est la
  **seule** copie de la base qui existe.

**Action restante** (compte, non scriptable) : passer en plan Pro puis activer PITR, aux seuils de
réouverture nommés dans [`docs/ROADMAP-60J.md`](./docs/ROADMAP-60J.md).

---

## 🟠 Ouvert — réglages de console Supabase

Aucun ne bloque un déploiement ; tous sont des clics dans le Dashboard.

**Relu ligne par ligne le 2026-09-03** : trois des cinq lignes étaient périmées. Ce tableau se
relit contre la console et contre `docs/ROADMAP-60J.md`, jamais de mémoire.

| # | Action | Où | État au 2026-09-03 |
|---|---|---|---|
| A-10 | **Activer « Leaked password protection »** (HaveIBeenPwned) + minimum 12 caractères. | Authentication → Policies | 🟡 **à moitié**. La longueur minimale est posée, et les **trois** endroits disent 12 (code, serveur, texte affiché sous le champ, ce dernier annonçait encore 8). « Leaked password protection » est **réservée au plan Pro**, donc hors de portée tant que T-01 est écarté : l'advisor `auth_leaked_password_protection` restera rouge, et c'est attendu |
| — | ~~**MFA (TOTP) sur le compte admin.**~~ | Authentication | ✅ **FAIT, et en vigueur.** 2FA posée sur le compte Supabase le 2026-08-29 ; côté applicatif, la mig. `131` (appliquée le 08-31) exige une session `aal2` pour `is_admin()`, et le facteur TOTP est **enrôlé et vérifié** depuis le 2026-09-01. ⚠️ Un seul compte au monde ouvre cette console, et la suppression du facteur en SQL est sa seule porte de sortie |
| — | **Vérifier l'allowlist de redirection OAuth** : un wildcard trop large annulerait une partie du bénéfice de PKCE. | Authentication → URL Configuration | ✅ **FAIT le 2026-08-29** (T-07). `/reset-password` y manquait, donc une réinitialisation retombait sur la Site URL au lieu de l'écran de changement de mot de passe. Les deux jokers Vercel sont conservés **sciemment** : le suffixe appartient au compte d'Axel, et `flowType: 'pkce'` rend le code inexploitable depuis une autre origine |
| — | **Activer « Secure email change »** (confirmation sur l'ancienne ET la nouvelle adresse). | Authentication | ✅ **Déclaré posé le 2026-08-29** (T-08), avec « Secure password change ». Marqué **déclaré et non vérifié** : aucun réglage Auth n'est lisible depuis le dépôt, contrairement à `Confirm email` que `/auth/v1/settings` expose |
| — | **Vérifier la non-réutilisation du mot de passe `DATABASE_URL` historique** + activer le secret scanning GitHub (le dépôt est **public**). | Supabase + GitHub | 🟡 **à moitié**. Secret scanning, push protection et Dependabot **actifs** (T-09). Une fuite réelle confirmée dans l'historique : `.env` commité au commit initial, retiré du suivi ensuite, ce qui n'efface pas l'historique. **Inerte** : ces clés visent un projet supprimé depuis. 🔴 **Reste la réutilisation du mot de passe, qui n'appartient qu'à Axel** |

---

## 🟡 Ouvert — à planifier

- 🔴 **CORRIGÉ le 2026-09-03 (audit A-6)** : ce point disait « aucune version ne clôt les deux
  familles à la fois sous React 18 ». **Faux depuis le 2026-07-28**, et personne n'était revenu
  vérifier. L'avis `GHSA-qwww-vcr4-c8h2` porte en réalité **deux plages disjointes avec chacune son
  propre correctif** — `[7.12.0, 7.18.2)` corrigée en **7.18.2**, `[8.0.0, 8.3.0)` corrigée en
  8.3.0 — que ce paragraphe avait fusionnées en une seule plage (« ≥ 7.12.0 < 8.3.0 »), masquant le
  correctif intermédiaire. `react-router@7.18.2` (publié le 2026-07-28) est **déjà celui installé**
  (`package-lock.json`), et interrogé pour cette version précise, `npm audit` local et l'API OSV
  rendent tous les deux **zéro** vulnérabilité. `GHSA-wrjc-x8rr-h8h6` (l'open redirect) est lui
  aussi fermé, dès 7.18.0. **Conséquence : ce n'est plus un blocage sécurité.** La migration React
  19 + `react-router` 8 redevient une modernisation ordinaire, sans urgence — chiffrage complet
  dans [`docs/MIGRATION-REACT19.md`](./docs/MIGRATION-REACT19.md).
  ⚠️ Ça ne change rien à la règle : ne toujours pas lancer `npm audit fix` sur ce paquet sans
  relire l'avis, un lockfile différent peut encore proposer une rétrogradation.
  La propriété qui rend l'open redirect inexploitable (aucune navigation alimentée par un
  paramètre d'URL) reste **verrouillée par un test**, sans rapport avec la version installée :
  `src/lib/no-open-redirect.test.ts`.
- **CVE dev-only** (`vitest`, `eslint`, `vite`, `glob`/`minimatch`) : jamais servies au
  navigateur. `npm audit fix --force` casserait le peer `eslint-plugin-react-hooks` (vérifié en
  `--dry-run`) → mise à jour outillage dédiée, jamais dans une passe sécurité.
- ✅ **N6 — `useUser()` lit l'identité depuis `localStorage`** — **fermé le 2026-08-24**, et pas
  par le chemin prévu. La sortie annoncée était « consommer `useAuth().user` » ; en vérifiant les
  consommateurs, `useUser` n'en avait **aucun**. Tout `src/modules/user` était mort à l'exception
  d'un hook qui écrivait dans `cosmo_user` — une clé que plus rien ne relisait, ce qui cachait un
  bug de parcours en mode démo (cf. [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) §4). Le
  module a été supprimé ; il ne reste plus une seule lecture d'identité depuis `localStorage`.

---

## Ordre de priorité avant déploiement prod (**relue le 2026-09-30**)

Section référencée par [`CLAUDE.md`](./CLAUDE.md) — elle n'existait plus depuis la refonte
documentaire du 2026-08-14, le lien pointait dans le vide. Restaurée ici.

> ✅ **2026-10-19 : [`TR-1`](#-tr-1--track_hit-réservée-au-collecteur-refermé-2026-10-19) refermé** (collecteur à la clé
> secrète, mig. `223` appliquée). Reste `Posture` à recaler par `--update` (Axel). La liste complète des
> gestes avant l'acquisition, code et mains d'Axel, est dans
> [`docs/README.md`](./docs/README.md) § « Mise à jour du 2026-10-18 ». Le bandeau `BK-1`
> ci-dessous est à jour : `M-68`, `M-69` et `M-70` faits ou décidés le 2026-10-16, reste `M-71`.

> 🔴 **EN TÊTE depuis le 2026-10-13 : [`BK-1`](#-bk-1--sauvegardes-de-la-base-en-clair-dans-un-dépôt-public--contenu-le-2026-10-13-2-gestes-ouverts).**
> Avant tout autre geste de déploiement : révoquer les sessions et changer le mot de passe de la
> base (`M-68`), puis trancher la notification CNIL avant le 2026-10-16 (`M-69`).

> 🔴 **Cette table est restée « à jour 2026-09-02 » pendant dix-huit jours, et TROIS migrations
> écrites depuis n'y figuraient pas** — dont celle qui répare le seul défaut ouvert que voie un
> utilisateur. C'est le défaut exact que la ligne `Migrations écrites, non appliquées : 0` du
> tableau de composition de la note affichait encore, à sa date de 09-02 : vraie ce jour-là,
> recopiée comme un état courant par quiconque ouvrait la page pour savoir quoi déployer.
> **Une checklist de déploiement qui ne se relit pas à chaque migration écrite n'est pas une
> checklist.** Les trois lignes manquantes sont ci-dessous, **deux refermées le jour même**.

| # | Migration | État au 2026-09-20 | Preuve |
|---|---|---|---|
| **P0** | **`136_work_time_stats_okr_from_completions`** (commitée le 2026-09-03) | ✅ **APPLIQUÉE**, ledger `20260920104729` (🔴 corrigé le 2026-09-30 : `20260920105113`, écrit ici, n'existe au ledger d'aucune migration ; le bon numéro est relu en base, cf. [`supabase/migration/CLAUDE.md`](./supabase/migration/CLAUDE.md)) | `pg_get_functiondef` : la fonction vivante cite `kr_completions` et **plus une seule fois** `history`. `SECURITY INVOKER` conservé, `anon` **f** / `authenticated` **t**, index `idx_kr_completions_user_completed_at` posé. Prouvée **AVANT** en transaction annulée, puis rejouée après : sur un compte réel, `okrTime` passe de `0/0/0/0/0` à `300/180/0/0/0` sur mai→septembre, et `tasksTime`, `eventsTime`, `habitsTime` sont **identiques au chiffre près** (critère 4 de la migration) |
| **P1** | **`140_reset_stripe_identifiers`** | ⏳ **non appliquée, délibérément** | À jouer **DANS** la fenêtre de bascule live, jamais avant : tant que la clé est une clé de test, chaque checkout réécrit un identifiant de test |
| **P2** | **`149_admin_stats_excludes_non_users`** | ✅ **COMMITÉE** (`297ddd14`) **puis APPLIQUÉE**, ledger `20260920105522` | `/admin` annonçait **30 utilisateurs, 779 tâches, 454 événements, 32 habitudes** ; il annonce désormais **28 · 658 · 387 · 26**, plus une clé `excluded_accounts = 2`. Un non-admin est toujours refusé en **42501**. Prouvée en transaction annulée avant application, prod remesurée intacte entre les deux |

> ⚠️ **La `149` a été appliquée par le CLI** (`supabase db query --linked -f`, verbatim depuis le
> fichier, pour qu'aucune recopie ne s'interpose sur 374 lignes), **donc sa ligne de ledger a été
> insérée à la main** : le CLI n'inscrit rien, contrairement à `apply_migration`. C'est le même
> chemin que la mig. `145`, avec le même piège — refaire ce chemin sans l'insertion laisserait une
> migration appliquée et invisible du ledger. Le ledger porte **140** entrées après coup.
>
> ⚠️ **Ce que la `136` ne répare pas, et qui se verra tout de suite** : le temps OKR vaut
> `Σ minutes estimées du KR` par complétion. Sur le compte principal, **3 Key Results sur 5
> portent `estimated_time = 0`**, et ce sont ceux des 95 complétions d'août et septembre :
> ces deux mois **restent à zéro**, légitimement. ❌ Ne pas relire ce zéro comme un échec du
> correctif. Mai et juin, portés par les deux KR à 60 min, passent bien à 300 et 180.

⚠️ **La `146` est le contre-exemple, et il est instructif** : elle n'a **aucune entrée au ledger**
mais `events.review_dismissed_at` existe bel et bien en base. Une absence au ledger ne prouve donc
pas qu'une migration manque, exactement ce que dit l'angle mort **D-1**. Seul
`npm run check:migration-coverage` tranche, fichier par fichier.

| # | Action | Nature | Qui | État |
|---|---|---|---|---|
| 0 | **`npm run test:coverage`** bloquait tout déploiement (3 seuils manqués). 115 tests de repository ajoutés, seuils du glob remontés | 🔴 CI | · | ✅ **verte au 2026-08-25 en fin de journée**, cf. [`docs/TESTING.md`](./docs/TESTING.md) |
| 1 | Migrations `109`/`110` (B-1, B-2, B-3 + notifications de commentaire) | 🟠 sécurité + feature | — | ✅ **appliquées et vérifiées en prod le 2026-08-24** |
| 1bis | Migrations `115` → `123` (permissions, FK RGPD, RPC indexables, Realtime, payload borné, fuseau des habitudes, périodicité de facturation) | 🟠 sécurité + perf | · | ✅ **appliquées et vérifiées en prod le 2026-08-25** |
| 1ter | **Migration `130`** (G-1 · lecture d'`org_invitations` restreinte au destinataire, à l'inviteur et aux admins) | 🟠 minimisation RGPD | Claude applique et vérifie, sur demande d'Axel | ✅ **appliquée et vérifiée en prod le 2026-08-29** · parité mesurée acteur par acteur sur les données réelles, `check:drift` propre derrière |
| 1quater | **G-2 — SMTP applicatif pour Auth** ([`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) §2ter) | 🟠 délivrabilité | Axel (deux consoles, non scriptable) | ✅ **EN SERVICE le 2026-08-29** · domaine `send.thecosmo.app` vérifié chez Resend, SMTP posé, limite d'envoi relevée, 4 gabarits collés, email de réinitialisation reçu depuis `noreply@send.thecosmo.app`. `npm run check:mail` **vert pour la première fois**. ⚠️ La confirmation d'adresse reste **volontairement désactivée** (décision d'Axel, cf. section G-2) |
| 1quinquies | **Migration `134`** (S-3 · un customer Stripe ne désigne qu'un seul compte) | 🟠 intégrité facturation | ~~Axel applique~~ appliquée par agent | ✅ **APPLIQUÉE le 2026-09-02** · 0 doublon sur 54 lignes mesuré avant, doublon refusé en 23505 après |
| 1sexies | **S-5** — un event Stripe tardif peut dégrader une org qui vient de repayer | 🟠 revenu | — | ✅ **corrigé le 2026-09-02**, garde asymétrique dans `applyOrgSubscription` |
| 1septies | **Migration `135`** (S-6 · preuve de renonciation au droit de rétractation) | 🟠 preuve juridique | ~~Axel applique~~ appliquée par agent | ✅ **APPLIQUÉE le 2026-09-02**, donc AVANT tout déploiement des fonctions · append-only vérifiée : UPDATE et DELETE refusés même au rôle privilégié |
| 2 | **Réglages de console Supabase** : A-10 (leaked password protection), MFA sur le compte admin, allowlist de redirection OAuth, secure email change | 🟠 clics Dashboard | **Axel** | 🟡 **reste A-10 seul** (relu le 2026-09-30 contre le tableau « réglages de console » plus haut) : MFA ✅, allowlist OAuth ✅, secure email change ✅ déclaré. « Leaked password protection » exige le plan Pro |
| 3 | **A-9 — plan Pro + PITR** | 🔴 résilience, seul bloquant | **Axel** (compte, non scriptable) | 🟡 **reste le PITR, par décision** du 2026-08-29. Le drill de restauration est ✅ **fait le 2026-09-01** (RTO 163 s), et le dump quotidien tourne |
| **3bis** | 🔴 **Mig. `204`** (`team_tasks.health`) : **absente de la prod** alors que le front de `main` l'écrit, et que son commit (`7a9b3db0`) la dit « appliquée ». Le menu « État » d'une tâche pro échoue en production | 🔴 régression visible | appliquée par agent, accord d'Axel | ✅ **APPLIQUÉE le 2026-10-01**, ledger `20261001100113`, colonne et `CHECK` relus ; rejouée en prod sous le rôle d'un membre réel (transaction annulée) : `UPDATE` accepté sous RLS, relu par `get_my_team_tasks`, valeur hors liste refusée en 23514 |
| **3ter** | 🔴 **Mig. `207`** (W-2 SSRF + W-3 enfilement forgeable), puis **redéployer `org-webhook-dispatch`** (W-1, `verify_jwt = false` lu dans `config.toml`) | 🔴 sécurité, dans CET ordre | agent, accord d'Axel geste par geste | ✅ **FAIT le 2026-10-01, dans cet ordre** : preuve jouée **en prod** (passe témoin sans la 207 : failles reproduites ; passe avec : vert), mig. `207` appliquée (ledger `20261001100535`), relue au catalogue, **puis** `org-webhook-dispatch` v2 ; `org-webhook-dispatch.yml` **HTTP 200** |
| **3quater** | 🔴 **Redéployer `stripe-org-checkout`, `stripe-org-portal`, `report-bug` et `send-org-invite`** depuis `main` (A-4, `M-61`, W-4) | 🔴 le code en prod n'est pas celui du dépôt | agent, accord d'Axel | ✅ **DÉPLOYÉES le 2026-10-01** depuis `main` (`af622168`) : `stripe-org-checkout` v16, `stripe-org-portal` v13, `report-bug` v13, `send-org-invite` v2, plus `verify-org-domain` v2 (sa copie de `_shared/org-integrations.ts` avait vieilli avec W-2). `Edge deploy drift` **vert** (`36849106222`) : 12 identiques, 12 sondes |
| **3quinquies** | 🟠 **E-3** : un manager s'ajoute à l'audience d'un OKR confidentiel (`team_okr_members`, et `team_okr_teams` par héritage) | 🟠 élévation dans l'organisation | agent, accord d'Axel | ✅ **APPLIQUÉE le 2026-10-01** (mig. `212`, ledger `20261001132108`), avec E-4 |
| 4 | Test de bout en bout de l'attribution `?ref=` (cf. [`docs/ACQUISITION.md`](./docs/ACQUISITION.md) §3) | 🟡 exige une vraie inscription | **Axel** | ⏳ **en attente**, à jouer **par Google ET par e-mail** : jusqu'au 2026-10-10 une inscription Google ne portait jamais sa source (mig. `217`, ledger `20261010121835`) |
| — | Garde `check:rls` « fonction citée par une policy exécutable par `authenticated` » | prévention (aurait attrapé B-1) | — | ✅ **livrée**, testée |
| — | Garde `validate:migrations` « fonction de trigger révoquée + `SECURITY DEFINER` signalé » | prévention (aurait attrapé B-3) | — | ✅ **livrée**, testée |
| — | Règle ESLint `no-restricted-imports` sur l'alias `@/` | prévention de dérive | — | ✅ **livrée** |

Les trois dernières lignes comptent autant que les correctifs : B-1 et B-3 sont deux **régressions
de règles déjà écrites**, chacune arrivée dans la migration qui suivait celle qui posait la règle.
*Une règle non vérifiée par un script n'est pas une règle* — et une garde qu'on n'a jamais vue
rouge n'est pas une garde, d'où `scripts/migration-guards.test.mjs`.

## Règles durables issues des audits

Ces règles ont chacune coûté un finding. Elles s'appliquent à tout nouveau code.

- **Un réglage qui vit dans une console d'éditeur n'est vérifié par personne** (G-2, 2026-08-27).
  Le dépôt gouverne son code, ses migrations et ses secrets — mais ni les réglages
  d'authentification Supabase, ni la zone DNS. Six semaines d'audits n'ont pas vu que les
  confirmations d'inscription étaient désactivées, parce qu'**aucune de ces surfaces n'apparaît
  dans un `grep`**. À chaque fois qu'un comportement du produit dépend d'un réglage hors dépôt,
  écrire le script qui va le lire là où il vit : `check:mail` interroge le DNS, comme
  `check:drift` interroge la base. Sinon la doc décrit une intention, jamais un état.
- **Une purge n'est pas un contrôle d'accès** (G-1, 2026-08-27). La mig. `112` faisait expirer les
  refus d'invitation au bout de 30 jours ; pendant ces 30 jours toute l'organisation les lisait.
  Borner la **durée** d'une donnée et borner son **public** sont deux gestes distincts, et le
  premier donne l'illusion d'avoir fait le second.
- **Un indice d'affichage persisté n'est jamais une autorisation** (2026-08-27, `wasOrgMember`).
  Un drapeau posé dans `localStorage` pour réserver la place d'une entrée de navigation doit
  rester **sans effet sur la donnée** : l'écran cible redirige toujours quand la vérité arrive, et
  la RLS gouverne toujours la lecture. Le jour où un tel indice décide d'un affichage de contenu,
  il devient une décision d'accès prise côté client.

- **La RLS dit ce qu'on a le DROIT de lire, jamais ce qu'on VEUT compter.** Une fonction de calcul
  métier doit filtrer explicitement (`user_id = auth.uid()`), sinon son périmètre change au gré
  des policies — c'est ainsi que `get_work_time_stats` s'est mise à agréger tout un sous-arbre
  managérial (A-1, corrigé mig. 085).
- **Une RPC `SECURITY DEFINER` n'est pas protégée par la RLS** : son périmètre ne tient qu'à sa
  propre logique. Elle doit donc être testée contre une vraie base
  (`e2e/rls/get-my-tasks.test.ts`), pas mockée, et `REVOKE` pour `anon` (A-5).
- **Une règle non vérifiée par un script n'est pas une règle** : les invariants RLS ne vivaient
  que dans la doc et avaient déjà régressé trois fois (mig. 059, 077, 082). D'où
  `npm run check:rls`, bloquant en CI (A-4).
- **`auth.uid()` doit être wrappé** — même imbriqué dans un argument de fonction
  (`get_subtree(org_id, auth.uid())`), sinon il est ré-évalué par ligne. **Les advisors Supabase
  ne voient pas ce cas** : ils ne descendent pas dans les arguments d'appel (A-2).
- **Une seule policy PERMISSIVE par rôle + action** (mig. 049) : élargir le `OR` existant, ne
  jamais en créer une seconde.
- **La RLS ne filtre pas les colonnes.** Auditer aussi `information_schema.column_privileges`
  (audit du 2026-07-26, mig. 083).
- **Toute table technique qui grossit doit avoir une purge** : `processed_stripe_events` (A-6,
  rétention 90 j) ; toute sauvegarde de données personnelles doit avoir une date de péremption
  (A-11, RGPD art. 5.1.e).
- **Frontière de sécurité = RLS + whitelist `mapToDb`.** zod est une garde UX, pas une frontière.
  `mapToDb` ne doit **jamais** émettre `user_id` ni `recurrence_parent_id`.
- **Un trigger de garde doit être `SECURITY INVOKER`** (audit 2026-07-26) — et une fonction de
  trigger doit être `REVOKE`-ée pour `anon` (mig. `064b`, `094b`). Enfreint par la mig. `108`
  (B-3) alors que la mig. `107`, écrite le même jour, respecte la règle : **une règle qu'aucun
  script ne vérifie régresse dès la migration suivante**.
- **Un helper `SECURITY DEFINER` ne doit pas être exposé en RPC** : le corriger par un `REVOKE`
  suffit, parce que dans une fonction `SECURITY DEFINER` le rôle effectif est le propriétaire —
  mais **une policy, elle, s'évalue avec le rôle courant**. Toute policy qui appelle un helper
  directement a donc besoin d'un helper resté exécutable (mig. `100` ; régression B-1 avec la
  mig. `107`).
- **Un trigger `BEFORE` s'exécute avant le `WITH CHECK` de la RLS.** En `SECURITY DEFINER`, ses
  messages d'erreur deviennent un canal d'information sur des lignes qu'on n'a pas le droit de
  lire (B-3).
- **Un correctif appliqué en prod se versionne sous son propre numéro**, jamais par édition du
  fichier déjà appliqué. Sinon le ledger porte une version que le dépôt ne contient pas, et
  personne ne le voit tant que rien ne rejoue les migrations à blanc (`119b`, 2026-08-25 : sans
  gravité cette fois, le contenu était identique, mais c'est le mécanisme exact de la dérive
  repo ↔ prod).
- **Une nouvelle surface d'autorisation se livre avec son test contre une base réelle**, dans le
  même commit. Une policy ne se prouve pas par relecture : `e2e/rls/org-permissions.test.ts`
  (mig. `115`) est le modèle à suivre.

---

## Migrations

L'état des migrations n'est **pas** décrit ici — il périme trop vite. Sources de vérité :

```bash
npm run validate:migrations   # garde statique (CI)
npm run check:rls             # invariants RLS (CI)
npm run check:drift           # dérive repo ↔ prod, 2 étapes (cf. docs/DEPLOYMENT.md)
```

### État au 2026-10-01 (relu au ledger ET au catalogue)

Dépôt : **186 fichiers**, dernière `210_invite_domain_only_closes_open_links.sql`. Ledger : **160
entrées**, cinq de plus que la veille, toutes posées par `apply_migration` le 2026-10-01 :

| Migration | Ledger | Vérifié au catalogue |
|---|---|---|
| `204_team_task_health` | `20261001100113` | colonne `text` nullable, `CHECK` sur trois valeurs |
| `207_org_webhooks_hardening` | `20261001100535` | contrainte `NOT VALID` à TLD alphabétique ; garde `pg_trigger_depth()` en tête du corps |
| `208_member_last_activity_respects_suspension` | `20261001102420` | corps vivant **identique octet pour octet** au fichier (comparateur vu rouge sur un corps différent) |
| `209_kr_checkin_row_same_transaction` | `20261001102425` | idem |
| `210_invite_domain_only_closes_open_links` | `20261001102453` | idem, pour les deux fonctions |

✅ `npm run check:migration-coverage` contre la prod : **0 « absent des deux »** sur 186 fichiers.
La `196` y était rouge à tort : la `200` fait `DROP TABLE` de ses deux tables, ce qui emporte
index, policies, triggers et contraintes sans les nommer, et la garde ne savait pas le lire.
Corrigé dans la garde, avec trois témoins dont deux qui refusent d'en faire trop (un `DROP
TABLE` d'une autre table n'excuse rien, et une fonction survit à sa table).
⚠️ Les onze migrations hors ledger (`164`, `181`, `190`-`195`, `197`-`199`) **n'ont pas été
inscrites**, par décision d'Axel : une ligne écrite après coup, à une date fausse, ne prouve rien
que le catalogue n'ait déjà prouvé, et la garde les range déjà en « objet en base ».
✅ `212_okr_audience_and_suspended_notifications` : ledger `20261001132108`, cinq corps identiques au fichier (E-3, E-4).
⏳ `206` (jalons) reste **non appliquée, délibérément** ; `211` appartient à une autre session.


## Stripe

**Audité pour la première fois le 2026-09-02** — voir la section « Audit des Edge Functions
Stripe » plus haut. La plomberie est complète et déployée ; ce qui manque n'est pas du code.

- L'encaissement est **désarmé** : `ENTERPRISE_BILLING_ENFORCED = false` ET
  `billing_flags.enterprise_seat_limit = false` (mig. `124`). Les deux drapeaux se déplacent
  ensemble, cf. [`CLAUDE.md`](./CLAUDE.md).
- `STRIPE_SECRET_KEY` est une clé de **TEST**. Les customers et abonnements enregistrés vivent donc
  dans le compte de test.
- 🔴 **Le basculement en compte live doit remettre à zéro les identifiants Stripe en base**
  (`org_subscriptions.stripe_customer_id` / `stripe_subscription_id`, idem `subscriptions`) :
  `stripe-org-checkout` et `stripe-org-portal` les réutilisent tels quels, et un identifiant de test
  présenté à une clé live répond 404, donc 500. Les deux tables sont vides ou presque
  aujourd'hui — c'est le moment le moins cher pour le faire.
- Secrets nécessaires : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`
  (particulier), les quatre `STRIPE_ORG_PRICE_*` mensuels (les annuels se dérivent, cf.
  `_shared/org-stripe-prices.ts`), et l'endpoint webhook côté Stripe.
  Détails : [`docs/POST-AUDIT-GUIDE.md`](./docs/POST-AUDIT-GUIDE.md).

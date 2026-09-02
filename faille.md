# Sécurité — findings ouverts & priorités — COSMO 1.2

**Source de vérité sécurité du projet.** Ce fichier ne contient que ce qui est **encore ouvert**
et les **règles durables** tirées des audits.

- Historique complet (preuve des corrections, audits datés 2026-04 → 2026-08, anciens ordres de
  priorité) : [`docs/archive/faille-historique.md`](./docs/archive/faille-historique.md) — **archive, non maintenue**.
- Procédures et patterns : [`docs/SECURITY.md`](./docs/SECURITY.md).
- Dernière vérification de ce fichier contre le code **et contre la prod** : **2026-09-02**
  (audit des Edge Functions Stripe, findings `S-1` à `S-6`, quinze requêtes de lecture en base).
  Relu contre le code de `main` le **2026-08-27** (ajout du finding G-1, mig. `130`). ⚠️ Les
  chiffres d'advisors et de policies de ce fichier datent toujours du 08-25 : la campagne du 09-02
  n'a mesuré que la surface de facturation, pas la RLS.

Légende : 🔴 bloquant · 🟠 important · 🟡 à planifier · ✅ corrigé

---

## Note de sécurité : 82 → 86 → **84 / 100** (2026-08-24 → 2026-09-02)

> ### 🟠 2026-09-02 · la note BAISSE de 2, et c'est l'audit qui l'a fait baisser
>
> Rien ne s'est cassé : six findings sont apparus parce qu'on a enfin regardé la surface de
> facturation. La ligne « findings ouverts dans le code » disait 0 depuis le 08-24 ; elle disait 0
> **parce que personne n'avait lu les Edge Functions Stripe**, pas parce qu'elles étaient propres.
>
> *Une note qui monte quand on cesse de chercher ne mesure pas la sécurité, elle mesure
> l'attention.* Les six correctifs livrés le même jour ne la font pas remonter : ils réparent des
> trous que la note n'avait jamais comptés.
>
> ~~**Ce qui la retient à 84**, ce ne sont plus des findings ouverts — il n'y en a plus — mais deux
> migrations **écrites et non appliquées** (`134`, `135`).~~ ✅ **Les deux ont été APPLIQUÉES en
> production le 2026-09-02 au soir** (ledger `20260902162407` et `20260902162428`), et vérifiées
> acteur par acteur dans une transaction annulée : doublon de `stripe_customer_id` refusé en 23505,
> consentement incomplet refusé par la CHECK, UPDATE et DELETE refusés par le trigger **même au rôle
> privilégié**, une seule policy et aucune policy d'écriture, un compte tiers ne voit rien. Le motif
> qui retenait la note est donc levé le jour même. Un correctif non déployé n'est pas un correctif —
> et celui-ci l'est.

> ### 🔴 2026-08-29 · la note ne bouge pas, mais une de ses justifications était fausse
>
> Le +4 du 2026-08-25 était en partie porté par cette phrase, écrite plus bas : la mig. 115 est
> arrivée avec « **337 lignes de test d'intégration contre une vraie base dans le même commit** ».
> Le test existe, il est bon, et **il n'avait jamais été vert en CI** : le job `rls-integration`
> échouait dessus depuis sa création. Un test rouge qu'on n'ouvre pas ne vaut pas mieux qu'un test
> absent, et il coûte en plus la confiance qu'on lui accorde.
>
> **Ce que le test reprochait n'était pas la base.** Rejeu mesuré sur base vierge, sous le rôle
> `authenticated` avec un `auth.uid()` forgé : `is_org_admin` vrai, `my_org_perm` vrai, insertion
> **acceptée**. Le refus venait de la RELECTURE demandée par `.insert().select()`, soumise à
> `can_access_team_project(id)`, qui cherche en table une ligne pas encore visible. Le test
> éprouvait une forme d'appel que l'application n'utilise nulle part, et que `createProject`
> documente comme telle depuis le bug #9.
>
> **Depuis le 2026-08-29, le test passe** : la justification est enfin vraie. La note ne monte pas
> pour autant, parce qu'aucune protection nouvelle n'a été mise en vigueur, et parce que le crédit
> avait déjà été versé. *Une note qui récompense une garde doit d'abord vérifier que la garde
> tourne.*
>
> ~~G-1 reste ouvert en production~~ → ✅ **G-1 est REFERMÉ le 2026-08-29** : mig. `130` appliquée en
> production et vérifiée en base, pas sur parole (voir la section G-1).

| Ce qui compose la note | 08-25 | 08-27 | **09-02** |
|---|---|---|---|
| Findings High/Critical exploitables | 0 | 0 | **0** |
| Findings ouverts dans le code | 0 | 0 | **0** · `S-5` et `S-6` refermés le jour même |
| Migrations écrites, **non appliquées** en prod | 0 | 0 | **0** · `134` et `135` appliquées le 2026-09-02 au soir |
| Surface auditée au moins une fois | pages + RLS | idem | **+ les 4 Edge Functions Stripe** |
| Findings ouverts **en production** | 0 | 0 | ~~🟠 1 · G-1~~ → **0 au 2026-08-29**, mig. 130 appliquée et vérifiée |
| Bloquants restants, **hors dépôt** | A-9 (pas de PITR) + 5 réglages de console | **inchangés** | **inchangés** |
| Gardes automatiques vertes | 4 | **4** (+ périmètre élargi : 128 policies, 127 migrations) | **4** · `check:rls` 0 violation, `validate:migrations` 0 erreur avec la mig. 130 |
| Nouvelle surface livrée **avec** son test de base réelle | · | ✅ `org_member_permissions` (mig. 115) + `e2e/rls/org-permissions.test.ts` | ⚪️ sans objet, aucune nouvelle surface |
| Fonctions `anon`-exécutables | 2 (les deux volontaires) | 2 | 2, non remesuré |

**+4, et pas davantage.** Les neuf migrations du 2026-08-25 (`115` → `123`) n'ont ouvert aucune
faille : la plus sensible, un système de permissions par membre, est arrivée avec sa policy, son
trigger de garde en `SECURITY INVOKER`, ses `REVOKE`, et **337 lignes de test d'intégration contre
une vraie base dans le même commit**. C'est la première fois qu'une brique entreprise fait ça, et
c'est ce que la note récompense.

Ce qui l'empêche de monter plus haut n'a pas bougé d'un pouce : **A-9** (plan Free, pas de PITR,
restauration jamais testée) et les réglages de console. Ce sont les deux seules choses qui
séparent « aucune faille connue » de « rattrapable en production », et aucune n'est du code.

### 2026-08-27 · note inchangée, et c'est le bon résultat

**Rien n'a changé en production.** Un finding de minimisation connu depuis le 2026-08-24 (noté
alors sous B-2, « reste ouvert, non traité ») a reçu son correctif dans le dépôt, la **mig. 130**,
qui **n'est pas appliquée**. Écrire une migration ne referme rien : tant qu'elle n'est pas passée
en base, l'état de la prod est exactement celui du 25. La note ne peut donc pas monter, et elle ne
baisse pas non plus, le finding n'étant pas nouveau.

Deux points de vigilance sont apparus par ailleurs, tous deux vérifiés et **sans impact
d'autorisation** :

- **`wasOrgMember` (commit `f32d080`) est un INDICE D'AFFICHAGE persisté, jamais une
  autorisation.** Il réserve la place de l'entrée « Entreprise » dans la navigation pendant que la
  requête vole, à partir de la préférence d'organisation déjà stockée sur l'appareil. Il ne
  débloque aucune donnée : `/entreprise` redirige toujours vers le tableau de bord si `activeOrg`
  est nul une fois la requête résolue, et toute lecture reste gouvernée par la RLS. **Pire cas :
  une entrée de navigation affichée une seconde de trop** chez quelqu'un qui vient de quitter sa
  dernière organisation depuis un autre appareil. L'indice est effacé dès que la requête répond
  « aucune organisation », et il ne traverse pas un changement de compte (vérifié par test).
- **Le seed de démo passe de deux organisations à une seule** (`180fba1`). Effet de bord voulu :
  sous une seule organisation la navigation redevient un vrai `<a href="/entreprise">` au lieu
  d'un menu. La couverture des **refus non-admin**, qui dépendait de la seconde organisation, a
  été reconstituée dans les tests (`seedSecondOrg`), **pas supprimée** : c'est la seule condition
  qui rendait ce retrait acceptable.

---

## Gardes automatiques · état au 2026-08-25

| Garde | Résultat |
|---|---|
| `npm run check:rls` | ✅ **128 policies sur 81 migrations, 0 violation** (120/68 au 08-24) · règle 3 comprise : toute fonction citée par une policy doit rester exécutable par `authenticated` |
| `npm run validate:migrations` | ✅ **127 fichiers, 0 erreur, 6 avertissements**, les **mêmes** 6 qu'au 08-24 : 5 préexistants (doublons `000`/`007`/`010`, deux `FOR UPDATE` sans `WITH CHECK`) + 1 informatif (mig. `110`, trigger de notification en `SECURITY DEFINER`, légitime). Les sept migrations du 25 n'en ont ajouté aucun |
| `npm run typecheck` · `npm run lint` | ✅ 0 erreur (27 warnings Fast-refresh tolérés) — + règle `no-restricted-imports` sur l'alias `@/` |
| `npm run i18n:check` | ✅ 19 namespaces, 0 erreur |
| `npm test` | ✅ **1 736 tests / 151 fichiers**, tous verts (1 583 / 143 au 08-24) |
| `npm run test:coverage` | ✅ **VERTE au 2026-08-25 en fin de journée** (26,96 L / 26,65 S / 21,32 F / 22,75 B). Elle était rouge sur 3 seuils quelques heures plus tôt : refermée par **115 tests de repository**, sans qu'aucun seuil ne soit baissé, et les seuils du glob `supabase.repository.ts` ont été **remontés** (65 → 74 statements). Cf. [`docs/TESTING.md`](./docs/TESTING.md) |
| Advisors Supabase (sécurité) | 5 INFO `rls_enabled_no_policy` (tables analytiques, **deny-all volontaire**), 1 WARN `auth_leaked_password_protection` (= A-10 ci-dessous), 51 WARN `authenticated_security_definer_function_executable` (48 au 08-24 : les 3 nouvelles RPC de lecture), **2** WARN `anon_security_definer_function_executable`, les deux volontaires, aucun de plus après sept migrations |
| Couverture RLS | ✅ **toutes** les tables `public` ont RLS activée (vérifié en prod : `relrowsecurity = false` sur 0 table) |
| Migrations appliquées en prod | ✅ ledger à jour jusqu'à `123_org_subscriptions_billing_interval` (relu en base le 2026-08-25 au soir) |

Les fonctions exécutables par `anon` étaient **cinq** au 2026-08-24. Deux le sont
volontairement : `preview_share_link(uuid)` (aperçu d'un lien d'invitation avant connexion) et
`record_demo_visit(uuid)` (comptage des visites de démo). Toutes deux prennent un UUID non
devinable en argument — à ne pas « nettoyer » par erreur. Les trois autres
(`seed_default_categories`, `validate_team_task_dependency`,
`prevent_team_task_dependency_cycle`) sont des **fonctions de trigger** : Postgres refuse leur
appel direct, elles ne sont donc pas exploitables, mais elles violaient la règle de durcissement
posée par les migrations `064b` / `094b` (cf. B-3). **La mig. `109` les révoque** — l'advisor
retombera à deux dès qu'elle sera appliquée.

## État global

**Aucun finding High ou Critical exploitable** (dernière passe complète : **2026-08-25**, contre
la prod `ykeugqfgklejcdbrmawy`). Risque global : **faible**.

### Ce que la vague du 2026-08-25 a changé (mig. `115` → `123`)

- ✅ **`org_member_permissions` (mig. 115)**, dix droits surchargeables par membre. Nouvelle
  surface d'autorisation, donc nouveau risque potentiel ; elle arrive avec sa policy, un trigger
  de garde en `SECURITY INVOKER` (règle B-3 respectée dès le premier jet, pas après coup), les
  `REVOKE` correspondants, et `e2e/rls/org-permissions.test.ts` contre une base réelle. Deux
  invariants méritent d'être relus avant toute évolution : `assign_targets = NULL` (aucune
  décision → tout le monde) et `{}` (personne) sont **opposés**, et **aucune ligne ne peut être
  posée sur un admin**, sinon un admin se retire un droit et bloque son organisation sans chemin
  de retour.
- ✅ **`friends.friend_user_id` : `SET NULL` → `CASCADE` (mig. 116)**, la prod divergeait du
  dépôt sur la sémantique d'effacement d'une table qui porte l'email et le nom d'un tiers. Défense
  en profondeur : la purge explicite de `delete-account` reste le rempart principal. Détail :
  [`docs/RGPD.md`](./docs/RGPD.md) §2.
- ✅ **Trois RPC de lecture (`117`, `119`, `121`)**, toutes `REVOKE`-ées pour `anon`, exécutables
  par `authenticated` seulement. L'advisor `anon_security_definer_function_executable` est resté à
  **2** (les deux volontaires) après sept migrations : le durcissement de la mig. `109` tient.
- ⚠️ **Une entrée de ledger sans fichier** : `119b_habits_bounded_payload_future_guard` est
  appliquée en prod et n'existe pas dans `supabase/migration/`. Vérifié : son contenu est
  **identique** à celui du fichier `119` du dépôt (le correctif a été replié dans le fichier
  d'origine au lieu d'être versionné à part), donc rejouer le dépôt sur base vierge donne le
  **même** état final. Dérive de forme, pas de fond, mais c'est exactement le motif que
  [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) §5 a mis six semaines à voir la première fois.
  **Règle : un correctif appliqué en prod se versionne sous son propre numéro, jamais par édition
  du fichier déjà appliqué.**

Trois choses ont changé depuis le 2026-08-14 :

- ✅ **La fuite inter-organisations par les helpers RLS est refermée** (mig. `100`, appliquée en
  prod le 2026-08-23). Vérifié en base :
  `has_function_privilege('authenticated', 'get_subtree', 'EXECUTE')` → **false**, idem
  `has_subordinates` et `org_admin_count`. Finding + PoC archivés dans
  [`docs/archive/faille-historique.md`](./docs/archive/faille-historique.md).
- 🟠 **Trois findings ouverts par la vague entreprise du 2026-08-23/24** (migrations `103` → `108`) :
  B-1, B-2, B-3.
- ✅ **Les trois sont refermés, dépôt ET production.** Migration `109` appliquée en prod le
  2026-08-24, vérifiée en base immédiatement après (policy, droits d'exécution, `prosecdef`).
  Advisor `anon_security_definer_function_executable` retombé de 5 à **2** — les deux seules
  fonctions volontaires (`preview_share_link`, `record_demo_visit`).

Un seul **bloquant** subsiste côté sécurité, et c'est un point de **résilience**, pas une faille :
le plan Supabase `free`. Tout le reste est du réglage de console Supabase.

---

## ✅ B-1 · refermé (mig. 109, appliquée en prod le 2026-08-24)

**Ce que c'était.** La mig. `100` a fermé la fuite des helpers en révoquant `EXECUTE` à
`authenticated` sur `get_subtree` — et a réécrit la seule policy qui l'appelait **directement**,
`org_team_members_insert`, en `is_above(org_id, user_id)`. Sept jours plus tard, la mig. `107`
(leads d'équipe) a créé `org_team_members_update` **en réintroduisant le motif supprimé** :

```sql
OR user_id IN (SELECT public.get_subtree(org_id, (select auth.uid())))   -- 🔴
```

Un `WITH CHECK` de policy s'évalue **avec le rôle courant** (`authenticated`), pas avec le
propriétaire : l'appel est refusé au niveau des droits.

**Ce n'était pas une fuite — ça échoue fermé.** C'était une **fonctionnalité cassée en prod** : le
`OR` court-circuite pour un admin et pour quelqu'un qui modifie sa propre ligne, mais dès qu'un
**lead ou manager non-admin** nomme un lead sur un subordonné (`setTeamLead`,
`src/modules/org-teams/supabase.repository.ts`), Postgres renvoie
`ERROR: permission denied for function get_subtree`. Exactement le cas d'usage de la mig. `107`.

**Correctif (mig. 109)** : `public.is_above(org_id, user_id)`, qui est à la lettre
`p_user IN (SELECT get_subtree(p_org, auth.uid()))` (vérifié via `pg_get_functiondef`) — sémantique
identique, droit d'exécution conservé.

**Garde ajoutée** : `npm run check:rls` refuse désormais toute policy citant une fonction révoquée
à `authenticated`. Il rejoue les `GRANT`/`REVOKE` de tout l'historique et évalue l'état final.
Vérifié en réinjectant la régression : le script sort **exit 1** avec le nom de la fonction.
Verrouillé par `scripts/migration-guards.test.mjs`.

## ✅ B-2 · refermé (mig. 109, appliquée en prod le 2026-08-24)

**Ce que c'était.** `invite_friend_to_org` (mig. `105`) n'exigeait que `is_org_member(p_org)`, là
où les deux autres chemins d'entrée dans une organisation sont bien plus stricts — vérifié en prod
sur `pg_policies` :

| Chemin | Qui pouvait l'ouvrir |
|---|---|
| `org_invite_links_insert` (lien / code) | admin **ou** manager ayant des subordonnés (`i_have_subordinates`) |
| `organization_join_requests` (demande spontanée) | l'admin décide (`respond_join_request`) |
| **`invite_friend_to_org` (mig. 105)** | **n'importe quel membre** 🟠 |

Pas d'élévation de privilège (l'entrant arrive `role = 'member'`, `manager_id NULL`) et le quota de
sièges était bien vérifié à l'acceptation ✅ — mais la feuille la plus basse de la pyramide pouvait
faire entrer un tiers, et consommer un siège payant une fois le paywall actif, sans qu'aucun admin
ne l'ait décidé.

**Décision (Axel, 2026-08-24)** : aligner sur le chemin du lien d'invitation. La mig. `109` ajoute
`is_org_admin(p_org) OR i_have_subordinates(p_org)` en tête de la RPC — le **même** prédicat que
`org_invite_links_insert`, pour qu'il n'y ait qu'une seule réponse à « qui peut faire grossir
l'organisation ».

**Le front était déjà aligné, par chance et non par conception** : `OrganizationPage` monte
`InviteFriendsToOrg` sous `isAdmin`, et `AddUnderSheet` sous
`canEdit = isAdmin || isManagerOf(members, currentUserId)` — or `isManagerOf` est, à la lettre,
« quelqu'un a `managerId === moi` », c'est-à-dire `i_have_subordinates`. Aucun changement d'écran
n'a donc été nécessaire ; la clé d'erreur `api.not_allowed_to_invite` est ajoutée aux deux
catalogues comme filet, pas comme parcours attendu.

**Vérifié en base le 2026-08-24** : `invite_friend_to_org(uuid, uuid)` redéployée avec la garde,
signature inchangée.

> ⚠️ **Reste ouvert, non traité** : `org_invitations_select` laisse tout membre lire l'`invitee_id`
> de toutes les invitations, **y compris refusées**, sans date de péremption. Ce ne sont que des
> UUID, mais c'est une trace persistante d'un refus. Cf. [`docs/RGPD.md`](./docs/RGPD.md) §1.
>
> 🟠 **Suivi le 2026-08-27 : ce point devient le finding G-1**, correctif écrit (mig. `130`),
> **non appliqué en production**. Détail ci-dessous.

## ✅ G-1 · `org_invitations_select` · REFERMÉ le 2026-08-29, mig. `130` appliquée

**Ce que c'est.** La policy posée par la mig. `105` est
`(auth.uid() = invitee_id) OR is_org_member(org_id)` : **tout membre** de l'organisation lit
l'`invitee_id` de **toutes** les invitations émises en son nom, y compris celles qui ont été
**refusées**. Autrement dit, « telle personne a refusé de rejoindre cette entreprise » est lisible
par n'importe quel collègue, alors que ni l'inviteur ni le destinataire ne le lui ont partagé.

**Ce n'est pas une élévation de privilège.** Ce ne sont que des UUID : ni email ni nom, la policy
de `profiles` tient toujours la frontière. C'est un défaut de **minimisation** (RGPD art. 5.1.c),
sur une donnée qui est une décision individuelle rattachée à une personne identifiable par
jointure.

**Ce qui avait déjà été fait, et ce qui restait.** La mig. `112` a traité la **péremption** (les
refus de plus de 30 jours sont purgés par `pg_cron`). Elle n'a pas touché au **périmètre** de
lecture : pendant ces 30 jours, et pour toute invitation en attente, toute l'organisation lit la
ligne. *Une purge n'est pas un contrôle d'accès.*

**Correctif (mig. `130`)** : lecture restreinte à trois personnes, le **destinataire**,
l'**inviteur** (il doit voir « en attente » pour ne pas réinviter) et un **admin** de
l'organisation. Une seule policy PERMISSIVE, le `OR` existant est élargi (invariant mig. 049).

**Impact client : nul.** La seule lecture directe de cette table côté application est
`getPendingSentInvitationIds`, qui filtre déjà `inviter_id = auth.uid()`. La boîte de réception du
destinataire passe par `get_my_org_invitations`, une fonction `SECURITY DEFINER` que cette policy
ne gouverne pas.

| État | Détail |
|---|---|
| Dépôt | ✅ `supabase/migration/130_org_invitations_select_narrowed.sql`, `check:rls` et `validate:migrations` verts |
| **Production** | ✅ **APPLIQUÉE le 2026-08-29**, ledger `org_invitations_select_narrowed`. Vérifié en base : une seule policy PERMISSIVE en SELECT ; un membre simple de l'organisation qui porte l'invitation lit **0 ligne** (avant : toutes), témoin sur un second membre simple à 0 ; l'inviteur, le destinataire et l'admin lisent **2 lignes**, inchangé. `check:drift` derrière : aucun objet attendu ne manque |
| Test de base réelle | ✅ `e2e/rls/org-invitations.test.ts` (2026-08-27, soir) · sept cas joués dans **cinq rôles réels** sur la stack Supabase, plus le rôle `anon` |
| Réversibilité | rejouer le bloc `CREATE POLICY` de la mig. `105` |

**Ce que le test ajoute, et pourquoi le commentaire ne suffisait pas.** La migration portait en
pied de fichier une « vérification après application » : trois requêtes à jouer à la main dans
trois rôles. *Un commentaire n'est pas une vérification.* Tant que personne ne les joue, la
migration ne repose que sur une relecture de son propre `USING`, ce qui est exactement la manière
dont B-1 (mig. `107`) est passée : le SQL avait l'air juste.

Le test couvre les trois qui **doivent** voir (destinataire, inviteur, admin), celui qui ne doit
**rien** voir (un membre simple, sur l'invitation en attente **et** sur le refus d'un tiers, la
donnée personnelle en cause), et le rôle `anon`.

> ⚠️ **Un cas est un contre-exemple délibéré** : `etranger` est le destinataire de l'invitation
> refusée. Le test exige qu'il voie **la sienne, et rien d'autre**. Un fichier qui n'attendrait que
> des listes vides passerait aussi bien avec une policy qui n'autorise plus personne : il
> vérifierait qu'on ne fuit rien, pas que le produit marche encore.
>
> 🔴 **Ce test est ROUGE tant que la migration n'est pas appliquée**, et seulement sur le cas du
> membre simple. C'est voulu : c'est ce qui distingue « écrite » de « en vigueur ». Il tourne avec
> `npm run test:rls`, qui exige une stack Supabase locale, donc en CI (job `rls-integration`).

⚠️ `is_org_admin(org_id)` **dépend de la ligne**, contrairement aux deux autres branches. C'est
assumé et documenté dans la migration : `org_invitations` compte des dizaines de lignes par
organisation, pas des milliers. **Ne pas généraliser ce motif à une table volumineuse**, cf. les
mig. `085` / `113` / `128`.

## ✅ B-3 · refermé (mig. 109, appliquée en prod le 2026-08-24)

**Ce que c'était.** La mig. `108` enfreignait deux règles déjà écrites :

1. « Un trigger de garde doit être `SECURITY INVOKER` » (audit du 2026-07-26) —
   `validate_team_task_dependency()` et `prevent_team_task_dependency_cycle()` étaient `DEFINER`,
   alors que la mig. `107`, écrite le même jour, respecte la règle pour
   `freeze_team_membership_identity()`.
2. Pas de `REVOKE … FROM anon` (règle `064b`, réappliquée par `094b`).

**Exploitabilité directe : nulle** (`RETURNS trigger`, Postgres refuse l'appel direct). Mais un
trigger `BEFORE INSERT` s'exécute **avant** le `WITH CHECK` de la RLS : en `DEFINER`, la lecture de
`team_tasks` ignorait la RLS, et les messages d'erreur distinguaient
« `Both tasks must exist` » de « `… single project` » — soit un **oracle d'existence** sur
`team_tasks` hors organisation. Étroit (UUID v4 requis, réponse booléenne), mais c'est la classe
exacte du finding refermé par la mig. `100`.

**Correctif (mig. 109)** : les deux triggers repassent en `SECURITY INVOKER` — le `SELECT`
redevient filtré par la RLS, les deux cas convergent vers `Both tasks must exist`, l'oracle
disparaît — et **quatre** fonctions de trigger sont révoquées pour `anon` **et** `authenticated`
(`validate_team_task_dependency`, `prevent_team_task_dependency_cycle`,
`freeze_team_membership_identity`, `seed_default_categories`).

Ces quatre-là sont exactement celles qui restaient exposées : vérifié en prod le 2026-08-24 sur
les **28** fonctions `RETURNS trigger` du schéma `public`, les 24 autres sont déjà fermées.

**Garde ajoutée** : `npm run validate:migrations` refuse toute nouvelle fonction de trigger sans
`REVOKE` explicite pour les deux rôles, et avertit si elle est `SECURITY DEFINER`. Cliquet à partir
de la mig. `109` — et le contrôle évalue l'**état final** de l'historique, pas chaque fichier
isolément, pour qu'une migration puisse réparer l'oubli d'une précédente.

> **Pourquoi un cliquet et pas un audit rétroactif** : le premier jet, plancher à la mig. `064`,
> sortait 12 erreurs. Vérification en prod : **les 12 étaient des faux positifs** — ces fonctions
> sont déjà révoquées, par des chemins qu'un modèle statique ne voit pas (privilèges par défaut du
> schéma, `REVOKE` hors du jeu de migrations). C'est la limite que `check-rls-advisors.mjs`
> documentait déjà : *un modèle statique de l'historique complet est faux*. Une gate rouge en
> permanence finit ignorée — le remède aurait été pire que le mal.

---

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

---

## 🟠 V-1 · le script analytics tiers capte email et nom — mitigé, arbitrage ouvert (2026-09-01)

**Trouvé par `vendor-watch.yml`**, qui échouait à chaque exécution **depuis au moins le
2026-08-29** sans que personne ne lise l'alerte. Le workflow n'était pas cassé : il alertait.
C'est le premier enseignement, et il vaut pour toutes les gardes planifiées — **une alerte que
personne ne lit ne protège rien.**

**Ce qui a changé.** Le script servi à `https://www.vesk.dev/a.js` a gagné une fonction
`tryIdentify()` qui lit les champs d'un formulaire d'inscription, en extrait l'**adresse email**
(160 car. max) et le **nom** (80), et les envoie à `vesk.dev`. Elle se déclenche sur `submit`
**et** sur un clic qui « ressemble » à une inscription — donc dans une SPA sans `submit` natif,
ce qui est exactement notre cas. Elle exige un champ mot de passe et un signe d'inscription : un
formulaire newsletter ne la déclenche donc pas.

**Pourquoi c'est un écart.** Le registre (art. 30, `docs/RGPD-REGISTRE.md` §T8) déclare pour ce
traitement : « adresse de la page, page référente, adresse IP, navigateur. **Sans cookie.** » Ni
email, ni nom, ni identifiant persistant — or le script pose aussi un UUID `_a_cid` en
`localStorage`. **Un consentement recueilli pour une MESURE D'AUDIENCE ne couvre pas la
transmission de l'identité de la personne à un tiers.** Et `/signup` étant une page publique sans
session, les trois conditions de chargement étaient réunies : le script tournait bel et bien là
où l'on saisit son email.

**Ce qui a été fait (2026-09-01).** `src/lib/audience.ts` ne monte plus le script sur les pages
portant un formulaire d'identifiants (`CREDENTIAL_FORM_SEGMENTS` : `signup`, `login`,
`forgot-password`, `reset-password`, `invite`, `org-invite`). On aligne le code sur ce qui est
déclaré, plutôt que l'inverse. La mesure garde sa finalité : landing, blog, guide, cas d'usage.
Cliquet : `src/lib/audience.test.ts`, vérifié rouge sans la garde.

**Le reste de la revue, sans reproche** : aucun `eval`, aucun `new Function`, aucune injection de
script, aucune lecture de `document.cookie`, aucun accès aux champs mot de passe, aucune
obfuscation `atob`. L'endpoint est dérivé de l'origine du script lui-même, et la CSP borne
`connect-src`.

**✅ Arbitré par Axel le 2026-09-01 — option A : on garde Vesk, et on met la déclaration en
conformité.** Motif : Vercel reste le tableau de bord de référence, et les indicateurs
d'engagement de Vesk gardent leur valeur pour la phase d'acquisition qui commence.

Fait dans la foulée :

- `docs/RGPD-REGISTRE.md` §T8 — les données déclarées incluent désormais les indicateurs
  d'engagement **et l'identifiant persistant `_a_cid`**. La mention « sans cookie » a été
  retirée, avec la raison écrite sur place : littéralement vraie, elle laissait croire à
  l'absence de traceur. L'exclusion des pages d'identifiants y est inscrite comme **garde de
  conformité**, pas comme détail d'implémentation.
- `PolitiqueConfidentialitePage.tsx` — trois corrections. La page affirmait « Vesk n'écrit rien
  sur votre appareil » (faux), rangeait la mesure sous l'**intérêt légitime** en §5 alors que
  §7 et le registre disent consentement (deux sections du même document se contredisaient), et
  sa section Cookies ne distinguait pas le strictement nécessaire de ce qui exige un accord.
  Les pages exclues de la mesure sont maintenant nommées pour le visiteur. Une phrase cassée
  qui traînait a été réparée au passage.
- `docs/ROADMAP-60J.md` T-43 — **Vesk ajouté à la liste des DPA à collecter**, dont il était
  absent. Un sous-traitant qu'on oublie de lister est un sous-traitant sans contrat.

**🔴 Ce qui reste, et qui n'appartient qu'à Axel : obtenir le DPA de Vesk** (art. 28). Tant
qu'il manque, ce traitement s'appuie sur un sous-traitant sans contrat de sous-traitance.

⚠️ **Et la vraie leçon de ce finding n'est pas Vesk.** `vendor-watch.yml` a fait exactement son
travail et a échoué chaque jour pendant quatre jours sans que personne ne le lise. Le prochain
changement de ce script sera détecté de la même façon — **et ne servira à rien si l'alerte n'est
pas lue.** Une garde planifiée sans destinataire n'est pas une garde. `OPS_ALERT_WEBHOOK_URL`
existe depuis le 2026-08-29 : y router les échecs de `vendor-watch` fermerait ce trou.

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

| # | Finding | Gravité | État |
|---|---|---|---|
| S-1 | Le pré-contrôle d'idempotence avalait son erreur → rejeu possible de `bump_win_streak` | 🟡 | ✅ corrigé |
| S-2 | `getUidFromCustomer` avalait son erreur → paiement encaissé, abonnement jamais appliqué | 🟠 | ✅ corrigé |
| S-3 | `subscriptions.stripe_customer_id` sans contrainte UNIQUE, alors que le code en dépend | ✅ | mig. `134` **appliquée en prod le 2026-09-02**, doublon refusé en 23505 (vérifié) |
| S-4 | `renewal-notice` : expéditeur par défaut sur un domaine que Resend ne signera jamais | 🟠 | ✅ corrigé |
| S-5 | Un event tardif d'un ANCIEN abonnement peut dégrader l'org qui vient de repayer | 🟠 | ✅ corrigé |
| S-6 | La renonciation au droit de rétractation ne quitte jamais le navigateur | ✅ | corrigé · mig. `135` **appliquée en prod le 2026-09-02**, immuabilité et cloisonnement vérifiés |

### ✅ S-1 · le pré-contrôle d'idempotence avalait son erreur

`const { data: alreadyProcessed } = await …` jetait `error`. Une panne de lecture se lisait donc
« jamais traité », et les handlers repartaient. La plupart sont des upserts, donc idempotents —
**mais pas `bump_win_streak`, qui incrémente**. Un rejeu y ajoutait une victoire jamais gagnée,
c'est-à-dire exactement ce que ce pré-contrôle existe pour empêcher.

**Corrigé** : l'erreur produit un 500, Stripe retente. C'est la même règle que le marqueur écrit
après le handler (faille M-5) : en cas de doute, faire retenter plutôt que deviner.

### ✅ S-2 · une panne de lecture devenait un succès silencieux

Même motif, conséquence plus lourde. `getUidFromCustomer` ignorait l'erreur de sa requête et
rendait `null`. Tous ses appelants font `if (!uid) return` : un **succès** du handler, donc le
marqueur d'idempotence écrit, donc Stripe qui ne re-livre jamais. Un paiement encaissé sans que
l'abonnement soit appliqué, et personne pour le voir passer.

C'est le finding que `orgIdFromInvoice` avait déjà reçu, avec un commentaire de dix lignes
expliquant pourquoi il fallait relancer. **La leçon n'avait pas traversé les vingt lignes qui
séparent les deux fonctions** : la branche entreprise a été durcie, sa jumelle particulière non.

**Corrigé** : l'erreur est relancée. `recordPayment` reste protégé à part — une ligne de journal
sans `user_id` reste une pièce comptable, une ligne absente est un trou.

### ✅ S-3 · le code s'appuyait sur une unicité qui n'existait pas — mig. `134` appliquée le 2026-09-02

`getUidFromCustomer` fait `.maybeSingle()` sur `stripe_customer_id`, qui **lève** au-delà d'une
ligne. Côté organisation, la mig. `101` pose la contrainte UNIQUE, et le commentaire de
`orgIdFromInvoice` la cite comme ce qui rend son appel sûr. Côté particulier, la même hypothèse est
faite et rien ne la garantit (vérifié en base : la contrainte n'existe pas).

0 doublon aujourd'hui sur 54 lignes : latent, sans gardien. La mig. `134` pose un index unique
partiel. **Elle échouera s'il existe un doublon — c'est voulu** : le découvrir en appliquant une
migration vaut mieux que le découvrir sur une facture.

### ✅ S-4 · l'avis de reconduction ne pouvait pas partir

`renewal-notice` portait `BUG_REPORT_FROM ?? 'Cosmo <bug@thecosmo.app>'`. Or le domaine vérifié
chez Resend est `send.thecosmo.app` : la racine porte les MX et le SPF d'IONOS et **ne sera jamais
signée**. Ce défaut ne dégradait pas l'envoi, il le rendait impossible.

Ce qui rend le défaut coûteux, c'est ce que la fonction porte : l'avis de l'article L215-1. Ne pas
l'envoyer ne coûte pas une amende, ça rend l'abonnement annuel **résiliable à tout moment et
remboursable**. `docs/DEPLOYMENT.md` §2ter le disait déjà noir sur blanc ; le code, lui, offrait la
valeur qui échoue.

**Corrigé** : plus de défaut. Sans le secret, la fonction répond 503 et alerte.

### ✅ S-5 · un event tardif peut dégrader une organisation qui vient de repayer

`handleOrgSubscriptionDeleted` filtre sur `stripe_subscription_id`, avec un commentaire qui
explique exactement pourquoi : après un cycle « résiliation puis réabonnement », la livraison
tardive du `deleted` de l'ANCIEN abonnement remettrait au gratuit une organisation qui vient de
payer.

**`applyOrgSubscription` n'a pas ce filtre.** Elle fait un `upsert` sur `org_id` seul. Un
`customer.subscription.updated` tardif portant le statut `canceled` de l'ancien abonnement écrit
donc `tier_key = 'free'`, `max_members = 5`, `current_period_end = null` sur l'organisation qui
vient de souscrire. La garde a été posée sur une porte et pas sur l'autre.

**Corrigé le 2026-09-02.** La garde est ASYMÉTRIQUE, et c'est ce qui la rend juste :

- un event qui **active** fait autorité, d'où qu'il vienne : un nouvel abonnement actif supersède
  le précédent, c'est la souscription elle-même ;
- un event qui **dégrade** (`cancelled`, `past_due`) n'est appliqué que s'il concerne l'abonnement
  actuellement enregistré. Venant d'un autre, il parle par définition d'un abonnement abandonné.

Un simple `.eq()` sur l'upsert ne convenait pas : il aurait empêché la toute première écriture,
quand la ligne n'a encore aucun `stripe_subscription_id`. La lecture préalable relance sur erreur,
comme partout ailleurs dans ce fichier.

⚠️ **Fenêtre de concurrence assumée** : lecture puis écriture, donc deux livraisons simultanées
peuvent lire la même valeur. L'état converge — l'event actif finit toujours par être appliqué, et
une dégradation appliquée à tort est corrigée par le suivant. Verrouiller la ligne coûterait plus
cher que ce que ça protège.

### ✅ S-6 · la renonciation au droit de rétractation ne quitte jamais le navigateur

`OrgBillingTab` recueille les deux cases exigées par l'article L221-28, 13° — accord exprès à
l'exécution immédiate, et reconnaissance de renoncer — sans les pré-cocher, et son commentaire
conclut : « nous laisse la preuve ». **Rien n'est envoyé au serveur et rien n'est enregistré.** Le
corps posté à `stripe-org-checkout` est `{ orgId, tierKey, interval }`.

Deux conséquences. Un appel direct à la fonction avec un JWT valide ouvre une session de paiement
sans qu'aucun consentement ait été donné, alors que les CGU affirment « le paiement ne peut être
engagé sans elles ». Et surtout, **le jour où un client conteste, il n'y a aucune preuve** — alors
que le même dépôt traite `renewal_notices` comme une pièce à produire, avec la règle écrite
« ⚠️ c'est une PREUVE, pas un cache ».

**Corrigé le 2026-09-02**, en trois pièces.

1. Les deux booléens sont **transmis** au serveur, séparément.
2. `stripe-org-checkout` les **exige** strictement à `true`, chacun de son côté : accepter une
   valeur « truthy » reviendrait à accepter `"false"`, et les fondre en un seul drapeau ferait
   exactement ce que le texte interdit — un accord global au lieu de deux accords distincts.
3. La **mig. `135`** crée `withdrawal_consents`, jumelle de `renewal_notices` : append-only,
   immuabilité par TRIGGER (car `service_role` contourne la RLS mais pas un trigger), aucune policy
   d'écriture, lecture ouverte au propriétaire de l'organisation — c'est SA preuve autant que la
   nôtre. La ligne est écrite **avant** la création de la session : l'ordre est la preuve.

L'échec d'écriture est **bloquant**, contrairement à `renewal_notices` qui trace après l'envoi. La
règle n'est pas la même parce que la situation ne l'est pas : là-bas, un avis parti sans trace vaut
mieux qu'un avis jamais parti ; ici, rien n'est encore engagé, donc renoncer ne coûte rien — et
ouvrir une page de paiement en sachant qu'on ne pourra rien produire en cas de litige, c'est
encaisser sans preuve.

> ⚠️ **Une incohérence RESTE dans les CGU, et elle n'appartient qu'à Axel.** L'article 5 bis dit
> « le paiement ne peut être engagé sans elles » — vrai depuis ce correctif — puis « si vous ne
> donnez pas ces confirmations, vous conservez l'intégralité de votre délai de quatorze jours »,
> qui décrit un cas que le produit rend impossible. Deux lectures possibles : soit la seconde
> phrase disparaît, soit le produit accepte de vendre sans renonciation (le client garde alors ses
> quatorze jours, et il faut un chemin de remboursement). C'est un choix produit, pas un correctif.

### Ce que l'audit n'a PAS trouvé, et qui méritait d'être cherché

- Aucun montant n'est calculé côté COSMO au moment de facturer. Le seul endroit qui CHOISIT un prix
  est la dérivation annuelle, et elle vérifie le montant contre la grille avant d'ouvrir la session.
- Aucune donnée de carte ne transite ni n'est stockée. `payment_records.payload` est une copie
  volontairement étroite.
- Les deux fonctions org vérifient `organizations.owner_id` côté serveur, et répondent la même chose
  pour « pas propriétaire » et « org inexistante ».
- `allow_promotion_codes` délègue les coupons à Stripe : aucune surface de brute-force côté COSMO.
- Aucun message d'erreur brut n'est renvoyé à l'appelant.

### ⚠️ Deux angles morts que cet audit ne pouvait pas couvrir

1. **Le passage en compte live.** `stripe-org-checkout` et `stripe-org-portal` réutilisent le
   `stripe_customer_id` et le `stripe_subscription_id` enregistrés. Ceux d'aujourd'hui vivent dans
   le compte de TEST : le jour où `STRIPE_SECRET_KEY` devient une clé live, chaque appel
   `subscriptions.retrieve` / `billingPortal.sessions.create` sur un identifiant de test répondra
   404, donc 500. **Le basculement doit donc s'accompagner d'une remise à zéro des identifiants
   Stripe en base**, sans quoi les organisations existantes ne pourront ni souscrire ni gérer.
   Aujourd'hui `org_subscriptions` est vide, donc le coût est nul — c'est le bon moment.
2. **Le cache `productIndex`** (`org-stripe-prices.ts`) n'est jamais invalidé en production
   (`resetProductIndex` n'a aucun appelant hors test). Un isolate Deno survit longtemps : après une
   rotation des secrets de prix, il continue d'indexer les anciens produits jusqu'à son recyclage.
   Conséquence bornée (le webhook alerte et Stripe retente), mais elle tombera pile pendant le
   basculement live.

---

## 🔴 Ouvert — bloquant

### A-9 — Plan Supabase `free` : pas de PITR, restauration jamais testée
Rétention de backup minimale, aucun Point-In-Time Recovery, et le drill de restauration n'a
jamais été exécuté. **RPO réel jusqu'à 24 h, RTO inconnu.**

**Action** (compte, non scriptable) : passer en plan Pro → activer PITR → exécuter le drill de
restauration décrit dans [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) §7. Effort ≈ 1 h.

---

## 🟠 Ouvert — réglages de console Supabase

Aucun ne bloque un déploiement ; tous sont des clics dans le Dashboard.

| # | Action | Où | Effort |
|---|---|---|---|
| A-10 | **Activer « Leaked password protection »** (HaveIBeenPwned) + minimum 12 caractères. La garde client existe, la garde serveur non. | Authentication → Policies | 2 min |
| — | **MFA (TOTP) sur le compte admin.** `/admin` n'est protégé que par l'allowlist `admin_users` + mot de passe, alors que `get_admin_stats` expose toute la volumétrie business. Meilleur rapport effort/risque du dossier. | Authentication | 5 min |
| — | **Vérifier l'allowlist de redirection OAuth** : un wildcard trop large annulerait une partie du bénéfice de PKCE. | Authentication → URL Configuration | 5 min |
| — | **Activer « Secure email change »** (confirmation sur l'ancienne ET la nouvelle adresse). | Authentication | 2 min |
| — | **Vérifier la non-réutilisation du mot de passe `DATABASE_URL` historique** + activer le secret scanning GitHub (le dépôt est **public**). | Supabase + GitHub | 15 min |

---

## 🟡 Ouvert — à planifier

- **`GHSA-qwww-vcr4-c8h2`** (`react-router` ≥ 7.12.0 < 8.3.0, CSRF en **mode RSC**).
  **Inapplicable ici** : aucun RSC dans une SPA Vite. ⚠️ **Ne pas lancer `npm audit fix`** : il
  propose 7.11.0, qui **réintroduirait** l'open redirect `GHSA-wrjc-x8rr-h8h6`. Aucune version ne
  clôt les deux familles à la fois sous React 18 → la sortie est la migration React 19 +
  `react-router` 8, en PR dédiée.
  La propriété qui rend l'open redirect inexploitable (aucune navigation alimentée par un
  paramètre d'URL) est **verrouillée par un test** : `src/lib/no-open-redirect.test.ts`.
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

## Ordre de priorité avant déploiement prod (à jour 2026-09-02)

Section référencée par [`CLAUDE.md`](./CLAUDE.md) — elle n'existait plus depuis la refonte
documentaire du 2026-08-14, le lien pointait dans le vide. Restaurée ici.

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
| 2 | **Réglages de console Supabase** : A-10 (leaked password protection), MFA sur le compte admin, allowlist de redirection OAuth, secure email change | 🟠 clics Dashboard, ~30 min cumulés | **Axel** | ⏳ **en attente** |
| 3 | **A-9 — plan Pro + PITR + drill de restauration** | 🔴 résilience, seul bloquant | **Axel** (compte, non scriptable) | ⏳ **en attente** |
| 4 | Test de bout en bout de l'attribution `?ref=` (cf. [`docs/ACQUISITION.md`](./docs/ACQUISITION.md) §3) | 🟡 exige une vraie inscription | **Axel** | ⏳ **en attente** |
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

Repo au 2026-08-25 : **127 fichiers, dernière = `123_org_subscriptions_billing_interval.sql`**,
**toutes appliquées en prod**, `115` → `123` déployées le 2026-08-25, après `111` → `114`.

Vérifié en base le 2026-08-25 (`supabase_migrations.schema_migrations`) :
- `115_org_member_permissions` → `123_org_subscriptions_billing_interval` présentes, dans l'ordre.
- `122_habits_local_date` (le fuseau du client décide de « aujourd'hui ») et `123` (colonne
  `billing_interval`) appliquées le soir du 2026-08-25.
- ⚠️ Le ledger porte **une entrée de plus que le dépôt** :
  `119b_habits_bounded_payload_future_guard`. Contenu relu et comparé au fichier `119` du dépôt :
  **identique**. Cf. l'avertissement de l'État global.
- Aucune migration en attente. `npm run check:drift` reste l'outil de référence avant tout
  déploiement comportant une migration.

Vérifié en base lors de la vague précédente (2026-08-24) :
- `team_categories` existe, avec `team_projects.category_id` / `team_tasks.category_id` (111).
- Le job `cosmo-prune-declined-invitations` est planifié et actif, `30 3 * * *` (112).
- `get_my_team_projects` / `get_my_team_tasks` exécutables par `authenticated` uniquement (`anon`
  et `public` révoqués), `my_team_project_ids` fermée à tout le monde (113 — c'est la migration qui
  débloquait le déploiement front : `main` appelle déjà ces deux RPC).
- `touch_last_seen` / `record_demo_visit` portent la rétention 400 j (114).
- Advisors relus après coup : aucune erreur, aucune fonction `anon`-exécutable de plus que les deux
  volontaires (`preview_share_link`, `record_demo_visit`).

- `099` → `108` : **appliquées en prod** (ledger relu le 2026-08-24), y compris la `100` qui
  referme la fuite des helpers.
- `109` (correctifs B-1/B-2/B-3) et `110` (notifications de commentaire) : **appliquées et
  vérifiées en prod le 2026-08-24**. Elles portent leur propre bloc de vérification SQL en fin de
  fichier.

> ⚠️ Ces deux dernières lignes ont dit « écrites, PAS appliquées » pendant vingt-quatre heures
> alors que le haut du même fichier disait le contraire, et vrai. Un document de sécurité qui se
> contredit sur l'état de la production est pire qu'un document absent. **Relire ce bloc à chaque
> application, pas seulement l'en-tête.**

Procédure d'application, checklist de rédaction d'une migration et pattern RLS obligatoire :
[`docs/SECURITY.md`](./docs/SECURITY.md). Réconciliation du ledger :
[`supabase/migration/README.md`](./supabase/migration/README.md).

---

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

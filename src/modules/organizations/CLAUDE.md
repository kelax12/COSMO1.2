# Organisations · règles du dossier

> Repris de `CLAUDE.md` le 2026-09-16, **sans une coupe**. Ce fichier est chargé
> automatiquement dès qu un fichier de ce dossier est lu ou édité, et lui seul.
> Règles transversales : [`CLAUDE.md`](../../../CLAUDE.md) à la racine.

---

## 🧭 Navigation : une route par section (2026-09-23)

`/entreprise/<section>` (`tasks`, `projects`, `okr`, `stats`, `pyramid`, `members`, `billing`),
l'Aperçu restant `/entreprise`. Desktop : panneau à droite (`OrgSideNav`), monté par portail dans
l'emplacement que `Layout` pose hors de `<main>` (`page-right-rail.ts`). Mobile : `OrgSectionSwitcher`.
Liste des sections : `org-sections.ts` ; chemins et liens : `deep-link.helpers.ts` (`buildOrgLink`).

- 🔴 **Ne JAMAIS retirer la redirection `?tab=`** (`legacyOrgTabRedirect`). Stripe
  (`stripe-org-checkout`, `stripe-org-portal`) et les e-mails déjà envoyés par `renewal-notice`
  pointent sur `/entreprise?tab=billing` : ces URLs vivent hors du dépôt.
- ❌ Ne jamais écrire un lien entreprise à la main : passer par `buildOrgLink`.

---

## 🔐 Permissions entreprise — surcharge, jamais remplacement (mig. 115)

Les droits du mode entreprise sont **dérivés par défaut** (`is_org_admin`, `is_org_manager`) et
**surchargeables par membre** depuis l'annuaire → menu « … » → **Modifier les permissions**.

- Table `org_member_permissions (org_id, user_id)`, colonnes booléennes **NULLables** :
  `NULL` = suit le défaut dérivé, `true`/`false` = décision explicite. Une organisation sans
  aucune ligne se comporte **exactement** comme avant la mig. 115 — c'est ce qui rend le
  déploiement réversible.
- Dix droits (`task.create` · `task.editAny` · `task.deleteAny` · `project.create` ·
  `project.delete` · `okr.create` · `okr.delete` · `category.manage` · `team.create` ·
  `member.invite`) + une portée d'assignation cumulable
  (`self` · `peers` · `manager` · `subordinates` · `everyone`, `{}` = personne).
- Côté client, **une seule source de vérité** : `src/modules/organizations/permissions.ts`
  (fonctions pures, miroir du SQL) exposé par `useMyOrgPermissions(orgId)`. Aucun composant ne
  recalcule un droit ; le hook lit l'utilisateur via `useAuth`, jamais via une prop.

- ❌ **Ne jamais gater une création/suppression par `isManager`.** `isManager` ne désigne plus
  qu'une **position** (onglets Pyramide et Statistiques, dépendances de tâches) ; un droit passe
  par `can['<clé>']`.
- ❌ **Ne jamais enregistrer un instantané des dix droits.** La fiche n'écrit que les lignes
  DÉCIDÉES : figer les droits d'un manager le jour où on ouvre sa fiche ferait qu'un
  déplacement dans la pyramide ne les lui retirerait plus jamais.
- ❌ **Ne jamais confondre `assign_targets = NULL` (aucune décision → tout le monde) et `{}`
  (personne).** Ce sont deux états opposés.
- ❌ **Ne jamais poser de ligne sur un admin** : `my_org_perm` court-circuite sur
  `is_org_admin`, et le trigger la refuse. Sans cette règle, un admin peut se retirer un droit
  et bloquer son organisation sans chemin de retour.
- ⚠️ Le contrôle des assignations ne porte que sur les **AJOUTS** : retirer un assigné reste
  toujours permis, sinon une tâche héritée devient ingérable et les purges RGPD cassent. Les
  sélecteurs de membres appliquent la même règle (`canAssign(id) || déjà assigné`).
- 🔴 **Supprimer une équipe ne rend JAMAIS rien visible par toute l'organisation** (mig. 151, M5).
  `team_projects.team_id` et `team_okr_teams.team_id` sont en `NO ACTION` : la base refuse tant
  qu'un projet ou un OKR y est rattaché, y compris ceux que l'appelant ne voit pas. La sortie est
  `delete_team_with_transfer` (INVOKER, atomique), via `DeleteTeamDialog`.
  ❌ Ne jamais remettre `SET NULL`/`CASCADE`, ni proposer « toute l'entreprise » comme cible : `NULL`
  y signifie « visible par tous ». Un changement d'équipe de projet passe par
  `ConfirmProjectAudienceDialog`, qui nomme la nouvelle audience.
- ⚠️ **L'archivage d'un projet est un UPDATE**, pas un DELETE, et l'application ne supprime
  jamais un projet : c'est le trigger `enforce_team_project_archive_scope` qui rattache
  l'archivage à `project.delete`. Une policy, qui juge la ligne entière, ne sait pas le faire.


---

### 📬 Agréger des lectures, oui. Agréger des AUTORISATIONS, jamais (mig. 129)

`get_my_org_inbox()` remplace **cinq** lectures qui partaient à chaque ouverture de
l'application, sur toutes les pages protégées, parce que `Layout` monte `useOrgBadges` pour
peindre une pastille : invitations, avis de retrait, ma demande d'adhésion, demandes reçues côté
admin, notifications, plus un sixième appel conditionnel à `profiles`.

- 🔴 **Une RPC d'agrégat est `SECURITY INVOKER`.** En `DEFINER`, agréger cinq lectures revient à
  réécrire cinq autorisations à la main dans une fonction qui contourne la RLS : c'est là qu'une
  agrégation « de performance » devient une fuite. Les deux sections qui ont besoin de privilèges
  élevés ne sont pas réécrites, elles **appellent** les fonctions `DEFINER` existantes
  (`get_my_org_invitations`, `get_my_org_removal_notices`), inchangées.
- ❌ **Ne jamais lui donner un `p_org`.** Le périmètre vient de `auth.uid()` seul, comme
  `get_my_tasks`. Un paramètre d'organisation forcerait le client à attendre que l'organisation
  active soit résolue : on échangerait quatre requêtes contre du délai, en sérialisant ce qui
  partait en parallèle. Les sections par organisation couvrent TOUTES mes organisations, le
  client filtre.
- ❌ **Ne jamais borner globalement.** 200 demandes et 50 notifications, **par organisation**
  (window function). Une borne globale tronquerait la troisième organisation d'un compte avec les
  lignes des deux premières, et ça ne se verrait que chez lui.
- ❌ **Ne jamais réintroduire une invalidation par section** dans `useOrgInboxRealtime` : ces clés
  ne portent plus de donnée, l'écran cesserait de se rafraîchir **en silence**. Une seule clé,
  `orgKeys.inbox()`.
- Les cinq hooks gardent leur nom et leur forme de retour : ce sont des sélecteurs `useMemo`.
  Garde : `src/modules/organizations/inbox.hooks.test.tsx`.

### 🔢 La pastille COMPTE, elle ne lit pas la liste (mig. 142, finding C-05)

La même boîte de réception porte depuis le 2026-09-05 une section `badge_tasks`. `useOrgBadges`
montait `useTeamTasks`, donc `get_my_team_tasks` + `.limit(1000)` — la lecture la plus chère du
produit — sur **toutes les pages protégées**, pour peindre un nombre. Le rechargement avait été
coupé le 2026-08-27 (`background`), la **lecture** pas.

- Le serveur rend les **seules** lignes utiles : assignations en cours qui ne viennent pas de moi
  (`kind = 'assigned'`), et noms des tâches visées par mes notifications non lues
  (`kind = 'notified'`). Bornes : 200 et 50 **par organisation**, jamais globalement.
- ❌ **Ne jamais faire compter une ligne `notified`.** Une tâche peut sortir dans les DEUX branches ;
  le client leur retire toute assignation pour cette raison précise. Sans ça, elle compte deux fois
  et le nombre affiché change.
- ❌ **Ne jamais passer `lastSeen` au serveur.** Il vit dans `localStorage`, il est **par
  organisation**, et il change à chaque visite de /entreprise : en paramètre, il ferait dépendre la
  clé de cache d'une valeur mouvante, et un seul horodatage ne pourrait pas servir plusieurs
  organisations. La borne reste côté client, sur un ensemble déjà réduit.
- ✅ `my_org_badge_tasks()` est `SECURITY DEFINER` pour la SEULE raison qui vaut ici : appeler
  `my_team_project_ids`, dont `EXECUTE` est révoqué à `authenticated` (mig. 100/113). L'autorisation
  est celle de `get_my_team_tasks`, reprise mot pour mot. La RPC d'agrégat, elle, reste
  `SECURITY INVOKER` — agréger des lectures, oui ; agréger des autorisations, jamais.
- ⚠️ En **démo** la source reste `useTeamTasks` : c'est du `localStorage`, donc gratuit, et écrire
  une seconde dérivation de « nouvelle assignation » dans le repository local aurait fait deux
  définitions du même chiffre. Hors démo l'identifiant vaut `undefined` et rien ne part.
- Gardes : `src/lib/hooks/org-badges.server-count.test.tsx` (dont un témoin qui exige que le
  compteur TOMBE quand la source serveur est vidée — sans lui, le fichier passerait encore si plus
  aucune source n'alimentait rien).


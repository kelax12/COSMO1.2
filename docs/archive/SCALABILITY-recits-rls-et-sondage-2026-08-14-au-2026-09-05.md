> ⚠️ **ARCHIVE : récits des sections 2 et 3 de SCALABILITY.md (correctif RLS du mode entreprise, fermeture du sondage périodique), extrait le 2026-11-08, non maintenu.**
> Chaque passage décrit l'état **à sa date**. État courant et règles : [`docs/SCALABILITY.md`](../SCALABILITY.md) §§ 2 et 3. Les notes /100 ont cessé (ADR 0012).
> Les liens relatifs et les ancres sont ceux du document d'origine : certains ne résolvent plus.

## 2. ✅ Le coût RLS du mode entreprise — corrigé (mig. 113, 2026-08-24)

> **Correctif livré ET appliqué en prod le 2026-08-24.** `get_my_team_projects(p_org)` et
> `get_my_team_tasks(p_org)` expriment le même ensemble en trois branches indexables et
> n'évaluent le sous-arbre managérial qu'**une fois par organisation** au lieu d'une fois par
> ligne. Les policies restent en place, inchangées. Le repository lit par ces RPC, et un test
> verrouille le chemin d'accès. Droits vérifiés en base après application : les deux RPC
> exécutables par `authenticated` seulement, le helper interne (`my_team_project_ids`) fermé à
> tout le monde — c'était la condition d'ordre : `main` appelait déjà ces RPC avant même que la
> migration parte, donc le déploiement front devait attendre celui-ci, jamais l'inverse.
>
> Les index nécessaires existaient déjà — le problème n'a jamais été l'indexation des tables
> d'appartenance, mais la FORME du prédicat, qui interdit d'utiliser un index sur la table lue.
>
> Reste ouvert : `team_task_dependencies` (§2bis) délègue son périmètre à `team_tasks` et n'a pas
> été basculée (0 ligne aujourd'hui).

### Le diagnostic d'origine

**C'est le finding principal de cet audit, et il est nouveau.**

Les policies du mode entreprise s'appuient sur des fonctions SQL `STABLE SECURITY DEFINER`
appelées **avec une colonne de la ligne en argument** :

```sql
-- policy team_tasks_select
USING (can_access_team_project(project_id))
```

Un prédicat qui appelle une fonction sur une colonne **ne peut pas être servi par un index** :
Postgres doit lire **toute la table** et évaluer la fonction **pour chaque ligne**. Et
`can_access_team_project` n'est pas une fonction bon marché — elle enchaîne, par ligne :
`is_org_member` + `is_org_admin` + un `EXISTS` sur `org_team_members` + `get_subtree()`,
qui est une **CTE récursive** sur `organization_members`.

**Mesuré en prod, sous le rôle `authenticated`, plans à chaud :**

| Lecture | Plan | Coût mesuré | Coût par ligne scannée |
|---|---|---|---|
| `select * from team_tasks` | `Seq Scan` + `Filter: can_access_team_project(project_id)` | 26 buffers, **1,49 ms** pour **7 lignes** | **3,7 buffers** |
| `select * from team_projects` | `Seq Scan` + `Filter: can_access_team_project(id)` | 17 buffers, 1,09 ms pour 4 lignes | 4,3 buffers |
| `select * from tasks` (RLS perso) | `Seq Scan` + filtre `OR` | 47 buffers, 0,53 ms pour **710 lignes** | **0,066 buffer** |

Le prédicat RLS entreprise coûte donc **≈ 60 fois plus cher par ligne** que celui du périmètre
personnel, et il est appliqué à toute la table à chaque lecture. Confirmation indépendante par
les compteurs cumulés : `organization_members` totalise **1 144 966 `seq_scan`** pour **11 lignes**
— c'est la fréquence d'appel des helpers, pas un problème de plan.

### ✅ 2bis. `team_task_dependencies` — refermé (mig. 117, 2026-08-24)

> Le trou laissé par la mig. 113 est comblé : `get_my_team_task_dependencies(p_org)`
> réutilise `my_team_project_ids()` et joint sur `team_tasks.project_id`, donc le
> sous-arbre managérial est évalué **une fois par organisation** au lieu d'une fois
> par arête. Les trois policies restent en place, inchangées.
>
> ⚠️ La sémantique est reproduite à la lettre : la RPC exige de voir la tâche
> **bloquée** (`task_id`), pas celle dont elle dépend. Ne pas « durcir » en exigeant
> les deux — l'écran doit pouvoir montrer qu'une tâche visible dépend d'une tâche qui
> ne l'est pas, sinon l'arête disparaît et le graphe ment sur l'ordonnancement. C'est
> l'INSERT qui exige les deux, et lui n'a pas bougé.
>
> Chemin d'accès verrouillé par test (`team-projects/supabase.repository.test.ts`).

### ✅ 2ter. `events`, troisième occurrence, refermée (mig. 128, appliquée en prod le 2026-08-27)

> **Le même défaut, une troisième fois, et cette fois hors du mode entreprise.** La policy de
> lecture d'`events` (mig. 084) dit :
>
> ```sql
> USING ((SELECT auth.uid()) = user_id OR (manages_user(user_id) AND NOT is_private))
> ```
>
> `manages_user(user_id)` dépend de la ligne : Postgres l'appelle **une fois par ligne examinée**,
> et chaque appel joint deux fois `organization_members` puis évalue la CTE récursive
> `get_subtree`. Le coût d'une lecture d'agenda croît donc avec le produit « lignes lues ×
> adhésions de TOUTE la plateforme », pas avec le volume de l'utilisateur.
>
> **Mesuré en prod le 2026-08-26**, plan chauffé, rôle `authenticated`, lecture de l'agenda d'un
> membre NON géré (128 lignes examinées, 0 rendue) :
>
> | | Avant | Après |
> |---|---|---|
> | Temps d'exécution | **17,19 ms** | **0,61 ms** |
> | Plan | Bitmap Heap Scan, `Rows Removed by Filter: 128` | BitmapOr de deux Index Scan |
> | Lignes remontées du tas pour être jetées | 128 | 0 |
>
> Lire son PROPRE agenda ne changeait déjà rien (0,25 ms) : la branche « own » court-circuite le
> `OR`. C'est la vue hiérarchique, et elle seule, qui payait.
>
> **Le correctif est le même que 113 et 117, exprimé en une ligne** : `my_managed_user_ids()` ne
> prend aucun argument, donc n'est pas fonction de la ligne, donc Postgres la hisse en InitPlan et
> l'évalue **une fois par requête**. Effet recherché en prime : `user_id = ANY (…)` est une
> condition d'**index**, pas un filtre, une ligne qui sera rejetée n'est plus lue.
>
> **Parité vérifiée en prod AVANT d'écrire la migration**, pas après : (1) le booléen
> `manages_user(cible)` contre `cible = ANY(my_managed_user_ids())` pour chaque couple
> (acteur, cible) de `organization_members`, zéro divergence ; (2) l'ensemble des `events.id`
> visibles sous l'ancien et le nouveau prédicat, pour **chaque** compte de `auth.users`,
> identiques. Une policy est une frontière de sécurité : la réécrire « plus vite » sans prouver
> qu'elle rend les mêmes lignes, c'est déplacer un risque de perf vers un risque de fuite.
>
> Chemin d'accès verrouillé par test (`scripts/migration-guards.test.mjs`), et la garde a été vue
> **rouge** sur la régression qu'elle prétend attraper avant d'être committée.
>
> ⚠️ Le compteur cumulé de `organization_members` (2 440 047 `seq_scan` pour 11 lignes au
> 2026-08-26) **ne mesure pas ce défaut aujourd'hui** : sur une fenêtre au repos de 5 minutes il
> a bougé de **zéro**. Un total cumulé depuis la création de la base ne dit rien du débit courant ;
> seul un delta entre deux instants répond. La dette était réelle, elle était **dormante**.

### Le diagnostic d'origine

`team_task_dependencies` (mig. `108`) délègue **volontairement** son périmètre à `team_tasks` :

```sql
USING     (EXISTS (SELECT 1 FROM team_tasks t WHERE t.id = task_id))
WITH CHECK(EXISTS (… task_id) AND EXISTS (… depends_on_id))   -- deux fois, à l'écriture
```

Le choix est **bon côté sécurité** — pas de nouveau helper `SECURITY DEFINER`, pas de règle de
cloisonnement dupliquée, et la migration le dit explicitement. Mais il **hérite du coût mesuré
ci-dessus** : chaque sous-requête déclenche l'évaluation du prédicat de `team_tasks`, donc un
`Seq Scan` filtré par `can_access_team_project`. À l'écriture, **deux fois**.

Volume actuel : 0 ligne, donc invisible. À retenir pour la correction de §2 : elle devra couvrir
`team_task_dependencies` en même temps que `team_tasks` — sinon la RPC indexée sera contournée
par la table qui la référence.

**Projection linéaire** (le seul modèle valide ici, le coût est proportionnel aux lignes scannées) :

| `team_tasks` dans l'org | Latence estimée d'une lecture de liste |
|---|---|
| 100 | ~21 ms |
| 1 000 | ~210 ms |
| 10 000 | **~2,1 s** |

**C'est exactement la classe de bug corrigée pour `tasks` par la mig. 085**, reproduite sur les
tables entreprise. Le correctif est connu et éprouvé : exprimer l'appartenance en **jointure
indexable** dans une RPC dédiée (`get_my_team_tasks()`), au lieu d'un prédicat-fonction par ligne.
Les policies restent en place en défense en profondeur, comme pour `get_my_tasks()`.

> Les index nécessaires **existent déjà** : `organization_members_pkey` est `(org_id, user_id)`,
> `org_team_members_pkey` est `(team_id, user_id)`. Le problème n'est pas l'indexation de la table
> d'appartenance, c'est que la forme du prédicat interdit d'utiliser un index **sur la table lue**.

---

## 3. ✅ Le sondage périodique · fermé le 2026-08-25, **au deuxième essai**

> ### ⚠️ La première annonce de fermeture était fausse. Elle a tenu quelques heures.
>
> La version écrite le matin du 2026-08-25 affirmait « **plus aucun `refetchInterval`
> permanent** », et `CLAUDE.md` a repris la formule. **C'était faux : trois tournaient encore.**
> La relecture de l'après-midi les a nommés un par un, et ils ont été corrigés dans la foulée,
> `useOrgJoinRequests` et `usePendingSharedTasks` passent au canal Realtime, `useTeamOKRs` prend
> l'option `live` comme ses deux voisins.
>
> **Décompte final, nominatif** : 4 déclarations, dont 3 conditionnelles (`useOrgMembers`,
> `useTeamTasks`, `useTeamOKRs`, toutes en `live`) et 1 filet de sécurité à 5 min sur `useTasks`,
> actif seulement si une collaboration est en cours.
>
> **La leçon vaut plus que le correctif, et elle est en deux temps.**
>
> 1. **Un total ne prouve rien ; seul un décompte nominatif prouve quelque chose.** « 9 → 6 » se
>    lisait comme un progrès et cachait trois sondages permanents. Le tableau ci-dessous existe
>    pour ça : il oblige à écrire, pour chaque déclaration, **qui la monte**.
> 2. **`isDemo ? false : 20_000` n'est pas une garde.** Ces deux-là avaient été comptés comme
>    « gardés par le mode démo ». C'est l'inverse : la condition retire le sondage du seul
>    environnement qui ne paie rien, et le laisse en production, là où il coûte.
>
> Voici l'état qui a été trouvé, conservé parce qu'il explique le mécanisme :
>
> | Hook | Cadence | Monté par | Verdict |
> |---|---|---|---|
> | `useOrgMembers` | 20 s | `/entreprise` uniquement | ✅ conditionnel (`live`) |
> | `useTeamProjects` | 20 s | `/entreprise` uniquement | ✅ conditionnel (`live`) |
> | `useTasks` | 5 min | partout | ✅ filet de sécurité, et **seulement** si une collaboration est active |
> | **`useTeamOKRs`** | **30 s** | **`CommandPalette`, monté dans `App.tsx`** | ❌ **permanent, sur TOUTES les pages** |
> | **`usePendingSharedTasks`** | **20 s** | `InboxMenu` (`/dashboard`) et `TasksInboxMenu` (`/tasks`) | ❌ permanent sur les deux pages du socle |
> | **`useOrgJoinRequests`** | **20 s** | `InboxMenu` + `use-org-notifications` | ❌ permanent, pour les admins d'organisation |
>
> **Le pire des trois était `useTeamOKRs`**, et il est de la même famille que le bug déjà corrigé
> pour `useTeamTasks` : `CommandPalette` est monté **au niveau `App`** pour porter le raccourci
> Ctrl/Cmd + K. Il appelait donc `useTeamOKRs(activeOrg?.id)` en permanence, palette **fermée**,
> sur chaque écran. Tout membre d'une organisation payait **120 requêtes par heure d'onglet
> ouvert** pour une liste que personne ne regardait.
>
> ⚠️ **Le motif est à retenir, parce qu'il s'est produit deux fois** : un composant monté au
> niveau `App` pour un raccourci clavier **transforme n'importe quel hook qu'il appelle en coût
> permanent, sur toutes les pages**. `CommandPalette` a déjà fait payer `useTeamTasks` de cette
> façon, et a recommencé avec `useTeamOKRs`. Tout hook consommé par `CommandPalette` doit être
> considéré comme monté partout.
>
> **Bilan chiffré** : de ~24 à **~0** requête par minute et par utilisateur avant interaction,
> hors écrans qui regardent réellement une liste. Le module `friends` est à zéro.

### 🟠 2026-08-27 · le sondage était éteint, la RELECTURE ne l'était pas

> Troisième forme du même motif, et elle échappe entièrement au décompte des `refetchInterval`.
> `useOrgBadges` est monté par `Layout`, donc **sur toutes les pages protégées**, pour tout membre
> d'une organisation. Il montait `useTeamTasks` avec la politique **par défaut** du hook,
> `staleTime` 30 s et `refetchOnWindowFocus`, alors qu'il n'affiche pas la liste : il en dérive un
> chiffre pour peindre une pastille.
>
> Conséquence : **chaque retour d'onglet**, et chaque navigation espacée de plus de 30 s,
> relançait `get_my_team_tasks` depuis n'importe quelle page. C'est-à-dire la lecture la plus
> chère du produit (§2 et mig. 113), pour un nombre.
>
> **Correctif (commit `73f6734`)** : `useTeamTasks` gagne l'option `background`, symétrique de
> `live` (`staleTime` 5 min, pas de refetch au retour d'onglet). Rien ne change sur `/entreprise` :
> `staleTime` et `refetchOnWindowFocus` sont **par observateur**, donc l'écran qui regarde
> réellement la liste garde la sienne, et c'est la sienne qui déclenche. Le compteur ne perd rien,
> sa source qui fait autorité est la boîte de réception, tenue à jour en Realtime
> (`useOrgInboxRealtime`) ; les tâches ne sont qu'un filet pour les organisations d'avant la
> mig. 095.
>
> ⚠️ **Gain non chiffré, et il ne le sera pas depuis la démo** : le mode démo lit `localStorage`,
> il n'y a **aucune requête à compter**. À confirmer dans les `edge_logs` d'une vraie session.
> Aucun point n'est attribué pour un gain non mesuré, c'est pourquoi la note de ce document ne
> bouge pas.
>
> 🔴 **Ce que ça dit du §3 tout entier.** Le décompte nominatif des `refetchInterval` était juste,
> et il ne voyait quand même pas ce coût-là : **la politique de fraîcheur par défaut d'un hook
> monté à l'échelle de l'application est un sondage qui ne dit pas son nom.** La bonne question
> n'est pas « combien de `refetchInterval` restent », mais **« quels hooks de liste sont montés
> par `Layout`, `App` ou `CommandPalette`, et avec quel `staleTime` »**. C'est la troisième fois
> que ce trio produit un coût permanent (`useTeamTasks`, puis `useTeamOKRs`, puis `useOrgBadges`).

### 🟢 2026-09-05 · le rechargement était éteint, la LECTURE ne l'était pas (C-05)

> Quatrième forme du même motif, et la dernière de cette série. Le correctif d'août avait coupé le
> **rechargement** de la pastille (`background`) ; la **lecture** partait toujours au premier
> montage, donc à chaque chargement de l'application, depuis n'importe quelle page protégée.
>
> **Trace « avant », production, 2026-09-05 10:41:31 UTC**, chargement à froid, une seule adresse —
> lue par session, jamais sur un compteur agrégé (leçon des onglets zombies) :
>
> ```
> 10:41:31.800  /rest/v1/rpc/get_my_org_inbox
> 10:41:31.802  /rest/v1/rpc/get_my_team_tasks     ← 2 ms apres l'inbox
>    …
> 10:41:31.960  /rest/v1/rpc/get_my_team_projects  ← 158 ms plus tard, autre vague
> ```
>
> **Ce qui désigne `Layout`, c'est l'écart, pas une absence.** `TaskTable` et les écrans
> /entreprise montent `useTeamProjects` et `useTeamTasks` dans le **même rendu** : leurs requêtes
> partent dans la même milliseconde. Ici `get_my_team_tasks` part avec la boîte de réception et
> `organization_members`, dès que l'organisation active est résolue ; `get_my_team_projects` suit
> 158 ms plus tard avec `okrs`, `kr_completions`, `lists`, `friends` — la vague de la page.
>
> ⚠️ **Le premier « avant » écrit ici citait la rafale de 20:11:24 et ne prouvait rien** :
> `useTeamProjects` garde 5 min de fraîcheur contre 30 s pour `useTeamTasks`, donc un simple retour
> sur `/tasks` produit la même signature. Corrigé le jour même. Une trace « avant » qui admet deux
> explications n'est pas une trace, c'est une coïncidence qu'on a lue dans le bon sens.
>
> **Correctif (mig. 142)** : la boîte de réception gagne une section `badge_tasks`. Le serveur
> rend les **seules** lignes dont la pastille a besoin — assignations en cours qui ne viennent pas
> de moi, et noms des tâches visées par mes notifications non lues — bornées à 200 et 50 **par
> organisation**. `useOrgBadges` ne monte plus `useTeamTasks` hors démo, où la source reste
> `localStorage` et ne coûte rien.
>
> **Parité mesurée avant application**, en prod, dans une transaction annulée : pour les 11 couples
> (compte, organisation) de la base, l'ensemble des identifiants est **identique** à celui que le
> client dérivait de `get_my_team_tasks` ; trois de ces couples sont non vides, sans quoi la
> comparaison n'aurait comparé que des zéros. Isolation vérifiée sur les 28 comptes : zéro fuite
> inter-organisations, zéro ligne pour un compte sans organisation.
>
> ⚠️ **La trace « après » manque encore** : elle demande une vraie session sur le front déployé.
> Tant qu'elle n'est pas prise, ce correctif est *appliqué et prouvé côté base*, **pas** mesuré de
> bout en bout — et la note de ce document ne bouge donc pas, même règle qu'en août.

### ✅ Contre-mesure indépendante, 2026-08-26 : oui, éteintes. Et ce que ça révèle.

> Le doute était légitime : les compteurs cumulés de `friend_requests` (269 682 `seq_scan` pour
> 11 lignes) et `shared_tasks` (158 356 pour 3 lignes) restaient énormes le lendemain du
> correctif. **Un compteur cumulé depuis la création de la base ne dit rien du débit courant.**
> La question ne se tranche que par un delta.
>
> Mesure faite sur les `edge_logs` de la journée du 2026-08-26 (18 408 requêtes `/rest/v1/*`),
> ventilées par **session** plutôt que par table, ce qui est le seul découpage qui sépare un
> client d'un autre :
>
> | Session | Requêtes / 24 h | dont `friend_requests` | Fenêtre | Verdict |
> |---|---|---|---|---|
> | `051be163` | 10 835 | 6 151 | 00:00 · 22:57 | ancien bundle, **sonde** |
> | `dc812ab1` | 6 002 | 2 044 | 09:27 · 22:22 | ancien bundle, **sonde** |
> | `7aa61ad2` | 1 185 | 52 | 10:17 · 22:10 | bundle courant, **aucune sonde** |
>
> La session `7aa61ad2` est restée ouverte **douze heures** et n'a émis que 52 lectures de
> `friend_requests`, soit 4 par heure, toutes attribuables à des changements d'écran. Les deux
> autres tapent toutes les 16 à 20 secondes, exactement aux cadences supprimées. **Le code livré
> est propre ; ce qui tourne encore, c'est du code d'avant.**
>
> ### Ce que ça révèle, et qui vaut plus que le correctif
>
> **91,5 % du trafic Supabase de la journée vient de deux onglets qui n'ont jamais été
> rechargés.** Une SPA ne recharge pas son bundle toute seule : un onglet laissé ouvert exécute
> indéfiniment la version qu'il a téléchargée. Un correctif de performance déployé n'atteint donc
> **que les utilisateurs qui rouvrent l'application**, et les plus assidus, ceux qui laissent
> l'onglet ouvert, sont précisément les derniers servis, et les plus coûteux.
>
> Corollaire de méthode : après un correctif côté client, **ne jamais valider sur les compteurs
> agrégés de la base**. Ils mélangent les anciens et les nouveaux clients, et donneront tort au
> correctif pendant des jours. Ventiler par session.
>
> ⚪️ **Reste ouvert** : COSMO n'a aucun mécanisme pour dire à un onglet ouvert qu'une nouvelle
> version existe. C'est le chantier qui transformerait ce correctif en gain réel pour tout le
> monde, pas seulement pour ceux qui rechargent.
### ⚪️ Combien de requêtes à l'ouverture du tableau de bord ? **32.** (mesuré 2026-08-26)

> Compte réel, pas estimé : une session unique du bundle courant (`7aa61ad2`), arrivée à froid
> sur `/dashboard`, émet **32 requêtes REST en 25 secondes**, toutes distinctes (aucun doublon,
> React Query dédoublonne correctement), sur 26 points d'entrée. Ventilation :
>
> | Ce qui les émet | Requêtes | Payées par |
> |---|---|---|
> | Données du tableau de bord (tâches, catégories, listes, agenda, habitudes, OKR, KR) | 9 | tout le monde |
> | Collaboration (amis, demandes, tâches et listes partagées, liens) | 6 | tout le monde |
> | Mode entreprise (org, membres, adhésions, notifications, invitations, projets, tâches d'équipe) | 8 | **membres d'une org seulement** |
> | Session et profil (profil, abonnement, `touch_last_seen`) | 3 | tout le monde |
>
> Deux lectures possibles de ce chiffre, et il faut les tenir ensemble :
>
> - **Ce n'est pas absurde.** Le socle affiche sept domaines métier ; 32 requêtes parallèles sur
>   HTTP/2 ne coûtent pas 32 allers-retours en série. Un utilisateur sans organisation en économise
>   déjà 8.
> - **Ça plafonne la concurrence.** 32 requêtes par ouverture, c'est le multiplicateur qui
>   transforme 100 arrivées simultanées en 3 200 requêtes. C'est le nombre à surveiller le jour
>   d'un pic d'acquisition, bien avant le coût unitaire de chacune.
>
> ⚪️ Piste non tranchée : les 8 requêtes du mode entreprise sont montées par `Layout`, donc sur
> **toutes** les pages protégées, y compris quand aucun écran entreprise n'est affiché. Elles ne
> servent qu'à peindre un badge de notification. Les regrouper en une seule RPC d'agrégat
> ramènerait l'ouverture à 25 requêtes pour un membre d'organisation, sans rien changer à l'écran.
### Ce qui a été fait (2026-08-25, mig. 118 et 120)

> Trois sondages d'organisation (mig. 118) puis trois sondages d'amis (mig. 120,
> demandes reçues et envoyées à 15 s, listes partagées à 20 s), tous montés en
> permanence par `InboxMenu`, sont passés au Realtime. Deux tables suffisaient
> pour trois hooks : `friend_requests` porte les demandes reçues ET envoyées.
>
> Le module `friends` est à **zéro** `refetchInterval`.

### Le diagnostic d'origine

> **Le comptage de ce document était périmé : 12 `refetchInterval`, pas 8.** La vague entreprise
> en avait ajouté quatre depuis. Trois choses ont changé :
>
> - **`useTeamTasks` ne sonde plus par défaut.** C'était le pire des douze : monté par
>   `CommandPalette`, `TaskTable` et la vue « Aujourd'hui » — des surfaces **permanentes** — il
>   faisait payer à tout membre d'une organisation une lecture org-wide de `team_tasks` toutes les
>   20 s, sur TOUTES les pages, sans que personne ne regarde la liste. Et c'est la lecture la plus
>   chère du produit (§2). Il prend maintenant une option `live`, exactement comme `useOrgMembers`,
>   réservée aux écrans de /entreprise où l'on attend de voir une tâche arriver.
> - **`useRelatedTaskShares` ne sonde plus du tout.** `useSharedTasksRealtime` écoutait déjà
>   `shared_tasks` dans les deux directions et invalide désormais aussi cette clé : le canal qui
>   porte l'information était ouvert juste à côté, et on rejouait quand même la requête 180 fois
>   par heure d'onglet.
> - Le reste (demandes d'amis, boîte de réception d'organisation) est inchangé : petits payloads,
>   prédicats indexables, et pas de canal Realtime existant à réutiliser.
>
> **Ce qu'il reste à faire** pour fermer ce point : étendre Realtime aux notifications
> d'organisation, comme le suggère le paragraphe ci-dessous.

### Le diagnostic d'origine

L'audit du 2026-08-07 a remplacé le `refetchInterval` de 15 s de `useTasks` par du Realtime
(≈ 58 Mo/mois/utilisateur d'egress économisés). **Les 8 autres sondages sont toujours là** :

| Module | Intervalle | Nombre de hooks |
|---|---|---|
| `friends` | 15 s (×2), 20 s (×2) | 4 |
| `organizations` | 20 s | 2 |
| `team-projects` | 20 s | 1 |
| `team-okrs` | 30 s | 1 |
| `tasks` | 5 min (filet de sécurité) | 1 |

Un utilisateur qui laisse l'espace entreprise ouvert émet donc **≈ 24 requêtes par minute**, soit
~1 400 par heure d'onglet ouvert — **avant** toute interaction. À 1 000 utilisateurs actifs
simultanés : ~24 000 requêtes/minute, dont chacune paie le coût RLS du §2.

Les payloads sont petits (membres, demandes d'amis), donc l'egress n'est pas le sujet ici — c'est
le **nombre de requêtes** et le CPU DB. Un seul canal Realtime existe aujourd'hui
(`shared-tasks:<userId>`) ; le mécanisme est en place, il reste à l'étendre aux notifications
d'organisation.

---

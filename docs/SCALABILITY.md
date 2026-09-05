# Scalabilité — audit mesuré, décisions et runbook

**Audit refait le 2026-08-14** contre la prod, **volumétrie et périmètre remesurés le 2026-08-24**
(§1, §2bis). Le finding principal (§2) est **corrigé et appliqué en prod le 2026-08-24**. Mesuré
contre la prod (`ykeugqfgklejcdbrmawy`, Postgres 17.6, eu-west-1) et contre le code de `main`.
Remplace l'édition du 2026-06-10, dont les volumétries étaient périmées et dont une conclusion
s'est révélée fausse.

Toutes les mesures de ce document sont **reproductibles** : les requêtes sont en
[§10 Runbook](#10-runbook--refaire-cet-audit).

## Note de scalabilité : 71 → 84 → 86 → **89 / 100** (2026-08-24 → 2026-08-25 → 2026-08-29 → 2026-09-03) · inchangée au 2026-08-27

> ### 2026-09-03 · +3, la seule inconnue qui plafonnait la note est levée
>
> Le bloc du 2026-08-29 ci-dessous nommait ce qui retenait la note : **rien n'avait jamais été
> mesuré à volume**, et un basculement de plan ne se déduit d'aucun ratio. C'est fait, et le détail
> est en [§9ter](#9ter-mesuré-à-volume-le-2026-09-02--la-dernière-inconnue-est-levée).
>
> | | avant (§9bis, 08-28) | **§9ter, 09-02** |
> |---|---|---|
> | Volume éprouvé | 6 à 717 lignes | **200 puis 2 000 `team_tasks`**, organisation de 50 membres |
> | Basculement de plan | inconnu | **aucun** · `Seq Scan` d'un côté, `Function Scan` de l'autre, aux deux paliers |
> | Rapport entre les deux chemins | projeté « ≈ 6 700 buffers » | **mesuré 18 041 contre 51**, soit 354× |
> | Fiabilité du chronomètre | il donnait la réponse INVERSE à 717 lignes | temps et buffers **concordent** à 2 000 lignes |
> | Recomptage des `refetchInterval` | checkpoint manuel du §5 | **mécanisé** · `src/modules/polling.guard.test.ts`, 4 fichiers nommés + témoin |
>
> **La projection était 2,7× trop optimiste**, et c'est le résultat le plus utile : elle
> extrapolait linéairement depuis une organisation de 6 lignes. *Une projection tirée d'un cas
> dégénéré sous-estime, elle ne surestime pas.* Le croisement où le chronomètre cesse de mentir se
> situe **dans** une organisation ordinaire : ce qui protégeait le mauvais chemin n'était pas une
> subtilité de méthode, c'était l'absence de données.
>
> 🔴 **Ce qui plafonne à 89** : la mesure est faite sur un runner, pas contre la production, et elle
> est **mono-session** (rien sur la concurrence, rien sur `tasks` à plusieurs millions de lignes).
> Et le tableau de bord charge toujours le jeu de données complet, sans coût réel aujourd'hui
> (289 tâches et 128 événements au maximum pour un compte, mesuré le 2026-09-02) : le risque reste
> écrit, la mesure ne le justifie toujours pas.

> ### 2026-08-29 · +2, deux inconnues portées depuis des semaines sont levées
>
> **Le coût par ligne est mesuré, plus projeté.** Le chemin direct sur `team_tasks` coûte
> **3,33 buffers par ligne**, celui de `tasks` **0,061** : un rapport de **54×**. L'audit du
> 2026-08-14 avait établi « ≈ 60× » par une autre méthode, deux semaines plus tôt. Deux mesures
> indépendantes, même ordre de grandeur : le chiffre qui justifie les migrations 113 et 117 tient.
>
> **Le pooler n'était pas le sujet.** `SCALABILITY.md` demandait depuis deux semaines de confirmer
> que la production utilise l'URL du pooler. Mesuré dans `pg_stat_activity` : l'application
> **n'ouvre aucune connexion Postgres**. Les 11 connexions applicatives viennent toutes de
> PostgREST, qui tient son propre pool, et leur nombre ne dépend pas du nombre d'utilisateurs
> connectés. 14 sur 60, une seule active. Le frein de montée en charge est le pool PostgREST et le
> CPU de la base, pas le nombre de connexions.
>
> 🔴 **Ce qui plafonne à 86, et n'a pas bougé** : rien n'a été mesuré à VOLUME. La production
> compte 8 tâches d'équipe. Un basculement de plan ne se déduit pas d'un ratio, et cette
> vérification demande un vrai jeu de données sur une branche ou une stack locale, jamais en
> production. C'est T-41, toujours à moitié faite. → ✅ **Levé le 2026-09-02** (§9ter) : la stack
> montée par le runner de CI était la quatrième porte, et elle était ouverte depuis le début.

> **2026-08-27 · note inchangée, un finding rouvre sous une autre forme.** La pastille de
> navigation rechargeait `get_my_team_tasks` à chaque retour d'onglet, depuis toutes les pages
> protégées, sans qu'aucun `refetchInterval` ne soit en cause : c'est la **politique de fraîcheur
> par défaut** d'un hook de liste monté par `Layout` qui coûtait. Corrigé le jour même
> (§3, « le sondage était éteint, la relecture ne l'était pas »), mais **le gain n'est pas
> mesuré** : le mode démo n'émet aucune requête, la confirmation viendra des `edge_logs` d'une
> vraie session. Un correctif non mesuré ne rapporte pas de point ici, c'est la règle du §1 de
> cette note (« rien n'a été mesuré à volume »).

| Ce qui compose la note | 08-24 | 08-25 |
|---|---|---|
| §2 Coût RLS des lectures entreprise | ✅ corrigé (mig. 113) | ✅ |
| §2bis `team_task_dependencies` | ❌ ouvert, hérite du coût | ✅ **corrigé** (mig. 117) |
| §3 Sondage périodique | ❌ 12 `refetchInterval`, ~24 req/min/onglet | ✅ **4, aucun permanent** (mig. 118 + 120, puis 2ᵉ passe) |
| §4 Payload `habits.completions` | ❌ non borné, ~280 ko projetés à 3 ans | ✅ **borné** (mig. 119 + 121) |
| §5 Pagination / hook mort | ❌ livré, 0 consommateur | ✅ **tranché** : supprimé, marche à suivre laissée |
| §8 Plan Postgres | Free, pas de PITR | **inchangé** |

**+13, le plus gros mouvement de tous les audits.** Quatre findings structurels sur cinq sont
refermés en une journée, et tous les quatre par le même geste : **déplacer le calcul là où sont
les données**, une RPC qui joint au lieu d'un prédicat par ligne, un agrégat serveur au lieu d'un
transfert d'historique, un canal Realtime au lieu d'un tick.

**Ce qui l'empêche d'aller plus haut, honnêtement :**

1. **Rien n'a été mesuré à volume.** Les correctifs sont vérifiés en plan, en tests et en
   décompte, **pas** contre une organisation de 50 personnes et 2 000 tâches. La projection du
   §9 reste une projection, et c'est exactement le genre de confiance non vérifiée qui a laissé
   passer un `Seq Scan` global pendant six semaines (§6).
2. **Le §3 a été annoncé fermé une première fois alors qu'il ne l'était pas.** Il l'est
   maintenant, mais au deuxième essai, et c'est un décompte à la main qui l'a rattrapé, pas une
   garde. Tant qu'aucun script ne compte les `refetchInterval` inconditionnels, la troisième
   occurrence est une question de temps.
3. Le plan Free n'a pas bougé : c'est toujours le seul bloquant de résilience.

---

## 1. Volumétrie réelle (remesurée le 2026-08-24)

| Métrique | Valeur au 2026-08-14 | Valeur au 2026-08-24 |
|---|---|---|
| Comptes | 27 | **28** (**+1 en 11 jours**) |
| Comptes actifs sur 7 j | 0 | **8** — mais ce sont les comptes de test du mode entreprise, pas des utilisateurs acquis |
| `profiles.acquisition_source` renseignée | 0 | **0** — la machinerie d'attribution (mig. 097) n'a toujours **jamais** été exercée |
| Organisations | — | **4** |
| `org_subscriptions` | — | **0** (paywall entreprise dormant, conforme) |
| Table la plus grosse (métier) | `tasks` — 710 lignes | `tasks` — **709 lignes**, 504 ko |
| Tables entreprise | — | `team_tasks` 8 · `team_projects` 5 · `org_team_members` 4 · `organization_members` 10 |

| Métrique (inchangée) | Valeur |
|---|---|
| Taille base | **18 Mo** |
| Profondeur max par compte | **289 tâches**, 128 événements (moyenne : 39 tâches) |
| Plafond applicatif | `MAX_ROWS = 5000` lignes par `getAll()` |

**Conclusion de cadrage : il n'y a aucune charge.** La base est à 0,1 % du plafond du plan Free.
Tout ce qui suit est donc **structurel** — des coûts qui ne se voient pas aujourd'hui et qui
deviennent bloquants à volume. Les mesurer maintenant est le seul moyen de les voir.

---

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

## 4. ⚪️ Payload des `getAll()` — mesuré le 2026-08-24, et NE PAS le faire

> **Verdict : le gain ne justifie pas le risque. Chiffres en prod, pas une estimation.**
>
> | Table | Lignes | Poids moyen / ligne | Ce que trimmer ferait gagner |
> |---|---|---|---|
> | `events` | 360 | 186 o | `description` = **4 146 o au TOTAL**, soit ~11 o/ligne — **6 %** du poids de la table |
> | `habits` | 32 | 594 o | le gros du poids EST `completions`, indispensable au tableau |
> | `okrs` | 14 | 786 o | le gros du poids EST `key_results`, indispensable à l'affichage |
> | `categories` | 40 | 84 o | rien à retirer |
> | `friends` | 11 | 121 o | rien à retirer |
>
> Le prérequis (faire pointer chaque modale sur un `getById`) coûterait un refactor par
> module, avec un risque réel de vider des champs dans les modales — pour 6 % sur la
> seule table où il y a quelque chose à gagner. **On ne le fait pas**, et c'est une
> décision, pas un report.
>
> ✅ **Le vrai point de rupture de payload — CORRIGÉ le 2026-08-24 (mig. 119).**
>
> `habits.completions` grandissait d'une entrée PAR JOUR et PAR habitude, sans borne :
> **12,7 octets par jour** mesurés (1 538 o pour 121 jours), soit ~14 ko par habitude
> et **~280 ko par lecture de liste** à trois ans pour 20 habitudes.
>
> **Pourquoi on ne pouvait pas simplement tronquer.** Deux consommateurs ont besoin de
> l'historique complet, et les tronquer aurait affiché des chiffres FAUX — pire qu'un
> gros payload : la **série** (`streak.ts` remonte jusqu'à 3 650 jours) et la vue
> **« Tout »** de `HabitGlobalTracking`.
>
> **Le correctif déplace le CALCUL, pas seulement la donnée.** `get_my_habits(p_days)` :
> - `completions` filtré aux 400 derniers jours → payload **borné**, il ne croît plus ;
> - `streak_current`, `streak_best`, `completions_total`, `first_completion_date`
>   calculés **serveur sur l'historique entier** → chiffres **exacts** sans le transférer.
>
> Vérifié en prod : à fenêtre 30 j, le payload passe de **32 ko à 160 octets**. À 400 j
> il est aujourd'hui identique (l'historique le plus ancien a 227 jours) — le correctif
> est **préventif**, il mordra quand les premiers comptes passeront un an.
>
> ⚠️ **Trois dérivations ont dû suivre**, sinon la troncature aurait menti :
> `habitStreak()` préfère le chiffre serveur, l'export CSV utilise `completionsTotal`
> (un export tronqué casserait la portabilité RGPD art. 20), et la vue « Tout » part de
> `firstCompletionDate`. Toute nouvelle dérivation de `completions` doit se poser la même
> question : *est-ce que ça a besoin de plus que la fenêtre ?*
>
> 🟡 **Reste, borné et connu** : `toggle_habit_completion` renvoie encore la ligne
> entière à chaque coche (~14 ko à trois ans, pour UNE habitude). Le résultat est jeté
> — `onSuccess` invalide et refetch — donc le coût ne croît pas avec le nombre
> d'habitudes. À traiter si le clic devient un point chaud mesuré.

### Le diagnostic d'origine

Vérifié dans le code le 2026-08-14 :

- ✅ **`tasks` est trimmé** : `TASK_LIST_COLUMNS` est bien la source unique des colonnes de liste,
  et sert aussi la RPC `get_my_tasks`. `getById` garde `select('*')` pour la modale.
- ❌ **`events`, `habits`, `okrs`, `friends`, `categories` sont toujours en `select('*')`.**

La raison d'origine tient toujours : ces modules n'ont pas de séparation liste/détail, leur modale
d'édition réutilise la ligne chargée par `getAll`, donc trimmer viderait des champs dans la modale.
Le prérequis reste le même : faire pointer chaque modale sur un hook `getById` avant de trimmer.

---

## 5. ⚪️ Pagination UI — tranchée le 2026-08-25 : le hook mort est supprimé

> `useTasksInfinite` était livré depuis des mois avec **zéro consommateur**. Il
> a été supprimé, avec la marche à suivre laissée en commentaire à sa place.
>
> **Ce n'était pas le hook qui manquait, c'était le prérequis.** `TasksPage`
> calcule ses compteurs par chip, ses smart lists et son tri EN MÉMOIRE sur le
> dataset complet. Paginer sans pousser filtres, tri et comptage côté SQL
> donnerait des compteurs FAUX et des smart lists incomplètes : un bug bien
> pire que le payload visé.
>
> L'ordre de travail, le jour où le volume le justifie : (1) une RPC
> d'agrégats, (2) filtres et tri côté serveur, (3) alors seulement la
> pagination. Marge actuelle : plafond 5 000, maximum observé 289, facteur ×17.
>
> `getPage()` est CONSERVÉ sur les repositories : ce n'est pas du code mort
> mais une capacité d'interface implémentée et testée sur tous les modules.

### Le diagnostic d'origine

`useTasksInfinite` / `getPage` existent et ne sont consommés par **aucune page** (vérifié :
zéro occurrence dans `src/**/*.tsx`). Le plafond reste `MAX_ROWS = 5000` par compte, pour un
maximum observé de **289**. Marge : ×17.

Ce n'est toujours pas un quick-fix : `TasksPage` calcule compteurs par chip, smart lists
(`overdue` / `this-week` / `high-priority`) et tri **en mémoire sur le dataset complet**. Paginer
sans pousser filtres, tri et comptage côté SQL donnerait des compteurs faux et des smart lists
incomplètes. Le rendu, lui, est déjà virtualisé au-delà de 50 items — l'affichage n'est pas le
problème, le payload l'est.

---

## 6. Leçon de méthode — mesurer à froid puis à chaud

En mesurant `get_my_tasks()` j'ai d'abord obtenu **1 014 buffers / 18,5 ms**, contre
**47 buffers / 0,53 ms** pour la lecture directe. Lu tel quel, ce chiffre disait « la mig. 085 a
rendu les choses 35× pires ».

C'était un **artefact de mesure** : premier appel dans une session neuve, donc compilation du plan
de la fonction incluse. Les deux appels suivants dans la même transaction donnent
**18 buffers / 0,90 ms**, et le corps de la fonction planifie bien en
`Index Scan using idx_tasks_user_id` + `Index Scan using tasks_pkey` — exactement ce que la
mig. 085 annonçait. **La mig. 085 est confirmée bonne.**

Deux règles à retenir pour tout futur audit :

1. **Toujours mesurer à chaud** (appeler deux fois avant d'`EXPLAIN`), sinon on mesure le
   planificateur, pas la requête.
2. Le coût de plan à froid n'est pas nul pour autant : ~18 ms au premier appel dans une connexion
   neuve. Avec un pooler en mode transaction, cela arrive plus souvent qu'on ne le croit — c'est
   un argument de plus pour le pooling **persistant**, pas contre la RPC.

C'est le même piège que l'édition précédente de ce document, où la conclusion « le planner
basculera en `BitmapOr` à volume réel » — une projection jamais vérifiée — avait masqué un
`Seq Scan` global pendant six semaines.

---

## 7. Index — 43 jamais utilisés

Les advisors remontent 43 `unused_index`, en très grande majorité sur les tables entreprise
(`org_notifications` ×5, `team_task_*`, `org_invite_links` ×4, `team_okr_teams`…) et sur des FK
`created_by` / `added_by`.

**Décision : on ne supprime rien.** Ces index sont soit des chemins d'accès qui deviennent chauds
à volume, soit des FK `ON DELETE CASCADE` (où l'absence d'index transforme chaque suppression en
scan complet de la table enfant). Sur 18 Mo de base, leur coût d'écriture est négligeable. À
réévaluer seulement si le volume d'écriture devient un point chaud mesuré.

Aucun advisor `multiple_permissive_policies` ni `auth_rls_initplan` : les acquis des mig. 049 et
085 tiennent.

---

## 8. Infrastructure (hors dépôt)

| Item | État | Action |
|---|---|---|
| **Plan Postgres** | Free — **bloquant A-9** (pas de PITR, restauration jamais testée) | Passer en Pro, cf. [`../faille.md`](../faille.md) |
| **Connection pooling** | ✅ **Vérifié le 2026-08-28 — et la question ne se posait pas comme on croyait** | **L'application n'ouvre AUCUNE connexion Postgres.** Mesuré dans `pg_stat_activity` : les 11 connexions applicatives viennent toutes de **PostgREST** (rôle `authenticator`), qui tient son propre pool derrière HTTPS. Leur nombre ne dépend donc pas du nombre d'utilisateurs connectés. Marge : **14 connexions sur 60**, dont une seule active. Le pooler ne concerne que les accès DIRECTS — `npm run test:rls`, l'application des migrations, un futur worker — jamais le chemin de l'app. Le frein de montée en charge n'est pas le nombre de connexions, c'est le pool PostgREST et le CPU de la base |
| **Read replicas** | Non activées (plan) | À ×100 utilisateurs actifs. L'app est déjà compatible : lectures et écritures sont séparées dans les repos |
| **CDN** | ✅ OK | Assets Vercel immuables (`max-age=31536000`) |
| **Cache serveur (Redis)** | ❄️ YAGNI | React Query couvre le cache client ; aucun besoin mesuré |
| **File d'attente** | ❄️ YAGNI | Tout est synchrone ; le webhook Stripe est idempotent |

---

## 8bis. Coûts — audit du 2026-08-14 (jamais fait avant)

**Coût actuel : 0 €/mois.** Vérifié via l'API Supabase : organisation `cosmo` en plan **Free**,
coût projet à **0**. Vercel n'est pas interrogeable depuis ce dépôt (connecteur non autorisé), mais
le projet tient largement dans le palier gratuit au vu du trafic mesuré.

**Consommation contre les plafonds du plan Free** :

| Ressource | Consommé | Plafond Free | Marge |
|---|---|---|---|
| Base de données | **18 Mo** | 500 Mo | ×27 |
| Comptes | 27 | 50 000 MAU | ×1 850 |
| Egress | non mesurable depuis le dépôt | 5 Go/mois | à surveiller |

**Le problème n'est pas le coût, c'est ce que le plan gratuit ne fournit pas** : ni PITR, ni
rétention de backup sérieuse, ni branches de base de données — c'est le bloquant **A-9** de
[`../faille.md`](../faille.md). Le passage au plan payant n'est donc pas une décision de
capacité mais de **résilience** : aujourd'hui, une erreur de manipulation en prod n'est pas
rattrapable.

⚠️ **Je ne cite volontairement aucun tarif** : les grilles changent, et une doc qui affirme un
prix périme plus vite qu'elle ne sert. Le montant est à lire sur la page de tarification Supabase
au moment de la décision. Ce que cet audit établit, c'est que **le coût d'infrastructure n'est pas
un obstacle à ce stade** — 0 € aujourd'hui, et la seule dépense justifiée est celle qui achète la
capacité de restaurer.

Deux postes à surveiller quand le trafic viendra, tous deux déjà quantifiés ailleurs dans ce
document : l'**egress** (§3, ~24 requêtes/minute par onglet entreprise ouvert) et le **CPU
base** (§2, coût RLS par ligne scannée).

## 9. Capacité — estimation révisée

L'ancienne édition raisonnait « ×10 / ×100 / ×1000 utilisateurs ». C'est le mauvais axe : le frein
n'est pas le nombre de comptes, c'est **le volume par organisation** et **le nombre de requêtes
par utilisateur actif**.

| Scénario | Verdict |
|---|---|
| **×10 comptes perso** (270) | ✅ Sans modification. |
| **×100 comptes perso** (2 700) | 🟡 Tient. Prévoir le pooling et surveiller le CPU DB. |
| **Une organisation de 50 personnes, ~2 000 team_tasks** | 🟡 **Coût par ligne mesuré le 2026-08-28 (§9bis), plan à volume toujours non vérifié** : les lectures passent par `get_my_team_tasks` / `get_my_team_projects` / `get_my_team_task_dependencies` (mig. 113 et 117), qui n'évaluent le sous-arbre managérial qu'une fois par organisation. Le ~420 ms projeté ne s'applique plus au chemin emprunté. **Mais aucune mesure n'a été faite à ce volume** : la prod compte 8 `team_tasks`. |
| **1 000 utilisateurs actifs simultanés** | 🟡 Le sondage est tombé de ~24 à ~4 req/min/utilisateur (§3), soit ~4 000 req/min au lieu de 24 000. Reste `useTeamOKRs`, permanent sur toutes les pages pour tout membre d'organisation. |

### 9bis. Mesuré le 2026-08-28 — ce qui est prouvé, et ce qui ne l'est toujours pas

Le §2 ne pouvait pas être mesuré comme prévu : injecter 2 000 `team_tasks` demanderait d'**écrire
en production**, ce que ce dépôt interdit. Ce qui a été fait à la place : mesurer le **coût par
ligne**, puisque c'est lui — et lui seul, dit le §10 — qui se projette linéairement. Toutes les
mesures sous le rôle `authenticated` réel, plan chauffé, transaction annulée.

| Chemin | Lignes balayées | Buffers | Buffers / ligne |
|---|---|---|---|
| `team_tasks` en direct, **une** organisation | 6 | 20 | **3,33** |
| `tasks` en direct, table entière | 717 | 44 | **0,061** |

**Le rapport est de 54×**, et c'est le résultat le plus utile de cette mesure : l'audit du
2026-08-14 avait établi « ≈ 60× le coût par ligne du prédicat de `tasks` » par une autre méthode,
sur une autre journée. **Deux mesures indépendantes, deux semaines d'écart, même ordre de
grandeur.** Le chiffre qui justifie les migrations 113 et 117 tient.

**La cause est visible dans le plan, à n'importe quel volume** — c'est pourquoi elle n'a pas
besoin de 2 000 lignes pour être établie : le chemin direct sur `team_tasks` porte
`Filter: can_access_team_project(project_id)`, **un appel de fonction par ligne examinée**, tandis
que le prédicat de `tasks` est entièrement hissé (`InitPlan` + `hashed SubPlan`), donc évalué une
fois par requête.

**Projection, au ratio mesuré** : 2 000 `team_tasks` lues par le chemin direct ≈ **6 700 buffers**,
soit ~52 Mo de trafic de buffers pour une ouverture d'écran. Par la RPC, le sous-arbre est évalué
une fois et le coût retombe sur la lecture des lignes.

> 🔴 **LE PIÈGE, et il faut le lire avant de « re-optimiser ».** À volume actuel, mesurer en
> **millisecondes** donne la réponse INVERSE de la bonne :
>
> | | Buffers | Temps |
> |---|---|---|
> | `select * from tasks` (direct, 717 lignes) | 44 | **0,219 ms** |
> | `get_my_tasks()` (le chemin imposé) | **30** | 1,739 ms |
>
> La RPC lit **moins de buffers** — l'index fait son travail — et elle est **8× plus lente en
> temps**, parce qu'à 717 lignes tenant en cache, le coût fixe d'un appel de fonction domine tout.
> Quelqu'un qui chronomètre aujourd'hui conclurait qu'il faut revenir à `.from('tasks')`, et il
> aurait tort : le coût du chemin direct croît avec **la table entière, tous comptes confondus**,
> celui de la RPC avec **les seules lignes de l'appelant**. À 7 millions de lignes, le premier
> demande ~427 000 buffers par lecture, le second reste à quelques dizaines.
>
> **La règle du §10 — se fier au ratio buffers/ligne, jamais au chronomètre — n'est pas un détail
> de méthode : c'est la seule lecture qui ne se retourne pas contre elle-même à petit volume.**

**Ce qui reste NON prouvé, et qu'aucune astuce ne remplace** : le comportement du **planificateur**
à volume. Un basculement de plan (index → seq, hash → nested loop) ne se déduit pas d'un ratio, et
la prod ne compte que 10 `team_tasks`. Cette vérification-là demande vraiment un jeu de données —
sur une **branche** Supabase ou une stack locale, jamais en production.

---

### 9ter. Mesuré À VOLUME le 2026-09-02 — la dernière inconnue est levée

Le §9bis se terminait sur ce qui restait non prouvé : **le comportement du planificateur**. Il
l'est maintenant. La mesure tourne sur le runner de CI, qui monte déjà une stack Supabase complète
pour `rls-integration` — base jetable, volume libre, aucune ligne écrite en production.
`npm`-side : `scripts/scalability-volume.mjs`, déclenché par le workflow `scalability-volume`
(manuel, jamais une gate). Organisation de 50 membres, pyramide sur trois niveaux, 5 équipes,
20 projets **rattachés à des équipes** (la branche coûteuse du prédicat).

| Volume | Chemin | Buffers | Lignes balayées | Buffers/ligne | Rendues | ms | Plan |
|---|---|---|---|---|---|---|---|
| 200 | direct (`team_tasks`) | 1 805 | 200 | **9,03** | 40 | 69,97 | `Seq Scan` |
| 200 | `get_my_team_tasks` (membre) | 15 | 40 | **0,38** | 40 | 1,06 | `Function Scan` |
| 200 | `get_my_team_tasks` (manager) | 20 | 200 | **0,10** | 200 | 1,23 | `Function Scan` |
| 2 000 | direct (`team_tasks`) | **18 041** | 2 000 | **9,02** | 400 | 704,47 | `Seq Scan` |
| 2 000 | `get_my_team_tasks` (membre) | **51** | 400 | **0,13** | 400 | 1,84 | `Function Scan` |
| 2 000 | `get_my_team_tasks` (manager) | 56 | 2 000 | **0,03** | 2 000 | 2,34 | `Function Scan` |

**1. Aucun basculement de plan.** C'était la question, et la réponse est nette : `Seq Scan` d'un
côté, `Function Scan` de l'autre, identiques aux deux paliers. Le risque qu'un ratio stable masque
un changement de plan n'existe pas ici.

**2. Le chemin direct est rigoureusement linéaire en la table ENTIÈRE.** Son ratio ne bouge pas
(9,03 → 9,02) pendant que les buffers font ×10 avec le volume — 1 805 → 18 041 pour dix fois plus
de lignes. C'est la démonstration de ce que la projection du §9bis annonçait : le coût d'une
lecture croît avec le volume de toute la plateforme, pas avec celui de l'appelant.

**3. Le rapport entre les deux chemins, à 2 000 lignes et pour le MÊME acteur : 18 041 contre 51
buffers, soit 354×.** Le §9bis projetait « ≈ 6 700 buffers » à ce volume à partir d'un ratio de
3,33 mesuré sur une organisation minuscule. Le réel est **2,7 fois pire** que la projection, parce
que cette organisation-ci a 20 projets et 5 équipes : le prédicat a plus de travail par ligne. Une
projection linéaire à partir d'un cas dégénéré sous-estime, elle ne surestime pas.

> 🔴 **Et le piège du §9bis se referme, ce qui est le fait le plus utile de cette mesure.** À
> 717 lignes, le chronomètre donnait la réponse INVERSE de la bonne : la RPC lisait moins de
> buffers et mettait 8× plus de temps. À 2 000 lignes, les deux lectures **concordent** — 704 ms
> contre 1,84 ms, dans le même sens que les buffers. Le croisement se produit donc **en dessous de
> 2 000 lignes d'équipe**, c'est-à-dire dans une organisation ordinaire. Ce qui protégeait le
> mauvais chemin n'était pas un doute méthodologique : c'était uniquement le fait qu'on n'avait
> jamais de données.

⚠️ Ce que cette mesure ne dit toujours pas : rien sur `tasks` à plusieurs millions de lignes, ni
sur la concurrence (elle est mono-session). Elle porte sur le prédicat d'entreprise, à froid comme
à chaud sur un runner partagé — les millisecondes absolues n'ont donc pas de valeur, seuls les
rapports en ont.

---

**Ordre de traitement recommandé, révisé le 2026-08-28.** Les deux findings qui bloquaient le
cas d'usage B2B (§2 et §2bis) sont refermés, le payload (§4) et le hook mort (§5) aussi. Il reste,
par ordre décroissant de rapport valeur/effort :

1. ✅ **`useTeamOKRs` en `live` conditionnel** — **déjà fait**, vérifié le 2026-08-27 :
   `team-okrs/hooks.ts` porte `...(options?.live ? { refetchInterval: 30_000 } : {})`.
2. ✅ **Mesurer §2 à volume réel — FAIT le 2026-09-02 (§9ter).** Aucun basculement de plan entre
   200 et 2 000 `team_tasks`, le chemin direct est linéaire en la table entière (ratio 9,0 stable,
   buffers ×10), et le rapport entre les deux chemins atteint **354×** à 2 000 lignes. La mesure
   se rejoue par le workflow `scalability-volume` (déclenchement manuel).
3. Les deux derniers sondages permanents vers le canal Realtime existant.

---

## 10. Runbook — refaire cet audit

Toutes les mesures ci-dessus se rejouent en lecture seule. **Ne jamais écrire depuis le MCP.**

```sql
-- Volumétrie et usage par table
select relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid)) as total,
       seq_scan, idx_scan
from pg_stat_user_tables order by pg_total_relation_size(relid) desc limit 40;

-- Profondeur par compte (le vrai frein)
select max(c), round(avg(c)) from (select count(*) c from tasks group by user_id) t;

-- Coût réel d'un prédicat RLS, sous le bon rôle et À CHAUD
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';
select count(*) from team_tasks;          -- 1er appel : compile le plan
select count(*) from team_tasks;          -- 2e : réchauffe
explain (analyze, buffers) select * from team_tasks;   -- 3e : la mesure
rollback;
```

Lecture du résultat : diviser `Buffers: shared hit` par le nombre de lignes **scannées**
(`rows` + `Rows Removed by Filter`), pas par les lignes retournées. C'est ce ratio qui se projette
linéairement, et lui seul.

Côté code, les quatre points à revérifier : `TASK_LIST_COLUMNS` toujours unique source de colonnes,
`select('*')` restants dans les repos, `refetchInterval` (`grep -rn "refetchInterval:" src`), et
consommateurs de `useTasksInfinite`.

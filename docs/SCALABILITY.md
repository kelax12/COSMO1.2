# Scalabilité : décisions et runbook

Lire en touchant une policy RLS sur une table qui grossit, un `getAll()`, un `refetchInterval`, `scripts/scalability-*.mjs`, `.github/workflows/scalability-volume.yml`, ou avant de décider pagination, index, plan Postgres, replicas. Ce qui fait foi : les requêtes du runbook (§ 8) rejouées contre la prod en lecture seule, et le code. Les chiffres se REMESURENT, jamais recopiés.
Notes /100 cessées (ADR 0012). Mesures, récits et tableaux : [`archive/SCALABILITY-journal-des-notes-2026-08-07-au-2026-11-06.md`](./archive/SCALABILITY-journal-des-notes-2026-08-07-au-2026-11-06.md), [`archive/SCALABILITY-recits-rls-et-sondage-2026-08-14-au-2026-09-05.md`](./archive/SCALABILITY-recits-rls-et-sondage-2026-08-14-au-2026-09-05.md), [`archive/DOC-FRONT-recits-retires-2026-11-13.md`](./archive/DOC-FRONT-recits-retires-2026-11-13.md).

## 1. Cadrage

- ✅ Aucune charge aujourd'hui (base minuscule face au plafond du plan Free) : tout ce qui suit est STRUCTUREL, des coûts invisibles qui deviennent bloquants à volume. Volumétrie : requête du § 8.
- ⚠️ Le frein n'est pas le nombre de comptes mais le volume PAR ORGANISATION et le nombre de requêtes par utilisateur actif.

## 2. Coût RLS du mode entreprise (mig. `085`, `113`, `117`, `128`)

- ✅ Règle : une policy qui appelle, par ligne, une fonction qui parcourt le sous-arbre managérial coûte une évaluation par ligne scannée. Les tables d'équipe se lisent par des RPC indexables (`get_my_team_projects(p_org)`, `get_my_team_tasks(p_org)`, `get_my_team_task_dependencies`) qui évaluent le sous-arbre UNE fois par organisation ; les policies restent (défense en profondeur) ; `my_team_project_ids` est fermé à tous (`authenticated` n'exécute que les RPC). Verrou : `src/modules/team-projects/supabase.repository.test.ts`.
- ✅ Même motif trouvé sur `tasks` (085), `team_projects` et `team_tasks` (113), `team_task_dependencies` (117, délégation à `team_tasks`), `events` (128). Un garde-fou de migration le refuse : `scripts/migration-guards.test.mjs`. Règle courte : [`src/modules/CLAUDE.md`](../src/modules/CLAUDE.md) ; plans et mesures : [`PERFORMANCE.md`](./PERFORMANCE.md) § Chemins de lecture indexables.
- ✅ Mesuré (§ 8, rejouable) : le chemin direct sur `team_tasks` appelle `can_access_team_project(project_id)` PAR LIGNE examinée et est rigoureusement linéaire en la table ENTIÈRE (ratio buffers/ligne stable, buffers ×10 avec le volume), sans basculement de plan entre 200 et 2 000 lignes ; la RPC reste à quelques dizaines de buffers. Le rapport entre les deux chemins est de l'ordre de la centaine, et s'aggrave sous concurrence.
- 🔴 Se fier au RATIO buffers/ligne (lignes SCANNÉES, `rows` + `Rows Removed by Filter`), jamais au chronomètre : à petit volume la RPC lit moins de buffers mais prend plus de temps (coût fixe d'appel), et un chronomètre conclurait à tort de revenir à `.from('tasks')`. Le croisement se produit sous 2 000 lignes d'équipe, c'est-à-dire dans une organisation ordinaire.
- ❌ Projeter linéairement depuis un cas dégénéré (une petite organisation) : il sous-estime.
- ❌ Écrire en production pour mesurer. Les mesures qui exigent du volume tournent sur la stack jetable du runner (§ 8).

## 3. Sondage : aucun `refetchInterval` permanent

- ✅ Les sondages qui subsistent sont conditionnels (`live`, montés par `/entreprise`) ou un filet à 5 min sur `useTasks`, actif seulement si une collaboration est en cours ; les changements arrivent par Realtime. Liste nominative et garde : [`src/modules/CLAUDE.md`](../src/modules/CLAUDE.md) § Synchronisation, `src/modules/polling.guard.test.ts`.
- ❌ Décompter les sondages par un total (« 9 → 6 » cachait trois permanents) : qualifier chaque déclaration, nommément.
- ❌ `isDemo ? false : 20_000` n'est pas une garde : elle retire le sondage du seul environnement gratuit.
- ⚠️ Éteindre le rechargement n'éteint pas la lecture : `staleTime` et `refetchOnWindowFocus` sont par observateur.
- ✅ Postes à surveiller quand le trafic viendra : l'EGRESS (requêtes par minute et par onglet entreprise ouvert) et le CPU base (§ 2).

## 4. Payload des `getAll()` : ne PAS trimmer

- ✅ `tasks` est trimmé : `TASK_LIST_COLUMNS` est la source unique des colonnes de liste (aussi pour `get_my_tasks`) ; `getById` garde `select('*')` pour la modale.
- ❌ Trimmer `events`, `habits`, `okrs`, `friends`, `categories` (restent en `select('*')`) : le gain mesuré est négligeable (`events.description` ≈ 6 % du poids de la table ; pour `habits` et `okrs` le gros du poids est `completions` et `key_results`, indispensables à l'affichage) et le prérequis (un `getById` par modale) coûte un refactor par module, avec un risque réel de vider des champs. Décision, pas un report.
- ✅ Le vrai point de rupture de payload est `habits.completions` (une entrée par jour et par habitude, sans borne) : corrigé par `get_my_habits(p_days)` (mig. 119), la RPC déplace le CALCUL (série, total, première complétion, serveur, historique entier) → [`src/modules/habits/CLAUDE.md`](../src/modules/habits/CLAUDE.md). Toute nouvelle dérivation de `completions` pose la question : « a-t-elle besoin de plus que la fenêtre ? ».
- ⚠️ `toggle_habit_completion` renvoie encore la ligne entière à chaque coche (résultat jeté, `onSuccess` invalide et refetch) : coût borné, à traiter seulement si le clic devient un point chaud mesuré.

## 5. Pagination UI

- ✅ Tranchée : `useTasksInfinite` (zéro consommateur) est supprimé ; `getPage()` reste sur les repositories (capacité d'interface testée sur tous les modules). Pagination serveur des tâches et de l'agenda faite depuis : [`PERFORMANCE.md`](./PERFORMANCE.md) § Tâches et agenda.
- ❌ Paginer sans pousser filtres, tri et comptage côté SQL : compteurs par chip et smart lists faux. Ordre : (1) RPC d'agrégats, (2) filtres et tri serveur, (3) pagination.
- ✅ Le rendu est déjà virtualisé au-delà de 50 items : le goulot est le payload, pas l'affichage.

## 6. Leçon de méthode : mesurer à froid puis à chaud

- ✅ Mesurer À CHAUD : appeler deux fois avant `EXPLAIN` (le premier appel d'une session neuve compile le plan de la fonction ; la mig. 085 avait l'air 35× pire par cet artefact et était bonne). Le plan à froid (~18 ms) n'est pas nul : avec un pooler en mode transaction il arrive souvent, argument pour le pooling persistant, pas contre la RPC.
- ❌ Conclure d'une projection jamais vérifiée (« le planner basculera en `BitmapOr` à volume réel » a masqué un `Seq Scan` global pendant six semaines).

## 7. Index, infrastructure, coûts, capacité

- ❌ Supprimer les index « jamais utilisés » des advisors (`unused_index`, surtout tables entreprise et FK `created_by` / `added_by`) : chemins d'accès qui deviennent chauds à volume, ou FK `ON DELETE CASCADE` (sans index, chaque suppression scanne la table enfant). À réévaluer seulement si le volume d'écriture devient un point chaud mesuré. Aucun advisor `multiple_permissive_policies` ni `auth_rls_initplan` ne doit apparaître (acquis des mig. 049 et 085).
- ✅ Plan Postgres Free : pas de PITR, restauration jamais testée ; passer en Pro est une décision de RÉSILIENCE, pas de capacité (une erreur de manipulation en prod n'est pas rattrapable). Détail : `faille.md` (hors dépôt).
- ✅ Pooling : l'application n'ouvre AUCUNE connexion Postgres (les connexions applicatives viennent de PostgREST, rôle `authenticator`, qui tient son pool) : leur nombre ne dépend pas du nombre d'utilisateurs. Le pooler ne concerne que les accès DIRECTS (`npm run test:rls`, application des migrations, un futur worker). Le frein est le pool PostgREST et le CPU de la base. Vérifier par `pg_stat_activity`.
- ✅ Read replicas : non activées (plan), à des dizaines de fois plus d'utilisateurs actifs ; l'app est compatible (lectures et écritures séparées dans les repos). CDN : assets Vercel immuables (`max-age=31536000`). Redis et file d'attente : YAGNI (React Query couvre le cache client, tout est synchrone, le webhook Stripe est idempotent).
- ❌ Citer un tarif (les grilles changent) : le montant se lit sur la page de tarification au moment de la décision. Le coût d'infrastructure n'est pas un obstacle à ce stade ; la seule dépense justifiée est celle qui achète la capacité de restaurer.
- ✅ Capacité : centaines de comptes perso sans modification (prévoir le pooling persistant et surveiller le CPU DB à milliers) ; une organisation de 50 personnes et ~2 000 `team_tasks` passe par les RPC (mesurée à volume sur la stack jetable) ; milliers d'utilisateurs actifs simultanés : reste `useTeamOKRs` (conditionnel `live`, `team-okrs/hooks.ts`) et le sondage résiduel.

### Concurrence (C-16) et C-15

`scripts/scalability-concurrency.mjs` (même workflow que le volume, même organisation semée par `scripts/scalability-seed.mjs`) : N sessions Postgres, chacune sous un membre différent, martèlent `get_my_team_tasks(org)` ; un chiffre PAR SESSION est rendu (une moyenne cache la file d'attente).

- ✅ Le plateau de débit se situe au NOMBRE DE CŒURS : passé ce point une session de plus n'achète plus de débit, elle achète de l'attente (latence médiane ×6, p99 ×17 pour un débit identique). Le plafond est CPU : `cœurs / coût par requête`. Seul le coût unitaire le déplace : paginer ne gagne du débit qu'en proportion du CPU retiré par requête.
- ✅ Le chemin direct (le TÉMOIN) sature à quatre sessions et met plusieurs secondes par lecture à seize ; l'écart avec la RPC s'aggrave sous charge (la concurrence n'efface pas le défaut de la mig. 113, elle l'amplifie).
- ✅ Le harnais sort en ERREUR si son témoin (chemin direct) n'apparaît pas saturé au palier le plus chargé : un harnais qui rend toujours « ça tient » ne mesure rien. Verdict pur testé : `scripts/scalability-concurrency.stats.test.mjs`. ⚠️ Cette étape peut échouer sans que la base aille mal : c'est la détection qui est en cause.
- ⚠️ Le genou est celui du runner (`4 cœurs / coût unitaire`) : se transportent le COÛT UNITAIRE et la FORME de la courbe, jamais le nombre de sessions. La requête mesurée rend une ligne (`count(*)`), le coût de TRANSFERT n'est pas couvert (témoin : le rapport direct/RPC au palier le plus chargé ne doit pas s'effondrer vers 1 : le client serait redevenu le goulot). Rien n'est mesuré contre la production ni sur `tasks` à plusieurs millions de lignes ; le nombre de vCPU du plan Free n'est pas mesuré.
- ✅ **C-15** (« le tableau de bord charge le jeu de données complet ») reste fermé : le coût vient du CPU par requête, pas directement du volume par compte ni du nombre de sessions. Le tableau de bord lit au plus quelques centaines de tâches par compte (requête du § 8), une fraction du coût mesuré.
- 🔴 Rouvrir C-15 quand l'une de ces bornes est franchie, et pas avant : (1) un compte dépasse **2 000 lignes** dans une table qui alimente le tableau de bord ; (2) le nombre de sessions SIMULTANÉMENT actives en production atteint le nombre de vCPU du plan Postgres (à mesurer alors sur la prod, pas sur un runner).
- ✅ Le geste qui rapporte le plus : REJOUER ce harnais après tout changement du coût unitaire d'une lecture montée sur une page protégée.

## 8. Runbook : refaire cet audit

Tout se rejoue en lecture seule. ❌ Écrire depuis le MCP.

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

- ✅ Lecture : diviser `Buffers: shared hit` par les lignes SCANNÉES (`rows` + `Rows Removed by Filter`), pas retournées ; c'est ce ratio qui se projette linéairement, et lui seul.
- ✅ Les mesures qui exigent du volume écrivent : elles ne tournent PAS en production mais sur la stack jetable du runner, par le workflow `scalability-volume` (manuel, jamais une gate) :

```bash
gh workflow run scalability-volume.yml --ref main   -f steps=2000 -f members=50 -f sessions=1,2,4,8,16 -f iterations=30
```

`steps` pilote les paliers de VOLUME, `sessions` ceux de CONCURRENCE (le palier 1 sert toujours de référence). Un plan à volume se vérifie sur une branche Supabase ou une stack locale, jamais en production (un basculement de plan ne se déduit pas d'un ratio).

- ✅ À revérifier dans le code : `TASK_LIST_COLUMNS` unique source de colonnes ; les `select('*')` restants dans les repos ; `grep -rn "refetchInterval:" src` ; consommateurs de `getPage`.

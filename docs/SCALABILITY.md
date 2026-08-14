# Scalabilité — audit mesuré, décisions et runbook

**Audit refait le 2026-08-14** contre la prod (`ykeugqfgklejcdbrmawy`, Postgres 17.6, eu-west-1)
et contre le code de `main`. Remplace l'édition du 2026-06-10, dont les volumétries étaient
périmées et dont une conclusion s'est révélée fausse.

Toutes les mesures de ce document sont **reproductibles** : les requêtes sont en
[§10 Runbook](#10-runbook--refaire-cet-audit).

---

## 1. Volumétrie réelle (2026-08-14)

| Métrique | Valeur |
|---|---|
| Taille base | **18 Mo** |
| Comptes | **27** au total, **4** créés sur 30 j, **0 actif sur 7 j** |
| Table la plus grosse (métier) | `tasks` — 710 lignes, 504 ko |
| Profondeur max par compte | **289 tâches**, 128 événements (moyenne : 39 tâches) |
| Plafond applicatif | `MAX_ROWS = 5000` lignes par `getAll()` |

**Conclusion de cadrage : il n'y a aucune charge.** La base est à 0,1 % du plafond du plan Free.
Tout ce qui suit est donc **structurel** — des coûts qui ne se voient pas aujourd'hui et qui
deviennent bloquants à volume. Les mesurer maintenant est le seul moyen de les voir.

---

## 2. 🔴 Le coût RLS du mode entreprise — mesuré, non corrigé

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

## 3. 🟠 Le sondage périodique n'a été supprimé que sur `tasks`

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

## 4. 🟡 Payload des `getAll()` — dette identifiée en 2026-06, toujours ouverte

Vérifié dans le code le 2026-08-14 :

- ✅ **`tasks` est trimmé** : `TASK_LIST_COLUMNS` est bien la source unique des colonnes de liste,
  et sert aussi la RPC `get_my_tasks`. `getById` garde `select('*')` pour la modale.
- ❌ **`events`, `habits`, `okrs`, `friends`, `categories` sont toujours en `select('*')`.**

La raison d'origine tient toujours : ces modules n'ont pas de séparation liste/détail, leur modale
d'édition réutilise la ligne chargée par `getAll`, donc trimmer viderait des champs dans la modale.
Le prérequis reste le même : faire pointer chaque modale sur un hook `getById` avant de trimmer.

---

## 5. 🟡 Pagination UI — toujours non câblée

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
| **Connection pooling** | Non vérifié depuis ce dépôt | Confirmer que la prod utilise l'URL pooler (PgBouncer 6543, mode transaction) — d'autant plus important vu §6 |
| **Read replicas** | Non activées (plan) | À ×100 utilisateurs actifs. L'app est déjà compatible : lectures et écritures sont séparées dans les repos |
| **CDN** | ✅ OK | Assets Vercel immuables (`max-age=31536000`) |
| **Cache serveur (Redis)** | ❄️ YAGNI | React Query couvre le cache client ; aucun besoin mesuré |
| **File d'attente** | ❄️ YAGNI | Tout est synchrone ; le webhook Stripe est idempotent |

---

## 9. Capacité — estimation révisée

L'ancienne édition raisonnait « ×10 / ×100 / ×1000 utilisateurs ». C'est le mauvais axe : le frein
n'est pas le nombre de comptes, c'est **le volume par organisation** et **le nombre de requêtes
par utilisateur actif**.

| Scénario | Verdict |
|---|---|
| **×10 comptes perso** (270) | ✅ Sans modification. |
| **×100 comptes perso** (2 700) | 🟡 Tient. Prévoir le pooling et surveiller le CPU DB. |
| **Une organisation de 50 personnes, ~2 000 team_tasks** | 🔴 **Ne tient pas confortablement** — chaque lecture de liste paie ~420 ms de RLS (§2). C'est le scénario du plan d'acquisition B2B. |
| **1 000 utilisateurs actifs simultanés** | 🔴 ~24 000 req/min de sondage seul (§3), chacune payant le coût RLS. |

**Ordre de traitement recommandé** : §2 (RPC entreprise indexable) d'abord — c'est le seul finding
qui bloque le cas d'usage que le produit cherche à vendre. Puis §3 (Realtime sur les hooks
d'organisation). §4 et §5 restent de la dette confortable tant qu'on est à 289 lignes par compte.

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

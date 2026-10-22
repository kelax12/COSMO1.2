> ⚠️ **ARCHIVE — plan/spec exécuté, instantané du 2026-08-08, non maintenu.**
> Le code livré fait foi, pas ce document. Sources vivantes :
> [`CLAUDE.md`](../../../../CLAUDE.md) · [`docs/`](../../../README.md).

# Mode entreprise — passation

> **Lis ce document en entier avant de toucher au code.** Il est écrit pour
> quelqu'un qui n'a rien vu de la session précédente. Les plans détaillés des
> 3 items restants sont dans `2026-08-08-entreprise-vague-5.md`.

**Branche :** `feat/entreprise-ux-vague-1` (12 commits, non mergée dans `main`)
**Dernier commit :** `bb828cb`
**Suite de tests :** 1212 verts, exit 0. Toute régression est réelle.

---

## 1. Ce qui a été fait : 19 items sur 22

Le point de départ était une liste de 22 améliorations UX du mode entreprise
(numérotation d'origine conservée partout : commits, commentaires, ce document).

| # | Item | Commit |
|---|---|---|
| 1 | Deep-links `?task=` / `?project=` | `1227cb8` |
| 2 | i18n — **sweep complet terminé** | `1227cb8`, `c4c9a95` |
| 3 | Badges de compteur par onglet | `1227cb8` |
| 4 | Pastilles de stats cliquables | `1227cb8` |
| 7 | Densité de liste réglable | `1227cb8` |
| 20 | `estimatedTime` exploité | `1227cb8` |
| 11 | Undo sur drag | `c28eefe` |
| 14 | Sélection multiple + actions groupées | `c28eefe` |
| 15 | Recherche élargie | `c28eefe` |
| 19 | Charge d'équipe | `735262f` |
| 28 | Pyramide augmentée (calque de charge) | `735262f` |
| 25 | Vue chronologique | `3fafce7` |
| 22 | Gabarits de projet | `3fafce7` |
| 9 | Statuts de tâche + kanban de flux | `367dd81` |
| 12 | Sous-tâches | `3aad29f`, `870039f` |
| 13 | Labels transverses | `3aad29f`, `e466eb2` |
| 21 | Historique de tâche | `3aad29f`, `e466eb2` |
| 17 | Notifications serveur | `ddecdc8` |
| 30 | Automatisation (rappel d'échéance) | `bb828cb` |
| 18 | **PARTIEL** — deep-link seul | `2c75db3` |

**Restent : 18 (fusion des sheets), 26, 29.**

---

## 2. ⚠️ La base de production — à lire avant toute migration

**Le projet Supabase actif s'appelle « cosmo test » mais c'est LA BASE DE
PRODUCTION.** Elle porte les vraies données d'Axel. Ref : `ykeugqfgklejcdbrmawy`.
Vérifiable dans `.env.cosmo-cli` (`COSMO_SUPABASE_URL`). Les deux autres
projets listés par `list_projects` sont INACTIVE.

**Il n'y a PAS de PITR** (plan Supabase `free`, restauration jamais testée —
`faille.md` A-9). Conséquence pratique : **toute migration doit être additive et
annulable par un `DROP`**. Pas d'`ALTER COLUMN` destructif, pas de `DROP` de
colonne existante, pas de `DELETE` de données.

Axel a explicitement autorisé l'application du SQL par l'agent. Le flux
historique (« Axel applique, Claude vérifie ») a donc été remplacé.

### Migrations 091 → 096 : APPLIQUÉES en production

| Mig. | Objet | Note |
|---|---|---|
| 091 | `team_tasks.status` + 2 triggers de synchro | additive, `completed` conservé |
| 092 | `team_task_subtasks` | table + RLS |
| 093 | `team_labels` + `team_task_labels` | table + jonction + RLS |
| 094 | `team_task_activity` (append-only) | + 094b sécurité, + 094c index FK |
| 095 | `org_notifications` | 2 triggers (assignation, mention) |
| 096 | `run_overdue_reminders()` + `pg_cron` | job `cosmo-overdue-reminders`, 07:00 UTC |

`pg_cron` est **installé** et le job est **actif**. Il a été exécuté
manuellement pour vérification : 2 notifications créées, second passage 0
(idempotence prouvée).

---

## 3. 🔴 Cinq pièges appris à la dure — ne pas les refaire

### 3.1 `REVOKE ... FROM PUBLIC` ne suffit JAMAIS sur Supabase

Supabase pose un `GRANT EXECUTE` par défaut sur le rôle `authenticated`.
`REVOKE FROM PUBLIC` ne le retire pas. Une fonction `SECURITY DEFINER` de
trigger s'est donc retrouvée exposée sur `/rest/v1/rpc/` (advisor
`authenticated_security_definer_function_executable`, corrigé en 094b).

**Toujours écrire les trois lignes :**
```sql
REVOKE ALL ON FUNCTION public.ma_fonction() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ma_fonction() FROM anon;
REVOKE EXECUTE ON FUNCTION public.ma_fonction() FROM authenticated;
```

### 3.2 Toujours passer les advisors APRÈS application

```
get_advisors(type: 'security')     → nouvelle fonction exposée ? RLS manquante ?
get_advisors(type: 'performance')  → FK sans index ?
```
Les deux régressions de cette session (sécurité + 4 FK non indexées) n'ont été
trouvées que comme ça. `validate:migrations` et `check:rls` ne les voient pas.

### 3.3 Indexer les FK des nouvelles tables

`created_by`, `actor_id`, `org_id` sont cibles de `CASCADE` / `SET NULL`
déclenchés par `delete_organization` et la suppression de compte. Sans index,
chacune de ces opérations impose un scan séquentiel complet.

Ils apparaîtront ensuite comme `unused_index` : **c'est attendu** sur des tables
vides, et l'arbitrage a déjà été tranché par la mig. 044.

### 3.4 Expressions d'index : `IMMUTABLE` obligatoire

`created_at::date` est **refusé** : `timestamptz → date` dépend du `TimeZone` de
session. Écrire `(created_at AT TIME ZONE 'UTC')::date`.

### 3.5 plpgsql : `FOREACH ... IN ARRAY (SELECT …)` est invalide

Calculer le tableau dans une variable `DECLARE`d avant la boucle.

---

## 4. Conventions du projet à respecter

- **i18n : l'espace entreprise est PROPRE.** `npm run i18n:scan` ne signale
  plus aucun fichier `src/components/organization/`. **Ne pas régresser.**
  Toute chaîne visible passe par `useT('org')` + les DEUX catalogues
  (`src/locales/{fr,en}/org.json`). `npm run i18n:check` doit rester à 0.
  - Le catalogue FR exige les formes plurielles `_one` / `_many` / `_other`.
  - ⚠️ `src/locales/fr/org.json` est la **source de vérité du typage** : une clé
    absente est une erreur de compilation, pas une chaîne brute en prod.
- **Couleurs :** tokens `rgb(var(--color-*))`. Jamais `bg-white dark:bg-slate-900`.
- **Typo mobile :** échelle fermée `text-caption|label|body|headline|title|display`.
  `src/design-system.guard.test.ts` fait échouer la suite si le stock de
  `text-[Npx]` augmente. Ne pas monter le budget — utiliser l'échelle.
- **Logique pure → `*.helpers.ts` + test.** Aucune décision dans le JSX.
- **Horloge injectable** dans les helpers de date (`now: Date = new Date()`),
  sinon les tests pourrissent avec le temps (audit archi H6).
- **Avant chaque push :** `npm run lint && npm run typecheck && npm test && npm run i18n:check`.

---

## 5. Ce qui existe et se réutilise

| Besoin | Utiliser |
|---|---|
| Deep-link | `src/components/organization/deep-link.helpers.ts` — `buildOrgLink`, `readEntityParam` (accepte `task` / `project` / `member`) |
| Charge par membre | `team-stats.helpers.ts` — `memberWorkload`, `workloadTone` |
| Stats période | `team-stats.helpers.ts` — `periodStart`, `filterByActivity`, `velocityByWeek`, `completionTrend` |
| Durées | `team-projects.helpers.ts` — `sumEstimatedTime`, `formatDuration` |
| Statuts | `team-projects.helpers.ts` — `STATUS_ORDER`, `STATUS_META`, `groupByStatus` |
| Prefs persistées par org | `useProjectsUiPrefs` (localStorage, merge avec défauts) |
| Undo | `src/lib/undo-toast.ts` — `showUndoToast` |
| Notifications | `src/modules/organizations/notifications.ts` |
| Historique | `useTeamTaskActivity(taskId)` |

---

## 6. ⚠️ Dette et incertitudes connues

### 6.1 RIEN n'a été vérifié dans un navigateur

Les 1212 tests couvrent la **logique**, pas le **rendu**. Aucun écran de cette
branche n'a été ouvert. À regarder en priorité avant merge :

1. **Kanban par statut** — son comportement dépend des triggers de la mig. 091,
   jamais exercés depuis l'app.
2. **Menu de labels en 375 px** — `DropdownMenu` avec champ de saisie interne.
3. **Badge de notifications** — dépend des triggers 095.
4. **Historique de tâche** — restera vide tant qu'aucune tâche n'aura été
   modifiée depuis l'application de la 094.

### 6.2 Un test instable, non identifié

Une exécution de la suite a montré 1 échec ; les ~8 suivantes 0. Le nom du test
n'a **pas** pu être capturé (sortie tronquée). Si un échec isolé apparaît,
vérifier qu'il est reproductible avant de conclure à une régression.

### 6.3 Le mode entreprise n'est pas manipulable au doigt

Kanban, pyramide et timeline sont pensés souris. C'est, de l'avis de la session
précédente, **le trou le plus gênant du produit** — plus que les 3 items
restants. Aucun item de la liste d'origine ne le couvre.

### 6.4 La charge d'équipe (#19) est vide sans `estimatedTime`

Elle mesure le temps estimé, pas le nombre de tâches (trois tâches d'une journée
≠ dix tâches de dix minutes). Si l'équipe ne remplit jamais ce champ, la
fonctionnalité ne sert à rien. Envisager de rendre la saisie plus incitative.

### 6.5 La timeline (#25) n'est pas un Gantt

`TeamTask` n'a **pas** de date de début. Les barres auraient un point de départ
inventé. Pour un vrai Gantt : ajouter `start_date` (migration), puis
`timelineRows` accueille des barres sans autre changement.

---

## 7. Ordre recommandé pour la suite

1. **Vérification navigateur** de tout ce qui précède (§6.1) — avant d'écrire
   une ligne de plus.
2. **Item 18** — le plus petit, périmètre net.
3. **Item 26** — s'appuie sur les helpers de stats existants.
4. **Item 29** — le plus structurant et le plus risqué, à faire en dernier et
   probablement sur sa propre branche.

Plans détaillés : `2026-08-08-entreprise-vague-5.md`.

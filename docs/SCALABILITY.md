# Scalabilité — audit mesuré, décisions et runbook

**Audit refait le 2026-08-14** contre la prod, **volumétrie et périmètre remesurés le 2026-08-24**
(§1, §2bis). Le finding principal (§2) est **corrigé et appliqué en prod le 2026-08-24**. Mesuré
contre la prod (`ykeugqfgklejcdbrmawy`, Postgres 17.6, eu-west-1) et contre le code de `main`.
Remplace l'édition du 2026-06-10, dont les volumétries étaient périmées et dont une conclusion
s'est révélée fausse.

Toutes les mesures de ce document sont **reproductibles** : les requêtes sont en
[§10 Runbook](#10-runbook--refaire-cet-audit).

## Historique des notes et des audits : archivé

Les notes /100 de ce document ont cessé (ADR 0012, [`INDICATEURS.md`](./INDICATEURS.md)). Leur journal daté, les angles morts mesurés et les récits d'incident qui fondent les règles ci-dessous sont déplacés, sans coupe, dans [`archive/SCALABILITY-journal-des-notes-2026-08-07-au-2026-11-06.md`](./archive/SCALABILITY-journal-des-notes-2026-08-07-au-2026-11-06.md). Une règle de ce document qui cite une date ou un incident s'y retrouve.

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

## 2. ✅ Le coût RLS du mode entreprise · corrigé (mig. `113`)

**Règle.** Une policy qui appelle, par ligne, une fonction qui parcourt le sous-arbre managérial coûte une évaluation par ligne scannée (projection linéaire : l'ordre de la seconde à 10 000 tâches d'équipe). Les tables d'équipe se lisent donc par des RPC indexables, `get_my_team_projects(p_org)` et `get_my_team_tasks(p_org)`, qui évaluent le sous-arbre **une fois par organisation** ; le repository lit par elles, les policies restent en place, et le helper interne `my_team_project_ids` est fermé à tout le monde (`authenticated` n'exécute que les deux RPC). Un test verrouille le chemin d'accès : `src/modules/team-projects/supabase.repository.test.ts`.

**Pourquoi cette règle.** Le défaut a été trouvé sur quatre migrations, toujours le même motif : `tasks` (mig. `085`), `team_projects` et `team_tasks` (mig. `113`), `team_task_dependencies` (mig. `117`), `events` (mig. `128`). Le diagnostic, les plans mesurés sous le rôle `authenticated` et les projections sont dans [`archive/SCALABILITY-recits-rls-et-sondage-2026-08-14-au-2026-09-05.md`](./archive/SCALABILITY-recits-rls-et-sondage-2026-08-14-au-2026-09-05.md) § 2.

### 2bis. `team_task_dependencies` · refermé (mig. `117`)

Même motif, même correctif : la table déléguait son périmètre à `team_tasks`, donc héritait de son coût, deux fois à l'écriture. Récit dans l'archive citée en § 2.

### 2ter. `events` · refermé (mig. `128`)

Troisième occurrence du motif. Un garde-fou de migration le refuse désormais : `scripts/migration-guards.test.mjs`. Récit dans l'archive citée en § 2.

## 3. ✅ Le sondage périodique · fermé

**Règle.** Aucun `refetchInterval` permanent. Les sondages qui subsistent sont **conditionnels** (`live`, montés par `/entreprise` seulement) ou un **filet de sécurité à 5 min** sur `useTasks`, actif seulement si une collaboration est en cours. Les changements arrivent par Realtime (`useOrgJoinRequests`, `usePendingSharedTasks`). Le décompte se fait **nominativement** (qui monte chaque déclaration), jamais par un total : « 9 → 6 » cachait trois sondages permanents.

**Pièges qui fondent la règle.** `isDemo ? false : 20_000` n'est pas une garde : elle retire le sondage du seul environnement qui ne coûte rien et le laisse en production. Éteindre le rechargement n'éteint pas la lecture : `staleTime` et `refetchOnWindowFocus` sont par observateur. Le tableau nominatif, les contre-mesures indépendantes, le compte de 32 requêtes à l'ouverture du tableau de bord et les récits du 2026-08-25, du 2026-08-27 et du 2026-09-05 (C-05) sont dans [`archive/SCALABILITY-recits-rls-et-sondage-2026-08-14-au-2026-09-05.md`](./archive/SCALABILITY-recits-rls-et-sondage-2026-08-14-au-2026-09-05.md) § 3.

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
| **Plan Postgres** | Free — **bloquant A-9** (pas de PITR, restauration jamais testée) | Passer en Pro, cf. `faille.md` (hors dépôt) |
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
`faille.md` (hors dépôt). Le passage au plan payant n'est donc pas une décision de
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

⚠️ Ce que cette mesure ne dit toujours pas : rien sur `tasks` à plusieurs millions de lignes. Elle
porte sur le prédicat d'entreprise, à froid comme à chaud sur un runner partagé — les millisecondes
absolues n'ont donc pas de valeur, seuls les rapports en ont.

> ✅ **« Rien sur la concurrence (elle est mono-session) », levé le 2026-09-08** : c'était la
> dernière phrase de ce paragraphe et l'item C-16. Le §9quater ci-dessous mesure 1 à 16 sessions
> parallèles, trouve le plateau, et tranche C-15. Le rapport entre les deux chemins, mesuré ici à
> 354× en mono-session, monte à **×532** sous concurrence.

---

### 9quater. Mesuré EN CONCURRENCE le 2026-09-08 — la mesure cesse d'être mono-session (C-16)

Le §9ter se terminait sur ce qu'il ne disait pas : « rien sur la concurrence (elle est
mono-session) ». C'est l'item **C-16**, et c'est lui qui décide de **C-15** — tant qu'on ignore si
le coût vient du volume par compte ou du nombre de lecteurs simultanés, toute décision de
pagination est un pari.

Une mesure de volume répond à « combien coûte UNE lecture ». Une mesure de concurrence répond à une
autre question, qui n'en découle pas : « à partir de combien de lecteurs simultanés la base cesse
de rendre du débit ». Aucun palier de volume supplémentaire ne pouvait y répondre.

**Le harnais** : `scripts/scalability-concurrency.mjs`, même workflow `scalability-volume`
(déclenchement manuel), même stack Supabase jetable, même organisation semée
(`scripts/scalability-seed.mjs`, source unique désormais partagée avec le harnais de volume).
N sessions Postgres distinctes, **chacune sous un membre différent**, martèlent
`get_my_team_tasks(org)` en parallèle. Organisation de 50 membres, 20 projets, 2 000 `team_tasks`
(4 000 dans la table, le harnais de volume ayant semé les siennes juste avant).
Run [34196569724](https://github.com/kelax12/COSMO1.2/actions/runs/34196569724), 4 vCPU.

#### Le chemin imposé — `get_my_team_tasks(org)`

| Sessions | Débit (req/s) | p50 (ms) | p95 (ms) | p99 (ms) | Écart entre sessions | Gain marginal | Régime |
|---|---|---|---|---|---|---|---|
| 1 | 611 | 1,59 | 1,77 | 2,04 | ×1,00 | référence | — |
| 2 | 929 | 1,91 | 2,26 | 2,96 | ×1,25 | 1,52× pour 2× idéal | dégradé |
| 4 | **1 197** | 2,57 | 5,44 | 5,99 | ×1,36 | 1,29× | dégradé |
| 8 | **1 255** | 5,30 | 12,04 | 19,20 | ×1,77 | **1,05×** | **saturé** |
| 16 | **1 233** | 9,63 | 24,24 | 34,92 | **×2,74** | **0,98×** | **saturé** |

#### Le TÉMOIN — le chemin direct que la mig. 113 interdit

| Sessions | Débit (req/s) | p50 (ms) | p95 (ms) | Gain marginal | Régime |
|---|---|---|---|---|---|
| 1 | 1,37 | 737 | 761 | référence | — |
| 2 | 2,49 | 748 | 919 | 1,82× pour 2× idéal | dégradé |
| 4 | 2,99 | 1 297 | 1 520 | 1,20× | dégradé |
| 8 | 3,67 | 2 148 | 2 514 | 1,23× | dégradé |
| 16 | **3,16** | **5 122** | 5 514 | **0,86×** | **saturé** |

**1. Le plateau existe, et il se situe au NOMBRE DE CŒURS.** Le débit du chemin imposé monte
jusqu'à ~1 250 req/s puis ne bouge plus : 1 255 à 8 sessions, 1 233 à 16, soit un gain marginal de
0,98× là où le doublement des sessions en promet 2. Passé ce point, chaque session ajoutée
n'achète plus de débit, elle achète de l'attente — la latence médiane fait ×6 (1,59 → 9,63 ms) et
la p99 ×17 (2,04 → 34,92 ms) pour un débit **identique**. C'est la définition de la mise en file.

**2. Le plafond est CPU, donc il s'écrit `cœurs / coût par requête`.** 4 vCPU pour une requête à
1,59 ms donnent un plafond théorique de ~2 500 req/s ; on en mesure 1 233, soit une efficacité de
49 % au plateau. La conséquence pratique est la seule qui compte pour C-15 : **paginer ne gagne du
débit qu'en proportion du CPU retiré par requête.** Ni le nombre de lignes rendues, ni le nombre de
sessions ne déplacent ce plafond — seul le coût unitaire le fait.

**3. Le témoin sature bien plus tôt, et l'écart entre les deux chemins EXPLOSE sous charge.** Le
chemin direct plafonne dès 4 sessions, à **3 req/s**, et à 16 sessions il met **5,1 secondes** par
lecture. Le rapport entre les deux chemins passe de **354×** en mono-session (§9ter) à **×532** à
16 sessions : la concurrence ne dilue pas le défaut que la mig. 113 corrige, elle l'aggrave. Une
organisation servie par le mauvais chemin ne devient pas lente, elle devient inutilisable à quatre
utilisateurs simultanés.

> 🔴 **Ce qu'une moyenne aurait caché, et pourquoi ce harnais rend un chiffre PAR SESSION.** À
> 16 sessions, la médiane globale dit 9,63 ms — un chiffre rassurant. Les sessions prises une par
> une disent 4,82 ms pour la plus rapide et 13,19 ms pour la plus lente, **×2,74**, alors qu'elles
> font exactement le même travail sur la même base au même instant. C'est cet écart qui est le
> signal de la file d'attente, et il croît proprement avec la charge (×1,00 → ×1,25 → ×1,36 →
> ×1,77 → ×2,74). Un harnais qui n'aurait rendu qu'une moyenne aurait mesuré la saturation sans
> jamais pouvoir la nommer.

> ✅ **Le harnais repart avec son TÉMOIN, et le témoin est une mesure, pas une déclaration.** Le
> tableau du chemin direct n'est pas une comparaison de politesse : le harnais **sort en erreur**
> si ce chemin n'apparaît pas comme saturé au palier le plus chargé. Un harnais qui rend toujours
> « ça tient » ne mesure rien — c'est la règle du § « une garde se vérifie sur ce qu'elle REGARDE »
> de `CLAUDE.md`, appliquée avant que la garde ne serve. Le verdict lui-même est pur et testé
> (`scripts/scalability-concurrency.stats.test.mjs`, 12 cas), et il a été **vu échouer sur cinq
> sabotages** : détecteur bloqué sur « linéaire », détecteur bloqué sur « saturé », témoin qui
> accepte tout, écart entre sessions effacé, débit agrégé calculé sur la somme des sessions au lieu
> de la fenêtre du palier. Chacun rend le fichier rouge.

⚠️ **Trois choses que cette mesure ne dit pas, et qu'il ne faut pas lui faire dire :**

1. **Le genou est celui de CE runner.** « Saturé à 8 sessions » n'est pas une propriété de la
   requête : c'est `4 cœurs / 1,59 ms`. Sur une machine à 16 cœurs le plateau serait plus haut, et
   le régime de saturation identique. Ce qui se transporte est le **coût unitaire** et la **forme**
   de la courbe, jamais le nombre de sessions.
2. **La requête mesurée rend une ligne (`count(*)`), pas 400.** Sans ça, à 16 sessions, c'est le
   fil unique de Node qui aurait été chronométré, pas la base. Le travail serveur est identique —
   le prédicat est évalué ligne par ligne dans les deux cas — mais **le coût de TRANSFERT des
   lignes n'est pas couvert**. Un témoin de ce choix est intégré à la sortie : le rapport de
   latence direct/RPC au palier le plus chargé vaut **×532** ; s'il s'effondrait vers 1, ce serait
   le signe que le client est redevenu le goulot.
3. **Rien n'est mesuré contre la production**, ni sur `tasks` à plusieurs millions de lignes. Le
   nombre de vCPU du plan Free de la prod n'a pas été mesuré, donc son plateau à elle n'est **pas**
   celui de ce tableau.

#### Ce que ça décide pour C-15 — ne rien faire, avec un seuil de réouverture mesurable

**C-15 (« le tableau de bord charge le jeu de données complet ») reste fermé, et pour la première
fois sur une mesure plutôt que sur une intuition.** La question ouverte était : le coût vient-il du
volume par compte ou du nombre de sessions simultanées ? La réponse est **ni l'un ni l'autre
directement** — il vient du **CPU par requête**, et les deux autres n'agissent que par lui.

- Le plafond de concurrence est `cœurs / coût unitaire`. La lecture du tableau de bord porte sur
  **289 tâches au maximum pour un compte** (mesuré le 2026-09-02), contre 2 000 lignes d'équipe
  ici : son coût unitaire est une fraction de celui mesuré. Paginer ne rendrait que cette fraction.
- Le genou de la courbe est à **8 lecteurs simultanés soutenus** sur 4 cœurs. La prod compte
  **28 comptes et 0 actif sur 7 jours** (§1) : elle est à trois ordres de grandeur du genou, et
  aucun geste de pagination ne rapprocherait ce chiffre de quoi que ce soit.
- **Réouvrir C-15 quand l'une de ces deux bornes est franchie**, et pas avant :
  1. un compte dépasse **2 000 lignes** dans une table qui alimente le tableau de bord (l'ordre de
     grandeur mesuré ici, où le coût unitaire devient comparable) ;
  2. le nombre de sessions **simultanément actives** en production atteint le nombre de vCPU du
     plan Postgres — c'est là que le plateau commence, et il faudra alors l'avoir mesuré sur la
     prod, pas sur un runner.

Le geste qui rapporterait le plus n'est donc pas de paginer le tableau de bord : c'est de **rejouer
ce harnais après tout changement du coût unitaire d'une lecture montée sur une page protégée**.
C'est ce que le workflow permet désormais, en une commande.

---

**Ordre de traitement recommandé, révisé le 2026-08-28.** Les deux findings qui bloquaient le
cas d'usage B2B (§2 et §2bis) sont refermés, le payload (§4) et le hook mort (§5) aussi. Il reste,
par ordre décroissant de rapport valeur/effort :

1. ✅ **`useTeamOKRs` en `live` conditionnel** — **déjà fait**, vérifié le 2026-08-27 :
   `team-okrs/hooks.ts` porte `...(options?.live ? { refetchInterval: 30_000 } : {})`.
2. ✅ **Mesurer §2 EN CONCURRENCE — FAIT le 2026-09-08 (§9quater, item C-16).** Le plateau du
   chemin imposé est à ~1 250 req/s sur 4 cœurs, atteint dès 8 sessions ; le chemin direct plafonne
   à 3 req/s dès 4 sessions et met 5,1 s par lecture à 16. C'est ce qui ferme **C-15** : le coût
   n'est ni le volume par compte ni le nombre de sessions, c'est le **CPU par requête**, et les
   deux autres n'agissent que par lui. Seuils de réouverture écrits dans le §9quater.
3. ✅ **Mesurer §2 à volume réel — FAIT le 2026-09-02 (§9ter).** Aucun basculement de plan entre
   200 et 2 000 `team_tasks`, le chemin direct est linéaire en la table entière (ratio 9,0 stable,
   buffers ×10), et le rapport entre les deux chemins atteint **354×** à 2 000 lignes. La mesure
   se rejoue par le workflow `scalability-volume` (déclenchement manuel).
4. Les deux derniers sondages permanents vers le canal Realtime existant.

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

Les deux mesures qui exigent du volume ne se rejouent PAS en production : elles écrivent. Elles
tournent sur la stack jetable du runner, par le workflow `scalability-volume` (déclenchement
manuel, jamais une gate), qui joue les deux à la suite dans le même job :

```bash
gh workflow run scalability-volume.yml --ref main   -f steps=2000 -f members=50 -f sessions=1,2,4,8,16 -f iterations=30
```

`steps` pilote les paliers de VOLUME (§9ter), `sessions` les paliers de CONCURRENCE (§9quater) — le
harnais de concurrence remet toujours le palier 1, qui sert de référence à toute la lecture. ⚠️
L'étape de concurrence **peut échouer sans que la base aille mal** : elle sort en erreur si son
propre témoin ne sature pas. Ce n'est alors pas le produit qui est en cause, c'est la détection.

Côté code, les quatre points à revérifier : `TASK_LIST_COLUMNS` toujours unique source de colonnes,
`select('*')` restants dans les repos, `refetchInterval` (`grep -rn "refetchInterval:" src`), et
consommateurs de `useTasksInfinite`.

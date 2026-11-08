> ⚠️ **ARCHIVE : journal des notes de scalabilité (2026-08-07 → 2026-11-06), extrait de `docs/SCALABILITY.md` le 2026-11-08, non maintenu.**
> Chaque passage décrit l'état **à sa date**, y compris ses listes « ce qui reste » : une bonne part a été faite depuis.
> État courant : [`docs/SCALABILITY.md`](../SCALABILITY.md). Les notes /100 ont cessé (ADR 0012) : l'état de santé se lit dans [`docs/INDICATEURS.md`](../INDICATEURS.md).
> Les liens relatifs et les ancres de ce passage sont ceux de son document d'origine : certains ne résolvent plus.

## Note de scalabilité : 71 → 84 → 86 → 89 → 91 → 87 → 90 → 90 → 90 → 90 → 91 → 91 → 91 → 91 → **91 / 100** (2026-08-24 → 2026-08-25 → 2026-08-29 → 2026-09-03 → 2026-09-08 → 2026-09-16 → 2026-09-22 soir → 2026-10-01 → 2026-10-02 soir → 2026-10-15 → 2026-10-16 → 2026-10-18 → 2026-10-20 → 2026-10-22 → **2026-11-06**) · inchangée au 2026-08-27, et au 2026-09-14 (soir) où l'invariant a été REVÉRIFIÉ en production

> ### ⚪ 2026-11-06 · 0 : dix tables de plus, base à 30 Mo
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Mesures du 2026-11-06 : CI de `main` du 2026-10-26 au 2026-11-06 (75 runs, dernier `e2e` complet vert à `ba169ba1`), workflows planifiés relus run par run, production (advisors par l'API, catalogue, Edge Functions), alertes GitHub, dépôt à `c3294936` puis `d938bc6e`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-11-06 |
> |---|---|---|
> | Base | 0 | **90** tables (80 le 2026-10-22, dont sept `affiliate_*`), **30 Mo** sur les 500 Mo du plan Free (24 Mo le 2026-10-18) |
> | `scalability-volume` | 0 | vert le 2026-11-03 (`41621852096`) |
> | Advisors de performance | 0 | `unused_index` **57** contre 75 à la référence du 2026-10-26 : une amélioration, qui rend `Posture` rouge jusqu'au recalage (geste d'Axel, [`SECURITY.md`](../SECURITY.md) AM-7) |
> | `affiliation-api` | 0 | seau global sur `/session` contre la rotation d'IP (`87583e72`, `d86cbbcf`), une alerte par heure au plus (`772fbf3c`) |
>
> **91 → 91.**

> ### ⚪ 2026-10-22 · 0 : inchangée
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Mesures du 2026-10-22 : CI de `main` à `d16de29a` (run `39843255180`, cinq jobs verts ; `main` rouge du 10-20 à 22:03 au 10-22 à 14:39, 19 runs), `Visual` vert à `fb83cd60`, production (advisors par l'API, catalogue, ledger, cron, Edge Functions, sondes HTTP), dépôt à `HEAD`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-22 |
> |---|---|---|
> | Base | 0 | **28 Mo** sur 500, `traffic_hits` à 23 lignes, 80 tables, 11 tâches `pg_cron` |
> | `inactive-accounts` | 0 | job quotidien neuf ; la sélection des comptes se fait en base (mig. `226`), pas en boucle côté fonction |
>
> **91 → 91.**

> ### ⚪ 2026-10-20 · 0 : le plafond par visiteur tient de nouveau
>
> Mesures du 2026-10-20 : CI de `main` à `86ea357f` (run `39408311331` : `lint-test-build` et `e2e` rouges, trois jobs verts ; **29 runs rouges de suite** depuis `a9db6f2c`), `Visual` rouge, production (advisors par l'API, catalogue, ledger, Edge Functions, sondes HTTP), dépôt à `HEAD`. Tableau de bord : [`README.md`](README.md).
>
> | Item | Effet | Mesuré le 2026-10-20 |
> |---|---|---|
> | ✅ `traffic_hits` · croissance | 0 | `TR-1` fermé le 2026-10-19 (mig. `223`) : seul le collecteur appelle `track_hit`, avec la clé secrète, et l'IP n'est plus prise dans le corps. **3** lignes en base (de test), base à **28 Mo** sur 500 |
>
> **91 → 91.**

> ### ⚪ 2026-10-18 · 0 : une table qui peut grossir plus vite que la base
>
> Dernière passe avant l'acquisition. Mesures du 2026-10-18 : CI de `main` à `e69cb729` (run `39139204925`, cinq jobs verts) et à `15d40bea` (`lint-test-build` vert, run `39156293593`), production (advisors par l'API, catalogue, cron, Edge Functions, sondes HTTP), dépôt à `HEAD`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-18 |
> |---|---|---|
> | 🟠 `traffic_hits` · croissance | 0 | débitée **une fois**, dans `faille.md` (hors dépôt) (`TR-1`) : purge à 13 mois active, mais jusqu'à **4,3 M lignes par jour** acceptées d'un appelant anonyme, pour une base de **24 Mo** et un plafond de 500 Mo en plan Free |
> | Requêtes de `track_hit` | 0 | deux `count(*)` sur la dernière minute, servis par `idx_traffic_hits_visitor` et `idx_traffic_hits_time` |
> | `scalability-volume` | 0 | dernier run planifié (mensuel) vert le 2026-10-03 |
>
> **91 → 91.**

> ### 🟢 2026-10-16 · +1 : le chat de projet ne sonde plus en permanence
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Mesures du
> 2026-10-16 : CI de `main` à `a4878cab`, production (catalogue, advisors), dépôt à `HEAD`. Tableau de
> bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-16 |
> |---|---|---|
> | ✅ Sondage permanent du chat de projet (−1) | **+1** | plus aucun `refetchInterval` dans `team-projects/messages.hooks.ts` (`c791eb55`) ; `polling.guard` vert en CI et en local |
> | Production | 0 | **77** tables, toutes sous RLS, **205** policies, ledger **170** : inchangés depuis le 10-15 |
>
> **90 → 91.**

> ### ⚪ 2026-10-15 · 0 : le premier run de charge automatique, et un sondage permanent
>
> **Même règle** : un angle mort ne se rembourse que sur un verdict rendu en CI, un défaut que
> lorsqu'il est corrigé et vérifié. Mesures de la nuit du 14 au 15 : CI de `main` à `6847bbf3`,
> production (catalogue, advisors), dépôt à `HEAD`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-15 |
> |---|---|---|
> | ✅ AM-1 · charge jouée automatiquement (+1 sur 2 le 09-22) | **+1** | `scalability-volume.yml`, premier run **planifié** le 2026-10-03 à 09:04 UTC : **vert**. Le second point attendait exactement ce run |
> | 🔴 Sondage permanent du chat de projet | **−1** | `src/modules/team-projects/messages.hooks.ts` : `refetchInterval: 1000 * 20`, sans condition (`000eeedd`, mig. `220`, 2026-10-13). Trois requêtes par minute et par personne tant qu'une page projet est ouverte au premier plan. `polling.guard` rouge en local (deux cas), jamais en CI. La voie écrite au § 3 est Realtime (publication + `REPLICA IDENTITY FULL`), ou `refetchOnWindowFocus` seul |
> | Production | 0 | **77** tables, toutes sous RLS, **205** policies, ledger **170** |
>
> **90 → 90.**

> ### ⚪ 2026-10-02 (soir) · 0 : vérifiée inchangée
>
> **Même règle que le 2026-09-22** : un angle mort ne se rembourse que sur un verdict rendu en CI, un
> défaut que lorsqu'il est corrigé et vérifié. Mesures du soir : CI de `main` à `9ea33927` (dernier
> `e2e` complet : `f301f0bf`, run `37019682064`), production (advisors par l'API, catalogue, ledger),
> dépôt à `HEAD`.
>
> | Item | Effet | Mesuré le 2026-10-02 (soir) |
> |---|---|---|
> | AM-1 · charge jouée automatiquement | 0 | le premier run planifié de `scalability-volume.yml` tombe le **2026-10-03** (mensuel, le 3) : pas encore joué. Dernier run : dispatch manuel du 09-08 |
> | AM-2, AM-3 · `check:db-cost` | 0 | `cout-db` vert le 2026-10-02 |
> | Production | 0 | **74** tables, toutes sous RLS, **194** policies, ledger **162** entrées ; 30 comptes, 3 actifs sur 7 jours (`user_activity_days`) |
>
> **90 → 90.** Détail : [tableau de bord](../README.md).

> ### ⚪ 2026-10-01 · 0 : vérifiée inchangée
>
> **Même règle que le 2026-09-22** : un angle mort ne se rembourse que sur un verdict rendu en CI, un
> défaut que lorsqu'il est corrigé et vérifié. Mesures du jour : CI de `main` (`43fed445` à
> `7cd73d24`), production (catalogue, advisors), dépôt à `HEAD`.
>
> | Item | Effet | Mesuré le 2026-10-01 |
> |---|---|---|
> | AM-1 · charge jouée automatiquement | 0 | le premier run planifié de `scalability-volume.yml` tombe le **2026-10-03** ; dernier run, dispatch manuel du 09-08. Le second point attend ce run |
> | AM-2, AM-3 · `check:db-cost` | 0 | `cout-db` vert le 2026-10-01 |
> | Production | 0 | **76** tables, toutes sous RLS, **202** policies, ledger **161** entrées (relus le 2026-10-01) |
>
> **90 → 90.** Détail : [tableau de bord](../README.md).

> ### 🟢 2026-09-22 (soir) · +3 : remesure item par item, contre la CI réelle et la production
>
> **Règle appliquée**, déclarée au [tableau de bord](../README.md) : un angle mort payé le 2026-09-16
> n'est remboursé que si sa garde a rendu **au moins un verdict exploitable en CI** (vert, ou
> rouge sur un vrai défaut). Une garde posée mais jamais jouée, ou cassée, ne rembourse rien.
> Un défaut nommé ce soir coûte selon le barème du 09-16.
>
> | Item | Effet | Mesuré le 2026-09-22 |
> |---|---|---|
> | AM-2 · plans relus à la main | **+1** | `check:db-cost` : EXPLAIN sous RLS, rôle `authenticated`, job `cout-db` vert deux jours de suite |
> | AM-3 · aucune alerte sur la croissance | **+1** | même garde, série commitée et alerte sur la pente |
> | AM-1 · charge jamais jouée automatiquement | **+1 sur 2** | `scalability-volume.yml` porte un `cron: '11 3 3 * *'`, mais **aucun run planifié n'a encore eu lieu** (dernier run : dispatch manuel du 09-08). Le second point revient au premier run automatique vert, attendu le **2026-10-03** |
> | AM-4 · plan `free` non surveillé | **0** | inchangé |
>
> ✅ Production relue ce soir : 51 tables, 51 sous RLS, ledger à 141 entrées. ⚠️ `A-9` (aucune
> sauvegarde gérée, aucun PITR) reste le vrai plafond d'exploitation ; `db-backup` est vert tous les jours.
>
> **87 → 90.** Détail, règle et ordre de réparation : [tableau de bord](../README.md).

> ### 🟠 2026-09-16 · -4 : la note comptait ce qui était mesuré, jamais ce qui ne l'était pas
>
> **Ce n'est pas une régression.** Rien n'a cassé depuis la dernière passe. Les angles morts
> listés juste en dessous **existaient tous** pendant que cette note montait : elle était
> surévaluée parce qu'elle ne comptait que ce que les gardes regardent. C'est exactement ce qui
> s'est produit le 2026-09-14, où cinq notes ont baissé sans qu'aucun défaut ne soit récent.
>
> **Barème, déclaré pour être contestable ligne par ligne :**
>
> | Situation | Effet |
> |---|---|
> | angle mort **structurel**, de portée large, qu'aucun outil ne regarde | −2 |
> | angle mort réel mais de portée limitée, ou partiellement couvert | −1 |
> | angle mort **assumé** (arbitrage documenté), ou déjà compté dans une passe antérieure | 0 |
> | angle mort **comblé** le jour même, avec garde **et** témoin | +1 |
>
> **Le calcul pour cette note :**
>
> | Angle mort | Effet | Pourquoi |
> |---|---|---|
> | AM-1 · **la garde de charge n'est JAMAIS jouée automatiquement** | −2 | `scalability-volume.yml` n'a qu'un `workflow_dispatch` |
> | AM-2 · les invariants de coût de lecture ne sont vérifiés qu'à la main | −1 | aucun `EXPLAIN` en CI |
> | AM-3 · aucune alerte sur la CROISSANCE | −1 | le dépôt sait dire un coût, jamais sa pente |
> | AM-4 · le plan Supabase `free` n'est pas surveillé | 0 | exploitation plutôt que scalabilité |
>
> 🔴 **Une note baisse UNE FOIS, quand l'angle mort est nommé ; elle remonte quand il est
> outillé.** Sans cette règle, nommer un angle mort deviendrait punitif, et la passe du
> 2026-09-16 serait la dernière à en chercher. Un angle mort reconduit sans être comblé ne
> re-coûte rien : il est **déjà payé**.
>
> ⚠️ Un transversal (T-1 à T-10 du [tableau de bord](../README.md)) est compté dans **chaque** audit
> qu'il touche, parce que chaque note prétend quelque chose de différent. Les 36 témoins jamais
> rejoués coûtent donc à la fois aux tests et à la sécurité, et ce n'est pas un double comptage.



### 🕳️ Angles morts · ce que cet audit NE mesure PAS (2026-09-16)

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



> **Pourquoi cette section existe.** Cette note est justifiée par des points **nommés** (« ce qui
> retient à N », suivi d'une liste). Une note construite ainsi ne peut baisser que sur un défaut
> que quelqu'un a d'abord nommé : **un angle mort ne pèse rien tant qu'il reste anonyme**, et ce
> n'est pas un oubli d'auditeur, c'est une propriété de la méthode de notation.
>
> Le prototype du problème est daté : `CLAUDE.md` a pesé 150 ko et ~43 000 tokens sans qu'aucune
> note ne bouge, alors qu'il est cité **13 fois** dans [`ARCHITECTURE.md`](../ARCHITECTURE.md), dont **9**
> dans la seule colonne « Où il est écrit » du tableau des invariants, et **jamais** dans ce
> qui est mesuré. Il était le mètre,
> jamais l'objet.
>
> Ces lignes entrent donc **dans ce qui est mesuré**. La prochaine passe les traite comme les
> invariants ci-dessus : chacune est soit comblée, soit reconduite avec sa date.

| # | Angle mort · **énoncé du 2026-09-16, non réécrit** | Vérifié le 2026-09-16 | 🔎 État au 2026-09-21 |
|---|---|---|---|
| AM-1 | 🔴 **La garde de charge n'est JAMAIS jouée automatiquement.** `scalability-volume.yml` n'a qu'un déclencheur `workflow_dispatch` : elle ne tourne que si quelqu'un y pense | relevé sur les 10 workflows : `scalability-volume.yml` et `restore-drill.yml` sont les deux seuls sans `schedule` ni `push` | ✅ **OUTILLÉ le 2026-09-20** · `scalability-volume` **mensuel** ; `restore-drill` coupé en deux, `dump-check` **trimestriel et automatique** (`C-86`) — 🔴 ne prouve PAS : qu'un dump soit **restaurable** : `pg_restore --list` lit une table des matières. Le vrai rollback reste **`M-47`**, jamais parcouru · 🔎 ⚠️ **2026-09-22 : aucun run planifié encore observé** (dernier run : dispatch du 09-08) ; premier attendu le 2026-10-03 |
| AM-2 | **Les invariants de coût de lecture ne sont vérifiés qu'à la main.** Le `Seq Scan` de `tasks` est reconstaté à chaque passe, jamais surveillé entre deux | aucun workflow ne joue d'`EXPLAIN` contre la production | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:db-cost` (`C-87`) — 🔴 ne prouve PAS : le coût **facturé**, que Supabase n'expose pas |
| AM-3 | **Aucune alerte sur la CROISSANCE.** Le dépôt sait dire « combien coûte une lecture aujourd'hui », jamais « à quelle vitesse ce coût monte ». Les volumes sont recomptés ponctuellement (749 tâches, 54 abonnements) | aucune série temporelle stockée | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:db-cost` · série commitée, alerte sur la **pente** (`C-87`) — 🔴 ne prouve PAS : la charge réelle : c'est `scalability-volume`, et il mesure un runner, pas la production |
| AM-4 | **Le plan Supabase est `free`, et rien ne surveille son changement d'état** (pause pour inactivité, quotas) | `plan: "free"` relu par l'API le 2026-09-15. `uptime.yml` teste la réponse HTTP, pas les quotas | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:db-cost` · EXPLAIN **sous RLS**, rôle `authenticated`, transaction annulée (`C-87`) — 🔴 ne prouve PAS : le comportement à plusieurs millions de lignes : le plan est relu à chaud, sur le volume du jour |
| AM-5 | **Les advisors de PERFORMANCE ne sont lus par aucune garde.** `Posture` ne lit que la sécurité. Relevé du 2026-10-23 : **40** clés étrangères sans index couvrant (dont celles que parcourt la suppression d'un compte en cascade) et **35** index jamais utilisés | aucun appel à `advisors/performance` dans `scripts/` | 🟢 **FERMÉ le 2026-10-26** : mig. `227` appliquée (ledger `20261026124018`), `get_advisors` relu : plus aucun `unindexed_foreign_keys`, référence de posture recalée à 0 · historique : 🟡 **GARDE POSÉE, INDEX ÉCRITS ET PROUVÉS, NON APPLIQUÉS (2026-10-23)** · mig. `227_fk_covering_indexes.sql` : 40 index, un par FK, justifiés par famille (26 parcourues par la suppression de compte, 5 par celle d'une organisation, 9 par les cascades métier et les jointures OKR). Preuve en bloc `DO` terminé par `RAISE EXCEPTION`, rejouée sur la prod : FK sans index **40 → 0**, et le `FOR KEY SHARE` de la cascade passe de coût 5,60 (parcours complet d'un index non préfixe) à 1,27 ; annulation relue (aucun index laissé). `check:supabase-posture` lit désormais `advisors/performance` contre `performance` de la référence : `unindexed_foreign_keys`, `duplicate_index`, `auth_rls_initplan` et `multiple_permissive_policies` BLOQUENT sur une hausse, `unused_index` est imprimé seulement ; témoin dans `gardes-posture.guard.test.mjs`. **Les 35 index « inutilisés » ne sont pas retirés** : tables de quelques dizaines de lignes, le planificateur ne les choisit pas encore (trafic trop faible pour conclure). **Reste (coordinatrice)** : appliquer la 227, relire `get_advisors`, retirer l'entrée de `NON_APPLIQUEES_DELIBEREMENT`, puis `--update` de la référence (40 → 0) |


> ### 🟢 2026-09-14 (soir) · note inchangée, mais le « non remesurable ici » de ce matin était trop large
>
> L'entrée du 09-14 (matin, conservée ci-dessous) conclut que rien n'est mesurable depuis ce poste
> faute de Docker. **C'est vrai de la charge, et faux de l'invariant.** Les deux ne demandent pas le
> même outil :
>
> | Ce qu'on veut savoir | Outil | Depuis ce poste |
> |---|---|---|
> | À quel débit ça sature, et comment ça dégrade | stack locale + `scalability-concurrency.mjs` | ❌ Docker absent |
> | Le chemin de lecture est-il toujours **indexable** | `EXPLAIN (ANALYZE)` contre la prod, rôle `authenticated` simulé | ✅ **fait ce soir** |
>
> **Mesuré en production ce soir**, dans une transaction annulée, en se plaçant dans le rôle
> `authenticated` avec les claims JWT d'un compte réel portant 289 tâches (`0490e82a…`) :
>
> | Chemin | Plan | Exécution | Planification | Total |
> |---|---|---|---|---|
> | `select * from tasks` (lecture directe) | **Seq Scan**, `Rows Removed by Filter: 461` | 19,97 ms | **25,33 ms** | **45,3 ms** |
> | `select * from get_my_tasks()` (mig. 085) | Function Scan | 9,83 ms | 0,13 ms | **9,96 ms** |
>
> Les deux rendent **exactement les mêmes 289 lignes**, ce qui vaut aussi comme vérification
> d'isolation : sur les 750 tâches de la base, le rôle simulé n'en voit que les siennes, et le
> `Rows Removed by Filter: 461` est littéralement le compte de celles des autres, examinées puis
> rejetées.
>
> **Trois choses que cette mesure établit, et qu'aucune n'avait été revérifiée depuis le
> 2026-08-07 :**
>
> 1. **Le défaut de la policy `tasks_select_own_or_shared` est toujours là, intact.** Le `OR` entre
>    une égalité et un `EXISTS` rend `idx_tasks_user_id` inutilisable : Postgres balaie la table
>    ENTIÈRE. La règle « ne jamais lire `tasks` en direct pour une vue de liste » n'est donc pas une
>    précaution héritée, c'est une contrainte en vigueur, mesurée aujourd'hui.
> 2. **Le coût de la lecture directe croît avec le volume de la PLATEFORME**, pas avec celui du
>    compte : 461 des 750 lignes examinées appartiennent à d'autres. À 28 comptes ça coûte 45 ms ;
>    c'est ce rapport-là, et non le temps absolu, qui est la projection.
> 3. **Le facteur mesuré ici est 4,5×, pas 354×.** Les deux chiffres sont justes et ne parlent pas
>    de la même chose : le 354× / 532× de §9ter et §9quater porte sur les tables d'ÉQUIPE
>    (prédicat-fonction + CTE récursive par ligne) à volume élevé et sous charge ; le 4,5× d'ici
>    porte sur les tâches personnelles, à 750 lignes, une session. ❌ **Ne jamais les citer l'un pour
>    l'autre** : c'est exactement le genre de report qui a déjà fait vivre un chiffre périmé vingt
>    jours dans ce dépôt.
>
> ⚠️ **Ce que ce soir ne mesure PAS, et pourquoi la note ne bouge pas** : le chemin d'équipe reste
> invérifiable à ce volume (la base prod ne porte que **6 `team_tasks`** au total, mesuré), et la
> tenue sous charge exige toujours Docker. Une vérification d'invariant confirme qu'on n'a pas
> régressé ; elle ne vaut aucun point de plus.


> ### ⚪ 2026-09-14 · non remesurée, et la raison est nommée plutôt que tue
>
> La mesure à volume de ce document tourne contre une stack Supabase **locale**, montée par le
> runner de CI via Docker (§9ter) — c'est délibérément **jamais** contre la production. Ce poste
> ne porte pas Docker (`docker --version` : introuvable), donc `scripts/scalability-concurrency.mjs`
> n'est pas rejouable d'ici. La note reste celle du 09-08, et rien dans cette phrase ne doit se
> lire comme « rien n'a changé » — seulement « non vérifié aujourd'hui ».

> ### 2026-09-08 · +2, la mesure cesse d'être mono-session et C-15 est tranchée
>
> Le bloc du 2026-09-03 ci-dessous nommait ce qui plafonnait la note : la mesure était
> **mono-session**, et le tableau de bord chargeait le jeu de données complet sans que rien ne
> justifie d'y toucher. Le premier point est levé, le second est **décidé** — pas laissé ouvert.
> Détail en [§9quater](#9quater-mesuré-en-concurrence-le-2026-09-08--la-mesure-cesse-dêtre-mono-session-c-16).
>
> | | avant (§9ter, 09-02) | **§9quater, 09-08** |
> |---|---|---|
> | Sessions jouées | **1** | **1 → 16**, acteurs distincts, N paramétrable |
> | Plateau de débit | inconnu | **~1 250 req/s** sur 4 vCPU, atteint dès **8 sessions** |
> | Régime au-delà | inconnu | **mise en file** : latence médiane ×6, p99 ×17, débit identique |
> | Rapport entre les deux chemins | 354× (mono-session) | **×532** à 16 sessions |
> | Ce que rend le harnais | un chiffre agrégé | **par session ET agrégé**, avec l'écart entre sessions (×1,00 → ×2,74) |
> | Témoin | aucun | le chemin direct de la mig. 113 : **le harnais sort en erreur** s'il ne sature pas |
> | C-15 (pagination du tableau de bord) | « le risque reste écrit, la mesure ne le justifie pas » | **tranchée**, avec deux seuils de réouverture mesurables |
>
> **Le fait le plus utile n'est pas le plateau, c'est ce qu'il déplace.** Le coût de montée en
> charge n'est ni le volume par compte ni le nombre de sessions : c'est le **CPU par requête**, et
> les deux autres n'agissent que par lui. Une décision de pagination ne se juge donc plus au nombre
> de lignes chargées, mais au CPU qu'elle retire — ce qui, pour 289 tâches, est une fraction de
> rien. *Un plafond qui s'écrit `cœurs / coût unitaire` ne se déplace pas en rendant moins de
> lignes, il se déplace en coûtant moins cher.*
>
> 🔴 **Ce qui plafonne à 91** : rien n'est mesuré contre la PRODUCTION — le nombre de vCPU de son
> plan Free n'est pas connu, donc son plateau à elle n'est pas celui du tableau. Rien non plus sur
> `tasks` à plusieurs millions de lignes, et le coût de TRANSFERT des lignes est hors périmètre par
> construction (la requête mesurée rend `count(*)`, faute de quoi c'est Node qu'on chronomètre).
> Le plan Postgres Free reste le seul bloquant de résilience (§8).

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

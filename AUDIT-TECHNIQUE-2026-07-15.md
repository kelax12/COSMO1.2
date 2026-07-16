# Audit technique complet — COSMO 1.2

**Date** : 2026-07-15 · **Auditeur** : audit indépendant (Claude, rôle architecte senior/CTO)
**Périmètre** : monorepo frontend React + Supabase (BaaS), 62 251 LOC src (384 fichiers), 73 migrations SQL, 3 Edge Functions, CI GitHub Actions.
**Méthode** : lecture du code réel, métriques mesurées (wc, grep, configs), croisement avec `faille.md` (source de vérité sécurité) et `a-faire.md`. Aucun chiffre inventé.

---

## 1. Résumé exécutif

**Note globale : 7/10** · **Maturité : Production intermédiaire** (au-dessus de « production légère » grâce à la CI complète, RLS testée en intégration, et une hygiène sécurité documentée ; en dessous d'« enterprise » faute d'observabilité opérationnelle, de staging, de DR testé et d'un bus factor = 1).

### Principales forces
1. **Sécurité DB sérieuse et prouvée** : RLS sur toutes les tables, fonctions SECURITY DEFINER versionnées, tests d'intégration RLS en CI sur Supabase local, `faille.md` = registre d'audit avec 40+ entrées quasi toutes closes.
2. **CI réellement bloquante** : lint 0 erreur, `tsc -b`, garde statique sur les migrations, couverture avec seuils par fichier, `npm audit`, Playwright, tests RLS. Rare à ce niveau pour un projet solo.
3. **Architecture ports & adapters propre** : interface `I{Module}Repository` + double implémentation LocalStorage/Supabase sélectionnée par factory → mode démo intégral sans backend, testable, découplé.
4. **Discipline TypeScript** : strict mode, **0 `as any`** dans src (mesuré), champs canoniques documentés avec les codes de bugs historiques.
5. **Performance frontend maîtrisée** : entry 124 kB (34 kB gzip), tout lazy-loadé, chunks manuels, virtualisation au-delà de 50 items, GSAP isolé dans un chunk landing.

### Principaux risques
1. **Bus factor = 1** : un seul développeur, pas de revue croisée humaine. Le risque n°1 n'est pas dans le code.
2. **TOCTOU-4 ouvert** : écriture OKR/KR non atomique (snapshot vs write, 3 chemins entrelacés). Faible en single-user, deviendra réel avec le mode entreprise multi-écrivains.
3. **Régression god-component** : `PyramidTab.tsx` = **1 359 lignes**, en violation de la règle interne « aucun fichier > 600 LOC » actée en 2026-06. Le mode entreprise v2 a été livré sans repasser par cette discipline.
4. **Modèle « tout charger côté client »** : `fetch-all-pages` plafonné à 5 000 lignes/entité, stats et graphiques calculés dans le navigateur. Tient pour un usage perso, casse pour un compte entreprise avec historique.
5. **Ops embryonnaire** : pas de staging, pas d'alerting (webhook `OPS_ALERT_WEBHOOK_URL` non configuré), DR jamais drillé, backups = ceux de Supabase par défaut.

### Priorités de correction
1. Découper `PyramidTab.tsx` (retour à la règle < 600 LOC) — c'est du neuf, pas encore de dette d'interface.
2. Fermer TOCTOU-4 avant la Phase 2 entreprise (RPC atomique côté Postgres).
3. Configurer les 3 actions ops de `faille.md` (HIBP, webhook alerting, réconciliation ledger) — < 2 h au total.
4. Driller la restauration DB une fois (procédure écrite ≠ procédure testée).

---

## 2. Architecture globale

### Ce qui est bien conçu
- **Monolithe modulaire SPA + BaaS** : le bon choix. 12 modules (`src/modules/*`) avec structure imposée (`types / constants / repository / hooks / index`), barrel exports, règle d'import par zone documentée. Pas de microservices-cargo-cult — à cette échelle, ç'aurait été une faute.
- **Hexagonal de fait** : les repositories sont des ports ; LocalStorage et Supabase sont des adapters ; la factory (`repository.factory.ts`) fait l'injection. Les hooks React Query sont la couche application. C'est du ports & adapters pragmatique, sans le vocabulaire ni la cérémonie — exactement ce qu'il faut.
- **Le journal `kr_completions`** est un vrai pattern event-sourcing localisé : append-only, alimenté atomiquement par les deux adapters, consommé par le dashboard. Bien identifié comme critique dans la doc.
- **La suppression de l'ancien `TaskContext` global** (façade agrégeante) et l'interdiction documentée de le recréer : leçon apprise et verrouillée.

### Ce qui est acceptable
- **SOLID** : SRP respecté au niveau module, moins au niveau composant (cf. §3). DIP respecté via les interfaces repository. Pas d'OCP formel mais peu de raisons d'en avoir.
- **DDD** : pas de DDD tactique (pas d'agrégats, d'entités riches, de value objects) — les types sont anémiques et la logique vit dans hooks + repositories. **Acceptable** : le domaine (todo/habits/OKR) est CRUD à 90 %. Le seul endroit où un agrégat manquerait : OKR + key_results + kr_completions (cf. TOCTOU-4, précisément là où l'absence d'invariant transactionnel fait mal).
- **CQRS** : absent, non nécessaire. La séparation hooks lecture / hooks mutation de React Query en est une forme dégénérée suffisante.
- **Event-driven** : quasi absent (4 usages realtime seulement). OK aujourd'hui ; le mode entreprise collaboratif finira par l'exiger (voir §12).

### Ce qui pose problème
- **La logique métier fuit dans les composants**. `useTaskModal.ts` (614 LOC) et les gros composants de page mélangent orchestration UI et règles métier. Le pattern « hook-contrôleur » adopté en 2026-06 est bien, mais il n'a pas de frontière claire avec le domaine : un hook-contrôleur de 600 lignes est un god-component déguisé.
- **Double écriture de la vérité OKR** : `key_results` en table + JSONB (`updateKeyResultViaJsonb`) = deux représentations du même état, réconciliées par convention. C'est la racine de TOCTOU-4 et une source garantie de bugs de drift. À grande échelle : problème certain.

### Ce qui deviendra problématique à grande échelle
- Le contrat implicite « le client voit toutes ses données » (fetch-all plafonné 5 000). Toute la couche dérivée (stats, graphes, smart lists) suppose le dataset complet en mémoire. C'est LE point de rupture architectural — pas les serveurs, pas la DB.

---

## 3. Frontend

### Points forts (mesurés)
- 0 `as any`, strict mode, `noUnusedLocals/Parameters`.
- Routing : 11 routes, toutes lazy (`React.lazy`) + `AppErrorBoundary` + prérendu (`prerender.mjs`) pour le SEO de la landing.
- Bundle : entry 124 kB / 34 kB gzip (audité 2026-05-30), recharts/FullCalendar lazy, GSAP isolé.
- a11y : scan axe-core en E2E, focus-visible global, audit EAA documenté.
- Erreurs : ErrorBoundary + Sentry (`beforeSend` strip PII), toasts centralisés Sonner, interdiction de `toast` dans les repositories.
- Virtualisation mobile > 50 items, undo après suppression, formulaires validés zod dans les `mutationFn`.

### Anti-patterns et code smells
| Constat | Mesure | Gravité |
|---|---|---|
| `PyramidTab.tsx` | **1 359 LOC** — 2,3× la limite interne | 🔴 Élevé (régression de discipline) |
| 9 autres fichiers 600–910 LOC (`TaskTable` 910, `LandingPage` 807, `InboxMenu` 751…) | limite 600 dépassée ou frôlée | 🟠 Moyen |
| 131 `useEffect` dans src | pas anormal pour 62 k LOC, mais chaque gros composant en concentre trop → effets en cascade | 🟠 Moyen |
| 26 TODO/FIXME | non triés, non liés à `a-faire.md` | 🟡 Faible |
| Gestion d'état : React Query (serveur) + stores maison (`app-mode.store`, ui-states) + localStorage flags datés (`cosmo_adwall_habits`, `cosmo_onboarding_pending`) | 3 mécanismes de persistance UI sans convention unique | 🟡 Faible mais source de bugs de synchro futurs |

### Sources de bugs futurs
1. Le hack `setTimeout(() => navigate('/dashboard'), 0)` après `loginDemo()` : dépendance à l'ordre de commit React documentée mais fragile — React 19 / transitions concurrentes peuvent le casser. Une vraie machine à états d'auth (état `authenticating`) l'éliminerait.
2. `TaskModalMobileBody` (658) + `DesktopDetailsStep` (695) + `useTaskModal` (614) : le modal tâche pèse ~2 000 LOC répartis. Toute évolution du modèle Task touche 3 fichiers couplés.
3. Le SEO se limite au prérendu de la landing ; les pages app sont derrière auth (OK), mais aucune stratégie meta/OG par page publique future.

---

## 4. Backend

Le « backend » = Supabase (PostgREST + Auth + RLS) + 3 Edge Functions (`delete-account`, `stripe-create-checkout`, `stripe-webhook`). Il n'y a **pas de couche serveur applicative** — c'est assumé et cohérent.

### Bien
- **Autorisation = RLS**, pas le client. Whitelist `mapToDb` contre le mass-assignment (V1 corrigé, trigger `prevent_user_id_change` en défense). zod explicitement documenté comme garde UX, PAS frontière de sécurité — la lucidité de cette phrase dans CLAUDE.md vaut de l'or.
- **Mutations sensibles en RPC SECURITY DEFINER versionnées** (`accept_friend_request_v2`, `credit_premium_token_from_ad` avec cap 20/24 h…) : la logique à invariants est côté Postgres, où elle doit être.
- Secrets : `.env` gitignored, jamais de service_role côté client, fuite historique §1 investiguée et close proprement (projet supprimé, prod jamais exposée).
- `delete-account` v3 déployée (conformité RGPD).

### Problèmes
| Problème | Détail | Gravité |
|---|---|---|
| **TOCTOU-4** | update OKR/KR = read snapshot → write, 3 chemins (table `key_results`, JSONB, `kr_completions`) non transactionnels. Deux écrivains concurrents = perte silencieuse | 🔴 (dès le mode entreprise) |
| **Logique métier dans le client** | streaks d'habitudes, progression KR, smart-rules : calculés côté client. Un client modifié peut écrire des états incohérents que RLS ne bloque pas (elle vérifie la propriété, pas la cohérence) | 🟠 |
| **Logging serveur inexistant** | Sentry = erreurs client uniquement. Edge Functions : logs Supabase bruts, aucun alerting (webhook non configuré) | 🟠 |
| **Stripe non finalisé** | dormant derrière `PREMIUM_ENFORCED=false` ; `consume_premium_token` non câblé client (dette documentée). Le mur-pub est piloté par un flag localStorage — trivialement contournable (assumé tant que premium off, à recâbler AVANT réactivation) | 🟡 aujourd'hui, 🔴 le jour de l'activation |
| Rate limiting | uniquement sur la RPC crédit pub. Rien sur les mutations CRUD (PostgREST) — un client hostile peut spammer des inserts jusqu'aux quotas Supabase | 🟡 |

---

## 5. Base de données

**73 migrations numérotées + garde statique CI (`validate:migrations`) + 73 index créés + tests RLS d'intégration.** C'est au-dessus du standard des projets Supabase, où les migrations sont typiquement un tas de SQL du dashboard.

| Problème | Impact | Gravité | Solution |
|---|---|---|---|
| Double représentation KR (table + JSONB) | drift, TOCTOU-4, requêtes JSONB non indexables proprement | 🔴 | Migrer vers la table seule ; RPC `update_key_result` transactionnelle qui écrit KR + `kr_completions` dans la même transaction |
| Ledger migrations désynchronisé (D-1) | `supabase migration repair` requis ; objets présents mais historique faux → risque d'erreur humaine sur une future migration | 🟠 | Procédure déjà écrite dans `supabase/migration/README.md` — l'exécuter (1 h) |
| Agrégations côté client | stats/dashboard chargent l'historique complet (cap 5 000) puis réduisent en JS | 🟠 à l'échelle | Vues ou RPC d'agrégat (`SELECT date, count(*) GROUP BY`) — Postgres fait ça mieux que le navigateur |
| `kr_completions` cap 100/write côté client (B18) | le clamp est client-side ; un client modifié insère 100 lignes/appel en boucle | 🟡 | Dupliquer le clamp en contrainte/trigger DB |
| N+1 | risque faible : PostgREST fait des selects par table avec `in()` ; pas d'ORM générant des boucles. Le vrai coût est le **nombre d'entités chargées**, pas le nombre de requêtes | 🟡 | — |

Normalisation : correcte (relations user_id partout, `friend_requests` sender/receiver aligné mig. 012, mig. 065–073 pour l'entreprise). Pas de dénormalisation prématurée — sauf le JSONB KR, qui est une dénormalisation accidentelle.

---

## 6. Scalabilité

**Modèle de charge** : SPA statique sur CDN Vercel (scaling ~infini) + Postgres managé. Les seules ressources partagées : la DB et l'Auth Supabase.

- **Combien d'utilisateurs simultanés ?** Le profil de charge est très léger : lectures paginées + mutations unitaires, cache React Query 5 min, pas de polling. Sur Supabase Pro (500 connexions poolées, PostgREST stateless) : **~5 000–10 000 utilisateurs actifs simultanés** sans modification, la limite venant des quotas Supabase, pas de l'architecture.
- **Premier goulot** : pas la concurrence — le **volume par utilisateur**. Un utilisateur à 5 000+ tâches ou une org entreprise agrégeant les données de 50 membres explose le cap `fetch-all-pages` et le temps de calcul client des stats. Ça casse **par compte**, pas par nombre de comptes.
- **Casse en premier** : 1) dashboard/stats entreprise (agrégation client), 2) Auth Supabase rate limits sur un pic d'inscriptions (campagne acquisition 1 000 users/mois : OK ; un passage viral × 100 en 24 h : throttling), 3) Edge Function `stripe-webhook` sans queue si le volume d'événements Stripe monte (retry Stripe compense, mais aucun idempotency store visible n'a été audité ici — à vérifier avant activation).
- **Absents et OK de l'être aujourd'hui** : queue, worker async, cache serveur, load balancer (Vercel/Supabase les portent). **Absent et pas OK** : toute stratégie d'agrégation serveur.

---

## 7. Performance

État mesuré : entry 34 kB gzip, lazy total, virtualisation, images landing optimisées, cache immuable `/assets/*`, `console.*` dropés en prod.

| Optimisation | Impact | Effort | ROI |
|---|---|---|---|
| Agrégats stats en SQL (vue/RPC) au lieu du client | Élevé (payloads ÷ 50, TTI stats) | Moyen (2–3 j) | **Excellent** — c'est aussi le fix scalabilité |
| `staleTime` différencié par entité (catégories/listes quasi statiques → 30 min) | Moyen | Faible (1 h) | Bon |
| Prefetch au hover des liens de nav (React Query + lazy chunk) | Moyen (perçu) | Faible | Bon |
| Compression Brotli vérifiée + `font-display: swap` Google Fonts | Faible | Trivial | Moyen |
| Service worker / offline | Moyen | Élevé | Mauvais à ce stade — ne pas faire |

Pas de problème de temps de réponse API identifiable : PostgREST + index + RLS `auth.uid() = user_id` (indexé par PK/user_id) = requêtes simples. Le risque perf est **client-side compute**, déjà couvert ci-dessus.

---

## 8. Sécurité

Référence : `faille.md` (40+ entrées, registre exemplaire). Synthèse OWASP :

| Vecteur | État | Sévérité résiduelle |
|---|---|---|
| Broken Access Control | RLS partout + tests intégration + triggers anti-mass-assignment | **Faible** — le poste le mieux traité |
| Injection SQL | Aucun SQL dynamique client ; RPC paramétrées ; garde statique migrations | Faible |
| XSS | React (échappement par défaut), CSP `script-src 'self' + js.stripe.com`, pas de `dangerouslySetInnerHTML` signalé, `sanitize_display_name` côté DB | Faible. `style-src 'unsafe-inline'` reste ouvert (contrainte Tailwind/inline styles) — vecteur d'exfiltration CSS théorique : **Faible** |
| CSRF | JWT en header (pas de cookie de session) → non applicable au sens classique | Faible |
| SSRF | Pas de fetch serveur d'URL utilisateur (Edge Functions à périmètre fixe) | Faible |
| Secrets | `.env` gitignored, fuite historique close (§1), service_role jamais client | Faible |
| Sessions | Supabase Auth (refresh rotation gérée) ; HIBP non activé | **Moyen** — activer HaveIBeenPwned (2 min, listé dans faille.md) |
| Intégrité métier | TOCTOU-4 ouvert ; clamps côté client (B18) ; flag mur-pub localStorage | **Moyen** (devient Élevé avec entreprise/premium actifs) |
| Monitoring sécurité | Aucun alerting (webhook non posé), pas de détection d'anomalie | **Moyen** |

**Aucune faille critique ouverte.** Les 4 actions restantes de `faille.md` sont toutes non bloquantes et chiffrées (< 2 h + 1 PR TOCTOU-4). Verdict sécurité : nettement au-dessus de la moyenne des SaaS early-stage.

---

## 9. Dette technique

| Dette | Type | Gravité | Coût futur | Risque métier | Remboursement |
|---|---|---|---|---|---|
| `PyramidTab.tsx` 1 359 LOC + 9 fichiers > 600 | Code | 🟠 | Chaque évolution entreprise plus lente et plus risquée | Vélocité Phase 2/3 | Pattern hook-contrôleur déjà éprouvé — 2 j |
| KR table + JSONB (double vérité) | Structurelle | 🔴 | Bugs de drift silencieux, bloque le multi-écrivain | Données OKR corrompues chez un client entreprise | RPC transactionnelle + dépréciation du chemin JSONB — 3–5 j |
| Stripe dormant, `consume_premium_token` non câblé | Code/Sécurité | 🟡→🔴 à l'activation | Réactivation premium = mini-projet, pas un flag | Revenus retardés ou mur contournable | Suivre `docs/POST-AUDIT-GUIDE.md` AVANT de flipper le flag |
| Tests : 5 847 LOC de tests pour 62 251 LOC src (ratio ~9 %), E2E chromium/démo uniquement, zéro test tactile (#4 a-faire.md), exclusions de couverture larges | Tests | 🟠 | Refactors futurs moins sûrs, mobile = zone aveugle | Régressions mobile (déjà l'historique du projet) | Playwright touchscreen sur 3 flows critiques — 2 j |
| Pas de staging, DR non drillé, ledger D-1 | Infra | 🟠 | Un incident prod se débuggue en prod | Perte de données = perte de confiance | Drill restore 0,5 j + repair ledger 1 h |
| 26 TODO non triés | Code | 🟡 | Bruit | — | Trier vers a-faire.md ou supprimer — 1 h |

---

## 10. DevOps / Infrastructure

**Maturité : correcte pour le build, faible pour le run.**

| Domaine | État | Verdict |
|---|---|---|
| CI | 4 jobs : lint+tsc+migrations+coverage+build · npm audit (high, prod deps) · Playwright chromium · **RLS integration sur Supabase local** | ✅ Solide — le job RLS est rare et précieux |
| CD | Vercel auto-deploy sur main. Pas de staging, pas de preview env branché sur une DB de test, pas de canary | 🟠 Deploy = prod directe |
| Docker/K8s | Non applicable (Vercel + BaaS) — c'est un choix juste, pas un manque | ✅ |
| Monitoring | Sentry client only. Pas d'uptime check, pas d'alerte Edge Functions, webhook ops non configuré | 🔴 Vous apprendrez un incident par un utilisateur |
| Logs | Client dropés en prod (Sentry capte les erreurs) ; Supabase logs non exploités | 🟠 |
| Backup/DR | Backups Supabase managés ; **restauration jamais testée** (DR drill listé depuis l'audit 2026-06-07, toujours pas fait) | 🟠 Un backup non testé est une hypothèse, pas un backup |
| Observabilité | Aucune métrique produit/technique serveur (latence RPC, taux d'erreur Edge) | 🟠 |

Risques opérationnels concrets : (1) panne silencieuse de `stripe-webhook` le jour où Stripe est actif → revenus perdus sans alerte ; (2) migration ratée sur ledger désynchronisé ; (3) suppression accidentelle de données sans procédure de restore éprouvée.

---

## 11. Qualité logicielle — **Score : B**

- **Lisibilité / maintenabilité : A−.** Conventions imposées et outillées (0 erreur lint/tsc en CI), structure modulaire uniforme, documentation interne (CLAUDE.md + 9 docs ciblées) exceptionnelle pour un projet solo. Pénalisé par les 10 fichiers > 600 LOC.
- **Tests unitaires : C+.** 79 fichiers, seuils par fichier bloquants en CI (bien), mais ratio 9 % et exclusions larges (ui/, showcase, tutorials — défendable ; mais aussi tous les `constants.ts` et barrels, ce qui gonfle le chiffre affiché).
- **Tests d'intégration : B+.** Les tests RLS sur Supabase local sont le point fort — ils testent la vraie frontière de sécurité.
- **E2E : C.** 8 specs, chromium uniquement, **mode démo uniquement** (le mode prod/Supabase n'est jamais parcouru en E2E), zéro couverture tactile alors que le mobile est le terrain historique des régressions du projet.
- **Le score global B** reflète : excellente hygiène statique, bonne intégration, couverture comportementale réelle moyenne.

---

## 12. Roadmap de correction

### Urgence immédiate (0–7 jours)
1. Réconciliation ledger migrations (`supabase migration repair`, procédure écrite) — 1 h.
2. Activer HaveIBeenPwned + poser `OPS_ALERT_WEBHOOK_URL` — 10 min.
3. Uptime check externe (UptimeRobot/BetterStack gratuit) sur l'app + un ping Edge Function — 1 h.
4. Drill de restauration DB sur un projet Supabase jetable — 0,5 j.

### Court terme (1 mois)
5. Découper `PyramidTab.tsx` + repasser les 9 fichiers > 600 LOC au pattern hook-contrôleur — 3–4 j.
6. RPC transactionnelle `update_key_result` (ferme TOCTOU-4) + clamp B18 en trigger DB — 3–5 j.
7. 3 E2E tactiles Playwright (`page.touchscreen`) : swipe TaskCard, bottom-sheet, long-press — 2 j.
8. Trier les 26 TODO ; lier ou tuer.

### Moyen terme (3 mois)
9. Agrégats stats/dashboard en SQL (vues ou RPC) — supprime le plafond client et divise les payloads — 1 sem.
10. Environnement staging : branche Supabase (preview branches) + Vercel preview reliée — 2–3 j.
11. Dépréciation du chemin JSONB des KR (une seule vérité : la table) — 1 sem, migration incluse.
12. E2E d'un parcours prod (Supabase de test) en plus du parcours démo.

### Long terme (6–12 mois)
13. Finalisation Stripe + câblage `consume_premium_token` + tests webhook idempotents — **prérequis absolu** à `PREMIUM_ENFORCED=true`.
14. Realtime/event-driven pour la collaboration entreprise (aujourd'hui 4 usages ; le multi-écrivain l'exigera, et il exige d'abord le point 6).
15. Observabilité serveur : métriques RPC/Edge, dashboard d'exploitation, budget d'erreurs.
16. Si l'entreprise décolle : pagination serveur réelle (curseurs) en remplacement de fetch-all, module par module.

---

## 13. Tableau final des risques

| Problème | Gravité | Impact métier | Effort | Priorité |
|---|---|---|---|---|
| Bus factor = 1, zéro revue humaine | Élevée | Continuité du produit | Structurel | P0 (conscience, pas ticket) |
| Aucun alerting/uptime — incidents découverts par les users | Élevée | Confiance, churn | 2 h | **P0** |
| TOCTOU-4 + double vérité KR | Élevée (avec entreprise) | Corruption données OKR clients | 1 sem | **P1** |
| DR non drillé, ledger désynchronisé | Moyenne | Perte de données lors d'un incident | 1 j | P1 |
| Agrégation client plafonnée 5 000 | Moyenne → Élevée à l'échelle | Comptes entreprise inutilisables | 1 sem | P1 |
| PyramidTab 1 359 LOC + fichiers > 600 | Moyenne | Vélocité et régressions Phase 2/3 | 4 j | P2 |
| E2E : démo only, zéro tactile | Moyenne | Régressions mobile récurrentes | 2 j | P2 |
| Stripe dormant non câblé | Faible (dormant) | Bloque la monétisation | 1–2 sem | P2 (avant activation) |
| Pas de staging | Moyenne | Deploy = test en prod | 3 j | P3 |
| CSP `style-src unsafe-inline`, rate limiting CRUD absent | Faible | Marginal | variable | P3 |

---

## 14. Avis d'architecte

### 5 plus grandes forces
1. Le **registre `faille.md`** : une culture d'audit tracée, datée, avec commits — je l'ai rarement vue chez des équipes de 10.
2. **RLS testée en CI** sur base locale : la frontière de sécurité est la seule chose testée en intégration, et c'est le bon choix.
3. Le **double mode démo/prod** par ports & adapters : démo vendeuse sans backend, architecture testable, zéro couplage Supabase dans l'UI.
4. **Hygiène statique irréprochable** : 0 `as any`, 0 erreur lint/tsc tolérée, conventions écrites et outillées.
5. **Sobriété des choix** : pas de microservices, pas de Redux, pas de K8s, pas d'over-engineering. Chaque techno de la stack a une raison d'être.

### 5 plus grandes faiblesses
1. Bus factor = 1 — tout le reste est secondaire devant ça.
2. Exploitation aveugle : aucun signal serveur, aucun alerting, DR théorique.
3. Double vérité KR (table + JSONB) et écritures non atomiques — bombe à retardement du mode entreprise.
4. Modèle « dataset complet côté client » — plafond de verre structurel.
5. Couverture comportementale (E2E prod, tactile) très en retrait de la qualité statique — le projet teste ce qui casse rarement et pas ce qui a historiquement cassé (le mobile).

### 3 décisions techniques que je conserverais
1. Supabase + RLS comme backend et frontière d'autorisation unique.
2. Le pattern repository/factory à double adapter (démo/prod).
3. La CI bloquante multi-jobs, y compris la validation statique des migrations.

### 3 décisions que je changerais immédiatement
1. **Le stockage JSONB des key results** → table unique + RPC transactionnelle.
2. **Les agrégations dashboard/stats côté client** → SQL.
3. **Le flag localStorage comme mécanisme du mur-pub** → décision serveur (RPC), avant toute réactivation premium.

### Capacité de montée en charge
- **×10 utilisateurs** (≈ quelques milliers) : **tient tel quel.** Rien à faire hors les P0 ops.
- **×100** (≈ dizaines de milliers) : **tient sur le plan infra** (CDN + Supabase Pro), **à condition** d'avoir fait : agrégats SQL, alerting, staging. Le coût Supabase devient le sujet, pas la technique.
- **×1000** (≈ centaines de milliers) : l'architecture SPA+BaaS reste viable (des SaaS bien plus gros tournent sur Supabase), mais exige : pagination serveur par curseurs partout, read models agrégés, queue pour les webhooks/emails, éventuellement un backend applicatif mince devant Postgres pour les invariants métier. C'est une évolution, pas une réécriture — **et c'est le meilleur compliment qu'on puisse faire à cette base de code.**

### Coûts d'exploitation (estimation)
Aujourd'hui : ~0–25 $/mois (Vercel hobby/pro + Supabase free/pro + Sentry free). À ×100 : 100–300 $/mois dominés par Supabase Pro + dépassements. Aucun coût caché structurel — pas de compute serveur propre, pas d'egress lourd (payloads JSON petits). Le modèle de coût est linéaire et sain.

---

*Audit basé sur l'état du dépôt au commit `975fc06` (2026-07-15). Chiffres mesurés le jour de l'audit ; les métriques bundle citent l'audit perf du 2026-05-30 (`audit-perf.md`).*

<!-- note-audit: non-note -->
> **Note d'audit** — **NON NOTÉ** au 2026-10-23 : audit ouvert ce jour, aucune garde n'existe encore sur ce domaine. Une note ne se pose qu'après la première mesure en CI, jamais avant.

# Observabilité de la production

> **Vivant.** Créé le 2026-10-23. Répond à une seule question : **quand la production se trompe,
> qui le sait, et en combien de temps ?** Le reste du dépôt sait très bien dire si le CODE est
> juste (tests, gardes, CI) ; ce document porte ce qui se passe une fois le code déployé.

## Pourquoi un audit à part

**Arbitrage du 2026-10-23.** Les signaux de production étaient éparpillés dans quatre documents
sans qu'aucun ne les porte : `uptime.yml` dans [`DEPLOYMENT.md`](./DEPLOYMENT.md), Sentry cité dans
`CLAUDE.md` sans aucune garde, la détection d'une violation dans
[`RGPD-VIOLATION.md`](./RGPD-VIOLATION.md) AM-2, les journaux Supabase dans aucun. Une surface que
quatre documents effleurent et qu'aucun ne mesure est exactement la définition d'un angle mort.
Les ajouter à un audit existant aurait noyé la question sous un autre sujet.

## Ce qui a été lu le 2026-10-23, et comment

| Source | Lu par | Résultat |
|---|---|---|
| Sentry (`VITE_SENTRY_DSN`) | **rien** : aucun outil, aucune garde, aucun digest | ❌ inconnu |
| Erreurs d'exécution Vercel (`api/`) | API Vercel refusée (403) depuis l'agent ; CLI non connecté | ❌ inconnu |
| Journaux Supabase, 24 h | API Management (`query_logs`), à la main | ✅ **0 réponse 5xx** à la passerelle. ~230 `Warp server error: Thread killed by timeout manager` côté PostgREST, corrélés à l'activité, sans réponse d'erreur au client. 5 appels à `stripe-webhook` **sans signature**, tous refusés. **4 réponses 409** sur `/rest/v1/events`, non expliquées. 10 × 403 `missing sub claim` sur `/auth/v1/user` (jeton anonyme présenté à `getUser`) |
| Disponibilité | `uptime.yml` (C-104) | ✅ vert |

## 🕳️ Angles morts · ce que ce document NE mesure PAS (2026-10-23)

| # | Angle mort | Vérifié le 2026-10-23 | 🔎 État au 2026-10-23 |
|---|---|---|---|
| AM-1 | 🔴 **Les erreurs Sentry ne sont lues par personne.** Le SDK remonte, le tableau de bord existe, rien ne le relit : une régression vue par cent utilisateurs ne fait échouer aucun job et n'arrive dans aucun digest | `grep -ril sentry .github/workflows` : seul `ci.yml` (build) | 🟡 **OUTILLÉ, NON MESURÉ** au 2026-10-23 · `npm run check:prod-errors` (job planifié `Erreurs de prod`, relié à `ci-alert.yml`) lit les issues nouvelles ou en régression sur 24 h, plafond **0**, échec fermé sans jeton. 🔴 `SENTRY_AUTH_TOKEN` n'est pas posé (`gh secret list`) : le job est ROUGE tant qu'il manque, et ne se ferme qu'au premier run vert. Témoin : `check-prod-errors.guard.test.mjs`, 9 sabotages vus rouges · ✅ **MESURÉ le 2026-10-26** (runs `40321521546` et `40322248378`) : `SENTRY_AUTH_TOKEN` posé par Axel, la lecture fonctionne et elle a trouvé dès son premier passage un défaut que personne ne voyait : **COSMO-40**, « pagination truncated: kr_completions » (1 utilisateur), l'historique des résultats clés d'un compte est tronqué à l'affichage. Le job est rouge pour cette raison, ce qui est son rôle |
| AM-2 | **Les erreurs d'exécution des fonctions Vercel (`api/collect.ts`) ne sont lues par rien.** Le collecteur d'audience peut échouer en silence : l'audience tombe à zéro sans alerte | aucun appel à l'API Vercel dans `scripts/` | 🟡 **OUTILLÉ, NON MESURÉ** au 2026-10-23 · même job : requêtes de production en `error`/`fatal` OU en 5xx, plafond **0** (`collect.ts` répond 204 même quand son écriture échoue : le journal est compté, pas seulement le statut). Point d'accès de la CLI officielle (`vercel logs`), jamais appelé avec `VERCEL_TOKEN` depuis le dépôt : le premier run planifié dit si le jeton y a droit · ✅ **MESURÉ le 2026-10-26** : le premier run a rendu 403 (le `VERCEL_TOKEN` du 10-09 n'avait pas le droit de lire les journaux) ; jeton remplacé par Axel avec la portée de l'équipe, la lecture passe (run `40322248378`) |
| AM-3 | **Les journaux Supabase ne sont lus qu'à la main**, le jour où quelqu'un y pense. Un pic de 5xx, de 409 ou de refus d'authentification ne remonte nulle part | relevé manuel ci-dessus | 🟡 **OUTILLÉ** au 2026-10-23 · même job : `edge_logs` ET `function_edge_logs` (la première ne porte AUCUNE requête `/functions/v1/*`), six familles (5xx, sondes uptime, sondes `edge-smoke`, refus d'auth, webhook Stripe non signé, 4xx métier) et couples chemin/statut, contre `scripts/prod-errors.reference.json` posée sur trois fenêtres de 24 h. Les « 5 appels sans signature » du relevé ci-dessus étaient les sondes de `check:edge-smoke`. Fermé au premier run planifié vert · ✅ **MESURÉ le 2026-10-26** : 3 112 requêtes lues sur 24 h, familles dans leur plafond ; un seul couple nouveau, **2 × 401 sur `/rest/v1/rpc/get_my_tasks`** (session expirée probable, NON vérifié), à expliquer ou à porter à la référence |
| AM-4 | **Les 4 réponses 409 sur `events` ne sont pas expliquées.** Une collision de clé à l'écriture d'un événement est soit un rejeu client (double envoi), soit une restauration à identifiant forcé (R-08) | `query_logs` | 🟢 **DIAGNOSTIQUÉ ET CORRIGÉ 2026-10-23.** Les 4 réponses sont des **23503 `events_task_id_fkey`** (`postgres_logs`), pas des 23505 : `POST /rest/v1/events` d'un seul utilisateur, 16:59:57 et 17:01:30 le 2026-10-22, **sans `id` dans le corps** (`columns=` ne liste pas `id`), donc ni restauration R-08 ni upsert. Chaque geste est parti **deux fois à 1,3 s** : le `retry: 1` global des mutations rejouait un refus nommé et déterministe. Cause amont, bénigne : un `task_id` désignant une tâche supprimée entre-temps (cache de 5 min, suppression faite ailleurs). Correctif : `shouldRetryMutation` (`src/lib/query-retry.ts`, testé) ne rejoue ni un refus nommé ni un délai dépassé. Reste : le premier échec s'affiche en toast d'erreur, c'est voulu |
| AM-5 | **La DÉTECTION d'une violation de données n'est mesurée par rien** (repris de [`RGPD-VIOLATION.md`](./RGPD-VIOLATION.md) AM-2, qui en garde l'énoncé). Le délai de 72 h court depuis la détection ; `BK-1` a été trouvée par un audit, six semaines après | aucune alerte sur un export massif, un pic d'échecs de connexion ou une alerte de secret scanning | 🟠 **OUVERT** · session dédiée |

> ❌ **Ne jamais noter ce document avant la première mesure en CI.** `non-note` est la réponse
> honnête tant qu'aucune de ces lignes n'est outillée.

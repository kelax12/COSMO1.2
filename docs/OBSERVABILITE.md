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
| AM-1 | 🔴 **Les erreurs Sentry ne sont lues par personne.** Le SDK remonte, le tableau de bord existe, rien ne le relit : une régression vue par cent utilisateurs ne fait échouer aucun job et n'arrive dans aucun digest | `grep -ril sentry .github/workflows` : seul `ci.yml` (build) | 🟠 **OUVERT** · session dédiée : digest quotidien par l'API Sentry, échec fermé sans jeton |
| AM-2 | **Les erreurs d'exécution des fonctions Vercel (`api/collect.ts`) ne sont lues par rien.** Le collecteur d'audience peut échouer en silence : l'audience tombe à zéro sans alerte | aucun appel à l'API Vercel dans `scripts/` | 🟠 **OUVERT** · même session |
| AM-3 | **Les journaux Supabase ne sont lus qu'à la main**, le jour où quelqu'un y pense. Un pic de 5xx, de 409 ou de refus d'authentification ne remonte nulle part | relevé manuel ci-dessus | 🟠 **OUVERT** · même session : agrégat 24 h des 5xx, 4xx métier et refus, comparé à une référence d'écart |
| AM-4 | **Les 4 réponses 409 sur `events` ne sont pas expliquées.** Une collision de clé à l'écriture d'un événement est soit un rejeu client (double envoi), soit une restauration à identifiant forcé (R-08) | `query_logs` | 🟠 **OUVERT** · session dédiée : diagnostic, correctif s'il y a lieu |
| AM-5 | **La DÉTECTION d'une violation de données n'est mesurée par rien** (repris de [`RGPD-VIOLATION.md`](./RGPD-VIOLATION.md) AM-2, qui en garde l'énoncé). Le délai de 72 h court depuis la détection ; `BK-1` a été trouvée par un audit, six semaines après | aucune alerte sur un export massif, un pic d'échecs de connexion ou une alerte de secret scanning | 🟡 **OUTILLÉ le 2026-10-23** · `detection-violation.yml` quotidien, relié à `ci-alert.yml` : secret scanning, code scanning, contenu des artefacts, et `edge_logs` sur 24 h (échecs d'auth, par IP, réinitialisations, lignes lues par compte, lignes rendues à `anon`) contre plancher et référence d'écart ; journal de détection chiffré. Détail et limites : [`RGPD-VIOLATION.md`](./RGPD-VIOLATION.md) AM-2. Reste : le secret `SECURITY_ALERTS_TOKEN` à poser (Axel), sans quoi le run est rouge |

> ❌ **Ne jamais noter ce document avant la première mesure en CI.** `non-note` est la réponse
> honnête tant qu'aucune de ces lignes n'est outillée.

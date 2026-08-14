# Sécurité — findings ouverts & priorités — COSMO 1.2

**Source de vérité sécurité du projet.** Ce fichier ne contient que ce qui est **encore ouvert**
et les **règles durables** tirées des audits.

- Historique complet (preuve des corrections, audits datés 2026-04 → 2026-08, anciens ordres de
  priorité) : [`docs/archive/faille-historique.md`](./docs/archive/faille-historique.md) — **archive, non maintenue**.
- Procédures et patterns : [`docs/SECURITY.md`](./docs/SECURITY.md).
- Dernière vérification de ce fichier contre le code : **2026-08-14**.

Légende : 🔴 bloquant · 🟠 important · 🟡 à planifier · ✅ corrigé

---

## État global

**Aucun finding High ou Critical exploitable** (dernière passe complète : 2026-08-08, migrations
`084` / `087` / `088` appliquées en prod, `stripe-webhook` redéployée v13). Risque global : **faible**.

Un seul **bloquant** subsiste, et c'est un point de **résilience**, pas une faille : le plan
Supabase `free`. Tout le reste est du réglage de console Supabase.

---

## 🔴 Ouvert — bloquant

### A-9 — Plan Supabase `free` : pas de PITR, restauration jamais testée
Rétention de backup minimale, aucun Point-In-Time Recovery, et le drill de restauration n'a
jamais été exécuté. **RPO réel jusqu'à 24 h, RTO inconnu.**

**Action** (compte, non scriptable) : passer en plan Pro → activer PITR → exécuter le drill de
restauration décrit dans [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) §7. Effort ≈ 1 h.

---

## 🟠 Ouvert — réglages de console Supabase

Aucun ne bloque un déploiement ; tous sont des clics dans le Dashboard.

| # | Action | Où | Effort |
|---|---|---|---|
| A-10 | **Activer « Leaked password protection »** (HaveIBeenPwned) + minimum 12 caractères. La garde client existe, la garde serveur non. | Authentication → Policies | 2 min |
| — | **MFA (TOTP) sur le compte admin.** `/admin` n'est protégé que par l'allowlist `admin_users` + mot de passe, alors que `get_admin_stats` expose toute la volumétrie business. Meilleur rapport effort/risque du dossier. | Authentication | 5 min |
| — | **Vérifier l'allowlist de redirection OAuth** : un wildcard trop large annulerait une partie du bénéfice de PKCE. | Authentication → URL Configuration | 5 min |
| — | **Activer « Secure email change »** (confirmation sur l'ancienne ET la nouvelle adresse). | Authentication | 2 min |
| — | **Vérifier la non-réutilisation du mot de passe `DATABASE_URL` historique** + activer le secret scanning GitHub (le dépôt est **public**). | Supabase + GitHub | 15 min |

---

## 🟡 Ouvert — à planifier

- **`GHSA-qwww-vcr4-c8h2`** (`react-router` ≥ 7.12.0 < 8.3.0, CSRF en **mode RSC**).
  **Inapplicable ici** : aucun RSC dans une SPA Vite. ⚠️ **Ne pas lancer `npm audit fix`** : il
  propose 7.11.0, qui **réintroduirait** l'open redirect `GHSA-wrjc-x8rr-h8h6`. Aucune version ne
  clôt les deux familles à la fois sous React 18 → la sortie est la migration React 19 +
  `react-router` 8, en PR dédiée.
  La propriété qui rend l'open redirect inexploitable (aucune navigation alimentée par un
  paramètre d'URL) est **verrouillée par un test** : `src/lib/no-open-redirect.test.ts`.
- **CVE dev-only** (`vitest`, `eslint`, `vite`, `glob`/`minimatch`) : jamais servies au
  navigateur. `npm audit fix --force` casserait le peer `eslint-plugin-react-hooks` (vérifié en
  `--dry-run`) → mise à jour outillage dédiée, jamais dans une passe sécurité.
- **N6 — `useUser()` lit l'identité depuis `localStorage`** (`src/modules/user/hooks.ts`).
  Un utilisateur peut éditer `cosmo_user` pour changer son nom/email/avatar **dans son propre
  affichage**. Aucune élévation de privilège (la donnée serveur reste la RLS). Chemin de sortie :
  consommer `useAuth().user`.

---

## Règles durables issues des audits

Ces règles ont chacune coûté un finding. Elles s'appliquent à tout nouveau code.

- **La RLS dit ce qu'on a le DROIT de lire, jamais ce qu'on VEUT compter.** Une fonction de calcul
  métier doit filtrer explicitement (`user_id = auth.uid()`), sinon son périmètre change au gré
  des policies — c'est ainsi que `get_work_time_stats` s'est mise à agréger tout un sous-arbre
  managérial (A-1, corrigé mig. 085).
- **Une RPC `SECURITY DEFINER` n'est pas protégée par la RLS** : son périmètre ne tient qu'à sa
  propre logique. Elle doit donc être testée contre une vraie base
  (`e2e/rls/get-my-tasks.test.ts`), pas mockée, et `REVOKE` pour `anon` (A-5).
- **Une règle non vérifiée par un script n'est pas une règle** : les invariants RLS ne vivaient
  que dans la doc et avaient déjà régressé trois fois (mig. 059, 077, 082). D'où
  `npm run check:rls`, bloquant en CI (A-4).
- **`auth.uid()` doit être wrappé** — même imbriqué dans un argument de fonction
  (`get_subtree(org_id, auth.uid())`), sinon il est ré-évalué par ligne. **Les advisors Supabase
  ne voient pas ce cas** : ils ne descendent pas dans les arguments d'appel (A-2).
- **Une seule policy PERMISSIVE par rôle + action** (mig. 049) : élargir le `OR` existant, ne
  jamais en créer une seconde.
- **La RLS ne filtre pas les colonnes.** Auditer aussi `information_schema.column_privileges`
  (audit du 2026-07-26, mig. 083).
- **Toute table technique qui grossit doit avoir une purge** : `processed_stripe_events` (A-6,
  rétention 90 j) ; toute sauvegarde de données personnelles doit avoir une date de péremption
  (A-11, RGPD art. 5.1.e).
- **Frontière de sécurité = RLS + whitelist `mapToDb`.** zod est une garde UX, pas une frontière.
  `mapToDb` ne doit **jamais** émettre `user_id` ni `recurrence_parent_id`.
- **Un trigger de garde doit être `SECURITY INVOKER`** (audit 2026-07-26).

---

## Migrations

L'état des migrations n'est **pas** décrit ici — il périme trop vite. Sources de vérité :

```bash
npm run validate:migrations   # garde statique (CI)
npm run check:rls             # invariants RLS (CI)
npm run check:drift           # dérive repo ↔ prod, 2 étapes (cf. docs/DEPLOYMENT.md)
```

Repo au 2026-08-14 : **100 fichiers, dernière = `099_admin_stats_v3.sql`**. La 099 était en
attente d'application en prod à cette date — confirmer avec `check:drift` avant de conclure.

Procédure d'application, checklist de rédaction d'une migration et pattern RLS obligatoire :
[`docs/SECURITY.md`](./docs/SECURITY.md). Réconciliation du ledger :
[`supabase/migration/README.md`](./supabase/migration/README.md).

---

## Stripe

Le paiement n'est **pas finalisé**. S'il est activé, il faut les secrets `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` et l'endpoint webhook côté Stripe.
Détails : [`docs/POST-AUDIT-GUIDE.md`](./docs/POST-AUDIT-GUIDE.md).

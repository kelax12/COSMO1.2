# `api/` · fonctions Vercel

> **Quand lire** : avant de toucher `api/**` ou `tsconfig.api.json`. **Fait foi** : `api/collect.ts` et ses tests `api/__tests__/`.
> Variables serveur : [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) § 5 ; règles transversales : [`CLAUDE.md`](../CLAUDE.md).

`collect.ts` : collecteur de la mesure d'audience (mig. `222`), runtime `edge`. Reçoit les `sendBeacon` de `src/lib/traffic.ts`, appelle la RPC `track_hit`.

## Ne pas casser

- 🔴 Seul chemin d'écriture de `traffic_hits` : `track_hit` n'est exécutable que par `service_role` (mig. `223`). ❌ Jamais rendre `EXECUTE` à `anon` ou `authenticated` (ses filtres origine, taille, robots se contourneraient).
- 🔴 `SUPABASE_SECRET_KEY` : posée par l'intégration Vercel ↔ Supabase, production seule, type sensible. ❌ Jamais préfixée `VITE_`, jamais renvoyée ni journalisée ; en-tête `apikey` seulement.
- ❌ Aucun repli sur la clé publique : sans secret **503**, base qui refuse **502**. Un 204 silencieux confondrait mesure cassée et audience nulle.
- ❌ Jamais stocker l'IP ni le user-agent : ils ne servent qu'à l'empreinte du jour (sel quotidien supprimé le lendemain). L'IP vient de `x-forwarded-for`, réécrit par Vercel.
- ❌ Refuser tout ce qui n'est pas de même origine, y compris `Origin: null` (403, jamais 500).

## Compilation et tests

- `tsconfig.api.json` en **`NodeNext`** (comme le contrôle de Vercel) : import relatif avec extension **`.js`** (`../src/lib/traffic-ua.js`) ; ❌ l'alias `@/` ne résout pas ici. Sans extension : TS2835 au build Vercel, invisible en mode `bundler`.
- Tests dans `api/__tests__/` (glob `api/**/*.{test,spec}.ts` de `vitest.config.ts`) ; sabotages au catalogue de `npm run check:sabotages`.
- Une variable serveur nouvelle entre au contrat de `npm run check:env` (`scripts/check-env-contract.mjs`).

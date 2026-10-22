# `api/` · fonctions Vercel, seul code serveur du dépôt

> Créé le 2026-10-20. Chargé dès qu'un fichier de ce dossier est touché. Règles transversales :
> [`CLAUDE.md`](../CLAUDE.md) à la racine. Le pourquoi : [`faille.md`](../faille.md) § `TR-1`,
> [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) (variables serveur).

Un seul fichier aujourd'hui : `collect.ts`, le collecteur de la mesure d'audience maison
(mig. `222`), runtime `edge`, en production depuis le 2026-10-18. Il reçoit les `sendBeacon` de
`src/lib/traffic.ts` et appelle la RPC `track_hit`.

## Ne pas casser

- 🔴 **Ce collecteur est le SEUL chemin d'écriture de `traffic_hits`.** Depuis la mig. `223`,
  `track_hit` n'est exécutable que par `service_role`. ❌ Ne jamais rendre `EXECUTE` à `anon` ou
  `authenticated` : ses filtres (origine, taille, robots) se contourneraient avec la clé publique.
- 🔴 **`SUPABASE_SECRET_KEY`** : posée par l'intégration Vercel ↔ Supabase, production seulement,
  type sensible. ❌ Jamais préfixée `VITE_` (elle partirait dans le bundle), jamais renvoyée ni
  journalisée, envoyée dans l'en-tête `apikey` seulement.
- ❌ **Aucun repli sur la clé publique** : sans secret, **503** ; base qui refuse, **502**. Un 204
  silencieux rendrait une mesure cassée indiscernable d'une audience nulle.
- ❌ **Jamais stocker l'IP ni le user-agent** : ils ne servent qu'à l'empreinte du jour (sel
  quotidien supprimé le lendemain). L'IP vient de `x-forwarded-for`, réécrit par Vercel.
- ❌ Refuser tout ce qui n'est pas de même origine, y compris `Origin: null` (403, jamais 500).

## Compilation et tests

- `tsconfig.api.json` (référencé par `tsconfig.json`) : **`NodeNext`**, comme le contrôle que
  Vercel joue au build. ⚠️ Un import relatif porte donc son extension **`.js`**
  (`../src/lib/traffic-ua.js`), et **l'alias `@/` ne marche pas ici**, contrairement au reste du
  dépôt. Sans extension : TS2835 au build Vercel, invisible en mode `bundler`.
- Tests dans `api/__tests__/`, ramassés par `vitest.config.ts` (`api/**/*.{test,spec}.ts`).
  Les sabotages du collecteur sont au catalogue de `npm run check:sabotages`.
- Une variable serveur nouvelle entre au contrat de `npm run check:env`
  (`scripts/check-env-contract.mjs`).

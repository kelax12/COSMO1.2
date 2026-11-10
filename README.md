# COSMO

COSMO est une application de productivité : tâches, habitudes, agenda, objectifs (OKR) et
statistiques, en français et en anglais. Elle existe en deux mondes qui ne partagent pas leurs tables.

- **Perso** : un utilisateur, ses données, le partage de tâches entre amis gratuit.
- **Entreprise** (`/entreprise/...`) : une organisation, des équipes hiérarchiques, des permissions
  par membre, une facturation par paliers.

Le site public est <https://thecosmo.app>. Ce dépôt est public pour être lu ; voir
[Licence](#licence) et [Contribuer](#contribuer).

## Lancer en démo (sans rien configurer)

Sans variables `VITE_SUPABASE_*`, l'application tourne entièrement dans le navigateur, sur
`localStorage`. Aucun compte, aucun serveur.

```bash
npm ci
npm run dev
```

Node 22.22 ou plus est requis (`engines` de `package.json`). L'application répond sur
<http://localhost:5173> ; `npm run start` la sert sur le port 3000, celui que Playwright utilise.

## Lancer contre un Supabase local

Il faut Docker et la [CLI Supabase](https://supabase.com/docs/guides/cli). `supabase start` construit la
base depuis `supabase/migrations/` (une baseline égale à la production, puis les migrations postérieures ;
voir [`supabase/migration/CLAUDE.md`](./supabase/migration/CLAUDE.md)). Ne lancez pas `supabase db push`.

```bash
supabase start
supabase status -o env            # API_URL, ANON_KEY, DB_URL
node scripts/verifier-migrations.mjs   # le ledger local porte chaque fichier de supabase/migrations/
cp .env.example .env              # puis renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm run dev
```

C'est la même séquence que celle du job `rls-integration` de la CI
([`.github/workflows/ci-noyau.yml`](./.github/workflows/ci-noyau.yml)). `npm run test:rls` joue ensuite
les tests d'isolation RLS contre cette base.

## Tester

```bash
npm run lint           # 0 erreur attendue
npm run typecheck      # tsc -b, 0 erreur attendue
npm run test           # Vitest, une passe
npm run test:changed   # les tests liés à votre diff contre origin/main
```

La suite complète et les tests de bout en bout (Playwright, `npm run test:e2e`) sont longs : ils
tournent en CI après la poussée, pas en local. Le détail, les gardes et la checklist avant mise en
production sont dans [`docs/TESTING.md`](./docs/TESTING.md).

## Déployer

Le front est déployé par Vercel à chaque poussée sur `main`. La base (Supabase), les Edge Functions et
Stripe suivent leurs propres gestes. Le runbook de déploiement et de retour arrière est
[`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

## Où est écrit le reste

| Pour | Lire |
|---|---|
| Comprendre pourquoi le code est ainsi | [`docs/adr/`](./docs/adr/README.md), les décisions structurantes |
| Trouver un module, ses tables, ses RPC, son écran | [`docs/MODULES.md`](./docs/MODULES.md) |
| Voir la carte de toute la documentation | [`docs/README.md`](./docs/README.md) |
| Conventions et processus de contribution | [`CONTRIBUTING.md`](./CONTRIBUTING.md) |
| Signaler une faille | [`SECURITY.md`](./SECURITY.md) |
| Travailler avec un agent de code | [`CLAUDE.md`](./CLAUDE.md), écrit pour lui |

## Contribuer

Voir [`CONTRIBUTING.md`](./CONTRIBUTING.md). En bref : ouvrez d'abord une issue.

## Licence

Tous droits réservés (décision d'Axel du 2026-11-08) : voir [`LICENSE`](./LICENSE). Le code est
visible, pas réutilisable ; toute réutilisation demande une autorisation écrite.

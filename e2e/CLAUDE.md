# `e2e/` · Playwright · règles du dossier

> Méthode, comptage par project et checklist avant push : [`docs/TESTING.md`](../docs/TESTING.md)
> § Playwright. Règles transversales : [`CLAUDE.md`](../CLAUDE.md) à la racine.

- `npm run test:e2e` (+ `:ui`, `:report`). Le serveur attendu est `npm start`, **port 3000**.
- ❌ **Ne JAMAIS écrire le total en « N × 2 ».** Les projects ne jouent plus le même ensemble.
  C est exactement comme ça que le précédent (« 62 × 2 = 124 ») est devenu faux, puis a été recopié
  pendant onze jours au lieu d être remesuré.
- ✅ Le total se RECOMPTE par `npx playwright test --list`, jamais de tête.
- ⚠️ Les cas `mobile-safari` ne tournent pas dans tous les workflows : vérifier
  `.github/workflows/ci.yml` avant d affirmer qu un parcours est couvert en CI.
- ⚠️ Le project `supabase-stub` (port 3210) sert à jouer un parcours **hors mode démo**.
  `load` n y arrive jamais, à cause de Realtime : attendre un sélecteur, pas l événement.
- ❌ **Ne jamais laisser traîner une sonde jetable non suivie par git** : elle fausse tout
  recomptage local, et la dernière en date était rouge.
- 🔴 **Un parcours voit ce qu aucun test unitaire ne peut voir.** Un écran qui se referme sur son
  propre effet (`FirstRunSetup`, C-53) ne se détecte qu en le parcourant, et seulement une fois que
  le test attend que les écritures atterrissent.

# `e2e/` · Playwright · règles du dossier

> Méthode, comptage par project et checklist avant push : [`docs/TESTING.md`](../docs/TESTING.md)
> § Playwright. Règles transversales : [`CLAUDE.md`](../CLAUDE.md) à la racine.

- `npm run test:e2e` (+ `:ui`, `:report`). Le serveur attendu est `npm start`, **port 3000**.
- ❌ **Ne JAMAIS écrire le total en « N × 2 ».** Les projects ne jouent plus le même ensemble.
  C est exactement comme ça que le précédent (« 62 × 2 = 124 ») est devenu faux, puis a été recopié
  pendant onze jours au lieu d être remesuré.
- ✅ Le total se RECOMPTE par `npx playwright test --list`, jamais de tête.
- ⚠️ **Tous les projects ne tournent pas dans tous les workflows** : vérifier
  `.github/workflows/*.yml` avant d affirmer qu un parcours est couvert en CI. Relu le
  **2026-09-21** : le job `e2e` de `ci.yml` joue `chromium`, `supabase-stub`, `mobile-safari`
  (depuis `af0190bd`, 2026-09-16) et `mobile-chrome` (depuis `2b4c4304`, 09-20) ; le project
  `visual` a **son propre workflow**, `visual.yml`, et n est pas dans `ci.yml`.
  ❌ Ne pas compter les trois projects `*-warmup` comme des parcours : ce sont des préalables de
  chauffe, et ils existent parce que le coût de compilation à froid de Vite tombait entièrement
  sur le premier cas du moteur.

- 🔴 **LE JOB `e2e` EST ROUGE SUR `main`, et l est depuis le run 35532009156 (commit `53583d3f`)** :
  25 échecs sur 204 réussites, les quatre autres jobs verts. Ouvert en `C-111`.
  ⚠️ **Aucun de ces échecs n est un faux positif de harnais** : 30 cas distincts en quatre familles,
  dont des **défauts produit mesurés** (cibles tactiles à 24 × 24 px sur `/settings`, 36 px sur
  `/okr`, 39 × 39 px sur `/habits`). ❌ Ne pas lire un échec e2e local comme « la CI est rouge de
  toute façon » : c est ce réflexe qui expédiera une régression.
  ⚠️ Conséquence à retenir avant de citer un chiffre : **la couverture clavier réelle est 8 surfaces
  sur 51, pas 10** — les deux cas que `C-96` comptait comme mesurés échouent.

- 🔴 **L alerte a fonctionné, c est la LECTURE qui a manqué** : l issue `ci-red` #54 a été mise à
  jour **dix-neuf secondes** après l échec. Même scénario que `vendor-watch` en août 2026, à
  l identique. Une alerte que personne n ouvre est une archive.
- ⚠️ Le project `supabase-stub` (port 3210) sert à jouer un parcours **hors mode démo**.
  `load` n y arrive jamais, à cause de Realtime : attendre un sélecteur, pas l événement.
- ❌ **Ne jamais laisser traîner une sonde jetable non suivie par git** : elle fausse tout
  recomptage local, et la dernière en date était rouge.
- 🔴 **Un parcours voit ce qu aucun test unitaire ne peut voir.** Un écran qui se referme sur son
  propre effet (`FirstRunSetup`, C-53) ne se détecte qu en le parcourant, et seulement une fois que
  le test attend que les écritures atterrissent.

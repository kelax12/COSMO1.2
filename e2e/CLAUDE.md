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
  ⚠️ Conséquence à retenir avant de citer un chiffre : la couverture clavier réelle était tombée à
  **8 surfaces sur 51**, les deux cas que `C-96` compte comme mesurés expirant.

- 🟠 **ÉTAT AU 2026-09-22 : deux familles sur quatre traitées, le job reste ROUGE.** Ne pas lire
  ce qui précède comme périmé — le chiffre de 25 échecs date du run 35532009156 et n a pas été
  remesuré en CI depuis.
  · ✅ `touch-targets` : **19 cas sur 19 verts** sur `chromium` (3 échecs avant). Les trois défauts
    étaient réels ; `/habits` porte désormais un **écart déclaré** dans son fichier, avec son
    critère (échoue 2.5.5 AAA, tient 2.5.8 AA) — sept cellules de 44 px ne tiennent pas dans
    301,6 px, c est de l arithmétique.
  · ✅ `a11y-keyboard-audit` : **2 cas sur 4**. La couverture clavier repasse donc à **10 sur 51**,
    🔴 mais **sur `chromium` seulement** : leurs homologues WebKit n ont pas été rejoués.
  · 🔴 Restent : 2 cas clavier **non diagnostiqués** (`ShareListSheet`, `DatePicker` OKR — ils
    tournent à 1440 px, donc leur cause n est pas celle des deux autres), 7 parcours de démo
    WebKit, et 3 `reduced-motion-sheets` sur les deux moteurs mobiles.
  🔴 **RIEN N A ÉTÉ REJOUÉ SUR WEBKIT.** Les 14 échecs WebKit sont PRÉSUMÉS suivre leurs homologues
  `chromium`, et une présomption n est pas une mesure.

- 🔴 **UN TEST QUI EXPIRE NE DIT PAS CE QU IL CHERCHE**, et ce fichier vient de le payer.
  `a11y-keyboard-audit` cherchait un bouton « Actions pour … » VISIBLE à 375 px. Mesuré dans le
  navigateur le 2026-09-22 : il existe, porte le bon nom, et fait **0 × 0 px** — il vit dans
  `div.hidden md:block`, la ligne DESKTOP. Son timeout passait pour de la lenteur de harnais
  depuis des semaines, et il masquait le défaut qu il existait pour trouver : les actions d une
  tâche étaient **inatteignables au clavier sur mobile** (WCAG 2.1.1, niveau A).
  ❌ **Ne jamais classer un timeout en « lenteur » sans avoir ouvert l écran.**

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

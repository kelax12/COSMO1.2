> ⚠️ **ARCHIVE : commentaires de mesure des commandes de test, repris de CLAUDE.md, extrait de `docs/TESTING.md` le 2026-11-08, non maintenu.**
> Chaque passage décrit l'état **à sa date**, y compris ses listes « ce qui reste » : une bonne part a été faite depuis.
> État courant : [`docs/TESTING.md`](../TESTING.md). Les notes /100 ont cessé (ADR 0012) : [`docs/INDICATEURS.md`](../INDICATEURS.md).
> Les liens relatifs et les ancres de ce passage sont ceux de son document d'origine : certains ne résolvent plus.

## Vitest, couverture, RLS et Playwright · repris de `CLAUDE.md` (déplacé le 2026-09-16)

> Commentaires de la section `## Scripts` de `CLAUDE.md`, où ils étaient chargés à chaque
> session. Déplacés ici **sans une coupe**. La racine ne garde que la commande.

```bash
npm test           # Vitest (run once) — CHAQUE chiffre ci-dessous porte sa date.
                   # 🔴 2026-09-22 — LE PIEGE DU `$?` APRES UN PIPE A REJOUE,
                   #    et il a laisse partir un commit qui NE COMPILE PAS.
                   #    Forme fautive, repetee toute la session :
                   #        npx tsc -b 2>&1 | tail -3 ; echo "TSC=$?"
                   #    `$?` rend le code de sortie de `tail`, TOUJOURS 0.
                   #    Le commit a33005b9 annonce « tsc 0 » et portait deux
                   #    TS7006 dans design-system.guard.test.ts : le job CI
                   #    lint-test-build aurait ete ROUGE. Corrige apres coup.
                   #    ✅ La forme juste, et la seule :
                   #        npx tsc -b > t.log 2>&1 ; echo "EXIT=$?"
                   #    ⚠️ C'est la regle 1 de CLAUDE.md (« lire `$?` »), deja
                   #    ecrite, deja payee. Une regle connue ne protege pas
                   #    d'une COMMANDE qui la contourne sans en avoir l'air.
                   # 🔵 MESURE DU 2026-09-22 (545 s) :
                   #    243 fichiers, 2 789 cas + 1 saute, exit 0.
                   #    +3 fichiers / +30 cas depuis la veille, dont le temoin
                   #    de C-69 (rotation-state.guard.test.ts, 13 cas) et les
                   #    4 cas de la garde « poignee sans geste » (C-07).
                   #    ⚠️ Meme reserve qu au 09-21 : ARBRE SALE, cinq fichiers
                   #    d une session voisine. Ce n est pas une mesure de main.
                   # Mesure precedente : 2026-09-21, 09:44 -> 09:50 (379 s),
                   #    240 fichiers, 2 759 cas + 1 saute, exit 0.
                   #    ⚠️ MESUREE SUR UN ARBRE SALE, et ca compte : cinq fichiers d'une
                   #    session voisine etaient modifies et non commités (HabitActionsMenu,
                   #    les deux catalogues habits, demo-profile.test.ts, restore.hooks.ts,
                   #    restore-id.guard.test.ts). Ce n'est donc PAS une mesure de `main`,
                   #    et l'ecart avec les 239 / 2 720 annonces par 2b4c4304 s'explique
                   #    par la, pas par une regression. Une mesure avant/apres ne vaut que
                   #    si HEAD est identique aux deux bouts.
                   # Mesure precedente : **2 603 tests / 229 fichiers**, ZERO echec
                   # (mesure du 2026-09-15 EN CI, run 34945082906, job lint-test-build).
                   # 🔴 LE TOTAL AFFICHE EST CELUI DES FICHIERS COLLECTES, PAS DES
                   # FICHIERS EXISTANTS. Mesure du 2026-09-15 sur ce poste, avec un
                   # `--maxWorkers=4` qui ecrasait la borne de C-47 : « 225 passed
                   # (225) », **exit 1**, et QUATRE fichiers n'avaient jamais demarre :
                   #   Failed to start forks worker ... Timeout waiting for worker
                   #   AuthForm.confirmation · FirstRunSetup · OrgBillingTab.refund.parcours
                   #   · use-modal-a11y.guard  (ce dernier porte les TROIS temoins de C-53)
                   # ✅ VITEST FAIT SON TRAVAIL : il sort en **exit 1** et imprime un bloc
                   # `Unhandled Errors` (« this might cause false positive tests »). Ce qui
                   # a failli le 2026-09-15, c'est la LECTURE : la ligne de resume dit
                   # « 225 passed » et ne dit pas qu'il en manque quatre. La meme session a
                   # publie « exit 0 » dans trois documents avant de relire le `$?` qu'elle
                   # avait elle-meme imprime.
                   # ❌ NE JAMAIS conclure d'une ligne de resume. Lire `$?`, puis comparer
                   # le nombre annonce au perimetre du glob (src/** + scripts/** +
                   # eslint-rules/**), soit 229 a cette date.
                   # 🔴 LA CAUSE ETAIT UN CONSEIL DE CE FICHIER : `--maxWorkers=4`,
                   # ecrit plus bas, ecrasait le `maxWorkers: 2` que C-47 a pose exactement
                   # pour empecher ca. Corrige le 2026-09-15.
                   # Mesure precedente : 2 586 / 228, le 2026-09-14 au soir (suite complete).
                   # (mesure du 2026-09-14 au soir, machine libre, ~5 min).
                   # Mesure precedente : 2 051 / 179, le 2026-09-02.
npm run test:coverage       # + couverture v8, seuils globaux et par fichier
                            # ✅ VERTE au 2026-09-14 : 31,15 L · 30,73 S · 24,41 F · 26,31 B
                            # (2 586 tests / 228 fichiers, zero echec, exit 0).
                            # Mesures precedentes : 31,32 L le 2026-09-11 (2 470 / 221),
                            # 29,17 L le 2026-08-29.
                            # ⚠️ Les pourcentages BAISSENT legerement alors que 116 tests
                            # ont ete AJOUTES : le denominateur a bouge aussi (code neuf
                            # non couvert). Un taux de couverture ne se lit jamais seul,
                            # toujours avec le nombre de lignes qu'il rapporte.
                            # ❌ NE JAMAIS baisser un seuil pour repasser au vert.
                            # 🔴 Le cliquet du glob `supabase.repository.ts` A MORDU le
                            # 2026-09-08 : `functions` est tombe a 89,83 %, sous son seuil
                            # de 90. Il a fait son travail, et les fonctions manquantes
                            # etaient DATEES, pas dispersees : dependances de taches
                            # personnelles (mig. 132), `restoreCompletions` (R-08),
                            # `getMyOrgInbox` (mig. 129 + 142), et les deux ecritures de
                            # dependances d'equipe. Du code de septembre livre sans test
                            # de repository. 13 fonctions couvertes (126 tests), glob
                            # remonte a 95,34 % ; AUCUN seuil baisse.
                            # ⚠️ La marge la plus serree reste `functions`, mais elle n'est
                            # plus critique : 3,56 pt contre 0,32 le 2026-08-25. La relancer
                            # APRES chaque vague de features, pas quand on y pense.
                            # ⚠️ Sur cette machine le run prend ~11 min. Mesurer quand la
                            # machine est libre, ou dans un worktree isole.
                            # 🔴 NE JAMAIS PASSER `--maxWorkers` EN LIGNE DE COMMANDE.
                            # Cette ligne a conseille `--maxWorkers=4` jusqu'au 2026-09-15,
                            # et c'est un conseil ANTERIEUR au finding C-47 qui ECRASE la
                            # borne que C-47 a posee : `vitest.config.ts` fixe
                            # `maxWorkers: 2` parce que 4 jsdom concurrents saturent les
                            # 8 Go de cette machine, et qu'un worker qui ne repond plus est
                            # compte comme un echec sans avoir execute un seul cas.
                            # Le 2026-09-15, une session a suivi ce conseil : QUATRE fichiers
                            # n'ont jamais demarre (`Failed to start forks worker ... Timeout
                            # waiting for worker`), dont `use-modal-a11y.guard.test.tsx` qui
                            # porte trois TEMOINS. La suite a rendu « 225 passed (225) » et
                            # EXIT 1.
                            # ✅ Vitest a fait son travail : il SIGNALE (exit 1, et un bloc
                            # `Unhandled Errors`). C'est la lecture qui a failli, pas l'outil,
                            # et la meme session a d'abord publie « exit 0 » dans trois
                            # documents avant de relire le code de sortie qu'elle avait
                            # elle-meme imprime.
                            # ❌ Ne JAMAIS conclure d'une ligne de resume : lire `$?`.
                            # ✅ PREUVE, meme machine, meme arbre, le 2026-09-15 :
                            #   avec --maxWorkers=4 : exit 1, 225 fichiers, 4 workers morts
                            #   sans drapeau        : exit 0, 229 fichiers, 2 603 cas,
                            #                         0 unhandled error, 576,6 s
                            # Le drapeau ne rendait pas la suite plus rapide, il la rendait
                            # INCOMPLETE. Et le compte sans drapeau est exactement celui de
                            # la CI.
                            # Voir docs/TESTING.md
npm run test:rls   # Tests d'intégration RLS (stack Supabase locale), 7 fichiers verts
npm run test:e2e   # Playwright (+ :ui, :report)
                   # 236 cas / 26 specs a HEAD, 237 / 27 dans l'arbre (le project
                   # `mobile-safari-warmup` et son fichier ne sont pas suivis par git).
                   # RECOMPTE le 2026-09-15 : chromium 115, mobile-safari 105,
                   # supabase-stub 17. Les +16 viennent de C-80 : 8 pages publiques
                   # entrent dans `touch-targets.spec.ts`.
                   # 🔴 LES 105 CAS `mobile-safari` NE TOURNENT DANS AUCUN WORKFLOW a
                   # cette date. C-78 est ECRIT mais PAS COMMITE : `git show
                   # HEAD:.github/workflows/ci.yml` lance toujours
                   # `--project=chromium --project=supabase-stub`.
                   # Mesure precedente : 220 cas / 26 specs / 4 projects, RECOMPTE le 2026-09-14 par
                   # `npx playwright test --list`. Repartition : 107 chromium,
                   # 96 mobile-safari, 16 supabase-stub, 1 prealable de chauffe.
                   # Mesure precedente, le 2026-09-11 : 210 / 25 (103 / 94 / 12 / 1).
                   # ⚠️ La sonde jetable `e2e/_tmp-probe.spec.ts`, non suivie par
                   # git, a ete SUPPRIMEE le 2026-09-14 : elle faussait tout
                   # recomptage local de 2 cas, et elle etait rouge.
                   # ❌ Ne JAMAIS ecrire ce total en « N x 2 » : les projects ne
                   # jouent plus le meme ensemble. C'est exactement comme ca que le
                   # precedent (« 62 x 2 = 124 », du 2026-08-25) est devenu faux, et
                   # il a ete RECOPIE pendant onze jours au lieu d'etre remesure.
                   # Methode et detail par project : docs/TESTING.md § Playwright
```

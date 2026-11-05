> ⚠️ **ARCHIVE — items retirés d'`a-faire-code.md` le 2026-11-05, non maintenue.** Recopiés à l'identique.
> Source vivante : [`a-faire-code.md`](../../a-faire-code.md).

## Pourquoi

- `C-58` : React 19 et `react-router` 8 sont sur `main` (`package.json` : `react` ^19.3.1,
  `react-router` ^8.5.0, relu le 2026-11-05 ; PR n° 129). Il n'y a plus d'arbitrage à rendre.

### C-58 · Le blocage sécurité qui forçait React 19 est déjà levé · **P3 · XS** · trouvé par l'audit A-6

> 🟠 **Ce n'est plus un chantier, c'est un arbitrage — et DEUX affirmations de cet item sont
> devenues fausses le 2026-09-14. Corrigées ici, pas en silence.**
>
> **1. Le plafond de 323 000 EST désormais dans l'histoire du dépôt.** Commit `7134d7fe`, run CI
> `34846164939` vert (C-76). La phrase « contre `main` tel qu'il est commité, React 19 à 329,8 ko
> passerait la garde en silence » ne décrit plus rien : la garde de `main` est à 323 000, et React
> 19 y **échouerait**, comme il le doit. Le blocage n'est plus adossé à un cliquet fantôme — il est
> opposable. **Le seuil de reprise chiffré plus bas (283,5 ko) est inchangé et devient la seule
> lecture valable.**
>
> **2. Les 9 corrections de types NE SONT PAS portables sur `main`, contrairement à ce que dit le
> paragraphe « ce que différer coûte ».** Mesuré, pas déduit : les sept fichiers de la branche ont
> été appliqués sur `main` et `tsc -b` rend **72 erreurs** dans une soixantaine de fichiers. Sous
> les types **React 18**, `RefObject<T | null>` n'est pas assignable à `LegacyRef<T>` — donc chaque
> `ref={...}` qui consomme un de ces refs élargis casse. Le port a été **défait** ; `main` est
> propre (`tsc -b` sans erreur). Ces 9 lignes sont justes **sous React 19 et seulement là** : elles
> ne sont pas un acompte qu'on pourrait verser d'avance pour alléger la reprise.
>
> ⚠️ **Ce que ce deuxième point apprend au-delà de React 19** : « un correctif de types est
> mécanique, donc portable » est une intuition, pas une mesure. Élargir un type de prop est une
> rupture de contrat dans le sens des CONSOMMATEURS, et ils étaient soixante.
>
> **Ce qui reste vrai** : `feat/react-19` porte la migration jouée (`b101be9f`, `7a1b9940`), tout
> est vert **sauf `check:bundle`** (chemin critique 329,8 ko), et elle est **2 commits devant
> `main` et ~50 derrière**. Plus elle attend, plus le rebase coûte.

`CLAUDE.md` et `faille.md` décrivaient un piège à deux CVE (`GHSA-qwww-vcr4-c8h2`,
`GHSA-wrjc-x8rr-h8h6`) sans issue sous React 18. **Mesuré contre trois sources indépendantes**,
ce n'est plus vrai depuis le 2026-07-28 :

1. L'avis GitHub lui-même (interrogé via l'API, pas son résumé dans la doc) porte **deux plages
   disjointes avec chacune son propre correctif** : `[7.12.0, 7.18.2)` corrigée en **7.18.2**,
   `[8.0.0, 8.3.0)` corrigée en 8.3.0. La doc les avait fusionnées en une seule plage
   (« ≥ 7.12.0 < 8.3.0 »), ce qui masquait le correctif intermédiaire.
2. `react-router@7.18.2` (publié le 2026-07-28) est **déjà celui installé** : `package.json` porte
   `^7.18.2`, `package-lock.json` l'épingle exactement.
3. `npm audit` local (0 alerte sur `react-router` — les 2 seules alertes actuelles viennent de
   `shadcn`, C-18, sans rapport) et l'API OSV interrogée pour `react-router@7.18.2` (`{"vulns":[]}`)
   rendent tous les deux zéro résultat. `GHSA-wrjc-x8rr-h8h6` est fermé dès 7.18.0.

**Conséquence** : le dépôt ferme déjà les deux CVE, aujourd'hui, sous React 18, sans avoir rien
changé. La migration React 19 + `react-router` 8 n'est plus une urgence sécurité — chiffrage complet
dans [`docs/MIGRATION-REACT19.md`](../MIGRATION-REACT19.md).

- ❌ **Ça ne change rien à la règle `npm audit fix`** : toujours ne pas la lancer sur ce paquet sans
  relire l'avis à la main.
- **Correctif documentaire livré** : `faille.md` § « Ouvert · à planifier » corrigé.
- **Fini quand** : fini — c'est un constat, pas un correctif de code. Le moment de la migration
  (désormais un arbitrage produit, plus une urgence) est dans `a-faire-manuel.md` M-33.

> #### 🔴 La MIGRATION a été jouée le 2026-09-12, et elle BUTE sur le budget de bundle
>
> ⚠️ **Deux textes disaient deux choses**, et c'est à corriger en premier : cet item se déclare
> « fini — c'est un constat », alors que l'arbitrage du § 0 et le prompt de
> `prompts-a-faire-code.md` traitaient `C-58` comme **le chantier de migration**. Le travail
> ci-dessous est celui du chantier ; le constat, lui, reste vrai et clos.
>
> Branche **`feat/react-19`**, React 18.3.1 → **19.3.0**. Tout est vert **sauf une chose**, et
> c'est elle qui décide :
>
> | Gate | Verdict |
> |---|---|
> | `tsc -b` | propre, **après 9 corrections de types** (voir plus bas) |
> | `npm run lint` | **0 erreur** |
> | `npm test` | **226 fichiers / 2 500 tests**, zéro échec |
> | `i18n:check` · `i18n:scan` · `i18n:identical` · `validate:migrations` · `check:rls` · `check:legal` | vertes |
> | `npm run build` | réussit |
> | `npx playwright test --project=chromium` | **104 passés, 3 ignorés, 0 échec** (23,8 min). Le seul rouge est `e2e/_tmp-probe.spec.ts`, la sonde jetable NON SUIVIE par git que `CLAUDE.md` documente |
> | **`npm run check:bundle`** | ❌ **exit 1** — chemin critique **329,8 ko** contre un plafond de **323,0** |
>
> **Ce qui coûte** : `vendor-react` passe de **72,1 à 95,4 ko gzip**, soit **+23,3 ko (+32 %)**. Le
> chunk a été ouvert pour écarter un artefact — pas de `react-dom/server`, pas de `renderToString`,
> pas de `__DEV__`, pas de build de développement. **Le surcoût est réel.**
>
> 🔴 **Et il ne peut pas se régler en remontant le plafond.** Celui-ci a été ABAISSÉ à 323,0 ko le
> 2026-09-11 pour satisfaire le critère de sortie de **C-14** (5 % de marge sur les deux budgets,
> obtenue à 5,2 %). React 19 la consomme entièrement et déborde de 6,8 ko. Le remonter rouvrirait
> C-14 le jour même, et la règle 1 de ce fichier l'interdit.
>
> Le seul candidat pour trouver ces 7 ko est `vendor-animation` (49,0 ko), tiré dans le chemin
> critique par **un seul import statique** : `MotionConfig` dans `App.tsx`. ❌ **Le différer
> naïvement est exclu** : c'est un fournisseur de CONTEXTE, les premiers écrans rendraient sans
> `prefers-reduced-motion` — la classe de régression qui a déjà coûté deux fois à ce dépôt.
>
> **Trois issues, aucune technique** : (1) différer, l'option par défaut puisque l'urgence sécurité
> est tombée ; (2) sortir framer-motion du chemin critique pour de vrai, chantier à part avec sa
> mesure au navigateur sous `reduce` ; (3) accepter de rouvrir C-14 — décision d'Axel.
>
> **Ce que la migration a rendu au passage, et qui vaut indépendamment** : l'étude
> `docs/MIGRATION-REACT19.md` annonçait « un seul site » à corriger (`useRef<T>()` sans argument,
> déjà fait par C-60). En réalité, sous les types React 19, `useRef<T>(null)` rend
> `RefObject<T | null>` : **8 erreurs de compilation, 9 déclarations de props à élargir**, dans 5
> fichiers. Le correctif est juste et mécanique — mais un `grep` sur un MOTIF ne mesure pas une
> CLASSE de rupture. Le § 4bis du document porte le détail et les chiffres.
>
> ⚠️ `react-router` 8 (PR 2) n'a **pas** été tenté : il exige React ≥ 19.2.7 en peer, donc il est
> séquentiel derrière une PR 1 qui ne peut pas être posée.

> #### ✅ ARBITRAGE RENDU le 2026-09-13 : **on DIFFÈRE** (issue 1), et le seuil de reprise est chiffré
>
> Décision d'Axel sur M-41. `feat/react-19` reste **poussée et non fusionnée**. Rien n'est annulé.
>
> 🔴 **Ce que la remesure du jour a rendu, et qui corrige la lecture du blocage** : le plafond de
> **323 000 o n'est dans AUCUN commit**. `git log -S"323_000" -- scripts/check-bundle-budget.mjs`
> ne rend rien, et `git show HEAD:scripts/check-bundle-budget.mjs` porte encore `critical: 370_000`
> / `entry: 78_000`. L'abaissement du 2026-09-11 et la sortie de `sonner` qui le finance vivent dans
> l'arbre de travail **non commité** d'une session voisine. Contre `main` tel qu'il est commité,
> React 19 à 329,8 ko **passerait la garde en silence**. Le blocage est réel, mais il s'appuie sur un
> cliquet qui n'est pas encore dans l'histoire du dépôt : raison de plus de ne pas fusionner.
>
> **Deux seuils, pas un.** Un seul ne suffit pas, et le premier est un piège :
>
> | Seuil | Chemin critique React 18 exigé | Coupe à trouver | Résultat |
> |---|---|---|---|
> | `check:bundle` simplement verte | ≤ **299,7 ko** | 6,8 ko | garde verte, **0 %** de marge |
> | Critère de sortie de **C-14** préservé (5 %) | ≤ **283,5 ko** | **22,8 ko** | React 19 fusionné sans rouvrir C-14 |
>
> Départ : 306,3 ko (2026-09-11). Une garde qui passe à 0,0 % de marge rouvre C-14 le jour même,
> exactement comme un plafond relevé. **Le seuil opposable est 283,5 ko.**
>
> Le seul gisement de cette taille reste `vendor-animation` (49,0 ko). **L'issue 2 n'est donc pas une
> alternative à l'issue 1, c'est sa condition de reprise.**
>
> **Ce que différer coûte, écrit pour que personne ne le redécouvre** : `react-router` 8 reste bloqué
> derrière (sans conséquence sécurité, cf. le constat ci-dessus) ; la classe de bug « composant
> shadcn recopié de l'amont React 19, `ref` jamais attaché » reste ouverte et **silencieuse par
> construction** (elle a coûté `Button` puis `Input`) ; et les 9 corrections de types de la branche
> (`RefObject<T>` → `RefObject<T | null>`) sont justes indépendamment de React 19, donc portables sur
> `main` à part si on veut alléger la reprise.
>
> Détail et calculs : `docs/MIGRATION-REACT19.md` § 4bis.c.


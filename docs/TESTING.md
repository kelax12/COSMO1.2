# Tests — COSMO

## Historique des notes et des audits : archivé

Les notes /100 de ce document ont cessé (ADR 0012, [`INDICATEURS.md`](./INDICATEURS.md)). Leur journal daté, les angles morts mesurés et les récits d'incident qui fondent les règles ci-dessous sont déplacés, sans coupe, dans [`archive/TESTING-journal-des-notes-2026-06-21-au-2026-11-07.md`](./archive/TESTING-journal-des-notes-2026-06-21-au-2026-11-07.md). Une règle de ce document qui cite une date ou un incident s'y retrouve.

## Vitest — tests unitaires de logique métier pure

Config `vitest.config.ts` (séparée de `vite.config.ts`), environnement `node`. Les tests vivent **à côté** du code testé (`*.test.ts`).

```bash
npm test           # run once (utilisé en CI, bloquant)
npm run test:watch # mode watch
npm run test:coverage # + couverture v8 (seuils par fichier — bloquant CI)
```

### Couverture · mesure du 2026-09-11

✅ **VERTE au 2026-09-14** : **2 586 tests / 228 fichiers**, zéro échec, `exit 0`, aucun seuil
franchi — 31,15 L · 30,73 S · 24,41 F · 26,31 B.

⚠️ **Les pourcentages BAISSENT alors que 116 tests ont été ajoutés** depuis le 09-11 (31,32 L pour
2 470 / 221). Ce n'est pas une régression : le **dénominateur** bouge aussi, du code neuf étant
arrivé avec. Un taux de couverture ne se lit jamais seul, toujours avec le nombre de lignes qu'il
rapporte — sans quoi on « corrige » une baisse qui n'en est pas une, ou on rate une vraie.

*Mesure précédente, conservée :* ✅ **VERTE** : 2 470 tests / 221 fichiers, zéro échec, aucun seuil franchi.

| | 2026-08-29 | **2026-09-11** | Seuil global |
|---|---|---|---|
| Lines | 29,17 | **31,32** | 26 |
| Statements | 28,81 | **30,91** | 26 |
| Functions | 23,41 | **24,56** | 21 |
| Branches | 24,17 | **26,37** | 22 |

🔴 **Le cliquet du glob `supabase.repository.ts` a MORDU le 2026-09-08.** `functions` est tombé
à **89,83 %**, sous son seuil de 90, et la gate est passée au rouge. C'est exactement ce pour quoi
ce cliquet-là existe : il mord avant le plancher global, qui, lui, montait tranquillement.

**Les fonctions manquantes n'étaient pas dispersées, elles étaient datées.** 24 fonctions non
couvertes sur 236, dont six livrées après la campagne de tests du 2026-08-25 :

| Repository | Fonctions non couvertes | Livrées par |
|---|---|---|
| `tasks` | `getDependencies` · `addDependency` · `removeDependency` | mig. **132**, le 2026-08-30 |
| `okrs` | `restoreCompletions` | contrat `useRestoreX` (R-08) |
| `organizations` | `getMyOrgInbox` | mig. **129** + **142** |
| `team-projects` | `addTaskDependency` · `removeTaskDependency` | mig. **108** + **117** |
| `tasks` | `getPendingSharedTasks` · `delete` | antérieures, jamais couvertes |
| `lists` | `getByTaskId` · `delete` | antérieures, jamais couvertes |
| `habits` | `updateHabit` | antérieure, jamais couverte |

❌ **Aucun seuil n'a été baissé.** 126 tests ont été écrits sur ces six fichiers, couvrant
13 fonctions. Le glob est passé de **89,83 → 95,34 %** de fonctions, et **six repositories sont
maintenant à 100 %** (`tasks`, `organizations`, `team-projects`, `habits`, `events`, `categories`).
Restent sous la barre : `lists` (9/12) et `okrs` (28/33).

Les seuils du glob sont **remontés** en conséquence (`vitest.config.ts`), à ~2 points sous le
mesuré, comme le veut la convention du fichier :

| | Avant | **Après** | Mesuré |
|---|---|---|---|
| lines | 88 | **90** | 92,99 |
| statements | 74 | **76** | 78,85 |
| functions | 90 | **93** | 95,34 |
| branches | 63 | **65** | 67,91 |

⚠️ **Les planchers GLOBAUX n'ont PAS été remontés**, et c'est une décision, pas un oubli : leurs
marges valent maintenant 5,32 / 4,91 / 3,56 / 4,37 points. La marge de `functions` était de
**0,32 point** le 2026-08-25 ; elle est confortable pour la première fois. À remonter à la
prochaine mesure verte, pas dans le même geste que celui qui vient de réparer la gate.

⚠️ **Comment mesurer sur cette machine.** Le run prend ~11 minutes, et il **meurt en silence** :
pas de résumé, pas de rapport, pas de message, si une autre session fait tourner sa suite en
parallèle (mesuré six fois le 2026-09-09 : workers qui ne démarrent pas, tests à 30 s de timeout,
processus tué sans trace). Mesurer machine libre, ou dans un worktree isolé, avec
`--maxWorkers=4`. ❌ **Ne jamais conclure d'un run mort que la couverture a baissé** : un run sans
bloc « Coverage summary » n'a rien mesuré du tout.

Couvre la logique pure et testable (pas de DOM, pas de réseau) :
- `src/modules/okrs/progress.test.ts` — `recalcProgress` (moyenne, plafond 100 %, garde anti division par zéro B17, complétion).
- `src/modules/lists/smart-rules.test.ts` — presets `overdue`/`this-week`/`high-priority`, `tasksInList`, `tasksDueToday`.
- `src/lib/pagination.types.test.ts` — `assertValidCursor` (UUID/ISO + rejet injection N6/H-1).
- `src/lib/fetch-all-pages.test.ts` — auto-pagination `getAll` (plafond, pages, erreurs).

Couvre aussi les **mappers de repository** (`src/modules/{tasks,habits,events}/mappers.ts` — frontière sécurité anti-mass-assignment, le `mapToDb` ne doit JAMAIS émettre `user_id`), les **hooks** React Query (jsdom + `@testing-library/react`, repos mockés) et quelques **composants** (`EmptyState`, `AppErrorBoundary`).

**Règles** :
- ✅ Tester en priorité les **fonctions pures** (extraire la logique d'un god component ou d'un repo dans un module pur, puis tester ce module — cf. `okrs/progress.ts`).
- ✅ Fixtures déterministes (`now` figé, pas de `Math.random()` non seedé).
- ❌ Ne pas mettre de test qui dépend du DOM sans `// @vitest-environment jsdom`.
- Cleanup auto via `src/test/setup.ts`. Ne pas remettre les mappers inline dans les repos.

## Playwright E2E — parcours critiques

Dossier `e2e/`, config `playwright.config.ts`.

```bash
npm run test:e2e         # run headless (2 projects : Desktop Chrome + iPhone 12)
npm run test:e2e:ui      # mode debug visuel
npm run test:e2e:report  # rapport HTML
```

**Avant le premier run** : `npx playwright install chromium webkit` (le project
`mobile-safari` utilise WebKit).

> 🔴 **WebKit n'était PAS installé sur le poste de développement** (constaté le
> 2026-09-05 : `Executable doesn't exist at …\webkit-2336`). Tout ce qui a été
> annoncé comme « joué localement » sur `mobile-safari` depuis la création de ce
> project ne l'avait donc **jamais** été — la moitié mobile de chaque chiffre de
> ce fichier venait de la CI, ou de nulle part. Installé depuis.

### Références visuelles : la marche de régénération (V15.4, FRO-02)

Les références `e2e/__screenshots__/linux/` ne sont écrites que par `.github/workflows/captures-regenerer.yml`
(runner Linux, deux passes, artefact de revue `captures-revue`, branche `noyau/captures-<run>`, jamais `main`).
`visual.yml` ne fait plus que COMPARER. Pas de PR : push direct sur `main`, la revue se trace dans le commit.

1. Lancer **Captures regenerer** (`workflow_dispatch`) avec le motif.
2. Ouvrir l'artefact `captures-revue` (`index.html` : avant, après, différence) et relire.
3. Ramener la branche sur `main` avec le trailer : `git fetch origin noyau/captures-<run> && git merge --ff-only FETCH_HEAD && git commit --amend --trailer "Captures-relues: <URL du run>"`, `git push origin HEAD:main`.
4. Supprimer la branche : `git push origin --delete noyau/captures-<run>`.

Garde : `check:captures-relues` (`scripts/check-captures-relues.mjs`, job `fichiers-sensibles` de `CI noyau`, sur la plage poussée)
refuse un commit qui touche `e2e/__screenshots__/**` sans `Captures-relues: <URL>`, puis interroge l'API : le run existe, vient de
`captures-regenerer.yml`, a réussi. Témoins : `check-captures-relues.guard.test.mjs` (vrais commits dans un dépôt jetable),
`captures-revue.guard.test.mjs` (vrais PNG). ⚠️ Le trailer est une trace, pas une preuve de lecture.

### Alerte périmée (descendu de `scripts/CLAUDE.md` le 2026-11-08)

- ⚠️ **2026-10-16 : les runs `CI` de `main` ne s'annulent plus** (un groupe par commit), donc un rouge
  peut finir après le vert qui l'a réparé. `scripts/ci-alert-perime.mjs` tait l'issue ET le webhook
  sur ce seul cas, prouvé par l'API ; ❌ jamais dans le doute (API en panne, contexte vide : l'alerte part).

### Décompte réel — mesuré le 2026-09-14 (`npx playwright test --list`)

**220 cas, 26 specs, 4 projects.**

| Project | Cas | Ce qu'il joue |
|---|---|---|
| `chromium` | **107** | Desktop Chrome, mode démo |
| `mobile-safari` | **96** | iPhone 12 / WebKit, mode démo |
| `supabase-stub` | **16** | Desktop Chrome, **hors mode démo** (cf. plus bas) |
| `supabase-stub-warmup` | **1** | Préalable de chauffe, pas un parcours (cf. plus bas) |

**Ce que la passe du 2026-09-14 a ajouté** : `e2e/stubbed/delete-org.spec.ts`
(4 cas), le parcours nominal de suppression d'entreprise — rembourser, résilier,
supprimer — exigé par **C-39** et jamais joué jusque-là. Il prouve l'ordre en
**retenant la réponse** de l'Edge Function : tant qu'elle ne part pas, aucune
`rpc/delete_organization` ne doit exister. Vu ROUGE sur une mutation de
`useDeleteOrgFlow` avant d'être commité.

✅ **La sonde jetable `e2e/_tmp-probe.spec.ts` est SUPPRIMÉE** (2026-09-14). Elle
était non suivie par git, rouge, et faussait de 2 cas tout recomptage local : la
commande affichait 212 quand le dépôt en portait 210, et l'écart devait être
expliqué à chaque mesure. Local et dépôt disent désormais le même nombre.
⚠️ Ce que cet écart enseignait reste vrai : **un décompte local qu'on recopie
sans regarder ce qui est SUIVI** est exactement la façon dont le précédent est
devenu faux.

⚠️ **`supabase-stub-warmup` n'est pas un parcours** : il compile les deux écrans
du harnais avant que les douze autres cas ne commencent. Le compter avec eux
gonflerait le total d'un test qui ne mesure pas le produit ; le taire ferait
réapparaître un écart entre `--list` et ce fichier. Il est donc compté à part.

**Mesures précédentes**, conservées pour montrer la dérive et pas pour être
recopiées : **190 cas, 23 specs, 3 projects** le 2026-09-05 ; et avant cela
« 62 × 2 = 124, 15/16 specs », qui datait du **2026-08-25** et a été **recopié**
pendant onze jours au lieu d'être remesuré — il était déjà faux de 44 cas et de
2 specs avant tout ajout de septembre. Un total qu'on recopie n'est pas une
mesure.

**Ce que cette passe a ajoutée, et elle seule** : le parcours de remboursement
(C-65, 5 cas, cf. plus bas) et son préalable de chauffe (1). Le reste de l'écart
avec le 2026-09-05 vient des autres chantiers de la fenêtre, et n'a pas été
attribué ligne par ligne — l'attribuer de tête est précisément ce qui produit un
chiffre faux qu'on recopie ensuite.

❌ **Ne jamais écrire ce total sous la forme « N × 2 ».** Les projects ne jouent
plus le même ensemble : `demo-calendar` et `demo-task-dependencies` sont hors de
`mobile-safari` (raison mesurée, cf. ci-dessous), et `e2e/stubbed/**` n'est joué
que par `supabase-stub`. Une multiplication redonnerait un chiffre faux, et
c'est exactement comme ça que le précédent l'est devenu.

Les 3 tests de `demo-touch-gestures.spec.ts` sont `skip` sur chromium
(viewport ≥ 768 px). La CI joue `chromium` **et** `supabase-stub` (mêmes
binaires Chrome) ; `mobile-safari` reste hors CI, WebKit coûtant une minute
d'installation de plus.

🔴 **Un project hors CI est un project qui ne tourne nulle part.** `supabase-stub`
a été ajouté au job `e2e` le 2026-09-05 en même temps que les specs qu'il porte :
sans ça, `FirstRunSetup` et le retour OAuth seraient des gardes posées sur `main`
qui ne s'exécutent jamais — la faute déjà commise deux fois ici.

#### Le project `supabase-stub` — jouer ce que la démo ne peut pas atteindre

`e2e/fixtures.ts` ouvre le mode démo, et **toute garde qui commence par
`!isDemo` était donc structurellement hors de portée de la suite** : `.env` est
vide en local et absent en CI, donc `appModeStore` démarre `isDemo = true` sans
aucun chemin d'exécution pour en sortir depuis le navigateur. `FirstRunSetup`
n'était pas resté sans parcours par oubli — aucun test ne **pouvait** l'atteindre.

Le mode Vite `e2e-stub` (`.env.e2e-stub`, versionné, sans secret) sert l'app avec
deux variables Supabase non vides pointant `stub.cosmo.invalid`, un hôte qui ne
résout pas ; `e2e/supabase-stub.ts` pose une session dans `localStorage` et
intercepte tout ce qui part vers lui. Serveur dédié sur le port **3210**, avec
`reuseExistingServer: false` : réutiliser un serveur trouvé là ferait jouer ces
specs contre une app en mode démo, où l'écran testé ne monte jamais.

- ⚠️ Ce harnais prouve le **parcours client** (quel écran, dans quel ordre,
  quelle requête part avec quel corps). Il ne prouve **rien** du serveur : ni
  RLS, ni triggers, ni forme réelle des réponses PostgREST. Ces frontières-là
  restent celles de `npm run test:rls` et `npm run check:rls`.
- ⚠️ Les specs y ouvrent une page par **`gotoStubbed()`** (`e2e/supabase-stub.ts`),
  jamais par un `page.goto` nu. Trois pièges du serveur de développement y sont
  absorbés une fois pour toutes, et aucun n'est un comportement du produit :
  1. **`load` n'arrive jamais** — le canal Realtime rouvre en boucle un WebSocket
     vers l'hôte stub. Mesuré le 2026-09-05 : `page.goto` expirait à 120 s sur
     une page rendue depuis 25 s.
  2. **`domcontentloaded` non plus, au premier passage** — Vite découvre les
     dépendances de la page, les pré-empaquette et **recharge**, et l'événement
     se perd dans ce rechargement. Mesuré le 2026-09-08 : 240 s d'attente sur une
     page qui finissait par s'afficher. D'où `waitUntil: 'commit'`, qui rend la
     main dès la réponse — c'est ensuite l'attente d'une **ancre réelle** qui dit
     que la vue est là.
  3. **Un `import()` de route qui échoue pendant une re-optimisation** (« Failed
     to fetch dynamically imported module ») : l'`AppErrorBoundary` prend la main
     et la page reste vide, définitivement. Une nouvelle **tentative** la
     rattrape — ce n'est pas une attente plus longue qu'il faut.
  ❌ **Ne jamais transformer ce rattrapage en boucle illimitée** : il est borné
  (3 tentatives, 5 pour la chauffe), sans quoi il finirait par masquer une vraie
  panne du produit.

#### Le préalable de chauffe (`supabase-stub-warmup`)

Ce serveur a **son propre cache de dépendances** (`node_modules/.vite-e2e-stub`,
posé par `vite.config.ts`). Ce n'est pas un confort : partagé avec celui du
serveur du port 3000, dont le mode et les alias diffèrent, chacun invalidait le
cache de l'autre et se **redémarrait en boucle**, servant une page blanche
(« The server is being restarted or closed », mesuré le 2026-09-08).

Conséquence : en CI il démarre toujours à froid, et ce coût tombait entièrement
sur le **premier cas exécuté**. Mesuré, cache vide : onze cas verts, un rouge,
toujours le premier — tantôt une page restée vide plus de trois minutes, tantôt
deux mutations arrivées dans le désordre parce que la machine était saturée. Ce
n'était pas ce cas-là qui était fragile, c'était **la place qu'il occupait**.

Le project `supabase-stub-warmup` (`e2e/stubbed/_warmup.spec.ts`) compile les
deux écrans du harnais avant tout, et `supabase-stub` en **dépend** : si la
chauffe échoue, aucun parcours n'est joué. Coût mesuré le 2026-09-11, cache
vide : **3,5 min**, puis 6 à 45 s par parcours.

❌ **La mauvaise réponse aurait été de gonfler les tolérances du premier test**
jusqu'à ce qu'il passe : ça déplace le seuil sans nommer la cause, et ça rend le
détecteur muet le jour où l'écran est vraiment lent.

#### C-65 — le parcours de REMBOURSEMENT (`e2e/stubbed/refund.spec.ts`, 5 cas) · ❌ retiré le 2026-11-01

> ⚠️ **Récit historique.** Le bouton « Résilier et être remboursé » et cette spec ont disparu le
> 2026-11-01 (`d765d9c5`) : aucun remboursement ne part plus de l'interface. Le parcours vivant
> est `e2e/stubbed/retractation.spec.ts` (rétractation 14 jours, résiliation en fin de période),
> doublé de `OrgBillingTab.retractation.parcours.test.tsx`. Le mécanisme de substitution du
> drapeau ci-dessous reste celui en usage.

C-27 exigeait nommément ce parcours : « C-65 touche de l'argent, il ne part pas
sans son parcours E2E ». Il manquait pour une raison **structurelle** : le bouton
n'est monté nulle part tant que `ENTERPRISE_BILLING_ENFORCED` vaut `false`, et le
mode démo rend `null` pour tout abonnement d'organisation.

🔴 **Le drapeau est retourné par une substitution de MODULE, jamais par une
variable d'environnement.** `vite.config.ts` remplace
`@/modules/billing/premium-config` par `e2e/stubs/premium-config.e2e-stub.ts`
**dans le seul mode `e2e-stub`** ; ce module réexporte le produit (`export *`) et
ne change qu'un booléen. C'est le même geste que le `vi.mock(…, importOriginal)`
du test unitaire, au niveau du bundler. Faire dériver le drapeau d'un
`import.meta.env` aurait cassé la règle écrite du dépôt — « le flag est la SEULE
condition » — dans le produit livré, pas seulement dans les tests.

Ce que les 5 cas prouvent, sur l'app réelle, avec le vrai routage et le vrai
catalogue :

| Cas | Ce qu'il mesure |
|---|---|
| mensuel | un seul appel à `stripe-org-refund`, authentifié, corps `{ orgId }` **sans aucun montant** ; montant affiché = celui du serveur ; résiliation visible **sans rechargement** ; plus aucun bouton pour recommencer ; zéro écriture cliente dans `org_subscriptions` |
| annuel | même chose au **prorata des mois entiers** restants |
| échec Stripe | le message dit « rien n'a été résilié », **aucun montant** n'est annoncé, et l'écran reste dans l'état d'avant — donc on peut réessayer |
| non-propriétaire | `?tab=billing` tapé à la main retombe sur l'aperçu, aucun appel ne part |
| témoin | rien n'a quitté le stub vers un vrai projet Supabase |

⚠️ **Les deux montants ne sont pas écrits à la main** : la spec importe
`supabase/functions/_shared/refund-amount.ts` — le module que l'Edge Function
appelle — et vérifie que l'écran affiche exactement ce qu'il décide. Un montant
en dur dans le test ferait de lui une **seconde définition** de la règle de
remboursement, exactement le risque qui a imposé `org-tiers.parity.test.ts`.
La spec épingle aussi la `reason` rendue (`monthly_full`, `yearly_prorata`), sans
quoi les deux cas pourraient mesurer la même branche sans que rien ne le dise.

🔴 **Ce que ce parcours NE prouve PAS, et qu'aucun test de ce poste ne peut
prouver** : `refunds.create`, l'ordre « rembourser d'abord, résilier ensuite », la
clé d'idempotence dérivée de l'`invoice_id`, le pré-contrôle qui retranche, et la
ligne compensatoire écrite par `stripe-webhook`. La clé Stripe du projet est une
clé de **test**, `org_subscriptions` est vide, il n'existe aucune facture à
rembourser, et `APP_URL` épingle l'origine CORS sur la production.
❌ **Ne pas déployer C-65 en s'appuyant sur ce fichier seul.**

⚠️ Le cas d'échec se lit deux fois : c'est le **stub** qui décide de ne rien
résilier, donc il ne mesure pas le serveur. Ce qu'il mesure est une propriété du
**client**, et elle n'était pas acquise : sur un échec, l'écran ne doit pas
anticiper une résiliation qui n'a pas eu lieu.

#### TST-03 — `e2e/real/` : les parcours contre une VRAIE base (workflow `e2e-supabase`)

Jusqu'au 2026-11-06 aucun parcours Playwright ne parlait à une vraie base : la démo
rejoue `localStorage`, le stub intercepte tout vers un hôte inexistant. Les défauts
qui n'existent que contre Postgres (RLS, triggers, RPC, forme des réponses) y étaient
hors de portée, `C-77` (`okrTime` à 0 en production 17 jours, juste en démo) en est
l'exemple.

- **Workflow** `.github/workflows/e2e-supabase.yml` (push sur `main`, `workflow_dispatch`) : monte
  la pile comme `rls-integration` (`supabase start`, `node scripts/apply-migrations.mjs`), sert les
  Edge Functions (`supabase functions serve`, `APP_URL` = l'origine de l'app), construit l'app avec
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` de la pile, la sert (`vite preview`, port 3220) et joue
  `npx playwright test -c playwright.real.config.ts`. ⚠️ Il n'est pas dans la liste de `ci-alert.yml`.
- **Config à part** (`playwright.real.config.ts`), parce que `playwright.config.ts` démarre deux
  `webServer` (démo et `e2e-stub`) qu'un `--project=` ne désactive pas. Les specs de `e2e/real/` sont
  exclues (`testIgnore: '**/real/**'`) de `chromium` et `mobile-safari` : elles ne peuvent pas être
  jouées sans pile.
- **Huit parcours** : inscription et connexion, tâche (créer, modifier, terminer), habitude, événement
  d'agenda, OKR et résultat clé, partage entre deux comptes, entreprise (invitation, tâche d'équipe
  visible du membre, invisible d'un tiers), suppression de compte. Chaque écriture est relue après
  un rechargement ET par le client authentifié du compte (RLS exercée). Pas de Stripe.
- 🔴 **Local seulement** : `e2e/real/helpers.ts` refuse un hôte autre que `127.0.0.1` / `localhost`.
  Comptes `@example.com` créés par le test (la `service_role` ne sert qu'à créer et supprimer), supprimés
  en fin de cas. ❌ Jamais un vrai compte, jamais l'URL de production.
- 🔴 **Première exécution (2026-11-06) : trois écarts entre une base REJOUÉE et l'application**, consignés
  en `test.fixme` dans `e2e/real/schema-drift.spec.ts` : `tasks.deadline` NOT NULL, `tasks.priority` limitée à
  1..5 (l'écran envoie `null` et `0`), `friend_requests.user_id` NOT NULL (l'insertion de l'app ne l'envoie
  pas). La production a très probablement été assouplie hors migration (à confirmer par `\d tasks` et
  `\d friend_requests`) ; une base reconstruite depuis le dépôt refuse ces écritures. Les parcours « tâche »
  et « partage » posent donc leur tâche et l'amitié en préalable. Correctif : une migration, puis retirer `fixme`.
- ⚠️ Ces cas ne comptent pas dans `playwright test --list` (config par défaut). Les recompter par
  `npx playwright test -c playwright.real.config.ts --list`.

#### Ce qui n'est PAS joué sur `mobile-safari`, et pourquoi

`demo-calendar` et `demo-task-dependencies` visent un DOM qui n'est pas forké par
viewport. Ce qui diffère, c'est la navigation pour l'atteindre : mesuré le
2026-09-05 sur `/tasks` en 390 px, ni « Tout replanifier » (bandeau des tâches en
retard) ni « Sélectionner » (barre d'actions groupées) n'existent, et la carte
mobile n'offre pas de menu de ligne équivalent. 🔴 **C'est un écart de produit,
pas un verdict de conformité mobile** — il est nommé dans `playwright.config.ts`
plutôt que caché derrière un `skip` silencieux.

✅ **Depuis le 2026-10-16, `a11y-keyboard-audit` JOUE sous WebKit** (`C-118`, fermé). Il en était
exclu depuis le 2026-09-23 (11 cas rouges, aucun audit clavier Safari). Triage des cas rouges, un par un :
**un défaut produit** (Safari n'émet aucun `contextmenu` au clavier : `Shift+F10` et la touche Menu
n'arrivent qu'en `keydown`, donc la feuille d'actions d'une tâche était inatteignable au clavier sur la
carte mobile, WCAG 2.1.1 ; corrigé dans `TaskCard`, 6 cas unitaires dont trois témoins) ; **un écart
Safari déclaré** (Tab saute les liens par défaut, Option+Tab les parcourt ; Playwright ne sait pas
l'émuler, le cas du lien d'évitement mesure donc les mêmes propriétés sans passer par Tab, après une
sonde de capacité) ; **le reste du harnais** (le fichier s'exécutait à 390 px tactile alors que ses
déclencheurs sont de bureau, `/tasks` lu avant son rendu, barre mobile non attendue après un
redimensionnement, 2 s de fermeture trop courtes pour une modale animée sous WebKit).
⚠️ Le fichier impose lui-même un poste de bureau (`test.use`) : c'est l'audit d'une personne au
clavier, et c'est ce qui permet de le jouer dans l'unique project WebKit du job `e2e` sans toucher à
`ci.yml`. ❌ Ne pas lire « 16 cas verts sous WebKit » comme « Safari est accessible au clavier » :
Option+Tab, VoiceOver et l'accès complet au clavier d'iOS ne sont pas émulés.

⚠️ **Six autres specs supposaient le bureau, et ont été rendues adaptatives plutôt que retirées**
(2026-09-23) : le bouton « Créer » de l'en-tête mobile (`demo-create-task`), un pourcentage OKR
**visible** plutôt que le premier du DOM (`demo-journeys`), la liste de tâches repliée de l'agenda
d'un membre (`demo-entreprise-session-fixes`), le bouton flottant « Nouvelle habitude » et un
viewport de bureau porté par le test pour les deux déclencheurs qui n'existent qu'au-dessus de
768 px (`reduced-motion-sheets`). Et un vrai défaut en est sorti : les cases de la grille
d'habitudes mobile n'avaient **aucun nom accessible une fois cochées**, ni d'état exposé
(`HabitCard`, corrigé : `role="checkbox"`, `aria-checked`, nommées par l'habitude et le jour).

Les 4 specs de la vague entreprise couvrent le mode entreprise, arrivé jusque-là
sans E2E : `demo-entreprise-dependencies` (9), `demo-entreprise-tasks-tab` (5),
`demo-entreprise-session-fixes` (5), `demo-entreprise-okr-modal` (2).

#### Les parcours ajoutés le 2026-09-05 (C-27)

| Spec | Cas | Ce qu'elle ferme |
|---|---|---|
| `stubbed/first-run.spec.ts` | 5 | `FirstRunSetup` : la garde s'ouvre sur un compte vide, **chaque étape écrit au moment où elle est validée** (mesuré sur les requêtes parties, pas sur un état React), la première tâche part sans échéance, l'accueil ne revient pas |
| `demo-calendar.spec.ts` | 7 | Le calendrier COSMO sur ses **six** surfaces, plus `minDate` du report en masse et le focus au clavier dans la grille (défaut React 18 / `forwardRef`) |
| `demo-task-dependencies.spec.ts` | 2 | Graphe **personnel** (mig. 132) : poser une arête et la relire, refuser un cycle **indirect à trois maillons**, ne jamais se proposer soi-même, retirer ; « Créer et lier » |
| `demo-billing-consent.spec.ts` | 1 | Facturation armée depuis la bascule live (`5bf21a50`) : prix TTC affichés, et aucun « Choisir ce palier » tant que les DEUX cases de rétractation ne sont pas cochées (S-6, L221-28). S'appelait `demo-billing-disarmed` et vérifiait l'inverse jusqu'au 2026-10-22 |

Les quatre premiers cas ont été **vus rouges avant d'être verts** : différer les
créations de `FirstRunSetup` à la dernière étape fait tomber le premier ; le
calcul du montant remboursé refait côté client fait tomber deux cas du parcours
de remboursement.

Les fichiers `e2e/rls/*.test.ts` ne sont **pas** des specs Playwright : ce sont
des tests Vitest d'intégration (`npm run test:rls`, job CI `rls-integration`,
stack Supabase locale). Ils sont **6** au 2026-08-25 : `tasks`, `get-my-tasks`,
`shared-tasks`, `org-helpers-not-exposed`, `org-subscriptions`, et
`org-permissions` (mig. 115).

**Architecture** :
- `e2e/fixtures.ts` : fixture `demoPage`. Clean localStorage/cookies → pose
  `cosmo_cookie_consent` → goto / → clic CTA « Essayer maintenant — sans
  inscription » → attend `/dashboard` → neutralise les flags
  `cosmo_tutorial_seen_*_(desktop|mobile)`.
- Tests smoke : `demo-create-task.spec.ts` (création réelle de bout en bout),
  `demo-toggle-habit.spec.ts`, `demo-create-okr.spec.ts` +
  `demo-journeys.spec.ts` (mutation + persistance SPA).

**Règles** :
- ✅ Naviguer via **clic sur les NavLink** (`navTo`) : ça teste au passage que le
  lien existe. `page.goto()` est néanmoins **sûr** — le mode démo est persisté
  (`cosmo_demo_active`, cf. `src/lib/app-mode.store.ts`) et `AuthContext` le
  restaure au reload. À utiliser pour une route sans lien de nav (ex. `/premium`
  quand `PREMIUM_ENFORCED=false`).
- ✅ `baseURL` aligné sur `npm start` (port **3000**). `reuseExistingServer: true`
  — ⚠️ **un serveur périmé qui squatte le port 3000 est réutilisé silencieusement**
  et fait échouer toute la suite. Vérifier le port avant d'incriminer une spec.
- ✅ Pas de sélecteur CSS `:has-text("..." i)` — utiliser `[data-sonner-toast][data-type="error"]`.
- ✅ **Toujours `filter({ visible: true })`** : desktop (`<table>`) et mobile
  (`TaskCard`) coexistent dans le DOM via `hidden md:block` / `md:hidden`, donc
  `.first()` résout volontiers un élément **caché**.
- ✅ `filter({ visible: true })` ≠ « dans le viewport ». Avant un geste
  `page.mouse` (qui ne scrolle PAS), appeler `scrollIntoViewIfNeeded()`.
- ✅ Cases de complétion de tâche : utiliser `TASK_TOGGLE*` de `fixtures.ts`.
  Desktop = `role="checkbox"`/`aria-checked`, mobile = `<button aria-pressed>` —
  **aucun rôle ARIA commun**, seul l'`aria-label` est partagé.
- ✅ Scoper au sheet (`[data-mobile-more-sheet]`) pour cliquer un item du menu
  « Plus » : la page reste montée derrière et ses contrôles matchent les mêmes noms.
- ⚠️ Le **toaster Sonner** (`z-index: 999999999`) couvre y≈16→90 sur mobile et le
  rappel « N en retard » ne se ferme pas seul : ne jamais cliquer un point fixe
  en haut de l'écran.

## i18n — gardes de catalogues

```bash
npm run i18n:check  # parité des clés fr ↔ en (bloquant CI). Manquante ET orpheline = erreur.
npm run i18n:scan   # détecte les chaînes en dur non externalisées
```

`fr` est le catalogue de référence : le moteur retombe clé par clé sur lui, donc
un catalogue traduit incomplet n'affiche jamais de clé brute — et ne se voit pas
non plus. `i18n:check` est la seule protection réelle contre un catalogue parti
en prod à moitié traduit. Locales présentes : **fr, en** (`src/locales/`).

## Playwright A11y — `e2e/a11y-audit.spec.ts`

Scan automatique `@axe-core/playwright` sur **11 routes** : `/`, `/login`,
`/dashboard`, `/tasks`, `/habits`, `/okr`, `/agenda`, `/entreprise`,
`/statistics`, `/settings`, `/premium`. Tags WCAG 2.0/2.1 A + AA + best-practice.

```bash
npx playwright test e2e/a11y-audit.spec.ts --project=chromium
```

- Dumpe les violations dans `test-results/a11y/<route>.json`.
- **Bloquant sur `impact: 'critical'`** (`assertNoCritical` → `toHaveLength(0)`).
  Les niveaux `serious`/`moderate`/`minor` sont dumpés mais non bloquants
  (roadmap A-7/A-8/A-10). Une régression `critical` casse donc la CI : c'est ce
  guard qui a détecté le `button-name` manquant sur l'avatar de `SettingsPage`.

## CI : le noyau bloquant (`ci-noyau.yml`), et le reste qui ne bloque pas

🔴 **Vague 2.2 (2026-11-06) : un seul verdict bloquant, le workflow `CI noyau`.** `main` était
rouge sur 49 des 60 derniers runs : le job bloquant jugeait aussi des dates, des documents et des
mesures variables, et un rouge permanent ne signalait plus rien. Le noyau juge le **commit et lui
seul**. Sa conclusion, et elle seule, bloque la poussée (`.githooks/pre-push`), déclenche
`edge-deploy.yml` et sonne `ci-alert.yml`.

**Pourquoi un workflow, pas une liste de « jobs requis »** : le hook, `edge-deploy.yml` et
`ci-alert.yml` lisent la conclusion d'un WORKFLOW (`gh run list --workflow`, `workflow_run`). Une
liste de jobs devrait être recopiée dans les trois ; un job ajouté à l'une sans les autres
bloquerait d'un côté et pas de l'autre.

**Composition** : quatre jobs parallèles, sans `needs:`. Verdict au rythme du plus lent, `noyau`
(4 min 30 mesurées le 2026-11-06 sur `081b477b`) ; cible < 15 min, donc pas de shards Vitest.

- `noyau` : lint, `tsc -b`, `check:edge-coverage`, `test:coverage`, `test:coverage:tooling`.
- `lint-test-build` (venu de `ci.yml`) : `check:docs`, `validate:migrations`, `check:rls`, gardes
  statiques (cycles, plancher, effacement, sous-traitants, portabilité, env, journal des CGU),
  `i18n:check` (parité), `i18n:scan` (chaînes en dur), `i18n:identical`, `i18n:pages` (pluriels),
  `i18n:quality`, build, budget de bundle.
- `fichiers-sensibles` (venu de `ci.yml`) : voir plus bas.
- `rls-integration` (venu de `ci.yml`) : stack Supabase locale (`supabase start`), rejoue
  **toutes** les migrations sur base vierge (`scripts/apply-migrations.mjs`), puis `npm run test:rls`.

❌ **Rien dans le noyau ne juge une date, un document qui vieillit ou un état extérieur** : un
verdict qui change sans commit rend `main` rouge un matin, et un noyau rouge bloque tout.
`check:legal-journal` reste (empreinte des CGU contre le journal : ne bouge qu'avec un commit).
Revus et gardés parce qu'aucun ne lit l'horloge ni le réseau : `check:docs`, `check:test-floor`,
`check:subprocessors`, `check:env` (moitié statique).

**Hors noyau, tournent encore, ne bloquent rien et ne sonnent plus** :

- `ci.yml` (`CI etendue`) : `audit` (`npm audit` prod, peut rougir sans commit sur un avis publié ;
  Dependabot couvre l'alerte), `e2e` (Playwright, 4 projects, ~30 min), `lighthouse`.
- `visual.yml`, `mutation.yml`, `sabotages.yml`, `scalability-volume.yml`.
- `gardes-calendrier.yml` (quotidien 06:29 UTC + `workflow_dispatch`) : `check:study`,
  `check:docs-scored`, `check:lecteurs-ecran`, `check:exercice-violation`,
  `check:peremption-chantiers`, `check:acquisition`. Issue `calendrier-red`, refermée seule au vert.

**Branches `noyau/**`** : le noyau y tourne sur `push`. C'est le chemin de réparation d'un noyau
rouge (`DEPLOYMENT.md` § Hook `pre-push` : aucun contournement, seul un SHA déjà jugé vert passe
sur un noyau rouge). `fichiers-sensibles` juge la première poussée d'une telle branche
contre `origin/main`.

Témoins : `noyau-ci.guard.test.mjs` (composition, aucune garde de calendrier ni job lent dans le
noyau, aucun job du noyau dans `ci.yml`), `ci-toutes-les-gardes.guard.test.mjs` (chaque étape
joue après un rouge, le résumé liste tous les rouges), `edge-deploy-select.guard.test.mjs`.

- `fichiers-sensibles` (SEC-01, SEC-05, SEC-07) : `check:fichiers-sensibles --arbre --plage <poussée>`,
  historique complet. Refuse `prive/**`, `docs/business-plan/**`, `leads-*`, `supabase/.temp/**`,
  `.claude/settings.local.json`, csv, pdf, xls(x), docx, pptx, dumps, `.env*` (hors
  `.env.example`, `.env.e2e-stub`) et fichiers > 1 Mo, dans l'arbre ET dans chaque version
  poussée (un fichier ajouté puis retiré reste dans l'historique public). Exceptions une par une,
  chemin + blob + motif, dans le script ; aucune variable de contournement. Même liste, même
  module, à deux autres endroits : `.githooks/pre-commit` (l'index ; sans sa garde, il refuse) et
  `scripts/fichiers-suivis.guard.test.mjs` (`git ls-files`, joué par `npm test` donc par le noyau :
  un `--no-verify` y tombe). Témoins : `check-fichiers-sensibles.guard.test.mjs` (vrais `git commit`
  d'un `.csv` et d'un fichier de `prive/` refusés, hook sans garde refusé) et le témoin
  `--no-verify` de `fichiers-suivis` ; sabotages rejoués : `fichiers-sensibles-csv-aveugle`,
  `fichiers-sensibles-prive-aveugle`, `pre-commit-vert-muet`.
- `lighthouse` *(ajouté le 2026-08-25)*, `lighthouserc.json`, LCP / TBT / CLS / a11y / SEO sur
  les routes **prérendues**. Ses assertions rougissent le job, pas le noyau.
  ⚠️ **Seuils provisoires**, à resserrer sur le réel mesuré.
- `concurrency` (les deux workflows) : sur une PR, le push suivant annule le run en cours ; sur
  `main`, un groupe par commit, aucun run annulé (2026-10-16). `permissions: contents:read`.
  Dépendances : `.github/dependabot.yml`.

### Règle des 7 jours : une garde rouge se corrige, se recale par écrit ou se retire (V9.4, TST-05)

🔴 **Constat de l'audit externe du 2026-11-06** : des workflows planifiés restaient rouges des
jours durant, donc plus personne ne les lisait. `ci-alert.yml` sonne au PREMIER rouge puis se tait.

**La règle, posée le 2026-11-07** : toute garde dont le dernier run sur `main` est rouge depuis
plus de 7 jours est **corrigée**, **recalée** par une décision écrite et datée
(`.github/gardes-rouges-decisions.json` : mesure, motif, doc, revue à **30 jours au plus**), ou
**retirée** avec la même trace. Sinon, le job `rouges-anciens` de `ci-alert.yml` (quotidien,
07:43 UTC) l'inscrit dans l'issue `ci-red` (la même, pas une seconde ; un commentaire seulement
quand la liste change, webhook ops idem) et sort en 1. Il lit **tous** les workflows actifs, pas
une liste. Script : `scripts/gardes-rouges-7j.mjs` ; témoin : `gardes-rouges-7j.guard.test.mjs`.
⚠️ Hors noyau : il lit l'horloge et l'API, il ne bloque rien.

**Première mesure, 2026-11-07** : `restore-drill` rouge depuis 22 j (aucun exercice réussi
depuis le 2026-09-01, le run manuel du 10-15 refusé faute de confirmation, aucun run planifié en
octobre) et `Secrets age` depuis au moins 11 j ; `Posture` rouge depuis le 2026-10-30 à 11:18,
juste sous le seuil.

**Décisions du 2026-11-07, garde par garde :**

| Garde | Rouge mesuré | Ce qui a été fait, et pourquoi |
|---|---|---|
| `Sabotages` | depuis le 2026-11-02 (`41473542705`), relancé le 11-07 (`42358983774`) : **2 problèmes** | ⚠️ **Pas** « cinq témoins non rejoués » (l'audit lisait la liste imprimée des témoins jamais vus rouges, qui ne fait pas rougir). Les vraies causes : deux entrées du catalogue périmées. `smoke-destructrice-en-post` cherchait un cas nommé « les treize fonctions… », renommé à chaque sonde ajoutée (« seize » au 11-07) : le titre porte désormais « chaque fonction… », le compte reste dans l'assertion. `avis-l215-html-brut` visait un échappement déménagé dans `billing-mail-layout.ts` par `cf7bc5aa` (2026-11-03) : recible. `68b37c10` n'y touchait pas. Les deux vus rouges sous sabotage et verts sans (`--only=`). |
| `Mutation` | vert le 2026-11-06 (`42237865948`) après un rouge le 11-04 | **Seuil `break: 99` et périmètre GARDÉS, jugés tenables.** Mesure : 99,48 %, 384 / 386, run de 95 s. Le rouge du 11-04 disait vrai (30 survivants, logique de facturation entrée avec des assertions faibles), fermé en deux jours par 25 assertions, aucun mutant exclu. Élargir le périmètre sous le même seuil global laisserait des fichiers neufs compenser une dégradation du périmètre argent : un élargissement se fera par une seconde configuration avec son propre seuil, mesuré. ⚠️ Marge : 99 % de 386 admet 3 non tués, 2 sont pris par les équivalents nommés dans `stryker.config.mjs` ; un 4ᵉ équivalent irréductible rouvre cette décision, il ne relève pas le seuil. |
| `Posture` | voir `SECURITY.md` § AM-5 | trois hausses réelles relues, mig. `247`, référence recalée par écrit |
| `Secrets age` | voir `SECURITY.md` § Rotation des secrets | rouge vrai, attend deux gestes d'Axel : décision jusqu'au 2026-11-21 |

### V18.2 · règles React Compiler différées (2026-11-08, DEP-01)

`eslint-plugin-react-hooks` 5 → 7 ajoute 14 règles au preset `recommended`. Mesure sur `94e1665e` :
7 à zéro violation, gardées au niveau du preset (cliquet) ; 7 qui rougissent, **134 erreurs dans
90 fichiers** de `src/`. Décision écrite dans `eslint.config.js` (`REACT_COMPILER_DIFFEREES`) :

| Règle | Violations | Niveau |
|---|---|---|
| `set-state-in-effect` | 81 | `off` |
| `refs` | 33 | `off` |
| `purity`, `preserve-manual-memoization` | 6 chacune | `warn` |
| `immutability` | 5 | `warn` |
| `globals` (deux tests) | 2 | `warn` |
| `static-components` (`Layout.tsx`) | 1 | `warn` |

`rules-of-hooks` (erreur) et `exhaustive-deps` (avertissement) n'ont pas bougé.

**Suite ouverte** : lire d'abord `static-components` et `immutability`, qui peuvent cacher un état
remis à zéro à chaque rendu. Puis corriger les petites règles et les repasser en `error` une à une.
Pour `set-state-in-effect` et `refs`, mesurer et corriger module par module. ❌ Une règle tenue à
zéro ne rejoint jamais cette liste.

### Boucle locale : `npm run test:changed` (vague 2.4, DEV-01)

La suite complète prend 54 min sur le poste de dev (4 cœurs, 8 Go). `test:changed`
(`scripts/test-changed.mjs`) prend les fichiers modifiés depuis la base de fusion avec
`origin/main` (commits locaux, arbre de travail, non suivis) et joue :

1. `vitest related` sur les sources JS/TS modifiées : tout test qui les importe, et les tests
   modifiés eux-mêmes ;
2. tout test qui **nomme** un fichier modifié (chemin, ou nom de fichier pour un workflow, un
   `.md`, un `.sql`) : les gardes qui lisent un fichier par `readFileSync` échappent au graphe.

`--base <ref>` change la référence, `--liste` montre la sélection sans rien lancer. Base illisible
(pas de `git fetch`) = échec, jamais « rien à tester ». Lockfile, `vitest.config.ts` ou
`src/test/setup.ts` modifiés : le script le signale et conseille `npm test`. Il ne passe aucune
option de parallélisme : `maxWorkers: 2` reste celui de `vitest.config.ts` (C-47).
Témoin : `scripts/test-changed.test.mjs`.

La boucle d'une session : `lint`, `typecheck`, `test:changed`, push ; puis le verdict du noyau
sur son commit (`gh run watch`). La boucle locale ne juge rien : le noyau joue tout.

### `edge-deploy-drift.yml` · le code déployé contre le dépôt *(ajouté le 2026-09-04, finding C-35)*

`npm run check:edge` télécharge le bundle de **chaque Edge Function réellement déployée** et le
compare octet pour octet à `supabase/functions/`, dans les deux sens, modules `_shared/` importés
compris. Quotidien à 05:41 UTC **et** à chaque push touchant `supabase/functions/` : une dérive de
déploiement naît d'un déploiement, qui n'événemente rien ici, pas d'un commit.

Ce que ça a fermé : le 2026-09-03, les trois sources en ligne divergeaient toutes les trois de
`main`. Rien ne regardait, donc rien n'avait jamais rien dit.

- 🔴 **Secret absent = échec.** Pas de `if: secrets.X != ''`, pas de valeur de repli, pas de
  `continue-on-error`. La règle est écrite dans `CLAUDE.md` et a déjà été violée deux fois.
- `.github/edge-deploy.json` déclare quelle fonction du dépôt n'est **pas encore** en ligne, avec sa
  raison et sa date. ❌ Il ne couvre que l'existence : aucune divergence de contenu ne peut être
  éteinte depuis ce fichier, et une fonction qu'il dit non déployée alors qu'elle est en ligne fait
  échouer la garde.
- **Témoin** : `scripts/check-edge-deploy.guard.test.mjs`, 18 cas, ramassés par `npm test` et
  rejoués par le job en `always()`. Vérifiés en sabotant le comparateur **cinq fois** : comparateur
  qui ne trouve jamais rien (6 rouges), comparateur borgne (1), lecture vide acceptée comme
  « identique » (2), secret absent dégradé en `::warning::` + exit 0 (1), normalisation trop polie
  (2). Un témoin qu'on n'a pas vu échouer n'est pas un témoin.
- ⚠️ **Le lecteur n'a pas encore tourné** : `supabase functions download` exige un
  `SUPABASE_ACCESS_TOKEN`, absent de la machine de développement. Le premier run de CI est la
  vérification. `assertReadSomething()` refuse un bundle vide ou sans entrypoint reconnaissable :
  une lecture ratée est une **erreur**, jamais un « identique au dépôt ».
- Runbook deploy/rollback : [`DEPLOYMENT.md`](./DEPLOYMENT.md).

✅ **Les trois gardes qui attendaient un geste manuel mesurent toutes** (relu le 2026-10-20) :
`check:supabase-posture` a sa référence d'auth depuis le 2026-10-10 (`C-88`), `check:env` a
`VERCEL_TOKEN` / `VERCEL_PROJECT_ID` depuis le 2026-10-09 (`C-105`), et CodeQL est à 0 alerte
depuis le 2026-10-16 (`C-89`). Ce paragraphe a dit le contraire jusqu'au 2026-10-20. Descendu de
`scripts/CLAUDE.md` le 2026-11-06 ; CodeQL n'est plus à 0 depuis (`faille.md`).

## Checklist avant push prod

Avant `git push` sur `main` (qui déclenche le deploy Vercel) :

1. ✅ `npm run lint` → **0 erreurs** (les warnings préexistants sont OK)
2. ✅ `npm run test:changed` → les tests liés au diff passent. La suite complète (`npm test`)
   est jouée par le noyau CI, bloquant ; en local seulement si la configuration de test a bougé.
3. ✅ `npm run build` → succès. Aucun chunk first-paint > **150 kB gzip** (sauf `vendor-charts` lazy attendu).
4. ✅ `npm run test:e2e` → **joué par la CI après le push, pas en local** (règle du 2026-10-29,
   `CLAUDE.md` § Git). En local seulement sur demande d'Axel ou pour une spec modifiée.
   **190 tests** sur 23 specs et 3 projects (96 chromium,
   87 mobile-safari, 7 supabase-stub — mesure du 2026-09-05, cf. § Playwright),
   3 skip attendus (gestes tactiles sur chromium). Ports **3000** (démo) et
   **3210** (`e2e-stub`) — vérifier qu'aucun dev server périmé ne les squatte.
   ⚠️ Le 3210 refuse volontairement de réutiliser un serveur existant : une
   collision doit échouer, pas passer en mesurant la mauvaise app.
   ❌ Ne pas recopier ce nombre : le remesurer avec `npx playwright test --list`.
5. ✅ **Smoke test mobile preview** 375×812 : login démo → Dashboard, créer/compléter une tâche (clic + swipe droit), navigation Tab bar, rien caché derrière la MobileTabBar.
6. ✅ **Si touche `recordKRCompletion()`** : vérifier le graphique dashboard en démo ET en prod.
7. ✅ **Si touche un modal** : drag-to-close, ESC, clic backdrop.
8. ✅ **Si touche un popover** : clipping (overflow parents), z-index vs sidebar+tabbar, position au resize/scroll.
9. ✅ **Si touche un tutoriel** : desktop ET mobile (flags distincts), vérifier que les `data-tutorial-id` existent.
10. ✅ **Si touche une page nouvelle** : `min-h-[100dvh]` + `pb-[calc(...)]` + landmark `<main>` (A-5) + h1 visible.
11. ✅ **Si touche `supabase/migration/*.sql`** : checklist [`SECURITY.md`](./SECURITY.md). Vérifier `mcp__supabase__get_advisors`.
12. ✅ **Si touche `supabase/functions/*.ts`** : présence de `supabase/config.toml` (M-10), puis
    **déployer** (`supabase functions deploy <slug>`), car un correctif committé et non déployé est
    exactement le finding C-35. `npm run check:edge` le dira, mais après coup.
13. ✅ **Si touche un `<button>` icon-only, un `<input>`, ou ajoute une page publique** : relancer le scan a11y (Critical = 0).
14. ✅ **Si suspicion de bug iOS Safari** : tester avec `?debug=1` (Eruda).

---

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

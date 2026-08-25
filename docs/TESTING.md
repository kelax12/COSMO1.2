# Tests — COSMO

## Note de tests / CI : 80 → 83 → **88 / 100** (2026-08-24 → 2026-08-25 soir)

| Ce qui compose la note | 08-24 | 08-25 (16 h) | **08-25 (fin)** |
|---|---|---|---|
| Suite unitaire | 1 583 / 143, verte | 1 656 / 146, verte | **1 736 / 151, verte** |
| Tests E2E Playwright | 41 × 2, 11 specs | **62 × 2 = 124, 15 specs** | inchangé |
| Tests d'intégration RLS (base réelle) | 5 fichiers | **6** · dont `org-permissions.test.ts` | inchangé |
| Jobs CI | 4 | **5** (+ `lighthouse`) | inchangé |
| Gardes-cliquets | 6 | 6 | 6 |
| `npm run test:coverage` | ✅ verte | 🔴 **ROUGE**, 3 seuils | ✅ **VERTE**, `exit 0` |
| Glob `supabase.repository.ts` (statements) | — | 63,74 % (seuil 65) | **76,79 %** (seuil remonté à 74) |

**+5 après la campagne de tests du soir.** La gate de couverture est repassée au vert **sans
qu'aucun seuil ne soit baissé**, ce qui était la seule sortie acceptable : 115 tests ajoutés, tous
sur la cible que la gate désignait elle-même.

Ce qui monte la note tient en deux points, et le second compte plus que le premier :

1. **Le chemin de déploiement est rouvert** : `lint-test-build` ne bloque plus.
2. **Le gain est verrouillé.** Le cliquet du glob `supabase.repository.ts` a été **remonté** de
   65 à 74 (statements) et de 55 à 90 (functions), à ~2 points sous le mesuré. Un repository livré
   sans test fera désormais tomber cette gate **bien avant** de bouger le plancher global : elle
   mord sur 1 663 statements, pas sur 21 557.

**Ce qui plafonne à 88, et pas plus haut** : la couverture absolue reste à ~27 %, les seuils
Lighthouse sont toujours provisoires, et la marge du plancher global `functions` n'est que de
**0,32 point, soit une vingtaine de fonctions**, l'équivalent d'UN composant d'interface un peu
gros. Le piège est désamorcé, il n'est pas démonté.

Et l'acquis du milieu de journée tient toujours : pour la première fois, une brique entreprise
(les permissions, mig. 115) est arrivée **avec son test d'intégration contre une vraie base dans
le même commit**, 337 lignes qui vérifient la policy, pas la relecture de la policy. C'est le
standard à tenir pour toute nouvelle surface d'autorisation.

### ✅ `npm run test:coverage` · verte au 2026-08-25 (fin de journée)

```
lines      26,96 %  >= 26 %     functions   21,32 %  >= 21 %
statements 26,65 %  >= 26 %     branches    22,75 %  >= 22 %
glob src/modules/**/supabase.repository.ts : 90,55 L / 76,79 S / 93,00 F / 65,89 B
```

**Comment on y est arrivé : 115 tests, 5 fichiers, aucun seuil touché vers le bas.**

| Fichier ajouté | Ce qu'il couvre | Effet (statements) |
|---|---|---|
| `team-categories/supabase.repository.test.ts` | 13 tests · le SEUL repository du dépôt sans aucun test | **3 % → 88 %** |
| `friends/supabase.repository.sharing.test.ts` | 25 tests · les 12 méthodes non testées (retrait de demande, partage de listes, modèle de lecture) | **40 % → 76 %** |
| `organizations/supabase.repository.invitations.test.ts` | 19 tests · invitations nominatives, avis de retrait, opérations irréversibles | **64 % → 82 %** |
| `okrs/supabase.repository.read.test.ts` | 13 tests · lectures ciblées et repli JSONB | **49 % → 63 %** |
| `events/supabase.repository.window.test.ts` | 10 tests · lectures par fenêtre et agenda managérial (mig. 077) | **54 % → 83 %** |

**Ces tests n'ont pas été écrits pour le chiffre.** Chacun asserte la **chaîne envoyée à
PostgREST**, pas la valeur retournée : les colonnes du `select`, les `eq` de défense en
profondeur, les plafonds de lecture, la whitelist des `insert` et `update`. C'est ce qui en fait
des gardes de sécurité plutôt que des tests de mapping. Un mapping qui change en silence n'est pas
grave ; un filtre `user_id` qui disparaît en silence l'est.

Trois exemples de ce qui est désormais verrouillé, et ne l'était pas ce matin :

- **`cancelFriendRequest` fait un `DELETE`, jamais un `UPDATE`.** Le statut `rejected` est réservé
  au destinataire par le `WITH CHECK` de la mig. 049, et `cancelled` n'existe pas dans la
  contrainte `CHECK` de la table. C'est cette contradiction qui laissait la demande collée dans la
  liste. Le test échoue si quelqu'un « simplifie » en repassant à un statut.
- **`getWindowForUser` vise le `user_id` DEMANDÉ, pas celui de l'appelant.** C'est le seul chemin
  de lecture du dépôt qui cible volontairement les données de quelqu'un d'autre. La RLS refuserait
  une cible non gérée, mais elle ne peut pas rattraper un filtre qui vise la mauvaise personne
  **autorisée**.
- **Un rôle de partage inconnu retombe sur `viewer`.** Le défaut doit être le moins permissif ; un
  repli sur `editor` donnerait le droit d'écriture par accident.

**Les seuils ont été REMONTÉS, pas laissés en place.** C'est la règle du fichier
(`vitest.config.ts`) : on ne baisse jamais, et on remonte après un gain. Le glob
`supabase.repository.ts` passe de 65/55/65/35 à **88 L / 90 F / 74 S / 63 B**, soit ~2 points sous
le mesuré. Le plancher global `branches` passe de 21 à 22. Les trois autres planchers globaux
**n'ont pas bougé, et c'est délibéré** : leurs marges sont de 0,96 / 0,65 / 0,32 point. Les recaler
au mesuré réarmerait dès cette semaine le piège qu'on vient de désamorcer.

### Ce qu'était le problème (2026-08-25, milieu de journée)

```
functions  20,65 %  < 21 %      statements  25,65 %  < 26 %
src/modules/**/supabase.repository.ts  63,74 %  < 65 %
```

**Ce n'était pas une régression de qualité, c'était une régression de RATIO**, et la nuance a
décidé du correctif. La couverture absolue n'avait pas baissé : 73 tests avaient été ajoutés dans
la journée. C'est le dénominateur qui avait explosé, avec environ **2 000 lignes d'interface et de
hooks non testés** (`MemberPermissionsSheet` 310, `PyramidNodeCard` 516, `useOrgInboxRealtime` 131,
`useFriendsInboxRealtime` 123), pendant que les 205 tests de `permissions.ts` couvraient la partie
**pure**, la seule facile à tester.

Le seuil `lines` était d'ailleurs repassé au vert **tout seul** dans la soirée (25,94 % → 26,02 %),
grâce aux tests de tarification annuelle. C'était déjà l'argument contre la baisse de seuil : il a
suffi d'une soirée de travail normal pour en récupérer un.

**Deux sorties existaient, une seule était acceptable.** Baisser les seuils de 0,05 point remettait
au vert en trente secondes, et vidait le cliquet de son sens, puisque c'est précisément son rôle
d'attraper une vague de code non testé. C'est la seconde qui a été prise.

> ℹ️ **Trois mesures dans la journée, et c'est ce qui rend le constat solide** (lines /
> functions / statements / repository) :
>
> | Mesure | Contexte | Résultat |
> |---|---|---|
> | midi | une session concurrente modifiait `src/modules/habits/`, un test rouge | 25,95 / 20,50 / 25,58 / 63,71 |
> | après-midi | travail terminé, 1 621 tests verts | 25,94 / 20,53 / 25,59 / 63,74 |
> | soir | 1 656 tests verts, tarification annuelle livrée | 26,02 / 20,65 / 25,65 / 63,74 |
> | **fin de journée** | **1 736 tests verts, 115 tests de repository ajoutés** | ✅ **26,96 / 21,32 / 26,65 / 76,79** |
>
> Le rouge n'a jamais dépendu de l'état de l'arbre de travail. Le publier après une seule mesure
> aurait été un pari, pas une mesure, et la troisième a rapporté une information que les deux
> premières ne pouvaient pas donner : **le seuil `lines` se comble tout seul dès qu'on écrit des
> tests normaux.** La quatrième l'a confirmé à l'échelle : une campagne ciblée sur la frontière
> de sécurité a suffi, sans toucher un seul seuil vers le bas.

---

> **Gates ajoutées le 2026-08-07** (audit architecture) :
> - `npm run check:rls` — invariants RLS (`auth.uid()` wrappé, une seule policy
>   PERMISSIVE par rôle+action). **Bloquant en CI.** Cliquet : n'audite que les
>   migrations ≥ 043. A déjà trouvé une violation invisible aux advisors Supabase.
> - `npm run check:drift` — dérive repo ↔ prod. **Pas** une gate CI : demande une
>   introspection live (2 étapes, cf. `docs/DEPLOYMENT.md`). À exécuter avant
>   chaque déploiement comportant une migration.
> - `e2e/rls/get-my-tasks.test.ts` — isolation de la RPC `SECURITY DEFINER`
>   `get_my_tasks`. La RLS ne s'applique PAS dans le corps d'une telle fonction :
>   son périmètre ne tient qu'à sa logique, donc il doit être testé contre une
>   vraie base, pas mocké.
>
> ### ⚠️ La suite était ROUGE en arrivant sur cette passe (2026-08-24, 2ᵉ audit)
> `src/design-system.guard.test.ts` échouait sur `main` (203 > budget 202, et 83 tailles sous
> 11 px pour un plancher de 82). Cause : un badge `text-[10px]` entré dans
> `TeamProjectCard.tsx` APRÈS que le budget ait été posé le matin même. Corrigé (les quatre
> badges du fichier sont passés en `text-caption`, budget abaissé à 199 / 79).
>
> **C'est la deuxième fois dans la même journée que cette garde attrape la même chose au même
> endroit** : le mode entreprise n'a jamais été migré sur l'échelle typographique, il la contourne
> badge par badge. La garde fait son travail ; c'est la migration qui manque.
>
> Leçon opérationnelle : **ne jamais partir du principe que `main` est vert.** Le mesurer d'abord,
> sinon on attribue à ses propres changements un échec préexistant — ou pire, on baisse la garde
> pour « débloquer ».
>
> **Après correctifs : 1576 tests / 142 fichiers, tous verts** (`npm test`, mesuré en local).
>
> **Suite unitaire au 2026-08-24 (1ʳᵉ passe) : 1583 tests / 143 fichiers, tous verts** (`npm test`, mesuré en
> local, ~3 min 10 s — deux fois plus rapide qu'au 2026-08-14 à volume supérieur).
> Un échec est donc une vraie régression, pas un test pré-existant cassé.
>
> **Corrigé le 2026-08-24** — `src/design-system.guard.test.ts` était ROUGE (`205 > budget 203`) :
> la vague entreprise du 2026-08-23/24 avait introduit quatre tailles arbitraires, toutes SOUS le
> plancher de 11 px, dans des fichiers sans système typographique local à préserver
> (`TeamAssigneeGroups.tsx`, `TeamsSection.tsx`, `TeamTasksTab.tsx` ×2). Migrées en `text-caption`,
> puis budget abaissé à **202** et plancher sub-11px à **82** — la règle du fichier est que ces
> nombres ne remontent jamais. Remonter le budget aurait vidé la garde de son sens.
>
> ## Gardes d'architecture — `src/architecture.guard.test.ts` (2026-08-24)
>
> Deux invariants de [`ARCHITECTURE.md`](./ARCHITECTURE.md) n'avaient aucun outil, et les deux
> avaient reculé sans que personne le voie :
>
> | Garde | Forme |
> |---|---|
> | `supabase.from()` uniquement dans un `*.repository.ts` | binaire — 0 violation, et ça doit le rester |
> | Aucun fichier source > 600 lignes | **cliquet** — aucun nouveau dépassement, et le total des 17 fichiers déjà hors budget (13 103 lignes) ne remonte pas |
>
> Le cliquet plutôt qu'un seuil dur : rendre la règle rouge sur les 17 fichiers existants
> produirait une gate rouge en permanence, donc ignorée — exactement le travers que l'audit
> pointe. Un troisième test interdit à la liste `KNOWN_OVERSIZED` de garder un fichier déjà
> assaini, sans quoi un découpage libérerait de la place pour un futur dépassement.
>
> ⚠️ Les commentaires sont retirés avant la recherche de `supabase.from(`. Sans ça, la phrase qui
> **explique** la règle la déclenchait. Une garde qui se mord la queue finit désactivée.
>
> ## Gardes ajoutées par le 2ᵉ audit (2026-08-24)
>
> | Garde | Fichier | Ce qu'elle empêche |
> |---|---|---|
> | Effacement RGPD des tables symétriques | `src/rgpd-erasure.guard.test.ts` | Qu'une table où le compte supprimé apparaît dans une SECONDE colonne (`friends`, `friend_requests`, `shared_tasks`) retombe dans la boucle générique `user_id`. C'est arrivé trois fois, dont une avec l'email en clair |
> | Échelle z-index fermée | `src/design-system.guard.test.ts` | Qu'un composant réinvente sa valeur. La table publiée listait 7 paliers pendant que le code en utilisait 16 |
> | Mouvement des feuilles | `src/design-system.guard.test.ts` | Qu'une nouvelle feuille écrive `y: '100%'` à la main. Sous `prefers-reduced-motion`, ça peut l'ouvrir 100 % sous l'écran — mesuré, pas supposé |
> | Chemin d'accès entreprise | `src/modules/team-projects/supabase.repository.test.ts` | Un retour à `.from('team_tasks')`, qui réintroduirait le `Seq Scan` + CTE par ligne sans aucun symptôme avant la montée en charge |
>
> Les trois premières sont des **cliquets** : le stock existant est toléré et ne peut que baisser.
> Une gate rouge en permanence finit ignorée — c'est la règle du dossier.
>
> ## Gardes de migration — tester la garde, pas seulement le code (2026-08-24)
>
> `scripts/migration-guards.test.mjs` — **10 tests**. Deux findings sécurité du 2026-08-24 (B-1 et
> B-3 de [`../faille.md`](../faille.md)) sont passés parce que la règle qu'ils enfreignaient ne
> vivait que dans un Markdown. Les gardes ajoutées ce jour-là ne valent que si elles échouent
> vraiment sur la régression qu'elles prétendent attraper : **une garde qu'on n'a jamais vue rouge
> est une intention, pas une garde.**
>
> Chaque cas construit un jeu de migrations minimal dans un dossier temporaire et exécute le script
> réel avec ce dossier comme `cwd` — le script tel qu'il tourne en CI, ni mocké ni ré-implémenté.
>
> ## Tester ce que l'utilisateur obtient, pas ce que le code écrit (2026-08-24)
>
> `src/modules/auth/demo-profile.test.ts` — 10 tests. Ils existent à cause d'un bug qu'aucune
> suite ne pouvait attraper : en mode démo, modifier son profil écrivait dans une clé
> `localStorage` que plus rien ne relisait. Pas d'exception, pas de log — un **succès silencieux**.
> Le seul test qui existait alors vérifiait… que l'écriture atteignait bien cette clé morte.
>
> D'où la forme de ces tests : ils assertent sur `buildDemoUser()`, c'est-à-dire **la valeur que
> l'écran lit**, jamais sur le fait qu'un `setItem` a eu lieu. Un test qui vérifie l'écriture
> valide le mécanisme ; seul un test qui vérifie la lecture valide le résultat.
> Sont couverts, pour les deux sens : la régression détectée, le correctif accepté, le
> re-`GRANT` qui annule un `REVOKE`, le `REVOKE … FROM PUBLIC` qui **ne compte pas** (leçon de la
> mig. `094b`), la réparation par une migration ultérieure, et le cliquet qui ne juge pas
> l'historique.
>
> ## Audit de couverture — 2026-08-14 (⚠️ PÉRIMÉ, cf. encadré)
>
> > 🔴 **Rouverte le 2026-08-25** : la gate est de nouveau rouge, pour une raison **différente**,
> > non plus des seuils posés au-dessus du réel, mais une vague de code non testé qui a fait
> > baisser le ratio sous des seuils, eux, correctement calibrés. Cf. l'encadré en tête de fichier.
> > Le raisonnement ci-dessous reste valide et explique pourquoi on ne baisse PAS les seuils.
>
> > ✅ **Résolu au 2026-08-24 : `npm run test:coverage` ne signalait AUCUNE violation de
> > seuil.** La section ci-dessous décrit l'état d'AVANT la recalibration du 2026-08-18
> > (`functions` 45 → 21, `branches` 60 → 21, `lines`/`statements` 10 → 26, posés au réel mesuré).
> > Elle est conservée pour le raisonnement — « un seuil au-dessus du mesuré ne protège de rien, il
> > casse la CI en continu et rend muettes les gates utiles du même job » —, pas comme état courant.
> > **Ne pas la lire comme un problème ouvert.**
>
> **La gate était rouge par construction, pas par régression.** Les seuils globaux se donnent une
> règle explicite dans `vitest.config.ts` : « posé **sous** le réel mesuré […] à remonter au fil
> des phases (**jamais au-dessus du mesuré courant**) ». Deux d'entre eux la violent :
>
> | Seuil global | Valeur exigée | Réel mesuré | Verdict |
> |---|---|---|---|
> | `lines` | 10 % | **27,0 %** | ✅ conforme à la règle |
> | `statements` | 10 % | **26,4 %** | ✅ conforme |
> | `functions` | **45 %** | **21,4 %** | ❌ posé 2× au-dessus du réel |
> | `branches` | **60 %** | **21,6 %** | ❌ posé 3× au-dessus du réel |
>
> Les seuils par fichier, eux, sont proches de leur cible — sauf un décrochage net :
>
> | Fichier | Exigé | Mesuré |
> |---|---|---|
> | `src/modules/**/mappers.ts` | 95 % statements | 94 % (à 1 point) |
> | `src/modules/**/supabase.repository.ts` | 65 % statements | 58,7 % |
> | `src/lib/avatar-upload.ts` | **100 %** lines | **61 %** (fonctions : 40 %) |
> | `src/lib/hooks/useDebounce.ts` | 80 % branches | 41 % |
> | `src/modules/tasks/hooks.derived.ts` | 85 % branches | 56,5 % |
>
> **Diagnostic** : la couverture réelle (~26 %) n'a pas chuté ; ce sont `functions` et `branches`
> qui ont été fixés à un niveau ambitionné plutôt que mesuré, et `avatar-upload.ts` qui a perdu
> ses tests après la pose d'un seuil à 100 %.
>
> **Deux façons de repasser au vert, et elles ne se valent pas** :
> 1. **Aligner les deux seuils globaux sur le réel** (functions 20, branches 20) et les remonter
>    par paliers. Rétablit la CI en 5 minutes et respecte enfin la règle que le fichier énonce.
> 2. Écrire les tests manquants. C'est le bon objectif de fond, mais passer de 21 % à 45 % de
>    fonctions couvertes n'est pas un correctif de CI, c'est un chantier.
>
> Faire (1) maintenant et (2) ensuite. Une gate rouge en permanence ne protège plus de rien : elle
> apprend à ignorer le rouge.
>
> **Priorité de test, si on écrit des tests** : les repositories Supabase (frontière de sécurité
> anti-mass-assignment, à 58,7 %) et `avatar-upload.ts` (validation MIME + redimensionnement, qui
> neutralise les SVG piégés — à 40 % de fonctions couvertes).

> 🔴 **`npm run test:coverage` échoue (exit 1) sur `main`** — mesuré le 2026-08-14.
> Les tests unitaires passent (à l'exception du cliquet design-system ci-dessus) ; ce sont les **seuils** qui ne sont pas atteints : 13 erreurs,
> dont 2 globales (functions 21,43 % < 45 %, branches 21,62 % < 60 %) et 11 par fichier
> (`avatar-upload.ts`, `supabase.repository.ts`, `mappers.ts`, `hooks.derived.ts`,
> `app-mode.store.ts`, `useDebounce.ts`, `i18n/locale.ts`, `i18n/routes.ts`).
> Couverture globale réelle : **statements 26,4 % · branches 21,6 % · functions 21,4 % · lines 27,0 %**.
> Conséquence : le job CI `lint-test-build` est rouge tant que ce n'est pas traité —
> **ne pas conclure d'un échec de `test:coverage` que ta modification l'a cassé**, mesure la baseline d'abord.

## Vitest — tests unitaires de logique métier pure

Config `vitest.config.ts` (séparée de `vite.config.ts`), environnement `node`. Les tests vivent **à côté** du code testé (`*.test.ts`).

```bash
npm test           # run once (utilisé en CI, bloquant)
npm run test:watch # mode watch
npm run test:coverage # + couverture v8 (seuils par fichier — bloquant CI)
```

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

**62 tests × 2 projects = 124** (`chromium` = Desktop Chrome, `mobile-safari` =
iPhone 12), répartis sur **15 specs** (au 2026-08-25 ; 41 × 2 sur 11 specs au
2026-08-14). Les 3 tests de `demo-touch-gestures.spec.ts` sont `skip` sur
chromium (viewport ≥ 768 px). La CI ne joue que le project `chromium`.

Les 4 specs ajoutées couvrent le mode entreprise, arrivé jusque-là sans E2E :
`demo-entreprise-dependencies` (9), `demo-entreprise-tasks-tab` (5),
`demo-entreprise-session-fixes` (5), `demo-entreprise-okr-modal` (2).

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

## CI (`.github/workflows/ci.yml`, 5 jobs)

- `lint-test-build` — lint, `tsc -b`, `validate:migrations`, `check:rls`,
  `i18n:check`, `test:coverage` (seuils par fichier), build.
  🔴 **Rouge au 2026-08-25**, cf. l'encadré de couverture en tête de fichier.
- `audit` — `npm audit --omit=dev --audit-level=high` (bloque sur CVE prod)
- `e2e` — Playwright, project `chromium` uniquement
- `rls-integration` — stack Supabase locale (`supabase start`), rejoue **toutes**
  les migrations sur base vierge (`scripts/apply-migrations.mjs`) puis `npm run test:rls`
- `lighthouse` *(ajouté le 2026-08-25)*, `lighthouserc.json`, LCP / TBT / CLS / a11y / SEO sur
  les 4 routes **prérendues** (`/`, `/guide`, `/blog`, `/pour-freelances`). Bloquant sur a11y,
  SEO et CLS ; **avertissement** sur la performance, qui varie avec le runner.
  ⚠️ **Seuils provisoires** : Lighthouse a besoin d'un Chrome exécutable, absent de la machine de
  développement, ils n'ont donc pas pu être posés « au réel mesuré » comme tous les autres budgets
  du dépôt. **À resserrer après le premier run réel**, un budget très au-dessus du réel ne mesure
  rien.
- `concurrency` annule les runs obsolètes, `permissions: contents:read`. Dépendances : `.github/dependabot.yml`.
- Runbook deploy/rollback : [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Checklist avant push prod

Avant `git push` sur `main` (qui déclenche le deploy Vercel) :

1. ✅ `npm run lint` → **0 erreurs** (les warnings préexistants sont OK)
2. ✅ `npm test` → **tous les tests unitaires Vitest passent** (bloquant CI)
3. ✅ `npm run build` → succès. Aucun chunk first-paint > **150 kB gzip** (sauf `vendor-charts` lazy attendu).
4. ✅ `npm run test:e2e` → **124 tests** (62 × 2 projects), 3 skip attendus
   (gestes tactiles sur chromium). Port 3000 — vérifier qu'aucun dev server
   périmé ne le squatte (`reuseExistingServer`).
5. ✅ **Smoke test mobile preview** 375×812 : login démo → Dashboard, créer/compléter une tâche (clic + swipe droit), navigation Tab bar, rien caché derrière la MobileTabBar.
6. ✅ **Si touche `recordKRCompletion()`** : vérifier le graphique dashboard en démo ET en prod.
7. ✅ **Si touche un modal** : drag-to-close, ESC, clic backdrop.
8. ✅ **Si touche un popover** : clipping (overflow parents), z-index vs sidebar+tabbar, position au resize/scroll.
9. ✅ **Si touche un tutoriel** : desktop ET mobile (flags distincts), vérifier que les `data-tutorial-id` existent.
10. ✅ **Si touche une page nouvelle** : `min-h-[100dvh]` + `pb-[calc(...)]` + landmark `<main>` (A-5) + h1 visible.
11. ✅ **Si touche `supabase/migration/*.sql`** : checklist [`SECURITY.md`](./SECURITY.md). Vérifier `mcp__supabase__get_advisors`.
12. ✅ **Si touche `supabase/functions/*.ts`** : présence de `supabase/config.toml` (M-10).
13. ✅ **Si touche un `<button>` icon-only, un `<input>`, ou ajoute une page publique** : relancer le scan a11y (Critical = 0).
14. ✅ **Si suspicion de bug iOS Safari** : tester avec `?debug=1` (Eruda).

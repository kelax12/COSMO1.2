> ⚠️ **ARCHIVE : récits, mesures et tableaux datés, extraits de `docs/TESTING.md` le 2026-11-13 (DOC-02), non maintenus.**
> Chaque bloc décrit l'état **à sa date**. Les règles vivantes sont dans [`docs/TESTING.md`](../TESTING.md). Texte repris
> **sans une coupe** ; le titre de chaque bloc dit d'où il vient. Le code et la production font foi contre ce fichier.

# TESTING · journal (extraits du 2026-11-13)

---
## Couverture · mesure CI du 2026-11-09 par dossier d'écrans

| Dossier | Mesure CI du 2026-11-09 (L / S / F / B) | Plancher posé |
|---|---|---|
| `src/components/**` | 36,20 / 35,04 / 26,82 / 32,13 | 35,5 / 34,5 / 26,5 / 31,5 |
| `src/pages/**` | 32,03 / 30,83 / 24,98 / 23,89 | 31,5 / 30,5 / 24,5 / 23,5 |

## Suites de contrat · divergences trouvées au premier passage (V12.2)

| Cas | Côté fautif | Suite donnée |
|---|---|---|
| priorité 6 ou négative acceptée | démo | démo corrigée (0 à 5, comme `createTaskSchema`) |
| catégorie d'entreprise : doublon de fratrie rendu au lieu d'être refusé | démo | démo corrigée (index partiels de la mig. 148) |
| catégorie d'entreprise : boucle, cycle et profondeur non gardés | démo | démo corrigée (trigger `enforce_team_category_tree`) |
| tâche sans priorité (0), défaut de la fiche, refusée par la base | dépôt (mig. 001) | `PAR-01`, **corrigée** par la mig. `249` (CHECK 0 à 5), cas verts des deux côtés. ⚠️ La production l'acceptait déjà : relue au catalogue le 2026-11-09, elle n'avait AUCUN CHECK de priorité (dérive hors dépôt), donc aussi 6 ou -4 |
| tâche sans échéance (`''` → NULL), refusée par la base | dépôt (mig. 001) | `PAR-02`, **corrigée** par la mig. `249` (`deadline` nullable). La production était déjà nullable (même dérive) ; décision d'Axel du 2026-11-09 : l'échéance reste facultative, comme la priorité |
| KR d'équipe créés en un lot relus dans un ordre aléatoire (même `created_at`, départage par UUID) | production | `PAR-03`, **corrigée** : `SupabaseTeamOKRsRepository.create` pose un `created_at` par KR du lot (le cas pose six KR : un ordre juste par hasard une fois sur 720) |
| habitude : fréquence hors `daily` / `weekly` / `monthly` acceptée | démo | démo corrigée (CHECK `habits_frequency_check`, mig. 002) |
| habitude : jour de cochage non réel (`demain`, `2026-02-30`) accepté | démo | démo corrigée (format et existence du jour, `toggle_habit_completion_v2`) |
| agenda : fin avant début acceptée | démo | démo corrigée (CHECK `end_after_start`, mig. 004) |
| agenda : récurrence hors énumération acceptée | démo | démo corrigée (CHECK `events_recurrence_check`, mig. 030) |
| agenda : `recurrence`, `recurrenceDays`, `exceptions`, `isPrivate`, `reviewDismissedAt` absents à la relecture | démo | démo corrigée (défauts de colonnes que `mapEventFromDb` rend) |
| agenda : lectures dans l'ordre de saisie au lieu de `start_time` (croissant ; `getPage` décroissant) | démo | démo corrigée |
| agenda : supprimer un identifiant inconnu levait `not_found` | démo | démo corrigée (le `DELETE` de la base ne lève rien : zéro ligne) |

## Playwright · WebKit absent du poste de développement (2026-09-05)

> 🔴 **WebKit n'était PAS installé sur le poste de développement** (constaté le
> 2026-09-05 : `Executable doesn't exist at …\webkit-2336`). Tout ce qui a été
> annoncé comme « joué localement » sur `mobile-safari` depuis la création de ce
> project ne l'avait donc **jamais** été — la moitié mobile de chaque chiffre de
> ce fichier venait de la CI, ou de nulle part. Installé depuis.

## Project `supabase-stub` · préalable de chauffe, récit et mesures (2026-09-08 et 2026-09-11)

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

## TST-03 · première exécution du 2026-11-06, trois écarts entre base rejouée et application

- 🔴 **Première exécution (2026-11-06) : trois écarts entre une base REJOUÉE et l'application**, consignés
  en `test.fixme` dans `e2e/real/schema-drift.spec.ts` : `tasks.deadline` NOT NULL, `tasks.priority` limitée à
  1..5 (l'écran envoie `null` et `0`), `friend_requests.user_id` NOT NULL (l'insertion de l'app ne l'envoie
  pas). La production a très probablement été assouplie hors migration (à confirmer par `\d tasks` et
  `\d friend_requests`) ; une base reconstruite depuis le dépôt refuse ces écritures. Les parcours « tâche »
  et « partage » posent donc leur tâche et l'amitié en préalable. Correctif : une migration, puis retirer `fixme`.

## mobile-safari · triage de `a11y-keyboard-audit` (C-118), six specs rendues adaptatives, décompte des specs entreprise

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

## Règle des 7 jours · première mesure du 2026-11-07, décisions `Sabotages` et `Mutation`

**Première mesure, 2026-11-07** : `restore-drill` rouge depuis 22 j (aucun exercice réussi
depuis le 2026-09-01, le run manuel du 10-15 refusé faute de confirmation, aucun run planifié en
octobre) et `Secrets age` depuis au moins 11 j ; `Posture` rouge depuis le 2026-10-30 à 11:18,
juste sous le seuil.

## Règle des 7 jours · décisions du 2026-11-07, lignes `Sabotages` et `Mutation`

| `Sabotages` | depuis le 2026-11-02 (`41473542705`), relancé le 11-07 (`42358983774`) : **2 problèmes** | ⚠️ **Pas** « cinq témoins non rejoués » (l'audit lisait la liste imprimée des témoins jamais vus rouges, qui ne fait pas rougir). Les vraies causes : deux entrées du catalogue périmées. `smoke-destructrice-en-post` cherchait un cas nommé « les treize fonctions… », renommé à chaque sonde ajoutée (« seize » au 11-07) : le titre porte désormais « chaque fonction… », le compte reste dans l'assertion. `avis-l215-html-brut` visait un échappement déménagé dans `billing-mail-layout.ts` par `cf7bc5aa` (2026-11-03) : recible. `68b37c10` n'y touchait pas. Les deux vus rouges sous sabotage et verts sans (`--only=`). |
| `Mutation` | vert le 2026-11-06 (`42237865948`) après un rouge le 11-04 | **Seuil `break: 99` et périmètre GARDÉS, jugés tenables.** Mesure : 99,48 %, 384 / 386, run de 95 s. Le rouge du 11-04 disait vrai (30 survivants, logique de facturation entrée avec des assertions faibles), fermé en deux jours par 25 assertions, aucun mutant exclu. Élargir le périmètre sous le même seuil global laisserait des fichiers neufs compenser une dégradation du périmètre argent : un élargissement se fera par une seconde configuration avec son propre seuil, mesuré. ⚠️ Marge : 99 % de 386 admet 3 non tués, 2 sont pris par les équivalents nommés dans `stryker.config.mjs` ; un 4ᵉ équivalent irréductible rouvre cette décision, il ne relève pas le seuil. |

## V18.2 · tableau des violations par règle React Compiler (2026-11-08)

| Règle | Violations | Niveau |
|---|---|---|
| `set-state-in-effect` | 81 | `off` |
| `refs` | 33 | `off` |
| `purity`, `preserve-manual-memoization` | 6 chacune | `warn` |
| `immutability` | 5 | `warn` |
| `globals` (deux tests) | 2 | `warn` |
| `static-components` (`Layout.tsx`) | 1 | `warn` |


## `edge-deploy-drift.yml` · ce que ça a fermé (2026-09-03)

Ce que ça a fermé : le 2026-09-03, les trois sources en ligne divergeaient toutes les trois de
`main`. Rien ne regardait, donc rien n'avait jamais rien dit.

## `edge-deploy-drift.yml` · témoin, sabotages du comparateur, lecteur non encore exécuté, gardes à geste manuel (2026-10-20)

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


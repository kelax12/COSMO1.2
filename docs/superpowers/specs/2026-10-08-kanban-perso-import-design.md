# Tâches perso : Statut, État, vue Tableau, conversion de sous-tâche, import · design

Statut : validé avec Axel le 2026-10-08, **implémenté le 2026-10-09** (mig. `214` appliquée, ledger
`20261008210323`). Archivable.
Origine : liste des 50 améliorations du 2026-10-08, points 4, 10 et 44. Le point 11 (corbeille
perso) a été écarté par Axel pendant la conception.

## 1. Statut et État des tâches perso, vue Tableau (point 4)

### Problème

Une tâche perso est « à faire » ou « terminée » (`tasks.completed`, booléen). Rien ne distingue ce
qui avance de ce qui n'a jamais commencé, ni ce qui est bloqué. Le mode entreprise a les deux
notions depuis longtemps : le **Statut** (mig. `091`, colonnes du Kanban) et l'**État** (mig. `204`,
pastille Dans les temps / À risque / En difficulté). Les tâches perso n'ont ni l'un ni l'autre, ni
vue Kanban.

### Décisions

- **Statut perso à QUATRE valeurs** : `todo`, `in_progress`, `blocked`, `done`. Pas de `review` :
  retiré par Axel, la relecture n'a pas de sens pour une personne seule.
- **État** : `on_track`, `at_risk`, `off_track`, ou `NULL`. Même vocabulaire et mêmes couleurs que
  l'entreprise (`HEALTH_DOT`). « Atteint » n'est pas une valeur : c'est `completed`.

### Base · migration `214` (numéro à confirmer contre le ledger au moment de l'écrire)

- `tasks.status TEXT NOT NULL DEFAULT 'todo'`, `CHECK (status IN ('todo','in_progress','blocked','done'))`.
  Un `CHECK` et non un `ENUM`, pour la même raison que la `091`.
- `tasks.health TEXT`, `CHECK (health IS NULL OR health IN ('on_track','at_risk','off_track'))`.
- Reprise : `status = 'done'` là où `completed = true`. On ne devine jamais `in_progress`.
- Trigger `BEFORE INSERT OR UPDATE`, **`SECURITY INVOKER`**, `REVOKE` pour `anon`, miroir de
  `sync_team_task_status` (`091`) :
  - `completed` passe à `true` → `status = 'done'` ;
  - `completed` passe à `false` alors que `status = 'done'` → `status = 'todo'` ;
  - `status` passe à `done` → `completed = true` ;
  - `status` quitte `done` → `completed = false`.
  Le traitement de `completed_at` suit exactement ce que fait `toggle_task_complete_v2` (relu au
  catalogue avant d'écrire).
- **Aucune policy nouvelle** : les deux colonnes relèvent de la policy UPDATE existante
  (propriétaire, ou collaborateur `editor` ayant accepté). `get_my_tasks` et
  `get_pending_shared_tasks` sont `SETOF public.tasks` et rendent les colonnes d'office.
- ⚠️ À vérifier au catalogue AVANT d'écrire : privilèges de colonnes sur `tasks`
  (leçon de la mig. `083`), corps vivant de `toggle_task_complete_v2` (l'occurrence générée doit
  naître en `todo`, sans `health`).
- Application : preuve jouée en prod dans un bloc `DO` qui finit par `RAISE EXCEPTION`, acteur par
  acteur, puis **feu vert d'Axel**, puis `apply_migration`, puis relecture au catalogue. La migration
  passe AVANT le front qui écrit `status` / `health`.

### Règle de bascule vers « Terminée »

Glisser une carte **vers** `done` passe par `toggleComplete` (RPC `toggle_task_complete_v2`), jamais
par un `update({ status: 'done' })` : seule la RPC génère l'occurrence suivante d'une tâche
récurrente (`src/modules/tasks/CLAUDE.md`). Les autres déplacements, y compris **hors** de `done`,
sont un `update({ status })` ; le trigger remet `completed` d'accord.

### Front

- **Modèle** : `Task.status` et `Task.health` (types `TaskStatus` étendu, `TaskHealth`), mappers,
  whitelist `mapTaskToDb`, schéma zod. Le repository local (démo) applique la même synchronisation
  statut ↔ terminé que le trigger, testée.
  ⚠️ `TaskStatus` existe déjà comme type DÉRIVÉ (`'todo' | 'completed'`, faille B6) : le renommer ou
  le remplacer sans casser ses lecteurs.
- **Vue Tableau** : bascule Liste / Tableau dans l'en-tête de la page Tâches, mémorisée par appareil
  (`localStorage` via `safeParse`). Les filtres existants (recherche, liste active, catégories,
  filtres rapides) s'appliquent aux deux vues.
  - Quatre colonnes, vides comprises. « Terminée » montre les tâches complétées dans les 7 derniers
    jours, quel que soit le réglage « afficher les terminées » de la vue Liste.
  - Ordinateur : glisser-déposer natif HTML5, comme `TeamProjectsKanban`.
  - Mobile : colonnes en défilement horizontal aimanté ; une carte se déplace par une action
    « Déplacer vers… » (le glisser HTML5 ne fonctionne pas au doigt).
  - Carte : nom, pastille de catégorie, échéance (rouge si en retard), priorité, pastille d'État
    cliquable. Un clic ouvre la fiche existante.
  - « + » en tête de colonne : crée une tâche née dans ce statut.
  - Tâche partagée en lecture seule : pas de glisser, et la carte le dit au survol.
- **Fiche tâche** (bureau et mobile) : champs Statut et État **en édition**, enregistrés à chaque
  choix comme la checklist. À la création, une tâche naît `todo` (sauf depuis le « + » d'une
  colonne). Précisé au plan : `useTaskModal.ts` est à 577 lignes pour un plafond de 600.
- **Vue Liste** : étiquette « En cours » / « Bloquée » quand le statut n'est ni `todo` ni `done`,
  pastille d'État quand elle est posée.
- **Fichiers** : nouveau dossier `src/components/task-board/`. `TaskTable.tsx` est à 599 lignes et
  `TasksPage.tsx` à 558 pour un plafond de 600 (`architecture.guard`) : on n'y ajoute que le
  branchement.
- i18n `fr` et `en` pour tout libellé.

## 2. Transformer une sous-tâche en tâche (point 10)

- Dans `SubtaskChecklist`, chaque sous-tâche **non cochée** porte l'action « Convertir en tâche ».
- La nouvelle tâche prend le nom de la sous-tâche, la catégorie et la priorité de la tâche parente,
  sans échéance, statut `todo`.
- La sous-tâche est retirée de la parente.
- Un seul toast « Annuler » défait les deux écritures : suppression de la tâche créée, remise de la
  sous-tâche à sa place (même `id`, même position).
- Tâches perso uniquement : les sous-tâches d'équipe vivent dans une autre table (mig. `092`).
- Si la création échoue, la sous-tâche n'est pas retirée (création d'abord, retrait ensuite).

## 3. Import Todoist, TickTick, Notion (point 44)

### Entrée

Réglages › Données : le bouton « Importer » remplace la mention « bientôt disponible ». Il ouvre une
fenêtre (feuille du bas sur mobile). On choisit un ou plusieurs fichiers `.csv` (5 Mo max chacun).
Les sauvegardes `.zip` de Todoist sont à dézipper avant : pas de dépendance ajoutée pour ça.

### Lecture CSV

Analyseur maison, pur et testé : BOM, champs entre guillemets, retours à la ligne dans un champ,
séparateur `,` `;` ou tabulation détecté sur l'en-tête.

### Reconnaissance du format et correspondances

Toutes les sources produisent la même forme intermédiaire : nom, description, échéance (jour),
priorité COSMO, terminée, chemin de catégorie, sous-tâches, récurrence.

| Source | Reconnue par | Correspondances |
|---|---|---|
| **Todoist** | en-tête `TYPE,CONTENT,…` | Nom du fichier → catégorie. `section` → sous-catégorie. `INDENT ≥ 2` → sous-tâche de la tâche au-dessus. `note` → ajoutée à la description de la tâche au-dessus. `@étiquettes` retirées du nom, recopiées dans la description. `PRIORITY` : 1 = p1 la plus haute → COSMO 1, 2 → 2, 3 → 3, 4 (sans priorité) → priorité par défaut de COSMO. `DATE` / `DEADLINE` : dates absolues lues en `en` et `fr` ; « every day / week / month » et équivalents français → récurrence ; texte illisible recopié dans la description |
| **TickTick** | ligne d'en-tête contenant `Folder Name`, `List Name` et `Title`, après des lignes de métadonnées | Dossier → catégorie, liste → sous-catégorie (liste seule si pas de dossier). `parentId` → sous-tâche. Contenu de checklist → sous-tâches. `Status` 1 ou 2 → terminée. `Priority` 5 → 1, 3 → 2, 1 → 4, 0 → défaut. `Due Date` lue aux formats `2006-01-02T15:04:05-0700`, `2006-01-02 15:04:05`, `…Z`. `Repeat` `FREQ=DAILY|WEEKLY|MONTHLY` à intervalle 1 → récurrence |
| **Notion et tout autre CSV** | aucun des deux en-têtes ci-dessus | Écran de correspondance des colonnes (titre obligatoire ; description, échéance, catégorie, priorité, terminé facultatifs), pré-rempli d'après les noms d'en-tête `fr` / `en`. Valeurs de priorité textuelles (High / Haute / P1…) et numériques. « Terminé » : Done, Terminé, Complete, Yes, Oui, coché |

### Aperçu, puis exécution

- Aperçu : nombre de tâches, catégories qui seront créées, lignes ignorées avec leur raison, case
  « inclure les tâches terminées » décochée par défaut.
- Une catégorie existante est reprise par son nom (casse et accents ignorés) sous le même parent ;
  sinon elle est créée.
- Création par lots de 4 en parallèle, barre de progression, plafond de 2 000 tâches par import.
  Une ligne qui échoue n'arrête pas l'import : elle est listée à la fin.
- À la fin : « Annuler l'import » supprime les tâches créées, puis les catégories créées par
  l'import si elles sont restées vides.
- Fonctionne aussi en mode démo (repository local).
- Pas de migration.

## Erreurs et cas limites

- Fichier vide, illisible ou sans colonne titre : message clair, rien n'est créé.
- Échéance illisible : tâche importée sans échéance, texte d'origine en description.
- Déplacement de carte refusé par le serveur (tâche partagée en lecture seule) : la carte revient à
  sa colonne et l'erreur passe par `normalizeApiError`, jamais par une sous-chaîne de message.
- Hors ligne : les écritures échouent comme aujourd'hui (pas de file d'attente).

## Tests

- Vitest : analyseur CSV, chaque adaptateur de format (fichiers exemples), lecture des dates,
  correspondance des priorités, plan de catégories, exécuteur d'import et son annulation (faux
  repositories), synchronisation statut ↔ terminé du repository local, conversion de sous-tâche et
  son annulation, regroupement en colonnes.
- SQL : preuve de la migration en bloc `DO` terminé par `RAISE EXCEPTION`, acteur par acteur
  (propriétaire, collaborateur `editor`, collaborateur `viewer`, inconnu), plus une passe témoin.
- Navigateur : parcours vérifié en démo (Tableau, glisser, Déplacer vers…, conversion, import des
  trois formats).
- Gardes globales avant push : `architecture.guard`, `i18n:check`, `i18n:scan`, `check:bundle`.

## Hors périmètre

Corbeille perso (point 11, écarté), statut « En relecture » perso, glisser au doigt sur mobile,
lecture des `.zip`, import d'étiquettes comme objets (COSMO n'en a pas), import des agendas.

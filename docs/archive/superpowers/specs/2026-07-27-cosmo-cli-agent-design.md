> ⚠️ **ARCHIVE — plan/spec exécuté, instantané du 2026-07-27, non maintenu.**
> Le code livré fait foi, pas ce document. Sources vivantes :
> [`CLAUDE.md`](../../../../CLAUDE.md) · [`docs/`](../../../README.md).

# Design — Accès agent aux données COSMO (CLI local)

> Date : 2026-07-27 · Statut : validé, prêt pour plan d'implémentation

## 1. Objectif

Permettre à Claude Code, depuis ce dépôt sur le PC d'Axel, de **lire** les données
COSMO réelles d'Axel (tâches, habitudes, agenda, OKR) et d'en **écrire** une partie
(créer une tâche, cocher une tâche, marquer une habitude faite), afin de servir
d'assistant d'organisation personnelle.

Ce n'est **pas** la V3 (orchestration humains + agents). C'est une brique locale,
volontairement minimale, mais dont la couche métier est conçue pour devenir plus
tard la surface de tools d'un serveur MCP.

### Hors périmètre (explicite)

- Aucune suppression de quoi que ce soit (tâche, habitude, événement, OKR).
- Aucune écriture sur les OKR / Key Results.
- Aucun accès depuis claude.ai ou mobile (nécessiterait un serveur MCP distant hébergé).
- Aucun changement du comportement de l'app elle-même (`src/`), ni du mode démo.

## 2. Contexte technique établi

| Fait | Valeur |
|---|---|
| Projet Supabase cible | `cosmo test` — id `ykeugqfgklejcdbrmawy`, `ACTIVE_HEALTHY`, eu-west-1 |
| URL API | `https://ykeugqfgklejcdbrmawy.supabase.co` |
| Auth du compte d'Axel | **Google uniquement** — pas de mot de passe |
| `.env` racine | `VITE_SUPABASE_URL` vide **volontairement** → app locale en mode démo |
| Colonnes `tasks` | `id, name, priority, category, deadline, estimated_time, created_at, updated_at, bookmarked, completed, completed_at, subtasks, kr_id, recurrence, is_collaborative, pending_invites, user_id` |
| ESLint | ne lint que `**/*.{ts,tsx}` → des scripts `.mjs` n'impactent pas `npm run lint` |
| `.gitignore` | couvre `.env`, `.env.local`, `.env.production` — **pas** `.env.cosmo-cli` |

### Approches écartées

- **MCP Supabase déjà branché** : les appels `execute_sql` sont refusés par le
  classifieur de permissions de la session ; et ce MCP est un accès admin qui
  **contourne la RLS** sur toute la base. Disproportionné pour un usage quotidien.
- **Serveur MCP distant hébergé** : marcherait depuis mobile, mais impose
  hébergement + OAuth + gestion de secrets. Prématuré ; c'est la brique 1 de la V3.

## 3. Architecture

```
scripts/cosmo/
├── client.mjs    # client Supabase (URL + clé publishable) + storage de session + refresh auto
├── login.mjs     # lancé PAR AXEL uniquement : OTP email → session persistée
├── api.mjs       # couche métier pure, sans I/O console  ← future surface des tools MCP
├── cli.mjs       # parsing d'arguments + rendu humain + --json
└── api.test.mjs  # tests Vitest, client mocké, aucun appel réseau
```

**Flux** : `cli.mjs` → `api.mjs` → `client.mjs` → PostgREST → **RLS filtre sur `auth.uid()`**.

Aucune écriture n'emprunte de chemin privilégié. Le script est authentifié comme
l'utilisateur Axel, avec la clé **publishable/anon** (celle déjà exposée au
navigateur). La `service_role` n'est utilisée nulle part — c'est un garde-fou du
projet.

### Frontières des modules

- `client.mjs` — ne connaît que l'auth et le transport. N'a aucune notion de tâche.
- `api.mjs` — ne connaît que le domaine. Reçoit un client, ne lit pas `process.env`,
  n'écrit pas sur stdout, ne lit pas `process.argv`. Chaque fonction retourne des
  données ou lève une erreur typée. **C'est la seule couche qu'un serveur MCP
  réutilisera** : chaque fonction exportée correspond à un futur tool.
- `cli.mjs` — ne connaît que la présentation et les arguments. Aucune requête directe.

## 4. Opérations exposées

| Module | Lecture | Écriture |
|---|---|---|
| Tâches | lister + filtrer (échéance, catégorie, priorité, terminées) | **créer**, **cocher terminée** |
| Habitudes | état du jour | **marquer faite** |
| Agenda | événements à venir | — lecture seule |
| OKR | objectifs + Key Results | — lecture seule |

### Contrat d'écriture des tâches

Le type `Task` rend `priority`, `category`, `deadline` et `estimatedTime` non-optionnels.
Le CLI doit donc appliquer des défauts explicites plutôt que d'envoyer des `null` :

| Champ | Défaut si non fourni |
|---|---|
| `priority` | `3` (milieu de l'échelle) |
| `category` | première catégorie existante de l'utilisateur, sinon erreur explicite |
| `deadline` | aujourd'hui, en date locale `en-CA` |
| `estimated_time` | `30` (minutes) |
| `bookmarked`, `completed` | `false` |
| `recurrence` | `'none'` |
| `user_id` | posé côté serveur depuis `auth.uid()` — jamais envoyé par le client |

« Cocher une tâche » écrit **`completed: true` ET `completed_at`** (date locale `en-CA`).
Ne poser que `completed` fausserait les statistiques et le dashboard.

### Justification des restrictions d'écriture

1. **Aucune suppression.** Créer et cocher sont réversibles ; supprimer ne l'est pas.
   La suppression reste un geste humain dans l'app.
2. **OKR en lecture seule.** Faire progresser un KR impose d'insérer atomiquement
   une ligne dans le journal append-only `kr_completions` (sinon le graphique
   « KR réalisés » du dashboard reste à 0 en production). Cette logique vit déjà
   dans deux repositories du dépôt ; la dupliquer dans un script est une dette qui
   casse en silence. La lecture des KR suffit pour rattacher une tâche via `kr_id`.
3. **Habitudes** : l'écriture se fait sur `completions: Record<string, boolean>`,
   le champ canonique. Jamais `completedDates` (garde-fou B5 du projet).

## 5. Auth & secrets

### Configuration

Nouveau fichier **`.env.cosmo-cli`** à la racine :

```
COSMO_SUPABASE_URL=
COSMO_SUPABASE_ANON_KEY=
```

- **Doit être ajouté à `.gitignore`** dans le même commit que sa création. Le
  `.gitignore` actuel ne le couvre pas — sans cet ajout il serait committé.
- **Fichier séparé du `.env` racine, délibérément** : `VITE_SUPABASE_URL` y est vide
  pour maintenir l'app locale en mode démo. Le remplir ferait taper `npm run dev`
  dans la base réelle. Le `.env` racine n'est pas modifié.
- URL et clé publishable sont récupérables via le MCP Supabase
  (`get_project_url` vérifié OK, `get_publishable_keys` à confirmer). Si
  `get_publishable_keys` est bloqué par le classifieur, Axel colle la clé lui-même
  — c'est un détour de 30 secondes, pas un changement de design.

### Session

- Stockée dans `C:\Users\Axel\.cosmo\session.json`, **hors du dépôt**, donc
  non committable par accident.
- `client.mjs` fournit un storage adapter custom à `supabase-js`
  (`persistSession: true`, `autoRefreshToken: true`) qui lit/écrit ce fichier.
- Le fichier contient un access token et un refresh token. Il n'a jamais vocation
  à entrer dans le dépôt ni dans un log.

### Login — procédure OTP

Le compte d'Axel étant **Google uniquement**, il n'y a pas de mot de passe :

1. Axel lance `npm run cosmo:login` **dans son propre terminal**.
2. Le script demande son email et appelle `signInWithOtp({ email, options: { shouldCreateUser: false } })`.
   `shouldCreateUser: false` est obligatoire : il empêche la création silencieuse
   d'un compte en cas de faute de frappe dans l'email.
3. Axel saisit le code reçu par email ; le script appelle `verifyOtp` et persiste la session.

**Règles fermes :**

- Claude ne lance **jamais** `login.mjs` et ne demande **jamais** de mot de passe,
  de code OTP ni de jeton. Claude n'utilise que les jetons déjà présents dans le
  fichier de session.
- Si la session est expirée ou le refresh token révoqué, le CLI s'arrête avec
  « session expirée, relance `npm run cosmo:login` ». Aucune tentative de
  ré-authentification automatique.

**Risque identifié à lever en début d'implémentation** : l'OTP email suppose que le
provider Email est activé sur le projet Supabase. Si seul Google est activé,
`signInWithOtp` échouera. À vérifier avant d'écrire `login.mjs` ; le repli est
d'activer le provider Email dans la config Supabase.

## 6. Erreurs

- `api.mjs` lève des erreurs typées (`CosmoAuthError`, `CosmoNotFoundError`,
  `CosmoValidationError`). Il n'écrit rien sur stdout.
- `cli.mjs` les rattrape → message lisible sur stderr + code de sortie 1.
- **Aucun `toast`** : garde-fou du projet, les toasts ne sortent jamais de l'UI.
- Chaque commande d'écriture accepte `--dry-run`.
- Après une écriture réelle, le CLI **ré-affiche la ligne telle que la base l'a
  renvoyée**, pas la charge utile envoyée. Ça rend visible toute transformation
  serveur (defaults, triggers, normalisation).
- `--json` sur toutes les commandes, pour que Claude parse une structure au lieu de
  deviner du texte formaté.

## 7. Tests

Vitest, client Supabase mocké, **aucun appel réseau**.

1. **Test anti-dérive de schéma** — lit `TASK_LIST_COLUMNS` dans
   `src/modules/tasks/supabase.repository.ts` et vérifie que la liste de colonnes du
   script correspond. Sans lui, l'ajout d'une colonne dans l'app fait diverger le CLI
   en silence. C'est le filet de sécurité qui rend acceptable la duplication décrite
   en §8.
2. **Format de date** — les dates produites suivent la convention date locale `en-CA`
   déjà en vigueur dans le projet (classe de bugs timezone déjà éradiquée).
3. **Forme des habitudes** — l'écriture cible bien `completions: Record<string, boolean>`.
4. **Erreurs** — session absente et session expirée produisent `CosmoAuthError`.

### État des tests avant travaux

⚠️ **3 tests échouent déjà sur `main`** (modules listes + team-stats), sans rapport
avec ce chantier. Ils ne doivent pas être imputés à cette implémentation. La
référence est l'état de `main` au commit `d1a0a94`.

## 8. Dettes assumées

- **Duplication des noms de colonnes** entre le `.mjs` du script et le TypeScript de
  `src/`. Choisi pour éviter d'introduire une chaîne de compilation TS dans les
  scripts. Le test anti-dérive (§7.1) est la contrepartie explicite — il n'annule pas
  la dette, il la rend bruyante.
- **Mono-utilisateur.** Le CLI suppose une seule session, celle d'Axel. Pas de
  multi-comptes, pas de sélection d'utilisateur.

## 9. Critères de succès

- `npm run cosmo -- tasks list` affiche les vraies tâches d'Axel depuis Supabase.
- `npm run cosmo -- tasks add "..." --deadline ... ` crée une tâche visible dans
  l'app COSMO déployée, avec le bon `user_id` posé par la RLS.
- `npm run cosmo -- habits today`, `agenda`, `okr` retournent des données réelles.
- `npm run lint` et `npm run typecheck` : 0 erreur.
- `npm test` : aucune régression au-delà des 3 échecs préexistants de `main`.
- `git status` : `.env.cosmo-cli` ignoré, `~/.cosmo/session.json` hors du dépôt.

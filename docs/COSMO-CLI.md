# CLI COSMO

**Quand lire** : avant tout appel à `npm run cosmo` ou toute modification de `scripts/cosmo/`. **Fait foi** : `scripts/cosmo/cli.mjs` et `scripts/cosmo/api.mjs`. Mémo court pour ajouter une tâche : [`AGENT-AJOUTER-TACHE.md`](./AGENT-AJOUTER-TACHE.md).

Le CLI lit les tâches, habitudes, agenda et OKR du VRAI compte d'Axel (production), et écrit sur les tâches seulement. Session d'Axel, RLS comme dans le navigateur, jamais `service_role`.

## Règles non négociables

- 🔴 Quoter toute valeur contenant des espaces, ou passer par `--input '<json>'` (forme à préférer) : sans guillemets, le shell tronque la valeur au premier mot et colle le reste au nom de la tâche. Le CLI refuse ce cas.
- 🔴 `tasks list` ne renvoie pas `description` (liste allégée, parité avec l'app, `TASK_COLUMNS`). Ce n'est pas un échec d'écriture : relire avec `tasks show <id>` ou `tasks list --full`.
- 🔴 Ne JAMAIS lancer `npm run cosmo:login` : interactif, attend un code reçu par email. Session expirée (`CosmoAuthError : Session COSMO absente ou expiree.`) : demander à Axel de le lancer.
- 🔴 Ne JAMAIS écrire via le MCP Supabase : `execute_sql` contourne la RLS. Le CLI est le seul chemin d'écriture.
- 🔴 `tasks delete <id> --confirm` est la seule opération sans retour du CLI : confirmer avec Axel avant toute suppression qu'il n'a pas explicitement désignée. Vérifier la cible avec `--dry-run`.
- ❌ Aucune écriture OKR : faire progresser un KR impose une insertion atomique dans le journal append-only `kr_completions`, et la dupliquer casserait le graphique « KR réalisés ».
- ❌ Aucune suppression d'habitude ni d'événement ; aucun `service_role`.
- ❌ Ne jamais écrire `user_id` : posé côté serveur depuis `auth.uid()`.

## Mise en route (faite par Axel)

1. `.env.cosmo-cli` à la racine (gitignoré), distinct de `.env` (dont `VITE_SUPABASE_URL` reste vide pour garder `npm run dev` en démo) :

   ```
   COSMO_SUPABASE_URL=https://ykeugqfgklejcdbrmawy.supabase.co
   COSMO_SUPABASE_ANON_KEY=<cle publishable>
   ```

2. `npm run cosmo:login` : compte Google-only, vérification par email. Le script accepte un code OTP (le template Magic Link doit contenir `{{ .Token }}`) ou le lien « Log In » collé tel quel (template par défaut, `{{ .ConfirmationURL }}`).
3. ⚠️ Un lien se copie sans le cliquer (appui long, « Copier l'adresse ») : l'ouvrir le consomme.
4. ⚠️ Le provider Email doit être activé dans Supabase (`Authentication → Providers → Email`), sinon `signInWithOtp` échoue.

Session : `~/.cosmo/session.json` (hors dépôt, jetons d'accès, jamais committée), rafraîchie toute seule. `requireSession` distingue une panne réseau (« Reseau indisponible, session conservee, reessaie ») d'une session morte. Relogin seulement si le refresh token est révoqué (changement de mot de passe, déconnexion globale, expiration réglée dans `Authentication → Sessions`).

## Commandes

Tâches (lecture et écriture) :

| Commande | Effet |
|---|---|
| `npm run cosmo -- tasks list` | Tâches non terminées |
| `npm run cosmo -- tasks list --all` | Toutes |
| `npm run cosmo -- tasks list --full` | Avec `description` |
| `npm run cosmo -- tasks show <id>` | Détail complet |
| `npm run cosmo -- tasks add "<nom>" --category Perso` | Crée |
| `npm run cosmo -- tasks update <id> --priority 5 --time 90` | Modifie |
| `npm run cosmo -- tasks done <id>` | Coche |
| `npm run cosmo -- tasks reopen <id>` | Ré-ouvre |
| `npm run cosmo -- tasks delete <id> --confirm` | Supprime définitivement |

Champs de `update` : `--name`, `--priority` (1 = très basse, 5 = critique), `--category`, `--deadline` (`""` efface), `--time`, `--bookmark` / `--no-bookmark`.

Autres domaines :

| Commande | Effet |
|---|---|
| `npm run cosmo -- categories` | Catégories valides |
| `npm run cosmo -- habits today` | Habitudes et état du jour |
| `npm run cosmo -- habits done <id>` | Marque faite (idempotent) |
| `npm run cosmo -- agenda --days 7` | Événements à venir |
| `npm run cosmo -- okr` | OKR (lecture seule) |
| `npm run cosmo -- okr --kr <okrId>` | Key results d'un OKR |

`--json` sur toute commande, `--dry-run` sur toute écriture.

Entrée JSON (forme robuste pour un agent) :

```bash
npm run cosmo -- tasks add --input '{"name":"Ma tache","description":"Contexte multi-mots."}'
npm run cosmo -- tasks update <id> --input '{"description":"Nouveau contexte"}'
npm run cosmo -- tasks add --input -    # lit le JSON sur stdin
```

## Contraintes d'implémentation

Chacune est couverte par un test dans `scripts/cosmo/*.test.mjs`.

- 🔴 Habitudes : passer par la RPC `toggle_habit_completion`, jamais `SELECT completions` puis `UPDATE` (course entre appareils). La RPC bascule : `markHabitDone` lit l'état avant d'appeler, sinon un second appel décoche.
- 🔴 Agenda : la policy RLS de `events` expose aussi l'agenda des membres d'équipe ; `listUpcomingEvents` filtre explicitement sur `user_id`.
- 🔴 `TASK_COLUMNS` duplique `TASK_LIST_COLUMNS` du repository applicatif ; un test anti-dérive lit la source. Test rouge : corriger `TASK_COLUMNS`, pas le test.
- ❌ Dates : `toLocaleDateString('en-CA')`, jamais `toISOString().slice(0, 10)` (décale d'un jour en soirée).
- ✅ `api.mjs` reçoit un client en paramètre, ne lit ni `process.env` ni `process.argv`, n'écrit pas sur stdout : c'est la couche qu'un futur serveur MCP réutilisera.

## Fichiers

`scripts/cosmo/` : `errors.mjs` (erreurs typées), `client.mjs` (auth, transport), `login.mjs` (OTP, lancé par l'utilisateur seulement), `api.mjs` (domaine pur), `cli.mjs` (arguments, rendu, codes de sortie), `*.test.mjs` (Vitest, client mocké, aucun réseau).

Conception : [`archive/superpowers/specs/2026-07-27-cosmo-cli-agent-design.md`](./archive/superpowers/specs/2026-07-27-cosmo-cli-agent-design.md).

## Sécurité

- ❌ Le CLI ne demande ni ne stocke de mot de passe.
- ✅ Vérifier `git status` avant tout commit : `.env.cosmo-cli` est gitignoré.

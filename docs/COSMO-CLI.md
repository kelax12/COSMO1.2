# CLI COSMO — accès agent aux données personnelles

Permet à Claude Code de lire tes tâches / habitudes / agenda / OKR et d'écrire
un sous-ensemble limité, depuis ce dépôt, sur ce PC.

Conception : [`docs/superpowers/specs/2026-07-27-cosmo-cli-agent-design.md`](./superpowers/specs/2026-07-27-cosmo-cli-agent-design.md)

## Mise en route

1. `.env.cosmo-cli` à la racine (gitignoré) :

   ```
   COSMO_SUPABASE_URL=https://ykeugqfgklejcdbrmawy.supabase.co
   COSMO_SUPABASE_ANON_KEY=<cle publishable>
   ```

   Ce fichier est **volontairement distinct du `.env` racine** : celui-ci garde
   `VITE_SUPABASE_URL` vide pour que `npm run dev` reste en mode démo.

2. Se connecter — **à faire toi-même**, Claude ne lance jamais cette commande :

   ```bash
   npm run cosmo:login
   ```

   Le compte étant Google-only, il n'y a pas de mot de passe : la vérification
   passe par email. La session est stockée dans `~/.cosmo/session.json` (hors du
   dépôt) et se rafraîchit toute seule ensuite.

   Le script accepte **deux formes** de vérification, selon le template d'email
   configuré côté Supabase :

   - un **code à 6 chiffres** — nécessite que le template Magic Link contienne
     `{{ .Token }}` ;
   - le **lien « Log In » collé tel quel** — c'est le cas avec le template
     Supabase par défaut, qui n'expose que `{{ .ConfirmationURL }}`.

   > ⚠️ Si tu colles un lien, **copie-le sans le cliquer** (appui long → *Copier
   > l'adresse du lien*). Ouvrir le lien dans un navigateur le consomme : il
   > faudra en redemander un.

   > Prérequis : le provider **Email** doit être activé dans Supabase
   > (*Authentication → Providers → Email*). Sans lui, `signInWithOtp` échoue.

## Commandes

| Commande | Effet |
|---|---|
| `npm run cosmo -- tasks list` | Tâches non terminées |
| `npm run cosmo -- tasks list --all` | Toutes les tâches |
| `npm run cosmo -- tasks add "<nom>" --category Perso` | Crée une tâche |
| `npm run cosmo -- tasks done <id>` | Coche une tâche |
| `npm run cosmo -- habits today` | Habitudes et état du jour |
| `npm run cosmo -- habits done <id>` | Marque une habitude faite (idempotent) |
| `npm run cosmo -- agenda --days 7` | Événements à venir |
| `npm run cosmo -- okr` | OKR (lecture seule) |
| `npm run cosmo -- okr --kr <okrId>` | Key results d'un OKR |

`--json` sur toute commande, `--dry-run` sur toute écriture.

Si la session a expiré, toutes les commandes s'arrêtent sur
`CosmoAuthError : Session COSMO absente ou expiree.` — relancer `npm run cosmo:login`.

## Ce que le CLI ne fait pas, volontairement

- **Aucune suppression.** Créer et cocher sont réversibles, supprimer non.
- **Aucune écriture OKR.** Faire progresser un KR impose une insertion atomique
  dans le journal append-only `kr_completions` ; dupliquer cette logique ici
  casserait silencieusement le graphique « KR réalisés » du dashboard.
- **Aucun accès `service_role`.** Le CLI utilise la clé publishable et ta
  session : la RLS fait le filtrage, exactement comme dans le navigateur.

## Contraintes d'implémentation à respecter

Trois pièges du domaine, encodés dans le code et couverts par des tests :

1. **Habitudes** — la complétion passe par la RPC `toggle_habit_completion`
   (mig. 023, faille TOCTOU-1). Jamais de `SELECT completions` → mutation JS →
   `UPDATE` : un autre appareil peut écrire entre les deux. Et comme la RPC est
   un *toggle*, `markHabitDone` lit l'état avant d'appeler, sinon une seconde
   invocation décocherait l'habitude.
2. **Agenda** — depuis la mig. 077, la policy RLS de `events` expose aussi
   l'agenda des membres de l'équipe. `listUpcomingEvents` filtre donc
   explicitement sur `user_id` ; s'en remettre à la seule RLS mélangerait
   l'agenda perso et celui des collègues.
3. **Colonnes `tasks`** — `TASK_COLUMNS` duplique `TASK_LIST_COLUMNS` du
   repository applicatif. Un test anti-dérive lit le fichier source et casse si
   les deux divergent. Si ce test échoue, corriger `TASK_COLUMNS`, pas le test.

Les dates sont produites via `toLocaleDateString('en-CA')`, convention du
projet — jamais `toISOString().slice(0, 10)`, qui décale d'un jour en soirée.

## Architecture

```
scripts/cosmo/
├── errors.mjs   # erreurs typées, aucune I/O
├── client.mjs   # auth + transport, aucune notion métier
├── login.mjs    # OTP interactif — lancé par l'utilisateur uniquement
├── api.mjs      # domaine pur ← future surface de tools d'un serveur MCP
├── cli.mjs      # arguments, rendu, codes de sortie
└── *.test.mjs   # Vitest, client mocké, aucun appel réseau
```

`api.mjs` reçoit toujours un client en paramètre, ne lit ni `process.env` ni
`process.argv`, et n'écrit rien sur stdout. C'est cette couche, et elle seule,
qu'un futur serveur MCP réutilisera.

## Sécurité

- `~/.cosmo/session.json` contient des jetons d'accès. Hors du dépôt, jamais committé.
- `.env.cosmo-cli` est dans `.gitignore`. Vérifier `git status` avant tout commit.
- Le CLI ne demande jamais de mot de passe et n'en stocke aucun.
- Aucun insert n'émet `user_id` : la colonne est posée côté serveur depuis
  `auth.uid()`, comme la whitelist `mapToDb` de l'app.

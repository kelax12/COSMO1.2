# Ajouter une tâche COSMO

Lire avant d'écrire une tâche dans le vrai compte d'Axel. Fait foi : `scripts/cosmo/cli.mjs`. Règles complètes : [`COSMO-CLI.md`](./COSMO-CLI.md).

## Commande (forme JSON, à préférer)

```bash
npm run cosmo -- tasks add --input '{"name":"Nom de la tache","description":"Contexte detaille, multi-mots.","category":"SEO","priority":4}'
```

Forme à drapeaux : chaque valeur avec espaces entre guillemets.

```bash
npm run cosmo -- tasks add "Nom de la tache" --description "Contexte detaille" --category SEO --priority 4
```

Seul le nom est obligatoire.

| Option | Défaut si omise |
|---|---|
| `--category <nom ou UUID>` | première catégorie par ordre alphabétique |
| `--priority <1-5>` | `3` (1 = très basse, 5 = critique) |
| `--deadline <YYYY-MM-DD>` | aujourd'hui (`""` = pas d'échéance) |
| `--time <minutes>` | `30` |
| `--description <texte>` | vide (le champ « commentaire » de la tâche dans l'app) |

`--json` renvoie la ligne créée avec son `id` ; `--dry-run` vérifie sans écrire.

## Règles

- 🔴 Quoter toute valeur contenant des espaces, ou utiliser `--input` : une prose non quotée est refusée (le shell la tronque et la colle au nom).
- 🔴 `tasks list` ne renvoie pas `description` : ce n'est pas un échec d'écriture. Relire avec `npm run cosmo -- tasks show <id> --json` ou `tasks list --full --json`.
- 🔴 Ne jamais lancer `npm run cosmo:login` (interactif, code reçu par email) : demander à Axel.
- 🔴 Ne jamais écrire via le MCP Supabase (`execute_sql` contourne la RLS, et est bloqué) : le CLI est le seul chemin.
- 🔴 Confirmer avec Axel avant `tasks delete <id> --confirm` (irréversible) sur ce qu'il n'a pas explicitement désigné.
- ❌ Ne jamais écrire `user_id` : posé depuis la session ; la RLS impose `auth.uid() = user_id`.
- ✅ Un nom de catégorie inconnu est refusé avec la liste valide : `tasks.category` stocke un UUID, un nom créerait une tâche orpheline. Ne pas contourner par SQL. Lister : `npm run cosmo -- categories`.

## Échecs

| Message | Action |
|---|---|
| `CosmoAuthError : Session COSMO absente ou expiree` | Demander à Axel de lancer `npm run cosmo:login` |
| `Reseau indisponible` | Réessayer, session intacte |
| `Categorie inconnue` | `npm run cosmo -- categories` |
| `Aucune categorie sur ce compte` | Axel crée une catégorie dans l'app |

## Commandes voisines

```bash
npm run cosmo -- tasks list
npm run cosmo -- tasks update <id> --priority 5
npm run cosmo -- tasks done <id>
npm run cosmo -- tasks reopen <id>
npm run cosmo -- tasks delete <id> --confirm
```

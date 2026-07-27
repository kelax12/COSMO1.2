# Ajouter une tâche COSMO — mémo pour une session Claude

Tu peux écrire dans le vrai compte COSMO d'Axel depuis ce dépôt. Doc complète :
[`docs/COSMO-CLI.md`](./COSMO-CLI.md).

## La commande

```bash
npm run cosmo -- tasks add "Nom de la tache" --category SEO --priority 4 --time 60
```

Toutes les options sont facultatives sauf le nom.

| Option | Défaut si omise |
|---|---|
| `--category <nom ou UUID>` | première catégorie par ordre alphabétique (`marketing`) |
| `--priority <1-5>` | `3` — **1 = très basse, 5 = critique** |
| `--deadline <YYYY-MM-DD>` | aujourd'hui (`""` = pas d'échéance) |
| `--time <minutes>` | `30` |
| `--description <texte>` | vide — c'est le champ « commentaire » visible en ouvrant la tâche dans l'app |

Ajoute `--json` pour récupérer la ligne créée avec son `id`, et `--dry-run`
pour vérifier sans rien écrire.

## Catégories valides

Vérifie-les, ne les devine pas — elles changent :

```bash
npm run cosmo -- categories
```

Au 2026-07-27 : `marketing`, `mobile`, `Perso`, `Produit`, `SEO`.

## Trois pièges à connaître

1. **Un nom de catégorie inconnu est refusé**, avec la liste des valeurs
   possibles. C'est voulu : la colonne `tasks.category` stocke un **UUID**, pas
   un nom. Y écrire un nom crée une tâche orpheline — elle existe en base mais
   n'est rattachée à rien dans l'app. Le CLI résout le nom pour toi ; ne
   contourne pas cette résolution en écrivant en SQL direct.
2. **N'écris jamais `user_id` toi-même.** La policy RLS impose
   `auth.uid() = user_id` et la colonne n'a pas de `DEFAULT` : le CLI le pose
   depuis la session vérifiée. Une valeur venant d'ailleurs est soit rejetée,
   soit une faille.
3. **Ne passe pas par le MCP Supabase pour écrire.** `execute_sql` est bloqué
   par le classifieur de permissions, et il contournerait la RLS de toute façon.
   Le CLI est le bon chemin.

## Si ça échoue

| Message | Cause | Action |
|---|---|---|
| `CosmoAuthError : Session COSMO absente ou expiree` | refresh token révoqué | **Demande à Axel** de lancer `npm run cosmo:login`. Ne lance jamais ce script toi-même, il est interactif et attend un code reçu par email. |
| `Reseau indisponible` | coupure réseau | Réessaie. La session est intacte. |
| `Categorie inconnue` | nom mal orthographié | `npm run cosmo -- categories` |
| `Aucune categorie sur ce compte` | compte sans catégorie | Axel doit en créer une dans l'app |

## Commandes voisines

```bash
npm run cosmo -- tasks list                    # tâches non terminées
npm run cosmo -- tasks update <id> --priority 5
npm run cosmo -- tasks done <id>               # cocher
npm run cosmo -- tasks reopen <id>             # ré-ouvrir
npm run cosmo -- tasks delete <id> --confirm   # IRRÉVERSIBLE
```

`delete` est la seule opération sans retour du CLI, d'où le `--confirm`
obligatoire. Confirme avec Axel avant de supprimer quoi que ce soit qu'il n'a
pas explicitement désigné.

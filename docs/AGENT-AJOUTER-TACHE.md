# Ajouter une tâche COSMO — mémo pour une session Claude

Tu peux écrire dans le vrai compte COSMO d'Axel depuis ce dépôt. Doc complète :
[`docs/COSMO-CLI.md`](./COSMO-CLI.md).

## La commande — préfère la forme JSON

```bash
npm run cosmo -- tasks add --input '{"name":"Nom de la tache","description":"Contexte detaille, multi-mots.","category":"SEO","priority":4}'
```

**C'est la forme recommandée pour un agent.** Un seul argument, aucun risque
que le shell découpe la prose, et une erreur de syntaxe est bruyante.

La forme à drapeaux marche aussi, mais **chaque valeur contenant des espaces
doit être entre guillemets** :

```bash
npm run cosmo -- tasks add "Nom de la tache" --description "Contexte detaille" --category SEO --priority 4
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

## Vérifier une description

`tasks list` **ne renvoie pas** la description : c'est une liste allégée,
alignée sur celle de l'app. Ne conclus pas que l'écriture a échoué. Pour la
relire :

```bash
npm run cosmo -- tasks show <id> --json
```

ou `npm run cosmo -- tasks list --full --json` pour l'avoir sur toute la liste.

## Catégories valides

Vérifie-les, ne les devine pas — elles changent :

```bash
npm run cosmo -- categories
```

Au 2026-07-27 : `marketing`, `mobile`, `Perso`, `Produit`, `SEO`.

## Quatre pièges à connaître

0. **La prose non quotée est refusée.** `--description Contexte complet` sans
   guillemets ne donnait que « Contexte » au drapeau, et « complet » finissait
   collé au *nom* de la tâche — deux champs corrompus en silence. Le CLI refuse
   désormais ce cas et te dit quoi faire. Utilise `--input` en JSON et le
   problème n'existe pas.
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

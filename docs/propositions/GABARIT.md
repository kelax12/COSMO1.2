# Proposition de fonctionnalité · GABARIT

> Règle : [ADR 0013](../adr/0013-validation-d-usage-avant-toute-fonctionnalite-longue.md). Toute
> fonctionnalité de **plus d'une semaine de travail** (une personne, agents compris) s'écrit ici
> **avant le premier commit**. Copier ce fichier en `docs/propositions/AAAA-MM-JJ-sujet.md`, remplir
> les six rubriques, et ne rien laisser entre chevrons.
>
> ❌ Aucun nom, e-mail ni capture d'un utilisateur : le dépôt est public. Écrire « utilisateur 3 »,
> pas son nom.
> ❌ Aucun tiret cadratin (le caractère long) : une virgule, deux points ou un point.
> ✅ Une rubrique sans réponse est une rubrique **vide**, pas « à venir » : la fonctionnalité n'est
> alors pas validée, elle est seulement proposée, et le code ne commence pas.

- **Titre** : <nom court de la fonctionnalité>
- **Auteur** et **date** : <qui, AAAA-MM-JJ>
- **Estimation** : <jours de travail d'une personne, agents compris>
- **Statut** : proposée | validée | en cours | mesurée | retirée

## 1. Problème

<Quel problème, pour qui, dans quelle situation. Une phrase sur ce que la personne fait aujourd'hui
à la place. Pas la solution.>

## 2. Preuve d'usage

<Ce qui existe déjà et qui montre que le problème est réel : demandes reçues (combien, de qui en
termes de profil), abandons observés, contournements, chiffres de `traffic_hits` ou des
compteurs d'acquisition avec leur date. Une préférence supposée n'est pas une preuve.>

## 3. Maquette

<Un écran, pas une description : image ou rendu lié, mobile ET bureau si la fonctionnalité touche
les deux. Dire ce que la maquette ne montre pas.>

## 4. Test auprès de N utilisateurs

- **N** : <au moins 5>
- **Tâche donnée** : <ce qu'on leur a demandé de faire, sans les guider>
- **Réussites sans aide** : <x sur N>
- **Ce qui a bloqué** : <les points qui ont fait hésiter, par fréquence>
- **Ce que le test change à la proposition** : <ajustement, ou abandon>

## 5. Mesure d'activation

- **Action clé** : <le geste qui prouve que la fonctionnalité sert>
- **Part visée** : <x % des utilisateurs exposés, sur quelle période>
- **Comment c'est mesuré** : <source de la donnée, sans script tiers : ADR 0007>
- **Date de lecture** : <AAAA-MM-JJ, fixée maintenant>

## 6. Critère d'abandon

- **Seuil** : <en dessous de x % à la date de lecture, la fonctionnalité est retirée>
- **Ce que le retrait emporte** : <code, tables et migrations, traductions, docs, gardes>
- **Qui décide** : <Axel>

## Décision et suite

<À remplir après le test : go / no-go, et date. À la date de lecture : valeur mesurée, et ce qui a
été fait. La proposition n'est pas supprimée, même retirée.>

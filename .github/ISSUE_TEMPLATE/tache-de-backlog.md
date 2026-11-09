---
name: Tâche de backlog
about: Une tâche du backlog COSMO (bug, dette, épreuve réelle, amélioration, doc). Pas une faille de sécurité, pas une fonctionnalité de plus d'une semaine.
title: ''
labels: backlog
assignees: kelax12
---

<!--
Règle : ADR 0020 et CONTRIBUTING.md (Definition of Done).

DÉPÔT PUBLIC. Ne mettre ici NI faiblesse de sécurité exploitable, NI donnée personnelle,
NI secret ou clé, NI détail d'incident ou de violation. Une faille se signale par SECURITY.md.
Aucun nom, e-mail ni capture d'un utilisateur. Aucun tiret cadratin.

Avant d'envoyer, poser trois étiquettes et un milestone :
  type:     type:bug | type:dette | type:epreuve | type:amelioration | type:doc
  zone:     zone:facturation | zone:entreprise | zone:accessibilite | zone:mobile | zone:base
            | zone:ci | zone:i18n | zone:seo | zone:interface | zone:docs
  priorité: priorite:P1 (avant le premier encaissement ou le prochain déploiement)
            | priorite:P2 (dans le trimestre) | priorite:P3 (quand il y a de la place)
  milestone: Echeance AAAA-MM-JJ (le propriétaire est l'assigné)

Plus d'une semaine de travail pour une fonctionnalité neuve ? Utiliser « Proposition de
fonctionnalité » (ADR 0013), pas ce gabarit.
-->

**Échéance proposée :** AAAA-MM-JJ · **Propriétaire :** · **Taille :** XS | S | M | L

## Constat
<!-- Ce qui est vrai aujourd'hui sur `main`, vérifié : le fichier, le comportement, la mesure datée. -->

## Pourquoi c'est ouvert
<!-- Ce que ça coûte de ne pas le faire, ou ce qui bloque. -->

## Fini quand
<!-- Critères observables, un par case. -->
- [ ] 

## Definition of Done
- [ ] `CI noyau` vert sur le SHA exact poussé
- [ ] Tests du parcours touché (un correctif de bug : le test vu rouge avant)
- [ ] Double mode démo et Supabase
- [ ] Doc d'état à jour dans le même commit, issue fermée par `Closes #N`
- [ ] Revue par une seconde session ou par Axel, si le changement touche la base ou la sécurité

<!-- note-audit: non-note -->
> **Note d'audit** — non noté : c'est un support commercial qui recense ce que fait le code, aucun audit ne le note.

# Mode entreprise : liste des fonctionnalités

Pour les commerciaux. Sert à présenter le mode entreprise et à répondre aux questions en rendez-vous.
Relevé dans le code de `main` le 2026-11-01. Si ce document et le code se contredisent, c'est le code qui a raison.

---

## Démarrer

- Créer une organisation en quelques clics, gratuite jusqu'à 5 membres, sans carte bancaire.
- Assistant de démarrage : premières invitations, première équipe, premier projet.
- Démo entreprise complète, ouverte sans inscription (organisation fictive « Nova Studio »).
- Guide entreprise toujours disponible (bouton flottant) : catalogue d'actions (créer un projet, modifier un rôle…), avec un curseur qui fait la démonstration à l'écran.
- Application en français et en anglais, sur ordinateur et sur mobile.

## Membres et invitations

- Chacun rejoint avec son compte COSMO existant, sans en créer un nouveau. Son espace personnel reste séparé.
- Quatre façons d'inviter : par e-mail, par code, par lien d'invitation, ou parmi ses contacts COSMO.
- Demandes d'adhésion à valider par un admin.
- Accès à durée limitée (par exemple un prestataire pour 30 jours), qui s'arrête tout seul.
- Annuaire des membres : recherche, filtres, actions groupées, export CSV.
- Fiche membre : profil, travail en cours, agenda, statistiques.
- Assistant de départ : transmet les tâches, les responsabilités et les résultats clés de la personne qui s'en va, pour que rien ne reste orphelin.
- Suspension d'un accès sans retirer la personne.
- Transfert de propriété de l'organisation.

## Équipes

- Autant d'équipes que nécessaire. Une personne peut faire partie de plusieurs équipes.
- Une page par équipe : responsable, couleur, description, projets, résultats clés, charge de chaque membre.
- Charge de travail par membre (tâches ouvertes, retards), avec réassignation par glisser-déposer.
- Événements d'équipe : une réunion planifiée arrive dans l'agenda de chaque membre.
- Cloisonnement : deux équipes ne voient pas le travail l'une de l'autre, et cette règle est appliquée par la base de données.
- Supprimer une équipe oblige à transférer ses projets et ses OKR : rien ne devient visible par toute l'entreprise par accident.

## Rôles et permissions

- Deux niveaux : administrateur (tous les droits) et membre.
- 14 droits réglables : créer, modifier ou supprimer des projets ; créer des tâches, modifier ou supprimer celles des autres ; créer ou supprimer des OKR ; créer des équipes ; gérer les catégories ; inviter ; gérer les rôles ; voir les rapports de l'organisation et de toutes les équipes.
- Choix de qui on peut assigner : soi seul ou tout le monde.
- Droits par défaut d'un membre réglables par l'admin (matrice des permissions).
- Ajustement droit par droit, membre par membre.
- Rôles personnalisés : un ensemble de droits avec un nom (par exemple « Chef de projet »), attribuable à plusieurs personnes, éventuellement pour une durée limitée (expiration automatique et notifiée).
- Rôle attribué d'office aux nouveaux arrivants.
- Rôles par projet : responsable, contributeur, lecteur.
- Un admin ne peut pas se retirer ses propres droits par erreur.

## Projets

- Vue liste, kanban, planning (timeline) et portefeuille (statut, responsable et avancement de tous les projets).
- Audience au choix : une équipe ou toute l'entreprise. Un changement d'audience est confirmé à l'écran avec le nom de la nouvelle audience.
- Membres d'un projet et rôles par projet.
- Dépendances entre projets : le portefeuille affiche « bloqué par ».
- Santé d'un projet (en bonne voie, à risque…).
- Modèles de projet et duplication d'un projet avec ses tâches.
- Statuts personnalisés par projet (vos propres colonnes).
- Chat de projet.
- Suivre un projet pour en recevoir les nouvelles.
- Archivage (réversible).
- Catégories d'entreprise hiérarchiques (sous-catégories).

## Tâches

- Toutes les tâches d'équipe de son périmètre réunies dans un seul tableau.
- Cinq statuts : à faire, en cours, en relecture, bloquée, terminée.
- Validation : une tâche en relecture est validée ou renvoyée d'un clic, avec un validateur désigné.
- Plusieurs assignés par tâche, sous-tâches assignées chacune à quelqu'un.
- Dépendances entre tâches et calcul du chemin critique.
- Commentaires avec mentions, notifiées tant qu'elles n'ont pas été lues.
- Historique complet des modifications d'une tâche.
- Actions groupées : assigner, déplacer, changer le statut ou terminer plusieurs tâches à la fois.
- Préréglages de filtre (en retard, cette semaine, bloquées), filtres mémorisés, filtre partageable par lien.
- Listes d'équipe partagées.
- Corbeille de 30 jours : une tâche supprimée se restaure.
- Une tâche assignée apparaît aussi dans le COSMO personnel de la personne.

## Objectifs (OKR)

- Objectif d'organisation décliné en OKR d'équipe, puis en résultats clés chiffrés.
- Contributeurs d'un résultat clé et points d'avancement (check-ins).
- Liaison entre un résultat clé et des projets.
- OKR confidentiels, visibles seulement par leur audience.
- Un résultat clé d'entreprise qu'on porte apparaît aussi dans ses OKR personnels.
- Filtres et vue d'exécution des OKR.

## Pilotage et statistiques

- Aperçu : page d'accueil faite de widgets que chacun dispose à sa façon (mes tâches, échéances, revues à faire, activité de l'équipe…).
- Statistiques par équipe ou pour toute l'entreprise, avec comparaison entre deux périodes.
- Rapports d'activité calculés chaque nuit : tâches terminées, projets et OKR qui ont avancé, événements tenus, détail par personne. Par jour, semaine ou mois. Exportables en PDF.
- Revue hebdomadaire.
- Fil d'activité de l'équipe.
- Recherche globale (Ctrl K) : projets, tâches, objectifs, personnes, en ne montrant que ce que l'on a le droit de voir.

## Notifications

- Boîte de réception et cloche de notifications.
- Réglage type par type : dans l'application ou par e-mail.
- Résumé quotidien par e-mail de ce qui n'a pas été lu.

## Automatisations et intégrations

- Automatisations : « quand une tâche est créée ou change de statut, alors assigner, changer la priorité, changer le statut, ou prévenir quelqu'un ».
- Envoi vers Slack, ou vers votre propre service (webhooks JSON signés). Sans e-mail ni description dans ce qui est envoyé.
- Export CSV complet : projets, tâches, objectifs, équipes, membres.

## Sécurité et gouvernance

- Règles d'accès appliquées dans la base de données : une requête modifiée à la main ne permet pas de les contourner.
- Vie privée : les tâches, habitudes et agenda personnels d'un membre ne sont jamais visibles par l'entreprise.
- Journal d'audit : chaque action de gouvernance (membres, équipes, projets, droits) est enregistrée et conservée un an, consultable et exportable par les admins.
- Domaines vérifiés (par DNS), avec la possibilité de n'accepter que des invitations à ces adresses.
- Double authentification, activée par chaque personne pour son propre compte.
- Données non revendues, suppression de compte réelle, hébergement chez Supabase, conformité RGPD documentée.
- Suppression de l'organisation et départs gérés en libre-service, sans passer par le support.

## Réglages de l'entreprise

- Profil de l'organisation (nom, informations).
- Langue et fuseau horaire des e-mails, semaine de travail, valeurs par défaut.
- Invitations et zone de danger (suppression de l'organisation) regroupées dans Paramètres.

## Tarifs et facturation

Prix TTC par mois, par organisation (et non par personne) :

| Membres | Prix mensuel |
|---|---|
| Jusqu'à 5 | Gratuit |
| 6 à 10 | 70 € |
| 11 à 20 | 150 € |
| 21 à 50 | 350 € |
| 51 à 100 | 700 € |
| Plus de 100 | 1 000 € |

- Paiement annuel : 25 % de remise.
- Toutes les fonctionnalités sont incluses dans tous les paliers, y compris le gratuit.
- Paiement par Stripe, factures et historique dans l'application, contact de facturation modifiable.
- Au-delà de son palier, on ne peut plus inviter tant que le palier n'est pas relevé. Aucun membre n'est jamais retiré, et rien n'est perdu si l'on redescend de palier.
- Droit de rétractation de 14 jours. Résiliation à tout moment, sans remboursement de la période en cours.

## À ne pas promettre

- Le SSO, le SAML et le SCIM n'existent pas.
- Il n'y a plus de grade « manager » : tout passe par les rôles personnalisés. Encadrer quelqu'un ne donne aucun droit sur son travail.
- L'organigramme est masqué en ce moment, même si la page d'accueil entreprise en parle encore.
- La page d'accueil annonce « treize droits ». Le bon chiffre est 14.

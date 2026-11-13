# Gabarits de la procédure de violation

Lire en cas de violation. Fait foi : l'ordre de `RGPD-VIOLATION.md` (hors dépôt). Pièces à copier hors dépôt (dossier privé) et à remplir dans cet ordre.

- 🔴 Fichier PUBLIC : champs vides seulement. ❌ Jamais un fait de violation réelle : ils vont dans le registre privé.
- ✅ `npm run check:exercice-violation` exige que chaque titre `##` ci-dessous existe.

## Chronologie horodatée

À ouvrir **en premier**, avant de contenir. Une ligne par fait, heure UTC **et** heure de Paris.

| Heure UTC | Heure Paris | Fait | Source | Qui |
|---|---|---|---|---|
| _prise de connaissance_ | | | _canal exact (alerte, audit, message)_ | |
| | | _confinement : action_ | | |
| | | _preuves copiées : lesquelles_ | | |
| | | _décision de notification_ | | |
| | | _notification CNIL envoyée_ | | |

## Rappel de l'échéance de 72 h

Dès la ligne « prise de connaissance » écrite, poser **deux rappels datés** dans l'agenda d'Axel :

1. **T + 48 h** : « décision de notification à prendre dans 24 h ». Brouillon prêt, sinon l'écrire.
2. **T + 68 h** : « échéance dans 4 h ». Si rien n'est décidé, notifier quand même avec les motifs.

Échéance = heure de prise de connaissance + 72 h, **écrite en clair** ici :
`prise de connaissance : ____ UTC · échéance : ____ UTC`.

Pourquoi : sans rappel, l'échéance passe sans décision consignée.

## Qualification en six questions

Les six questions du formulaire CNIL, à répondre **par écrit**, même partiellement.

1. Catégories de données concernées :
2. Nombre approximatif de personnes (comptes réels) :
   - dont comptes de test ou internes du responsable de traitement, **à compter à part** :
3. Nombre approximatif d'enregistrements :
4. Conséquences probables pour les personnes :
5. Mesures prises ou proposées :
6. Violation encore en cours ? (oui / non, depuis quand, comment confirmé) :

Rappel : le contenu des tâches est du texte libre, ne jamais le qualifier d'anodin.

## Message aux personnes concernées

À envoyer si le risque est **élevé**. Termes clairs, sans jargon, sans minimiser.

> Objet : Incident de sécurité concernant votre compte COSMO
>
> Le ____ (date), nous avons constaté que ____ (ce qui s'est passé, en une phrase).
> Les informations concernées : ____. Les informations qui ne sont **pas** concernées : ____.
> Ce que cela peut impliquer pour vous : ____.
> Ce que nous avons fait : ____. Ce que vous pouvez faire : ____ (par exemple changer de mot de passe).
> Pour toute question : contact@thecosmo.app.
>
> Nous avons informé la CNIL le ____.

## Message à l'organisation cliente

À envoyer à l'administrateur de chaque organisation dont des données d'entreprise sont concernées :
elle est co-responsable et doit pouvoir notifier de son côté.

> Objet : Incident de sécurité touchant les données de votre organisation sur COSMO
>
> Le ____, nous avons constaté ____. Les données de votre organisation concernées : ____.
> Période d'exposition : du ____ au ____. Personnes concernées dans votre organisation : environ ____.
> Mesures prises : ____. Nous avons notifié la CNIL le ____ (ou : décision de ne pas notifier, motif : ____).
> Nous restons à votre disposition pour vous fournir les éléments nécessaires à votre propre
> notification : contact@thecosmo.app.

## Ligne du registre

À reporter dans le registre **privé** (art. 33.5), même sans notification.

| Date de découverte | Nature | Personnes | Données | Décision et justification | Notifiée le |
|---|---|---|---|---|---|
| | | | | | |

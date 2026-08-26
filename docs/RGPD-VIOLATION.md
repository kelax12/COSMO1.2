# Procédure de violation de données

**Articles 33 et 34 du RGPD.** Établie le 2026-08-26, **à froid**, parce que le délai ne permet
pas d'improviser.

> 🔴 **Le compte à rebours de 72 heures démarre à la PRISE DE CONNAISSANCE**, pas à la
> résolution, ni à la confirmation, ni au moment où on comprend l'ampleur. Dès qu'il existe un
> doute raisonnable qu'une violation a eu lieu, l'horloge tourne. Notifier une violation dont on
> ne connaît pas encore l'étendue est prévu par le texte : on complète ensuite.

---

## Ce qui compte comme violation

Toute atteinte à la **confidentialité**, à l'**intégrité** ou à la **disponibilité** de données
personnelles. Les trois comptent, pas seulement la fuite.

| Type | Exemples propres à COSMO |
|---|---|
| Confidentialité | Une policy RLS trop large qui expose les tâches d'autrui. Une fuite inter-organisations. Un jeton de session lisible par un script tiers. Une clé exposée dans un dépôt public. |
| Intégrité | Une migration qui écrase des données. Une rupture détectée par `verify_payment_chain()`. |
| Disponibilité | Une suppression accidentelle sans sauvegarde exploitable. Un chiffrement par rançongiciel chez un sous-traitant. |

**Ne comptent pas** : une indisponibilité brève sans perte de données, un bug d'affichage, une
erreur qui n'expose rien.

---

## Les six heures qui suivent la découverte

### 1. Horodater, avant tout le reste

Noter l'instant exact de la prise de connaissance, et par quel canal. C'est cette heure qui sera
opposée, pas celle de la notification.

### 2. Contenir

Selon la nature : révoquer la clé, désactiver la fonctionnalité, retirer la policy fautive,
invalider les sessions. **Contenir prime sur comprendre.**

### 3. Préserver les preuves

Ne pas écraser les journaux. Ne pas forcer un `git push` qui réécrirait l'historique. Copier les
logs Supabase et Sentry pertinents avant qu'ils n'expirent.

### 4. Qualifier

Répondre par écrit à ces six questions, qui sont exactement celles du formulaire CNIL :

1. Quelles **catégories de données** sont concernées ?
2. Combien de **personnes** approximativement ?
3. Combien d'**enregistrements** approximativement ?
4. Quelles **conséquences probables** pour ces personnes ?
5. Quelles **mesures** ont été prises ou sont proposées ?
6. La violation est-elle **encore en cours** ?

### 5. Décider de la notification

| Situation | Action |
|---|---|
| Risque pour les droits et libertés **improbable** | Pas de notification à la CNIL. **Consigner la décision et sa justification** dans le registre ci-dessous. L'absence de notification doit pouvoir être justifiée. |
| Risque **probable** | Notification CNIL sous 72 h. |
| Risque **élevé** | Notification CNIL **et** information de chaque personne concernée, dans les meilleurs délais. |

Un mot de passe est haché, donc une fuite de la table des profils n'expose pas de mot de passe.
En revanche, **le contenu des tâches peut contenir n'importe quoi** : c'est du texte libre. Ne
jamais qualifier une fuite de tâches comme anodine sous prétexte que « ce ne sont que des
tâches ».

### 6. Notifier

- **CNIL** : téléservice de notification sur cnil.fr. Si les 72 h sont dépassées, notifier quand
  même, en motivant le retard. Une notification tardive vaut mieux qu'aucune.
- **Personnes concernées**, si risque élevé : en termes clairs, sans jargon. Dire ce qui s'est
  passé, ce que ça implique concrètement pour elles, ce qu'on a fait, et ce qu'elles peuvent
  faire.
- **Organisation cliente**, si des données d'entreprise sont concernées : elle est
  co-responsable et doit pouvoir notifier de son côté.

---

## Où regarder, concrètement

| Source | Ce qu'elle donne |
|---|---|
| Sentry | Erreurs en production, rattachées au SHA du commit déployé |
| Journaux Supabase | Requêtes, authentification, exécutions d'Edge Functions |
| `verify_payment_chain()` | Intégrité du journal fiscal |
| `npm run check:rls` | Invariants RLS, exécutable immédiatement |
| Journaux Vercel | Accès HTTP, adresses IP |
| Historique git | Ce qui a été déployé, et quand |

---

## Registre des violations

**Obligatoire, même pour les violations non notifiées** (art. 33.5). L'absence de notification
doit être documentée et justifiée, sinon elle est indistinguable d'un manquement.

| Date de découverte | Nature | Personnes | Données | Décision et justification | Notifiée le |
|---|---|---|---|---|---|
| _(aucune violation à ce jour)_ | | | | | |

> ⚠️ Ne jamais laisser ce tableau vide **par négligence**. Vide parce qu'il ne s'est rien passé
> est une information ; vide parce que personne ne l'a rempli est un manquement.

---

## Ce qui n'est pas encore en place

- **Aucune astreinte.** Une violation découverte un vendredi soir n'a pas de traitement garanti
  avant le lundi, ce qui consomme la moitié du délai.
- **Aucun exercice de restauration n'a été conduit.** On ne sait donc pas, en pratique, combien
  de temps prendrait une remise en état après une atteinte à la disponibilité.
- **Les DPA des sous-traitants ne sont pas archivés** (ligne A5 de [`LEGAL.md`](./LEGAL.md)).
  Or c'est le contrat de sous-traitance qui oblige le prestataire à **nous** alerter d'une
  violation chez lui. Sans lui, on dépend de sa bonne volonté et de ses pages de statut.

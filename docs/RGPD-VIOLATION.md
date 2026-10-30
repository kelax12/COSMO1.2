<!-- note-audit: couvert-par=RGPD.md -->
<!--
  🔴 C-109 · CE MARQUEUR EST LU PAR `npm run check:docs-scored`.
  Douze documents de fond n'étaient notés par RIEN : ils ne pouvaient ni monter
  ni baisser, donc **rien ne signalait qu'ils avaient vieilli**.
  Chaque document de `docs/` déclare donc soit sa note, soit la note qui le
  couvre, soit qu'il n'est pas noté ET pourquoi.
  ❌ Ne JAMAIS inventer une note sans avoir audité le domaine : `non-note` est
     une réponse honnête, un chiffre faux ne l'est pas.
-->
> **Note d'audit** — Couvert par la note de [`RGPD.md`](./RGPD.md) : procédure du même domaine.

# Procédure de violation de données

**Articles 33 et 34 du RGPD.** Établie le 2026-08-26, **à froid**, parce que le délai ne permet
pas d'improviser.

> 🔴 **Le compte à rebours de 72 heures démarre à la PRISE DE CONNAISSANCE**, pas à la
> résolution, ni à la confirmation, ni au moment où on comprend l'ampleur. Dès qu'il existe un
> doute raisonnable qu'une violation a eu lieu, l'horloge tourne. Notifier une violation dont on
> ne connaît pas encore l'étendue est prévu par le texte : on complète ensuite.

---


## 🕳️ Angles morts · ce que ce document NE mesure PAS (2026-09-16)

> 🔎 **Colonne « État » réécrite le 2026-09-21.** La quatrième colonne posait « Outillable ? »,
> c'est-à-dire une **prédiction** faite le 2026-09-16. La passe du 2026-09-20 au soir (`2b4c4304`)
> y a répondu : elle porte donc maintenant l'**état réel**, la garde qui couvre la ligne, et
> 🔴 **ce que cette garde ne prouve pas** — la moitié qui manque d'habitude.
>
> ❌ **La colonne « Angle mort » n'est PAS touchée.** C'est l'énoncé, daté du 2026-09-16, et
> c'est lui qui, nommé, a permis d'outiller : le réécrire effacerait la seule chose qui explique
> pourquoi la garde existe. Un seul endroit porte l'état, et c'est la colonne de droite.
>
> ⚠️ **Une garde posée n'est pas un angle mort fermé**, et `M-56` (« ce que chaque angle mort
> coûte en points ») ne change rien ici : **aucune note ne bouge** sur cette base.



> **Pourquoi cette section existe.** Demande d'Axel, après le constat qui a ouvert la journée :
> `CLAUDE.md` a pesé 150 ko sans qu'aucune note ne bouge, parce qu'il était **cité comme source**
> par les audits et **jamais mesuré par eux**. Il était le mètre, jamais l'objet.
>
> 🔴 **Ce document n'a PAS de note, et c'est son premier angle mort.** Les onze documents notés
> entrent dans le tableau de bord de [`README.md`](./README.md) et peuvent donc monter ou baisser.
> Celui-ci ne le peut pas : rien ne le pèse, donc rien ne signale qu'il a vieilli. Les angles morts
> ci-dessous ne sont **pas** des défauts du produit ; ce sont les endroits où **ce document affirme
> sans que rien ne vérifie**.
>
> Chaque ligne est vérifiée par une commande, jamais supposée. Elle se **referme** ou se
> **reconduit avec sa date**, jamais ne se recopie.

| # | Angle mort · **énoncé du 2026-09-16, non réécrit** | Vérifié le 2026-09-16 | 🔎 État au 2026-09-21 |
|---|---|---|---|
| AM-1 | 🔴 **La procédure n'a JAMAIS été éprouvée à blanc.** Même famille que le rollback et que la mig. `131` : **un chemin de récupération qui n'a pas été parcouru est une hypothèse**, et celui-ci se parcourt sous 72 heures, en situation de panique | aucune répétition tracée dans ce document | 🟠 **TOUJOURS OUVERT** au 2026-09-21 · **`M-49`** : la procédure n'a **jamais** été parcourue, même à blanc, et elle se déroule sous 72 h en situation de panique · *(jugé outillable le 09-16 : oui : un exercice annuel daté, comme `restore-drill`)* · 🔎 **2026-10-15 : parcourue pour de vrai, pas à blanc.** Violation `BK-1` découverte le 2026-10-13 par l'audit juridique (dumps de la base en clair dans les artefacts d'un dépôt public, du 2026-08-29 au 2026-10-13, cf. [`../faille.md`](../faille.md)). Exposition refermée le jour même ; décision de notification **`M-69`** à prendre **avant le 2026-10-16 vers 11 h UTC**, information des personnes `M-70`. Ce que la procédure a demandé et qu'elle n'écrivait pas sera à reporter ici une fois l'épisode clos · 🔎 🔴 **2026-10-16 : l'échéance de 72 h est passée** (vers 11 h 26 UTC) et le registre privé porte toujours « Notifiée le : _à remplir_ ». Premier enseignement à reporter : **la procédure n'a pas de minuterie**. Les brouillons étaient prêts la veille, et à l'échéance aucune décision n'était consignée ; rien ne l'a rappelée. `M-68` est fait (sessions révoquées, vérifié en base) · ✅ **2026-10-16 (soir) : `M-69` fait**, notification initiale soumise à la CNIL, tardive, avec motifs du retard. **Retour d'expérience** : (1) la procédure n'a pas de minuterie : l'échéance de 72 h doit être posée en rappel daté dès la découverte ; (2) le formulaire demande le nombre de personnes concernées, et les comptes du responsable lui-même (comptes de test) sont à signaler à part, ce que la procédure ne disait pas ; (3) avec un brouillon prêt, la saisie a pris une soirée, la décision avait pris trois jours · ✅ **2026-10-24 : exercice à blanc joué et daté** (mode table, voir [§ Exercice à blanc](#exercice-à-blanc)), 8 trous trouvés, 6 corrigés dans les documents (minuterie, gabarits, comptes de test), 2 ouverts avec leur propriétaire. Garde `npm run check:exercice-violation` en CI : exige un exercice de moins de 12 mois, des liens, commandes et gabarits qui existent (témoin vu rouge). 🔴 ne prouve PAS qu'un exercice a eu lieu, seulement qu'il est consigné ; ne mesure pas le temps de décision humain |
| AM-2 | 🔴 **Le délai de 72 h court à partir de la DÉTECTION, et rien ne mesure la détection.** Le dépôt sait alerter sur l'échec d'une garde ; il ne sait rien dire d'un accès anormal aux données. Une violation non détectée ne déclenche aucun compte à rebours | aucun job ne lit les logs d'accès à cette fin | 🟠 **TOUJOURS OUVERT** au 2026-09-21 · **aucun item ne le porte**, et c'est le plus lourd des trois. Le dépôt sait alerter sur l'échec d'une garde ; il ne sait rien dire d'un accès anormal aux données. Le délai court à partir d'une **détection** que rien ne mesure — *(jugé outillable le 09-16 : partiellement : les logs Supabase existent)* · 🔎 **2026-10-23 : détecteur posé**, `detection-violation.yml` (chaque matin, relié à `ci-alert.yml`) + `scripts/detection-violation.mjs`. Il lit les alertes GitHub de secret scanning et de code scanning ouvertes, le **contenu** des artefacts des dernières 26 h, et les journaux Supabase (`edge_logs`, 24 h) : échecs d'authentification, échecs concentrés sur une IP, réinitialisations, lignes lues par un même compte (export massif), lignes rendues à `anon`, chacun contre un plancher **et** une référence d'écart (moyenne + 4 écarts-types sur 7 à 28 jours). Un signal pousse un message qui porte l'**échéance de 72 h** ; une source illisible ou un jeton absent rend le run rouge (échec fermé). Témoin `detection-violation.guard.test.mjs`, vu rouge sur deux sabotages. ⚠️ **Mesuré à la pose** : `auth.audit_log_entries` est **vide** en production, les événements d'auth ne vivent que dans les journaux (rétention d'un jour sur le plan Free) ; un détecteur fondé sur la table aurait répondu « rien » pour toujours. 🔴 Ce qu'il ne prouve pas : un accès anormal sous les planchers, une lecture par le SQL direct (`SUPABASE_DB_URL`), ni rien avant la pose du secret `SECURITY_ALERTS_TOKEN` (posé le 2026-10-26) |
| AM-2bis | 🔎 **Constat du 2026-10-15, qui donne raison à AM-2.** `BK-1` a été trouvée par un **audit** (juridique, 2026-10-13), quarante-cinq jours après le début de l'exposition, et par aucune garde : rien ne regardait ce que les artefacts du dépôt contenaient, ni qui pouvait les lire. Le délai de 72 h a couru de cette découverte | aucun job ne lit le contenu des artefacts ni la visibilité du dépôt | 🟠 **OUVERT** · le chiffrement est désormais obligatoire dans `db-backup.yml` (échec fermé sans phrase secrète) ; rien ne vérifie qu'un **autre** workflow ne dépose pas de données personnelles en artefact · ✅ **2026-10-15 : garde posée**, `scripts/artefacts-donnees-prod.guard.test.mjs` (suite vitest) : liste nominative des 8 artefacts, des 21 étapes au contact de la prod et de ce qu'elles impriment, refus de tout dump ou sortie de requête en clair ; vue **rouge** sur le `db-backup.yml` d'avant `8c6a971d`. Elle ne lit que les workflows, pas le contenu réel des artefacts · ✅ **2026-10-23 : les deux moitiés sont couvertes.** (1) La garde statique refuse en plus les caches au contact de la prod ou portant un dump, un secret imprimé (sous-chaîne, encodage, `env`, `${{ secrets }}` dans un script) et un dossier déposé qui **contient** un dump sans le nommer (règles F, G, H, témoins vus rouges). (2) `detection-violation.yml` ouvre chaque jour **chaque** artefact des dernières 26 h par son répertoire central et lit le début de chaque fichier : `PGDMP`, SQL de `pg_dump`, `COPY … FROM stdin`, SQLite, vingt adresses réelles, faux `.gpg`. Le dump de `BK-1` y est rejoué comme témoin |
| AM-3 | **Un registre des violations VIDE ne prouve rien.** Il peut vouloir dire « aucune violation » comme « aucune détection », et les deux se ressemblent depuis ce document | registre vide à cette date | 🟠 **TOUJOURS OUVERT** au 2026-09-21 · **dépend d'AM-2** : un registre vide ne distinguera « aucune violation » de « aucune détection » tant que la détection n'existe pas · *(jugé outillable le 09-16 : non : seul AM-2 lève l'ambiguïté)* · 🔎 **2026-10-15 : le registre n'est plus vide.** Il porte `BK-1` et il est tenu **hors dépôt** (dossier privé d'Axel), parce qu'il décrit ce qui a été exposé · ✅ **2026-10-23 : l'ambiguïté est levée par un journal de détection.** Chaque run quotidien de `detection-violation.yml` écrit une ligne datée : sources **lues** ou non, mesures, seuils, et `aucune, toutes sources lues` / `SIGNAL` / `SOURCE NON LUE`. Le journal est chiffré (gpg, `BACKUP_PASSPHRASE`) et déposé 90 jours en artefact `detection-journal`, jamais en clair dans le dépôt ; IP et comptes n'existent que là. Un registre vide se lit désormais contre ce journal : vide **avec** des lignes « aucune, toutes sources lues » = aucune détection sur ce que le détecteur regarde. 🔴 Pas plus : une violation hors de ces sources reste invisible |

---

## Exercice à blanc

> **M-49.** Une procédure qu'on n'a pas parcourue est une hypothèse. Exercice annuel : la garde
> `npm run check:exercice-violation` échoue quand le dernier a plus de 12 mois.

| Date | Mode et scénario | Résultat |
|---|---|---|
| 2026-10-24 | **Mode table**, scénario fictif : une policy RLS trop large expose les tâches d'équipe d'une organisation à une autre, découvert un vendredi à 18 h. Parcours des six étapes avec les liens, commandes et contacts réels du dépôt | 8 trous, 6 corrigés, 2 ouverts. Résolution documentaire de bout en bout : environ 10 s mesurées. **Le temps de décision humain n'est pas mesuré** |

**Chronomètre, étape par étape (2026-10-24, machine d'Axel, Windows).** Chaque ligne résout la matière que
l'étape appelle : fichier, ancre, commande, page externe. C'est le chemin documentaire, pas la
réflexion.

| Étape | Matière résolue | Résultat | Mesuré |
|---|---|---|---|
| 1 Horodater | `RGPD-VIOLATION-GABARITS.md` (créé par l'exercice) | trou **T-1**, **T-2** : rien à ouvrir avant | 73 ms après correction |
| 2 Contenir | `SECURITY.md` § Rotation des secrets, `DEPLOYMENT.md` § 3 Rollback | existent, ancres vivantes | 155 ms, 165 ms |
| 3 Préserver | `git log`, page Sentry, journaux Supabase | git 630 ms, `sentry.io` HTTP 200 en 1,3 s. Durée de rétention des journaux Supabase absente : **T-6** | 2,1 s |
| 4 Qualifier | six questions, `npm run check:rls`, `verify_payment_chain` (mig. `125`) | `check:rls` : 230 policies, 0 violation ; fonction présente. Pas de gabarit de réponse : **T-2** | 4,5 s |
| 5 Décider | tableau de décision, registre | le registre du document dit « aucune violation » alors que le vrai est hors dépôt : **T-3** | 0,1 s |
| 6 Notifier | `notifications.cnil.fr`, page CNIL « notifier une violation », `contact@thecosmo.app`, `LEGAL.md` A5 | pages CNIL HTTP 200 en 1,0 s et 0,6 s ; contact présent dans les catalogues légaux ; liste des administrateurs d'organisation sans chemin documenté : **T-5** | 2,1 s |

## Trous trouvés par l'exercice

| # | Trou | Où | État |
|---|---|---|---|
| T-1 | **Pas de minuterie** : l'échéance de 72 h n'est rappelée par rien (constat de `BK-1`) | étape 1 | ✅ corrigé le 2026-10-24 : gabarit « Rappel de l'échéance de 72 h », rappels à T+48 h et T+68 h |
| T-2 | **Aucun gabarit dans le dépôt** : chronologie, réponses aux six questions, messages. Les brouillons vivaient hors dépôt | étapes 1, 4, 6 | ✅ corrigé le 2026-10-24 : [`RGPD-VIOLATION-GABARITS.md`](./RGPD-VIOLATION-GABARITS.md), six gabarits gardés par titre |
| T-3 | Le registre du document affichait « aucune violation à ce jour » alors que le vrai registre est privé | § Registre | ✅ corrigé le 2026-10-24 : la note sous le tableau dit que ce tableau est le **format** |
| T-4 | Les comptes de test du responsable de traitement ne sont pas à compter avec les personnes concernées (formulaire CNIL de `BK-1`) | étape 4 | ✅ corrigé le 2026-10-24 : ligne dédiée dans « Qualification en six questions » |
| T-5 | Aucun chemin documenté pour obtenir la liste des administrateurs des organisations touchées | étape 6 | 🟠 ouvert : requête de lecture à éprouver par Axel sur un compte réel, non inventée ici. Porté par `M-49` |
| T-6 | « Copier les journaux avant qu'ils n'expirent » sans dire en combien de temps. Sentry : 90 jours (`RGPD-REGISTRE.md`). Supabase : durée non relevée | étape 3 | 🟠 ouvert pour Supabase : relever la durée du plan dans le dashboard. Corrigé pour Sentry et pour la consigne d'export dans la première heure |
| T-7 | Le délai part de la **prise de connaissance** : la procédure ne disait pas d'écrire le canal exact | étape 1 | ✅ corrigé le 2026-10-24 : colonne « Source » de la chronologie |
| T-8 | Aucun lien de la procédure vers la liste des gabarits ni vers la garde | tête du document | ✅ corrigé le 2026-10-24 : renvois ajoutés à l'étape 1 et ci-dessous |

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

**Puis poser deux rappels datés (T+48 h, T+68 h)** : gabarits « Chronologie horodatée » et « Rappel de
l'échéance de 72 h » dans [`RGPD-VIOLATION-GABARITS.md`](./RGPD-VIOLATION-GABARITS.md). Sans rappel, l'échéance
est passée sans décision lors de `BK-1`.

### 2. Contenir

Selon la nature : révoquer la clé, désactiver la fonctionnalité, retirer la policy fautive,
invalider les sessions. **Contenir prime sur comprendre.**

### 3. Préserver les preuves

Ne pas écraser les journaux. Ne pas forcer un `git push` qui réécrirait l'historique. Copier les
logs Supabase et Sentry pertinents **dans la première heure** : Sentry garde 90 jours, la durée des
journaux Supabase dépend du plan (à relever, voir T-6).

### 4. Qualifier

Répondre par écrit à ces six questions, qui sont exactement celles du formulaire CNIL :

1. Quelles **catégories de données** sont concernées ?
2. Combien de **personnes** approximativement ? (les comptes de test du responsable, **à part**)
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
| _(format : le registre réel est privé, voir ci-dessous)_ | | | | | |

> 🔎 **Le registre réel est tenu HORS dépôt** (dossier privé d'Axel), parce qu'il décrit ce qui a été
> exposé. Ce tableau est le **format** ; la ligne à remplir est le gabarit « Ligne du registre » de
> [`RGPD-VIOLATION-GABARITS.md`](./RGPD-VIOLATION-GABARITS.md).

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

# Facturation entreprise : parcours d'achat, états et e-mails

Date : 2026-11-02 · Statut : spec validée par Axel sur trois maquettes (parcours d'achat, états,
e-mails) le 2026-11-02, plan d'implémentation à écrire.

## 1. Intention

L'onglet Abonnement (`/entreprise/billing`) fonctionne, mais il se lit comme un formulaire : le
moment où l'on paie tient dans un toast, l'information légale est un paragraphe d'un bloc, et un
impayé ressemble à un renouvellement. Objectif : un parcours **clair** (on sait à tout instant où
l'on en est et ce qui sera débité), **fluide** (aucun écran figé, aucun état faux) et **beau**
(des animations qui expliquent ce qui change, jamais décoratives).

Le défaut le plus grave n'est pas esthétique. Au retour de Stripe (`?checkout=success`), le
webhook peut arriver **après** le client : l'écran affiche encore « Gratuit » alors qu'il vient de
payer. Ce trou est corrigé en premier (§ 5.1).

## 2. Décisions arrêtées

| Sujet | Décision |
|---|---|
| Périmètre UI | Carte forfait, récapitulatif avant paiement, précontractuel en pictos, historique des factures |
| Animations | Les six de la maquette (§ 4), toutes en Framer Motion, toutes neutralisées par `reducedMotion="user"` |
| États | Activation en cours, impayé, résiliation programmée, invitation sans place |
| E-mails | Bienvenue (fusion confirmation + premier reçu), alerte 80 % des sièges, résiliation, rappel annuel, sur un gabarit commun appliqué aussi aux autres e-mails de facturation |
| Logo | Celui de `public/logo-128.webp` (planète, anneau turquoise, cratère, étincelle). ❌ Pas `public/logo.svg`, dessin périmé |
| Icônes dans les e-mails | **Aucune.** Le titre suit directement l'en-tête logo |
| Ligne « Changer d'avis jusqu'au … » | **Retirée de l'encadré des e-mails.** La date reste dans le paragraphe légal de l'e-mail de bienvenue (confirmation sur support durable, L221-13) et dans le récapitulatif avant paiement |
| Carte bancaire affichée (« Visa •••• 4242 ») | **Non en v1.** Aucune donnée de carte n'est lue côté client ; le portail Stripe la montre |
| Date de nouvelle tentative de Stripe | **Non en v1.** La bannière dit « Stripe retente automatiquement dans les prochains jours » |
| Bascule après paiement | Sondage **borné** (§ 5.1), pas de canal Realtime |
| Palier conseillé | Le plus petit palier payant qui laisse au moins une place libre à l'effectif actuel. Aucune pastille s'il s'agit du palier déjà actif |
| Langues | Interface fr + en (catalogues existants). E-mails en français seul, comme aujourd'hui |
| Mode démo | Le parcours est visible mais aucun paiement ne part ; l'alerte 80 % et les e-mails n'existent pas en démo |

**Hors périmètre (choix d'Axel le 2026-11-02)** : palier conseillé par l'IA, compteur de jours de
rétractation, bouton « Prévenir le propriétaire » pour un membre, page Stripe Checkout
personnalisée, relances d'impayé J0/J3/J7, FAQ en ligne.

## 3. Interface de l'onglet Abonnement

Ordre vertical de l'onglet, de haut en bas : carte forfait, sièges nommés (`OrgBillingSeats`,
inchangé), bloc « Changer de palier » (sélecteur, pictos, grille), récapitulatif quand un palier
est choisi, actions d'abonnement (gérer, rétractation, résiliation), historique et destinataire
des factures.

### 3.1 Carte « Votre forfait » (`OrgPlanCard`, nouveau)

Remplace la `<section>` actuelle de `OrgBillingTab`.

- En-tête : libellé « Votre forfait », nom du palier (même mot que la pastille de l'en-tête, règle
  existante), pastille d'état à droite.
- Pastilles : Actif (succès), Paiement en attente (avertissement), Se termine le {date} (neutre),
  Palier d'essai (neutre, palier gratuit).
- Jauge de sièges : « {n} sur {quota} », barre accent ; avertissement à partir de 80 %, complet à
  100 % avec la phrase « Complet. Le prochain membre invité demandera un palier payant. ». Palier
  illimité : pas de barre, « {n} membres ».
- Pied, abonnement payant actif seulement : « Prochaine échéance le {date}, {montant} TTC ».
  Le montant est dérivé du palier et de la périodicité (`displayedMonthlyEur`, `yearlyTotalEur`),
  jamais écrit à la main.
- Code de réduction appliqué : conservé, sous la jauge.

### 3.2 Bloc « Changer de palier »

- `BillingIntervalToggle` garde son contrat ; seul le rendu change (§ 4, animation 2).
- **Pictos précontractuels** au-dessus de la grille, donc **avant** le choix d'un palier
  (L111-1, L221-5 ; LEGAL.md E2) : « Sans engagement » (mensuel) ou « Un an, rappel 45 j avant »
  (annuel), « 14 jours pour changer d'avis », « Résiliable en 1 clic », « Prix TTC, sans TVA ».
- Sous les pictos, **le texte `billing.precontractual` reste affiché en entier**, en petit.
  ❌ Ni repli, ni info-bulle, ni « en savoir plus » : il doit être sous les yeux.
- Grille : `EnterpriseTierGrid` garde ses règles (montants dérivés, jamais de compteur sur un
  prix). Ajouts : la carte entière est cliquable (plus de petit bouton « S'abonner » dans le coin),
  pastille « Conseillé pour votre équipe » sur le palier défini en § 2, ligne secondaire
  « soit {total} débités une fois par an » en annuel, « débité chaque mois » en mensuel.

### 3.3 Récapitulatif avant paiement (`OrgCheckoutRecap`, nouveau)

Remplace le panneau `role="region"` actuel. La carte choisie s'y déploie (§ 4, animation 1).

| Ligne | Valeur |
|---|---|
| Palier | libellé du palier |
| Périodicité | Mensuelle / Annuelle |
| Débité aujourd'hui | mensuel : tarif ; annuel : `yearlyTotalEur`, en gros |
| Prochaine échéance | aujourd'hui + 1 mois ou + 1 an, « même montant » |
| Changer d'avis | jusqu'au {aujourd'hui + 14 jours} |

- Case d'accès immédiat : **inchangée sur le fond** (non cochée par défaut, libellé
  `billing.immediateAccessLabel`, lien CGV, revérifiée et tracée par le serveur, mig. 237).
- Bouton : « Payer {montant} avec Stripe », cadenas. Case non cochée : le bouton reste cliquable
  et affiche sous lui « Cochez la case pour continuer. » (au lieu d'un bouton grisé muet).
- Second bouton : « Changer de palier » (revient à la grille, sélection effacée).
- Erreur `yearly_unavailable` : comportement actuel conservé (retour au mensuel).

### 3.4 Historique des factures (`OrgBillingHistory`)

- Une ligne par événement : date, numéro de facture en dessous, pastille d'état (Payée, Échouée,
  Remboursée, Autre), montant aligné à droite en chiffres tabulaires, bouton de téléchargement.
- Le montant d'un échec reste barré et estompé (règle actuelle).
- Téléchargement : `hostedInvoiceUrl` seulement s'il commence par `https://` (règle actuelle).
  Pas d'URL : pas de bouton, pas de bouton grisé.
- Le titre porte « Envoyées à {destinataire} · Modifier », qui fait défiler jusqu'à
  `OrgBillingContactCard`.

## 4. Animations

Toutes en Framer Motion (❌ jamais GSAP hors landing), durées 200 à 600 ms sauf l'orbite.
`MotionConfig reducedMotion="user"` les coupe déjà ; chaque animation doit aussi rester juste sans
mouvement (états finaux identiques, aucune information portée par le seul mouvement).

| # | Animation | Mécanique |
|---|---|---|
| 1 | La carte choisie se déploie en récapitulatif | `layoutId` partagé entre la carte de grille et `OrgCheckoutRecap`, les autres cartes en `AnimatePresence` (fondu + léger rétrécissement) |
| 2 | Sélecteur mensuel/annuel | Pastille qui glisse (`layoutId`), prix en fondu enchaîné 180 ms. ❌ **Jamais de compteur** |
| 3 | Jauge de sièges | Remplissage au montage ; après activation, la jauge se « libère » vers le nouveau ratio |
| 4 | Case cochée | Le bouton de paiement passe au style plein avec une pulsation unique (`scale` 1 → 1,03 → 1) |
| 5 | Sortie vers Stripe | Dès le clic validé et jusqu'à la navigation : panneau « Direction Stripe, paiement sécurisé », « Votre carte ne transite jamais par COSMO », barre de progression indéterminée |
| 6 | Bienvenue | Au passage à l'état actif : planète du logo, satellite en orbite (une révolution, 2,4 s), trois étoiles qui scintillent deux fois. La pastille de forfait de l'en-tête change d'état en même temps |

## 5. États

### 5.1 Activation en cours (retour de Stripe)

- Avant la redirection, `OrgCheckoutRecap` écrit `cosmo_pending_checkout` en `sessionStorage` :
  `{ orgId, tierKey, interval, at }`. Lecture par `safeParse`, jamais `JSON.parse` nu.
- Au retour `?checkout=success` : le paramètre est consommé (règle actuelle), le toast est
  **supprimé**, et l'onglet affiche « Paiement reçu, activation en cours… » tant que l'abonnement
  lu n'est pas `active` sur le `tierKey` attendu.
- `useOrgSubscription` reçoit une option `awaitActivation` : `refetchInterval` de 1,5 s, arrêté
  dès que l'abonnement correspond, et **au plus 20 s** après le retour.
- Passé 20 s : « Votre paiement est bien reçu. L'activation prend plus de temps que prévu :
  rechargez la page dans une minute, ou écrivez à contact@thecosmo.app. » Aucun nouveau sondage.
- Correspondance trouvée : animation 6, puis `cosmo_pending_checkout` est effacé.
- ⚠️ `src/modules/polling.guard.test.ts` nomme les fichiers autorisés à porter un
  `refetchInterval` : `billing/org-billing.hooks.ts` y entre comme **cinquième**, conditionnel et
  borné. Le tableau de `src/modules/CLAUDE.md` passe de quatre à cinq lignes.
- `?checkout=cancelled` : toast actuel conservé, `cosmo_pending_checkout` effacé.

### 5.2 Impayé (`past_due`)

- Bannière en tête de **tout l'espace entreprise** (`OrganizationPage`, au-dessus de la bannière
  sièges), **pour le propriétaire seul**.
- Titre : « Le paiement du {date} n'est pas passé ». Corps : « Vos {n} membres gardent tous leurs
  accès. Les nouvelles invitations sont en pause jusqu'à la mise à jour de la carte. Stripe retente
  automatiquement dans les prochains jours. »
- Bouton : « Mettre à jour ma carte », qui appelle `useOpenOrgPortal` (portail Stripe).
- La date est celle du dernier `invoice.payment_failed` de l'historique ; absente, le titre devient
  « Le dernier paiement n'est pas passé ».
- Dans l'onglet : pastille « Paiement en attente », ligne échouée dans l'historique.
- Membres non propriétaires : rien ne change pour eux, ils gardent leurs accès.

### 5.3 Résiliation programmée (`cancelAtPeriodEnd`)

Remplace la branche `cancelPending` de `OrgWithdrawCancel`.

- Titre « Votre abonnement s'arrête le {date} », sous-titre « Aucun nouveau prélèvement. Tout reste
  accessible jusque-là. »
- Frise : Résilié le {date de résiliation}, Aujourd'hui, Fin d'accès {date}, Palier gratuit.
  Sans date de résiliation connue, le premier jalon est omis.
- Si l'effectif dépasse le quota gratuit : « Après le {date}, le palier gratuit compte {quota}
  places. Vos {n} membres restent, mais vous ne pourrez plus en inviter. »
- Bouton mis en avant : « Reprendre mon abonnement », sous-titre « Même palier, même prix, aucune
  démarche de plus. »
- 🔴 **La résiliation elle-même ne change pas** : une page, un bouton, ni case ni questionnaire,
  aucun écran de rétention (L215-1-1, décision du 2026-11-01). Tout le soin va à la reprise.

### 5.4 Invitation sans place

Dans le flux d'invitation (`OrgInviteSection`, `OrgInviteLinkCard`), quand `seatsFull` est vrai :

- Propriétaire : bloc en ligne « Les {quota} places sont prises. Pour inviter {e-mail saisi},
  passez au palier {suivant} : {prix} TTC / mois, au lieu de {prix actuel}. », boutons « Passer au
  palier supérieur » (ouvre l'onglet Abonnement, palier suivant présélectionné, récapitulatif
  ouvert) et « Libérer une place » (section Membres).
- Membre non propriétaire : « Les places sont prises. Seul le propriétaire peut changer de
  palier. » Pas de bouton.
- Le champ d'invitation reste saisissable ; seul l'envoi est retenu.

## 6. E-mails

### 6.1 Gabarit commun (`_shared/billing-mail-layout.ts`, nouveau)

- En-tête : logo (PNG 80 px tiré de `logo-128.webp`, servi par `https://thecosmo.app/email/logo-80.png`,
  `alt="Cosmo"`), « Cosmo », étiquette « Entreprise ». ❌ Pas de SVG ni de webp (Gmail et Outlook
  ne les affichent pas). ❌ Pas d'icône.
- Titre, phrase d'accroche, encadré clé-valeur, bouton principal (indigo `#4f46e5`, texte blanc),
  lien secondaire facultatif, paragraphe légal en petit, pied « L'équipe COSMO · contact@thecosmo.app,
  vous recevez cet e-mail en tant que propriétaire de l'organisation {nom} ».
- HTML en tableaux et styles en ligne (compatibilité des clients mail), largeur 560 px.
- Partie texte conservée pour chaque e-mail, même contenu, sans mise en forme.
- Sécurité : toute valeur insérée passe par `escapeHtml` (existant) ; un lien n'est émis que s'il
  commence par `https://`.

### 6.2 Les e-mails

| E-mail | Déclencheur | Bouton principal | Lien secondaire |
|---|---|---|---|
| Bienvenue | `checkout.session.completed` (remplace `subscriptionConfirmationMail`) | Inviter des membres → `/entreprise/members` | Télécharger la facture |
| Alerte 80 % des sièges | travail quotidien (§ 6.3) | Voir les paliers → `/entreprise/billing` | Gérer les membres |
| Résiliation | action `cancel` (remplace `cancellationMail`) | Reprendre mon abonnement → `/entreprise/billing` | aucun |
| Rappel annuel | `renewal-notice`, inchangé sur le fond | Gérer mon abonnement | Résilier avant le {date} |
| Reçu, rétractation, remboursement | inchangés sur le fond | gabarit appliqué, contenu actuel | |

- **Bienvenue** : encadré Palier, Montant, Payé le, Prochaine échéance. Le paragraphe légal reprend
  **tout** le contenu actuel de `subscriptionConfirmationMail` (date limite de rétractation, accès
  immédiat horodaté, remboursement sous 14 jours, reconduction, TVA, version des CGV). Le lien de
  facture vient de `session.invoice` (lecture Stripe) ; lecture échouée : l'e-mail part sans le
  lien, jamais l'inverse.
- **Reçu en double** : sur `invoice.payment_succeeded` avec `billing_reason = subscription_create`,
  `receiptMail` n'est plus envoyé (la bienvenue le remplace). Les échéances suivantes gardent leur
  reçu.
- **Rappel annuel** : le texte légal L215-1 actuel est conservé mot pour mot ; seul l'habillage
  change.
- URL de la facturation : `/entreprise/billing` (la forme `?tab=billing` reste redirigée pour les
  e-mails déjà envoyés).

### 6.3 Alerte 80 % des sièges

- Nouvelle Edge Function `seat-alert`, appelée une fois par jour par le même workflow GitHub que
  `renewal-notice` (en-tête `x-cron-secret`, refus si le secret manque : ❌ pas de garde
  conditionnelle à la présence du secret).
- Cible : organisations dont l'effectif atteint au moins 80 % du quota de leur palier effectif
  (gratuit compris, illimité exclu).
- Idempotence : table `org_seat_alerts (id, org_id, tier_key, sent_at)`, contrainte UNIQUE
  `(org_id, tier_key)`, même schéma que `renewal_notices` : **une alerte par palier**, rejouable
  sans doublon. RLS activée, aucune policy client ; écriture par la fonction seule.
- Migration : prochain numéro libre au moment du plan (240 à la date de cette spec).
- Contenu : informatif, aucune promotion. « Cet e-mail est envoyé une seule fois, quand
  l'organisation franchit 80 % de ses places. Rien ne change sur votre abonnement sans votre
  accord. »
- Aucun envoi tant que `billing_flags.enterprise_seat_limit` est `false` (le drapeau serveur, pas
  `ENTERPRISE_BILLING_ENFORCED` qui est côté client). Le mode démo n'atteint jamais cette fonction.

## 7. Composants et fichiers

| Fichier | Rôle |
|---|---|
| `components/organization/OrgPlanCard.tsx` | Carte forfait, jauge, pastille, prochaine échéance |
| `components/organization/OrgCheckoutRecap.tsx` | Récapitulatif, case, bouton, sortie vers Stripe |
| `components/organization/OrgActivationState.tsx` | Activation en cours, délai dépassé, Bienvenue (orbite) |
| `components/organization/OrgPastDueBanner.tsx` | Bannière d'impayé de l'espace entreprise |
| `components/organization/OrgPrecontractualPictos.tsx` | Pictos + texte légal complet |
| `modules/billing/org-billing.logic.ts` | `recommendedTier`, `nextDueDate`, `chargedToday` (fonctions pures) |
| `modules/billing/pending-checkout.ts` | Lecture, écriture, effacement de `cosmo_pending_checkout` |
| `supabase/functions/_shared/billing-mail-layout.ts` | Gabarit HTML et texte |
| `supabase/functions/seat-alert/index.ts` | Alerte 80 % |

`OrgBillingTab` devient un assemblage de ces blocs. `EnterpriseTierGrid`, `OrgBillingHistory`,
`OrgWithdrawCancel` et `BillingIntervalToggle` sont modifiés sur place.

## 8. Contraintes

- Chunk `OrganizationPage` à son cliquet : tout nouveau composant de l'onglet vit dans le chunk lazy
  de `OrgBillingTab`, jamais dans la page. `OrgPastDueBanner` est léger (pas de Framer Motion) ou
  monté en lazy. `npm run check:bundle` fait foi.
- Toasts par `@/lib/toast` seulement ; i18n dans `orgAdmin` (fr et en), noms de paliers dans
  `common` (règle existante).
- Aucune règle de `src/modules/billing/CLAUDE.md` ne bouge : drapeaux couplés, montants dérivés,
  `retry: 0` sur les mutations d'abonnement, case d'accès immédiat obligatoire, pas de bouton qui
  résilie et rembourse.

## 9. Tests

- Vitest, fonctions pures : `recommendedTier` (bornes 5/10/20/50/100, illimité, effectif nul),
  `nextDueDate` (fin de mois, 29 février), `chargedToday` (mensuel, annuel), `pending-checkout`
  (lecture corrompue, mauvais `orgId`).
- Vitest, composants : récapitulatif (bouton sans case → message, avec case → mutation appelée une
  fois), activation (correspondance → Bienvenue, 20 s → message de délai, pas de sondage après),
  bannière (propriétaire seul), résiliation programmée (frise, reprise). Les tests existants
  `OrgBillingTab.retractation.parcours` et `OrgBillingTab.seats-history` restent verts.
- `polling.guard.test.ts` : cinquième fichier déclaré, et témoin d'un sondage non borné refusé.
- E-mails : chaque gabarit échappe une valeur piégée, n'émet aucun lien non `https://`, et la
  bienvenue contient toutes les mentions légales de l'actuel `subscriptionConfirmationMail`.
- `seat-alert` : deuxième passage sans doublon (`23505` absorbé), secret absent → refus.
- Vérification visuelle : preview (mode démo) du parcours complet, mobile et bureau, clair et
  sombre, mouvement réduit.

## 10. Découpage

1. **Lot 1, interface et états** (§ 3, 4, 5) : front seul, aucun changement serveur.
2. **Lot 2, gabarit et e-mails existants** (§ 6.1, 6.2) : Edge Functions `stripe-webhook`,
   `stripe-org-subscription`, `renewal-notice` redéployées, garde de dérive `check:edge`.
3. **Lot 3, alerte 80 %** (§ 6.3) : migration, nouvelle fonction, workflow.

Chaque lot se livre seul, dans cet ordre.

# À faire · CODE

> 🗂️ **Fichier allégé le 2026-10-11.** Il pesait **512 ko** (6 553 lignes, ~130 000 tokens) :
> aucun agent ne pouvait le lire en entier, donc chacun n'en voyait qu'un morceau. Il ne garde
> plus que **ce qui est ouvert**, les règles de traitement et l'index. **Rien n'a été coupé** :
> le fichier complet, items clos, arbitrages du 2026-09-03 et décomptes datés compris, est
> **[`docs/archive/a-faire-code-jusqua-2026-10-11.md`](./docs/archive/a-faire-code-jusqua-2026-10-11.md)**, à l'identique. Pour l'historique d'un item : y chercher `### C-NN`.
>
> ✅ **Règle d'entretien** : un item qui se ferme quitte ce fichier dans le même commit, avec sa
> ligne dans l'index ci-dessous. Un nouvel item s'ajoute au § « Ouvert » avec un identifiant
> `C-122` et suivants (le dernier attribué est `C-121`, le 2026-10-13).

Classement : ce fichier porte ce qui se fait **avec du code, sans geste d'Axel**. Les gestes
(console, appareil réel, décision) sont dans [`a-faire-manuel.md`](./a-faire-manuel.md).
Sécurité : [`faille.md`](./faille.md) fait foi.

---

## Règles de traitement (elles viennent de défauts réels de ce dépôt)

1. ❌ **Ne jamais relever un plafond ni baisser un seuil** pour faire passer une garde. Cliquets
   concernés : `check:bundle`, `architecture.guard`, `i18n:scan`, `test:coverage`.
2. ✅ **Mesurer avant, mesurer après**, et publier les deux chiffres. Un correctif dont on ne peut
   pas montrer le gain est une dette de mesure, pas un progrès.
3. ✅ **Tout correctif de garde repart avec un témoin** : une sonde qui refuse un détecteur qui ne
   détecterait plus rien.
4. ✅ **Un défaut d'interface se vérifie en ouvrant l'écran**, pas en relisant le code. Deux
   défauts du 2026-09-02 (404 en anglais, `{current}` affiché tel quel) étaient invisibles à toute
   relecture et à toute gate.
5. ⚠️ **Ce dépôt a plusieurs sessions actives.** Relire le ledger avant d'appliquer une migration,
   et `git status` avant de commiter.
6. ❌ **Ne jamais attribuer un delta à son propre geste sans revérifier `HEAD` aux deux bouts de la
   mesure.** Une mesure avant / après ne vaut dans ce dépôt que si `HEAD` est identique aux deux
   instants, ou si l'écart est expliqué. Le 2026-09-08, `HEAD` a bougé **deux fois** pendant une
   seule passe (`d12a161` → `c9456ad` → `79e7fe0`), et une des trois améliorations mesurées
   venait d'une session voisine. C'est le pendant de la règle 2 : publier les deux chiffres ne
   suffit pas s'ils n'ont pas été pris sur le même arbre.


---

## Décompte courant

### 11.0undecies ✅ **DÉCOMPTE du 2026-10-10 · 120 items : 114 clos, 6 ouverts** (`C-116` fermé le soir même)

> Relevé sur la CI RÉELLE de `main` (`gh run view --log`), et non en relisant ce fichier. Runs lus :
> `CI` `38045949683` et `Visual` `38045949695` à `79eb6d5e`, `CI` `38043060035` à `a43153dd`.
>
> ✅ **La CI de `main` est VERTE, les cinq jobs, sur deux têtes consécutives** (`a43153dd`, puis
> `79eb6d5e`). Ce n'était plus arrivé depuis le 2026-09-16 (cf. § 11.0decies). Le dernier run
> rouge est `38039854671` (`f15c3f84`, job `e2e`), réparé par les deux commits suivants.
>
> | Item | Avant | Constaté le 2026-10-10 |
> |---|---|---|
> | `C-111` | 🟠 `e2e` rouge sur `main` | ✅ **FERMÉ** · `e2e` vert : **240 passés, 1 instable, 3 ignorés** (22,3 min). L'instable est `a11y-audit` › Settings (demo) sous `mobile-safari`, un dépassement à 2,0 min qui repasse au 2ᵉ essai en 10 s : une dette, pas un rouge |
> | `C-115` | 🟠 reste à voir une première COMPARAISON | ✅ **FERMÉ** · « 18 reference(s) presente(s) », l'étape « Comparer aux references » a joué : **20 passés**. Vert en comparaison sur `bece865e`, `a43153dd`, `79eb6d5e` |
> | `C-116` | 🟠 levier 1 codé, reste la mesure CI | ✅ **FERMÉ le même jour** (`38056459284` : 8/8 sous 4 s, de 3,32 à 3,34 s), après deux correctifs décrits au § 12.11. Avant eux, le gain local ne se retrouvait PAS en CI : LCP mobile : `/` **7,6 s**, `/guide/` 6,4, `/blog/` 6,0, `/blog/methode-okr-exemples/` 6,0, `/pour-freelances/` 5,6, `/entreprise-presentation/` **8,3**, `/a-propos/` 5,6, `/en/` **3,6**. **Une URL sur huit** sous 4 s. Voir la ligne `C-116` du § 12.11 |
>
> 🔴 **Le job `lighthouse` est vert ALORS QUE sept URLs dépassent 4,5 s** : `largest-contentful-paint`
> est en `warn` dans `lighthouserc.mobile.json`. Un vert de ce job ne dit RIEN de `C-116`. Seules
> les annotations `lhci-mobile` le disent.
>
> ⚠️ **Ce que la fermeture de `C-116` ne dit pas** : au même run, le TBT mobile vaut **1,2 à 1,3 s**
> sur `/`, `/entreprise-presentation/` et `/en/` (341 à 709 ms au run `38045949683`). Un seul run, donc
> pas encore une tendance ; à relire au suivant avant d'ouvrir un item. Le critère de `C-116` était
> le LCP, il est tenu.
>
> ### Les 6 items ouverts
>
> | Item | Ce qui reste | Débloqué par |
> |---|---|---|
> | ~~`C-116`~~ | ✅ fermé le 2026-10-10 : 8/8 sous 4 s en CI | rien |
> | ~~`C-118`~~ | ✅ fermé le 2026-10-16 : `a11y-keyboard-audit` joue sous WebKit (`mobile-safari`), 16 cas, les cinq jobs verts, e2e compris (CI `38899295767` sur la PR n° 76, `b95ed132`). Un défaut produit corrigé (la feuille d'actions d'une tâche ne s'ouvrait pas au clavier sous Safari), un écart Safari déclaré (Tab saute les liens), le reste du harnais | rien |
> | `C-45` | le réglage de console des URL de `loginWithGoogle` | un geste (`M-15`/`M-16`/`M-17`) |
> | `C-24` | VoiceOver iOS sur un appareil réel | un geste (`M-40`, `M-52`) |
> | `C-65` + `C-39` | l'épreuve du remboursement contre une vraie carte | un geste (`M-08`) |
> | `C-58` | React 19 : arbitrage différé, seuil de reprise 283,5 ko | une décision |

---

## Ouvert · le détail de chaque item

### C-121 · Supprimer les comptes inactifs depuis 3 ans · **P3 · M** · ⏳ promesse publiée, traitement absent

| Item | Constat | Ce qui prouve que c'est fini |
|---|---|---|
| **C-121** · P3 · M | **Ouvert le 2026-10-13 (audit juridique).** La politique de confidentialité (s6.li1) annonce désormais qu'un compte sans connexion pendant **3 ans** est supprimé, après un e-mail d'avertissement **30 jours avant** (RGPD art. 5.1.e : jusqu'ici, un compte abandonné était gardé sans limite). **Aucun traitement ne l'applique.** Rien ne presse avant 2029 (premiers comptes : 2026), mais une promesse publiée sans exécution redevient une fausse déclaration le jour où un compte franchit le seuil | un job planifié (pg_cron ou workflow) qui (1) repère `last_sign_in_at < now() - 3 ans`, (2) envoie l'avertissement par Resend et le trace, (3) 30 jours plus tard, supprime par le même chemin que `delete-account` (transfert de propriété d'organisation compris) ; preuve en transaction annulée acteur par acteur, et un témoin : un compte connecté hier n'est JAMAIS visé. ❌ Ne pas supprimer sans l'e-mail : la politique le promet |


### C-65 · Le remboursement du mois en cours n'existe nulle part dans le code · **P1 · M** · 🟠 **le code est fini ; l'épreuve contre Stripe ne l'est pas**

> ✅ **2026-09-14 — le dernier morceau TESTABLE du critère de sortie est livré et déployé.** Le
> critère demandait « un test [qui] couvre les trois : le cas nominal, le rejeu, et la période déjà
> remboursée ». Seul le MONTANT en avait. Le verrou anti-rejeu — celui qui décide du montant FINAL
> — vivait en ligne dans l'entrypoint Deno, entre deux appels Stripe, **donc n'avait aucun test**,
> pendant tout le temps où cet item déclarait « une borne ».
>
> | | |
> |---|---|
> | Livré | `_shared/refund-replay.ts` (TS pur, zéro API Deno, zéro type Stripe importé) + `src/modules/billing/refund-replay.test.ts`, **10 cas dont un témoin**. L'entrypoint l'APPELLE : un test qui mesurerait une copie ne mesurerait rien |
> | Vu rouge | **trois sabotages** : soustraction retirée → 6 cas tombent · un `failed` compté comme rendu → 2 · borne remplacée par un zéro constant → 7, **dont le témoin** (c'est le seul sabotage qui passerait tous les cas « rejeu » sans lui) |
> | Déployé | **v6, 2026-09-14 à 15:24 UTC**, sur autorisation explicite d'Axel |
> | CI verte après | run **`34865013726`** sur `2e10baac` : les **cinq** jobs |
> | Prouvé identique au dépôt | run **`34861975638`** du job `Edge deploy drift` : « **8 fonction(s) verifiee(s) : le code deploye est celui du depot** ». Première fois que ce chemin-là est comparé octet pour octet après un déploiement, et non relu |
>
> ⚠️ **Ce que l'extraction a rendu explicite, et qui n'était écrit nulle part** : la clé
> d'idempotence Stripe (verrou 1) **expire**, donc elle n'arrête que deux appels CONCURRENTS. Un
> rejeu tardif n'est arrêté que par le verrou 2. Les deux ne se remplacent pas — l'en-tête de la
> fonction le dit désormais.
>
> ⚠️ Deux subtilités sont couvertes nommément parce qu'elles coûtent de l'argent **dans les deux
> sens** : un remboursement `pending` compte comme rendu (sinon on rembourse par-dessus un virement
> en vol) ; un `failed` ou `canceled` ne compte pas (sinon on prive la personne de son argent après
> un échec bancaire, définitivement, sans qu'aucun écran ne le dise).
>
> ⚠️ **L'extraction a fait ROUGIR une garde, et elle avait raison.** `src/refund.guard.test.ts` est
> une garde TEXTUELLE : elle cherchait `already` et `Math.min(decision.amountCents,` dans le source
> de l'entrypoint, où l'arithmétique ne vit plus. Le défaut était dans la garde, pas dans le
> produit — et c'est le comportement qu'on lui demande : une garde qui continue de lire l'ancien
> emplacement passe au vert **en ne regardant plus rien**. Seconde occurrence dans ce même fichier,
> après l'extraction de `useDeleteOrgFlow`. Elle mesure désormais **plus** qu'avant : un cas neuf
> **interdit** de recopier l'arithmétique dans l'entrypoint, sans quoi un retour en arrière la
> rendrait intestable en silence et `refund-replay.test.ts` mesurerait un module que plus personne
> n'appelle.
>
> 🔴 **Et ce rouge vient d'une étape sautée, pas d'une surprise** : la suite complète n'avait pas
> été rejouée après l'extraction, seulement les deux fichiers de test billing. Rejouée en entier
> ensuite, comme la CI la joue : **228 fichiers / 2 586 tests, zéro échec**. Huitième fois en
> treize jours qu'un rouge désigne la mesure et non le produit.

> 🔴 **CE QUI RESTE, ET QUI N'EST PLUS DU CODE.** `refunds.create`, la résiliation réelle et la
> ligne compensatoire du journal n'ont **jamais tourné sur une vraie facture** — `org_subscriptions`
> et `payment_records` sont à zéro ligne. Les deux gestes sont **M-37c** (vérifier au tableau de
> bord Stripe que `charge.refunded` est souscrit : six branches dans le code, cinq events
> documentés) puis **M-37b** (jouer le remboursement contre le compte de TEST). Cf. § 11.3.

### C-39 · N'importe quel ADMIN peut supprimer l'entreprise depuis l'écran, et la cascade emporte tout · **P1 · M** · 🟢 **parcours JOUÉ le 2026-09-14**

> ✅ **Le parcours nominal est joué de bout en bout, dans un navigateur** — ce que la note du
> 09-14 au matin donnait comme le dernier manque. `e2e/stubbed/delete-org.spec.ts` (4 cas,
> commit `31433705`), sur l'app réelle, avec le vrai routage et le vrai composant :
>
> | Cas | Ce qu'il mesure |
> |---|---|
> | la suppression **attend** le remboursement | la réponse de l'Edge Function est **retenue** ; tant qu'elle ne part pas, **zéro** `rpc/delete_organization`. Libérée, la suppression suit, une seule fois, sur le bon `p_org` |
> | un remboursement **refusé** ne supprime rien | aucune RPC de suppression, l'écran reste réessayable, et **un seul** appel (le `retry: 0` de `useCancelAndRefundOrg` tient) |
> | un **ADMIN non propriétaire** | n'atteint ni la zone de danger ni le bouton — le scénario d'échec de cet item, mot pour mot |
> | **TÉMOIN** | exige que le détecteur de suppression voie bien partir une suppression, sans quoi les deux assertions négatives seraient vertes pour la mauvaise raison |
>
> 🔴 **Vu ROUGE avant d'être commité.** Mutation posée sur `useDeleteOrgFlow` — `remove.mutate()`
> avant `refund.mutate()`, sans attendre le succès : **les deux cas d'ordre tombent**, le témoin et
> le cas non-propriétaire restent verts. La sonde mesure donc la propriété qu'elle annonce, et elle
> ne mesure pas seulement « l'écran s'affiche ».
>
> ⚠️ **La première version du cas 1 a échoué sur un produit JUSTE**, et ça vaut d'être écrit :
> `stub.functionCalls` n'enregistre l'appel qu'au moment où le stub **répond**, or c'est exactement
> ce que le cas retient. Septième fois en douze jours qu'un rouge désigne la mesure et non le
> produit.
>
> 🔴 **Ce qui reste, et qui ne peut pas se faire d'ici** : rien n'a jamais été joué **contre
> Stripe**. Ce test prouve le client ; la garde PROPRIÉTAIRE qui compte vit dans
> `delete_organization` (mig. 138) et a été prouvée en SQL acteur par acteur le 2026-09-12.
> `refunds.create` et la résiliation réelle restent suspendus aux deux gestes d'Axel décrits en
> `C-65` — clé Stripe live, ou une facture payée en mode test à rembourser.

> 🟠 **L'état du 2026-09-14 au matin, conservé à sa date** · bloqueur LEVÉ le 2026-09-12

> ✅ **Remesuré le 2026-09-14 : `stripe-org-refund` EST en production**, v5 du 2026-09-12 à
> 22:05 UTC, et le job `Edge deploy drift` du 09-14 à 10:57 confirme qu'elle est identique au
> dépôt. Le seul blocage que la note du 09-12 opposait à la fermeture de cet item est donc tombé.
>
> 🔴 **Ce qui reste n'est plus un geste, c'est une épreuve** : le parcours nominal
> (rembourser → résilier → supprimer) **n'a jamais été joué une seule fois de bout en bout**, ni
> en démo ni contre le compte Stripe de test. Tant qu'il ne l'a pas été, cet item ne se coche pas :
> « déployée » n'est pas « éprouvée », et c'est précisément la distinction que `C-65` porte.

> 🟠 **TOUJOURS À MOITIÉ au 2026-09-12 — la moitié SQL est livrée, la moitié Stripe non.**
> La mig. **138 est APPLIQUÉE en prod le 2026-09-12** : `delete_organization` exige
> désormais le PROPRIÉTAIRE et refuse tant qu'un abonnement court, vérifié acteur par
> acteur (V5 à V9, détail en note de C-30). L'écran monte la zone rouge sur `isOwner` ✅
> (`OrganizationPage.tsx:494`), le dialogue dit ce qu'il advient de l'abonnement et des
> preuves ✅.
>
> 🔴 **CE QUI MANQUE, ET POURQUOI C-39 NE SE COCHE PAS AVEC C-30** : `stripe-org-refund`
> **n'existe toujours pas en production** (§ 11.1b, prompt C-65). Le parcours nominal
> — rembourser, puis supprimer — appelle une fonction absente : aujourd'hui la
> suppression échoue à la première étape au lieu de laisser un débit orphelin. C'est le
> bon sens de l'échec, ce n'est pas l'item fini. C-39 se clôt au déploiement de
> `stripe-org-refund`, pas avant.
>
> ✅ **L'ordre du flux est vérifié PAR MUTATION le 2026-09-12**, pas par relecture.
> `src/refund.guard.test.ts` (13 cas, verts). Deux mutations posées sur
> `useDeleteOrgFlow.ts`, chacune **vue rougir** puis défaite :
> inverser en `remove.mutate` → `refund.mutate` fait échouer « rembourse AVANT de
> supprimer » (`expected 551 to be less than 502`) ; remplacer `onSuccess:` par
> `onSettled:` fait échouer l'assertion qui exige que la suppression n'ait lieu QUE si
> le remboursement a réussi. La garde mesure donc bien les deux propriétés.
>
> ⚠️ **L'ordre réel n'est pas « résilier → rembourser »**, contrairement à ce que
> l'arbitrage du § 0 laisse lire : côté serveur `stripe-org-refund` fait
> `refunds.create` **puis** `subscriptions.cancel`, décidé et gardé (« rembourser puis
> échouer à résilier laisse la personne avec son argent et un accès de trop ; l'inverse
> lui prend les deux »). L'enchaînement mesuré est donc : **rembourser → résilier**
> (un seul appel) **→ supprimer**.
>
> ✅ **La moitié « rembourse » est livrée le 2026-09-04** (C-65). L'écran appelle
> `stripe-org-refund` et n'enchaîne sur `delete_organization` QUE si le remboursement
> a réussi — un seul geste, aucun débit orphelin, comme décidé. Le refus de la RPC
> n'est plus un intérim : il devient le filet SERVEUR, qui ne se déclenche jamais sur
> le parcours nominal mais rend la règle obligatoire pour un appel direct.

C-30 a trouvé la cascade par la suppression de COMPTE et demande le bon correctif (`ON DELETE SET
NULL` sur les deux tables de preuve). Cet audit a trouvé le **second chemin, bien plus court** :
un bouton rouge dans `/entreprise`, atteignable sans supprimer quoi que ce soit d'autre.

Relu en production le 2026-09-03 :

- `delete_organization(p_org)` est `SECURITY DEFINER` et n'exige que `public.is_org_admin(p_org)`,
  **pas le propriétaire**. `organizations` n'a aucune policy DELETE : la RPC est la seule porte,
  c'est la bonne structure, il manque juste la garde.
- `src/pages/OrganizationPage.tsx:478` monte la zone rouge sur `isAdmin`. Le bouton « Transférer la
  propriété » juste à côté, lui, est bien réservé au propriétaire (`user?.id === myOrg.ownerId`) :
  la restriction existait, elle n'a pas été portée sur le geste destructeur.
- La cascade emporte aussi `org_subscriptions` (vérifié : 21 des 22 FK vers `organizations(id)` sont
  en CASCADE). L'abonnement Stripe, lui, continue de courir : on facture une organisation dont la
  ligne n'existe plus, et le prochain event webhook tentera un upsert sur une clé étrangère morte.
- `DeleteOrganizationDialog` est par ailleurs un modèle de confirmation extrême (saisie du nom
  exact, liste des conséquences). Sa liste ne mentionne **ni l'abonnement, ni les preuves**.

**Scénario d'échec** : une entreprise a deux admins. Le second, qui ne paie rien, supprime
l'organisation. Le propriétaire continue d'être débité, n'a plus d'organisation, et la preuve de sa
renonciation au droit de rétractation a disparu avec.

**Exposition réelle aujourd'hui : nulle** (rien n'est encaissé, `ENTERPRISE_BILLING_ENFORCED =
false`). C'est ce qui en fait le moment le moins cher, et le jour d'après il est irrattrapable.

- **Où** : `delete_organization` (migration à écrire), `src/pages/OrganizationPage.tsx:478`,
  `src/components/organization/DeleteOrganizationDialog.tsx`.
- **Fini quand** : la RPC exige le PROPRIÉTAIRE et refuse tant qu'un abonnement est actif, l'écran
  applique la même règle, et le dialogue dit ce qu'il advient de l'abonnement. Le correctif de
  cascade reste celui de C-30, à ne pas dupliquer ici. Le tout **avant** T-38.

### C-45 · `loginWithGoogle` vise désormais des URL que l'allowlist Supabase ne couvre peut-être pas · **P1 · XS (code) + geste console**

Le code livré le 2026-09-03 construit `redirectTo` comme
`${origin}${préfixe de locale}${destination}` au lieu de `${origin}/dashboard` : c'est ce qui rend à
un anglophone sa version de l'application, et à une invitation d'entreprise réclamée via Google sa
destination (garde R-04, jeton à usage unique).

🔴 **Le code est en production ; le réglage qui le rend valide, non vérifié.** La *Redirect URL allow
list* du projet Supabase doit couvrir `https://thecosmo.app/**`. Si elle ne porte que
`/dashboard`, GoTrue ignore la valeur envoyée et renvoie sur le Site URL : la connexion Google
« marche » et perd silencieusement la destination — exactement le symptôme d'avant le correctif,
avec le correctif en place.

- **Où** : `src/modules/auth/AuthContext.tsx`, `loginWithGoogle` (le commentaire 🔴 le dit sur place).
- **Fini quand** : l'allowlist est vérifiée dans la console Supabase, **et** une vraie connexion
  Google depuis `/en/login?redirect=/org-invite/<token>` atterrit sur la page d'invitation, en
  anglais. Le geste console est dans [`a-faire-manuel.md`](./a-faire-manuel.md) ; la preuve
  attendue est ce parcours, pas la capture du réglage.

### C-24 · Quatre audits d'accessibilité jamais faits · **P2 · L** · 🟠 trois sur quatre faits le 2026-09-03

**A-3 en a passé trois** (parcours clavier, modales, `/agenda`), au clavier et dans le navigateur,
avec un harnais à témoin : `e2e/a11y-keyboard-audit.spec.ts`. Ils ont rendu **C-51 → C-55**, dont
trois corrigés dans la foulée.

- ❌ **VoiceOver iOS sur un vrai appareil reste entier**, et il ne se simule pas : aucun appareil
  réel n'était accessible à cette session. C'est la même limite que **A-4**, et les deux se feront
  ensemble ou pas du tout.
- ⚠️ Ce qui a été mesuré l'a été **sur Chromium desktop**. Un lecteur d'écran ne lit pas l'arbre
  d'accessibilité comme Playwright : ce qui est prouvé ici, c'est le FOCUS, pas l'annonce.
- ✅ **2026-09-04, la part faisable par une session est faite** : la limite « focus ≠ annonce » est
  écrite noir sur blanc dans [`docs/ACCESSIBILITY.md`](./docs/ACCESSIBILITY.md) § « Ce que nos
  mesures prouvent, et ce qu'elles ne prouvent pas », avec le partage ligne à ligne de ce qui est
  prouvé et de ce qui ne l'est pas ; et la check-list du quatrième audit est prête, jouable d'une
  traite sur un iPhone, témoin compris :
  [`docs/AUDIT-VOICEOVER-IOS.md`](./docs/AUDIT-VOICEOVER-IOS.md) (12 étapes, en mode démo). Elle
  est référencée par **M-40** dans `a-faire-manuel.md`.
  🔴 **Ce n'est pas l'audit.** Écrire le protocole ne mesure rien : C-24 reste ouvert.
- ✅ **2026-09-08, la check-list a été remise à jour après C-53, et rien de plus.** La version du
  09-04 (commit `7008bc6`) décrivait un produit d'avant le câblage des **53 surfaces modales
  maison** et d'avant la refonte de la liste mobile de `/tasks`. Ce qui a changé :
  - chaque surface câblée atteignable sur iPhone a sa ligne, avec le **nom accessible qu'elle doit
    annoncer**, résolu depuis `src/locales/fr/` et non deviné. Les 53 sont nommées : 46 dans le
    parcours, 7 en annexe B avec le motif qui les rend inatteignables au doigt (raccourci clavier,
    drapeau à `false`, aiguillage desktop) ;
  - quatre détecteurs uniformes par modale (nom annoncé, curseur qui entre, balayage qui ne
    ressort pas, « Z » qui ferme **et** rend le focus), plus les **six exceptions assumées** :
    trois surfaces qui refusent de se fermer pendant une opération, trois à fermeture par étages ;
  - la section `/tasks` refaite sur les gestes d'aujourd'hui, dont le point le plus exposé de
    l'écran : sur mobile, les actions d'une liste n'ont **aucun chemin autre que l'appui long**,
    les boutons flottants étant conditionnés à `!isMobile`. Si le double tap maintenu ne passe pas
    sous VoiceOver, six actions deviennent inatteignables ;
  - cinq surfaces dont le nom accessible est écrit **en dur en français** sont marquées, et une
    passe en anglais est prévue pour les entendre ;
  - le témoin d'entrée corrigé : la clé est `landing:hero.demoAria`, pas `landing.demoAria`.
  🔴 **Une check-list à jour n'est pas une check-list jouée.** Cette passe n'a rien mesuré sur un
  appareil : elle a mis l'instrument au niveau du produit, pas relevé une valeur.
- 🔴 **C-24 RESTE OUVERT, et le restera tant qu'aucune mesure sur appareil réel n'existe.** Aucune
  ligne de `docs/AUDIT-VOICEOVER-IOS.md` n'est cochée, aucun finding `V-xx` n'a été ouvert, et rien
  dans ce dépôt ne doit dire le contraire. Une seule chose refermera cet item : un compte-rendu
  portant un modèle d'iPhone, une version d'iOS et des verbatims.
- **Fini quand** : le quatrième est fait **sur un appareil réel** et ses findings sont ici, chacun
  avec son modèle, sa version d'iOS et son verbatim.

> ✅ **Le « trouvé en passant » est TRAITÉ, le 2026-09-14.** `CategoryManager` — une modale de
> **452 lignes**, câblée sur `useModalA11y` et montée nulle part — est supprimée. Mesuré avant :
> trois imports dans tout le dépôt, tous pour le seul `getColorHex`, zéro import dynamique ; le
> composant, `ICONS`, `getColorFr` et le type `Category` n'avaient aucun consommateur. Ce qui
> survit vit sous son vrai nom, `src/lib/category-colors.ts`.
>
> 🔴 **Il était classé « à traiter ailleurs » depuis le 2026-09-03 et personne ne l'a traité, parce
> qu'un défaut sans item n'a pas de propriétaire.** C'est la leçon de la note, plus que le code
> qu'elle désignait.
>
> ⚠️ **Le coût n'était pas le poids, il était la lecture** : un composant mort mais CÂBLÉ compte
> comme une surface modale. Il gonflait l'inventaire de C-53 et de `docs/AUDIT-VOICEOVER-IOS.md`, et
> quelqu'un aurait fini par chercher au doigt, sur un iPhone, une modale qu'aucun écran n'ouvre.
> **Du code mort ne coûte pas des octets, il coûte du temps à qui le prend pour vivant** — et il
> allongeait précisément la check-list que cet item attend.
>
> 🔴 **La garde `tracked-imports` a mordu sur ce correctif** : les trois imports repointés vers un
> fichier pas encore suivi par git ont fait tomber le test — le défaut exact des trois `fix(build)`
> du 09-13/09-14. Suite complète après coup : **228 fichiers / 2 586 tests, exit 0**, et la
> couverture MONTE (30,67 → 30,73 % de statements), le code mort quittant le dénominateur.

### C-58 · Le blocage sécurité qui forçait React 19 est déjà levé · **P3 · XS** · trouvé par l'audit A-6

> 🟠 **Ce n'est plus un chantier, c'est un arbitrage — et DEUX affirmations de cet item sont
> devenues fausses le 2026-09-14. Corrigées ici, pas en silence.**
>
> **1. Le plafond de 323 000 EST désormais dans l'histoire du dépôt.** Commit `7134d7fe`, run CI
> `34846164939` vert (C-76). La phrase « contre `main` tel qu'il est commité, React 19 à 329,8 ko
> passerait la garde en silence » ne décrit plus rien : la garde de `main` est à 323 000, et React
> 19 y **échouerait**, comme il le doit. Le blocage n'est plus adossé à un cliquet fantôme — il est
> opposable. **Le seuil de reprise chiffré plus bas (283,5 ko) est inchangé et devient la seule
> lecture valable.**
>
> **2. Les 9 corrections de types NE SONT PAS portables sur `main`, contrairement à ce que dit le
> paragraphe « ce que différer coûte ».** Mesuré, pas déduit : les sept fichiers de la branche ont
> été appliqués sur `main` et `tsc -b` rend **72 erreurs** dans une soixantaine de fichiers. Sous
> les types **React 18**, `RefObject<T | null>` n'est pas assignable à `LegacyRef<T>` — donc chaque
> `ref={...}` qui consomme un de ces refs élargis casse. Le port a été **défait** ; `main` est
> propre (`tsc -b` sans erreur). Ces 9 lignes sont justes **sous React 19 et seulement là** : elles
> ne sont pas un acompte qu'on pourrait verser d'avance pour alléger la reprise.
>
> ⚠️ **Ce que ce deuxième point apprend au-delà de React 19** : « un correctif de types est
> mécanique, donc portable » est une intuition, pas une mesure. Élargir un type de prop est une
> rupture de contrat dans le sens des CONSOMMATEURS, et ils étaient soixante.
>
> **Ce qui reste vrai** : `feat/react-19` porte la migration jouée (`b101be9f`, `7a1b9940`), tout
> est vert **sauf `check:bundle`** (chemin critique 329,8 ko), et elle est **2 commits devant
> `main` et ~50 derrière**. Plus elle attend, plus le rebase coûte.

`CLAUDE.md` et `faille.md` décrivaient un piège à deux CVE (`GHSA-qwww-vcr4-c8h2`,
`GHSA-wrjc-x8rr-h8h6`) sans issue sous React 18. **Mesuré contre trois sources indépendantes**,
ce n'est plus vrai depuis le 2026-07-28 :

1. L'avis GitHub lui-même (interrogé via l'API, pas son résumé dans la doc) porte **deux plages
   disjointes avec chacune son propre correctif** : `[7.12.0, 7.18.2)` corrigée en **7.18.2**,
   `[8.0.0, 8.3.0)` corrigée en 8.3.0. La doc les avait fusionnées en une seule plage
   (« ≥ 7.12.0 < 8.3.0 »), ce qui masquait le correctif intermédiaire.
2. `react-router@7.18.2` (publié le 2026-07-28) est **déjà celui installé** : `package.json` porte
   `^7.18.2`, `package-lock.json` l'épingle exactement.
3. `npm audit` local (0 alerte sur `react-router` — les 2 seules alertes actuelles viennent de
   `shadcn`, C-18, sans rapport) et l'API OSV interrogée pour `react-router@7.18.2` (`{"vulns":[]}`)
   rendent tous les deux zéro résultat. `GHSA-wrjc-x8rr-h8h6` est fermé dès 7.18.0.

**Conséquence** : le dépôt ferme déjà les deux CVE, aujourd'hui, sous React 18, sans avoir rien
changé. La migration React 19 + `react-router` 8 n'est plus une urgence sécurité — chiffrage complet
dans [`docs/MIGRATION-REACT19.md`](./docs/MIGRATION-REACT19.md).

- ❌ **Ça ne change rien à la règle `npm audit fix`** : toujours ne pas la lancer sur ce paquet sans
  relire l'avis à la main.
- **Correctif documentaire livré** : `faille.md` § « Ouvert · à planifier » corrigé.
- **Fini quand** : fini — c'est un constat, pas un correctif de code. Le moment de la migration
  (désormais un arbitrage produit, plus une urgence) est dans `a-faire-manuel.md` M-33.

> #### 🔴 La MIGRATION a été jouée le 2026-09-12, et elle BUTE sur le budget de bundle
>
> ⚠️ **Deux textes disaient deux choses**, et c'est à corriger en premier : cet item se déclare
> « fini — c'est un constat », alors que l'arbitrage du § 0 et le prompt de
> `prompts-a-faire-code.md` traitaient `C-58` comme **le chantier de migration**. Le travail
> ci-dessous est celui du chantier ; le constat, lui, reste vrai et clos.
>
> Branche **`feat/react-19`**, React 18.3.1 → **19.3.0**. Tout est vert **sauf une chose**, et
> c'est elle qui décide :
>
> | Gate | Verdict |
> |---|---|
> | `tsc -b` | propre, **après 9 corrections de types** (voir plus bas) |
> | `npm run lint` | **0 erreur** |
> | `npm test` | **226 fichiers / 2 500 tests**, zéro échec |
> | `i18n:check` · `i18n:scan` · `i18n:identical` · `validate:migrations` · `check:rls` · `check:legal` | vertes |
> | `npm run build` | réussit |
> | `npx playwright test --project=chromium` | **104 passés, 3 ignorés, 0 échec** (23,8 min). Le seul rouge est `e2e/_tmp-probe.spec.ts`, la sonde jetable NON SUIVIE par git que `CLAUDE.md` documente |
> | **`npm run check:bundle`** | ❌ **exit 1** — chemin critique **329,8 ko** contre un plafond de **323,0** |
>
> **Ce qui coûte** : `vendor-react` passe de **72,1 à 95,4 ko gzip**, soit **+23,3 ko (+32 %)**. Le
> chunk a été ouvert pour écarter un artefact — pas de `react-dom/server`, pas de `renderToString`,
> pas de `__DEV__`, pas de build de développement. **Le surcoût est réel.**
>
> 🔴 **Et il ne peut pas se régler en remontant le plafond.** Celui-ci a été ABAISSÉ à 323,0 ko le
> 2026-09-11 pour satisfaire le critère de sortie de **C-14** (5 % de marge sur les deux budgets,
> obtenue à 5,2 %). React 19 la consomme entièrement et déborde de 6,8 ko. Le remonter rouvrirait
> C-14 le jour même, et la règle 1 de ce fichier l'interdit.
>
> Le seul candidat pour trouver ces 7 ko est `vendor-animation` (49,0 ko), tiré dans le chemin
> critique par **un seul import statique** : `MotionConfig` dans `App.tsx`. ❌ **Le différer
> naïvement est exclu** : c'est un fournisseur de CONTEXTE, les premiers écrans rendraient sans
> `prefers-reduced-motion` — la classe de régression qui a déjà coûté deux fois à ce dépôt.
>
> **Trois issues, aucune technique** : (1) différer, l'option par défaut puisque l'urgence sécurité
> est tombée ; (2) sortir framer-motion du chemin critique pour de vrai, chantier à part avec sa
> mesure au navigateur sous `reduce` ; (3) accepter de rouvrir C-14 — décision d'Axel.
>
> **Ce que la migration a rendu au passage, et qui vaut indépendamment** : l'étude
> `docs/MIGRATION-REACT19.md` annonçait « un seul site » à corriger (`useRef<T>()` sans argument,
> déjà fait par C-60). En réalité, sous les types React 19, `useRef<T>(null)` rend
> `RefObject<T | null>` : **8 erreurs de compilation, 9 déclarations de props à élargir**, dans 5
> fichiers. Le correctif est juste et mécanique — mais un `grep` sur un MOTIF ne mesure pas une
> CLASSE de rupture. Le § 4bis du document porte le détail et les chiffres.
>
> ⚠️ `react-router` 8 (PR 2) n'a **pas** été tenté : il exige React ≥ 19.2.7 en peer, donc il est
> séquentiel derrière une PR 1 qui ne peut pas être posée.

> #### ✅ ARBITRAGE RENDU le 2026-09-13 : **on DIFFÈRE** (issue 1), et le seuil de reprise est chiffré
>
> Décision d'Axel sur M-41. `feat/react-19` reste **poussée et non fusionnée**. Rien n'est annulé.
>
> 🔴 **Ce que la remesure du jour a rendu, et qui corrige la lecture du blocage** : le plafond de
> **323 000 o n'est dans AUCUN commit**. `git log -S"323_000" -- scripts/check-bundle-budget.mjs`
> ne rend rien, et `git show HEAD:scripts/check-bundle-budget.mjs` porte encore `critical: 370_000`
> / `entry: 78_000`. L'abaissement du 2026-09-11 et la sortie de `sonner` qui le finance vivent dans
> l'arbre de travail **non commité** d'une session voisine. Contre `main` tel qu'il est commité,
> React 19 à 329,8 ko **passerait la garde en silence**. Le blocage est réel, mais il s'appuie sur un
> cliquet qui n'est pas encore dans l'histoire du dépôt : raison de plus de ne pas fusionner.
>
> **Deux seuils, pas un.** Un seul ne suffit pas, et le premier est un piège :
>
> | Seuil | Chemin critique React 18 exigé | Coupe à trouver | Résultat |
> |---|---|---|---|
> | `check:bundle` simplement verte | ≤ **299,7 ko** | 6,8 ko | garde verte, **0 %** de marge |
> | Critère de sortie de **C-14** préservé (5 %) | ≤ **283,5 ko** | **22,8 ko** | React 19 fusionné sans rouvrir C-14 |
>
> Départ : 306,3 ko (2026-09-11). Une garde qui passe à 0,0 % de marge rouvre C-14 le jour même,
> exactement comme un plafond relevé. **Le seuil opposable est 283,5 ko.**
>
> Le seul gisement de cette taille reste `vendor-animation` (49,0 ko). **L'issue 2 n'est donc pas une
> alternative à l'issue 1, c'est sa condition de reprise.**
>
> **Ce que différer coûte, écrit pour que personne ne le redécouvre** : `react-router` 8 reste bloqué
> derrière (sans conséquence sécurité, cf. le constat ci-dessus) ; la classe de bug « composant
> shadcn recopié de l'amont React 19, `ref` jamais attaché » reste ouverte et **silencieuse par
> construction** (elle a coûté `Button` puis `Input`) ; et les 9 corrections de types de la branche
> (`RefObject<T>` → `RefObject<T | null>`) sont justes indépendamment de React 19, donc portables sur
> `main` à part si on veut alléger la reprise.
>
> Détail et calculs : `docs/MIGRATION-REACT19.md` § 4bis.c.

### 🟠 A-4 · mobile sur appareil réel · TENTÉ le 2026-09-03, moitié appareil NON FAITE

🔴 **Cet audit reste dans le tableau ci-dessous, et ce n'est pas un oubli.** Son périmètre est « le
produit connecté sur un appareil RÉEL », et son livrable exige pour chaque finding **le modèle, la
version d'OS et le navigateur**. Aucun appareil n'était accessible : son propre prompt tranche ce
cas, un audit sans appareil devient « à refaire », pas « fait ». Le protocole de reprise, écran par
écran, est dans [`a-faire-manuel.md`](./a-faire-manuel.md) §7 (M-25).

Ce que la moitié **indépendante de l'appareil** a quand même rendu, mesuré en viewport émulé et par
sonde, jamais déduit :

| Finding | Comment il a été établi |
|---|---|
| **C-56** · le haut de trois écrans devient inatteignable, clavier ouvert | carte de `FirstRunSetup` reconstruite avec sa liste de classes réelle dans le CSS du projet, viewport 375 × 350 : haut à **-28,8 px** pour un `scrollTop` déjà nul, course de défilement de 70 px pour 124 px de débordement |
| **C-57** · cibles tactiles sous 44 px | comptage des commandes (jamais des liens de texte) sur six routes en démo à 375 × 812 : 16 × 16 px pour cocher une tâche sur `/dashboard`, 42 boutons à 40 × 40 sur `/okr`, zéro sur les trois routes migrées |
| *remesure de **C-38*** | le geste que C-38 réclamait explicitement : une sonde soumise au scanner, qui rend `0` sur trois chaînes qu'il devrait voir, et qui nomme enfin le mécanisme (`CODE_QUOTING` confond le `:` d'un ternaire avec celui d'un littéral d'objet) |

Ce qu'il a **infirmé**, et qui est donc clos, chaque point mesuré plutôt que lu :

- **le plancher de 16 px sur les champs tient**, y compris là où une classe Tailwind explicite le
  contredit : `input[type=time]` avec `text-[15px]`, `input[type=date]` avec `text-[0.765997rem]`
  et `input[type=text]` avec `text-[15px]` calculent **tous 16 px** à 375 px de large. iOS Safari ne
  zoomera donc pas au focus sur la saisie d'événement. C'était le premier soupçon de cet audit, et
  il était faux ;
- **`/entreprise` ne cache rien derrière la barre d'onglets**, alors que sa racine ne porte que
  `py-6`, soit 24 px : mesuré défilement en butée, l'élément le plus bas finit à 679 px pour une
  barre qui commence à 747. C'est `Layout` qui réserve la place, pas la page. Rien à corriger, mais
  la page ne tiendrait pas seule ;
- **`FirstRunSetup` est sain sous `prefers-reduced-motion`** : il passe par `useSlideUpEntrance`,
  qui n'émet **aucune** clé de transform dans ce mode, donc aucune valeur résiduelle ne peut le
  laisser hors écran ;
- **la conversion jour vers instant de la ligne de date mobile est correcte** :
  `EventModalFormMobile` formate par `new Date(startDate + "T12:00:00")`, donc midi **local**, le
  seul motif qui survit aux deux sens de décalage. C'était le point 4 du prompt, et il ne casse pas
  ici. Reste à confirmer sur un appareil réglé sur un fuseau négatif, la roue système étant, elle,
  hors de portée d'une émulation.

⚠️ **Ce que cette moitié ne remplace pas** : la note de 76 / 100 de `docs/MOBILE.md` reste sans
**aucune** mesure sur téléphone, et les pièges qu'elle documente (WebKit, `100vh`, clavier virtuel,
scroll d'un conteneur qui n'est pas `window`) viennent tous de bugs qui ne se voyaient **pas** en
émulation. Un viewport de 375 × 350 modélise Android ; il ne modélise pas iOS, qui ne réduit pas son
viewport de mise en page.

---

## Index des items clos

**71 identifiants clos**, détail dans [`docs/archive/a-faire-code-jusqua-2026-10-11.md`](./docs/archive/a-faire-code-jusqua-2026-10-11.md) (chercher `### C-NN`) :

`C-01` · `C-02` · `C-03` · `C-04` · `C-05` · `C-06` · `C-07` · `C-08` · `C-09` · `C-10` · `C-11` · `C-12` · `C-13` · `C-14` · `C-15` · `C-16` · `C-17` · `C-18` · `C-19` · `C-20` · `C-21` · `C-22` · `C-23` · `C-25` · `C-26` · `C-27` · `C-28` · `C-29` · `C-30` · `C-31` · `C-32` · `C-33` · `C-34` · `C-35` · `C-36` · `C-37` · `C-38` · `C-40` · `C-41` · `C-42` · `C-43` · `C-44` · `C-46` · `C-47` · `C-48` · `C-49` · `C-50` · `C-51` · `C-52` · `C-53` · `C-54` · `C-55` · `C-56` · `C-57` · `C-59` · `C-60` · `C-61` · `C-62` · `C-63` · `C-64` · `C-66` · `C-67` · `C-68` · `C-69` · `C-70` · `C-71` · `C-72` · `C-73` · `C-74` · `C-75` · `C-76`

Plus les items tenus en lignes de tableau et non en titres : `C-81` → `C-120`
(§ 12 de l'archive, chercher `**C-NN**`).

Audits passés : `A-1`, `A-2`, `A-3`, `A-5`, `A-6`, `A-7`, `A-8` (§ 10 de l'archive). Reste `A-4`, ci-dessus.

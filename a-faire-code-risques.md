# Tableau de risque · `a-faire-code.md`

**Dressé le 2026-09-03**, à partir des 66 items C-01 → C-66 de
[`a-faire-code.md`](./a-faire-code.md). **8 sont clos**, **58 sont ouverts** et notés ci-dessous.

Ce fichier ne porte **aucun statut** : il ne fait que classer. Le statut de chaque item reste dans
`a-faire-code.md`, la sécurité dans `faille.md`, les gestes manuels dans `a-faire-manuel.md`.

---

## 🔴 L'hypothèse de cotation, et pourquoi ce n'est pas celle d'aujourd'hui

> **10 000 comptes gratuits · 1 000 comptes payants · l'encaissement est actif.**
> Stripe est en compte live, `ENTERPRISE_BILLING_ENFORCED` et `billing_flags.enterprise_seat_limit`
> sont armés, `PREMIUM_ENFORCED` vaut `true`.

**Une première version de ce fichier cotait l'exposition d'aujourd'hui**, et rangeait quatre défauts
majeurs en « exposition nulle, rien n'est encaissé, 0 ligne dans les tables ». C'est vrai, et c'est
inutile : coter le risque d'un produit sans clients revient à mesurer la solidité d'un pont sans
voitures dessus. Le risque d'un défaut, c'est ce qu'il coûte **quand le produit marche**, pas ce
qu'il coûte pendant qu'il n'a personne à casser.

Cette version cote donc le produit en charge. Trois choses en découlent, et ce sont les trois raisons
pour lesquelles le classement précédent était trompeur :

1. **Les quatre défauts « sans conséquence aujourd'hui » sont les quatre premiers du tableau.** Ils
   n'étaient pas inoffensifs, ils étaient en attente de victimes.
2. **Aucun item ne baisse en passant à l'échelle.** Pas un. La montée en charge ne referme rien,
   elle ne fait que révéler.
3. **Trois natures de coût apparaissent qui n'existaient pas** : le remboursement légal, la facture
   d'infrastructure, et la fuite de revenu. Elles ne se voyaient pas à zéro client.

⚠️ **Ce tableau est un MODÈLE, pas une mesure.** Les fréquences de la colonne « Combien de gens »
sont déduites de la taille de la base et de ratios d'usage courants, jamais observées sur cette
application. Ce dépôt distingue soigneusement les deux : une ligne ci-dessous ne prouve rien, elle
ordonne. La preuve reste dans l'item d'origine.

---

## 🟢 La décision du 2026-09-03, et ce qu'elle referme

> **« L'utilisateur doit pouvoir se faire rembourser le mois en cours, à tout moment, mais que le
> mois en cours. »**

C'est la décision la plus rentable de ce tableau, et elle ne coûte pas un euro de plus que ce que la
loi impose déjà : sur un abonnement **mensuel**, rembourser le mois en cours est **exactement** le
remède que l'art. L215-1 accorde au consommateur qu'on n'a pas prévenu de sa reconduction. La règle
commerciale **recouvre** l'obligation légale au lieu de s'y ajouter. On cesse d'arbitrer au cas par
cas, et le contentieux disparaît avec le sujet du contentieux.

Trois lignes bougent, et une quatrième apparaît :

| Item | Avant | Après | Pourquoi |
|---|---|---|---|
| **C-34** · l'avis de reconduction n'est jamais parti | 🔴 25 | 🟠 15 | Le remède est déjà servi d'avance. L'obligation d'envoyer l'avis demeure, sa **sanction** est désamorcée |
| **C-30** · la cascade détruit les preuves L215-1 et L221-28 | 🔴 15 | 🟡 9 | Une preuve sert à gagner une discussion. Il n'y a plus de discussion : on rembourse sans demander pourquoi |
| **C-35** · les 3 Edge Functions déployées divergent du dépôt | 🔴 25 | 🔴 25 | **Inchangé.** Sa moitié « avis de reconduction » se referme, sa moitié `delete-account` non, et c'est la plus lourde des deux |
| **C-65** · le remboursement n'existe nulle part dans le code | . | 🔴 20 | **Nouveau.** Aucune fonction n'appelle `refunds.create` : le portail Stripe résilie, il ne rembourse pas |

🔴 **Une règle sans mécanisme est une phrase.** Tant que la personne doit écrire un e-mail pour
obtenir ce qu'on lui promet, on est exactement dans la situation que la décision voulait éviter. Les
trois baisses ci-dessus ne sont acquises **qu'une fois C-65 livré** : d'ici là, elles décrivent
l'intention, pas le produit.

⚠️ **L'annuel n'est pas couvert par l'énoncé.** Sur 168 à 1 680 € facturés une fois par an, « le mois
en cours » ne désigne rien, et le remède légal porte sur tout ce qui a été versé depuis
l'anniversaire. Ce tableau retient le **prorata des mois non consommés**, seule lecture qui referme
l'exposition annuelle comme la règle mensuelle referme la sienne. C'est un arbitrage commercial, pas
une question de droit : détail et la seconde option dans C-65.

---

## Méthode de notation

**Risque = Gravité × Exposition.**

| Gravité | Ce que ça veut dire, avec de l'argent qui rentre |
|---|---|
| **5** | Destruction irréversible de données de tiers, ou faute opposable avec conséquence financière directe |
| **4** | Impasse produit pour une population, obligation légale non tenue, fuite de revenu, ou perte de données rattrapable |
| **3** | Un utilisateur est bloqué, mal informé, ou lit une phrase fausse |
| **2** | Défaut visible sans conséquence, ou dette qui coûtera plus tard |
| **1** | Cosmétique, ou strictement interne |

| Exposition | Personnes touchées par mois, sur 11 000 comptes |
|---|---|
| **5** | Plus de 1 000 · le chemin principal, tous les jours |
| **4** | 100 à 1 000 · une population identifiée |
| **3** | 10 à 100 |
| **2** | 1 à 10 |
| **1** | Moins d'une par mois |

### Les quatre niveaux d'urgence

| Niveau | Règle |
|---|---|
| 🔴 **P0** | **Incident.** Le défaut produit une perte d'argent, de données ou de droits **en ce moment même**. Rien d'autre ne passe devant. |
| 🟠 **P1** | **Deux semaines.** Perte de revenu, population significative bloquée, ou garde dont dépend la fiabilité de tout le reste. |
| 🟡 **P2** | **Deux mois.** Réel, chiffré, borné. |
| ⚪ **P3** | **Fond de tableau, ou arbitrage à écrire.** Un arbitrage qui ne se rend pas devient un oubli. |

---

## Synthèse

**58 items ouverts** : les 56 d'origine, plus C-65 (le mécanisme de remboursement) et C-66 (les
quatre capacités d'équipe sans écran, trouvées en mesurant C-49).

| Urgence | Items | Dont gravité ≥ 4 | Nature dominante du coût |
|---|---|---|---|
| 🔴 **P0** | 3 | 3 | Destruction irréversible, promesse non tenable |
| 🟠 **P1** | 13 | 9 | Revenu, rétention, facture d'infrastructure |
| 🟡 **P2** | 24 | 5 | Conformité opposable, qualité perçue |
| ⚪ **P3** | 18 | 0 | Dette, décisions à écrire |
| ✅ clos | 8 | . | . |

> 🟢 **27 arbitrages ont été tranchés le 2026-09-03** et sont écrits au §0 de
> [`a-faire-code.md`](./a-faire-code.md). Ils ne changent pas les cotations, à une exception près :
> **C-04 tombe de 20 à 2**, parce qu'Axel a choisi de supprimer le mur-pub et les jetons plutôt que
> de les réparer. C'est le seul risque de ce tableau qu'on ferme en retirant du produit au lieu d'y
> ajouter du code.

---

## 🔴 P0 · incident en cours

Ces trois lignes partagent une propriété que les autres n'ont pas : **le temps qui passe aggrave le
coût sans qu'aucun utilisateur ne se plaigne**. On ne les découvre pas par un ticket, on les
découvre par une table vide, ou par quelqu'un qui réclame ce qu'on lui a promis.

| Item | Défaut | G | E | Risque | Combien de gens | Ce que ça coûte réellement |
|---|---|---|---|---|---|---|
| **C-35** | Les 3 Edge Functions déployées divergent du dépôt, de 3 façons différentes | 5 | 5 | **25** | **tous** | La décision du 2026-09-03 referme sa moitié « avis de reconduction ». **Elle ne touche pas à l'autre.** La version de `delete-account` qui tourne en production n'existe dans aucun commit, et le correctif C-29 (une lecture avalée qui peut détruire une organisation entière avec les données de tous ses membres) **n'y est pas**. Second effet, plus large : toute conclusion tirée en lisant `supabase/functions/` est fausse d'avance. C'est le seul item qui **invalide les autres items**. |
| **C-65** | Le remboursement du mois en cours n'existe nulle part dans le code | 4 | 5 | **20** | **1 000 payants** | La décision d'Axel désamorce le contentieux L215-1 **à condition d'être exécutable**. Aujourd'hui aucune fonction n'appelle `refunds.create` : `stripe-org-portal` ouvre le portail Stripe, qui sait résilier et ne rembourse pas. Une garantie qu'on annonce et qu'on ne peut pas servir en un clic est pire qu'une garantie absente : elle crée l'attente **et** la discussion. C'est la ligne qui fait descendre C-34 et C-30 ; tant qu'elle n'est pas livrée, leurs baisses sont une intention. |
| **C-39** | N'importe quel **admin**, pas seulement le propriétaire, supprime l'organisation · la cascade emporte 21 tables dont `org_subscriptions` | 5 | 2 | **10** | 1 à 10 / mois | Le risque n'est pas la fréquence, c'est l'asymétrie. Un admin qui ne paie rien détruit les données de toute son équipe, **et l'abonnement Stripe continue de courir** : on débite un client dont l'organisation n'existe plus, et le prochain webhook tente un upsert sur une clé étrangère morte. Aucun geste ne rattrape ça, et **aucune politique de remboursement ne rend les données** : c'est le seul P0 que la décision du 2026-09-03 ne touche pas du tout. |

> ⚠️ **C-29 est clos dans le dépôt et vivant en production.** La lecture avalée qui peut détruire une
> organisation entière est marquée corrigée le 2026-09-03, et **C-35 prouve que le dépôt n'est pas ce
> qui tourne**. Tant que `delete-account` n'est pas redéployée, c'est toujours l'ancienne qui
> s'exécute. Ce n'est pas un cinquième P0, c'est la démonstration du premier.

---

## 🟠 P1 · deux semaines

| Item | Défaut | G | E | Risque | Combien de gens | Ce que la charge change |
|---|---|---|---|---|---|---|
| **C-47** | La suite de tests rend des échecs **faux** sous charge, indistinguables des vrais | 4 | 5 | **20** | tous, indirectement | C'est la garde dont dépendent toutes les autres. Le réflexe qu'elle installe, « c'est la contention, je rejoue », est celui qui expédiera une régression vers 11 000 comptes. |
| **C-34** | `renewal-notice.yml` sort en **vert** quand son secret est absent, donc l'avis quotidien de reconduction n'est **jamais** parti | 3 | 5 | **15** | **1 000 payants**, à chaque anniversaire | 🟢 Descend de 25 grâce à la décision du 2026-09-03 : le remède de L215-1 est servi d'avance, donc la sanction est désamorcée. **L'obligation d'envoyer l'avis, elle, demeure**, et une garde qui sort en vert sur une obligation quotidienne non tenue reste le motif exact retiré d'`uptime.yml` le même jour. Redevient P0 si l'annuel part sur l'option (b) de C-65. |
| **C-28** | Le canal d'alerte d'ops est inerte : le secret Actions n'existe pas | 4 | 4 | **16** | tous | À 27 utilisateurs, apprendre un incident avec quatre jours de retard était embarrassant. À 11 000, c'est l'écart entre « détecté par la garde » et « détecté par les clients ». Le précédent est documenté : quatre jours sans lecture pendant qu'un script tiers exfiltrait email et nom. |
| **C-37** | Six « Annuler » rendent l'objet sous un **nouvel identifiant** | 4 | 4 | **16** | 100 à 1 000 / mois | Le cas du lot est le pire : annuler la suppression de dix tâches rend dix tâches détachées de toutes leurs listes et de leur KR, sans une seule erreur à l'écran. À l'échelle, c'est de la perte de données silencieuse, quotidienne, et non détectable par la personne au moment où elle se produit. |
| **C-56** | Clavier ouvert, le haut de `FirstRunSetup`, `BugReportModal` et `InviteOrJoinModal` est **inatteignable** | 4 | 4 | **16** | 200 à 500 nouveaux comptes Android / mois | `FirstRunSetup` existe pour retenir une population précise : la moitié des inscrits qui ne revenaient jamais. Sur Android, cet écran ampute sa propre question. Le coût se paie en inscriptions perdues, la ligne du produit qu'on cherche justement à faire monter. |
| **C-53** | Aucune modale maison ne piège le focus (58 fichiers) | 4 | 4 | **16** | 100 à 300 personnes au clavier seul ou au lecteur d'écran | Avec des clients qui paient, l'accessibilité cesse d'être une note interne et devient opposable (EAA). `EventModal` au clavier : le focus reste derrière l'overlay, Échap ne fait rien. On remplit un formulaire qu'on ne peut pas atteindre. |
| **C-46** | 60 accès `localStorage` bruts dans 14 dépôts de démo | 4 | 4 | **16** | 5 à 10 % des sessions de démo | La démo **est** le tunnel d'acquisition. En navigation privée stricte et en webview (réseaux sociaux, applications de messagerie, exactement d'où vient le trafic), `getItem` lève **avant** le `try` : le mode entreprise en démo tombe. Un prospect sur dix voit une page cassée à la place du produit. |
| **C-05** | Le badge d'organisation lit jusqu'à 1 000 tâches d'équipe pour afficher un nombre, sur **toutes** les pages protégées | 3 | 5 | **15** | tous, en permanence | À 27 comptes c'était une inélégance. À 11 000, c'est la ligne d'egress et le palier Supabase. Le précédent chiffré du dépôt : 91,5 % du trafic Supabase venait de deux onglets jamais rechargés. |
| **C-57** | Cibles tactiles : **16 × 16 px** pour cocher une tâche sur `/dashboard` | 3 | 5 | **15** | 3 000 à 5 000 utilisateurs mobiles | Le geste principal du produit, sur son écran d'accueil, à moins de la moitié de la cible WCAG. Chaque ratage ouvre la tâche au lieu de la cocher. |
| **C-12** | La landing est la seule page lente du site (56-63 en CI, TBT jusqu'à 1 633 ms) | 3 | 5 | **15** | tout le trafic entrant | Porte d'entrée unique, et le SEO est le seul levier d'acquisition en cours. À 11 000 comptes il faut continuer d'en faire entrer : c'est le haut du tunnel qui est lent. |
| **C-45** | `loginWithGoogle` vise des URL que l'allowlist Supabase ne couvre peut-être pas | 3 | 4 | **12** | 100 à 1 000 connexions Google / mois | Le code **est en production**. Si l'allowlist ne porte que `/dashboard`, GoTrue ignore la destination : les invitations d'entreprise réclamées via Google, et la langue des anglophones, se perdent en silence. |
| **C-31** | `report-bug` est un relais d'e-mail ouvert, sans aucune limite de débit | 5 | 2 | **10** | 1 incident suffit | Un produit à 11 000 comptes est une cible visible. Une boucle de quelques lignes brûle la réputation d'expéditeur du domaine, **et c'est le domaine qui porte les e-mails d'authentification et les avis L215-1**. Un seul abus coupe l'inscription et la conformité pour tout le monde, pendant des mois. |
| **C-08** | Cache `productIndex` jamais invalidé dans les Edge Functions Stripe | 4 | 2 | **8** | quelques dizaines par rotation de secret | La première moitié de l'item (identifiants de test présentés à une clé live) est réputée traitée par la bascule elle-même. La seconde ne l'est pas : un isolate Deno survit longtemps, et après une rotation des prix il continue d'indexer les anciens produits. On annonce un montant et on en facture un autre, ce que le dépôt s'interdit explicitement. |

---

## 🟡 P2 · deux mois

| Item | Défaut | G | E | Risque | Ce que la charge change |
|---|---|---|---|---|---|
| **C-62** | Une centaine de messages d'erreur atteignent l'écran sans passer par aucun catalogue | 3 | 5 | **15** | Des centaines d'échecs de mutation par jour à cette taille. « Impossible de créer le lien : localStorage is not defined » devient une phrase que des gens lisent vraiment. |
| **C-66** | Quatre capacités d'équipe ont leur back-end, leur permission et leur trigger, et aucun écran | 3 | 3 | **9** | 🆕 Trouvé le 2026-09-03 en mesurant C-49. Un projet d'équipe ne peut pas être archivé, un OKR d'équipe pas modifié, une catégorie d'équipe ni renommée ni supprimée. Rien ne casse, personne ne voit d'erreur : c'est un trou de parcours, invisible à la relecture puisque le code du chemin existe |
| **C-30** | `renewal_notices` et `withdrawal_consents` en `ON DELETE CASCADE` : supprimer un compte détruit ses propres preuves | 3 | 3 | **9** | 🟢 Descend de 15. Une preuve sert à gagner une discussion, et la décision du 2026-09-03 supprime la discussion : on rembourse sans demander pourquoi. Reste que ces tables sont décrites partout comme des pièces à produire, que la destruction est **irréversible**, et que la migration `SET NULL` est du travail d'une heure |
| **C-36** | `report-bug` et `renewal-notice` n'ont aucune garde, d'aucune sorte | 4 | 3 | **12** | Ces deux fonctions portent désormais une obligation légale quotidienne. C'est le corollaire direct de C-34 et C-35 : sans garde, le défaut revient. |
| **C-27** | Les parcours livrés en septembre n'ont aucun test E2E | 3 | 4 | **12** | Onboarding, calendrier et dépendances de tâches sans filet de bout en bout. Une régression sur l'onboarding se paie maintenant en inscriptions. |
| **C-64** | `AppErrorBoundary` n'offre qu'un rechargement, là où la racine offre une sortie | 4 | 3 | **12** | Quand la cause est déterministe (valeur de stockage, réponse en cache), recharger ramène le même écran. À 11 000 comptes, cette impasse est atteinte tous les jours par quelqu'un. |
| **C-24** | VoiceOver iOS sur un vrai appareil, jamais fait | 4 | 3 | **12** | Le lecteur d'écran de la plateforme mobile dominante n'a **jamais** été essayé, et l'accessibilité est devenue opposable. Ce n'est pas un finding, c'est un trou de couverture qui a maintenant un prix. |
| **C-07** | 17 feuilles animées encore écrites à la main | 4 | 3 | **12** | ~5 % des utilisateurs sont en `prefers-reduced-motion`, soit 500 personnes. Le précédent mesuré : une feuille ouverte à **0 px visible**, sur le seul accès mobile à OKR, Statistiques et déconnexion. |
| **C-38** | `i18n:scan` annonce **zéro**, et l'interface anglaise parle français | 3 | 4 | **12** | Troisième fois que ce cliquet certifie un état qu'il ne mesure pas. Deux angles morts restent confirmés : forme ternaire, vocabulaire fermé. |
| **C-41** | Supprimer une liste depuis les trois modales « Ajouter à » : ni annulation, ni impact annoncé | 3 | 4 | **12** | Deux composants pour le même geste, avec deux garanties différentes. À l'échelle, l'un des deux perd des données tous les jours. |
| **C-16** | La mesure à volume est mono-session | 3 | 4 | **12** | Rien n'est su de la **concurrence**, et c'est précisément la variable qui change entre 27 et 11 000 comptes. La mesure existante ne dit rien du cas qui nous intéresse. |
| **C-25** | Le bleu de marque est à 3,34:1 | 2 | 5 | **10** | Tout le monde le voit, tout le temps, et l'arbitrage traîne depuis le 2026-08-24. Sous EAA il ne s'arbitre plus, il se corrige ou se justifie par écrit. |
| **C-40** | Douze écrans affirment « il n'y a rien » pendant le premier chargement | 2 | 5 | **10** | « Ajoute d'abord un ami pour partager une liste », dit à quelqu'un qui en a. Quotidien, pour tout le monde. |
| **C-15** | Le tableau de bord charge le jeu de données complet | 3 | 3 | **9** | Le seuil de réouverture est franchi : la mesure qui justifiait de ne rien faire (289 tâches au maximum) datait de 27 comptes. |
| **C-63** | `useClaimShareLink` : un réseau qui tombe fait dire « ce lien est invalide », définitivement | 3 | 3 | **9** | Sur le chemin viral, que `CLAUDE.md` protège explicitement. Le jeton est retiré du stockage avant l'appel : la personne n'a aucune raison de réessayer, et aucun moyen. |
| **C-02** | Supprimer une catégorie d'**équipe** n'annonce pas son impact | 3 | 3 | **9** | Le jumeau personnel a été refermé, celui-ci non, et il porte des données partagées : l'orphelinage touche le travail de plusieurs personnes à la fois. |
| **C-54** | `/agenda` : 0 case de jour atteignable au clavier, 38 tabulations, aucun lien d'évitement | 3 | 3 | **9** | Créer un événement en cliquant un créneau n'a **aucun équivalent clavier**. EAA. |
| **C-43** | « Supprimer l'événement lié » supprime N événements sans rien demander ni rien dire | 3 | 3 | **9** | Le chemin jumeau, dans l'agenda, a le filet. Celui-ci ne l'a pas. |
| **C-42** | Un commentaire d'équipe se supprime en un clic, pour toute l'équipe | 3 | 3 | **9** | Seule suppression du mode entreprise sans aucun filet, sur une donnée collective. |
| **C-03** | Les clés de `habits.completions` ignorent le fuseau choisi | 3 | 3 | **9** | À 11 000 comptes, la part hors métropole cesse d'être négligeable : ces gens voient leurs habitudes découpées autrement que leurs échéances, sur le même écran. |
| **C-23** | Durcir la gate axe-core de `critical` à `serious` | 2 | 4 | **8** | Trois violations, deux tokens, correctif chiffré. Sous EAA, la gate est le seul moyen de ne pas régresser. |
| **C-14** | La marge de budget de bundle est de 11,9 ko, déjà dépassée une fois | 2 | 4 | **8** | Chaque kilo-octet du chemin critique est payé 11 000 fois par mois, plus le trafic anonyme. |
| **C-26** | La couverture n'a pas été relancée depuis le 2026-08-29 | 2 | 4 | **8** | +215 tests **et** un dénominateur qui a grossi. La marge `functions` est déjà tombée à 0,32 point une fois. Coût : une commande. |
| **C-20** | Le contenu éditorial est monolingue (15 des 24 pages prérendues) | 3 | 3 | **9** | Ce n'est plus une dette de traduction, c'est un marché fermé : `en` ne peut pas entrer dans `INDEXABLE_LOCALES` tant que le contenu est français. |

---

## ⚪ P3 · fond de tableau, ou arbitrage à écrire

| Item | Défaut | G | E | Risque | Ce qui le ferme |
|---|---|---|---|---|---|
| **C-06** | 36 `eslint-disable react-hooks/exhaustive-deps` dans 28 fichiers | 3 | 3 | **9** | Chacun supprimé, ou justifié en commentaire, puis une règle qui exige le commentaire |
| **C-49** | 52 des 206 hooks exportés n'ont aucun consommateur | 2 | 3 | **6** | ✅ **Fermé le 2026-09-05** — 49 supprimés (49 mesurés, pas 52 : trois avaient déjà été traités par C-66/C-01), garde `orphan-hooks.guard.test.ts` avec témoin, éprouvée par deux sabotages |
| **C-09** | 15 fichiers au-dessus de 600 lignes (12 listés + 3 hors liste) | 2 | 3 | **6** | ✅ **Fermé le 2026-09-05** — `KNOWN_OVERSIZED` vide, par frontières réelles |
| **C-13** | Trancher `vendor-sentry` sur le chemin critique (49,3 ko gzip) | 2 | 3 | **6** | Une décision écrite, appuyée sur une mesure avec `VITE_SENTRY_DSN` posée. Se traite avec C-14 |
| **C-19** | Aucune gate ne détecte un composant shadcn recopié sans `forwardRef` | 3 | 2 | **6** | Une gate, ou une discipline écrite et datée |
| **C-55** | Trois surfaces que l'audit A-3 n'a pas réussi à mesurer | 2 | 3 | **6** | Les mesurer, dans le navigateur, et rendre un finding ou un « rien » |
| **C-48** | Un refus de dépendance de tâche dit deux choses différentes, aucune lisible | 2 | 3 | **6** | Des identifiants dans les trois `RAISE`, catalogués en fr et en en |
| **C-01** | Restaurer un OKR ne restaure pas le journal de ses complétions | 3 | 2 | **6** | Capturer les complétions dans l'instantané, réinsérer par le chemin de `recordKRCompletion()` |
| **C-32** | `report-bug` : l'allowlist de types de pièce jointe est décorative | 3 | 2 | **6** | Dériver l'extension du type validé, plus un test sur le cas d'évasion |
| **C-33** | `report-bug` : une panne d'auth anonymise l'auteur en silence | 2 | 3 | **6** | Distinguer l'échec de l'absence de session |
| **C-21** | 71 valeurs `en` identiques au `fr` | 2 | 2 | **4** | Remesurer d'abord : les chiffres datent du 2026-08-14 |
| **C-44** | `ui/chart.tsx` porte une allowlist anti-XSS sans un seul test | 2 | 2 | **4** | Quatre tests. Les quatre appelants ne passent que des constantes |
| **C-10** | Deux primitives livrées sans aucun consommateur | 2 | 2 | **4** | ✅ **Fermé le 2026-09-05** — supprimées (la seconde branche de l'alternative) |
| **C-11** | Le picker natif n'a pas de garde de non-régression | 2 | 2 | **4** | Une garde qui compte les `input[type=date]` et n'autorise que les deux d'`EventModalForm` |
| **C-50** | Quatre fabriques de clés React Query sans donnée depuis la mig. 129 | 2 | 2 | **4** | Suppression, `typecheck` comme preuve |
| **C-04** | ~~Le mur-pub Habitudes ne consomme pas de jeton~~ · 🟢 le système entier est supprimé | 2 | 1 | **2** | Cotait 20 tant qu on comptait le corriger. Retrait du client, du webhook, du SQL et des textes, dans cet ordre |
| **C-18** | CVE dev-only (`fast-uri`, `qs`, via `shadcn`) | 1 | 2 | **2** | `npm audit fix` sans `--force`, quand aucune autre session ne travaille dans l'arbre |
| **C-60** | `useRef<T>()` sans valeur initiale, cassera sous les types React 19 | 1 | 1 | **1** | Dans la PR de bascule React 19, pas avant |

---

## Ce qui bouge entre les deux cotations

Aucun item ne descend. Voici les onze qui montent le plus, et la raison de chaque saut.

| Item | Aujourd'hui | En charge | Ce qui a changé |
|---|---|---|---|
| **C-34** | 15 | **25 → 15** | L'avis L215-1 n'a pas de destinataire à 0 client. À 1 000 payants, chaque anniversaire non prévenu est remboursable. Puis la décision du 2026-09-03 le redescend à 15 en servant le remède d'avance |
| **C-04** | 2 | **20 → 2** | « Inoffensif tant que `PREMIUM_ENFORCED` vaut `false` » devient un contournement de paywall pour 10 000 comptes. Puis l'arbitrage du 2026-09-03 le ramène à 2 en supprimant la fonctionnalité |
| **C-30** | 12 | **15 → 9** | Les tables de preuve passent de 0 ligne à des milliers, et chaque suppression de compte en détruit. Puis la décision du 2026-09-03 le redescend à 9 : plus de discussion, donc moins besoin de preuve |
| **C-05** | 8 | **15** | Une inélégance devient une ligne de facture et un palier Supabase |
| **C-62** | 12 | **15** | Une centaine de phrases fausses × des centaines d'échecs par jour |
| **C-57** | 15 | **15** | Le score ne bouge pas, la population passe de quelques dizaines à plusieurs milliers |
| **C-31** | 12 | **10** | Le score baisse, la gravité monte à 5 : un seul abus coupe l'authentification **et** la conformité pour tout le monde |
| **C-24** | 9 | **12** | L'accessibilité cesse d'être une note interne et devient opposable |
| **C-64** | 8 | **12** | Une impasse rare devient une impasse quotidienne |
| **C-07** | 6 | **12** | 5 % de 11 000, c'est 500 personnes en mouvement réduit |
| **C-15 / C-16** | 4 | **9 / 12** | Le seuil de réouverture écrit dans l'item est franchi par l'hypothèse elle-même |

Et les trois seules qui **descendent**, toutes les trois par la décision du 2026-09-03, aucune par du
code : **C-34** (25 → 15), **C-30** (15 → 9), et la moitié « avis de reconduction » de **C-35**.
C'est la démonstration la plus nette de ce tableau : *une décision produit d'une ligne a fermé plus
d'exposition que n'importe lequel des 56 correctifs*. Elle en ouvre un, C-65, qui est le prix à payer
pour que les trois baisses soient réelles.

---

## ✅ Clos · rappelés pour qu'on ne les recompte pas

| Item | Statut |
|---|---|
| **C-17** | Clos le 2026-09-03, remplacé par C-58 |
| **C-22** | Clos le 2026-09-03, remplacé par C-38 |
| **C-29** | Corrigé le 2026-09-03 · 🔴 **pas en production** tant que `delete-account` n'est pas redéployée, cf. le P0 C-35 |
| **C-51** | Corrigé le 2026-09-03 (calendrier au clavier, 8 surfaces) |
| **C-52** | Corrigé le 2026-09-03 (libellés ARIA du calendrier) |
| **C-58** | Constat, pas correctif : le blocage sécurité qui forçait React 19 est levé |
| **C-59** | Corrigé le 2026-09-03 (`Input` en `forwardRef`) |
| **C-61** | Corrigé le 2026-09-03 (repli d'agrément qui fermait toute l'app) |

---

## Ce que ce tableau ne peut pas coter

Un audit n'a jamais été passé, et un second ne l'a été qu'aux trois quarts (§10 de
`a-faire-code.md`). **Un finding qu'on n'a jamais cherché n'est ni vrai ni faux, il est absent** :
aucune ligne ci-dessus ne couvre les zones non lues. Le dépôt a déjà mesuré ce que vaut une zone non
lue, cinq fois de suite : la première lecture des Edge Functions Stripe a rendu 6 findings, A-1 en a
rendu 8, A-5 8, A-2 3, A-7 4. **Le nombre d'items ouverts ne baissera donc pas de façon monotone**,
et une remontée n'est pas une régression.

Second angle mort, propre à cette version : **l'hypothèse de charge est une hypothèse.** Elle rend
le classement utile, elle ne rend pas ses fréquences vraies. Le jour où il y a de vrais chiffres
d'usage, la colonne « Combien de gens » se remesure, et l'ordre peut changer.

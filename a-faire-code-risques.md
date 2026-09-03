# Tableau de risque · `a-faire-code.md`

**Dressé le 2026-09-03**, à partir des 64 items C-01 → C-64 de
[`a-faire-code.md`](./a-faire-code.md). **8 sont clos**, **56 sont ouverts** et notés ci-dessous.

Ce fichier ne porte **aucun statut** : il ne fait que classer. Le statut de chaque item reste dans
`a-faire-code.md`, la sécurité dans `faille.md`, les gestes manuels dans `a-faire-manuel.md`.

---

## Méthode de notation

**Risque = Gravité × Exposition.** Les deux sont notées de 1 à 5, et l'**exposition est celle
d'aujourd'hui**, pas celle d'un futur probable. C'est la distinction qui structure tout ce tableau :
plusieurs défauts très graves ont une exposition **nulle** parce que rien n'est encaissé et que les
tables concernées sont vides. Ils n'en sont pas moins urgents, mais pour une autre raison, dite dans
la colonne **Fenêtre**.

| Gravité | Ce que ça veut dire |
|---|---|
| **5** | Perte ou destruction irréversible de données, y compris celles de tiers |
| **4** | Impasse produit, perte de données rattrapable, ou obligation légale non tenue |
| **3** | Un utilisateur est bloqué, mal informé, ou lit une phrase fausse |
| **2** | Défaut visible sans conséquence, ou dette qui coûtera plus tard |
| **1** | Cosmétique, ou strictement interne |

| Exposition | Ce que ça veut dire |
|---|---|
| **5** | Se produit aujourd'hui, sur le chemin principal, pour tout le monde |
| **4** | Se produit aujourd'hui pour une population identifiée |
| **3** | Demande un concours de circonstances plausible (panne réseau, navigation privée) |
| **2** | Demande une action délibérée, ou une population très étroite |
| **1** | Théorique aujourd'hui : le code fautif n'est pas atteignable |

### Les quatre niveaux d'urgence

| Niveau | Règle |
|---|---|
| 🔴 **U0** | **Avant la prochaine bascule.** Soit c'est actif en production maintenant, soit la fenêtre où le correctif est gratuit se referme au premier euro encaissé. |
| 🟠 **U1** | **Cette semaine.** Risque vivant, ou garde qui ment, ou coût du correctif très bas pour un gain immédiat. |
| 🟡 **U2** | **Ce mois.** Réel, borné, pas en train de brûler. |
| ⚪ **U3** | **Planifié, ou arbitrage à écrire.** Un arbitrage qui ne se rend pas devient un oubli : ces lignes se ferment par une décision écrite autant que par du code. |

### La colonne Fenêtre

Elle nomme l'évènement après lequel le correctif devient cher, ou impossible.

- **T-36 / T-38** : bascule Stripe en compte live, puis réarmement de la facturation.
- **PREMIUM** : passage de `PREMIUM_ENFORCED` à `true`.
- **EAA** : ouverture à l'indexation et exigences d'accessibilité opposables.
- **maintenant** : la fenêtre est déjà ouverte, le défaut est vivant.

---

## Synthèse

| Urgence | Items | Dont gravité ≥ 4 |
|---|---|---|
| 🔴 **U0** | 5 | 4 |
| 🟠 **U1** | 12 | 7 |
| 🟡 **U2** | 18 | 1 |
| ⚪ **U3** | 21 | 0 |
| ✅ clos | 8 | . |

**Les cinq U0 ont un point commun** : quatre d'entre eux ont une **exposition mesurée nulle
aujourd'hui**, et c'est exactement ce qui les rend urgents. Les tables de preuve sont vides, aucun
euro n'est encaissé, aucune organisation n'est facturée : le correctif ne coûte rien. Le jour
d'après, il faut migrer des données réelles, ou il est trop tard.

---

## 🔴 U0 · avant la prochaine bascule

| Item | Défaut | G | E | Risque | Fenêtre | Pourquoi maintenant |
|---|---|---|---|---|---|---|
| **C-35** | Les 3 Edge Functions déployées divergent du dépôt, de 3 façons différentes | 5 | 5 | **25** | maintenant | Toute conclusion tirée en lisant `supabase/functions/` est fausse d'avance, y compris les ✅ de `faille.md`. C'est le seul item qui invalide les **autres** items. |
| **C-08** | Identifiants Stripe de test réutilisés contre une clé live · cache `productIndex` jamais invalidé | 4 | 4 | **16** | T-36 | Les deux tombent pile pendant le basculement. Les tables sont vides : le coût est nul aujourd'hui, non nul demain. |
| **C-39** | N'importe quel **admin**, pas seulement le propriétaire, supprime l'organisation · la cascade emporte 21 tables dont l'abonnement | 5 | 3 | **15** | T-38 | Un bouton rouge, un clic, et l'abonnement Stripe continue de courir sur une organisation qui n'existe plus. Irrattrapable dès le premier client payant. |
| **C-45** | `loginWithGoogle` vise des URL que l'allowlist Supabase ne couvre peut-être pas | 3 | 4 | **12** | maintenant | Le code **est en production**, le réglage qui le rend valide n'a pas été vérifié. Symptôme : la connexion Google « marche » et perd la destination, en silence. |
| **C-30** | `renewal_notices` et `withdrawal_consents` en `ON DELETE CASCADE` : supprimer un compte détruit les preuves L215-1 et L221-28 | 4 | 3 | **12** | T-36 | 0 ligne dans les trois tables aujourd'hui. Une migration `SET NULL` maintenant coûte une migration ; plus tard elle coûte des preuves. |

---

## 🟠 U1 · cette semaine

| Item | Défaut | G | E | Risque | Fenêtre | Pourquoi |
|---|---|---|---|---|---|---|
| **C-47** | La suite de tests rend des échecs **faux** sous charge, indistinguables des vrais | 4 | 5 | **20** | maintenant | Installe le réflexe « c'est la contention, je rejoue », celui qui laissera passer une vraie régression. Toutes les autres gardes en dépendent. |
| **C-37** | Six « Annuler » rendent l'objet sous un **nouvel identifiant** | 4 | 4 | **16** | maintenant | Le cas du lot est le pire : annuler la suppression de dix tâches rend dix tâches détachées de toutes leurs listes, sans une seule erreur à l'écran. |
| **C-28** | Le canal d'alerte d'ops est inerte (secret Actions absent) | 4 | 4 | **16** | maintenant | La seule voie restante est l'issue GitHub, celle qui n'a pas été lue pendant quatre jours pendant qu'un script tiers exfiltrait email et nom. |
| **C-56** | Clavier ouvert, le haut de `FirstRunSetup`, `BugReportModal` et `InviteOrJoinModal` est **inatteignable** | 4 | 4 | **16** | maintenant | Mesuré à 375 × 350 : la question à laquelle la personne répond sort par le haut, et aucun geste ne la ramène. C'est l'accueil d'un compte neuf. |
| **C-53** | Aucune modale maison ne piège le focus (58 fichiers) | 4 | 4 | **16** | EAA | `EventModal` au clavier : le focus reste derrière l'overlay, Échap ne fait rien. On remplit un formulaire qu'on ne peut pas atteindre. |
| **C-57** | Cibles tactiles : **16 × 16 px** pour cocher une tâche sur `/dashboard` | 3 | 5 | **15** | maintenant | Le geste principal du produit, sur son écran d'accueil, à moins de la moitié de la cible WCAG. |
| **C-38** | `i18n:scan` annonce **zéro**, et l'interface anglaise parle français | 3 | 5 | **15** | EAA | Troisième fois que ce cliquet certifie un état qu'il ne mesure pas. Deux angles morts restent confirmés : forme ternaire, vocabulaire fermé. |
| **C-34** | `renewal-notice.yml` sort en **vert** quand son secret est absent | 3 | 5 | **15** | T-36 | Le motif exact retiré d'`uptime.yml` le même jour, encore en place ailleurs. Obligation quotidienne non tenue, en vert, depuis sa création. |
| **C-46** | 60 accès `localStorage` bruts dans 14 dépôts de démo | 4 | 3 | **12** | maintenant | En navigation privée stricte ou en webview, `getItem` lève **avant** le `try` : tout le mode entreprise en démo tombe. La démo est le chemin d'acquisition. |
| **C-31** | `report-bug` est un relais d'e-mail ouvert, sans aucune limite de débit | 4 | 3 | **12** | maintenant | La réputation d'expéditeur met des mois à se reconstruire, et c'est le domaine qui porte l'authentification et les avis L215-1. |
| **C-12** | La landing est la seule page lente du site (56-63 en CI, TBT jusqu'à 1 633 ms) | 3 | 4 | **12** | maintenant | C'est la porte d'entrée unique, et le SEO est le seul levier d'acquisition en cours. |
| **C-26** | La couverture n'a pas été relancée depuis le 2026-08-29 | 2 | 4 | **8** | maintenant | +215 tests **et** un dénominateur qui a grossi. La marge `functions` est déjà tombée à 0,32 point une fois. Coût : une commande. |

---

## 🟡 U2 · ce mois

| Item | Défaut | G | E | Risque | Fenêtre |
|---|---|---|---|---|---|
| **C-62** | Une centaine de messages d'erreur atteignent l'écran sans passer par aucun catalogue | 3 | 4 | **12** | EAA |
| **C-40** | Douze écrans affirment « il n'y a rien » pendant le premier chargement | 2 | 5 | **10** | maintenant |
| **C-63** | `useClaimShareLink` : un réseau qui tombe fait dire « ce lien est invalide », définitivement | 3 | 3 | **9** | maintenant |
| **C-41** | Supprimer une liste depuis les trois modales « Ajouter à » : ni annulation, ni impact annoncé | 3 | 3 | **9** | maintenant |
| **C-43** | « Supprimer l'événement lié » supprime N événements sans rien demander ni rien dire | 3 | 3 | **9** | maintenant |
| **C-42** | Un commentaire d'équipe se supprime en un clic, pour toute l'équipe | 3 | 3 | **9** | maintenant |
| **C-54** | `/agenda` : 0 case de jour atteignable au clavier, 38 tabulations, aucun lien d'évitement | 3 | 3 | **9** | EAA |
| **C-27** | Les parcours livrés en septembre n'ont aucun test E2E | 3 | 3 | **9** | maintenant |
| **C-36** | `report-bug` et `renewal-notice` n'ont aucune garde, d'aucune sorte | 3 | 3 | **9** | T-36 |
| **C-23** | Durcir la gate axe-core de `critical` à `serious` (3 violations, 2 tokens) | 2 | 4 | **8** | EAA |
| **C-64** | `AppErrorBoundary` n'offre qu'un rechargement, là où la racine offre une sortie | 4 | 2 | **8** | maintenant |
| **C-14** | La marge de budget de bundle est de 11,9 ko, déjà dépassée une fois | 2 | 4 | **8** | maintenant |
| **C-05** | Le badge d'organisation lit jusqu'à 1 000 tâches d'équipe pour afficher un nombre | 2 | 4 | **8** | maintenant |
| **C-07** | 17 feuilles animées encore écrites à la main | 3 | 2 | **6** | maintenant |
| **C-32** | `report-bug` : l'allowlist de types de pièce jointe est décorative | 3 | 2 | **6** | maintenant |
| **C-01** | Restaurer un OKR ne restaure pas le journal de ses complétions | 3 | 2 | **6** | maintenant |
| **C-02** | Supprimer une catégorie d'**équipe** n'annonce pas son impact | 3 | 2 | **6** | maintenant |
| **C-55** | Trois surfaces que l'audit A-3 n'a pas réussi à mesurer | 2 | 3 | **6** | EAA |

---

## ⚪ U3 · planifié, ou arbitrage à écrire

| Item | Défaut | G | E | Risque | Ce qui le ferme |
|---|---|---|---|---|---|
| **C-20** | Le contenu éditorial est monolingue (15 des 24 pages prérendues) | 3 | 3 | **9** | Bloque `en` dans `INDEXABLE_LOCALES`. Chantier XL, pas un correctif |
| **C-24** | VoiceOver iOS sur un vrai appareil, jamais fait | 3 | 3 | **9** | Un appareil en main. Ne se simule pas, cf. `a-faire-manuel.md` M-25 |
| **C-06** | 36 `eslint-disable react-hooks/exhaustive-deps` dans 28 fichiers | 3 | 2 | **6** | Chacun supprimé, ou justifié en commentaire, puis une règle qui exige le commentaire |
| **C-19** | Aucune gate ne détecte un composant shadcn recopié sans `forwardRef` | 3 | 2 | **6** | Une gate, ou une discipline écrite et datée |
| **C-49** | 52 des 206 hooks exportés n'ont aucun consommateur | 2 | 3 | **6** | Adoptés ou supprimés, plus un compteur avec témoin |
| **C-09** | 12 fichiers au-dessus de 600 lignes | 2 | 3 | **6** | `KNOWN_OVERSIZED` vide, par frontières réelles |
| **C-13** | Trancher `vendor-sentry` sur le chemin critique (49,3 ko gzip) | 2 | 3 | **6** | Une décision écrite, appuyée sur une mesure avec `VITE_SENTRY_DSN` posée |
| **C-25** | Le bleu de marque est à 3,34:1 | 2 | 3 | **6** | La teinte change, ou la décision est écrite dans `ACCESSIBILITY.md` |
| **C-48** | Un refus de dépendance de tâche dit deux choses différentes, aucune lisible | 2 | 3 | **6** | Des identifiants dans les trois `RAISE`, catalogués en fr et en en |
| **C-03** | Les clés de `habits.completions` ignorent le fuseau choisi | 2 | 2 | **4** | Une décision écrite : migrer, ou geler et documenter |
| **C-44** | `ui/chart.tsx` porte une allowlist anti-XSS sans un seul test | 2 | 2 | **4** | Quatre tests |
| **C-10** | Deux primitives livrées sans aucun consommateur | 2 | 2 | **4** | Adoptées et vérifiées sur un écran réel, ou supprimées |
| **C-11** | Le picker natif n'a pas de garde de non-régression | 2 | 2 | **4** | Une garde qui compte les `input[type=date]` |
| **C-50** | Quatre fabriques de clés React Query sans donnée depuis la mig. 129 | 2 | 2 | **4** | Suppression, `typecheck` comme preuve |
| **C-15** | Le tableau de bord charge le jeu de données complet | 2 | 2 | **4** | Un seuil de réouverture écrit (289 tâches au maximum, mesuré) |
| **C-16** | La mesure à volume est mono-session | 2 | 2 | **4** | N sessions parallèles dans `scalability-volume` |
| **C-21** | 71 valeurs `en` identiques au `fr` | 2 | 2 | **4** | Remesurer d'abord : les chiffres datent du 2026-08-14 |
| **C-04** | Le mur-pub Habitudes ne consomme pas de jeton | 2 | 1 | **2** | 🔴 Devient **U0** le jour où `PREMIUM_ENFORCED` passe à `true` |
| **C-18** | CVE dev-only (`fast-uri`, `qs`, via `shadcn`) | 1 | 2 | **2** | `npm audit fix` sans `--force`, quand aucune autre session ne travaille dans l'arbre |
| **C-33** | `report-bug` : une panne d'auth anonymise l'auteur en silence | 1 | 2 | **2** | Distinguer l'échec de l'absence de session |
| **C-60** | `useRef<T>()` sans valeur initiale, cassera sous les types React 19 | 1 | 1 | **1** | Dans la PR de bascule React 19, pas avant |

---

## ✅ Clos · rappelés pour qu'on ne les recompte pas

| Item | Statut |
|---|---|
| **C-17** | Clos le 2026-09-03, remplacé par C-58 |
| **C-22** | Clos le 2026-09-03, remplacé par C-38 |
| **C-29** | Corrigé le 2026-09-03 · ⚠️ **pas en production** tant que `delete-account` n'est pas redéployée |
| **C-51** | Corrigé le 2026-09-03 (calendrier au clavier, 8 surfaces) |
| **C-52** | Corrigé le 2026-09-03 (libellés ARIA du calendrier) |
| **C-58** | Constat, pas correctif : le blocage sécurité qui forçait React 19 est levé |
| **C-59** | Corrigé le 2026-09-03 (`Input` en `forwardRef`) |
| **C-61** | Corrigé le 2026-09-03 (repli d'agrément qui fermait toute l'app) |

⚠️ **C-29 est le piège de cette liste.** Il est marqué corrigé dans le dépôt, et **C-35 prouve que
le dépôt n'est pas ce qui tourne**. Tant que le déploiement n'a pas eu lieu, la lecture qui peut
détruire une organisation entière est toujours celle qui s'exécute en production.

---

## Ce que ce tableau ne peut pas coter

Un audit n'a jamais été passé, et un second ne l'a été qu'aux trois quarts (§10 de
`a-faire-code.md`). **Un finding qu'on n'a jamais cherché n'est ni vrai ni faux, il est absent** :
aucune ligne ci-dessus ne couvre les zones non lues. Le dépôt a déjà mesuré ce que vaut une zone non
lue, cinq fois de suite : la première lecture des Edge Functions Stripe a rendu 6 findings, A-1 en a
rendu 8, A-5 8, A-2 3, A-7 4. **Le nombre d'items ouverts ne baissera donc pas de façon monotone**,
et une remontée n'est pas une régression.

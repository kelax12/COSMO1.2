# Prompts — un par item ouvert de `a-faire-code.md`

**Réécrit le 2026-09-14**, après la passe de remesure du même jour (encadré en tête de
`a-faire-code.md`). Un prompt par item **non clos**, prêt à coller dans une session neuve.

**Ce qui a changé depuis la version du 2026-09-12 :**

| Item | Ce qui s'est passé |
|---|---|
| `C-18` | `npm audit` rend **0** avis, dev compris — prompt retiré |
| `C-23` | dispense `color-contrast` tranchée et motivée le 09-13 — prompt retiré |
| `C-28` | secret présent depuis le 09-02, canal **lu par un humain** le 09-13 — prompt retiré |
| `C-30` `C-31` `C-48` | migrations `137` `138` `139` au ledger de prod — prompts retirés |
| `C-34` | `CRON_SECRET` posé le 09-13 à 16:21:34 UTC, dispatch vert — prompt retiré |
| `C-35` | `SUPABASE_ACCESS_TOKEN` posé le 09-13, job **vert** le 09-14 à 10:57, 8 fonctions comparées — prompt retiré |
| **`C-14`** | 🔴 **ROUVERT** : rien de son correctif n'est dans le dépôt — nouveau prompt, fusionné avec `C-76` |
| **`C-75`** 🆕 | la CI de `main` est rouge depuis le 09-13 à 21:38, sept runs — nouveau prompt, **P0** |
| **`C-76`** 🆕 | la façade `toast` n'est suivie par git sur aucune branche — nouveau prompt, **P0** |
| `C-39` `C-65` | `stripe-org-refund` **est déployée** (v5, 09-12 22:05) : le prompt ne demande plus un déploiement mais une **épreuve** |

**Sept blocs**, dans l'ordre où ils devraient être traités.

> **Comment s'en servir.** Coller le **préambule** puis **un seul** bloc. Ne jamais en coller deux :
> chacun porte son critère de sortie, et deux critères dans une session font qu'aucun n'est tenu.
>
> Les prompts disent **où c'est** et **ce qui prouve que c'est fini** ; ils ne disent pas comment
> corriger quand plusieurs voies existent — les arbitrages déjà rendus sont au **§ 0** de
> `a-faire-code.md` et font foi.

---

## Préambule commun — à coller en tête de CHAQUE prompt

```
Depot COSMO (C:\Users\Axel\Documents\COSMO1.1). Lis d'abord CLAUDE.md, puis dans
a-faire-code.md l'item nomme ci-dessous et le § 0 (arbitrages tranches).

Regles de methode non negociables, elles viennent de defauts reels de ce depot :
1. Mesurer avant, mesurer apres, et publier les deux chiffres. Un correctif dont on ne peut
   pas montrer le gain est une dette de mesure, pas un progres.
2. Ne JAMAIS relever un plafond ni baisser un seuil pour faire passer une garde
   (check:bundle, architecture.guard, design-system.guard, i18n:scan, i18n:identical,
   test:coverage, touch-targets).
3. Tout correctif de garde repart avec un TEMOIN : une sonde qui refuse un detecteur qui ne
   detecterait plus rien. Le voir echouer avant de le commiter.
4. Un defaut d'interface se verifie en OUVRANT l'ecran, pas en relisant le code.
5. Plusieurs sessions travaillent dans cet arbre, et il porte aujourd'hui ~69 fichiers modifies
   non commites plus 2 fichiers NON SUIVIS. Relire `git status` avant de commiter, ne stager que
   tes propres fichiers, ne JAMAIS faire `git reset --hard`, et relire le ledger de migrations
   EN BASE avant d'en appliquer une.
6. Une preuve est OPPOSABLE ou elle n'existe pas : un commit, un run CI, une version deployee
   avec sa date. Jamais un arbre de travail local. C-14 a ete compte clos pendant trois jours
   alors qu'aucune ligne de son correctif n'etait dans le depot.
7. Quand la mesure contredit l'enonce de l'item, c'est l'enonce qui a tort : le corriger dans
   a-faire-code.md, avec le chiffre mesure et sa date.
8. Un test rouge ne dit pas OU est le defaut, il dit qu'il y en a un quelque part entre le
   produit et sa mesure. Sur C-72/C-73/C-74, deux enonces sur trois etaient faux. Et lire le
   JOURNAL avant de raisonner.

A la fin : mettre a jour la note de l'item dans a-faire-code.md (ce qui est fait, ce qui reste,
sous quelles reserves), puis commiter et pousser.
```

---

# P0 — la CI de `main` est ROUGE, et un correctif entier n'est pas dans le dépôt

## C-75 · sept runs CI rouges d'affilée sur `main`

```
Objectif : C-75. La CI de main echoue depuis le 2026-09-13 a 21:38 UTC. Dernier run vert :
34783058643 (09-13 21:11). Sept runs rouges depuis, tous a la MEME etape,
« Unit tests + coverage » de lint-test-build — donc Build et « Budget de bundle » ne tournent
meme plus, et plus rien ne mesure le bundle depuis quatorze heures.

Trois assertions, relevees dans le journal du run 34838656203 (commit 82584af8) :
  architecture.guard   EventModalFormDesktop.tsx 662 lignes, TaskModalMobileBody.tsx 651,
                       budget 600
  design-system.guard  76 tailles sous 11px (reference 75)
  design-system.guard  stock de tailles arbitraires 200 > budget 196

Les deux fichiers font 661 et 650 lignes a HEAD (la garde compte une ligne de plus). Les trois
cliquets ont mordu sur la vague sous-categories / agenda des 09-13 et 09-14 (b0416b38,
981ba288, 2428fd56, 1d241398, e6a887df).

A faire, dans cet ordre :
1. LIRE le journal du dernier run avant de raisonner
   (gh run view -R kelax12/COSMO1.2 --job <id> --log-failed), et confirmer que l'echec de HEAD
   est bien le meme que celui de 82584af8.
2. Sur les TAILLES : verifier d'abord que les 76 et les 200 sont bien de NOUVELLES chaines de
   cette vague. Le detecteur a gagne en vue depuis C-73 (il voit les pseudo-elements) ; si un
   detecteur voit mieux, le chiffre monte sans que le produit ait bouge. Le dire si c'est le
   cas, plutot que de corriger a l'aveugle.
3. Sur les DEUX fichiers : decouper. Chercher la frontiere — un geste, une surface, une
   derivation, un domaine. Citer le nombre de lignes avant / apres pour chacun.

INTERDIT : relever un des trois chiffres. C-09 a coute quinze mois pour revenir a zero, et les
douze fichiers repris sont TOUS arrives « juste au-dessus ». Le plancher de 11px est le plancher
mobile, pas une preference.

Fini quand : un run CI VERT sur main, aucun des trois chiffres de garde releve, et l'etape
« Budget de bundle » a de nouveau tourne — elle est muette depuis le 09-13 a 21:13.
```

## C-76 + C-14 · la façade `toast` et les deux plafonds abaissés ne sont dans AUCUN commit

```
Objectif : C-76, qui rouvre C-14. Ce n'est pas un chantier de code : le code est ecrit, teste,
et il n'est PAS dans le depot. Mesure du 2026-09-14 (git ls-files, git log --all) :

  src/lib/toast.ts             present sur le disque, NON SUIVI par git, aucun commit sur
                               aucune branche
  src/lib/toast.guard.test.ts  idem — la garde ne tourne donc JAMAIS en CI
  scripts/check-bundle-budget.mjs  commite, mais dans sa version du 2026-09-04 : plafonds
                               78 000 / 370 000, et non 71 000 / 323 000
  57 fichiers passes a @/lib/toast   non commites ; 5 fichiers PRODUIT de main importent
                               encore `sonner` directement

Consequence mesuree : le dernier run vert de main (34783058643) rend une entree a 76,9 ko,
c'est-a-dire AU-DESSUS du plafond de 71 000 que C-14 declare avoir pose le 2026-09-11. C-14
etait donc compte clos depuis trois jours sans qu'une ligne de son correctif existe dans le
depot.

Et ca a deja coute trois commits a d'autres sessions : 9f641e27, 9d4039a5 et 82584af8 sont tous
des fix(build) qui REVIENNENT d'un import @/lib/toast vers sonner, parce qu'un fichier commite
importait un module que git ne suit pas — vert en local, rouge au build Vercel. La garde
scripts/tracked-imports.guard.test.mjs a fait son travail les trois fois ; personne n'a remonte
la cause, qui est en amont.

A faire :
1. Relire `git status` EN ENTIER avant quoi que ce soit. L'arbre porte ~69 fichiers modifies
   d'au moins deux chantiers. N'indexer QUE la facade toast, sa garde, ses 57 consommateurs,
   check-bundle-budget.mjs et docs/PERFORMANCE.md. Indexer le fichier d'une autre session peut
   commiter un import vers un module non suivi : c'est litteralement le defaut ci-dessus.
2. Verifier que la facade est complete AVANT de commiter : meme surface que sonner
   (toast(...), .success .error .info .warning .message .loading .custom .dismiss), sonner en
   import() dynamique et nulle part ailleurs.
3. Jouer `npm test src/lib/toast.guard.test.ts` (4 tests, dont un temoin) et le VOIR rougir sur
   un import fautif avant de le commiter.
4. Construire AVEC VITE_SENTRY_DSN — sans elle Rollup jette @sentry/react, vendor-sentry tombe
   a 3,8 ko et la garde sous-estime le chemin critique d'environ 45 ko (SENTRY_FLOOR refuse deja
   ce build). Puis `npm run check:bundle` sur les plafonds 71 000 / 323 000.
5. Relire le § Toasts de CLAUDE.md : la regle qu'il enonce ne decrit pas main aujourd'hui.

Fini quand : la facade et sa garde sont SUIVIES par git, toast.guard.test.ts passe en CI,
check:bundle tourne sur 71 000 / 323 000 et sort vert dans un RUN CI (pas en local),
`grep -rl "from 'sonner'" src/` ne rend plus que la facade et sa garde, et la note de C-14 cite
le commit et le numero du run qui l'a verifie.

Ordre : ce prompt passe APRES C-75 tant que la CI est rouge — sinon le run qui doit prouver
check:bundle n'atteindra jamais l'etape Build.
```

---

# P1 — déployé, jamais éprouvé

> 🔴 **Plus aucun geste de production n'est en attente** (remesure du 2026-09-14 : quatre secrets
> posés, 8 Edge Functions en ligne et identiques au dépôt, 148 migrations au ledger). Ce qui reste
> sur ces deux items n'est plus un déploiement, c'est une **épreuve**.

## C-65 + C-39 · rembourser, résilier, supprimer — jamais joué une seule fois

```
Objectif : C-65 et C-39, qui se ferment ensemble par une EPREUVE, pas par un geste.

Etat mesure le 2026-09-14 a la source (API Supabase ; job « Edge deploy drift » VERT le 09-14 a
10:57, qui prouve que les 8 fonctions en ligne sont identiques au depot) :
  stripe-org-refund   ACTIVE, v5, deployee le 2026-09-12 a 22:05 UTC
  stripe-webhook      ACTIVE, v33, 2026-09-13 a 16:12 UTC, branche charge.refunded incluse
  migrations          148 entrees au ledger ; seules la 136 (autre session) et la 140 (fenetre
                      de bascule Stripe, deliberement differee) sont hors base

Le blocage que a-faire-code.md opposait a ces deux items depuis le 09-04 est donc TOMBE. Ce qui
reste : RIEN n'a jamais ete joue contre Stripe. 0 org_subscriptions, 0 payment_records.

A faire :
1. Verifier DANS LE TABLEAU DE BORD STRIPE que l'endpoint webhook souscrit bien charge.refunded.
   Le doute est ecrit depuis le 09-12 : l'endpoint est documente a 5 events pour SIX branches
   dans le code. En reenregistrer 5 couperait le remboursement en silence. C'est une lecture de
   console, pas une lecture de code.
2. Jouer un remboursement REEL de bout en bout contre le compte Stripe de TEST : creer un
   abonnement d'organisation avec une carte de test, puis passer par l'ecran.
   Rappel : APP_URL vaut https://thecosmo.app et c'est la SEULE origine CORS autorisee par les
   deux Edge Functions org — le checkout entreprise ne se teste pas depuis localhost:5173.
3. Verifier, dans l'ordre : le montant au prorata des mois non consommes ; la ligne
   compensatoire ecrite au journal d'encaissement (payment_records est append-only : rejouer
   verify_payment_chain() apres) ; l'abonnement RELU par l'ecran (sans invalidation il continue
   d'afficher le forfait payant ET son bouton de remboursement, donc il invite au rejeu que la
   borne serveur existe pour absorber) ; et l'absence de SECOND appel (useCancelAndRefundOrg
   doit poser retry: 0 — le QueryClient pose retry: 1 pour tout le monde, et
   e2e/stubbed/refund.spec.ts a deja mesure deux appels pour un clic).
4. Enchainer sur C-39 dans la meme passe : le parcours nominal complet est
   rembourser -> resilier (un seul appel serveur) -> supprimer, et la suppression ne s'execute
   QUE si le remboursement a reussi. Verifier aussi en base que delete_organization exige le
   PROPRIETAIRE et refuse tant qu'un abonnement court, et que renewal_notices et
   withdrawal_consents SURVIVENT a la suppression (mig. 138).

Fini quand : un remboursement de test est passe de bout en bout, chaque verification ci-dessus
porte son resultat MESURE dans la note de l'item, et la reponse a « charge.refunded est-il
souscrit ? » est ecrite noir sur blanc. Une fonction deployee n'est pas une fonction eprouvee.
```

---

# P2 — critère non atteint, il reste du travail

## C-24 · le dernier des quatre audits d'accessibilité (A-4, appareil réel)

```
Objectif : C-24. Trois audits sur quatre sont passes le 2026-09-03. Il reste la moitie
« appareil reel » de A-4 (voir § 10 de a-faire-code.md et a-faire-manuel.md §7, M-25) : aucune
mesure n'a jamais ete prise sur un vrai telephone, seulement en viewport emule.

Les pieges WebKit documentes dans docs/MOBILE.md viennent JUSTEMENT de bugs invisibles en
emulation. Ce qu'on attend : les bugs de feuille, de clavier virtuel, de 100vh et de gestes, et
la confirmation iOS de C-56, dont le mecanisme differe d'Android.

Le prompt complet est deja ecrit : prompts-audits.md, section A-4. Le lire plutot que
d'improviser un perimetre.

Fini quand : les findings sont verses dans a-faire-code.md avec leurs numeros C-NN, ou le
rapport dit explicitement « rien ». Un audit qui ne rend rien se DIT ; il ne s'omet pas.
```

## C-58 · React 19 — la branche existe, elle bute sur un plafond qui n'est pas celui de `main`

```
Objectif : C-58, et ce n'est plus un chantier de migration — c'est un arbitrage.

Etat mesure le 2026-09-14, branche `feat/react-19` :
  tsc -b / lint / 226 fichiers de tests / les six gates / build / E2E chromium : TOUT VERT
  check:bundle : EXIT 1 — chemin critique 329,8 ko contre un plafond de 323,0
  la branche est 2 commits DEVANT main et 48 DERRIERE : plus elle attend, plus le rebase coute

React 19 pese +23,3 ko gzip (vendor-react 72,1 -> 95,4). Le chunk a ete ouvert : pas de
react-dom/server, pas de __DEV__, pas de build de developpement. Le surcout est REEL.

PIEGE, a lire avant de trancher : le plafond de 323,0 contre lequel cette mesure a ete prise
N'EST PAS celui de main. main porte encore 370 000 — les plafonds abaisses n'ont jamais ete
commites (C-76). Arbitrer maintenant reviendrait a arbitrer sur un plafond fictif. Faire passer
C-76 d'abord, remesurer, puis seulement poser la question.

Le seul gisement est vendor-animation (49,0 ko), tire dans le chemin critique par UN import
statique : MotionConfig dans App.tsx. Le differer naivement est EXCLU — c'est un fournisseur de
CONTEXTE, les premiers ecrans rendraient sans prefers-reduced-motion, la classe de regression
qui a deja coute deux fois a ce depot.

Trois issues, et ce prompt ne s'execute QUE quand Axel en a choisi une :
  1. differer (defaut : l'urgence securite est tombee, cf. la note de C-58) ;
  2. sortir framer-motion du chemin critique pour de vrai — remplacer MotionConfig par une
     lecture CSS/matchMedia de prefers-reduced-motion, sans contexte React. Chantier a part,
     avec sa mesure au navigateur SOUS `reduce` ;
  3. accepter de rouvrir C-14.

Detail complet et chiffres : docs/MIGRATION-REACT19.md § 4bis.
react-router 8 (PR 2) est sequentiel derriere : il exige React >= 19.2.7 en peer.
```

---

# P3 — arbitré, ne s'exécute que si la décision change

## C-69 · la fenêtre produit de la landing tourne sans pause

```
Objectif : C-69. AppWindowShowcase (src/components/showcase/AppWindowShowcase.tsx) change de vue
toutes les 2,5 s indefiniment (ROTATE_MS ligne 57, setInterval ligne 139), gate par le seul
useInView ligne 119. Ni bouton de pause, ni arret au survol, ni au focus, et AUCUN egard pour
prefers-reduced-motion : mesure, la rotation est identique sous reduce.

C'est un echec WCAG 2.2.2 « Pause, Stop, Hide », NIVEAU A, sur la premiere page du site, a cote
du H1 et des CTA, c'est-a-dire exactement le texte qu'un visiteur essaie de lire. L'EAA
s'applique a un service vendu a des consommateurs.

Axel a arbitre le 2026-09-03 : ON GARDE. Ce prompt ne s'execute donc QUE si la decision change :
le lui redemander en une phrase, en citant le niveau A, avant de toucher au code.
MotionConfig reducedMotion="user" ne couvre pas ce cas : il neutralise les transforms de Framer,
pas un setInterval ni une transition d'opacite.

Si la decision change, fini quand : la rotation ne demarre pas sous prefers-reduced-motion (les
quatre vues restent atteignables par HeroModuleDock, deja cliquable), une commande de pause
existe pour les autres, et un test couvre les DEUX preferences. Ne pas se contenter de ralentir :
la conformite demande un CONTROLE, pas une cadence plus douce.
```

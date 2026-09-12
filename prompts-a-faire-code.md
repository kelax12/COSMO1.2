# Prompts — un par item ouvert de `a-faire-code.md`

**Écrit le 2026-09-12**, après la passe de remesure du même jour. Un prompt par item **non clos**,
prêt à coller dans une session neuve.

**Mis à jour le 2026-09-12 au soir.** Les trois prompts P0 (`C-72`, `C-73`, `C-74`) étaient déjà
retirés. **Sept de plus sont retirés ce soir**, traités dans une passe unique :

| Item | Ce qui a été fait |
|---|---|
| `C-38` | 4ᵉ angle mort d'`i18n:scan` refermé — la VALEUR d'une propriété d'objet. 0 → 15 chaînes → 0 |
| `C-70` | 28 cibles tactiles (et non 22) ramenées à 0, le `console.log` du harnais devient un `expect` |
| `C-06` | règle ESLint locale qui exige la justification ; 31 → 27 désarmements, tous justifiés |
| `C-03` | gelé, et écrit aux deux endroits exigés (`CLAUDE.md` + `docs/ARCHITECTURE.md`) |
| `C-55` | les trois surfaces mesurées : **1 finding réel** (la case de sélection sans nom ni rôle), 2 artefacts de harnais |
| `C-25` | arbitrage rendu par Axel et appliqué : deux thèmes passent AA, cliquet posé sur les quatre |
| `C-23` | remesuré — « 41 nœuds » était un tirage (21 / 41 / 55 sur trois passes). Noyau reproductible : 11 nœuds, dont 2 corrigés |
| `C-12` | critère TENU : trois runs CI consécutifs, six passes, toutes au-dessus de 90 sur `/`. Aucune ligne touchée pour l'obtenir |

Et trois correctifs qui n'étaient dans aucun item, tous trouvés **par la CI** :
la pastille de catégorie portait un `aria-label` sur un `div` sans rôle (11 nœuds, nom ignoré par
les lecteurs d'écran), le champ « Objectif » de `/statistics` n'avait aucun nom accessible, et un
fichier committé importait un module que git ne suit pas — ce dernier a désormais sa garde
(`scripts/tracked-imports.guard.test.mjs`), parce qu'aucun outil local ne peut le voir.

**11 items restent**, dans l'ordre où ils devraient être traités. Six d'entre eux (tout le § P1)
n'attendent **pas de code** : ils attendent un geste d'Axel — une migration, un secret, un
déploiement.

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
   (check:bundle, architecture.guard, i18n:scan, i18n:identical, test:coverage, touch-targets).
3. Tout correctif de garde repart avec un TEMOIN : une sonde qui refuse un detecteur qui ne
   detecterait plus rien. Le voir echouer avant de le commiter.
4. Un defaut d'interface se verifie en OUVRANT l'ecran, pas en relisant le code.
5. Plusieurs sessions travaillent dans cet arbre. Relire `git status` avant de commiter, ne
   stager que tes propres fichiers, et relire le ledger de migrations avant d'en appliquer une.
6. Quand la mesure contredit l'enonce de l'item, c'est l'enonce qui a tort : le corriger dans
   a-faire-code.md, avec le chiffre mesure et sa date. Cinq enonces se sont deja reveles faux
   a la remesure.

A la fin : mettre a jour la note de l'item dans a-faire-code.md (ce qui est fait, ce qui reste,
sous quelles reserves), puis commiter et pousser.
```

---

# ~~P0 — la CI de `main` est ROUGE~~ · ✅ les trois sont corrigés le 2026-09-12

Les prompts `C-72`, `C-73` et `C-74` ont été retirés : le travail est fait, et un prompt qui décrit
un défaut corrigé enverrait une session refaire une mesure déjà rendue.

**Ce qu'ils ont appris, et qui vaut pour les prompts qui restent** — deux des trois énoncés étaient
faux, et l'investigation a coûté plus que la correction :

| Item | Ce que l'énoncé disait | Ce qui était vrai |
|---|---|---|
| **C-72** | le produit refuse aujourd'hui | le TEST comparait la date de Node (UTC en CI) à celle de la page (`Europe/Paris`) : il ne pouvait échouer qu'entre 22 h et minuit UTC |
| **C-73** | deux commandes du bandeau sous 44 px | deux FAUX POSITIFS du détecteur, qui masquaient le vrai défaut : 8 pilules de `/tasks` passées de 44 à 36 px le 2026-09-06 |
| **C-74** | timeout de 180 s, cause à trouver | la cause était écrite dans le journal Playwright depuis le premier run : un toast Sonner intercepte le clic |

🔴 **La règle qui en sort, à appliquer à tous les prompts ci-dessous** : un test rouge ne dit pas
où est le défaut, il dit qu'il y en a un **quelque part entre le produit et sa mesure**. Avant de
corriger le produit, prouver que c'est bien lui — sur ces trois-là, un seul l'était.

⚠️ **Et lire le journal AVANT de raisonner.** Sur `C-74`, trois lignes de log nommaient la cause ;
elles avaient été produites à chaque run depuis le 2026-09-10.

---

# P1 — du code écrit qui ne produit RIEN en production

> Ces sept-là ne demandent pas de travail supplémentaire : ils demandent un **geste**
> (une migration, un déploiement, un secret). Les gestes sont listés au **§ 11.1** de
> `a-faire-code.md` et repris dans `a-faire-manuel.md`.

## C-30 + C-39 · les preuves qui survivent à la suppression d'une organisation (mig. 138)

```
Objectif : C-30 et C-39, qui se debloquent ensemble par la migration 138.

Etat mesure le 2026-09-12 : le ledger de prod porte 143 et 144 mais les 136 a 140 n'y sont pas.
Tant que la 138 n'est pas appliquee, supprimer une organisation DETRUIT ses preuves L215-1
(renewal_notices) et sa renonciation au droit de retractation (withdrawal_consents), toutes deux
en CASCADE depuis organizations(id).

A faire :
1. Relire supabase/migration/138_evidence_survives_org_deletion.sql en entier, sans l'appliquer.
2. Relire le ledger EN BASE avant d'appliquer : ce depot a deja applique deux fois la meme
   migration parce qu'une session voisine etait passee avant.
3. Appliquer, puis verifier ACTEUR PAR ACTEUR dans une transaction annulee par un RAISE final,
   comme les mig. 130 a 135 : supprimer une org de test et prouver que les deux tables gardent
   leurs lignes, que le proprietaire seul peut supprimer, et qu'un admin non proprietaire est
   refuse. Ne JAMAIS conclure d'un « success ».
4. Verifier ensuite que useDeleteOrgFlow (C-39) fait bien : resilier -> rembourser -> supprimer,
   dans cet ordre, et que rien ne s'execute si le remboursement echoue.

C-39 depend AUSSI du deploiement de stripe-org-refund (prompt C-65) : la 138 seule ne ferme que
C-30. Le dire dans la note de l'item plutot que de cocher les deux.
```

## C-31 · plafond de débit sur `report-bug` (mig. 139 + secret + déploiement)

```
Objectif : C-31. report-bug est un relais d'e-mail ouvert, sans aucune limite de debit, et la
version DEPLOYEE en production est la v8 du 2026-08-29, donc sans le plafond ecrit depuis.

Ordre IMPOSE, ne pas l'inverser :
1. Appliquer supabase/migration/139_rate_limits.sql (relue d'abord, ledger relu d'abord).
   Piege qui ne se voit qu'en jouant la borne : le refus doit etre `hits > p_limit`, jamais
   `>=`. Avec `>=`, le compteur gele sur la limite, `hits <= limit` reste vrai, et le plafond ne
   refuse JAMAIS. Ecrire le test qui montre la borne ROUGE avant de la voir verte.
2. Poser le secret RATE_LIMIT_SALT cote Supabase. Sans lui consumeRateLimits REFUSE, et c'est
   delibere : pas de sel, pas de service, plutot qu'un hachage devinable.
3. Seulement ensuite, deployer report-bug, sinon la fonction appelle une RPC absente.
4. Le meme deploiement emporte C-32 (allowlist de piece jointe reellement appliquee) et C-33
   (une panne d'authentification ne doit plus anonymiser l'auteur en silence). Les traiter dans
   la meme passe, et le dire.

Ordre de grandeur arbitre : 3 rapports / heure / compte, 10 / jour / IP. Le CAPTCHA n'est PAS
retenu : il ne protege pas d'un appel direct a la fonction.

Fini quand : la version deployee est citee AVEC SA DATE dans a-faire-code.md (un « corrige »
sans version deployee decrit un commit, pas la production), et un appel reel depassant la borne
rend un refus.
```

## C-48 · identifiants de refus de dépendance (mig. 137)

```
Objectif : C-48. Un refus de dependance de tache dit deux choses differentes, aucune lisible.
Le code est ecrit ; la migration 137 (dependency_error_identifiers) n'est pas appliquee, donc
src/.../dependency-errors.ts traduit encore via une TABLE DE TRANSITION sur des phrases
ANGLAISES, c'est-a-dire en identifiant une erreur par son message, ce que CLAUDE.md interdit.

A faire : relire la 137, relire le ledger en base, appliquer, verifier acteur par acteur dans
une transaction annulee que chaque refus rend bien son identifiant, puis retirer la table de
transition et son repli. Un test doit echouer si un message anglais reapparait comme cle.

Fini quand : plus aucune identification par message dans ce chemin, et les deux formulations
divergentes disent la meme chose, en francais comme en anglais, verifie DANS le navigateur.
```

## C-65 · déployer `stripe-org-refund`

```
Objectif : C-65. Le remboursement du mois en cours est promis aux CGU depuis le 2026-09-04, la
fonction est ecrite et testee (12 cas de calcul, parcours E2E livre le 2026-09-11), et
stripe-org-refund N'EXISTE PAS en production : verifie le 2026-09-12, 7 Edge Functions actives,
elle n'en fait pas partie.

Bonne nouvelle mesuree : la dependance croisee est levee. stripe-webhook est en v27 depuis le
2026-09-06 avec sa branche charge.refunded, donc la ligne compensatoire au journal
d'encaissement est en ligne. stripe-org-refund peut partir SEULE.

A faire : deployer, puis jouer un remboursement reel contre le compte Stripe de TEST : rien n'a
jamais ete joue contre Stripe. Verifier dans l'ordre : le montant au prorata des mois non
consommes, la ligne compensatoire ecrite au journal, l'abonnement RELU par l'ecran (sans
invalidation il continue d'afficher le forfait payant et son bouton de remboursement), et
l'absence de second appel (useCancelAndRefundOrg doit poser retry: 0 ; une mutation qui deplace
de l'argent ne rejoue JAMAIS toute seule).

Fini quand : la version deployee et sa DATE sont ecrites dans a-faire-code.md, et un
remboursement de test est passe de bout en bout.
```

## C-28 · le canal d'alerte d'ops est inerte (secret `OPS_ALERT_WEBHOOK_URL`)

```
Objectif : C-28. ci-alert.yml est ecrit et branche ; le secret OPS_ALERT_WEBHOOK_URL n'est pas
dans les secrets ACTIONS du depot (il n'existe que cote Supabase). Tant qu'il manque, tout echec
de garde reste une archive que personne ne lit.

Preuve que ca compte, et elle est neuve : le job « Edge deploy drift » echoue TOUS LES JOURS
depuis sa mise en service (voir C-35), et personne ne l'a vu.

A faire : poser le secret, puis DECLENCHER l'exercice a blanc en workflow_dispatch et verifier
que le message arrive. Un canal qu'on n'a pas vu delivrer n'est pas un canal.

Ne jamais rendre une garde conditionnelle a la presence de son propre secret.
```

## C-35 · la garde de dérive des Edge Functions n'a JAMAIS comparé (secret `SUPABASE_ACCESS_TOKEN`)

```
Objectif : C-35, REDESCENDU de fini a commence le 2026-09-12. Le code de la garde est bon ; le
job « Edge deploy drift » echoue quotidiennement sur :

  ##[error]SUPABASE_ACCESS_TOKEN absent : le code deploye des Edge Functions N A PAS ete
  compare au depot. Ce n est pas un avertissement, c est l echec de la garde.

Donc RIEN n'a jamais ete compare en CI, et aucun « deploye » de a-faire-code.md n'est verifie en
continu : les versions citees viennent de lectures manuelles par l'API Management.

A faire : poser SUPABASE_ACCESS_TOKEN dans les secrets ACTIONS (jeton personnel Supabase, portee
lecture du projet), relancer le job, et lire ce qu'il rend sur les 7 fonctions. Il est probable
qu'il trouve de vraies divergences des le premier run qui compare : c'est le but.

Fini quand : un run VERT avec ses 7 fonctions comparees, et un echec de comparaison vu arriver
sur OPS_ALERT_WEBHOOK_URL (C-28). Sinon on a remplace un silence par un autre.
```

---

# P2 — critère non atteint, il reste du travail

## C-23 · le dernier verrou de la gate axe-core — un SECOND arbitrage de marque

> ⚠️ **Réécrit le 2026-09-12.** `C-25` est clos (les deux thèmes fautifs sont passés AA), et les
> chiffres de l'ancien prompt étaient faux : « 41 nœuds en trois familles » était un **tirage**,
> pas un total.

```
Objectif : C-23. La gate axe-core bloque deja tout `serious` SAUF color-contrast, nommement
dispense. Ce qu'il reste a decider tient en NEUF noeuds.

Mesure d'entree, faite le 2026-09-12, et elle contredit l'ancien enonce : trois passes
consecutives de e2e/a11y-audit.spec.ts sur le MEME commit rendent 21, 41 puis 55 noeuds
color-contrast. Le total n'est pas reproductible — axe photographie la page a un instant, et ces
routes entrent en fondu. Les paires a 1,14 / 1,15 / 1,22 / 1,66 (un gris sur un gris presque
identique) sont mesurees EN PLEIN FONDU.

Reproductible dans les TROIS passes, et seulement ca :
  #2563eb sur #e3ebfa = 4,31  x9   <- ce qui reste
  #60a5fa sur #ffffff = 2,54  x2   <- corrige le 2026-09-12 (AuthForm, un bleu de theme
                                      SOMBRE pose sur une surface blanche)

Les 9 restants sont l'accent du theme CLAIR sur son propre fond teinte a 10 %. Les corriger
demande de foncer `--color-accent` (#1d4ed8 rendrait 5,59 sur ce fond) — mais c'est la couleur
des LIENS et du FOCUS, donc un SECOND arbitrage d'identite, distinct de celui rendu pour C-25
qui ne portait que sur `--color-accent-solid`. Proposer 2 ou 3 teintes, les RENDRE cote a cote
dans le produit, et laisser Axel trancher. Ne pas le decider a sa place.

Fini quand : soit la teinte change et la dispense color-contrast tombe de SERIOUS_NOT_BLOCKING,
soit la decision « on garde, voici pourquoi et ou c'est acceptable » est ecrite dans
docs/ACCESSIBILITY.md, et alors la dispense y renvoie nommement.

Deux reserves a ne jamais omettre :
- axe ne scanne que l'ETAT INITIAL de chaque route : modales, menus et calendriers ne sont dans
  aucun de ces chiffres ;
- axe ne scanne que LE THEME PAR DEFAUT. C'est ce qui a laisse le bouton principal a 3,34:1
  pendant dix-neuf jours sans qu'aucun run ne puisse le dire (C-25).
  `src/theme-contrast.guard.test.ts` couvre desormais les quatre themes, mais seulement pour le
  couple accent-solid / son texte.
```

## C-24 · le dernier des quatre audits d'accessibilité

```
Objectif : C-24. Trois audits sur quatre sont passes le 2026-09-03. Il reste la moitie
« appareil reel » de A-4 (voir § 10 et a-faire-manuel.md §7, M-25) : aucune mesure n'a jamais ete
prise sur un vrai telephone, seulement en viewport emule.

Les pieges WebKit documentes dans docs/MOBILE.md viennent JUSTEMENT de bugs invisibles en
emulation. Ce qu'on attend : les bugs de feuille, de clavier virtuel, de 100vh et de gestes, et
la confirmation iOS de C-56, dont le mecanisme differe d'Android.

Le prompt complet est deja ecrit : prompts-audits.md, section A-4. Le lire plutot que d'improviser
un perimetre.

Fini quand : les findings sont verses dans a-faire-code.md avec leurs numeros C-NN, ou le rapport
dit explicitement « rien ». Un audit qui ne rend rien se DIT ; il ne s'omet pas.
```

# P3 — pas commencé

## C-18 · les CVE dev-only, encore un autre lot

```
Objectif : C-18. Remesure le 2026-09-12 : `npm audit` rend 7 avis (2 high, 5 moderate) sur six
paquets : js-yaml, fast-uri, vitest / @vitest/mocker / @vitest/coverage-v8, hono, qs. Ce n'est
plus du tout le lot de l'enonce, et ce ne sera pas le tien : RELIRE `npm audit` avant d'agir,
jamais cet item seul.

Ce qui ne change pas, et qui decide de la priorite : `npm audit --omit=dev` rend
« found 0 vulnerabilities », exit 0. Rien n'atteint le navigateur.

Quatre PR Dependabot attendent (vitest 4.1.11, hono 4.13.7, fast-uri 3.1.7, date-fns 4.4.0).
La montee de vitest est la seule qui touche les seuils de couverture : rejouer
`npm run test:coverage` derriere, quand la machine est libre (le run prend ~11 min et MEURT en
silence si une autre session fait tourner sa suite en parallele). Ne JAMAIS baisser un seuil.

Reecrit package-lock.json et node_modules : a faire quand AUCUNE autre session ne travaille dans
l'arbre. Ne jamais meler cette passe a une passe securite produit : deux natures de risque, et
les confondre fait passer l'une pour l'autre.

Fini quand : `npm audit` rend 0, les cinq gates sont rejouees derriere, et le tableau de l'item
porte sa nouvelle date.
```

## C-58 · React 19 et `react-router` 8 : la décision, avant le code

```
Objectif : C-58. Ce n'est plus une urgence securite, la CVE est fermee sous React 18 depuis le
2026-07-28. C'est redevenu un arbitrage de cout, et l'arbitrage du 2026-09-03 dit OUI, mais
« chantier L, a sequencer APRES les P0 ».

L'argument de fond, qui ne depend d'aucune CVE : sous React 19 `ref` devient une prop ordinaire,
donc la classe de bug qui a coute Button puis Input (un forwardRef manquant, SILENCIEUX par
construction, qui a rendu le calendrier impilotable au clavier) disparait. C-19 et C-60 se
reglent dans la meme PR. Chiffrage composant par composant : docs/MIGRATION-REACT19.md.

Avant d'ecrire une ligne : verifier que les P0 de ce fichier (C-72, C-73, C-74) sont fermes et
que la CI de main est VERTE. Migrer sur une CI rouge, c'est perdre le seul signal qui dira si la
migration a casse quelque chose.

Fini quand : branche dediee, les cinq gates vertes, la suite E2E complete verte (210 cas /
25 specs / 4 projects), et docs/MIGRATION-REACT19.md mis a jour avec ce qui a reellement coute.
```

## C-69 · la fenêtre produit de la landing tourne sans pause

```
Objectif : C-69. AppWindowShowcase (src/components/showcase/AppWindowShowcase.tsx) change de vue
toutes les 2,5 s indefiniment (ROTATE_MS ligne 57, setInterval ligne 139), gate par le seul
useInView ligne 119. Verifie le 2026-09-12 : rien n'a change depuis le constat. Ni bouton de
pause, ni arret au survol, ni au focus, et AUCUN egard pour prefers-reduced-motion : mesure, la
rotation est identique sous reduce.

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

# Prompts — un par item ouvert de `a-faire-code.md`

**Écrit le 2026-09-12**, après la passe de remesure du même jour. Un prompt par item **non clos**,
prêt à coller dans une session neuve : 22 items, dans l'ordre où ils devraient être traités.

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

# P0 — la CI de `main` est ROUGE. Ces trois-là passent devant tout le reste

## C-72 · Le report en masse d'une tâche en retard refuse AUJOURD'HUI

```
Objectif : C-72. Le calendrier de report en masse desactive le jour meme, donc une tache en
retard ne peut etre remise qu'a demain. `e2e/demo-calendar.spec.ts:94` (surface 3) est rouge
sur main depuis le run du 2026-09-11 22:06, trois fois de suite, retries compris.

Ce que le test observe :
  locator('td[data-day="<aujourd hui>"]') -> data-disabled="true", class rdp-disabled
  attendu : NON desactive.

Ou regarder :
  src/components/ui/date-picker.tsx:41   floor = new Date(minDate + "T00:00:00")
  src/components/ui/date-picker.tsx:89   disabled={floor ? { before: floor } : undefined}
  src/components/ui/date-picker.tsx:42   presets filtres par p.value >= minDate  (celui-la marche)
  src/components/task-table/OverdueBanner.tsx:83        minDate = date MACHINE
  src/components/task-table/OverdueQuickActions.tsx:83  minDate = todayKeyInTz(tzPref)

Deux hypotheses a departager par la mesure, pas par la lecture : (a) { before: floor } de
react-day-picker 9.14 n'est pas exclusif du jour-pivot tel qu'on le lui passe ; (b) les deux
sources de minDate ne designent pas la meme journee. L'asymetrie avec la rangee de presets, qui
survit, est un indice : les deux bornes ne sont pas ecrites pareil.

Fini quand : le cas de test rend vert SANS etre modifie ; un test unitaire sur DateCalendarPanel
verifie les deux bords (aujourd'hui actif, hier desactive) ; et le cas est rejoue avec une
preference de fuseau MANUELLE differente de celle de la machine, seul moyen de savoir laquelle
des deux sources de minDate est la bonne. Voir CLAUDE.md § Saisie de date et § Fuseau horaire.
```

## C-73 · Deux commandes du bandeau de démo sous 44 px, sur les 8 pages protégées

```
Objectif : C-73. `e2e/touch-targets.spec.ts:175` est rouge sur HUIT routes (/dashboard,
/entreprise, /okr, /tasks, /habits, /settings, /agenda, /statistics) dans tous les runs CI
examines (2026-09-10 et 2026-09-11). Un seul coupable, un composant partage :

  93 x 11 px  « Creez un compte »           src/components/DemoConversionBanner.tsx:50 et :63
  14 x 14 px  « Masquer la banniere demo »  src/components/DemoConversionBanner.tsx:77

Deux points a trancher, chacun explicitement :
- La croix porte DEJA une zone de 44 px, mais seulement sur mobile
  (before:h-11 before:w-11 ... md:before:hidden). Soit on l'etend, soit on declare pourquoi la
  souris s'en dispense, mais on ne laisse pas une garde echouer tous les jours.
- « Creez un compte » est un bouton EN LIGNE dans une phrase, et WCAG 2.5.5 dispense
  explicitement ce cas. C'est la dispense que C-57 avait retenue pour l'unique bouton d'/okr.
  Si elle vaut ici, c'est LA GARDE qui doit la connaitre, pas le produit qui doit grossir.

Ne pas rouvrir C-57 : il est clos sur son propre perimetre (cases a cocher, boutons d'/okr), ce
bandeau n'etait dans aucun de ses releves.
Ne jamais retirer une route du balayage pour faire passer la garde.

Fini quand : `npm run test:e2e -- touch-targets` rend zero sur les huit routes, toute dispense
est nommee dans le code de la garde AVEC son motif, et le job `e2e` de main repasse au vert.
```

## C-74 · `ShareListSheet` : le clavier n'atteint jamais la feuille de partage

```
Objectif : C-74. `e2e/a11y-keyboard-audit.spec.ts:396` echoue sur un TIMEOUT DE 180 s dans tous
les runs CI examines. Le clic sur « Partager la liste » ne se resout jamais :

  locator resolved to <button data-a11y-trigger="1" aria-label="Partager la liste" ...>
  attempting click action -> element is not stable (x2), puis visible/enabled/stable,
  scrolled into view, et le clic n'aboutit pas.

Deux lectures possibles, a trancher DANS le navigateur : un element qui se remet a bouger
(animation de la barre de listes, src/pages/tasks/TaskListsBar.tsx) ou un recouvrement par une
surface restee ouverte.

Renseignement utile : plus tot dans le MEME run, le harnais releve la feuille comme correcte
({"focusMovedIn":true,"trapped":true,"escClosed":true}). Ce qui echoue est la REOUVERTURE.

Ne pas passer le cas en skip : la mesure clavier de cette surface disparaitrait sans que rien ne
le dise, exactement le defaut du § « Une garde se verifie sur ce qu'elle REGARDE ».

Fini quand : la cause est nommee, corrigee dans le PRODUIT si c'en est un, le cas rend son releve
[a11y-kbd] ShareListSheet comme les neuf autres surfaces, et il ne coute plus 3 minutes par run.
```

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

## C-12 · la landing doit tenir 90 en CI, de façon reproductible

```
Objectif : C-12. Le fond a ete corrige (C-67, C-68) et la mesure le montre : sur les trois
derniers runs CI de main, `/` rend 91 et 95 (09-11 22:06), 64 puis 95 (09-11 11:56), 92 et 94
(09-10). Toutes les autres pages du meme build sont a 96-97.

Le critere « deux passes au-dessus de 90 » est donc tenu DEUX RUNS SUR TROIS. La page n'est plus
lente en moyenne, elle est BIMODALE, exactement le regime decrit pour l'autre parcours en C-68 :
une file qui sature n'a pas un cout progressif, elle a deux etats.

A faire : trouver ce qui produit la passe a 64 (TBT 759 ms contre 49 a 147 ms sur les autres).
La mesure LOCALE ne vaut rien ici : la charge machine domine, la landing et le guide y rendent le
meme score. Toute attribution vient du runner. `npm run profile:landing` ne sert qu'a comparer un
AVANT/APRES sur la MEME page.

Ne pas clore sur le run le plus favorable : un echantillon rapporte comme un total est
precisement ce que ce fichier reproche a l'enonce d'origine de C-23.

Fini quand : trois runs CI consecutifs rendent les DEUX passes au-dessus de 90 sur `/`.
```

## C-23 + C-25 · le dernier verrou de la gate axe-core est un arbitrage de marque

```
Objectif : C-23 et C-25, qui ne se separent plus. La gate axe-core bloque deja tout `serious`
SAUF color-contrast, nommement dispense. Les 41 noeuds restants sont TOUS du contraste, en trois
familles mesurees :
  - le bleu #2563eb sur son fond teinte #e3ebfa : 4,31:1, neuf routes ;
  - le blanc sur le DEGRADE du bouton principal : 3,49 a 4,48 selon l'echantillonnage ;
  - des paires transitoires mesurees en plein fondu (1,02:1) : durcir la-dessus rendrait la CI
    instable sans rien rendre plus lisible.

C-25 est l'arbitrage : le bleu de marque est a 3,34:1, laisse en attente depuis le 2026-08-24.
Un arbitrage qui ne se rend pas devient un oubli.

Le bleu porte l'identite visuelle : la nouvelle teinte se CHOISIT A L'OEIL sur la landing avant
d'etre posee en token (src/index.css, --color-accent / --color-accent-solid, quatre themes).
Proposer 2 ou 3 teintes conformes, les montrer sur la landing, et laisser Axel trancher.

Fini quand : soit la teinte change et la dispense color-contrast tombe de SERIOUS_NOT_BLOCKING,
soit la decision « on garde, voici pourquoi et ou c'est acceptable » est ecrite dans
docs/ACCESSIBILITY.md, et alors la dispense y renvoie nommement.
axe-core ne scanne que l'etat INITIAL de chaque route : modales, menus et calendriers ne sont
dans aucun de ces chiffres. Ne pas ecrire « zero violation » sans cette reserve.
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

## C-38 · `i18n:scan` certifie ZÉRO et le produit parle encore français

```
Objectif : C-38, et c'est la QUATRIEME fois que ce cliquet certifie zero a tort.

Deux angles morts sur trois sont refermes (0724e36) : la forme ternaire et le vocabulaire.
Le TROISIEME n'a jamais ete nomme : une chaine posee en VALEUR DE PROPRIETE D'OBJET a
l'interieur d'un appel de fonction. Sonde isolee :
  setErrors({ general: 'Erreur lors de la suppression...' })  ->  0 fichier, 0 chaine
alors que le meme texte dans throw new Error(...) est capture.

Ce n'est pas theorique. Les trois chaines que l'item nomme sont TOUJOURS en dur au 2026-09-12,
verifie par grep, et toutes trois s'affichent dans la modale de tache :
  src/components/task-modal/save-task.ts:158    Erreur lors de la creation. Veuillez reessayer.
  src/components/task-modal/save-task.ts:238    Erreur lors de la sauvegarde. Veuillez reessayer.
  src/components/task-modal/useTaskModal.ts:520 Erreur lors de la suppression. Veuillez reessayer.

A faire, dans cet ordre : ecrire la sonde qui soumet cette forme au scanner et LA VOIR ROUGE ;
corriger scripts/i18n-scan.mjs ; laisser le cliquet remonter ce qu'il trouve ; passer les trois
chaines, et tout ce que la correction decouvre, par t(...) ; redescendre le cliquet a 0.

Ne JAMAIS relever MAX_STRINGS pour faire passer la CI.
Ne jamais reecrire « plus une seule chaine en dur » : la phrase a deja ete vraie de la mesure et
fausse du produit quatre fois. Le seul enonce opposable est la sortie de `-- --list`.

Fini quand : la sonde remonte la chaine, les trois messages passent par t(...), et /en/login
comme /en/habits sont relus DANS LE NAVIGATEUR.
```

---

# P3 — pas commencé

## C-03 · les clés de `habits.completions` ignorent le fuseau choisi

```
Objectif : C-03. La preference de fuseau pilote le decoupage des journees pour les TACHES
(src/lib/timezone.ts, dayKeyInTz) ; les HABITUDES gardent des cles en date machine
(toLocaleDateString('en-CA')). Quelqu'un qui regle un fuseau manuel voit donc ses habitudes
decoupees autrement que ses echeances, sur le meme ecran.

L'arbitrage du 2026-09-03 dit : GELER, et l'ecrire. Migrer supposerait de savoir dans quel fuseau
etait chaque personne chaque jour, ce que la base ne sait pas, et decalerait des series que les
gens ont construites.

Ce prompt n'est donc pas « migre » mais « rends la decision opposable » : l'ecrire dans CLAUDE.md
ET docs/ARCHITECTURE.md, au meme endroit que la regle « ne jamais faire juger aujourd'hui par le
serveur » (mig. 119 / 122), et dire ce que l'utilisateur voit quand les deux decoupages divergent.

Fini quand : la decision est ecrite aux deux endroits, et l'item porte « gele, le <date>, parce
que ... ». Un gel non ecrit est un oubli qui se represente au prochain audit.
```

## C-06 · 31 `eslint-disable exhaustive-deps` dans 25 fichiers

```
Objectif : C-06. Recompte le 2026-09-12 : 31 occurrences dans 25 fichiers, l'enonce disait 36
dans 28, il datait du 09-03. Commande de mesure :
  grep -rn "exhaustive-deps" src --include=*.ts --include=*.tsx

Ce n'est pas 31 bugs, c'est 31 endroits NON EPROUVES : chacun est une dependance retiree a la
main, donc une fermeture potentiellement perimee, la famille de bug qui produit un ecran qui ne
se rafraichit pas, en silence. Ce depot en a deja rencontre plusieurs, dont FirstRunSetup, dont
la garde d'entree se refermait sous les doigts de la personne.

Arbitrage rendu : une regle ESLint qui EXIGE le commentaire. Chaque disable doit dire pourquoi
la dependance manquante ne peut pas perimer la valeur. Le nombre ne remonte plus, les
injustifiables partent en passant.

Fini quand : la regle est en place et `npm run lint` rend 0 erreur, chaque occurrence restante
porte sa justification, celles qui n'en ont pas ont ete supprimees (dependances honnetes,
useEvent ou ref), et le avant/apres est publie : 31 -> N.
```

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

## C-55 · trois surfaces que l'audit clavier n'a PAS réussi à mesurer

```
Objectif : C-55. Honnetete de couverture, pas finding de produit. Trois choses cherchees sans y
arriver le 2026-09-03, qu'il ne faut donc pas croire verifiees :

1. Le calendrier ouvert depuis une entree de MENU : OverdueBanner (« Tout replanifier ») et
   TaskBulkActionsBar (« Modifier la deadline »). C'est la surface la plus risquee des huit : une
   GRILLE vit a l'interieur d'un role="menu", ce que l'ARIA n'autorise pas, et les correctifs de
   C-51 (autoFocus) n'ont pas ete eprouves dans ce conteneur.
   Le premier n'apparaissait pas dans le jeu de demo faute de tache en retard, et le second
   restait desactive (« 0 selectionnee »). Il faut FABRIQUER l'etat, pas contourner.
2. Le bouton « Plus d'actions » de la barre de selection n'est jamais juge stable par Playwright,
   34 tentatives, jamais immobile. A rapprocher de C-74 : meme symptome, autre barre.
3. En mode selection, les cases a cocher gardent le nom « Marquer comme completee » alors
   qu'elles selectionnent. Releve dans l'arbre d'accessibilite, non confirme par un clic reussi.

Fini quand : les trois sont mesures DANS LE NAVIGATEUR et rendent un finding ou un « rien ». Un
« rien » se dit ; il ne s'omet pas.
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

## C-70 · 22 cibles tactiles sous 44 px dans `TeamTaskModal`

```
Objectif : C-70. 22 commandes sous 44 x 44 px dans
src/components/organization/TeamTaskModal.tsx, trouvees par l'audit A-4 le 2026-09-04.
docs/MOBILE.md porte deja « Touch target < 44 x 44 px (WCAG 2.5.5) » comme regle du depot.

Le motif est etabli et il ne se reinvente pas : TouchTarget (src/components/mobile/), zone
tactile a 44 px, ICONE INCHANGEE, marges negatives pour que la rangee ne grandisse pas avec la
cible. Onze fichiers l'utilisent deja.

Coordonner : ce fichier est modifie dans l'arbre de travail au 2026-09-12 (facade toast). Relire
`git status` avant de commencer, ne stager que tes lignes.

Fini quand : le balayage de e2e/touch-targets.spec.ts couvre cette modale OUVERTE (elle n'est
dans aucun releve actuel, qui ne scannent que l'etat initial des routes) et rend zero. Ajouter la
surface au balayage FAIT PARTIE du travail : sans ca, on corrige sans cliquet.
```

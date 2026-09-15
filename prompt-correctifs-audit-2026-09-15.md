# Prompt de correction · passe d'audit du 2026-09-14 au soir

**Écrit le 2026-09-15.** Il couvre **tout ce que la passe d'audit complète a trouvé** et qui demande
du code. Chaque item porte : où c'est, ce qui a été mesuré, ce qui prouve que c'est fini, et les
pièges connus.

> ⚠️ **La convention de ce dépôt est un prompt par item** (`prompts-a-faire-code.md` : « ne jamais
> en coller deux, chacun porte son critère de sortie »). Ce fichier est un prompt unique parce
> qu'il a été demandé ainsi. **Il est découpé en phases P0 à P5 dans l'ordre où elles doivent être
> traitées** : une session qui n'en prend qu'une colle le préambule puis la phase, et rien d'autre.
>
> **P0 et P1 sont à faire avant d'envoyer du trafic sur le produit.** Les suivantes ne bloquent
> rien.

---

## Le prompt, à coller tel quel

```
Depot COSMO (C:\Users\Axel\Documents\COSMO1.1). Lis d'abord CLAUDE.md, puis dans
a-faire-code.md le § 0 (arbitrages deja tranches, ils font foi) et les items C-77 a C-80.
Le tableau de bord de la passe qui a produit ce prompt est dans docs/README.md,
§ « Mise a jour du 2026-09-14 (soir) ».

═══════════════════════════════════════════════════════════════════════════
REGLES DE METHODE · non negociables, elles viennent de defauts reels de ce depot
═══════════════════════════════════════════════════════════════════════════

1.  MESURER AVANT, MESURER APRES, PUBLIER LES DEUX CHIFFRES. Un correctif dont on ne peut
    pas montrer le gain est une dette de mesure, pas un progres.

2.  NE JAMAIS relever un plafond ni baisser un seuil pour faire passer une garde :
    check:bundle, architecture.guard, design-system.guard, modal-a11y.guard, i18n:scan,
    i18n:identical, test:coverage, touch-targets. Un plafond ne descend que quand la
    mesure descend.

3.  TOUT CORRECTIF DE GARDE REPART AVEC UN TEMOIN : une sonde qui refuse un detecteur qui
    ne detecterait plus rien. LA VOIR ECHOUER avant de la commiter, et le dire dans le
    message de commit.

4.  UN DEFAUT D'INTERFACE SE VERIFIE EN OUVRANT L'ECRAN, pas en relisant le code. Le
    navigateur integre suffit ; pour le mobile, emuler iPhone 12 (WebKit) et non un
    Chrome retreci.

5.  PLUSIEURS SESSIONS TRAVAILLENT DANS CET ARBRE. Relire `git status` avant de commiter,
    ne stager QUE tes propres fichiers, ne JAMAIS faire `git reset --hard`. Au 2026-09-15
    l'arbre porte des modifications non commitees d'une autre session, dont
    src/components/task-table/OverdueQuickActions.tsx (cf. phase P4), TaskListsBar.tsx et
    src/modules/auth/demo-profile.test.ts. NE PAS les stager avec les tiens.

6.  UNE PREUVE EST OPPOSABLE OU ELLE N'EXISTE PAS : un commit, un run CI cite par son
    numero, une version d'Edge Function avec sa date de deploiement, une ligne au ledger
    de migrations. JAMAIS un arbre de travail local. C-14 a ete compte clos pendant trois
    jours alors qu'aucune ligne de son correctif n'etait dans le depot.

7.  QUAND LA MESURE CONTREDIT L'ENONCE DE L'ITEM, C'EST L'ENONCE QUI A TORT : le corriger
    dans a-faire-code.md, avec le chiffre mesure et sa date. Onze enonces de ce depot ont
    deja ete demolis par leur propre remesure.

8.  UNE GARDE SE VERIFIE SUR CE QU'ELLE REGARDE, pas sur le fait qu'elle tourne. C'est LA
    lecon de la passe qui a produit ce prompt : cinq notes d'audit ont baisse parce
    qu'elles creditaient le VERDICT d'une garde sans avoir lu son PERIMETRE (sa liste de
    routes, sa liste de projects, sa liste de colonnes). Avant de crediter quoi que ce
    soit, lire la boucle `for`, pas le resultat du test.

9.  UNE GARDE A CLIQUET ZERO NE DIT RIEN DU DELTA. `OVERSIZED_BUDGET` rend le meme vert
    qu'il reste 0 fichier hors budget ou 12 qu'on vient de retirer de la liste. Le delta se
    lit dans la valeur PRECEDENTE de la constante et son commentaire date.

10. PAS DE TIRET CADRATIN (—) dans le texte livre, ni dans les commits : virgule,
    deux-points ou point median.

A la fin de CHAQUE phase : mettre a jour l'item correspondant dans a-faire-code.md (ce qui
est fait, ce qui reste, sous quelles reserves), repercuter dans l'audit du domaine concerne
(docs/*.md) avec la note si elle bouge, puis commiter et POUSSER. Attendre le run CI et
citer son numero.

═══════════════════════════════════════════════════════════════════════════
ETAT DEJA VERIFIE LE 2026-09-14 AU SOIR · ne pas le remesurer, s'en servir
═══════════════════════════════════════════════════════════════════════════

Tout ceci a ete mesure, pas recopie. Point de depart fiable :

  npm test                   228 fichiers, 2 586 passes, 1 saute (cas POSIX de check:edge,
                             it.skipIf(win32), normal sur Windows), exit 0
  npm run test:coverage      verte, exit 0 : 31,15 L / 30,73 S / 24,48 F / 26,35 B
  npm run typecheck / lint   0 erreur / 0 erreur, 31 warnings Fast-refresh toleres
  npm run build              exit 0 (VITE_SENTRY_DSN posee, vendor-sentry 49,3 ko)
  npm run check:bundle       critique 306,6 / 323,0 ko  ·  entree 66,9 / 71,0 ko
  npm run check:rls          132 policies dans 106 migrations, 0 violation
  npm run validate:migrations 152 fichiers, 0 erreur, 6 avertissements (les memes depuis
                             le 08-24)
  i18n:check / scan / identical  23 namespaces 0 erreur · 0 chaine en dur · 3 898 couples,
                             92 identiques, 0 non declaree
  npm run check:mail         vert, 1 avertissement (DMARC p=none)
  npx playwright test --list 220 cas / 26 fichiers, repartis :
                             chromium 107 (21 fichiers), mobile-safari 96 (19),
                             supabase-stub + warmup 17 (5)
  CI                         run 34935509652 sur 88843e3f : VERTE sur les cinq jobs

En production (projet ykeugqfgklejcdbrmawy) :

  50 tables dans public, 50 avec RLS activee, 126 policies, 117 fonctions
  advisors securite : 9 INFO rls_enabled_no_policy / 52 WARN authenticated_security_definer
                      / 2 WARN anon_security_definer / 1 WARN leaked_password_protection
  ledger supabase_migrations : 138 entrees, derniere 148_team_categories_tree_merge
  Edge Functions : stripe-webhook v33, stripe-create-checkout v23, delete-account v17,
                   stripe-org-checkout v15, renewal-notice v13, report-bug v12,
                   stripe-org-portal v12, stripe-org-refund v6
  plan de l'organisation Supabase : free (donc aucun PITR, finding A-9)
  28 comptes, dont demo@cosmo.app (jamais connecte) et testemail@gmail.com
  750 taches, 434 evenements, 32 habitudes, 13 OKR, 124 kr_completions
  org_subscriptions 0 ligne, payment_records 0 ligne, subscriptions 54 lignes
  PREMIUM_ENFORCED = false, ENTERPRISE_BILLING_ENFORCED = false,
  billing_flags.enterprise_seat_limit = false  (les trois alignes, etat voulu)

═══════════════════════════════════════════════════════════════════════════
P0 · C-77 · `okrTime` vaut 0 EN PRODUCTION sur /statistics
═══════════════════════════════════════════════════════════════════════════
A FAIRE AVANT D'ENVOYER DU TRAFIC. C'est le seul defaut de cette passe qu'un
utilisateur VOIT.

CE QUI EST MESURE
  La fonction VIVANTE en prod, lue par pg_get_functiondef (pas le depot), porte :

    okr_days AS MATERIALIZED (
      SELECT ... FROM okrs o
      CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(kr.elem->'history', '[]'::jsonb)) AS hist(elem)

  Le champ `history` n'est ecrit par AUCUN ecrivain du produit : absent de l'interface
  KeyResult (src/modules/okrs/types.ts), absent des mappers, `grep "history:" src` rend
  zero. `okr_days` est donc toujours vide et `okrTime` vaut structurellement 0.

  Consequence a l'ecran : la serie « OKR » du graphique « temps investi » de /statistics
  (DashboardBarChart.tsx, `okrs: r.okrTime`, vert #22c55e) est PLATE A ZERO pour 100 % des
  comptes reels, en production.

  Le defaut date de la mig. 074, entree au depot le 2026-07-16. Deux mois.

CE QUI REND L'ITEM URGENT ET PAS CHER A LA FOIS
  Le correctif du 2026-09-02 a repare la moitie CLIENTE (src/lib/workTimeCalculator.ts lit
  desormais kr_completions) et a ecrit le constat AU PASSE. La moitie production est restee
  vraie. Donc : le mode DEMO, celui qu'on montre, affiche juste ; le PRODUIT, celui qu'on
  vend, affiche zero. C'est le pire des deux sens.

  MAIS le SQL qui repare EST DEJA ECRIT ET COMMITE :
  supabase/migration/136_work_time_stats_okr_from_completions.sql, 230 lignes,
  commit 31482a3f du 2026-09-03, presente a HEAD. Elle n'a jamais ete APPLIQUEE.
  Il n'y a donc pas de SQL a ecrire, seulement a jouer et a verifier.

CE QU'IL FAUT FAIRE
  1. LIRE la migration 136 en entier avant de l'appliquer.
  2. Corriger sa premisse, qui est fausse d'un mot : son en-tete affirme « ce champ
     n'existe pas », verifie par grep dans src et JAMAIS en base. Mesure le 2026-09-14 :
     12 Key Results sur 28 portent bien un `history` non vide, de forme {date, increment}.
     Ils appartiennent TOUS au compte de seed aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa, donc
     aucun compte reel n'est concerne et la conclusion tient. Mais l'argument doit devenir
     un argument de DONNEES, prouve par une requete, pas un argument de code.
  3. L'appliquer par apply_migration (le chemin qui inscrit la ligne au ledger), pas par le
     CLI : la mig. 145 a ete appliquee au CLI le 2026-09-13 et sa ligne a du etre inseree a
     la main, ce qui laisse une migration appliquee et invisible du ledger si on oublie.
  4. Verifier APRES, en base.

CE QUI PROUVE QUE C'EST FINI
  a. `git ls-files` voit la 136 (deja vrai) ET le ledger porte sa ligne ;
  b. pg_get_functiondef('get_work_time_stats') ne contient PLUS `history` et contient
     `kr_completions` ;
  c. la valeur rendue par la RPC est COMPAREE a celle du calcul client
     (src/lib/workTimeCalculator.ts) sur un compte portant des kr_completions : les deux
     chemins donnent le meme nombre. Il y a 124 lignes dans kr_completions en prod, donc
     un compte exploitable existe ;
  d. l'ecran /statistics est OUVERT et la serie OKR n'est plus plate ;
  e. les trois autres colonnes de la RPC (taches, habitudes, evenements) rendent les MEMES
     chiffres qu'avant : la 136 ne doit rien deplacer d'autre. Prendre une empreinte avant.

PIEGES
  - « la fonction s'execute sans erreur » ne vaut RIEN ici : c'est exactement ce que fait la
    version fausse. Le critere est la VALEUR, pas le succes.
  - Ne pas crediter un gain de performance sans comparer ce que la fonction REND. La mig.
    127 a ete creditee de 854 ms -> 12,0 ms en aout et rendait deja zero sur cette colonne.
  - kr_completions.kr_id n'a PAS de cle etrangere vers key_results : c'est delibere et la
    136 l'explique. Ne pas « reparer » ca au passage.
  - Ne JAMAIS ecrire en base via execute_sql du MCP (contourne la RLS). apply_migration est
    le chemin prevu pour une migration.

═══════════════════════════════════════════════════════════════════════════
P1 · C-80 · la garde des cibles tactiles ne regarde AUCUNE page publique
═══════════════════════════════════════════════════════════════════════════
A FAIRE AVANT D'ENVOYER DU TRAFIC, pour le seul curseur au minimum.

CE QUI EST MESURE
  e2e/touch-targets.spec.ts force bien un viewport de 375 x 812, donc sa mesure est
  mobile. Mais sa boucle de routes est ecrite en clair (vers la ligne 265) :
    /dashboard, /entreprise, /okr, /tasks, /habits, /settings, /agenda, /statistics
  Huit routes PROTEGEES, zero page publique. Le spec est ne le 2026-09-04 avec cette liste :
  il n'a jamais couvert une page publique.

  Mesure contre la PRODUCTION, WebKit / iPhone 12, bandeau cookies refuse :
    /                          24 cibles sous 44 x 44 px
    /entreprise-presentation   23
    /blog                       2

  A trier, et le tri compte plus que le total :
  - la MAJORITE sont des liens de pied de page d'environ 20 px de haut. Ils echouent au
    critere AAA (2.5.5, 44 px) et passent le AA (2.5.8, 24 px) sur leur largeur. Dette de
    confort, pas blocage.
  - le bouton « Commencer » du header : 115 x 36 px (src/pages/LandingPage.tsx, vers la
    ligne 244, classes `px-4 py-2 lg:px-5 ... text-sm`). Le bouton de menu juste a cote fait
    `w-11 h-11`, soit 44 px : la cible tactile a ete traitee pour lui et pas pour le CTA le
    plus visible du produit.
  - LE PLUS GRAVE : le curseur « Nombre de membres de votre organisation » de
    src/pages/landing/entreprise/PricingSection.tsx est un input[type=range] avec
    `appearance: none` et `height: 6px` en CSS calcule, mesure 308 x 6 px. Il est stylE par
    l'auteur, donc HORS de l'exemption « controle du navigateur » de WCAG 2.5.8. C'est
    l'outil avec lequel un prospect choisit son palier, sur la page qui vend l'offre.
  - un bouton « Plus d'options (demonstration) » a 16 x 24 px : sous 24 px en largeur, donc
    sous le critere AA.

CE QU'IL FAUT FAIRE
  1. Le curseur d'abord, c'est le seul qui empeche un geste. NE PAS simplement grossir la
     piste (ca defigure la section) : agrandir la ZONE TACTILE. Piste visuelle inchangee,
     hauteur de la cible portee a 44 px par du padding ou une zone transparente, et un
     ::-webkit-slider-thumb / ::-moz-range-thumb d'au moins 24 px. VERIFIER dans un vrai
     WebKit emule iPhone, pas dans un Chrome retreci : la mesure a ete prise la.
  2. Le bouton « Commencer » : le passer a min-h-touch (la primitive existe deja et vaut
     44 px, cf. src/components/mobile/) sans changer son allure sur desktop.
  3. ELARGIR LA BOUCLE de touch-targets.spec.ts aux pages publiques : /,
     /entreprise-presentation, /guide, /blog, et les quatre pages cas d'usage.
  4. Trancher explicitement le sort des liens de pied de page : soit on les corrige, soit
     on les DISPENSE nommement, avec le motif ecrit et le critere vise (AAA vs AA). Le
     modele a suivre est la dispense `color-contrast` de e2e/a11y-audit.spec.ts, qui renvoie
     a la decision C-23 par son nom.

CE QUI PROUVE QUE C'EST FINI
  a. la suite touch-targets est VERTE avec les pages publiques dans la boucle ;
  b. le curseur mesure au moins 44 px de hauteur tactile, MESURE dans WebKit iPhone 12 et
     le chiffre publie ;
  c. toute exception restante porte son motif ET le critere WCAG vise ;
  d. le temoin du spec (« le detecteur sait voir une cible trop petite ») est toujours la et
     toujours vert.

PIEGES
  - ❌ Ne pas elargir la liste puis dispenser en masse : ce serait remplacer un angle mort
    par une liste d'exceptions, ce que ce depot appelle « une regression qu'on a decide de
    ne plus voir ».
  - Le bandeau cookies masque des elements : le refuser (choix le plus protecteur) avant de
    mesurer, sinon le comptage est faux.
  - 2.5.5 est AAA (44 px), 2.5.8 est AA (24 px). Ne pas les confondre dans les messages
    d'echec : le spec s'appelle « C-57 cibles tactiles (WCAG 2.5.5) », donc il vise AAA, et
    c'est un choix a assumer ou a reviser explicitement.

═══════════════════════════════════════════════════════════════════════════
P2 · C-78 · 96 cas E2E sur 220 ne tournent dans AUCUN workflow
═══════════════════════════════════════════════════════════════════════════
Ne bloque rien. Mais c'est la seule garde qui pourrait detecter une regression iOS, et
le trafic d'une campagne est majoritairement mobile.

CE QUI EST MESURE
  .github/workflows/ci.yml, job `e2e`, lance exactement :
    npx playwright test --project=chromium --project=supabase-stub
  soit 124 cas sur 220. Le project `mobile-safari` (iPhone 12, WebKit), 96 cas dans 19
  fichiers, n'est joue par AUCUN des neuf workflows (verifie par grep sur .github/).

  Le job e2e ne lance que chromium depuis sa CREATION, le 2026-06-06 (a163c2b3). Le project
  mobile-safari existe depuis le 2026-05-21. Trois mois sans jamais tourner.

  L'exclusion a ete FORMALISEE le 2026-09-05 (50b88929), dans le commit meme qui ajoutait
  supabase-stub au motif que « le laisser hors de la CI reviendrait a poser sur main des
  gardes qui ne tournent nulle part, la faute que ce depot s'est deja faite deux fois ». Le
  raisonnement juste et son exception ont ete ecrits dans le meme diff, a trois lignes
  d'ecart. Motif affiche de l'exception : « WebKit, ~1 min d'installation en plus ».

  CE QUI LAISSE SANS FILET : les feuilles mobiles, les gestes tactiles,
  reduced-motion-sheets, les cibles tactiles WCAG, et les deux suites d'accessibilite au
  clavier. Donc tout le perimetre iOS Safari, et le moteur sur lequel tourne VoiceOver.

CE QUE L'ITEM N'EST PAS
  Ce n'est PAS « ajouter un flag ». Rejoues depuis un poste le 2026-09-14, sur les trois
  specs les plus mobiles (touch-targets, reduced-motion-sheets, demo-touch-gestures) :
  9 passes sur 18, 11,4 min. Natures des 9 echecs : sept sont des attentes de fixture qui
  expirent (le CTA « Essayer la demo gratuite » de la landing n'est pas visible dans les
  30 s contre un serveur Vite de developpement sur WebKit), un cherche un bouton
  « Nouvelle » qui n'existe pas au viewport 390 px, un est un toContainText sur un h1.

  CE N'EST PAS UN DEFAUT PRODUIT, et il ne faut pas le presenter ainsi : la meme page, meme
  moteur WebKit, meme appareil emule, chargee depuis la PRODUCTION, rend `load` en 2 159 ms
  avec zero requete en vol, et son CTA visible en moins de 6 s, mesure 358 x 56 px.

  Autrement dit : une partie de ces 96 cas n'est pas ECRITE pour ce project, et personne ne
  le savait parce que rien ne les joue.

CE QU'IL FAUT FAIRE
  1. Installer webkit dans le job e2e (`npx playwright install --with-deps chromium webkit`)
     et ajouter --project=mobile-safari.
  2. Faire passer les cas, un par un. Pour chaque cas qui ne PEUT pas passer parce que le
     produit differe au viewport mobile, l'ajouter au `testIgnore` du project avec son
     MOTIF ECRIT. Le modele existe deja dans playwright.config.ts : demo-calendar et
     demo-task-dependencies y sont exclus avec quinze lignes qui disent pourquoi, et qui se
     terminent par « ce n'est PAS un constat que tout va bien sur mobile : c'est un ecart de
     produit, note comme tel ».
  3. Mesurer et publier le cout en temps du job.

CE QUI PROUVE QUE C'EST FINI
  a. un run CI VERT qui inclut --project=mobile-safari, cite par son numero ;
  b. le nombre de cas reellement joues en CI, avant et apres (124 -> N) ;
  c. chaque cas retire porte une ligne de motif, jamais un skip silencieux ;
  d. le cout en minutes du job, avant et apres.

PIEGES
  - ❌ Ne pas « reparer » les timeouts en montant les timeouts : la cause est le demarrage a
    froid du serveur Vite sous WebKit, pas la lenteur du produit. Regarder du cote du
    warmup, comme le project supabase-stub-warmup le fait deja pour son propre serveur.
  - ❌ Ne pas conclure d'un echec local a un defaut produit sans avoir joue la meme page
    contre la PRODUCTION sur le meme moteur. C'est ce qui a evite un faux diagnostic ici.
  - Le port 3210 (serveur du project supabase-stub) reste parfois occupe apres un run
    interrompu : `Get-NetTCPConnection -LocalPort 3210` puis Stop-Process avant de relancer.

═══════════════════════════════════════════════════════════════════════════
P3 · C-79 · rien ne relie les migrations du depot au ledger de production
═══════════════════════════════════════════════════════════════════════════
Aucun effet utilisateur. C'est une garde de verite documentaire.

CE QUI EST MESURE
  Comparaison nom a nom le 2026-09-14 : 152 fichiers au depot, 138 entrees au ledger,
  32 fichiers SANS aucune correspondance et 17 entrees SANS fichier.

  Les 32 sont presque tous les migrations precoces (000 a 058, plus 081 et 082), passees
  avant que le ledger serve. Elles SONT appliquees : verifie objet par objet sur un
  echantillon (events.exceptions de la 029, team_task_comments de la 082, tasks.recurrence*
  de la 058, events.is_private de la 081, tous presents). Mais ce n'est jamais le ledger qui
  l'etablit.

  Consequence : l'enonce « tout le depot est applique en prod, ledger relu » a ete ecrit
  cinq fois dans CLAUDE.md sur une lecture qui ne recouvre que 120 fichiers sur 152. Et
  « ledger a 148 entrees » etait le NUMERO de la derniere migration recopie comme un total.

CE QU'IL FAUT FAIRE
  Un script (scripts/check-migration-coverage.mjs, a brancher en CI) qui, pour chaque
  fichier de supabase/migration/, rend l'un des trois verdicts :
    - AU LEDGER (par nom, ou par nom prive de son prefixe numerique) ;
    - ABSENT DU LEDGER mais l'objet qu'elle cree EXISTE en base ;
    - ABSENT DES DEUX  -> echec.

CE QUI PROUVE QUE C'EST FINI
  a. le script rend les trois verdicts et sort en erreur sur le troisieme ;
  b. un TEMOIN le fait echouer sur une migration fictive dont l'objet n'existe pas ;
  c. il tourne en CI, et son premier run est publie avec le decompte des trois categories.

PIEGES
  - ❌ Ne pas se contenter d'un comptage : c'est precisement le comptage qui a menti.
  - npm run check:drift ne comble pas ce trou : il compare un SCHEMA, pas un journal, et
    demande deux etapes manuelles.
  - Le defaut jumeau est deja documente : une LIGNE au ledger ne prouve pas non plus qu'un
    CREATE OR REPLACE a remplace le corps vivant (mig. 144, rejouee par la 147 apres que
    pg_get_functiondef a montre l'ancien corps). Le script doit donc rester modeste sur ce
    qu'il prouve, et le dire dans sa sortie.

═══════════════════════════════════════════════════════════════════════════
P4 · M-44 · le retrait de la pastille « Aujourd'hui » est TRANCHE : il faut le defaire
═══════════════════════════════════════════════════════════════════════════

CE QUI EST MESURE
  src/components/task-table/OverdueQuickActions.tsx est modifie et NON COMMITE dans l'arbre,
  par une autre session. Le changement retire le bouton de report rapide « Aujourd'hui »,
  avec ce motif ecrit en commentaire :
    « Reporter une tache en retard a AUJOURD'HUI n'a pas de sens (elle est deja due
      aujourd'hui ou avant) »

  La moitie qui porte l'argument est FAUSSE. isOverdue (src/lib/deadline.ts) rend vrai si et
  seulement si daysUntilDeadline < 0, donc STRICTEMENT avant aujourd'hui ; isDueToday est la
  fonction voisine, pour === 0. Une tache qui affiche ces raccourcis n'est donc JAMAIS due
  aujourd'hui, et « la reporter a aujourd'hui » est le geste le plus courant.

  S'y ajoute l'intention du composant, ecrite dans son propre en-tete (maquette 16, « Le
  retard porte sa solution ») : sortir la tache du rouge EN UN GESTE. Apres le retrait, les
  deux options restantes sont « Demain » (qui laisse la tache en retard toute la journee) et
  « Choisir » (deux gestes de plus).

  Conclusion : C-72 avait raison, le produit est juste, la pastille reste.

CE QU'IL FAUT FAIRE
  Defaire ce changement non commite. Le fichier appartient a l'arbre d'une autre session :
  DEMANDER A AXEL avant de toucher au fichier, ou lui donner la commande. Ne pas le stager
  avec d'autres modifications.

PIEGE
  Indexer le fichier d'une autre session est exactement ce qui a produit trois commits
  `fix(build)` les 2026-09-13 et 09-14.

═══════════════════════════════════════════════════════════════════════════
P5 · les deux comptes qui ne sont pas des utilisateurs
═══════════════════════════════════════════════════════════════════════════
Rien a reparer dans le produit. A trancher, et a ecrire.

CE QUI EST MESURE
  auth.users porte 28 comptes, dont :
    demo@cosmo.app  (aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa), cree le 2026-01-10, JAMAIS
                    connecte, et porteur de 120 taches, 67 evenements, 6 habitudes et 4 OKR
                    EN PRODUCTION ;
    testemail@gmail.com, cree le 2026-07-17.
  get_admin_stats ne les exclut NI l'un NI l'autre (verifie dans sa definition en base).
  Donc la console /admin compte 28 utilisateurs la ou il y en a 26, et 16 % des taches de la
  plateforme appartiennent au compte de demonstration.

L'ARBITRAGE A RENDRE
  Deux voies, et la seconde est probablement la bonne :
  a. exclure ces comptes dans get_admin_stats  -> dette : une liste en dur dans du SQL, qu'il
     faudra tenir ;
  b. ne rien coder, et ECRIRE le biais la ou les chiffres se lisent (docs/ACQUISITION.md et
     la page /admin elle-meme), pour qu'il soit retranche a la lecture.
  Ne pas trancher seul : c'est un choix de produit, pas de code. Demander.

═══════════════════════════════════════════════════════════════════════════
HORS CODE · ce qui bloque vraiment, et qui n'appartient pas a une session
═══════════════════════════════════════════════════════════════════════════

  A-9      Le plan de l'organisation Supabase est `free` : AUCUNE sauvegarde incluse,
           AUCUN PITR. Le dump quotidien de db-backup.yml est la SEULE copie de la base
           qui existe. C'est le seul bloquant reel d'une campagne d'acquisition : amener
           du trafic sur une base sans sauvegarde augmente ce qu'on perd le jour ou on la
           perd. Geste d'Axel (passage au plan Pro).

  Stripe   STRIPE_SECRET_KEY est une cle de TEST. Les deux drapeaux de facturation sont a
           false et alignes (etat voulu, personne ne tombe sur un mur de paiement), mais
           on ne peut pas encaisser. Conditionne par l'immatriculation en micro-entreprise :
           encaisser sans immatriculation est du travail dissimule.
           🔴 Le jour de la bascule : SIX events webhook a souscrire, pas cinq.
           charge.refunded a ete ajoute par la v27 le 2026-09-06, et en souscrire cinq
           laisserait un remboursement verse sans ligne compensatoire au journal
           d'encaissement. La procedure est dans docs/POST-AUDIT-GUIDE.md, corrigee le
           2026-09-14.

  G-2      Les confirmations d'inscription restent DESACTIVEES, par decision d'Axel. Le
           SMTP qui manquait est en service depuis le 2026-08-29 au soir, donc ce n'est
           plus qu'une decision. Mesure du 2026-09-14 : 28 comptes sur 28 portent
           email_confirmed_at, dont 26 A LA SECONDE de leur creation, et 18 comptes sont
           crees par email + mot de passe. Aucune de ces 18 adresses n'a jamais ete
           prouvee. ❌ Ne JAMAIS conclure de email_confirmed_at IS NOT NULL qu'une adresse
           existe tant que G-2 est ouvert.

═══════════════════════════════════════════════════════════════════════════
CRITERE DE FIN GLOBAL
═══════════════════════════════════════════════════════════════════════════
La session est finie quand, pour chaque phase traitee :
  - a-faire-code.md porte l'etat reel de l'item, avec le chiffre mesure et sa date ;
  - l'audit du domaine (docs/*.md) est repercute, et sa note bougee SI et seulement si une
    mesure le justifie ;
  - docs/README.md § tableau de bord est a jour ;
  - le travail est commite ET pousse, et un run CI vert est cite par son numero.

Une phase a moitie faite se DIT a moitie faite. Ce depot a paye trois fois le prix d'un
« corrige » qui decrivait un arbre de travail local.
```

---

## Ce qui a produit ce prompt

Passe d'audit complète des onze domaines notés, plus six documents non notés, menée le 2026-09-14
au soir et achevée le 2026-09-15. Notes : Architecture 84 → **88**, Tests/CI 97 → **94**,
Performance 97 → **95**, UI/UX 87 → **85**, Accessibilité 84 → **82**, Mobile 79 → **76** ;
Sécurité 88, Scalabilité 91, RGPD 87, SEO 80, i18n 90 vérifiées inchangées.

**Dix angles morts**, dont trois dans des documents **sans note** : un audit noté attire
l'attention, un runbook est ce qu'on exécute. Détail et preuves :
[`docs/README.md`](./docs/README.md) § « Mise à jour du 2026-09-14 (soir) ».

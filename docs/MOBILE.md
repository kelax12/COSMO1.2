<!-- note-audit: note=75 -->
<!--
  🔴 C-109 · CE MARQUEUR EST LU PAR `npm run check:docs-scored`.
  Douze documents de fond n'étaient notés par RIEN : ils ne pouvaient ni monter
  ni baisser, donc **rien ne signalait qu'ils avaient vieilli**.
  Chaque document de `docs/` déclare donc soit sa note, soit la note qui le
  couvre, soit qu'il n'est pas noté ET pourquoi.
  ❌ Ne JAMAIS inventer une note sans avoir audité le domaine : `non-note` est
     une réponse honnête, un chiffre faux ne l'est pas.
-->
> **Note d'audit** — Note **75 / 100** au 2026-09-22 (soir), au tableau de bord de [`README.md`](./README.md).

# Mobile-first — patterns et conventions

## Note mobile / DA : 62 → 72 → 74 → 76 → 79 → 76 → 78 → 73 → **75 / 100** (2026-08-24 → 2026-08-25 → 2026-08-27 → 2026-08-29 → 2026-09-14 → 2026-09-14 soir → 2026-09-15 → 2026-09-16 → 2026-09-22 soir)

> ### 🟢 2026-09-22 (soir) · +2 : remesure item par item, contre la CI réelle et la production
>
> **Règle appliquée**, déclarée au [tableau de bord](./README.md) : un angle mort payé le 2026-09-16
> n'est remboursé que si sa garde a rendu **au moins un verdict exploitable en CI** (vert, ou
> rouge sur un vrai défaut). Une garde posée mais jamais jouée, ou cassée, ne rembourse rien.
> Un défaut nommé ce soir coûte selon le barème du 09-16.
>
> | Item | Effet | Mesuré le 2026-09-22 |
> |---|---|---|
> | `C-78` · WebKit en CI | **+1** | le point laissé le 09-15 (« +2 et non +3 ») |
> | AM-2 · aucun Android | **+2** | project `mobile-chrome` (Pixel 7) joué dans le job `e2e` |
> | AM-3 · perf mobile | **+1** | Lighthouse mobile joué (et il mesure mal, ligne suivante) |
> | AM-4 · réseau / CPU bridés | **+1** | CPU ×4 par CDP, joué dans `mobile-android.spec.ts` |
> | AM-5 · paysage et police 200 % | **+1** | joués |
> | 🔴 LCP mobile « mauvais » sur 8 URLs sur 8 | **−2** | 5,6 à 8,3 s ; `/entreprise-presentation/` **8,3 s** |
> | 🔴 Texte à 200 % : trois cas ROUGES, pas des cliquets | **−1** | `/dashboard` déborde de **12 px**, `/settings` de **649 px**, `/tasks` de **1 182 px**. Ce document les disait « cliquets posés au mesuré » : ils **échouent** en CI (WCAG 1.4.4) |
> | 🔴 Parcours rouges sur WebKit | **−1** | **20** échecs `mobile-safari` à `806e7745`, dont créer une tâche, persistance d'une habitude, carte OKR, 3 `reduced-motion-sheets`. Part produit / harnais non triée, d'où −1 et non −2 |
>
> **73 → 75.** Détail, règle et ordre de réparation : [tableau de bord](./README.md).

> ### 🟠 2026-09-16 · -5 : la note comptait ce qui était mesuré, jamais ce qui ne l'était pas
>
> **Ce n'est pas une régression.** Rien n'a cassé depuis la dernière passe. Les angles morts
> listés juste en dessous **existaient tous** pendant que cette note montait : elle était
> surévaluée parce qu'elle ne comptait que ce que les gardes regardent. C'est exactement ce qui
> s'est produit le 2026-09-14, où cinq notes ont baissé sans qu'aucun défaut ne soit récent.
>
> **Barème, déclaré pour être contestable ligne par ligne :**
>
> | Situation | Effet |
> |---|---|
> | angle mort **structurel**, de portée large, qu'aucun outil ne regarde | −2 |
> | angle mort réel mais de portée limitée, ou partiellement couvert | −1 |
> | angle mort **assumé** (arbitrage documenté), ou déjà compté dans une passe antérieure | 0 |
> | angle mort **comblé** le jour même, avec garde **et** témoin | +1 |
>
> **Le calcul pour cette note :**
>
> | Angle mort | Effet | Pourquoi |
> |---|---|---|
> | AM-2 · **un seul téléphone, un seul moteur, aucun Android** | −2 | Chrome Android est le premier navigateur mobile du marché |
> | AM-3 · la performance mobile n'est mesurée par rien | −1 | Lighthouse est en preset `desktop` |
> | AM-4 · aucune mesure sur appareil réel ni réseau bridé | −1 | c'est la classe de défaut de `C-68`, trouvé en bridant à la main |
> | AM-5 · ni paysage, ni grandes polices système | −1 | aucun cas ne change d'orientation |
> | AM-1 · les 105 cas `mobile-safari` hors CI | 0 | déjà payé le 2026-09-14 (−3) |
>
> 🔴 **Une note baisse UNE FOIS, quand l'angle mort est nommé ; elle remonte quand il est
> outillé.** Sans cette règle, nommer un angle mort deviendrait punitif, et la passe du
> 2026-09-16 serait la dernière à en chercher. Un angle mort reconduit sans être comblé ne
> re-coûte rien : il est **déjà payé**.
>
> ⚠️ Un transversal (T-1 à T-10 du [tableau de bord](./README.md)) est compté dans **chaque** audit
> qu'il touche, parce que chaque note prétend quelque chose de différent. Les 36 témoins jamais
> rejoués coûtent donc à la fois aux tests et à la sécurité, et ce n'est pas un double comptage.



### 🕳️ Angles morts · ce que cet audit NE mesure PAS (2026-09-16)

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



> **Pourquoi cette section existe.** Cette note est justifiée par des points **nommés** (« ce qui
> retient à N », suivi d'une liste). Une note construite ainsi ne peut baisser que sur un défaut
> que quelqu'un a d'abord nommé : **un angle mort ne pèse rien tant qu'il reste anonyme**, et ce
> n'est pas un oubli d'auditeur, c'est une propriété de la méthode de notation.
>
> Le prototype du problème est daté : `CLAUDE.md` a pesé 150 ko et ~43 000 tokens sans qu'aucune
> note ne bouge, alors qu'il est cité **13 fois** dans [`ARCHITECTURE.md`](./ARCHITECTURE.md), dont **9**
> dans la seule colonne « Où il est écrit » du tableau des invariants, et **jamais** dans ce
> qui est mesuré. Il était le mètre,
> jamais l'objet.
>
> Ces lignes entrent donc **dans ce qui est mesuré**. La prochaine passe les traite comme les
> invariants ci-dessus : chacune est soit comblée, soit reconduite avec sa date.

| # | Angle mort · **énoncé du 2026-09-16, non réécrit** | Vérifié le 2026-09-16 | 🔎 État au 2026-09-21 |
|---|---|---|---|
| AM-1 | ✅ **COMBLÉ le 2026-09-16, vérifié le 2026-09-20.** Était : « les 105 cas `mobile-safari` ne tournent dans aucun workflow » (item `C-78`), le seul project qui mesure WebKit, donc iOS | 🔴 **Cet énoncé était périmé le jour où il a été écrit.** `git show HEAD:.github/workflows/ci.yml` lance `--project=chromium --project=supabase-stub --project=mobile-safari`, et `e2e/_warmup-mobile.spec.ts` est suivi par git : entré avec `af0190bd`, **le 2026-09-16**. ⚠️ Un moteur mobile joué en CI n'est ni un appareil réel, ni Android, ni un réseau bridé : cf. AM-2 et AM-4, ouverts | ✅ **FERMÉ le 2026-09-16** · `C-78`, `af0190bd`. ⚠️ L'énoncé « écrit, non commité » était périmé **le jour même de sa publication** |
| AM-2 | **Un seul modèle de téléphone, un seul moteur.** Tout est mesuré sur iPhone 12 / WebKit. **Aucun Android réel**, alors que Chrome Android est le premier navigateur mobile du marché | `playwright.config.ts` : un seul device mobile | ✅ **OUTILLÉ le 2026-09-20** · project `mobile-chrome` (Pixel 7) + `e2e/mobile-android.spec.ts` (`C-97`) — 🔴 ne prouve PAS : un appareil **émulé** sur un runner : ni thermique, ni GPU mobile |
| AM-3 | **La performance mobile n'est mesurée par rien en continu.** Lighthouse tourne en preset **desktop** (cf. [`PERFORMANCE.md`](./PERFORMANCE.md) AM-1) | `lighthouserc.json` : `"preset": "desktop"` | ✅ **OUTILLÉ le 2026-09-20** · `lighthouserc.mobile.json` (`C-84`) — 🔴 ne prouve PAS : que les seuils soient justes : première pose, à rabaisser au mesuré · 🔎 🔴 **2026-09-22 : il mesure, et c'est mauvais** : LCP 5,6 à 8,3 s sur les 8 URLs (cf. `PERFORMANCE.md`) · 🔎 **2026-09-24 : cause trouvée** (le HTML prérendu n'est jamais peint, le premier rendu attend React), cf. [`PERFORMANCE.md`](./PERFORMANCE.md) § « C-116 » |
| AM-4 | **Aucune mesure sur appareil réel ni sur réseau bridé.** Un émulateur de bureau ne reproduit ni le GPU d'un téléphone d'entrée de gamme, ni la 4G. C'est précisément la classe de défaut de `C-68` (le shader qui saturait le tampon GPU) | `C-68` n'a été trouvé qu'en bridant le CPU à la main | ✅ **OUTILLÉ le 2026-09-20** · CPU bridé **×4 par CDP**, avec son témoin qui vérifie que le bridage s'applique (`C-97`) — 🔴 ne prouve PAS : l'appareil réel, qui reste **`M-25`** — un bridage n'est pas un téléphone |
| AM-5 | **Le mode paysage et les grandes tailles de police système ne sont testés nulle part** | aucun cas ne change d'orientation ni de `font-size` racine | ✅ **OUTILLÉ le 2026-09-20** · paysage et police à **200 %** mesurés dans `e2e/mobile-android.spec.ts` (`C-97`) — 🔴 ne prouve PAS : rien de plus que ce qu'il mesure : 2 routes débordent en paysage et 3 à 200 %, cliquets posés **au mesuré**, ils ne peuvent que descendre · 🔎 🔴 **2026-09-22 : les trois cas « 200 % » sont ROUGES en CI**, pas des cliquets verts : débordement de 12 px (`/dashboard`), 649 px (`/settings`), 1 182 px (`/tasks`) |


> ### 🟢 2026-09-15 · +2 sur les 3 retirés : le périmètre est élargi, le moteur mobile ne l'est pas encore
>
> **Deux des trois points reviennent, pas les trois**, et la différence se lit dans l'entrée
> d'hier : elle retirait 3 points pour DEUX défauts distincts, le périmètre de la garde et le fait
> qu'aucune suite mobile ne tourne sur un moteur mobile. Le premier est refermé (C-80), le second
> ne l'est pas a cette date (C-78, en cours).
>
> `e2e/touch-targets.spec.ts` couvre désormais **8 pages publiques** en plus de ses 8 routes
> protégées : `/`, `/entreprise-presentation`, `/guide`, `/blog` et les quatre pages cas d'usage.
> **18 cas sur 18 verts** sur Chromium, contre 15 verts / 3 rouges au premier passage de la boucle
> élargie.
>
> 🔴 **Le curseur de forfait est le correctif qui comptait, et il est MESURÉ dans WebKit / iPhone
> 12, pas dans un Chrome rétréci** : `{"w":308,"h":6}` avant, `{"w":308,"h":44,"appearance":"none"}`
> après. C'est l'outil avec lequel un prospect choisit son palier, sur la page qui vend l'offre.
>
> ✅ **La réserve d'hier est levée dans le sens qu'elle redoutait** : « la zone tactile réelle du
> curseur peut excéder la piste selon le moteur, à vérifier avant de conclure ». Vérifié : elle ne
> l'excédait pas.
>
> ❌ **La piste visuelle n'a PAS grossi**, et ne doit jamais grossir : c'est la hauteur de
> l'ÉLÉMENT qui monte à 44 px, fond transparent, la piste descendant dans
> `::-webkit-slider-runnable-track` / `::-moz-range-track` où elle garde ses 6 px. Capture WebKit à
> l'appui.
>
> ⚠️ **Trois des huit défauts n'étaient pas des cibles trop petites, c'étaient de FAUSSES
> COMMANDES** : un `button` de maquette à `tabIndex={-1}` sans `onClick`, et deux flèches « Semaine
> (démo) » du `/guide`, dans des dessins de téléphone dont tous les autres éléments sont des `div`.
> ❌ Ne jamais « corriger » ce cas-la en agrandissant a 44 px : ce serait poser une cible tactile
> sur une image, donc promettre un appui qui ne fait rien. Un élément non interactif se retire de
> l'arbre d'accessibilité, il ne se met pas aux normes.
>
> 🔴 **Ce qui NE bouge pas** : aucune de ces mesures n'est rejouée par la CI sur WebKit. Le project
> `mobile-safari` reste hors CI à cette date. Le troisieme point ne reviendra qu'avec C-78.


> ### 🔴 2026-09-14 (soir) · −3 : « 0 cible tactile trop petite » ne vaut que des 8 routes protégées, et les pages publiques en portent 24
>
> L'entrée de ce matin inscrit « **Cibles tactiles < 44×44 px : 0**, 10/10 cas E2E verts ». La
> mesure est juste. **Ce qu'elle couvre ne l'est pas.** `e2e/touch-targets.spec.ts` boucle sur une
> liste écrite en clair : `/dashboard`, `/entreprise`, `/okr`, `/tasks`, `/habits`, `/settings`,
> `/agenda`, `/statistics`, soit **huit routes protégées, et aucune page publique**.
>
> **Mesuré ce soir contre la PRODUCTION**, WebKit / iPhone 12, bandeau cookies refusé, après
> stabilisation :
>
> | Page publique | Cibles sous 44 × 44 px |
> |---|---|
> | `/` (landing, parcours perso) | **24** |
> | `/entreprise-presentation` | **23** |
> | `/blog` | 2 |
>
> ⚠️ **Toutes ne se valent pas, et il faut les trier au lieu d'agiter le total** :
>
> - **Les liens de pied de page** (~20 px de haut : « Guide d'utilisation », « Pour les
>   freelances », « FAQ », …) représentent la majorité du compte. Ils échouent au critère AAA
>   (2.5.5, 44 px) mais relèvent d'un usage courant et passent le critère AA (2.5.8, 24 px) sur leur
>   largeur. C'est une dette de confort, pas un blocage.
> - 🔴 **Le bouton « Commencer » du header fait 115 × 36 px**, et « Cosmo » 116 × 36. Ce sont les
>   deux commandes les plus en vue de la page la plus visitée du produit, et elles sont **8 px sous
>   le plancher** que le reste de l'application respecte partout.
> - 🔴 **Le curseur « Nombre de membres de votre organisation » de `/entreprise-presentation` fait
>   308 × 6 px** : `input[type=range]`, `appearance: none`, `height: 6px` en CSS calculé. Il est
>   **stylé par l'auteur**, donc l'exemption « contrôle du navigateur » de WCAG 2.5.8 ne le couvre
>   pas. ⚠️ Non mesuré : la zone tactile réelle du curseur peut excéder la piste selon le moteur.
>   **À vérifier avant de conclure**, mais une piste de 6 px sur l'outil qui sert à choisir un
>   forfait est au minimum un défaut d'ergonomie tactile.
> - `16 × 24 px` pour un bouton « Plus d'options (démonstration) » : sous 24 px en largeur, donc
>   sous le critère **AA**.
>
> 🔴 **Ce qui coûte les 3 points, ce n'est pas le nombre, c'est le périmètre.** La garde a été
> élargie de six à huit routes le 2026-09-04, et son propre commentaire dit alors : « en couvrir six
> et parler des routes protégées, c'est le même écart de langage que les énoncés que cette passe a
> trouvés faux ». Le raisonnement a été appliqué **à l'intérieur** du périmètre et jamais **au
> périmètre lui-même** : le tableau de bord lit « cibles tactiles : 0 » comme une propriété du
> produit, alors que c'est une propriété de huit routes derrière authentification. Les pages non
> couvertes sont exactement celles qui reçoivent le trafic d'acquisition.
>
> ### Et les cas mobiles, joués sur le moteur mobile, échouent à moitié
>
> Les trois specs les plus mobiles du dépôt rejouées sur le project `mobile-safari` (iPhone 12,
> WebKit), dev-server chaud, 2 workers : **9 passés, 9 échoués, 11,4 min.**
>
> | Spec | Cas |
> |---|---|
> | `touch-targets.spec.ts` | 3 échecs (`/dashboard`, `/entreprise`, `/habits`) |
> | `reduced-motion-sheets.spec.ts` | 4 échecs, dont le **TÉMOIN** de la suite |
> | `demo-touch-gestures.spec.ts` | 2 échecs (swipe sur une TaskCard, bottom-sheet « Plus ») |
>
> ⚠️ **Ce ne sont pas des défauts produit démontrés, et il serait malhonnête de les présenter
> ainsi.** Sept des neuf sont des attentes de fixture qui expirent : le CTA « Essayer la démo
> gratuite » de la landing n'est pas visible dans les 30 s contre un serveur Vite de développement
> sur WebKit. **Vérifié en contre-épreuve** : la même page, même moteur, même appareil émulé, mais
> chargée depuis la **production**, rend ce CTA **visible, 358 × 56 px, en moins de 6 s**, et son
> événement `load` tombe à **2 159 ms** avec zéro requête en vol.
>
> **Le fait établi est donc celui-ci, et il suffit** : ces cas ne sont joués par personne (cf.
> [`TESTING.md`](./TESTING.md), les 96 cas hors CI), et dans leur état actuel ils ne peuvent pas
> l'être sans travail. Une suite mobile qu'on ne peut pas lancer ne protège rien.
>
> ✅ **Ce qui reste vrai et vérifié ce soir** : `KNOWN_SUB_11PX = 69` et `ARBITRARY_BUDGET = 192`
> sont bien les valeurs en vigueur dans `src/design-system.guard.test.ts`, et la suite unitaire
> complète (2 586 cas) est verte, cliquets compris.

> ### 🟢 2026-09-14 (matin) · +3, sur des métriques REJOUÉES, pas des affirmations
>
> Trois choses mesurées ce jour, sur le code réel, aucune sur un appareil (la limite « aucun
> appareil réel accessible » reste entière, cf. A-4 / M-25) :
>
> | Métrique | 08-27 (dernière mesure) | **09-14** |
> |---|---|---|
> | Libellés sous le plancher de 11 px | 75 | **69** |
> | Stock de tailles arbitraires | 196 | **192** |
> | Cibles tactiles < 44×44 px (8 routes protégées + modale d'équipe) | — | **0**, 10/10 cas E2E verts |
> | Consommateurs réels de `MobileHeader` (imports, pas mentions) | « 8 » (non recompté depuis) | **7**, recompté par import statement |
>
> Les deux premières viennent de **C-75** (fermé le 2026-09-14 au matin, avant cette passe) :
> `src/design-system.guard.test.ts` porte désormais ces plafonds en dur (`KNOWN_SUB_11PX = 69`,
> `ARBITRARY_BUDGET = 192`) et refuse toute remontée. Ce document ne les avait jamais absorbés —
> sa dernière table de métriques s'arrêtait au 08-27. Les deux dernières sont une remesure propre
> à cette passe : `e2e/touch-targets.spec.ts` rejoué en entier (10 cas, dont le témoin), et le
> compte de `MobileHeader` refait par `import { MobileHeader } from` plutôt que par mention.
>
> ⚠️ **Le 7 n'est pas une régression du 8** : c'est un recomptage plus strict (imports réels, pas
> `grep` sur le nom), et personne n'avait revérifié depuis le 2026-08-25. Sept pages : Dashboard,
> Habitudes, OKR, Entreprise, Réglages, Statistiques, Tâches (via `TasksHeader`).
>
> 🔴 **Ce qui N'ENTRE PAS dans ce +3, et pourquoi** : un fichier non commité d'une autre session
> (`OverdueQuickActions.tsx`) retire le report rapide « Aujourd'hui » du menu de retard, en
> tension directe avec la conclusion de C-72 (« le produit est juste »). Tant qu'il n'est pas
> commité, il n'existe pas pour ce document — ni en positif, ni en négatif. Décision suivie :
> `a-faire-manuel.md` **M-44**.
>
> **Ce qui reste hors de portée d'ici, inchangé depuis le 08-27** : aucun appareil réel n'a été
> ouvert. L'adhérence à l'échelle typographique (dernière mesure : 13 %, le 08-25) n'a pas été
> recomptée — le script qui la produit n'a pas tourné aujourd'hui, faute de temps, pas faute
> d'outil.

> ### 2026-09-03 · note inchangée, et rien de mobile n'a été mesuré
>
> Les 71 commits des 08-30 au 09-03 touchent le socle, la CI, la sécurité et la landing desktop.
> Trois choses seulement concernent cette note, et aucune ne rapporte de point :
>
> - **Les deux `input[type=date]` natifs qui restent sont ASSUMÉS**, et ce sont des champs mobiles :
>   ceux d'`EventModalForm` (desktop en `md:hidden`, plus l'overlay mobile). Le calendrier COSMO a
>   remplacé le picker natif sur les six surfaces où il était visible, mais **pas** sur téléphone :
>   la roue système vaut mieux que n'importe quel calendrier maison. C'est un arbitrage écrit, pas
>   un oubli, cf. [`UI-PATTERNS.md`](./UI-PATTERNS.md) ;
> - `FirstRunSetup` est monté dans `Layout`, donc il s'affiche aussi sur mobile. **Son rendu
>   téléphone n'a pas été vérifié écran par écran** ;
> - l'entrée du hero de la landing est passée en CSS. Le gain mesuré (deux secondes d'écran blanc à
>   4× de bridage CPU) profite d'abord aux appareils lents, donc aux mobiles, mais il a été mesuré
>   **au bureau, avec un bridage simulé**, jamais sur un vrai téléphone.
>
> ⚠️ **Ni l'adhérence à l'échelle typographique fermée, ni les libellés sous le plancher de 11 px,
> ni les cibles tactiles n'ont été recomptés** depuis le 2026-08-27. Les lignes correspondantes du
> tableau ci-dessous portent donc toujours leur date d'origine.

> ### 2026-08-29 · +2, sept onglets qui tenaient dans 335 px visibles
>
> Mesuré à 375 px : le rail de l'espace entreprise fait **832 px pour 335 visibles**, soit quatre
> destinations sur sept hors champ, dans un conteneur `hide-scrollbar`, donc sans barre de
> défilement ni le moindre indice qu'il y a autre chose.
>
> Le défaut qui comptait n'était pas le confort : ouvrir un lien profond `?tab=members` laissait
> l'onglet **actif** hors de l'écran. L'utilisateur voyait le contenu de Membres avec « Aperçu »
> comme seul onglet visible, sans pouvoir dire où il se trouvait.
>
> `OrgTabsBar` ramène l'onglet actif dans le champ et pose des dégradés de continuation. Deux
> mesures ont été nécessaires pour le faire tenir : la `ResizeObserver` observe le conteneur **et**
> le rail, parce que la boîte du conteneur ne bouge pas quand son contenu s'élargit (l'arrivée
> d'une pastille de compteur décalait l'onglet actif de 27 px hors champ, ce qui se lisait comme
> de la flakiness) ; et le premier positionnement est **instantané**, parce qu'un
> `behavior: smooth` est annulable et s'arrête en chemin.
>
> Vérifié dans le navigateur et par deux tests Playwright, **avec témoin** : les deux échouent
> contre l'ancienne barre.
>
> ⚠️ **Remplacé le 2026-09-23** : `OrgTabsBar` n'existe plus. Sur mobile, la section courante est
> un bouton (`OrgSectionSwitcher`) qui ouvre une feuille en grille ; le défaut ci-dessus disparaît
> par construction, puisque le libellé du bouton EST la section active. Sur desktop, la navigation
> vit à droite (`OrgSideNav`). Détail : `src/modules/organizations/CLAUDE.md` § Navigation.

| Ce qui compose la note | 08-24 | 08-25 | **08-27** |
|---|---|---|---|
| Feuilles cassées sous `prefers-reduced-motion` | 0 (corrigées le 24) | **0** | **0**, et pour la première fois **mesuré** sur 3 feuilles (cf. §1bis) |
| Consommateurs de `MobileHeader` | 2 sur 7 pages | **8** | 8, non remesuré |
| Pages avec un titre mobile hors échelle | 6 | **0** | 0 |
| Poignées de glissement qui ne font rien | 3 | **0** · retirées | 0 |
| Adhérence à l'échelle typographique fermée | 169 / 1 656 = **10 %** | 243 / 1 927 = **13 %** | **non remesurée** · le stock de tailles arbitraires passe de 202 à **196** |
| Libellés sous le plancher de 11 px | · | 79 | **75** |
| Niveau de navigation de l'espace entreprise | 3ᵉ (Plus → feuille → Entreprise) | 3ᵉ | ✅ **1ᵉʳ** · onglet de la barre du bas |
| Primitives à 0 consommateur | `MobileScreen`, `ListRow` | **inchangé** | ✅ **0** · supprimées le 2026-09-05 (C-10) |

### 2026-08-27 · +2, un point de navigation et une rétractation

> **Note inchangée à 74 après la rétractation du soir** (§1bis). Le +2 était porté par B2 et F3,
> deux points de navigation mesurés ; la « rechute » annoncée le matin n'a jamais existé. Une
> feuille qu'on croyait cassée puis qui ne l'est pas ne rend aucun point : elle en avait été
> retirée zéro, la ligne du tableau valant déjà 0.

**B2 · « Entreprise » entre dans la barre d'onglets, et REMPLACE « Habitudes ».** L'espace
collaboratif était au **troisième** niveau de navigation sur mobile (Plus → feuille →
Entreprise), alors que c'est la seule zone multi-utilisateurs du produit.

Le remplacement plutôt que l'ajout est **mesuré, pas supposé** : à 375 px la barre porte 5
éléments de **75 × 64 px**. Un sixième les ramène à ~62 px et tronque les libellés. « Habitudes »
est un module **optionnel** (`RequireModule`), donc déjà absent pour une partie des comptes, et il
reste listé dans « Plus » ; l'onglet n'apparaît que pour un membre d'une organisation.
Vérifié dans le navigateur sur le build de production, démo neuve : 5 éléments de 75 × 64.

**F3 · l'onglet ne change plus d'identité pendant le chargement** (commit `f32d080`). L'entrée
entreprise était montée sur `{myOrg && …}` : la barre du bas affichait « Habitudes » le temps de
la requête d'organisations, puis la remplaçait par « Entreprise ». *Un onglet qui change
d'identité pendant qu'on le vise est pire qu'un onglet qui manque*, et sur mobile la cible est
tactile, donc le doigt est déjà parti. Correctif : `ActiveOrgContext` expose `wasOrgMember`, lu
une fois au montage depuis la préférence d'organisation déjà persistée, et les deux barres
réservent la place tant que la requête vole.

> ⚠️ **Honnêteté sur la mesure de F3** : le décalage **n'est pas reproductible en mode démo**, le
> repository local lisant `localStorage` de façon synchrone. CLS mesuré à **0 avant comme après**,
> indice posé comme effacé : cela prouve l'absence de régression, **pas** la présence d'un gain.
> La preuve du correctif est dans les tests, qui exercent l'état transitoire directement
> (`ActiveOrgContext.test.tsx`, 5 cas, + 3 sur `MobileTabBar`), eux-mêmes vérifiés en neutralisant
> tour à tour la lecture puis l'écriture de l'indice. Aucun point n'est attribué pour un gain non
> mesuré.

### 1bis. La feuille « cassée » ne l'était pas · rétractation mesurée (2026-08-27, soir)

`LoginModal` écrivait son mouvement de feuille à la main (`initial={{ y: '100%', opacity: 0 }}`)
et est passé par `useSheetMotion()` (commit `a1debe3`). **La migration reste juste** : c'est la
convention du dossier, et un chemin par défaut vaut mieux que dix-sept variantes.

🔴 **En revanche la justification était fausse, et elle est rétractée ici.** Le commit affirmait
que « sous `prefers-reduced-motion` la valeur initiale reste appliquée et le modal s'ouvrait
entièrement hors écran ». Ce n'était pas une mesure, c'était une déduction depuis la règle.
L'expérience a été faite le soir même : `LoginModal` **remis dans sa forme exacte d'avant le
correctif**, puis ouvert sous `reducedMotion: 'reduce'` réellement émulé, dans un navigateur qui
composite. Résultat : **il s'ouvre normalement**, opacité 1, entièrement à l'écran.

La raison tient à la forme de l'`initial`, et c'est ce que le cliquet de
`src/design-system.guard.test.ts` disait déjà : un `initial` **mixte**, qui contient une clé
non-transform (`opacity`) à côté du `y`, se résout ; c'est l'`initial` **transform seul** de
`MobileMoreSheet` qui restait coincé le 2026-08-24. Les dix-sept feuilles écrites à la main sont
toutes mixtes.

> ⚠️ **Et une mesure de la même journée avait été fausse aussi, dans l'autre sens.** Une première
> tentative, faite dans un panneau navigateur **non affiché**, avait conclu que `HabitModal`
> s'ouvrait à `opacity: 0` et 379 px trop bas. C'était un artefact : dans un onglet
> `document.visibilityState === 'hidden'`, `requestAnimationFrame` ne tourne pas et **tout** reste
> sur `initial`, y compris le voile d'une feuille saine. Le harnais gelait la page et rendait un
> rapport parfaitement convaincant.
>
> Les deux erreurs de la journée, celle du commit et celle-ci, sont la même : **conclure sans
> témoin**. D'où la forme du test qui referme le sujet.

Au passage, la popup d'inscription **tient sans scroll** : largeur desktop 28rem → 33,6rem et
formulaire resserré. Mesuré dans le navigateur, viewport 1000 × 760, inscription, mot de passe
saisi : `scrollHeight` **699 → 675 = clientHeight**, le bouton « Se connecter » finit à 691 px
pour 760 px de hauteur. Mobile 375 × 812 : **694 = clientHeight**.

> ✅ **La ligne « 0 feuille cassée » cesse d'être une présomption** (2026-08-27, soir).
> `e2e/reduced-motion-sheets.spec.ts` ouvre des feuilles sous `reducedMotion: 'reduce'` réellement
> émulé et **mesure** l'état peint : opacité calculée, et hauteur effectivement dans le viewport.
> Ni `toBeVisible()` ni une garde statique ne voient ces deux défauts, l'un considérant visible un
> élément à `opacity: 0`, l'autre ne comptant que des chaînes dans des fichiers.
>
> Le fichier porte **deux protections contre lui-même**, parce que les deux erreurs de la journée
> venaient du harnais et pas du produit :
> 1. il refuse de tourner si la page se déclare `hidden` (l'artefact de l'onglet non composité) ;
> 2. il embarque un **témoin positif** ; si la feuille de contrôle ne s'ouvre pas non plus, le
>    verdict n'est pas « le produit est cassé » mais « le harnais ment », et le message le dit.
>
> ⚠️ **Périmètre honnête : 2 feuilles écrites à la main sur 16**, plus le témoin. `HabitModal` et
> `CompletedOKRsModal` s'ouvrent, mesurées. Les 14 autres partagent le même `initial` mixte au
> caractère près, ce qui rend leur bon fonctionnement très probable, **mais probable n'est pas
> mesuré** : les ajouter au fichier est la dette ouverte de ce point.

### 🔴 2026-09-22 · C-07 était clos à moitié, et l'autre moitié n'avait AUCUNE garde

`C-07` annonçait « 17 feuilles n'utilisent toujours pas `useSheetMotion()` / `useSheetDrag()` ».
**Remesuré avant d'écrire une ligne** : le volet `useSheetMotion` était fermé depuis le
**2026-09-04** — cliquet à zéro, 23 fichiers consommateurs, la garde jouée et verte. L'énoncé
était donc faux de moitié, et le rester lui donnait une taille qu'il n'avait pas.

**Le défaut réel était l'autre helper.** `useSheetDrag` n'était mesuré nulle part, et l'audit
mobile du 2026-08-14 avait pourtant compté **cinq feuilles affichant une poignée qui ne faisait
rien**. Balayage du 2026-09-22 : **trois** l'avaient reconstitué.

| Surface | Traitement |
|---|---|
| `task-modal/MobileActionSheet` | ✅ câblée sur `useSheetDrag(onClose)` |
| `OKRDeadlineReviewModal` | ✅ câblée, **en phase `edit` seulement** : pendant l'animation de validation la carte porte un `animate`, et deux sources pour un même transform laisseraient interrompre une validation décidée |
| `RemoveFriendConfirm` | 🗑️ poignée **RETIRÉE** : c'est un `alertdialog` de suppression, une poignée y présente une décision comme une feuille qu'on chasse au pouce |

⚠️ **Deux faux positifs écartés à la mesure** : les « poignées » de `PyramidNodeCard` et
`TeamProjectCard` sont des **barres de progression**, même forme, `overflow-hidden` en plus. La
première écriture de la garde les accusait — une garde qui accuse deux fichiers justes est une
garde qu'on finit par ignorer. Le détecteur raisonne désormais **par élément**, jamais par fichier.

**Cliquet** : `src/design-system.guard.test.ts`, 4 témoins, **vu rouge sur les trois sabotages**.

### 🔴 2026-09-22 · `/habits` ne peut PAS atteindre 44 px de large, et c'est de l'arithmétique

Mesuré **dans le navigateur** (viewport 375 × 812, mode démo, dix cartes) : la grille des 7 jours
de `HabitCard` fait **301,6 px**, gap de 6 px, donc des cellules de **37,94 × 37,94**.

Sept cellules de 44 px en exigeraient **7 × 44 + 6 × 6 = 344 px**. Même avec un gap NUL, il en
faudrait **308**. La largeur ne peut donc pas atteindre la cible sans refaire la carte.

✅ Ce qui était récupérable l'est : `min-h-11` porte la **hauteur** à 44, la cible passe de 1 444
à 1 672 px². L'écart restant est sur la seule largeur, **déclaré et daté** dans
`e2e/touch-targets.spec.ts` avec son critère : échoue **2.5.5 (AAA)**, tient **2.5.8 (AA, 24 px)**.

⚠️ **Ce n'est pas une allowlist** : la dispense porte sur la largeur SEULE, un témoin vérifie
qu'une cellule perdant sa hauteur redevient un échec, et elle **doit tomber** si la carte gagne
45 px de large.
❌ **Ne pas « corriger » par un débord de `tap-area`** : sept cellules voisines agrandies chacune
se chevaucheraient, et le dernier dans l'ordre du DOM volerait l'appui de son voisin. Une grille
se corrige par sa taille, jamais par du débord.

### « 0 feuille cassée » : ce que dit la MESURE, et à quelle date (C-07, 2026-09-06)

🔴 **La phrase ne s'appuie plus sur le cliquet statique, et il faut dire pourquoi.** Depuis C-07,
`KNOWN_HANDROLLED_SHEETS` est **vide** dans `src/design-system.guard.test.ts` : les 16 feuilles
écrites à la main passent par `useSheetMotion()`. C'est un bon résultat, mais **ce n'est pas une
preuve qu'une feuille s'ouvre** : cette garde compte des chaînes de caractères dans des fichiers.
Un cliquet à zéro et une feuille hors écran sont parfaitement compatibles.

**L'énoncé vérifiable est donc celui-ci, et rien de plus large :**

> Le 2026-09-06, sur `chromium`, framer-motion 12.43.0, `reducedMotion: 'reduce'` réellement
> émulé, **cinq surfaces ont été ouvertes et mesurées peintes** par
> `e2e/reduced-motion-sheets.spec.ts` : le témoin `LoginModal`, `HabitModal`,
> `CompletedOKRsModal`, `DeleteObjectiveConfirm` et `MobileMoreSheet`. Cinq tests verts.

Ce qui a changé ce jour-là, au-delà du chiffre :

- ✅ **`MobileMoreSheet` est mesurée pour la première fois.** C'est la feuille du 2026-08-24, celle
  dont on sait qu'elle a vraiment été cassée, et **elle n'était mesurée nulle part** : le test se
  `skip`ait sur le project `chromium` (viewport 1280 px, or la feuille n'est montée que sous
  768 px) et n'atteignait jamais son corps sur `mobile-safari`. Un `skip` d'un côté, un échec de
  fixture de l'autre, et le rapport se lit comme « rien à signaler ». Le test porte désormais son
  propre viewport (390 × 844), donc la mesure ne dépend plus du project qui la lance.
- 🔴 **La fixture E2E supposait le desktop, ce qui rendait TOUT viewport mobile rouge.**
  `e2e/fixtures.ts` attendait un `h1` contenant « Bonjour », or ce titre est écrit
  `hidden md:block` dans `DashboardPage.tsx` : sous 768 px le `h1` est la date (mesuré :
  « dimanche 6 sept. »). L'attente était donc structurellement intenable, et une spec ancienne et
  sans rapport (`demo-toggle-habit`) échouait au même endroit. La fixture attend maintenant le
  titre que la taille courante rend réellement.
- ✅ **Le témoin négatif a été rejoué, pas recopié.** `MobileMoreSheet` a été cassée pour de vrai,
  deux fois, puis restaurée (empreinte md5 revérifiée identique) :
  - `initial={{ y: '100%' }}` **avec** `animate={{ y: 0 }}`, écrit à la main sans le helper : le
    test **passe**. Sur framer-motion 12.43.0, une clé de transform reçoit `{ type: false }` en
    mouvement réduit, c'est-à-dire une transition instantanée vers la cible ; la forme exacte du
    2026-08-24 ne se reproduit donc plus.
  - le même `initial` **privé de son `animate`** : le test **échoue**, sur « 0 px visibles sur
    582 px de hauteur, transform `matrix(1, 0, 0, 1, 0, 582)` », la signature exacte du défaut
    d'origine.
- ⚠️ **Le second contrôle est ce qui valide le premier.** Un « ça passe » obtenu sur une mutation
  que Vite n'aurait pas servie ne vaudrait rien. Les deux contrôles portent sur le même fichier :
  le second vire au rouge, donc le serveur servait bien les mutations, donc le vert du premier
  parle du produit et pas du harnais.

⚠️ **Conséquence à écrire noir sur blanc : ce fichier ne peut pas échouer sur le défaut de
2026-08-24 tant que cette version de framer-motion est installée.** L'appeler « non-régression »
sans cette phrase serait exactement la faute cataloguée le 2026-09-03, une garde qui répond sans
mesurer. Ce qu'il prouve, c'est qu'il **sait dire non** à une feuille hors écran, et que cinq
surfaces nommées s'ouvrent réellement.

⚠️ **Et la migration reste juste indépendamment de ce résultat** : une seule écriture au lieu de
seize, et une app qui ne dépend plus du détail d'implémentation d'une dépendance. Ce qui a changé
une fois entre deux versions peut rechanger ; `useSheetMotion` n'émet aucune clé de transform en
mouvement réduit, donc la question ne se pose plus.

🔴 **Dette ouverte, et elle n'a pas disparu avec C-07** : 5 surfaces mesurées, pas 16. Les onze
autres partagent maintenant **un seul chemin de code**, ce qui porte plus loin que seize littéraux
identiques, mais partager un chemin de code n'est pas la même chose qu'avoir été ouvert.

🔴 **Le project `mobile-safari` n'a PAS été remis au vert par cette passe.** Le correctif de
fixture lève la cause qui touchait tous les viewports mobiles, mais un second mode d'échec propre à
WebKit subsiste : `page.goto('/')` n'atteint pas `load`. Non traité ici, hors du périmètre de
C-07, et à ne pas confondre avec « mobile-safari est vert ».

**+10, le deuxième plus gros mouvement.** Le finding structurel de cet audit, « le design system
mobile n'a jamais été adopté », a reculé pour la première fois depuis sa création en juillet :
six pages migrées, et surtout **le composant qui portait la migration s'est révélé cassé depuis le
début** (§2). Un mois de « il suffit de finir la migration » reposait sur une brique qui ne
fonctionnait pas.

**Ce qui plafonne la note :** l'adhérence typographique est passée de 10 % à 13 %, ce qui veut
dire que **1 684 usages de Tailwind brut subsistent**, le chiffre absolu a même augmenté. Migrer
les titres de page était le geste le plus visible, pas le plus large. Et il y a toujours deux
langages visuels mobiles, pas un.

---

## Audit mobile / direction artistique — 2026-08-14

**Méthode** : mesures DOM/CSS sur l'app en mode démo (viewport 375×812) + comptage statique de
l'adhérence au design system. Remplace les trois audits du 2026-07-25 archivés
([impeccable](./archive/AUDIT-IMPECCABLE-MOBILE-2026-07-25.md),
[design-skill](./archive/AUDIT-DESIGN-SKILL-MOBILE-2026-07-25.md),
[DA brief](./archive/MOBILE-DA-BRIEF.md)), 161 commits plus tôt.

### ✅ 1. Sous `prefers-reduced-motion` — bien pire que deux bannières (corrigé le 2026-08-24)

> **Ce finding était sous-évalué, et la liste « plus de 20 fichiers à risque, tous ne sont pas
> cassés » n'avait jamais été vérifiée. Elle l'a été le 2026-08-24, dans le navigateur, avec
> `prefers-reduced-motion: reduce` RÉELLEMENT actif** (le réglage est activé sur la machine
> d'Axel — cf. mémoire projet), viewport 375×812, mode démo.
>
> **Ce qui était réellement cassé :**
>
> | Élément | Mesure | Conséquence |
> |---|---|---|
> | `MobileMoreSheet` (« Plus d'options ») | `matrix(1, 0, 0, 1, 0, 510)`, `top: 812` pour `vh: 812` | **0 px visible.** Le voile s'affiche, la feuille non |
> | 10 blocs de `/dashboard` (cascade `staggerChildren`) | `matrix(1, 0, 0, 1, 0, 20)` | 20 px trop bas, définitivement |
> | `ListActionsSheet`, 3 feuilles de `TaskModalMobileBody` | même motif (`initial` avec un `y` SEUL) | feuille hors écran |
> | `CookieBanner`, `DemoBridgePrompt` | `transform: none` | ✅ le correctif du 14/08 tient |
> | `WeeklyCheckinModal` (`y: '100%'` **+ `opacity`**) | `transform: none`, 812 px visibles | ✅ se résout correctement |
>
> `MobileMoreSheet` est le **seul** accès mobile à OKR, Statistiques, Paramètres et à la
> déconnexion : la navigation mobile était **sans issue** pour ces utilisateurs. Invisible pour
> tous les autres — d'où la survie du bug.
>
> **Correctif** : `useSheetMotion()` et `useRevealVariants()` dans
> `src/components/mobile/mobile-motion.ts`. Sous mouvement réduit, ils n'émettent **aucune clé de
> transform** : rien ne peut rester coincé sur `initial`. Vérifié après correctif, même
> environnement : `MobileMoreSheet` → `transform: none`, **510 px visibles** ; `/dashboard` →
> **0 transform figé** (contre 10 avant).
>
> **Garde** : `src/design-system.guard.test.ts` refuse toute NOUVELLE feuille écrite à la main
> (cliquet sur les 17 fichiers restants, qui ne peut que rétrécir).

### Le diagnostic d'origine (2026-08-14)

**Mesuré** : avec `prefers-reduced-motion: reduce` actif, deux `<aside>` en `position: fixed`
conservent `transform: matrix(1, 0, 0, 1, 0, 120)` — un décalage de **120 px vers le bas qui ne
disparaît jamais**, même 2,5 s après le chargement. Conséquence sur `/entreprise` en 375×812 : le
bouton **« Créer mon compte »** de la bannière démo est à `bottom: 835` pour un viewport de 812.
Il est **hors écran et inatteignable** — l'élément étant `fixed`, aucun scroll ne le ramène.

Composants touchés : `CookieBanner.tsx`, `DemoBridgePrompt.tsx`.

**Mécanisme** : `App.tsx` monte `<MotionConfig reducedMotion="user">`, ce qui neutralise les
animations de **transform**. Un composant écrit `initial={{ y: 120 }} animate={{ y: 0 }}` compte
sur l'animation pour atteindre sa position finale ; l'animation ne jouant pas, la valeur `initial`
**reste appliquée**. Le réglage censé aider les utilisateurs sensibles au mouvement casse donc la
mise en page pour eux — et pour eux seuls, ce qui explique que le bug ait survécu : il est
invisible sur une machine sans le réglage.

⚠️ Le pattern à risque (`initial` avec `x`/`y` non nul sur un élément `fixed` ou `sticky`) est
présent dans **plus de 20 fichiers** (`CommandPalette`, `QuickAddBar`, `InboxMenu`,
`SmartListMenu`, `ColorSettingsModal`…). Tous ne sont pas cassés — seuls le sont
ceux dont la **position finale** dépend du transform plutôt que du CSS.

**Correction** : la position finale doit venir du CSS (`bottom-[…]`), l'animation ne doit porter
que sur l'opacité — ou déclarer le décalage d'entrée dans une variante neutralisée par
`useReducedMotion()`. **Règle** : ne jamais faire dépendre une position d'arrivée d'une animation
de transform.

### 🟠 2. Le design system mobile · adopté à moitié (remesuré le 2026-08-25)

> ### ✅ La migration a repris, et elle a révélé que `MobileHeader` était cassé
>
> **Comptage au 2026-08-25**, après migration des six pages restantes :
>
> | Primitive | 08-14 | **08-25** |
> |---|---|---|
> | `MobileHeader` | 2 | **8** · `/dashboard`, `/habits`, `/okr`, `/statistics`, `/settings`, `/entreprise` + les deux d'origine |
> | `MobileScreen` | 0 | **0** |
> | `ListRow` | 0 | **0** |
> | `TouchTarget` | 2 | 2 |
> | `BottomSheet`, `Segmented`, `SectionHeader` | 2 chacun | inchangés |
>
> 🔴 **Et `MobileHeader` n'avait JAMAIS fonctionné.** Il écoutait `window.scroll`, alors que
> `Layout.tsx` place tout le contenu dans un `<main class="flex-1 overflow-auto">` : c'est LUI qui
> scrolle, et l'événement `scroll` d'un conteneur **ne remonte pas** jusqu'à `window`. Mesuré sur
> `/tasks` avant correctif : après 500 px de scroll, `window.scrollY` valait **0**, le titre
> restait à 28 px, le fond du header restait transparent. Le composant créé pour porter la
> compaction au scroll ne l'a jamais portée, sur la seule page qui l'utilisait. Il remonte
> désormais les ancêtres jusqu'au premier conteneur réellement scrollable, avec repli sur
> `window` pour les pages hors `Layout`.
>
> **C'est l'argument le plus fort de cet audit contre le code sans consommateur** : deux
> consommateurs, c'est assez pour croire qu'une brique marche, et pas assez pour s'en apercevoir
> quand elle ne marche pas. Cf. [`ARCHITECTURE.md`](./ARCHITECTURE.md) §4.
>
> **Adhérence typographique, remesurée** : **243 usages de l'échelle fermée contre 1 684 de
> Tailwind brut**, soit **13 %** (contre 10 % au 08-14). La proportion monte, le **stock aussi**
> (1 487 → 1 684). Migrer les titres de page a traité le cas le plus visible, pas le plus
> volumineux : le mode entreprise, qui n'a jamais été migré, continue de contourner l'échelle
> badge par badge, c'est ce que la garde `design-system.guard.test.ts` attrape à répétition
> (cf. [`TESTING.md`](./TESTING.md)).

### Le diagnostic d'origine (2026-08-14)

Les primitives de `src/components/mobile/` ont été créées en juillet 2026 pour unifier le rendu
mobile. Comptage au 2026-08-14 :

| Primitive | Consommateurs |
|---|---|
| `MobileHeader` | 2 (`TasksHeader`, `TasksInboxMenu`) |
| `TouchTarget` | 2 (les mêmes) |
| `BottomSheet` | 2 (`PremiumPage`, `WeeklyRecapSheet`) |
| `Segmented` | 2 (`MobileAgenda`, `ThemeToggle`) |
| `SectionHeader` | 2 (`primitives.tsx`, `GuidePage`) |
| `MobileScreen` | **0** |
| `ListRow` | **0** |

Et sur l'échelle typographique fermée (`text-display/title/headline/body/label/caption`) :
**169 usages contre 1 487 usages de Tailwind brut** (`text-xs` → `text-5xl`), soit **10 %
d'adhérence**.

La migration s'était volontairement limitée à la page Tâches, en vitrine. Elle ne s'est jamais
poursuivie, et deux primitives n'ont jamais servi. Résultat : il n'y a pas un langage visuel
mobile mais **deux** — la page Tâches, et tout le reste. C'est la cause structurelle du finding
« quatre tailles de titre » relevé dans [`UI-PATTERNS.md`](./UI-PATTERNS.md).

**Correction** : soit finir la migration page par page, soit supprimer `MobileScreen` et `ListRow`
et assumer que les primitives ne couvrent que Tâches. L'état intermédiaire actuel est le pire des
trois : il coûte de la maintenance sans rendre de cohérence.

> ✅ **Tranché le 2026-09-05 (C-10) : la seconde branche.** `MobileScreen` et `ListRow` sont
> supprimés. Les mesures ci-dessus restent celles de leur date — c'est leur intérêt — mais l'état
> courant est celui-ci. Ce qui a emporté la décision n'est pas le poids du code (163 lignes) :
> c'est qu'une primitive que rien ne contraint ne peut pas être jugée. Elles se réécriront contre
> un écran le jour où un écran les demande.

### 🟠 3. Onze bottom-sheets réimplémentés à la main, et cinq mentent sur leur geste

`docs/MOBILE.md` (plus bas) présente `BottomSheet` comme « réutilisée telle quelle par toute
nouvelle feuille modale » et documente **une** exception (`AdModal`, supprimée depuis par C-04).
La réalité mesurée :
**11 feuilles réimplémentent le pattern à la main** contre 2 qui utilisent la primitive.

Pire que la duplication, leur comportement diverge :

| | Poignée de glissement | Glisser-pour-fermer |
|---|---|---|
| `ColorSettingsModal`, `HabitModal`, `MobileMoreSheet`, `PremiumGateModal` | ✅ | ✅ |
| `CreateTeamModal`, `NewTeamProjectModal`, `RecurrenceDaysModal`, `TeamTaskModal`, `DeleteObjectiveConfirm` | ✅ | ❌ |
| `LoginModal` | ❌ | ✅ |
| `ShareInviteClaimer` | ❌ | ❌ |

**Cinq feuilles affichent une poignée de glissement qui ne fait rien** — une affordance qui promet
un geste inexistant, ce qui est moins bon que de ne rien afficher. Une en a le geste sans le
signaler. Les trois modales du mode entreprise sont toutes dans le groupe « poignée sans geste ».

**Correction, partielle au 2026-08-24.** `useSheetDrag()` (`mobile-motion.ts`) porte désormais le
geste — mêmes valeurs que `BottomSheet` (80 px de course ou 500 px/s), pour que toutes les feuilles
se ferment au même geste. Il est câblé sur les deux feuilles qui mentaient ET qui utilisaient déjà
Framer : `RecurrenceDaysModal` et `DeleteObjectiveConfirm`.

**Les trois dernières, tranchées le 2026-08-24 : poignée RETIRÉE.**

`CreateTeamModal`, `NewTeamProjectModal` et `TeamTaskModal` n'utilisent pas Framer : ce sont des
`DialogContent` Radix en variante bottom-sheet, avec une poignée purement décorative. Deux
options existaient, et ce n'est pas la difficulté technique qui a tranché.

| Option | Coût | Pourquoi elle n'a pas été retenue |
|---|---|---|
| Ajouter le geste | Introduire du drag Framer dans un dialogue Radix sans casser le piège de focus, `aria-modal` ni la fermeture par Échap | **Ces trois feuilles sont des FORMULAIRES.** Un glissement accidentel sur une saisie à moitié remplie la perd. Les quatre feuilles qui ont le geste (`ColorSettingsModal`, `HabitModal`, `MobileMoreSheet`, `PremiumGateModal`) sont des menus et des sélecteurs : il n'y a rien à y perdre |
| **Retirer la poignée** ✅ | 5 min | Retenue. La feuille se ferme par la croix et par un tap sur le voile, comme avant. Elle arrête simplement de promettre un geste qui n'existe pas |

> ⚠️ **Ne pas la remettre « pour faire natif ».** Une affordance qui ment coûte plus cher que pas
> d'affordance : l'utilisateur tire, rien ne bouge, il en conclut que l'app est cassée. Sans la
> barre, il cherche la croix et la trouve. Si le geste est ajouté un jour, il devra venir AVEC
> une garde contre la perte de saisie (confirmation si le formulaire est sale).

### ✅ Vérifié sain

- **Zones sûres** : 9 pages réservent `env(safe-area-inset-bottom)`. L'absence sur `/agenda` est
  **intentionnelle et commentée dans le code** (le conteneur `flex-1` s'arrête déjà au-dessus de
  la tab bar ; l'ancien `pb-64px` volait 64 px à la grille pour rien).
- **Fond des feuilles** : `backdrop-blur` présent sur les 11, cohérent.
- **Tokens de thème** : aucune couleur Tailwind en dur dans l'app (cf. `UI-PATTERNS.md`).
- **Débordement horizontal** : zéro sur les 8 routes testées en 375 px.


> **Aucun bug mobile ouvert connu au 2026-08-14.** L'ancien fichier `a-faire.md` listait 5 points :
> 4 sont corrigés, le 5ᵉ est une limitation plateforme (pas de `navigator.vibrate()` sur Safari iOS —
> le code garde un `if (navigator.vibrate)`, no-op propre sur iOS). Les leçons de test tactile qui en
> sont issues vivent désormais dans [`TESTING.md`](./TESTING.md) (§Playwright E2E).

## Breakpoint et hook

- Tailwind breakpoint mobile = `< md` (768 px). Le `sm` (640 px) sépare "petit mobile" et "grand mobile / phablette".
- Hook React : `useIsMobile()` depuis `@/lib/hooks/use-mobile` — boolean réactif basé sur `window.innerWidth < 768`. À utiliser quand une logique JS doit diverger mobile/desktop (ex. vue par défaut d'un calendrier). Préférer Tailwind responsive classes (`md:hidden`, `md:flex`) quand c'est purement visuel.
- Détection viewport en JS pur : `window.matchMedia('(min-width: 768px)')`.

## Layout shell mobile

- **`MobileTabBar`** (bottom tab bar, hauteur ~64 px) — visible sur mobile uniquement : `Accueil / Tâches / Agenda / Habitudes / Plus`.
- **Padding-bottom obligatoire** sur les pages : `pb-[calc(64px+env(safe-area-inset-bottom)+88px)] md:pb-8` (avec FAB) ou `+24px` (sans FAB). **Toutes les pages protégées doivent l'avoir** — sinon le dernier élément est caché derrière la tab bar.
- **`min-h-[100dvh]`** (jamais `min-h-screen`/`100vh`) sur les wrappers de page — sinon Safari iOS rogne le contenu.
- **FAB global** (`src/components/Layout.tsx`) : `fixed bottom-20 right-4 z-40 w-14 h-14 rounded-2xl`, unique bouton de création sur toutes les pages protégées. Il dispatch un `CustomEvent` différent selon la route : `open-task-create` sur `/tasks` (formulaire complet), `open-agenda-create` sur `/agenda` (modal d'ajout d'événement, écoutée par `AgendaPage` via `useEffect`), `open-quick-add` ailleurs (capture rapide). **Ne jamais** dupliquer un bouton "+" dans l'en-tête d'une page tant que le FAB peut couvrir le même besoin — cf. l'ancien bouton "+" de l'en-tête Agenda, retiré le 2026-07-23 au profit du FAB seul (évitait un doublon flottant au-dessus du calendrier).

## Design system mobile (2026-07-22, étendu 2026-07-23)

Le mobile n'avait aucun système : 10 tailles de texte arbitraires (`text-[8px]` → `text-[17px]`) en plus des 9 tailles Tailwind, 4 gouttières de page différentes, 9 rayons arbitraires, 176 boutons sous la cible tactile. Tout est désormais adossé à des **tokens**.

**Les 8 pages mobiles sont migrées** : Tâches (page vitrine, 3 passes), Réglages, OKR, Statistiques, Premium, Habitudes, Dashboard, Agenda. Voir `git log --oneline -- 'src/pages/*' 'src/components/mobile'` pour l'historique. Le budget d'arbitraire et le plancher 11px (`design-system.guard.test.ts`) sont passés de 294/143 à 204/85 sur cette dernière vague.

### Échelle typographique — FERMÉE à 6 crans

Tokens dans `src/index.css` (`:root`), exposés en utilitaires Tailwind (`tailwind.config.js`).

| Utilitaire | Token | Taille | Usage |
|---|---|---|---|
| `text-display` | `--t-display` | 28 px | Titre de page (`MobileHeader`) |
| `text-title` | `--t-title` | 22 px | Titre de section majeur |
| `text-headline` | `--t-headline` | 17 px | Titre de carte, header compacté |
| `text-body` | `--t-body` | 15 px | Texte courant, titre de ligne |
| `text-label` | `--t-label` | 13 px | Labels, boutons, chips |
| `text-caption` | `--t-caption` | 11 px | Meta, badges, labels de tab bar |

> **Deux sous-arbres montent d'un pixel, et c'est la SEULE façon de le faire.** `.dashboard-mobile-text-boost`
> (accueil) et `.task-title-boost` (titre d'une tâche dans la liste mobile) redéfinissent les
> **tokens** `--t-*` sous 768 px, hors de tout `@layer` : les classes `.text-*` de Tailwind vivent
> dans son layer `utilities`, qui gagnerait quelle que soit la spécificité. Redéfinir le token
> plutôt que `font-size` laisse la règle suivre le cran appliqué par le composant sans avoir à le
> connaître. ❌ Ni `text-[14px]` (le cliquet le refuse), ni un 7ᵉ cran dans l'échelle.
> ⚠️ `.task-title-boost` couvre `--t-label` ET `--t-body` : `TaskCard` monte d'un cran quand la
> tâche est EN RETARD, n'en décaler qu'un effacerait ce signal.

> **11 px est le plancher absolu.** Le test `src/design-system.guard.test.ts` échoue si une taille sous 11 px apparaît, et plafonne le stock de `text-[Npx]` restants (budget qui ne doit que baisser).

### Grille, rayons, cible tactile

| Utilitaire | Token | Valeur |
|---|---|---|
| `p-gutter` / `gap-gutter` | `--gutter` | 16 px — gouttière unique de toutes les pages |
| `gap-row` | `--gap-row` | 12 px — entre deux lignes de liste |
| `gap-section` | `--gap-section` | 28 px — entre deux sections |
| `rounded-row` / `rounded-card` / `rounded-sheet` | `--r-row` / `--r-card` / `--r-sheet` | 12 / 16 / 20 px |
| `min-h-touch` / `min-w-touch` | `--touch-min` | 44 px (WCAG 2.5.5) |

### ⚠️ tailwind-merge doit connaître ces tailles

`cn()` (`src/lib/utils.ts`) utilise `extendTailwindMerge` pour déclarer `text-display/title/headline/body/label/caption` dans le groupe `font-size`. **Sans cette config**, tailwind-merge les prend pour des couleurs de texte et les **supprime silencieusement** dès qu'une couleur suit dans le même `cn()` — symptôme constaté : les libellés de `MobileTabBar` retombés à 16 px, sans erreur. Toute nouvelle taille custom doit être ajoutée à cette liste.

### Primitives — `src/components/mobile/`

| Primitive | Rôle |
|---|---|
| `MobileHeader` | Grand titre qui se compacte au scroll (motif « large title » iOS) + slot actions |
| `SectionHeader` | Titre de section discret + compte + action |
| `Segmented` | Contrôle segmenté (pastille active animée via `layoutId`) |
| `TouchTarget` | Bouton-icône dont la zone tactile fait réellement 44×44 px |
| `BottomSheet` | Feuille bas-d'écran mobile / dialogue centré desktop (`sm:`), drag-to-dismiss, extrait de la modale de choix Premium — réutilisée telle quelle par toute nouvelle feuille modale à 2 choix ou plus |

> 🗑️ **`MobileScreen` et `ListRow` ont été supprimés le 2026-09-05** (C-10) : six semaines
> d'existence, zéro écran les montant. Ils sont restés dans cette table tout ce temps, et une
> table qui liste une primitive que rien n'utilise décrit une architecture qui n'existe pas.
>
> ❌ **Ne pas les recréer d'après cette note.** Si le besoin revient, ils se réécrivent CONTRE un
> écran réel : c'est la seule façon de savoir ce qu'ils doivent porter, et c'est précisément ce
> qui manquait à `MobileHeader` — utilisé par une page, et cassé pendant un mois sans que
> personne le voie.
| `mobile-motion.ts` | Courbes partagées (`SHEET_SPRING`…) + `haptic()` + `prefersReducedMotion()` |

Composer ces briques plutôt que redessiner. Tests : `src/components/mobile/mobile-primitives.test.tsx`.

> **Le pattern bottom-sheet existe aussi hors de `BottomSheet`** : le hook `useBottomSheet` (`src/hooks/use-bottom-sheet.ts`), avec drag-to-dismiss, est antérieur à la primitive partagée et sert encore quelques feuilles maison. Son premier porteur, `AdModal.tsx`, a été supprimé le 2026-09-04 avec le mur-pub (C-04). Ne pas fusionner les deux implémentations sans un passage dédié.

### Champs de saisie — 16 px obligatoire

`src/index.css` impose `font-size: 16px` à tous les champs texte sous 768 px. En dessous de 16 px, **iOS Safari zoome automatiquement** au focus et la page reste décalée. Ne pas rétablir un `text-xs` sur un input mobile.

### Listes bord à bord — `.card-plain-mobile`

Une liste mobile ne vit pas dans une carte : la carte ajoute une 2ᵉ gouttière et vole ~24 px de largeur utile par ligne. `.card-plain-mobile` (dans `src/index.css`) neutralise le chrome de `.card` sous 768 px ; au-delà, `.card` reprend à l'identique. Utilisé par `TasksPage`, `OKRCard`, et les 4 widgets Dashboard (`TodayTasks`, `TodayHabits`, `CollaborativeTasks`, `ActiveOKRs` + `DashboardCardSkeleton`).

**Piège `MobileCollapsible`** (`src/components/MobileCollapsible.tsx`, Dashboard uniquement) : le composant enveloppait chaque widget déplié dans un hack `[&>div]:rounded-t-none [&>div]:border-t-0` pour masquer la couture entre son en-tête (bg/bordure pleins) et la carte `.card` de l'enfant. Depuis que les 4 widgets utilisent `.card-plain-mobile` (transparents sous 768 px), il n'y a plus de couture à masquer — le hack a été retiré. **Ne pas le réintroduire** si un futur widget wrappé garde encore un fond/bordure plein sur mobile ; corriger plutôt le widget lui-même. La classe `.mobile-collapsible-body` reste nécessaire (elle masque le titre dupliqué du widget via `src/index.css`), seul le child-selector de couture a disparu.

### Chips de filtre — pattern Spotify (2026-09-06)

Toute pilule de **filtre/sélection** (liste rapide, filtre rapide, catégorie) suit le pattern
Spotify — comparé côte à côte à l'ancien style Cosmo par Axel, tranché en sa faveur : `rounded-full`,
**jamais de bordure**, fond PLEIN dans les deux états (au repos ET actif), jamais de fond
transparent + contour coloré.

```
Repos  : bg-[rgb(var(--color-chip-bg))]      text-[rgb(var(--color-text-secondary))]
Actif  : bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]
         (ou la couleur de la catégorie elle-même, cf. CategoryFilterBar)
Hover  : bg-[rgb(var(--color-hover))] (repos uniquement — l'état actif ne change pas au survol)
```

- **Seule exception** : une chip qui représente une catégorie ou une liste garde sa **pastille de
  couleur** avant le nom (`<span className="rounded-full" style={{backgroundColor}}/>`, ~8-10px) —
  c'est une information (quelle couleur est associée à cet élément), pas un contour décoratif.
- ❌ **Ne jamais coder un état inactif en `border-[rgb(var(--color-border))]` + fond transparent** :
  c'est exactement l'ancien pattern Cosmo, remplacé par cette note. Un fond transparent avec un
  simple contour est plus fragile en accessibilité (contraste dépendant du fond de page) et
  moins dense visuellement qu'un fond plein.
- ❌ **Ne jamais garder de bordure sur l'état ACTIF non plus** — y compris les couleurs
  sémantiques ad hoc (ex. l'ancien traitement vert bordé de la chip « Aujourd'hui » dans
  `TaskListsBar`, retiré : elle suit désormais le même plein neutre que les autres chips).
- ✅ **Ne s'applique PAS** aux contrôles segmentés (un seul conteneur bordé, boutons internes sans
  bordure propre — `TaskQuickFilters` « Tout/Perso/Entreprise », le sélecteur de vue
  d'`HabitsPage`) : c'est un pattern différent (choix exclusif dans un rail unique), pas une
  rangée de pilules indépendantes.
- ✅ **Ne s'applique PAS** à un bouton d'action « ajouter » à bordure pointillée (`+ Nouvelle
  liste`, `+ Nouvelle catégorie`) : ce n'est pas un filtre, c'est une action, le pointillé signale
  justement « ceci n'est pas encore un élément réel ».
- Composants migrés au 2026-09-06 : `TaskQuickFilters`, `TaskListsBar` (chip « Tout », « Aujourd'hui »,
  chips de liste), `CategoryFilterBar` (OKR perso + équipe, partagé), `OKRCategoryPicker`,
  `TeamCategoryPicker`. Tout nouveau filtre/chip de sélection réutilise ce pattern — ne pas
  repartir d'une bordure.

### Exceptions documentées (densité / mimique volontaire — ne pas "corriger")

- **`HabitHeatmap`** (`src/pages/statistics/HabitHeatmap.tsx`) : labels de jour/mois à 8-9px dans des cellules de calendrier de 13-20px. Forcer 11px ferait déborder une grille de 26 semaines × 7 jours sur un écran de 393px. Densité de données assumée, pas une dette.
- **Toggle iOS** (`src/pages/SettingsPage.tsx`, rappel habitudes du soir) : `w-[51px] h-[31px]` mimant les proportions natives iOS. Seule occurrence dans l'app (pas de `Toggle` partagé créé pour un seul appelant).
- **Rayons de graphique** (`DashboardBarChart.tsx` barres/légende `rounded-[2px]`/`rounded-t-[3px]`, dormant derrière `SHOW_REPARTITION_CHART=false`) : accents décoratifs sub-pixel sur des barres fines, hors de l'échelle `rounded-row/card/sheet` qui vise les cartes/lignes, pas les micro-détails de chart.

### Thèmes

3 thèmes : `light`, `dark`, `black` (graphite + accent bleu). Résolution et application centralisées dans **`src/lib/theme.ts`** (`resolveInitialTheme` / `applyTheme`), consommées par `src/main.tsx` (avant le premier paint) ET `src/hooks/useDarkMode.ts`. **Sur mobile, un visiteur sans choix explicite démarre en `black`** ; un choix utilisateur reste toujours prioritaire. Les anciennes valeurs `midnight` / `monochrome` sont migrées vers `black`. Tests : `src/lib/theme.test.ts`.

### CSS injecté non-Tailwind — FullCalendar mobile

`src/pages/agenda/MobileAgenda.tsx` exporte `mobileCalendarStyles`, un bloc `<style>` brut injecté pour surcharger le CSS interne de FullCalendar (les classes `.fc-*` ne sont pas atteignables en Tailwind). Le garde-fou `design-system.guard.test.ts` ne voit **pas** ces occurrences (ce n'est pas la syntaxe `text-[Npx]`) — `font-size: 11px !important` sur `.fc-timegrid-slot-label` a été corrigé manuellement (était 10px). Si une autre valeur y est ajoutée, l'aligner à la main sur l'échelle mobile ; le garde-fou ne le fera pas pour vous.

### FullCalendar · au doigt, `select` n'existe pas au tap court (2026-09-19)

Les deux calendriers posent `selectLongPressDelay={250}`. Sur une surface tactile, cela veut dire
qu'un `select` **n'est émis qu'après 250 ms d'appui MAINTENU** : le tap court, le seul geste qu'on
fait sur une case de mois, ne produit aucun `select`. Une bascule Mois → Jour branchée sur `select`
ne s'est donc jamais déclenchée sur un vrai téléphone, alors qu'à la souris `select` part au clic
et que tout paraissait fonctionner.

C'est un défaut **invisible en largeur mobile tant que l'émulation tactile n'est pas active** : il
a survécu à trois tentatives de correction, chacune validée à la souris. Un geste tactile se
vérifie avec des événements `Touch`, pas avec une fenêtre étroite.

Un tap se branche sur **`dateClick`**, qui part au doigt comme à la souris. À la souris les deux
rappels partent sur le même clic : la bascule a donc besoin d'un miroir **synchrone** du mode de
vue (une ref, pas l'état React, encore périmé dans le second appel) pour ne pas s'exécuter deux
fois. Câblage : `src/pages/agenda/useAgendaMobileView.ts`, témoin à côté.

⚠️ Animer cette bascule ne doit **pas** passer par une `key` sur le conteneur : elle remonterait
`<FullCalendar>`, alors que la bascule s'appuie justement sur `api.changeView` pour ne PAS
démonter (la course qui laissait la vue Jour s'ouvrir sur le mauvais jour). Contrôles impératifs
(`useAnimationControls`), et aucune clé de transform sous `prefers-reduced-motion`.

### Tutoriels et rendus mobile/desktop séparés

Quand une page rend deux en-têtes (`md:hidden` + `hidden md:flex`), un même `data-tutorial-id` existe deux fois. `findTarget` (`src/components/tutorial/page-tutorial-helpers.ts`) renvoie le premier élément **visible** (rect non nul), pas le premier du DOM — sinon le spotlight vise la version masquée.

## Modals — pattern bottom-sheet

Tous les modals tâche (TaskModal, AddTaskForm, AddToListModal, EventModal, ColorSettingsModal, confirms de suppression) suivent ce pattern :

```tsx
<motion.div
  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
  className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
  onClick={onClose}
>
  <motion.div
    initial={{ y: '100%', opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    exit={{ y: '100%', opacity: 0 }}
    transition={{ type: 'spring', damping: 28, stiffness: 280 }}
    onClick={(e) => e.stopPropagation()}
    className="w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh]"
    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
  >
    <div className="sm:hidden flex justify-center pt-2 pb-1">
      <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
    </div>
    <div className="px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0">…</div>
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">…</div>
    <div className="px-4 pt-3 pb-3 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-2">…</div>
  </motion.div>
</motion.div>
```

Règles non négociables :
- ✅ ESC pour fermer + clic backdrop + verrouillage `body.overflow` quand ouvert
- ✅ Drag handle visuel sur mobile
- ✅ Sticky header + sticky footer ; le body scrolle seul
- ✅ Boutons footer empilés sur mobile (`flex-col-reverse`), inline sur desktop
- ✅ Touch targets ≥ 44×44 px (`min-w-11 min-h-11` ou icônes ≥ 22 px dans wrapper 11)
- ✅ `env(safe-area-inset-bottom)` partout
- ❌ Pas de modal centré avec marge sur mobile — toujours bottom-sheet

`TaskModal` et `AddTaskForm` sont **full-screen** sur mobile (override des classes shadcn Dialog avec `top-0 left-0 translate-x-0 translate-y-0 max-w-none w-full h-[100dvh] sm:rounded-2xl sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-2xl`). Utiliser `100dvh` plutôt que `100vh`.

> **Structure TaskModal** (refactor 2026-06-06) : le corps mobile full-screen est extrait dans `src/components/task-modal/` (`TaskModalMobileBody.tsx` + `primitives.tsx` pour `Cell`/`SectionCard`/… + `constants.ts` pour `PRIORITY_OPTIONS`/`priorityColor`). `TaskModalMobileBody` est **entièrement piloté par props** (`MobileBodyProps`) — il ne lit aucun état du parent par closure. Ne pas refusionner ces fichiers.

## TaskCard mobile (`src/components/TaskTable.tsx → TaskCard`)

Layout style "agenda" :
- Barre verticale colorée à gauche (`w-1` rounded, `self-stretch`) — rouge pour retard, jaune pour favori, sinon couleur de catégorie
- Checkbox de complétion **inline avec le titre**
- Titre tronqué + ligne meta `date · temps` en dessous
- Badge `P{priorité}` à droite
- **Pas de TaskCategoryIndicator** (carré coloré supprimé sur mobile)
- **Toutes les icônes d'action cachées par défaut** (Bookmark, UserPlus, Calendar, MoreHorizontal, Trash2). Révélation via :
  1. **Long press** (500 ms) — `navigator.vibrate(15)` si dispo
  2. **Swipe à gauche** > 80 px (Framer Motion `drag="x"`) → `setActionsVisible(true)`
- **Swipe à droite** > 80 px → bascule `completed` (haptique + handle dans `onDragEnd`)
- Le `<TaskCard>` est wrappé dans `md:hidden` ; la `<table>` desktop dans `hidden md:block`

## TaskFilter mobile (`src/components/TaskFilter.tsx`)

🔴 **Depuis le 2026-09-20, la recherche n'est plus dans cette rangée sur mobile**, et le lien
`+ d'options` **n'existe plus** (il toggait `showQuickFilters`). Les deux étaient en HAUT de page,
hors de portée du pouce, et poussaient la liste vers le bas. Modèle repris : Notes (iOS).

- **`MobileTaskSearch`** (`src/pages/tasks/MobileTaskSearch.tsx`, `md:hidden`) : barre de recherche
  `fixed` à `calc(4rem + safe-area + 0.5rem)`, **elle ne défile jamais**. Au tap, un écran de
  recherche **plein et opaque** (`z-[195]`, fond de l'app) remplace la page ; **champ vide →
  « Filtres suggérés »** (Favoris, Fait, Retard, Collaboration, Sélectionner), qui sont les
  pastilles de `TaskQuickFilters` et rien d'autre. Une suggestion applique **et referme**. Sortie
  par la **croix ronde**, par le repli du clavier ou par Échap.
- 🔴 **L'UI a été refaite le 2026-09-21 en comparant les captures au modèle**, écart par écart, après
  deux passes de consignes verbales qui n'avaient pas suffi. Ce qui doit rester : titre **hors** de
  la carte, casse normale, `text-title` gras ; séparateurs **en retrait** (ils commencent à
  l'aplomb du libellé, s'arrêtent à 16 px du bord droit, aucun sous la dernière ligne) ; champ en
  **pilule pleine** ; carte **en haut**, champ **en bas**, le vide entre les deux.
- ❌ **Ne jamais compter sur `focus:ring-*` ou `border-0` pour désarmer l'anneau bleu d'un champ.**
  `index.css` impose à **tout** `input` une bordure 1px et, au focus, une bordure + un halo à la
  couleur d'accent, en `!important`. L'échappatoire est la classe **`no-input-chrome`**, mais elle
  force aussi `border-radius: 0` : un champ arrondi doit donc être **transparent à l'intérieur d'un
  conteneur** qui porte la forme et le fond.
- **Les LISTES suivent les cinq filtres dans la même carte** (2026-09-22) : « Aujourd'hui » avec son
  icône, puis chaque liste avec sa pastille de couleur, celle des chips. Sans elles, choisir une
  liste pendant une recherche obligeait à fermer l'écran d'abord, puisque la barre de chips
  s'efface. Même geste que les filtres : la ligne applique **et referme**, et un second appui sur la
  liste active la retire. ⚠️ La carte doit pouvoir **défiler** (`overflow-y-auto` + `min-h-0`) :
  mesuré à 375x460, elle se réduit et défile au lieu de pousser le champ hors de l'écran.
- **La barre ancrée porte AUSSI le tri** (2026-09-22) : `[🔍 Rechercher] [⇅ Priorité]`. Le
  `<select>` de `TaskFilter` était le dernier rescapé d'une rangée dont la recherche et
  « + d'options » étaient déjà partis ; cette rangée est donc `hidden md:flex`, elle n'a plus rien à
  montrer sous 768 px. La pilule **affiche le critère courant** : une icône seule aurait retiré
  l'information en même temps que la commande. Un appui ouvre une `BottomSheet` avec les cinq
  critères et le sens.
  ⚠️ **Ni le critère ni le sens ne referment la feuille**, contrairement aux suggestions de
  recherche : trier est un choix en deux temps, et changer de critère remet le sens en croissant
  (`handleFilterChange`). Refermer au premier appui obligerait à rouvrir pour la moitié du réglage.
- **La carte « Tâches en cours » (légende des catégories) est masquée sous 768 px**, et son
  engrenage est repris dans l'en-tête mobile, à côté de la boîte de réception. 🔴 Déplacer une
  surface, c'est déplacer ses COMMANDES : masquée sans ce report, la seule porte vers les réglages
  de couleurs des catégories disparaissait avec elle. Le libellé reste `common → colorLegend.edit`,
  jamais recopié.
- 🔴 **Pendant la recherche, tout ce qui vit AU-DESSUS de la première tâche s'efface** : en-tête de
  page et compteurs, barre des listes, rangée de tri, pilules de filtre actif, et l'astuce de
  balayage (`SwipeHintBanner`). Mesuré : la liste commence à **44 px** du haut au lieu de 267, soit
  trois tâches de plus entre le haut de l'écran et le champ. L'état vit dans
  `pages/tasks/search-open.store.ts` : `SwipeHintBanner` est deux niveaux plus bas, dans
  `TaskTable`, qui ne peut pas recevoir une prop de plus sans dépasser son plafond de 600 lignes.
  ⚠️ La classe de retour doit rendre à chaque bloc son affichage **naturel** (`md:flex` pour une
  rangée `flex`, `md:block` sinon) : l'écran est `md:hidden`, mais l'état d'ouverture, lui, survit à
  un élargissement de fenêtre.
- ⚠️ **Dès la première frappe, le fond s'efface** (`pointer-events-none`, seule la rangée du champ
  reste cliquable) : le modèle remplit cet espace avec ses résultats, COSMO ne le peut pas sans
  remonter toute sa liste dans l'overlay. Chercher derrière un fond opaque revenait à chercher à
  l'aveugle. Décision du 2026-09-21.
- ⚠️ **`z-50`, le cran publié des modales**, et pas une valeur choisie pour l'occasion. En mode
  démo, `DemoBridgePrompt` (`z-[190]`) flotte par-dessus : il flotte par-dessus **toutes** les
  modales de l'app, c'est une propriété de ce composant. `z-[195]` a été écrit puis retiré le
  2026-09-21, refusé par `design-system.guard` — l'échelle est fermée, et c'est ce qui l'empêche de
  redevenir seize valeurs pour sept paliers.
- 🔴 **Taper la barre doit LEVER le clavier, et un `focus()` dans un effet ne le fait pas.** Sur
  iOS, le clavier ne s'ouvre que si `focus()` est appelé **pendant la tâche du geste**.
  `useModalA11y` pose le focus dans un `useEffect`, donc après la peinture : le champ était
  focalisé, curseur visible, clavier fermé, et il fallait un second appui pour écrire.
  L'ouverture passe donc par `flushSync(() => setOpen(true))` **puis** `inputRef.current.focus()`,
  dans le gestionnaire de clic. `useModalA11y` ne le déplace pas ensuite : il s'abstient quand le
  focus est déjà dans la surface.
- 🔴 **Replier le clavier referme la recherche**, comme dans Notes. Le signal est le champ qui
  **perd le focus** (`onBlur`) : la touche « OK » de la barre d'accessoires iOS comme le repli du
  clavier le déclenchent. ❌ **Un `blur` nu rendrait les suggestions intouchables** — sur un appui,
  le champ se défocalise AVANT que le `click` n'atteigne la ligne : un garde posé au `pointerdown`
  du panneau neutralise le blur pendant un appui.
- 🔴 **`visualViewport` ne sert QU'À PLACER le champ, jamais à juger « clavier ouvert ».** Première
  version livrée, puis retirée le 2026-09-21 : elle comparait `innerHeight - visualViewport.height`
  à des constantes (`> 60` = clavier). **Cette mesure ne vaut pas 0 au repos** — la barre d'outils
  de Safari en prend déjà ~60 à 100 px. Verte sur l'émulateur, qui repose à 0 ; sur un téléphone,
  le champ flottait à l'ouverture et replier le clavier ne refermait plus rien. Ce qui reste est
  **relatif** : une ligne de base mesurée à l'ouverture (`measureKeyboardInset()`, lecture
  **synchrone** — l'état du hook vaut encore 0 à cet instant), et le clavier est tenu pour ouvert
  au-delà de `ligne de base + 80 px`.
- ⚠️ **Clavier ouvert, le champ se pose DESSUS sans gouttière** : la zone sûre est déjà couverte par
  le clavier, l'additionner creusait une bande vide entre les deux.
- ❌ **Ne pas laisser la barre fermée montée pendant l'overlay.** Elle réapparaît dès la première
  frappe, quand la carte de suggestions qui la masquait disparaît, et on lit deux champs de
  recherche empilés, dont un inerte.
- ❌ **Ne jamais lever le garde de pointeur (`pointerInPanel`) sur le panneau lui-même.** Taper une
  suggestion le DÉMONTE depuis le gestionnaire de clic : son `onPointerUp` n'arrive jamais, le
  garde reste levé, et le repli du clavier ne referme plus rien pour le reste de la session. Il se
  lève sur `window`, et se remet à zéro à chaque ouverture.
- ❌ **Ne jamais dupliquer l'état du filtre rapide.** Il vit dans `quick-filter.store.ts`
  (`useSyncExternalStore`), lu ET écrit par les deux surfaces. Un évènement `window` ne suffisait
  pas : il ne va que dans un sens, la barre serait aveugle au filtre courant.
- 🔴 **La pilule du filtre actif dans la barre est le SEUL moyen de l'enlever sur mobile** : la
  rangée de pastilles y est masquée (`hidden md:flex`). La retirer enfermerait dans une liste
  filtrée.
- ⚠️ **Trois surfaces se disputent le bas de l'écran** : la barre de recherche (`safe + 72px`), la
  barre d'actions groupées de la sélection (`safe + 84px`) et le FAB de `Layout`. La recherche
  s'efface en mode sélection (`select-mode.store.ts`), et le FAB monte à `bottom-[8.5rem]` **sur
  `/tasks` uniquement**. Toute 4ᵉ surface ancrée doit se placer dans cette liste, pas à côté.
- ⚠️ Réserve de défilement de `/tasks` portée à `+144px` (au lieu de `+88px`) : la barre ancrée
  masquerait sinon la dernière tâche.
- ⚠️ `#search-tasks-main` (cible du raccourci « / ») reste le champ **desktop** : il n'y a pas de
  clavier physique en face de la barre mobile.
- Bouton "Filtres" caché sur mobile (`hidden sm:inline-flex`).
- Label de tri compacté : `<span className="hidden sm:inline">Trier par :</span><span className="sm:hidden">Tri :</span>`.

## DeadlineCalendar mobile (`src/components/DeadlineCalendar.tsx`)

- Mobile = vue **agenda** (liste verticale par jour) **uniquement**. Boutons Sem./Mois masqués (`hidden sm:flex`).
- Le toggle "Agenda" est masqué sur mobile (`hidden sm:inline-flex`).
- `useEffect` force `currentView = 'agenda'` quand `isMobile` devient true.
- Bouton "Aujourd'hui" pour retour rapide.

## Modules touchés par les conventions mobile

| Composant | Particularité mobile |
|---|---|
| `TasksPage.tsx` | H1 réduit (`text-lg sm:text-3xl`), Calendrier inline, padding-bottom safe-area |
| `TaskTable.tsx → TaskCard` | Voir section dédiée |
| `TaskFilter.tsx` | Voir section dédiée |
| `TaskModal.tsx` | Full-screen, single-column, Supprimer comme icône, pas de "Marquer complétée" |
| `AddTaskForm.tsx` | `h-[100dvh]` full-screen, sticky footer empilé |
| `DeadlineCalendar.tsx` | Vue agenda forcée |
| `AddToListModal.tsx`, `EventModal.tsx`, `ColorSettingsModal.tsx` | Bottom-sheet pattern |

## Drag-to-reorder — desktop only

Sur la barre de chips des listes (TasksPage), le drag-to-reorder Framer Motion est **désactivé sur mobile** :
```tsx
drag={isEditing || isMobile ? false : 'x'}
```
Raison : la barre a `overflow-x-auto`. Le drag horizontal capturerait le swipe de scroll → conflit. Même logique pour toute barre scrollable horizontale avec items draggables.

## iOS Safari — bug WebKit fetches parallèles (`src/main.tsx`)

iOS Safari WebKit a un bug documenté ([WebKit #171501](https://bugs.webkit.org/show_bug.cgi?id=171501), [supabase-js #684](https://github.com/supabase/supabase-js/issues/684)) : quand une page charge et lance **plusieurs fetches cross-origin en parallèle** avant que la connexion HTTP/2 soit stabilisée, le navigateur accepte le 1er stream mais **rejette silencieusement les suivants** avec `TypeError: Load failed` / DOMException.

**Symptômes** : page `/tasks` ou `/habits` plante après ~8 s sur iOS Safari uniquement, "Impossible de charger les tâches", **aucune requête Supabase visible** dans Network. Ne se reproduit **que** la première fois (connexion HTTP/2 ensuite en keep-alive).

**Fix obligatoire** dans `src/main.tsx`, **avant `createRoot()`** :

```ts
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
if (supabaseUrl) {
  const preconnect = document.createElement('link');
  preconnect.rel = 'preconnect';
  preconnect.href = supabaseUrl;
  preconnect.crossOrigin = 'anonymous';
  document.head.appendChild(preconnect);

  fetch(`${supabaseUrl}/auth/v1/health`, { method: 'GET', mode: 'cors', credentials: 'omit' }).catch(() => {});
  fetch(`${supabaseUrl}/rest/v1/`,        { method: 'GET', mode: 'cors', credentials: 'omit' }).catch(() => {});
}
```

⚠️ **Règles non négociables** :
- ✅ Garder **les deux** warmup fetches — un seul n'amorce qu'un seul pool de streams
- ✅ Garder le `.catch(() => {})` — la requête peut échouer (401, CORS), peu importe
- ✅ Tester sur un vrai iPhone (Eruda console + `?debug=1`)
- ❌ **Ne JAMAIS** retirer ces fetches — la régression est invisible en CI/dev/desktop
- ❌ Remplacer par `<link rel="preconnect">` seul — ne committe pas de stream HTTP
- ❌ Centraliser les premières requêtes dans un seul fetch — le bug reviendra dès qu'une autre fetch sera ajoutée

**Cache localStorage complémentaire** : `src/modules/auth/AuthContext.tsx` persiste `tasks` et `habits` (clés `cosmo:qcache:{userId}:{key}`, TTL 24 h, write-through via `queryCache.subscribe`). Cleaning : `clearLocalCache(userId)` sur logout et user-change.

**Skip retry sur timeout** : `src/App.tsx` retire le retry sur `timeout` / `aborted` / `Délai` — sinon worst-case 17 s avant erreur.

**Debug iOS sans Mac** : ajouter `?debug=1` → Eruda console flottante (CDN). Logs `[AUTH] @Xms` et `[FETCH→] /path`. Zéro overhead sans le query param.

## Tester le mobile

- DevTools responsive → **375 × 812**, **393 × 852**, **412 × 915**
- Touch targets : `document.querySelectorAll('button').forEach(b => { const r = b.getBoundingClientRect(); if (r.width < 44 || r.height < 44) console.warn(b); })`
- Mode démo : 100 tâches seedées sur 12 mois — stress-test du rendu

## Ne jamais faire (mobile)

- ❌ **Écrire `text-[Npx]` sur du mobile** — utiliser l'échelle à 6 crans (`design-system.guard.test.ts` bloque sous 11 px)
- ❌ **Ajouter une taille custom à `tailwind.config.js` sans l'ajouter aussi à `extendTailwindMerge`** dans `src/lib/utils.ts` — elle disparaîtra silencieusement du DOM
- ❌ **Oublier la réserve de bas de page** — une page mobile pose `px-gutter` et
  `pb-[calc(64px+env(safe-area-inset-bottom)+24px)]`, ou `+88px` si elle porte un FAB. Sans elle,
  le dernier élément passe sous la tab bar. ⚠️ `MobileScreen` portait ce calcul et a été supprimé
  le 2026-09-05 (C-10, zéro consommateur) : la règle est donc à appliquer à la main, comme le font
  déjà toutes les pages
- ❌ **Enfermer une liste mobile dans une `.card`** — utiliser `.card-plain-mobile`
- ❌ Mettre un input mobile sous 16 px (iOS zoome au focus)
- ❌ Redessiner un en-tête / une ligne / un contrôle segmenté au lieu de composer `src/components/mobile/`
- ❌ Modal centré sur mobile (toujours bottom-sheet)
- ❌ Touch target < 44 × 44 px (WCAG 2.5.5)
- ❌ Lire `window.innerWidth` en boucle dans le render — utiliser `useIsMobile()`
- ❌ `100vh` pour un modal full-screen (utiliser `100dvh`)
- ❌ Action (validation, suppression) accessible **que** par swipe — toujours un fallback visible
- ❌ Faire diverger mobile/desktop dans le même composant sans `md:hidden` / `md:flex` / `useIsMobile()`
- ❌ **Valider un geste tactile à la souris** — `selectLongPressDelay` rend `select` inatteignable
  au tap ; vérifier avec de vrais événements `Touch` (cf. § FullCalendar ci-dessus)
- ❌ Modifier `<TaskCard>` (`md:hidden`) sans vérifier que la table desktop reste intacte (`hidden md:block`)
- ❌ Réintroduire `TaskCategoryIndicator` ou des icônes inline sur la TaskCard mobile
- ❌ Retirer le warmup `fetch()` iOS Safari, le cache `cosmo:qcache:*`, ou le skip-retry sur timeout
- ❌ Lancer > 5-6 requêtes Supabase en parallèle au mount sans tester sur vrai iPhone
- ❌ Activer un `Reorder.Group` / `drag` Framer Motion sur une barre `overflow-x-auto` mobile sans guard `drag={isMobile ? false : 'x'}`

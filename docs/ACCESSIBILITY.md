# Accessibilité (a11y) — COSMO

**Cibles** : WCAG 2.1 AA (obligation EAA — European Accessibility Act, applicable depuis le 28 juin 2025).
**Outillage** : `e2e/a11y-audit.spec.ts` (axe-core, 11 routes, dumpe les violations par route)
**+ Lighthouse CI** (`lighthouserc.json`, job `lighthouse`) sur les 4 routes prérendues.
**Gates CI** : les violations `impact: 'critical'` sont **bloquantes** (`assertNoCritical`). `serious` / `moderate` / `minor` sont dumpées dans `test-results/a11y/<route>.json` mais non bloquantes. Le score a11y de Lighthouse est **bloquant** sur `/`, `/guide`, `/blog`, `/pour-freelances`.

## 🔎 Ce que nos mesures prouvent, et ce qu'elles ne prouvent pas

🔴 **Tout ce que ce document appelle « mesuré » a été mesuré sur Chromium desktop**, en viewport de
bureau, par axe-core et par Playwright. Or **Playwright ne lit pas l'arbre d'accessibilité comme un
lecteur d'écran** : il interroge le DOM, `document.activeElement` et des attributs. Ce qui est
prouvé ici, c'est le **FOCUS**. Ce n'est pas l'**ANNONCE**.

| Prouvé aujourd'hui | Non prouvé, et donc à ne pas affirmer |
|---|---|
| Où part le focus à l'ouverture d'une surface, et où il revient à sa fermeture | Ce qu'un lecteur d'écran **prononce** en arrivant sur cet élément |
| Qu'une flèche déplace le focus, et de quelle cellule à quelle cellule | Le **rôle** annoncé (« case à cocher » plutôt que « bouton »), et l'état (« cochée », « sélectionné ») |
| Qu'un élément est atteignable au clavier, et en combien de tabulations | L'**ordre de lecture au balayage**, qui inclut le texte non focalisable et diffère de l'ordre de tabulation |
| Qu'un attribut ARIA est **présent** dans le DOM (`aria-label`, `aria-modal`, `aria-live`) | Qu'il produise **un effet audible** : une région live peut exister et n'être jamais vocalisée |
| Qu'un nom accessible existe (axe-core le vérifie) | Qu'il soit **intelligible** : « 27août » avait un nom accessible, et il était faux (finding D4) |
| Le comportement d'un clavier physique | Les gestes VoiceOver, le rotor, l'exploration au doigt, et ce que le double tap déclenche |

Conséquences pratiques, à tenir :

- ❌ **Ne jamais écrire dans ce document qu'un écran est « lisible par un lecteur d'écran »** tant
  que l'audit VoiceOver iOS n'a pas été joué. La formule autorisée est « le focus se déplace
  correctement », qui est ce qui a été observé.
- ❌ **Ne jamais compter un correctif d'annonce comme vérifié** parce qu'il est écrit. Les trois
  correctifs D4, D5 et E2 du 2026-08-27 portent sur ce qui est **prononcé** : ils n'ont jamais été
  entendus, seulement relus.
- ✅ **Le seul instrument qui mesure l'annonce est un vrai lecteur d'écran sur un vrai appareil.**
  La check-list est prête et se joue d'une traite :
  [`AUDIT-VOICEOVER-IOS.md`](./AUDIT-VOICEOVER-IOS.md).

## Note d'accessibilité : 76 → 79 → 80 → 81 → 82 → 83 → 84 → 82 → **84 / 100** (2026-08-24 → 2026-08-25 → 2026-08-27 → 2026-08-29 → 2026-09-03 → 2026-09-04 → 2026-09-14 → 2026-09-14 soir → 2026-09-15)

### 🕳️ Angles morts · ce que cet audit NE mesure PAS (2026-09-16)

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

| # | Angle mort | Vérifié le 2026-09-16 | Outillable ? |
|---|---|---|---|
| AM-1 | **axe-core ne couvre qu'une PARTIE des critères WCAG, et c'est structurel.** Les critères non automatisables (ordre de lecture, pertinence d'un libellé, sens d'une couleur) sont hors de portée de tout run vert | limite connue de l'outil, jamais écrite ici comme angle mort | non, par nature : seule une revue humaine datée le comble |
| AM-2 | **10 surfaces modales mesurées au clavier sur 53.** Les 43 autres sont **câblées et gardées par un cliquet**, ce qui n'est pas la même chose que mesurées | `e2e/a11y-keyboard-audit.spec.ts` : 19 cas, 10 surfaces. `modal-a11y.guard.test.ts` câble les 53 | oui, au prix du temps de job |
| AM-3 | **Aucun test avec un lecteur d'écran.** Ce que NVDA ou VoiceOver annonce réellement n'est vérifié nulle part | aucun outil de ce type dans le dépôt | difficilement : c'est un test manuel daté |
| AM-4 | **WCAG 2.5.5 n'est mesuré que sur 8 routes protégées** (élargi à 8 pages publiques par `C-80`, à revérifier après coup) | `e2e/touch-targets.spec.ts`, cf. l'entrée du 2026-09-14 | oui |
| AM-5 | **Le contraste n'est vérifié que dans le thème par défaut.** Le dépôt porte quatre thèmes (clair, sombre, gris, noir) ; les runs axe n'en balaient qu'un | `theme-contrast.guard.test.ts` est statique, les runs e2e ne changent pas de thème | oui |


> ### 🟢 2026-09-15 · +2 : le premier des trois angles morts de couverture est refermé (C-80)
>
> **Les deux points retirés hier portaient sur le PÉRIMÈTRE, pas sur le nombre.** C'est le
> périmètre qui bouge, donc ils reviennent, et pas un de plus : les deux autres angles morts de
> l'entrée du 2026-09-14 (aucun moteur mobile en CI, VoiceOver jamais joué) sont intacts à cette
> date.
>
> `e2e/touch-targets.spec.ts` couvre désormais **8 pages publiques** en plus de ses 8 routes
> protégées : `/`, `/entreprise-presentation`, `/guide`, `/blog` et les quatre pages cas d'usage.
> Suite **verte, 18 cas sur 18** sur Chromium, contre 15 verts / 3 rouges au premier passage de la
> boucle élargie, ce qui est la mesure qui compte : **la garde a trouvé des défauts réels le jour
> où on l'a fait regarder ailleurs.**
>
> | Défaut trouvé par l'élargissement | Avant | Après |
> |---|---|---|
> | curseur de forfait de `/entreprise-presentation` | **308 × 6 px** | **308 × 44 px**, mesuré dans WebKit / iPhone 12 |
> | CTA « Commencer » du header | 115 × 36 | ≥ 44 px de haut |
> | logo / « Retour en haut de la page » | 116 × 36 | ≥ 44 px |
> | 4 × « En savoir plus » | 121 × 20 | 44 px tactiles (`TAP_AREA_44_Y`) |
> | 3 onglets de vue + 2 boutons de périodicité | 28 et 36 px | 44 px tactiles |
> | 3 commandes DÉCORATIVES (maquettes de téléphone) | 16 × 24 et 28 × 28 | retirées de l'arbre d'accessibilité |
>
> 🔴 **Le curseur ne se corrige pas en grossissant sa piste.** C'est la HAUTEUR DE L'ÉLÉMENT qui
> monte à 44 px, fond transparent, la piste descendant dans
> `::-webkit-slider-runnable-track` / `::-moz-range-track` où elle garde ses 6 px. Une barre de
> 44 px défigurerait la section, et l'arbitrage « joli OU accessible » est celui que
> `src/components/mobile/tap-area.ts` existe pour refuser.
>
> ✅ **La réserve du 2026-09-14 sur ce curseur est LEVÉE, et dans le sens qu'elle redoutait** :
> « la zone tactile réelle d'un `input[type=range]` peut excéder sa piste selon le moteur, à
> mesurer avant de conclure ». Mesuré : elle ne l'excédait pas. WebKit / iPhone 12 rendait
> `{"w":308,"h":6}` ; il rend `{"w":308,"h":44,"appearance":"none"}`.
>
> ⚠️ **Le détecteur voit un objet de plus, donc il repart avec DEUX témoins** : un curseur natif,
> que 2.5.5 et 2.5.8 exemptent comme « contrôle du navigateur », et un curseur en
> `appearance: none`, qui ne l'est plus. Un assouplissement sans témoin est un trou qu'on ouvre en
> croyant élargir une mesure.
>
> 🔴 **Le sort des liens de pied de page est TRANCHÉ et écrit** dans l'en-tête du spec, par son
> nom (C-80), sur le modèle de la dispense `color-contrast` qui renvoie à C-23 : ils échouent au
> **AAA 2.5.5** et tiennent le **AA 2.5.8** par son exception d'espacement. Dette de confort
> assumée, portée par le périmètre du détecteur, qui ne compte aucun lien. ❌ Un lien de pied de
> page devenu BOUTON rentre dans la mesure, et la dispense ne le couvre plus.
>
> ⚠️ **Ce que ce vert ne dit toujours pas** : la boucle mesure l'ÉTAT DE REPOS. Rien de ce qui
> s'ouvre au clic sur une page publique n'est mesuré, et une seule modale du produit sur 58 l'est.


> ### 🔴 2026-09-14 (soir) · −2 : 37 cas verts, et trois angles morts de COUVERTURE derrière ce vert
>
> L'entrée du matin notait la suppression d'une modale inatteignable, sans rejouer une seule
> mesure. Ce soir, les trois suites qui portent réellement ce domaine ont tourné dans Chromium :
> `a11y-audit.spec.ts`, `a11y-keyboard-audit.spec.ts` et `touch-targets.spec.ts`,
> **37 cas, 37 passés, 8,9 min, exit 0.**
>
> | Suite | Ce qui a été mesuré |
> |---|---|
> | `a11y-audit` (axe-core) | 11 pages, publiques et démo : Landing, Login, Dashboard, Tasks, Habits, OKR, Agenda, Entreprise, Statistics, Settings, Premium |
> | `a11y-keyboard-audit` | 10 surfaces modales au clavier + le témoin Radix + le calendrier : `focusMovedIn`, `trapped`, `escClosed` **vrais partout**, flèches vérifiées case par case dans le `DatePicker` (13 → 14 → 15 → 22 décembre) |
> | `touch-targets` (WCAG 2.5.5) | 8 routes PROTÉGÉES + une modale ouverte + le témoin qui sait voir une cible trop petite : **aucune commande sous 44 × 44 px**. ⚠️ Zéro page publique, cf. l'angle mort ci-dessous, refermé le 2026-09-15 |
>
> ⚠️ **Le chiffre honnête n'est pas « 0 violation », c'est « 1 violation par page, dispensée
> nommément ».** Chacune des 11 pages remonte exactement **une** violation `color-contrast`, celle
> que **C-23** a tranché le 2026-09-13 (garder `#2563eb` à 4,31:1). La gate ne la bloque pas parce
> qu'elle est déclarée dans `SERIOUS_NOT_BLOCKING` avec sa décision, et le ratio est tenu par un
> cliquet (`src/theme-contrast.guard.test.ts`). C'est une dispense adossée à un arbitrage écrit,
> pas un zéro.
>
> 🔴 **Angle mort · la check-list VoiceOver promet « les 52 surfaces » et en oublie deux.**
> Recompté ce soir sur les APPELS du hook et non sur les fichiers qui le mentionnent :
> `grep -rn "= useModalA11y" src --include=*.tsx` rend **54** sites, dont **3** témoins dans
> `use-modal-a11y.guard.test.tsx`, soit **51 surfaces de production**. Deux d'entre elles ne
> figuraient nulle part dans l'annexe A de
> [`AUDIT-VOICEOVER-IOS.md`](./AUDIT-VOICEOVER-IOS.md) : **`MoveCategoryDialog`** (ouverte depuis
> `ColorSettingsModal`) et **`DeleteTeamCategoryConfirm`** (onglet OKR d'équipe). Les deux sont
> montées et atteignables au doigt, vérifié par leurs points de montage.
>
> **Pourquoi ce n'est pas un détail de comptage** : cette annexe est le **seul** instrument du
> dépôt qui mesure l'ANNONCE, par opposition au focus que les tests savent déjà vérifier. Deux
> surfaces absentes de la liste sont deux écrans que personne ne fera parler le jour où la
> check-list sera jouée. Elles y sont ajoutées, avec la mention « jamais auditée ».
>
> ⚠️ **L'écart n'est pas entièrement résolu** : l'annexe énumérait 52 lignes pour 51 appels, dont
> 2 manquants. Deux lignes au moins ne correspondent donc à aucun appel du hook. Ce sera tranché en
> JOUANT la check-list, pas en la recomptant.
>
> 🔴 **Angle mort · WCAG 2.5.5 n'est vérifié que derrière l'authentification.**
> `e2e/touch-targets.spec.ts` force bien un viewport de 375 × 812 (donc la mesure est mobile), mais
> sa boucle de routes est écrite en clair : `/dashboard`, `/entreprise`, `/okr`, `/tasks`,
> `/habits`, `/settings`, `/agenda`, `/statistics`. **Huit routes protégées, zéro page publique.**
>
> Mesuré ce soir contre la **production**, WebKit / iPhone 12, cookies refusés :
>
> | Page | Cibles sous 44 × 44 px | Les plus gênantes |
> |---|---|---|
> | `/` | **24** | « Commencer » du header **115 × 36**, « Cosmo » **116 × 36** |
> | `/entreprise-presentation` | **23** | curseur de forfait `input[type=range]` **308 × 6** (`appearance: none`, `height: 6px`) |
> | `/blog` | 2 | · |
>
> ⚠️ **À trier, pas à agiter** : la plupart sont des liens de pied de page d'environ 20 px de haut,
> qui échouent au **AAA** (2.5.5, 44 px) et non au **AA** (2.5.8, 24 px). Trois cas sortent du lot :
> les deux commandes du header, 8 px sous un plancher que le reste du produit respecte, et le
> curseur de forfait, stylé par l'auteur donc **hors de l'exemption « contrôle du navigateur »** de
> 2.5.8. ⚠️ La zone tactile réelle d'un curseur peut excéder sa piste selon le moteur : **à mesurer
> avant de conclure à une violation AA**, mais une piste de 6 px sur l'outil qui sert à choisir un
> abonnement est en soi un défaut d'ergonomie tactile.
>
> **Le −2 porte sur le périmètre, pas sur le nombre.** Le tableau de bord lit « cibles tactiles :
> 0 » comme une propriété du produit ; c'est une propriété de huit écrans derrière connexion. Les
> pages qui n'y sont pas sont celles qu'un visiteur voit en premier.
>
> 🔴 **Angle mort · toutes ces mesures sont faites sur Chromium de bureau, et rien ne les rejoue
> sur WebKit.** Le project Playwright `mobile-safari` (iPhone 12, moteur WebKit) porte **96 cas
> dans 19 fichiers**, dont ces trois mêmes suites, et il est **exclu de la CI**, la ligne est
> explicite dans `.github/workflows/ci.yml` : « `mobile-safari` reste hors CI (WebKit, ~1 min
> d'installation en plus) ». Conséquence directe pour ce domaine : **le piège de focus, l'ordre de
> tabulation, Échap et les cibles tactiles ne sont vérifiés automatiquement sur aucun moteur
> mobile**, alors que M-40 (l'audit VoiceOver sur iPhone réel) est justement le plafond de cette
> note, et que VoiceOver tourne sur WebKit.
>
> Ce n'est pas un défaut d'accessibilité de plus : c'est l'absence de la seule garde qui pourrait
> en détecter un. **Le coût en points est porté par [`TESTING.md`](./TESTING.md)**, là où la
> décision se prend ; il est nommé ici parce que ce domaine en est le premier bénéficiaire le jour
> où il sera comblé. ⚠️ Rejouées sur `mobile-safari` ce soir, les trois suites mobiles rendent
> **9 passés sur 18**, dont sept échecs d'attente de fixture, non de produit (détail dans
> [`MOBILE.md`](./MOBILE.md)).


> ### 🟢 2026-09-14 · +1 : un écran inatteignable qui gonflait la check-list VoiceOver est supprimé
>
> `CategoryManager` était câblée sur `useModalA11y` — donc comptée comme une des surfaces modales à
> vérifier — et montée **nulle part** : 452 lignes, trois imports dans tout le dépôt, tous pour le
> seul helper `getColorHex`. Supprimée ; ce qui survit vit dans `src/lib/category-colors.ts`.
> **53 → 52 surfaces câblées**, annexe A de `docs/AUDIT-VOICEOVER-IOS.md` recomptée en conséquence
> (46 + 6 au lieu de 46 + 7).
>
> Ce n'était pas un défaut d'accessibilité en soi — une modale inatteignable ne peut annoncer rien
> de faux à personne. Le coût était la **lecture** : quelqu'un aurait fini par chercher au doigt,
> sur un iPhone, un écran qu'aucun geste n'ouvre. +1, pas plus : ça n'a rien fermé de M-40
> (l'audit VoiceOver réel reste entier, aucune ligne de la check-list n'est cochée).

> ### 2026-09-04 · +1, un critère A qui n'était couvert nulle part
>
> **2.4.1 Contourner des blocs (A)**, jusqu'ici absent du produit : aucune page protégée n'avait de
> lien d'évitement, donc la barre latérale entière se retabulait à chaque écran, et `/agenda` y
> ajoutait onze boutons homonymes avant le premier événement. Deux liens posés, tous deux
> assertionnés sur le déplacement de `document.activeElement`. Détail et arbitrage : § « C-54
> tranché » plus bas.
>
> ⚠️ **+1 seulement, et pas davantage** : le critère est désormais satisfait sur les routes
> protégées, pas sur les pages publiques (landing, blog, guide), qui n'ont pas été touchées.
> Le « 82 » d'avant est repris de la ligne du 2026-09-03 de ce même fichier, pas d'un tableau plus
> ancien.


> ### 2026-09-03 · +1, trois défauts réels, aucun visible par axe-core
>
> | # | Critère WCAG | Ce qui était cassé |
> |---|---|---|
> | **F1** | 2.1.1 Clavier (A) | Les flèches ne déplaçaient **pas** le focus dans le calendrier. `Button` n'était pas un `forwardRef` : la source shadcn amont est écrite pour React 19, où `ref` est une prop ordinaire, le projet est sur React 18. Le `ref.current?.focus()` de `CalendarDayButton` ne faisait rien depuis toujours. Prouvé dans le navigateur : Tab atteint la grille des jours, Flèche droite passe du 30 au 31 août |
> | **F2** | 1.4.1 Utilisation de la couleur (A) | Les liens rendus par `RichText` n'étaient pas soulignés : seule la couleur les distinguait du texte |
> | **F3** | 1.4.11 Contraste du non-texte (AA) | L'icône des sélecteurs de date natifs était **noire sur fond noir** en thème sombre, à cause d'un `filter: invert(1)` devenu contre-productif depuis que `.dark` pose `color-scheme: dark`. Mesuré côte à côte dans le navigateur, sur `date`, `time` et `datetime-local`, en thèmes Sombre et Noir |
>
> **Le point vient de F1**, qui est un défaut de clavier pur, donc de la moitié de WCAG qu'un scan
> automatique ne voit pas : axe-core ne teste pas si une flèche déplace réellement le focus. Le
> défaut vivait dans le composant `Button`, c'est-à-dire partout, mais un seul appelant du dépôt
> lui passe un `ref` (vérifié) : la portée réelle est le calendrier.
>
> ⚠️ **Ce que cette passe n'a pas fait** : les scores Lighthouse a11y n'ont pas été relus après ces
> trois correctifs, aucune cible tactile n'a été recomptée, et les quatre audits jamais faits
> (agenda, modals, clavier de bout en bout, VoiceOver iOS) restent à faire. Le calendrier COSMO
> ayant remplacé le picker natif sur **six surfaces** (cf. [`UI-PATTERNS.md`](./UI-PATTERNS.md)),
> c'est désormais un composant maison qui porte la saisie de date : son parcours clavier complet
> mérite un audit dédié, il n'a été vérifié que sur le déplacement du focus.

> ### 2026-08-29 · +1, la gate Lighthouse mesure enfin, et elle bloque
>
> Le job `lighthouse` n'avait **jamais produit un rapport** depuis son ajout le 2026-08-24 : Chrome
> ne démarrait pas. Il tourne, et l'accessibilité des pages publiques est désormais mesurée à
> chaque push : `/` **93 à 97**, `/guide/` **96**, `/blog/` et `/pour-freelances/` **99**.
>
> Le seuil est **bloquant** à 0,90. Il avait d'abord été posé à 0,92, au plus près du mesuré, puis
> **redescendu le jour même** : la même page, sur le même build, donne 93 puis 97 entre deux
> passes. Un seuil à l'intérieur du bruit de mesure transforme la gate en pile ou face, et la
> première rougeur qui n'est pas une régression apprend à l'ignorer.
>
> ⚠️ **Le point n'est pas gagné sur un correctif** : aucun défaut d'accessibilité n'a été corrigé
> ces deux jours. Il est gagné parce qu'une régression franche sur les quatre pages publiques ne
> peut plus passer inaperçue. L'écart de 4 points entre deux passes reste, lui, inexpliqué.

| Ce qui compose la note | 08-24 | 08-25 | **08-27** |
|---|---|---|---|
| Violations de contraste sur `/okr` | 27 → 4 (corrigé le jour même) | **4** | 4, non remesuré |
| Thèmes non conformes AA sur `--color-text-muted` | 3 sur 4 → 0 | **0** | 0 |
| Cibles tactiles hors norme (`/tasks` · `/entreprise`) | 5 · 8 | **5 · 8** | non remesuré |
| Findings A-1 → A-11 ouverts | 1 (A-8 résiduel, arbitrage produit) | **1** | **1**, inchangé |
| Gates automatiques a11y | 1 (axe-core, `critical`) | **2** (+ Lighthouse a11y bloquant sur les pages publiques) | 2 |
| Audits jamais faits | agenda, modals, clavier, VoiceOver iOS | **inchangés** | **inchangés** |
| Défauts de nom accessible corrigés hors axe-core | · | · | **3** (D4, D5, E2, cf. §2026-08-27) |
| Libellés sous le plancher de 11 px | 79 | 79 | **75** |

### 2026-08-27 · +1, et le point est ailleurs que dans les gates

**Trois défauts corrigés, aucun n'était visible par axe-core**, ce qui est exactement le tiers de
WCAG qu'un scan automatique ne couvre pas. Ils viennent d'une relecture manuelle du mode
entreprise (commit `180fba1`) :

| # | Ce que le lecteur d'écran disait | Correctif |
|---|---|---|
| **D4** | La pastille de date de la frise se lisait **« 27août »** : deux fragments visuels collés, sans espace ni contexte d'année | Date complète en `sr-only`, fragments visuels en `aria-hidden`, plus un `<time dateTime>` lisible par la machine |
| **D5** | « Mes tâches (3)· 1 h 45 » : le `ml-2` séparait le **visuel**, pas le **nom accessible** | Séparateur porté par le texte, « (3) · 1 h 45 » |
| **E2** | La pastille de priorité n'était portée que par `title=`, **invisible au clavier et au toucher** | `role="img"` + `aria-label`, 4 fichiers |

Et une conséquence indirecte de la garde design-system (finding F1) : **quatre libellés de la
frise passent de 10 à 11 px**, le plancher lisible de l'échelle fermée. Le stock de tailles sous
11 px descend de **79 à 75**, mesuré par `src/design-system.guard.test.ts`, pas estimé.

**Pourquoi +1 et pas plus.** Les deux plafonds de la note n'ont pas bougé d'un pouce : le bouton
d'action principal est toujours à **3,34** (arbitrage d'Axel), et les **quatre audits jamais
faits** le sont toujours. Ce qui monte, c'est une classe de défaut que les gates ne verront jamais
et qu'il a fallu lire à la main.

> ⚠️ **La leçon vaut pour toute la zone entreprise** : `title=` n'est pas un nom accessible, et un
> texte découpé en fragments visuels se lit **collé**. Les deux se voient à la relecture, jamais
> dans une gate verte. La règle correspondante est ajoutée en bas de ce document.

**+3, et pas plus, parce que le gros du travail a été fait le 24, pas le 25.** Le seul apport
propre du 2026-08-25 est une **seconde** gate : jusqu'ici, aucune vérification a11y automatique ne
portait sur les pages **publiques**, celles qu'un prospect voit avant de créer un compte, et les
seules soumises à l'EAA sans réserve.

Ce qui plafonne la note tient en deux points, et aucun n'est technique :

1. **Le bouton d'action principal est à 3,34** (blanc sur le bleu de marque), sous les 4,5 requis.
   Le corriger demande d'assombrir la couleur de marque de 16 %, **arbitrage d'Axel**.
2. **Trois de ces quatre audits ont été faits le 2026-09-03** (A-3), au clavier et dans le
   navigateur : `/agenda` (FullCalendar), les modales (piège de focus, Échap, `aria-modal`) et le
   parcours clavier. **VoiceOver iOS sur un vrai appareil reste entier.** Cf. la section suivante.
   *Un scan automatique couvre environ un tiers des critères WCAG ; le reste demande un humain.*

## ✅ A-8 et A-11 tranchés le 2026-08-24 (mesurés, pas estimés)

Les deux findings « non prouvés » depuis mai traînaient parce que personne ne les avait
mesurés. Fait, dans le navigateur, mode démo, viewport 375×812.

### A-11 — `heading-order` : **caduc**

Séquence relevée sur `/okr` : `h1 → h2 → h3 → h2 → h3 → h2 → h3 → h3`.
**Aucun saut de niveau supérieur à 1.** Le finding est fermé, sans correctif.

### A-8 — contraste : **PROUVÉ, et bien plus large que « les pills OKR »**

27 violations de contraste sur `/okr`, dont 23 au ratio **3,79** — une seule et même
cause : le token `--color-text-muted`, qui porte les dates, les méta et les labels dans
toute l'application. Ce n'était pas un problème de pills.

| Thème | avant (sur surface / sur fond) | après | statut |
|---|---|---|---|
| clair | **2,56** / **2,45** | 4,74 / 4,53 | 🔴 le pire, corrigé |
| dark | 5,71 / 6,96 | inchangé | ✅ était déjà conforme |
| gris | **3,39** / **3,79** | 4,55 / 5,07 | corrigé |
| noir | **2,88** / **3,18** | 4,58 / 5,07 | corrigé |

**Trois thèmes sur quatre étaient non conformes AA.** Après correctif : 27 → **4**
violations sur `/okr`.

> ✅ **ARBITRÉ ET APPLIQUÉ le 2026-09-12 (C-25).** Axel a tranché : **assombrir la
> teinte au minimum nécessaire**, chaque thème gardant la sienne. Deux thèmes sur
> quatre étaient concernés — le `gris` à **3,34** (`#388bfd` → `#2f75d5`, **4,54**)
> et le `sombre` à **3,68** (`#3b82f6` → `#3472d8`, **4,62**) ; `clair` (5,17) et
> `noir` (17,57) étaient déjà conformes. Deux options écartées, et pourquoi :
> aligner les deux sur le bleu du thème clair revenait au `#1f6feb` jugé « trop
> terne sur graphite » quand le thème gris a été réglé ; foncer le TEXTE du bouton
> au lieu du fond faisait lire le bouton comme désactivé (vérifié à l'œil, les
> trois options rendues côte à côte dans le produit).
>
> 🔴 **Ce que cet épisode apprend, et qui dépasse le contraste** : ce 3,34 venait
> d'une mesure MANUELLE de l'audit A-8, recopiée ici, et **aucune garde ne pouvait
> le faire échouer** — `e2e/a11y-audit.spec.ts` fait tourner axe sur onze routes,
> mais axe ne scanne que **le thème par défaut**. Les trois autres thèmes n'ont
> jamais été dans un seul de ses totaux. Ce n'est pas une garde qui mesure à côté,
> c'est une zone que rien ne mesure — et un silence se prend pour un accord.
> `src/theme-contrast.guard.test.ts` ferme ce trou : il lit `src/index.css` et
> recalcule le contraste des **quatre** thèmes. Vu rouge sur l'ancienne valeur
> (3,34) avant d'être committé.
> La 3ᵉ est une pastille de catégorie dont la couleur est **choisie par l'utilisateur**
> (contraste non garantissable par construction) ; la 4ᵉ est un bouton à 3,93.

### Cibles tactiles — mesurées et corrigées le 2026-08-24

| Page | avant | après | dont sous 24×24 (minimum WCAG 2.5.8) |
|---|---|---|---|
| `/tasks` | 18 | **5** | **1** — un lien inline dans une phrase (exempté) |
| `/entreprise` | 22 | **8** | **1** — le même lien inline |

Ce qui a été fait : croix des bannières 28→44, cloche de notifications 36→44, boutons
« Masquer » 24→44, chips de filtre 40→44 sur mobile (le desktop garde sa densité),
pastille de forfait 36→44, onglets d'organisation 42→44.

> ⚠️ **Deux décisions à ne pas « corriger » plus tard.**
> 1. Les cases à cocher des listes denses sont passées à **24×24**, pas 44. Les lignes
>    font 32 px : une cible de 44 déborderait de 6 px en haut et en bas et chevaucherait
>    la ligne voisine — on cocherait la mauvaise tâche. 24×24 est le minimum WCAG 2.5.8
>    (AA) atteint sans invoquer l'exception d'espacement.
> 2. Les boutons-titres de tâche sont passés à **32 px** (hauteur de leur ligne), pas 44,
>    pour la même raison : passer à 44 aurait fait grossir chaque ligne de 37 %.
>
> 📏 **Rappel de seuil, parce qu'il est souvent confondu** : WCAG 2.1 AA n'exige PAS
> 44×44. C'est 2.5.5 (AAA). WCAG 2.2 ajoute 2.5.8 « Target Size (Minimum) » à **24×24**
> en AA. Les 44 px du projet sont une règle INTERNE (iOS HIG), plus stricte que la
> conformité. Les cibles restantes entre 24 et 44 sont donc conformes AA.

## ⌨️ A-3 · audit clavier du 2026-09-03 (mesuré, pas estimé)

Premier parcours **au clavier** de ce dépôt, souris débranchée. Harnais :
`e2e/a11y-keyboard-audit.spec.ts`, qui embarque un **témoin** — une modale Radix sur laquelle les
trois détecteurs (entrée du focus, piège, Échap) doivent répondre « conforme ». S'il échoue, aucune
mesure du fichier n'a de valeur.

**Ce qui a été corrigé** (findings C-51 et C-52 de `a-faire-code.md`) :

- Le **calendrier COSMO** ne se pilotait pas au clavier, sur ses **huit** surfaces. Ouvrir le
  calendrier posait le focus sur la rangée de presets, où les flèches ne font rien ; le mois
  affiché était le mois COURANT même quand le champ portait une autre date ; et `initialFocus`
  était une prop **morte** depuis `react-day-picker` 9. Après correctif : le focus part du jour
  sélectionné, dans le bon mois, et `→ → ↓` déplace bien de 3 déc. à 4 déc. puis 11 déc.
- Les **libellés ARIA du calendrier étaient en anglais** (« Go to the Previous Month »,
  « Today, jeudi 3 septembre 2026 ») : `react-day-picker` ne traduit que les DATES, jamais ses
  libellés. Idem pour le bouton de fermeture par défaut de `DialogContent`, nommé `Close` sur sept
  composants du produit.

**Ce qui reste ouvert**, mesuré et non corrigé :

| Constat | Où | Finding |
|---|---|---|
| ~~Aucune modale maison ne piège le focus~~ | `EventModal`, `HabitModal`, les feuilles | C-53, **corrigé le 2026-09-05**, cf. § « C-53 refermé » |
| ~~`EventModal` : le focus **reste derrière** la modale, et Échap ne ferme pas~~ | `/agenda` | C-53, **corrigé le 2026-09-05** |
| `/agenda` : **0 cellule de jour focalisable** sur 8 | FullCalendar | C-54, **tranché le 2026-09-04**, cf. section suivante |
| Trois surfaces que les sondes n'ont pas atteintes | calendrier ouvert depuis un MENU | C-55 |

⚠️ **Limites, à dire plutôt qu'à laisser croire.** Tout vient de **Chromium desktop** ; ce qui est
prouvé, c'est le déplacement du FOCUS, pas ce qu'un lecteur d'écran ANNONCE (le partage exact est
dans le § « Ce que nos mesures prouvent » en tête de ce document). Deux modales sur cinquante-huit
ont été réellement ouvertes : l'absence totale d'utilitaire de piège de focus dans le dépôt rend le
résultat généralisable, mais c'est une inférence.
⚠️ **Cette limite vaut toujours après le correctif, dans l'autre sens** : dix surfaces sont câblées
et mesurées, les quarante-huit autres ne le sont pas. « Le hook existe » ne veut pas dire « toutes
les modales piègent le focus » — ne jamais écrire la seconde phrase à la place de la première.

### C-53 refermé le 2026-09-05 · un hook porte le piège, pas 58 fichiers

`useModalA11y` (`src/hooks/use-modal-a11y.ts`) porte, pour toute surface modale maison, le piège
de focus, la restitution du focus au déclencheur, Échap et `role="dialog" aria-modal="true"`.
Aucune surface n'a été corrigée à la main, et **Radix n'a pas été généralisé**.

🔴 **L'énoncé vérifiable a changé de nature le 2026-09-08 : ce n'est plus une liste tenue à la
main, c'est un CLIQUET.** `src/components/modal-a11y.guard.test.ts` balaie `src/**/*.tsx`, retient
tout fichier qui monte une surface modale maison, et exige de chacun qu'il importe `useModalA11y`.
Les exceptions sont déclarées dans le fichier, **une par une, avec leur motif**.

**Mesuré le 2026-09-08 : 61 surfaces détectées, 53 câblées, 8 déclarées non-modales avec leur
motif.** Ces chiffres ne sont plus à recompter : la garde les recalcule à chaque exécution, et
échoue si une surface sort du compte. Une liste qu'on relit à la main est une liste qu'on oubliera
de relire — c'est exactement comme ça que ce finding est resté ouvert pendant trois passes.

⚠️ **Le « 58 » qui circulait depuis l'audit A-3 n'a jamais été remesuré, et il était faux dans les
deux sens** : le recensement cherchait `fixed inset-0` et ratait les surfaces qui ne portent qu'un
`role="dialog"`, tout en comptant des popovers qui n'en sont pas. Le message du commit `a8305a1` le
reprend encore ; le chiffre opposable est celui de la garde, pas celui-là.

⚠️ **Câblé n'est pas mesuré, et les deux ne se confondent pas.** 10 surfaces sont mesurées au
clavier dans un vrai navigateur (liste ci-dessous) ; les 43 autres sont câblées et couvertes par le
cliquet, pas par une mesure. Écrire « les 52 piègent le focus » serait exactement le glissement que
ce paragraphe existe pour empêcher.

#### Ce que la garde a trouvé que l'inventaire manuel avait raté (2026-09-08)

Elle n'a pas seulement figé l'existant, elle a corrigé le recensement :

- **6 surfaces absentes de l'inventaire manuel**, qui cherchait `fixed inset-0` alors qu'elles ne
  portaient qu'un `role="dialog"` posé à la main. Cinq se sont révélées être des **popovers ancrés**
  ou un carton de tutoriel — non modaux, déclarés comme tels avec leur motif ; piéger le focus dans
  un popover empêcherait d'en sortir en tabulant, ce qui est précisément sa façon de se fermer.
- **5 surfaces câblées gardaient un Échap écrit à la main**, en plus de celui du hook. Le
  comportement était identique, donc invisible — mais deux propriétaires pour une touche, ce sont
  deux endroits où la règle de fermeture peut diverger. C'est le défaut d'origine de `HabitModal`,
  réapparu en cinq exemplaires. La garde le refuse désormais.
- L'une d'elles, `BulkAddToListModal`, portait une fermeture **à étages** : Échap annule d'abord le
  sous-formulaire de création, et ne ferme la modale qu'au second appui. Déplacer la touche sans
  déplacer l'escalade aurait fait perdre une saisie en cours, **sans que rien ne le signale**.
- Le détecteur lisait aussi les **commentaires** : un fichier `.ts` était signalé parce qu'un
  commentaire y décrit un overlay. Le JSX vit dans les `.tsx`, s'y restreindre supprime la classe
  entière de faux positifs.

🔎 **Témoins.** La garde compte les surfaces détectées et refuse de passer sous 40 : sans ça, casser
le détecteur rendrait le fichier **vert**. Et elle a été vue échouer, en retirant le hook de
`WeeklyCheckinModal` : elle nomme le fichier fautif.

#### Trois règles que le câblage des 43 a dégagées

- ❌ **Le chemin de fermeture n'est pas toujours `onClose`.** C'est `onCancel`, `onSnooze`,
  `closeAfter`, `onOpenChange(false)`, ou un `setState`. Échap doit emprunter **exactement** le
  chemin du voile et de la croix, jamais un raccourci.
- ❌ **Une surface qui refuse de fermer pendant une opération refuse aussi Échap.**
  `ReassignManagerSheet`, `TeamTaskModal` et `BugReportModal` gardent leur fermeture derrière un
  `pending` / `sending` : sans la même garde sur la touche, Échap ferait ce qu'aucun clic ne peut
  faire — abandonner un réattachement en cours, ou perdre une saisie sans savoir si le mail est
  parti.
- ❌ **Un hook ne se pose jamais après un `return` anticipé.** Sept fichiers ont un état de
  chargement ou un `if (!open) return null` avant leur surface. Le codemod refusait ces cas, et
  ESLint a rattrapé les deux fois où j'ai passé outre : `react-hooks/rules-of-hooks` avait raison.

#### Les 10 surfaces mesurées au clavier

**Les 9 mesurées dans un vrai navigateur** (`e2e/a11y-keyboard-audit.spec.ts`, Chromium,
14 tests verts le 2026-09-08). Cinq détecteurs sauf mention : `focusMovedIn` · `trapped` ·
`escClosed` · `role="dialog"` · `aria-modal="true"`.

| Surface | Chemin mesuré | En plus des cinq détecteurs |
|---|---|---|
| `HabitModal` | `/habits`, bouton de création | — |
| `EventModal` | `/agenda`, bouton « Nouveau » | Échap passe par `guardedClose` |
| `MobileMoreSheet` | « Plus d'options », viewport 375 × 812 | — |
| `ConfirmDiscardDialog` | Échap sur un `EventModal` modifié | prend le piège au parent, le lui rend |
| `ColorSettingsModal` | `EventModal` → « Créer une catégorie » | prend le piège au parent, le lui rend |
| `RecurrenceDaysModal` | `EventModal` → récurrence « Personnaliser » | prend le piège au parent, le lui rend |
| `TaskActionsSheet` | `/tasks` mobile, « Afficher les actions » | — |
| `MobileAddToList` | `TaskActionsSheet` → « Ajouter à une liste » | relais de surface, pas empilement |
| `ShareListSheet` | `/tasks` desktop, liste **manuelle** créée puis survolée | — |

**La 10ᵉ, `BottomSheet`, est mesurée en jsdom, et il faut dire pourquoi.** Aucun geste utilisateur
ne l'ouvre : son unique consommateur produit est `WeeklyRecapSheet`, monté derrière
`WEEKLY_RECAP_ENABLED = false` (`src/pages/HabitsPage.tsx`). Un test de navigateur devrait activer
du code mort pour l'atteindre. Le composant réel est donc monté dans
`src/components/mobile/mobile-primitives.test.tsx`, sur `focusMovedIn`, `trapped`, `escClosed` et
`aria-modal` — les mêmes détecteurs, un environnement plus faible : jsdom ne calcule aucune
géométrie et ne simule aucune tabulation native.
⚠️ **Le jour où ce drapeau repasse à `true`, cette couverture ne suffit plus** : il faudra une ligne
dans le harnais clavier.

**Ce que les mesures ont appris sur le produit, en passant :**

- Le jeu de démo ne contient **que des listes intelligentes**, et « Partager » n'est monté que pour
  `list.type !== 'smart'`. La garde `ShareListSheet` crée donc sa liste manuelle : sans ça elle
  n'aurait jamais trouvé son déclencheur et aurait **expiré**. Un timeout n'est pas un résultat.
- `AddToListModal` aiguille sur `useIsMobile()` : au-dessus du point de rupture il rend
  `DesktopAddToList`, qui **n'est pas câblée**. Mesurer sur desktop aurait parlé d'un autre
  composant que celui que la garde nomme.
- `TaskActionsSheet` appartient à la carte mobile : au-dessus du point de rupture, le bouton
  « Actions pour … » existe encore mais n'ouvre pas cette surface.
- L'URL passe à `/tasks` **avant** que le chunk lazy ait remplacé le tableau de bord. Trois sondes
  successives ont mesuré le dashboard en croyant lire la page Tâches : les gardes attendent
  désormais un élément DE la page, jamais un délai.

Les lignes correspondantes de `e2e/a11y-keyboard-audit.spec.ts` sont passées de `console.log` à
`expect` : un rapport que personne ne lit est une archive, pas une garde.

#### Ce que la passe du 2026-09-08 a ajouté, et pourquoi

`EventModal` était la dernière des trois surfaces principales à ne pas être câblée, et c'est celle
qui portait le seul cas que le câblage pouvait casser : ses **trois modales frères**. Deux gardes
ont donc été écrites, et chacune a été **vue échouer** avant d'être retenue.

- **Échap passe par `guardedClose`.** Le mode d'échec visé est silencieux : un Échap branché sur
  `onClose` au lieu de `guardedClose` ferme proprement, sans erreur, et jette une saisie que le
  même geste à la souris aurait protégée. La garde ouvre un événement existant, modifie le titre,
  presse Échap, et exige que la confirmation d'abandon s'affiche, que `EventModal` reste montée et
  que la saisie soit intacte — puis qu'elle le soit encore après avoir refusé l'abandon.
  🔎 **Témoin** : en remplaçant `onClose: guardedClose` par `onClose` dans `EventModal.tsx`, la
  garde vire au rouge sur « Échap ne passe pas par guardedClose : la saisie est perdue ».
- **Le piège se déplace, dans les DEUX sens.** À l'ouverture d'un frère le focus entre chez lui et
  y reste ; à sa fermeture, `EventModal` le rattrape. Ne vérifier que l'aller laisserait passer une
  modale parente définitivement inerte derrière son enfant refermé — un écran qu'on voit et où le
  clavier ne fait plus rien.
  🔎 **Témoin** : en neutralisant `isTopmost` (la fonction rend `true` quel que soit l'appelant),
  Échap traverse et ferme les **deux** surfaces d'un coup ; la garde échoue sur « fermer la modale
  enfant ne doit pas fermer le parent ».
- ⚠️ **Les surfaces sont désignées par leur NOM ACCESSIBLE**, jamais par
  `div.fixed.inset-0 … .last()`. Avec deux overlays empilés, « le dernier » désigne tantôt le
  parent, tantôt l'enfant : l'assertion changerait de cible en cours de test sans jamais échouer.
  Ce choix fait au passage de `aria-label` une chose testée, pas seulement posée.
- ⚠️ **Un rôle EXPLICITE écrase le rôle implicite.** La puce « Personnaliser » de la récurrence est
  un `<button role="radio">` : cherchée comme un bouton, elle est introuvable, et le test **expire**
  au lieu d'échouer sur ce qu'il mesure. Un timeout n'est pas un résultat.

- 🔴 **Un gestionnaire de modale ne peut pas dépendre de l'endroit où se trouve le focus.**
  `HabitModal` avait déjà un Échap : un `onKeyDown` React posé sur l'overlay, donc suspendu à la
  remontée d'un évènement depuis l'élément focalisé. Focus sorti, Échap mort — c'est-à-dire
  inopérant exactement dans le cas qu'il existait pour rattraper. L'écouteur vit désormais sur
  `document`, en **capture**, ce qui le protège aussi des champs qui appellent `stopPropagation`
  sur leurs touches (les champs de date natifs le font).
- 🔴 **Une pile, parce que les modales s'empilent réellement.** `EventModal` rend
  `ConfirmDiscardDialog`, `ColorSettingsModal` et `RecurrenceDaysModal` en **frères** de son
  overlay, pas dedans : sans pile, le piège du parent leur reprendrait le focus. Seule la dernière
  surface empilée réagit à Échap et au Tab.
- ❌ **`aria-modal` n'est pas décoratif ici.** Il manquait partout, y compris sur le témoin Radix —
  acceptable pour Radix, qui neutralise les frères par `aria-hidden`, et pas pour une modale
  maison, qui ne fait ni l'un ni l'autre.
- ⚠️ **`focusReturned` est mesuré et imprimé, jamais assertionné** : le témoin Radix lui-même le
  rend `false`. Un détecteur que la bibliothèque de référence ne passe pas mesure le détecteur,
  pas la modale.
- ⚠️ **Le hook existe, 52 surfaces y passent, et un cliquet le tient** (2026-09-08, **recompté le
  2026-09-14** : 53 → 52, `CategoryManager` étant supprimée — elle était câblée et montée nulle
  part). 🔴 **Compter ces surfaces par un `grep` sur le NOM du hook donne un faux chiffre** : il
  attrape les commentaires qui le citent, et c'est arrivé ici même le 09-14 (53 fichiers annoncés,
  dont un qui ne fait que le mentionner). Le compte opposable est celui des fichiers qui
  **importent** `@/hooks/use-modal-a11y` — **50** — et des surfaces qu'ils montent, certains en
  portant plusieurs. Ce n'était
  pas le cas pendant les trois premières passes : le câblage s'est fait par vagues, et la liste des
  surfaces restantes vivait dans un fichier Markdown. Elle vit maintenant dans un test. **Câblé
  n'est toujours pas mesuré** : 10 surfaces sont mesurées au clavier, 43 sont câblées et gardées.

### C-54 tranché le 2026-09-04 · le bouton « Nouveau » EST le chemin clavier de l'agenda

**Décision rendue, pas différée.** Les cellules de jour de FullCalendar restent hors du parcours de
tabulation, et le motif grille ARIA n'est **pas** adopté. Créer un événement au clavier passe par le
bouton « Nouveau », qui ouvre la saisie pré-remplie sur le prochain créneau libre. Ce qui a été
corrigé dans la même passe, c'est le coût du trajet : deux liens d'évitement, qui manquaient.

**Pourquoi ce sens.** Adopter le motif grille n'est pas un réglage, c'est un composant : gérer
`tabindex` roving sur 7 colonnes × N créneaux, câbler les huit flèches, `Home` / `Fin` / `PagePrec` /
`PageSuiv`, annoncer la cellule active, et refaire le tout à chaque changement de vue (jour, semaine,
mois) et à chaque zoom, les cinq crans de `slotDuration` compris. Le geste équivalent existe déjà,
il est atteignable, et il ouvre un formulaire où le jour et l'heure se saisissent explicitement.
L'écart réel entre les deux chemins est un confort, pas un accès.

**Ce qui a changé** (`src/components/SkipLink.tsx`) :

- un lien d'évitement **global**, premier arrêt de tabulation de `Layout`, qui pose le focus sur le
  `<main>` et saute la barre latérale entière : logo, thème, recherche, dix entrées de navigation,
  état de synchronisation, signalement de bug ;
- un **second** lien, propre à `/agenda`, qui saute le panneau des tâches, ses filtres et ses onze
  boutons « Options de la tâche » tous nommés pareil. Il n'est monté que lorsque ce panneau est
  ouvert, et sur desktop seulement : sur mobile le panneau est un calque, il ne s'interpose pas dans
  l'ordre de tabulation quand il est fermé.

**Mesuré après correctif** (2026-09-04, Chromium desktop, jeu de démo, `e2e/a11y-keyboard-audit.spec.ts`) :

| Trajet | Tabulations |
|---|---|
| Haut de page → `<main>` | 1, puis Entrée |
| `<main>` → conteneur du calendrier | 1, puis Entrée |
| Conteneur du calendrier → premier événement | 1 |
| Bouton « Nouveau » → modale de saisie | ~~4~~ → **0** (remesuré le 2026-09-08) |
| Bouton « Nouveau » → premier champ d'heure | ~~7~~ → **3** (remesuré le 2026-09-08) |

⚠️ **Le « 38 tabulations » du 2026-09-03 était compté trop bas.** La marche partait de
`body.press('Tab')` alors que le focus se trouvait encore sur le lien « Agenda » de la barre
latérale, cliqué par la fixture : Chromium garde ce lien comme point de départ de la navigation
séquentielle, et la mesure repartait donc du MILIEU de la navigation. Le chiffre sous-estimait le
trajet réel depuis le haut de page. Un `blur()` ne corrige rien, le point de départ lui survit :
les mesures ci-dessus repartent d'un **rechargement**.

**Ce que la décision NE règle pas, et qu'il ne faut pas laisser croire réglé :**

- ✅ **RÉGLÉ DEPUIS, et ce paragraphe disait le contraire.** Il affirmait que le focus n'entre pas
  dans la modale de saisie et qu'Échap ne la ferme pas — vrai le 2026-09-04, faux depuis que
  `EventModal` est câblée sur `useModalA11y`. Remesuré le 2026-09-08 : le focus **entre** à
  l'ouverture, Échap **ferme** (via `guardedClose`), et le trajet jusqu'au premier champ d'heure
  tombe de 7 tabulations à **3**, toutes DANS la modale. Les deux lignes du tableau ci-dessus
  portent leur ancienne valeur barrée : un « avant » se relit à sa source, il ne se recopie pas.
- Une `<table>` de FullCalendar porte `role="grid"` sans aucun descendant focalisable géré, donc
  annonce un motif d'interaction qu'elle n'implémente pas. Le rôle vient de la bibliothèque, sur un
  arbre qu'elle re-rend à chaque changement de vue : le réécrire demanderait de repasser derrière
  chaque rendu. **Arbitrage assumé, pas oubli** : on ne patche pas le rôle, on ne prétend pas non
  plus que le motif grille est implémenté. Si un audit lecteur d'écran montre que l'annonce
  « tableau de N lignes » égare réellement, la réponse sera d'adopter le motif, pas de maquiller le
  rôle.
- Rien de tout ceci n'a été entendu dans un lecteur d'écran. Ce qui est prouvé, c'est le déplacement
  du FOCUS (cf. le § « Ce que nos mesures prouvent » en tête de ce document).

**Gardes** : deux tests assertionnés dans `e2e/a11y-keyboard-audit.spec.ts`, **vus rouges avant
d'être verts** (la première assertion tombait sur « OKR », ce qui a précisément révélé le biais de
mesure ci-dessus). Le premier vérifie que
chaque lien d'évitement **déplace `document.activeElement`** vers sa cible, jamais qu'il fait
défiler : un lien dont la cible a perdu son `tabIndex={-1}` fait défiler sans déplacer le focus,
c'est le mode d'échec silencieux du lien d'évitement. Le second remonte l'ordre de tabulation depuis
le calendrier jusqu'au bouton « Nouveau », l'active à la touche Entrée, et redescend jusqu'à un champ
d'heure : c'est la décision elle-même qui est gardée, pas seulement le lien.

### Gate axe-core · le chiffre qui manquait

Dix routes scannées le 2026-09-03 : **zéro `critical`**, et **trois** violations `serious`
distinctes une fois dédoublonnées, toutes de contraste, portées par **deux tokens** —
`--color-error` (`#ef4444`, 3,76:1 sur blanc) et `--color-accent-solid` (`#2563eb`, 4,31:1 sur son
fond teinté), toutes dans le bandeau d'échéances. Passer la gate à `serious` est donc **bon marché
mais pas gratuit** : `red-600` (`#dc2626`, 4,83:1) suffit pour les deux premières, la troisième est
le même arbitrage que le bleu de marque.

> ⚠️ **Cette mesure a été DÉPASSÉE deux fois, et ce paragraphe est conservé pour l'historique du
> chiffrage, pas comme état courant.** La gate est passée à `serious` le **2026-09-04**,
> `--color-error` est à `red-600` depuis, et le troisième cas a été tranché le **2026-09-13** :
> cf. « C-23 — pourquoi le bleu du thème clair reste à 4,31:1 » ci-dessous, qui fait foi. Le
> « trois violations distinctes » ci-dessus vient par ailleurs d'un rapport tronqué à trois
> échantillons — le rapport ne tronque plus.

### C-23 — pourquoi le bleu du thème clair reste à 4,31:1 (décidé le 2026-09-13)

**C'est une décision, pas un oubli, et c'est ici qu'elle se lit.** La dispense `color-contrast` de
`e2e/a11y-audit.spec.ts` renvoie nommément à cette section, et le cliquet qui la tient est
`src/theme-contrast.guard.test.ts` § « C-23 ».

**Ce qui est mesuré.** Trois passes de `e2e/a11y-audit.spec.ts` sur le même commit rendent des
totaux `color-contrast` différents — 21, 41 puis 55 nœuds le 2026-09-12, 18 le 2026-09-13. Le total
n'est **pas** reproductible : axe photographie chaque route à un instant, et ces pages entrent en
fondu. Les ratios de ces couples-là s'étalent **de 1,02 à 4,44** selon l'instant où l'opacité est
photographiée, et le même élément y apparaît sous des couleurs différentes d'une passe à l'autre
(`#2563eb` devient `#2573eb`, `#487cee`, `#729af1`…). ⚠️ C'est ce qui a fait croire à une famille
« blanc sur le **dégradé** du bouton principal, 3,49 à 4,48 », longtemps citée comme distincte :
c'est le même bleu, photographié plus tôt. ❌ **Ne jamais citer un total de ce rapport comme un
état** : c'est un tirage.

Reproductible dans toutes les passes, une seule paire :

| Paire | Nœuds | Ratio mesuré | Ce que c'est |
|---|---|---|---|
| `#2563eb` sur `#e3ebfa` | **9** | **4,31:1** (AA en demande 4,5) | le lien « Créez un compte » du bandeau de mode démo |

🔴 **Les 9 nœuds sont UN SEUL composant**, `DemoConversionBanner`, rendu sur les 9 routes protégées.
Le rapport les compte par route, ce qui fait lire « neuf endroits » là où il n'y en a qu'un. Et il
est peint par **`--color-accent-solid`**, sur un fond fait du **même token à 10 %** posé sur
`--color-background` — pas par `--color-accent`. Les deux valent la même chose en thème clair, mais
la distinction change le périmètre de la décision : **les liens et l'anneau de focus, qui sont
`--color-accent`, ne sont flaggés nulle part** (le lien sur blanc vaut 5,17:1). Le backlog a écrit
pendant plusieurs jours que corriger « demanderait de foncer la couleur des liens et du focus » :
c'était faux, et c'est ce que la mesure a corrigé.

**Les options ont été rendues côte à côte dans le produit** le 2026-09-13 — `/dashboard` en mode
démo, thème clair, tokens surchargés sur le vrai bandeau — puis mesurées dans le navigateur, pas
calculées :

| Option | Teinte | Ratio sur la teinte | Ce que ça déplace ailleurs |
|---|---|---|---|
| **retenue** | `#2563eb` inchangé | 4,31 | rien |
| T1 | `#1d4ed8` sur ce seul texte | 5,59 | rien (token dédié « accent sur fond teinté ») |
| T2 | `#1d4ed8` sur les deux tokens | 5,50 | liens, focus, boutons pleins, chips |
| T3 | `#1e40af` sur les deux tokens | 7,05 | idem, bleu nettement plus profond |

**Décision d'Axel : on garde `#2563eb`.** Le bleu est l'identité visuelle du produit, et aucune des
trois variantes ne l'a emporté à l'œil sur un écart de 0,19 point de ratio.

**Où c'est acceptable, et où ça ne le serait pas.** L'écart porte sur **un lien secondaire d'un
bandeau informatif de mode démo** : le texte qu'il accompagne (`--color-text-secondary` et
`--color-text-primary`) est conforme, le lien est **souligné** — donc il ne dépend pas de la
couleur pour être identifié comme lien (WCAG 1.4.1) — il fait 14 px semi-gras, et le même geste
(« créer un compte ») est atteignable depuis l'écran de connexion, où il est conforme. Aucune
information, aucune action et aucun message d'erreur ne repose sur cet écart.

❌ **Ce raisonnement ne se transporte nulle part ailleurs.** Il ne couvre PAS un libellé de bouton,
un message d'erreur, un texte porteur d'information, ni une couleur sémantique — `--color-error`
est justement passé à `red-600` (4,83:1) pour cette raison, et ce n'était pas un arbitrage de
marque. Une nouvelle paire sous 4,5:1 est une régression, pas un précédent.

⚠️ **Deux réserves qui valent pour tous les chiffres de cette section**, et qu'il ne faut jamais
omettre en les citant :

1. **axe ne scanne que l'ÉTAT INITIAL de chaque route.** Aucune modale, aucun menu, aucun
   calendrier ouvert n'entre dans ces totaux.
2. **axe ne scanne que le THÈME PAR DÉFAUT.** C'est ce qui a laissé le bouton principal à 3,34:1
   pendant dix-neuf jours sans qu'aucun run ne puisse le dire. `src/theme-contrast.guard.test.ts`
   couvre désormais les quatre thèmes, mais **seulement** pour le couple `--color-accent-solid` /
   son texte, plus ce cliquet-ci.

**Ce que la décision engage.** La dispense `color-contrast` reste en place — c'est la seule règle
`serious` non bloquante — et elle ne tombera pas. En échange, le cliquet de
`src/theme-contrast.guard.test.ts` refuse que la paire descende **sous 4,31:1** : « on garde » est
défendable à 4,31, il ne l'est plus à 3,2, et sans cliquet une dérive passerait sous silence
puisque le seul outil qui la voit est précisément celui qu'on a dispensé. ❌ **Ne jamais baisser ce
plancher.** Toute amélioration doit le faire monter ; au-delà de 4,5 il devient un vrai seuil AA et
la dispense tombe.

## Findings résiduels de l'audit du 2026-05-29

L'audit d'origine listait A-1 → A-11. Vérifié dans le code le **2026-08-14** :

| ID | Sujet | État réel |
|---|---|---|
| A-1 → A-6 | Critical (aria-label, labels, `<main>`, `<th>` vides…) | ✅ Corrigés — codifiés en règles ci-dessous |
| A-7 | `text-blue-100` sur `bg-blue-600` (4.23:1) | ✅ Corrigé — plus aucune occurrence dans `src/` |
| A-8 | Pills OKR `text-*-600 / bg-*-100` sous 4.5:1 | ✅ **Tranché le 2026-08-24** : la cause n'était pas les pills mais le token `--color-text-muted` ; 27 → 4 violations. Résiduel : le bleu de marque à 3,34 (arbitrage produit, cf. plus haut) |
| A-9 | `page-has-heading-one` (h1 animé en `opacity:0`) | ✅ Caduc — plus aucun `motion.h1` dans `src/pages/` |
| A-10 | `CookieBanner` hors landmark | ✅ Corrigé — `motion.aside` + `aria-label` |
| A-11 | `heading-order` OKR (`h3` après `h1`) | ✅ **Caduc, mesuré le 2026-08-24** · aucun saut de niveau > 1 sur `/okr` |

**Il ne reste donc aucun finding « non prouvé » : les deux qui traînaient depuis mai ont été
mesurés, pas estimés.** C'est la leçon de méthode de cette série : un finding qu'on n'a jamais
mesuré n'est ni vrai ni faux, il est **inutilisable** : A-8 s'est révélé cinq fois plus large que
son intitulé, A-11 purement caduc, et les deux avaient survécu trois mois côte à côte.

**Cibles tactiles, corrigées le 2026-08-24, remesurées le 2026-08-25** : `/tasks` 18 → **5**,
`/entreprise` 22 → **8**. Les restantes sont soit des liens inline dans une phrase (exemptés), soit
des cibles de 24 à 32 px **conformes AA** (WCAG 2.5.8 exige 24×24, pas 44, cf. le rappel de seuil
plus haut). Détail : [`UI-PATTERNS.md`](./UI-PATTERNS.md) §Dette UI/UX ouverte.

Reste ouvert par ailleurs : **VoiceOver iOS sur un vrai appareil**, le seul des quatre audits que
le 2026-09-03 n'a pas passé — il ne se simule pas. Les trois autres (`/agenda`, modales, parcours
clavier) sont couverts par la section « A-3 » ci-dessus, avec leurs findings ouverts.
**Sa check-list est prête depuis le 2026-09-04** et se joue d'une traite, témoin compris :
[`AUDIT-VOICEOVER-IOS.md`](./AUDIT-VOICEOVER-IOS.md). Ce qui manque n'est plus le protocole, c'est
l'appareil et l'heure.
Durcissement : **fait le 2026-09-04**. La gate casse la CI sur tout `serious` sauf les règles
nommées dans `SERIOUS_NOT_BLOCKING`, où il n'en reste qu'une, `color-contrast`, désormais motivée et
définitive (section C-23 ci-dessus). Ce n'était pas « gratuit », comme cette page l'a écrit du
2026-08-24 au 2026-09-03 sans jamais compter les violations concernées : ça a coûté un token
(`--color-error` → `red-600`) et un arbitrage rendu.

## Règles

- ✅ **Touch targets ≥ 44×44 px** (WCAG 2.5.5) — `min-w-11 min-h-11` ou wrapper l'icône.
- ✅ **`aria-label` obligatoire** sur tout `<button>` qui ne contient qu'une icône — `title=` est ignoré par les lecteurs d'écran sur mobile. Ajouter `aria-hidden="true"` sur l'icône lucide enfant. (Faille A-1.)
- ✅ **`<input>` doit avoir un label associé** : `<label htmlFor>` + `id`, `aria-label`, ou `aria-labelledby`. Sur formulaires dynamiques — `aria-label={"Avancement de <X> sur <Y>"}`. (Faille A-2.)
- ✅ **Checkbox custom** stylé en `<button>` : `role="checkbox"` + `aria-checked={state}` + `aria-label` dynamique. Exemples : TodayTasks, HabitTable DayButtons.
- ✅ **`focus-visible:`** sur tous les boutons custom — navigation clavier (iPad + clavier physique).
- ✅ **`aria-pressed`** sur les toggles (favoris, terminées, sélections).
- ✅ **`<main>` landmark obligatoire** sur toute page racine (LandingPage, LoginPage, SignupPage…). Layout protégé contient déjà `<main>`. (Faille A-5 — sans `<main>`, axe flag jusqu'à 162 nodes "not contained by landmarks".)
- ✅ **`<th>` vides** (colonnes d'icônes) : ajouter `<span className="sr-only">Label</span>`. (Faille A-6.)
- ✅ **Liens dans un paragraphe** : `underline underline-offset-2` toujours visible — pas seulement `hover:underline` (WCAG 1.4.1).
- ✅ **Contraste texte ≥ 4.5:1** sur fond clair (3:1 pour large 18pt+ / 14pt bold). `text-green-600` (3.29:1) → `text-green-700` (4.78:1). `text-blue-100` sur bleu 600 (4.23:1) → `text-white`. Vérifier via axe-core.
- ✅ Préférer `<button>` à `<div onClick>`.
- ❌ **Pas de changement de contenu sans annonce** — `role="status"` ou `aria-live="polite"`.
- ❌ **Pas de couleur seule pour transmettre l'information** — toujours doubler avec une icône, du texte, ou un état.
- ❌ **Pas de `motion.h1 initial={{opacity:0}}`** sans aussi laisser un h1 statique présent — axe flag `page-has-heading-one`.
- ✅ **Un texte découpé en fragments visuels doit avoir un nom accessible ENTIER** (2026-08-27, D4/D5) : mettre la phrase complète en `sr-only`, passer les fragments en `aria-hidden`, et pour une date ajouter un `<time dateTime>`. Sans ça, « 27 » + « août » empilés se lisent « 27août », et un espacement obtenu par `ml-2` n'existe pas pour un lecteur d'écran.
- ✅ **Une prop d'accessibilité recopiée d'un exemple se vérifie CONTRE LA VERSION INSTALLéE**
  (2026-09-03, C-51). `initialFocus` de `react-day-picker` survit dans les types, marqué déprécié,
  et n'est plus lu par personne : la prop était écrite, le focus n'allait nulle part. Même classe
  que le `Button` non `forwardRef` du 2026-08-30. **Une prop qui ne fait rien ne prévient pas.**
- ✅ **Une bibliothèque traduit ses DATES, pas ses libellés ARIA** (2026-09-03, C-52). Passer
  `locale` à `react-day-picker` laisse « Go to the Previous Month » intact. Ces chaînes vivent dans
  `node_modules` : `i18n:scan` ne peut pas les voir, et ne le pourra jamais.
- ✅ **Tout bloc répété avant le contenu se saute** (2026-09-04, C-54, WCAG 2.4.1). Un lien
  d'évitement se pose avec `SkipLink`, et sa cible porte `tabIndex={-1}` : sans lui, `href="#x"`
  fait DÉFILER sans déplacer le focus, et la garde paraît verte pendant que le clavier reste
  coincé. Un second lien se justifie quand une page interpose son propre bloc, comme le panneau
  des tâches de `/agenda` et ses onze boutons homonymes.
- ✅ **Une pastille purement visuelle qui porte une information est `role="img"` + `aria-label`** (2026-08-27, E2). `title=` seul ne se voit ni au clavier ni au toucher, et ne remplace pas un nom accessible.

## Ne jamais faire — Accessibilité

- ❌ Créer un `<button>` icon-only sans `aria-label` (A-1, critical).
- ❌ Créer un `<input>` sans label associé (A-2, critical).
- ❌ Page racine publique sans `<main>` landmark (A-5).
- ❌ `<th>` vide pour une colonne d'icône — ajouter `<span className="sr-only">Label</span>` (A-6).
- ❌ Lien dans un paragraphe distingué uniquement par couleur (A-4 / WCAG 1.4.1).
- ❌ `text-green-600`, `text-blue-100` sur fond clair sans vérifier le contraste 4.5:1.
- ❌ Faire annoncer une checkbox custom comme « bouton » — utiliser `role="checkbox" aria-checked`.
- ❌ Annoncer un motif d'interaction qu'on n'implémente pas (`role="grid"` sans descendant
  focalisable géré, `role="dialog"` sans piège de focus). Un rôle est une PROMESSE de clavier.

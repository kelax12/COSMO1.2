> ⚠️ **ARCHIVE : journal des notes UI / UX et angles morts (2026-07-23 → 2026-11-06), extrait de `docs/UI-PATTERNS.md` le 2026-11-08, non maintenu.**
> Chaque passage décrit l'état **à sa date**, y compris ses listes « ce qui reste » : une bonne part a été faite depuis.
> État courant : [`docs/UI-PATTERNS.md`](../UI-PATTERNS.md). Les notes /100 ont cessé (ADR 0012) : l'état de santé se lit dans [`docs/INDICATEURS.md`](../INDICATEURS.md).
> Les liens relatifs et les ancres de ce passage sont ceux de son document d'origine : certains ne résolvent plus.

## Note UI / UX : 70 → 80 → 82 → 84 → 87 → 85 → 81 → 83 → 86 → 85 → 86 → 84 → 86 → 86 → 85 → 85 → 86 → 87 → **86 / 100** (2026-08-24 → 2026-08-25 → 2026-08-27 → 2026-08-29 → 2026-09-03 → 2026-09-14 soir → 2026-09-16 → 2026-09-22 soir → 2026-10-01 → 2026-10-02 soir → 2026-10-03 → 2026-10-15 → 2026-10-16 → 2026-10-18 → 2026-10-20 → 2026-10-22 → 2026-10-22 (passe) → 2026-10-25 → **2026-11-06**)

> ### 🟠 2026-11-06 · −1 : `Visual` rouge huit jours, quatorze références régénérées d'un geste
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Mesures du 2026-11-06 : CI de `main` du 2026-10-26 au 2026-11-06 (75 runs, dernier `e2e` complet vert à `ba169ba1`), workflows planifiés relus run par run, production (advisors par l'API, catalogue, Edge Functions), alertes GitHub, dépôt à `c3294936` puis `d938bc6e`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-11-06 |
> |---|---|---|
> | 🔴 `Visual` rouge du 2026-10-29 à 11:47 (`b89b0789`) au 2026-11-06 à 11:30 | **−1** | rouge sur chaque push pendant huit jours. Dans la même fenêtre : nav à libellés derrière un œil, OKR allégé, deux vagues d'interface entreprise, thème Noir, parcours de facturation (lots 1 à 3), étape « Combien serez-vous ? ». Aucune comparaison visuelle n'a protégé ces écrans. Remis au vert par `bd093937` (14 références régénérées par le workflow, `C-95`, les quatre thèmes de `/dashboard` et `/tasks`). ⚠️ Aucune revue des différences n'est tracée : le vert dit que les références sont celles d'aujourd'hui, pas qu'elles sont justes |
> | Parcours de facturation | 0 | activation bornée, impayé, résiliation en frise, historique en pastilles : couverts par des tests de logique pure, **pas** par `Visual` (aucune capture d'onglet Abonnement) |
>
> **87 → 86.**

> ### 🟢 2026-10-22 (passe) · +1 : l'Aperçu en widgets a enfin sa référence visuelle
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Mesures du 2026-10-22 : CI de `main` à `d16de29a` (run `39843255180`, cinq jobs verts ; `main` rouge du 10-20 à 22:03 au 10-22 à 14:39, 19 runs), `Visual` vert à `fb83cd60`, production (advisors par l'API, catalogue, ledger, cron, Edge Functions, sondes HTTP), dépôt à `HEAD`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-22 |
> |---|---|---|
> | ✅ `Visual` rouge, refonte de l'Aperçu passée sans référence (−1 le 10-20) | **+1** | références régénérées sous l'horloge figée (`29bd862d`), puis pour les widgets perso et entreprise (PR n° 101, `ed52715a`) ; l'état ERREUR capture le bloc seul (`5d47e5e8`). `Visual` vert à `d16de29a` et `fb83cd60` |
> | ⚠️ `publique-home` instable | 0 | rouge une fois, à `f019249f` : « Failed to take two consecutive stable screenshots », 6 000 à 19 000 pixels qui bougent d'une capture à l'autre. L'accueil n'est pas figé avant la capture. Une occurrence, non débitée |
> | Produit | 0 | widgets du tableau de bord perso (même système que l'Aperçu), bouton « Modifier les widgets », menu d'objectif OKR ; la home peint une copie de la landing au lieu du texte SEO brut, défaut signalé huit fois par Axel |
>
> **85 → 86.**

> ### ⚪ 2026-10-22 · 0 : `AssignRoleDialog` remesuré, la garde vue mordre
>
> Le −1 du 2026-10-15 est remboursé depuis le 2026-10-16 ; ce jour le vérifie au lieu de le reprendre.
> Mesures du 2026-10-22, dépôt à `HEAD` (branche de la PR).
>
> | Item | Avant | Après |
> |---|---|---|
> | `loading-empty-state` (C-40) sur `AssignRoleDialog` | vert : `isLoading` des deux lectures (`roles`, `assignments`) lu, squelette `aria-busy` tant que l'une manque (`origin/main` à `5eaa8b8c`) | inchangé ; **vu rouge** sur la version fautive remise exprès (`data: roles = []` sans `isLoading`) : la garde nomme `AssignRoleDialog.tsx → roles`. Vert sur la vraie |
> | Squelette observé | jamais regardé par un parcours | le cas clavier attend la fin d'`aria-busy` avant de mesurer, sur `chromium` et `mobile-safari`. ⚠️ En démo, la lecture répond tout de suite : le squelette n'a pas été vu à l'œil |
>
> **85 → 85.**

> ### 🟠 2026-10-20 · −1 : la refonte de l'Aperçu passée sans référence visuelle
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Mesures du 2026-10-20 : CI de `main` à `86ea357f` (run `39408311331` : `lint-test-build` et `e2e` rouges, trois jobs verts ; **29 runs rouges de suite** depuis `a9db6f2c`), `Visual` rouge, production (advisors par l'API, catalogue, ledger, Edge Functions, sondes HTTP), dépôt à `HEAD`. Tableau de bord : [`README.md`](README.md).
>
> | Item | Effet | Mesuré le 2026-10-20 |
> |---|---|---|
> | 🔴 `Visual` rouge depuis `a9db6f2c` | **−1** | six captures : `/dashboard` dans les quatre thèmes (contenu daté, voir [`TESTING.md`](../TESTING.md)), `/entreprise` Aperçu (refonte attendue, référence à régénérer), **l'état ERREUR de la frontière d'erreur** (identifié le 2026-10-22 : référence périmée, pas une régression. Le bloc d'erreur était identique au pixel près, run `39668102924` ; l'écart venait du tableau de bord sur lequel il était capturé. Le cas capture désormais le bloc seul). La refonte d'écran la plus large depuis septembre (Aperçu en widgets, modèles par rôle, « Ajouter un widget ») est donc arrivée sans aucune comparaison visuelle |
> | Produit | 0 | Aperçu en grille de widgets éditable (S/M/L, modèles membre, chef d'équipe, admin) ; éditeur de rôle en modale centrée ; invitation une adresse à la fois ; boussole du guide en mode perso ; rapport d'activité refondu puis **rétabli** (`45b2d7fd`), export PDF conservé. Crédité quand `Visual` le verra |
>
> **86 → 85.**

> ### ⚪ 2026-10-18 · 0 : vérifiée inchangée
>
> Dernière passe avant l'acquisition. Mesures du 2026-10-18 : CI de `main` à `e69cb729` (run `39139204925`, cinq jobs verts) et à `15d40bea` (`lint-test-build` vert, run `39156293593`), production (advisors par l'API, catalogue, cron, Edge Functions, sondes HTTP), dépôt à `HEAD`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-18 |
> |---|---|---|
> | `Visual` | 0 | vert sur `e69cb729`, `8b253a1b` et `5f8ecbdb` |
> | ✅ `8b253a1b` · l'État choisi dans le tableau disparaissait au bout de 2 s | 0 | vu et corrigé le même jour, jamais débité : `TASK_LIST_COLUMNS` ne relisait pas `status` ni `health` |
> | `5f8ecbdb`, `a82c28f8` | 0 | compte retiré, pastille de filtre au bout de la rangée Favoris. `a82c28f8` est arrivé pendant la passe : non mesuré |
>
> **86 → 86.**

> ### 🟢 2026-10-16 · +2 : `Visual` compare de nouveau, et le dialogue des rôles attend sa réponse
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Mesures du
> 2026-10-16 : CI de `main` à `a4878cab`, dépôt à `HEAD`. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-16 |
> |---|---|---|
> | ✅ `Visual` rouge depuis le 2026-10-12 (−1) | **+1** | les quatre cas tranchés (`477e2fc8`, `22a00936`) ; vert **en comparaison** deux fois de suite (`38730049045`, `38731274622` : 18 références, 20 cas, production de références sautée), et vert à `HEAD` |
> | ✅ `AssignRoleDialog` affirmait l'absence de rôles avant la réponse (−1) | **+1** | `loading-empty-state.guard` vert en CI et en local |
> | Page entreprise avec barre oblique | 0 | elle sert l'accueil perso : débité dans [`SEO.md`](../SEO.md), une seule fois |
>
> **84 → 86.**

> ### 🟠 2026-10-15 · −2 : `Visual` rouge trois jours, et un dialogue qui affirme avant de savoir
>
> **Même règle** : un angle mort ne se rembourse que sur un verdict rendu en CI, un défaut que
> lorsqu'il est corrigé et vérifié. Mesures de la nuit du 14 au 15 : CI de `main` à `6847bbf3`,
> dépôt à `HEAD` rejoué étape par étape. Tableau de bord : [`README.md`](../README.md).
>
> | Item | Effet | Mesuré le 2026-10-15 |
> |---|---|---|
> | 🔴 `Visual` rouge depuis le 2026-10-12 | **−1** | dernier vert : `9f6595b5` (10-11). À `HEAD` (run `38476034115`) : **4 cas sur 20**, `/entreprise · Aperçu` (la surface remboursée le 10-03), `/`, `/guide`, `/blog`, trois tentatives chacun. Depuis le dernier vert, l'Aperçu et les pages publiques ont changé plusieurs fois (avatars en couleur, « Valider / Renvoyer » sur la ligne de la tâche, captures et images OG) : rien ne dit lesquelles des quatre différences sont voulues. **Une garde rouge trois jours ne compare plus rien**, elle sonne |
> | 🔴 `AssignRoleDialog` affirme l'absence de rôles avant la réponse | **−1** | `loading-empty-state.guard` (C-40) rouge en local à `HEAD` : lecture « à l'aveugle » de `roles`, l'état vide s'affiche pendant le chargement (`a6562733`) |
> | Guide entreprise (30 scénarios, 10-12 et 10-13) | 0 | livré avec ses ancrages `data-guide-id` et la garde de ses scénarios ; son e2e est rouge (cf. [`TESTING.md`](../TESTING.md)) |
>
> **86 → 84.**
>
> 🔎 **2026-10-15 (jour) · les quatre rouges de `Visual` tranchés** (artefacts du run `38650837007`) :
> · `/entreprise · Aperçu` : **voulu**. Trois changements, écart identique sur trois essais (9 330 px) :
> « Valider / Renvoyer » sur la ligne de la tâche (`8df06f57`), badge Ctrl K retiré (`fd4adabf`),
> bouton flottant du guide (`c651ba18`). Référence régénérée.
> · `/`, `/guide`, `/blog` : **défaut de la GARDE**, puis changement voulu. Le spec posait
> `cosmo_cookie_consent = 'rejected'`, valeur que le produit ne connaît pas (`'refused'`) : le
> bandeau cookies n'a jamais été neutralisé, et les trois références le contenaient depuis leur
> création. L'allongement de son texte par l'audit juridique (`79c0f0b3`) les a rendues rouges ;
> `/guide` porte en plus le guide remis à jour (`a0dc4990`). Valeur corrigée et témoin à deux sens
> posé (bandeau vu, puis absent), `477e2fc8` ; références régénérées par `visual.yml`
> (run `38728499545`, deux passes, `22a00936`). Aucune tolérance touchée. **Comparaison verte**
> sur `main` : run `38730049045` (`6f6ec984`), 20 cas, étape « Comparer aux références ».

> ### 🟢 2026-10-03 · +1 : l'Aperçu de `/entreprise` sous `Visual`
>
> **Même règle** : un défaut ne se rembourse que corrigé **et vu vert en CI**. Verdict : run `CI`
> `37109937640` sur `c7fb936c`, **les cinq jobs verts**, le premier `CI` entièrement vert sur `main`
> depuis le 2026-09-23 (`869fb05a`). Correctifs : `d8b1584b`, `16fbaae9`, `ac1e8c40`, `59aa4fd8`,
> `315804df` (autres sessions) et `d8c215ad`, `290d6f51`, `c7fb936c` (celle-ci).
>
> | Item | Effet | Mesuré le 2026-10-03 |
> |---|---|---|
> | ✅ Aucun écran `/entreprise` sous `Visual` (−1 le 10-02) | **+1** | `entreprise-apercu-light` ajouté (`c7fb936c`) ; référence produite par `visual.yml` (run `37135216156`), **deux passes vertes**, la seconde comparant à la première, committée (`cd80c2b`). Une première tentative (`37109961426`) avait refusé de committer : `/settings` en thème gris différait d'une passe à l'autre, instabilité de la garde, pas de l'Aperçu |
> | Références publiques réécrites | 0 | `publique-home`, `-guide`, `-blog` réencodées par la régénération, écarts sous la tolérance (0,2 % de pixels) |
>
> **85 → 86.** ⚠️ Le thème gris est instable deux jours de suite (`/dashboard` le 10-02, `/settings` le 10-03) : à diagnostiquer avant qu'il ne désarme la garde.

> ### 🟠 2026-10-02 (soir) · −1 : la surface la plus retouchée n'est comparée par rien
>
> **Même règle que le 2026-09-22** : un angle mort ne se rembourse que sur un verdict rendu en CI, un
> défaut que lorsqu'il est corrigé et vérifié. Mesures du soir : CI de `main` à `9ea33927` (dernier
> `e2e` complet : `f301f0bf`, run `37019682064`), production (advisors par l'API, catalogue, ledger),
> dépôt à `HEAD`.
>
> | Item | Effet | Mesuré le 2026-10-02 (soir) |
> |---|---|---|
> | `Visual` | 0 | **vert** à `9ea33927` : 18 cas, `/dashboard` en thème gris instable au premier essai. Il compare `/dashboard`, `/tasks`, `/settings` dans les quatre thèmes, les états vide et erreur, `/`, `/guide`, `/blog` |
> | 🔴 Angle mort nommé : **aucun écran `/entreprise` sous `Visual`** | **−1** | le 2026-10-02, **37** fichiers de `src/components/organization` ont changé (Aperçu refait, organigramme, onglet Projets, rapport d'activité, dates de début retirées) et aucune capture ne les a comparés. La seule régression vue sur ces écrans l'a été par un test fonctionnel (cibles tactiles de l'Aperçu, cf. [`ACCESSIBILITY.md`](../ACCESSIBILITY.md)). Barème du 09-16 : angle mort réel, partiellement couvert. Il complète AM-1, dont la portée était déclarée (« 3 routes ») mais jamais comptée |
> | AM-4, AM-5 | 0 | toujours ouverts, déjà payés |
>
> **86 → 85.** Le point revient quand l'Aperçu de `/entreprise` entre dans `visual-regression.spec.ts`
> et qu'un run `Visual` l'a comparé.

> ### 🟢 2026-10-01 · +3
>
> **Même règle que le 2026-09-22** : un angle mort ne se rembourse que sur un verdict rendu en CI, un
> défaut que lorsqu'il est corrigé et vérifié. Mesures du jour : CI de `main` (`43fed445` à
> `7cd73d24`), production (catalogue, advisors), dépôt à `HEAD`.
>
> | Item | Effet | Mesuré le 2026-10-01 |
> |---|---|---|
> | AM-1 · garde de régression visuelle | **+2** | `Visual` a **comparé** : rouge le 2026-09-30 sur une vraie régression, vert le 10-01 après correction, références régénérées par le chemin prévu (`bde05f5c`, deux passes vertes) |
> | AM-2 · les quatre thèmes | **+1** | balayés dans chaque run, et le témoin « fonds différents » rendu fiable (il lisait la couleur pendant la transition CSS) |
> | `/settings` : « Accéder » hors de la carte et de l'écran | 0 | vraie régression trouvée par `Visual` (bouton « Abonnement et factures »), corrigée le 10-01 (`OrganizationSettingsCard`), vérifiée dans le navigateur |
> | Bruit de la garde | 0 | `/dashboard` (prochain événement selon l'HEURE du run) et `/tasks` (échéances relatives) masqués ; toasts retirés des captures |
>
> **83 → 86.** Détail : [tableau de bord](../README.md).

> ### 🟢 2026-09-22 (soir) · +2 : remesure item par item, contre la CI réelle et la production
>
> **Règle appliquée**, déclarée au [tableau de bord](../README.md) : un angle mort payé le 2026-09-16
> n'est remboursé que si sa garde a rendu **au moins un verdict exploitable en CI** (vert, ou
> rouge sur un vrai défaut). Une garde posée mais jamais jouée, ou cassée, ne rembourse rien.
> Un défaut nommé ce soir coûte selon le barème du 09-16.
>
> | Item | Effet | Mesuré le 2026-09-22 |
> |---|---|---|
> | `C-77` (−2 le 09-14 soir, série OKR plate) | **+2** | fermé et vérifié par sa sortie : `okrTime = 480` pour un compte réel |
> | AM-1 à AM-3 · régression visuelle, thèmes, états | **0** | 🔴 **non remboursés** : `Visual` a tourné **19 fois, échoué 19 fois**, et n'a **jamais produit une seule référence**. Le project `visual` dépend de `mobile-safari-warmup`, et `visual.yml` n'installe que Chromium (`Executable doesn't exist ... webkit`). → `C-115` |
> | AM-4, AM-5 | **0** | toujours ouverts, aucun item |
>
> **81 → 83.** Détail, règle et ordre de réparation : [tableau de bord](../README.md).

> ### 🟠 2026-09-16 · -4 : la note comptait ce qui était mesuré, jamais ce qui ne l'était pas
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
> | AM-1 · **aucune garde de régression VISUELLE en CI** | −2 | rien ne voit un écran qui se déforme tant qu'aucun test fonctionnel ne casse |
> | AM-2 · les quatre thèmes ne sont balayés par aucun run | −1 | c'est la classe de bug du 2026-07-23, 17 fichiers |
> | AM-5 · aucune mesure d'usage réel des écrans | −1 | un écran soigné que personne n'atteint pèse autant qu'un écran négligé très vu |
> | AM-3 et AM-4 | 0 | gardés statiquement, ou partiellement couverts |
>
> 🔴 **Une note baisse UNE FOIS, quand l'angle mort est nommé ; elle remonte quand il est
> outillé.** Sans cette règle, nommer un angle mort deviendrait punitif, et la passe du
> 2026-09-16 serait la dernière à en chercher. Un angle mort reconduit sans être comblé ne
> re-coûte rien : il est **déjà payé**.
>
> ⚠️ Un transversal (T-1 à T-10 du [tableau de bord](../README.md)) est compté dans **chaque** audit
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
> note ne bouge, alors qu'il est cité **13 fois** dans [`ARCHITECTURE.md`](../ARCHITECTURE.md), dont **9**
> dans la seule colonne « Où il est écrit » du tableau des invariants, et **jamais** dans ce
> qui est mesuré. Il était le mètre,
> jamais l'objet.
>
> Ces lignes entrent donc **dans ce qui est mesuré**. La prochaine passe les traite comme les
> invariants ci-dessus : chacune est soit comblée, soit reconduite avec sa date.

| # | Angle mort · **énoncé du 2026-09-16, non réécrit** | Vérifié le 2026-09-16 | 🔎 État au 2026-09-21 |
|---|---|---|---|
| AM-1 | 🔴 **Aucune garde de régression VISUELLE en CI.** C'est l'angle mort le plus large de ce document : rien ne voit un écran qui se déforme tant qu'aucun test fonctionnel ne casse | aucun workflow ne contient `visual-audit`, `percy`, `chromatic` ni comparaison de captures. `scripts/visual-audit*.mjs` existe et n'est lancé qu'à la main | ✅ **OUTILLÉ le 2026-09-20** · `e2e/visual-regression.spec.ts` · 4 thèmes × 3 routes + états vide et erreur + 3 pages publiques, project `visual` et `visual.yml` (`C-95`) — 🔴 ne prouve PAS : 🔴 **la première référence fige l'écran DÉFAUTS COMPRIS.** Elle ne dit pas qu'il est juste : elle dit qu'on saura qu'il a changé · 🔎 🔴 **2026-09-22 : `Visual` n'a JAMAIS produit une référence**, 19 runs, 19 échecs : le project `visual` dépend de la chauffe WebKit, et `visual.yml` n'installe que Chromium. → `C-115` · 🔎 🟠 **2026-09-24 : second défaut trouvé et corrigé.** Depuis le correctif du 09-23, `Visual` est VERT, mais à vide : 19 captures écrites à chaque run, aucune committée (`git diff --quiet` ne voit pas les fichiers non suivis). Corrigé par `git status` ; un bootstrap qui n'a rien à committer échoue désormais. ✅ Le premier run avec correctif (`35967753986`) a **committé 17 références** (`cae20b00`) ; la première comparaison est au run suivant |
| AM-2 | **Les quatre thèmes ne sont balayés par aucun run.** Clair, sombre, gris et noir : les parcours e2e n'en jouent qu'un. C'est pourtant la classe de bug du 2026-07-23 (17 fichiers aux couleurs codées en dur) | aucun cas e2e ne change de thème | ✅ **OUTILLÉ le 2026-09-20** · `visual.yml`, qui **produit et commite** ses références au premier run (`C-95`) — 🔴 ne prouve PAS : idem AM-1 · 🔎 🔴 **2026-09-22 : idem AM-1, jamais joué avec succès** · 🔎 🟠 **2026-09-24 : idem AM-1**, vert à vide jusqu'ici, correctif poussé |
| AM-3 | **Les états VIDES, de chargement et d'ERREUR ne sont vus qu'au hasard des parcours.** `loading-empty-state.guard.test.ts` vérifie leur présence statiquement, jamais leur rendu | garde statique | ✅ **OUTILLÉ le 2026-09-20** · états **vide** et **erreur** capturés, pas seulement l'état nominal (`C-95`) — 🔴 ne prouve PAS : idem AM-1 · 🔎 🔴 **2026-09-22 : idem AM-1, jamais joué avec succès** · 🔎 🟠 **2026-09-24 : idem AM-1**, vert à vide jusqu'ici, correctif poussé |
| AM-4 | **La cohérence entre la landing et le produit n'était gardée que sur les PRIX et les NOMS de paliers.** Le reste (promesses, limites chiffrées, durées) divergeait sans alerte | `org-tiers.parity.test.ts`, `org-tier-labels.ts`, `check:stripe-prices` (prix et noms seulement) | 🟢 **FERMÉ LE 2026-10-24 pour les promesses et les chiffres** : manifeste `src/pages/landing/__test__/landing-promises.manifest.ts` (chaque promesse : où elle est écrite, où le code la tient, quels chiffres elle autorise) et garde `landing-promises.guard.test.ts` (catalogues fr/en, SEO, cas d'usage, prérendu ; échoue si un extrait change, si une preuve disparaît, si un chiffre est écrit sans promesse ou diffère entre fr et en). Vue rouge sur 4 sabotages. **Quatre promesses sont FAUSSES aujourd'hui** (démo 100/100/150/8, fréquence d'habitude, treize droits, démo entreprise de six personnes) : listées dans le manifeste avec leur constat, cliquet qui casse dès qu'elles changent. 🟠 **Reste ouvert** : le texte n'est pas corrigé (décision d'Axel) ; les articles de blog et les captures du hero (`scripts/landing-hero/`) ne sont pas balayés ; le vocabulaire et les captures ne sont pas comparés au produit |
| AM-5 | **Aucune mesure d'usage réel.** Le document note des écrans sans jamais savoir lesquels sont ouverts : un écran soigné que personne n'atteint et un écran négligé très fréquenté pèsent pareil | la mesure d'audience porte sur les pages publiques, pas les écrans protégés | 🟠 **TOUJOURS OUVERT** au 2026-09-21 · **aucun item ne le porte**, et c'est délibéré : mesurer l'usage réel demande de l'analytique produit, que ce dépôt n'a pas voulue. Un écran soigné que personne n'atteint pèse toujours autant qu'un écran négligé très fréquenté — *(jugé outillable le 09-16 : partiellement)* |


> ### 🔴 2026-09-14 (soir) · −2 : un écran du produit affiche un zéro qui n'est pas vrai
>
> **Sur `/statistics`, la série « OKR » du graphique « temps investi » est plate à zéro pour tous
> les comptes réels, en production.** Ce n'est pas une impression : `okrTime` alimente cette série
> (`DashboardBarChart.tsx`, `okrs: r.okrTime`, vert `#22c55e`), il vient de la RPC
> `get_work_time_stats`, et cette fonction, **relue en base ce soir** par `pg_get_functiondef`, lit
> toujours un champ JSON que rien n'écrit (`kr.elem->'history'`). Mécanique complète et preuve dans
> [`PERFORMANCE.md`](../PERFORMANCE.md) § « okrTime ».
>
> 🔴 **Le mode démo, lui, affiche le bon chiffre depuis le 2026-09-02.** Le correctif de cette date
> n'a touché que le calcul client (`workTimeCalculator.ts`), pas la RPC. La vitrine que voit un
> visiteur est donc juste, et l'écran que voit un inscrit est faux. **Pour un audit d'interface,
> c'est le pire des deux sens possibles** : le défaut est invisible de la seule surface qu'on
> regarde en démonstration.
>
> **Pourquoi c'est compté ici et pas seulement en performance** : un écran qui affiche « 0 » là où
> il y a du travail ne dit pas « je ne sais pas », il dit « tu n'as rien fait ». Une donnée fausse
> présentée comme sûre est un défaut d'interface avant d'être un défaut de SQL, et aucune des
> onze notes ne le portait.
>
> ### 🟢 Et M-44 est tranché : l'argument du retrait est faux, pas discutable
>
> `a-faire-manuel.md` pose M-44 comme indécidable par un agent : « ce sont deux lectures du
> produit, pas deux états du code ». **Ce n'en est pas une** : le changement non commité retire la
> pastille « Aujourd'hui » du report rapide avec ce motif, écrit en commentaire dans le fichier :
>
> > « Reporter une tâche en retard à AUJOURD'HUI n'a pas de sens (elle est déjà due aujourd'hui ou
> > avant) »
>
> et la moitié qui porte l'argument est **fausse**. `isOverdue` (`src/lib/deadline.ts`) rend vrai
> si et seulement si `daysUntilDeadline < 0`, **strictement avant aujourd'hui** ; `isDueToday` est
> la fonction voisine, pour `=== 0`. Une tâche qui affiche ces raccourcis n'est donc **jamais** due
> aujourd'hui, et « la reporter à aujourd'hui » est exactement le geste le plus courant : *je m'en
> occupe aujourd'hui.*
>
> S'y ajoute l'intention du composant, écrite dans son propre en-tête (maquette 16, « Le retard
> porte sa solution ») : sortir la tâche du rouge **en un geste**. Après le retrait, les deux
> options restantes sont « Demain » et « Choisir » : la première laisse la tâche en retard pour
> toute la journée en cours, la seconde coûte deux gestes de plus. Le raccourci qui remplissait
> l'objectif du composant est précisément celui qu'on enlève.
>
> ✅ **Conclusion : C-72 avait raison, le produit est juste, la pastille reste.** Ce qui restait à
> arbitrer n'était pas un goût mais un fait, et le fait est vérifiable en trois lignes de
> `deadline.ts`. ⚠️ **Le fichier n'a PAS été modifié par cette session** : il appartient à l'arbre
> de travail d'une autre, et indexer le fichier d'une autre session est la faute qui a produit
> trois `fix(build)` les 09-13 et 09-14. Ce qui est livré ici, c'est l'élément qui rend la décision
> possible ; le geste de revert reste à qui tient cet arbre.
>
> ⚠️ **Ce qui n'a PAS été remesuré ce soir** : aucune passe visuelle (`scripts/visual-audit.mjs`
> non exécuté), aucune revue de pattern écran par écran. Le −2 porte sur un défaut trouvé en base,
> pas sur une dégradation des patterns eux-mêmes.


> ### ⚪ 2026-09-14 · non remesurée — et un changement PENDING mérite d'être nommé ici aussi
>
> Aucune revue de pattern n'a été rejouée aujourd'hui (pas de passe visuelle, `scripts/visual-audit.mjs`
> non exécuté). La note reste celle du 09-03.
>
> ⚠️ **Un fichier non commité d'une autre session change un pattern d'interaction sans que
> personne ne l'ait arbitré** : `OverdueQuickActions.tsx` retire le bouton de report rapide
> « Aujourd'hui » du menu de retard, en tension directe avec la conclusion de C-72
> (« le produit est juste ») documentée dans `a-faire-code.md`. Tant qu'il n'est pas commité, il
> n'existe ni comme un gain ni comme une régression pour ce document. Décision suivie :
> `a-faire-manuel.md` **M-44**.

> ### 2026-09-03 · +3, et deux des trois défauts avaient été introduits par leur propre correctif
>
> **Le calendrier COSMO remplace le picker natif partout où il était visible**, six surfaces :
> échéance de tâche d'équipe, date de « Planifier dans l'agenda », les deux champs des popups de
> dépendances, et les deux entrées de menu qui ouvraient le picker par `showPicker()` (report en
> masse des tâches en retard, deadline de la barre de sélection). Ces deux dernières n'avaient
> aucun champ où s'ancrer, d'où l'extraction de `DateCalendarPanel` : un seul corps de calendrier,
> deux façons de l'ouvrir. `minDate` reprend l'attribut `min` de l'ancien input natif, sans quoi on
> pouvait reporter une tâche en retard **vers hier**.
>
> ⚪ **Deux `input[type=date]` natifs restent, et c'est voulu** : ceux d'`EventModalForm`, mobiles.
> La roue système vaut mieux que n'importe quel calendrier maison sur un téléphone.
>
> **Les flèches ne déplaçaient pas le focus dans le calendrier, et l'avertissement le disait.**
> « Function components cannot be given refs » n'était pas du bruit : la source shadcn amont est
> écrite pour React 19, où `ref` est une prop ordinaire ; le projet est sur React 18, où elle ne
> l'est pas. Le `ref.current?.focus()` de `CalendarDayButton` ne faisait donc **rien**. Prouvé dans
> le navigateur après correctif : Tab atteint la grille, Flèche droite déplace le focus du 30 au
> 31 août.
>
> **L'icône noire des sélecteurs natifs venait de la règle censée la corriger.** `index.css`
> appliquait `filter: invert(1)` en thème sombre, écrite avant que `.dark` pose `color-scheme:
> dark`. Depuis, le navigateur dessine déjà l'icône en clair, et l'inversion la repeignait en
> **noir sur fond noir**. Mesuré côte à côte dans le navigateur avant de toucher au code, puis
> vérifié sur `date`, `time` et `datetime-local` en thèmes Sombre **et** Noir. La règle est
> supprimée, pas remplacée, et un garde-fou interdit sa réintroduction.
>
> **Un premier écran qui demande au lieu de faire à la place.** `FirstRunSetup` remplace
> `OnboardingExampleTasks`, qui créait trois tâches d'exemple **sans aucun écran** et **en français
> écrit en dur**. Mesure de prod du 2026-08-28, sur 28 comptes : 36 % n'ont jamais rien créé, 50 %
> ne sont jamais revenus après leur session d'inscription. Chaque étape crée **au moment où elle est
> validée**, jamais à la fin, et l'écran est monté dans `Layout` et non sur une route, parce qu'une
> inscription par Google ne repasse pas par `SignupPage`.
>
> Dans le même mouvement, seize points de revue de `src/components` : une seule confirmation de
> suppression au lieu de deux, un échec de sauvegarde qui s'annonce au lieu d'être avalé, les
> requêtes de `ColorSettingsModal` qui ne partent plus que modale ouverte, et `RichText` qui
> souligne ses liens, annonce un schéma refusé au lieu de le taire, et arrive **avec ses tests**,
> lui qui n'en avait aucun alors qu'il porte une allowlist anti-XSS.
>
> 🔴 **Ce qui plafonne à 87, et c'est un constat sur la méthode** : deux défauts de cette fenêtre
> ont été trouvés **en regardant, pas en lisant**. Les quatre liens vers les pages contractuelles
> rendaient une 404 en anglais, et le compteur d'étapes de l'onboarding affichait son gabarit,
> « Étape {current} sur {total} ». Aucune gate ne pouvait les voir. Et la liste de findings du
> 2026-08-14 (tableau ci-dessous) **n'a pas été remesurée** depuis le 08-27.

> ### 2026-08-29 · +2, deux P1 de la critique du 2026-08-27 fermés
>
> **Une seule grammaire de filtre.** Les onglets « Tâches » et « Projets » partageaient déjà la
> donnée, le type et le helper : ce qui divergeait tenait à un seul geste, le clic sur une pastille
> **déjà active**. Projets la désactivait et revenait à « Tout », Tâches ne faisait rien. Même
> écran, même objet, deux réponses au même geste. La pastille « Tout » est **conservée** : elle
> reste la seule affordance visible pour revenir à l'ensemble. On ajoute un geste, on n'en retire
> aucun.
>
> **Sept onglets atteignables sur 375 px** (détail dans [`MOBILE.md`](../MOBILE.md)).
>
> **Un onglet resté ouvert cesse d'exécuter un bundle périmé.** 91,5 % du trafic Supabase du
> 2026-08-26 venait de deux onglets exécutant un vieux build. La bannière propose, elle ne recharge
> jamais d'autorité : un onglet ouvert contient souvent une saisie en cours. Vérifié en production.
>
> ⚪ **Un finding clos sans changement** : la répétition entre la frise « Prochains événements » et
> la liste au-dessus est assumée, arbitrage rendu. Une frise intitulée « de l'entreprise » qui
> omettrait certaines échéances deviendrait fausse.

| Finding de l'audit du 2026-08-14 | 08-24 | 08-25 | **08-27** |
|---|---|---|---|
| 1. Quatre tailles de titre de page | ✅ ramenées à deux | ✅ **+ 6 pages migrées** | ✅ |
| 2. Titres de tâches tronqués (12 sur `/tasks`) | ❌ ouvert | ✅ **12 → 2** (`line-clamp-2`) | ✅ |
| 3. Tableau Habitudes, colonne coupée | ❌ ouvert | ✅ **0 colonne coupée**, 375 px et 1 280 px | ✅ |
| 4. Échelle z-index incomplète | ✅ publiée + fermée par test | ✅ | ✅ |
| 5. Résidus de l'audit précédent | ✅ traités | ✅ | ✅ |
| 6. Cibles tactiles sous 44 px | ❌ 18 · 22 | ✅ **5 · 8**, les restantes conformes AA | non remesuré |
| 7. Écrans qui affichent un état vide pendant le chargement | ❌ 3 onglets entreprise | ❌ | ✅ **0**, squelettes + test |
| 8. Barre de navigation qui se réordonne après la réponse réseau | ❌ | ❌ | ✅ **corrigée** (F3) |
| 9. Clic qui emporte le visiteur hors de la landing sans prévenir | ❌ 2 chemins | ❌ | ✅ **0** |

### 2026-08-27 · +2, sur une classe de défaut que la liste de 2026-08-14 ne voyait pas

**Trois findings nouveaux, tous de la même famille : l'interface affirmait quelque chose qu'elle
ne savait pas encore, ou faisait quelque chose que personne n'avait demandé.** Ils n'étaient pas
dans l'audit d'origine parce que celui-ci mesurait de la **géométrie**, et que ces trois-là ne se
voient que **dans le temps** : pendant un chargement, pendant une réponse réseau, après un clic.

**7 · Trois écrans annonçaient des zéros faux** (commit `1d98f93`). `MyWorkTab`, `TeamTasksTab` et
`TeamOverviewTab` déstructuraient `const { data = [] }` sans jamais lire `isLoading` : pendant le
premier fetch ils rendaient leur état **vide** comme une vérité. « Aucune tâche pour l'instant »
sur l'Aperçu, « Créez d'abord un projet » à une organisation qui en a douze, et un tableau de bord
annonçant **0 tâche / 0 %** à un manager avant d'afficher ses vrais chiffres.

- *Un zéro faux coûte plus cher qu'une attente : c'est l'image dont on se souvient.*
- La garde est posée **au bon niveau** : sur Statistiques le sélecteur de période reste utilisable,
  seuls les chiffres attendent. Le compteur « x sur y affichées » attend aussi, « 0 sur 0 » étant
  une affirmation.
- Squelettes en gris neutre (`--color-hover`) et **non** `bg-accent`, qui vaut un bleu vif dans
  3 thèmes sur 4.
- Verrouillé par `org-loading-states.test.tsx` (4 cas), lui-même vérifié en neutralisant le garde
  de l'Aperçu, il tombe bien au rouge.

**8 · La navigation se réordonnait après coup** (commit `f32d080`). L'entrée « Entreprise » était
montée sur `{myOrg && …}` : la barre latérale se peignait sans elle, puis la faisait apparaître,
et tout ce qui suit, « Créer / rejoindre », la section AUTRE, les Paramètres, sautait d'une ligne
à chaque chargement de page. Le correctif réserve la place à partir d'un indice d'affichage
persisté (`wasOrgMember`). ⚠️ Le gain **n'est pas mesuré en CLS**, cf.
[`MOBILE.md`](../MOBILE.md) §2026-08-27 : la preuve est dans les tests d'état transitoire.

**9 · Deux clics emportaient le visiteur hors de la landing.** Depuis le menu d'une carte membre
de la pyramide entreprise, « Voir ses tâches » ouvrait **directement** la démo (commit `c21754d`,
remplacé par une proposition explicite), et la confirmation qui a suivi était un toast
*dismissible*, donc contournable : elle devient une `AlertDialog` modale qui bloque l'interaction
tant que le visiteur n'a pas choisi (commit `722aba1`). **Règle qui en sort : un changement de
contexte irréversible se confirme dans un dialogue bloquant, jamais dans un toast.**

**Aperçu entreprise, refonte assumée en quatre commits** (`e6a873a` → `4b91816`) : la liste
« Prochaines échéances » devient une **frise chronologique** dont l'abscisse porte le temps, donc
un paquet d'échéances collées se voit ; « Mes échéances » disparaît, elle relistait en texte des
dates déjà portées par la carte de synthèse juste au-dessus ; « Mon agenda » prend sa demi-colonne
et se **groupe par jour**, en date locale comme les habitudes et les échéances. Sous `sm`, la
frise bascule en rail vertical, six libellés côte à côte sur 375 px se chevauchant quoi qu'on
fasse. Aucune position ne dépend d'une animation, `prefers-reduced-motion` ne change rien au
rendu.

**Pourquoi +2 et pas +5.** La relecture indépendante de la zone entreprise donne
**19 → 22 → 24 / 40** sur les dix heuristiques de Nielsen en trois passages le 2026-08-27, donc
une **majorité de critères encore sous la moyenne**. Quatre findings restent ouverts, et aucun
n'est cosmétique :

- 🟠 **P1 · deux grammaires de filtre pour la même donnée** entre les onglets « Tâches » et
  « Projets ». Ouvert depuis le premier passage, non traité.
- 🟠 **P1 · 4 destinations sur 7 hors écran** dans la barre d'onglets de `/entreprise` (335 px de
  barre pour 832 px de contenu, `hide-scrollbar`, aucun indice de continuation). La moitié
  mobile du problème est réglée, `/entreprise` n'étant plus dans « Plus » ; la barre d'onglets
  **interne**, elle, n'a pas bougé.
- 🟡 **P2 · la frise entreprise répète les tâches qui me sont assignées** (`buildOrgEvents`
  n'exclut pas `currentUserId`).
- 🟡 **P2 · deux compteurs de notifications affichent 4 et 3 sous la même étiquette.**
- ⚪️ **Aucun état d'erreur éprouvé** dans la zone : les squelettes traitent l'attente, pas l'échec.

**+10.** Les **six** findings de l'audit du 2026-08-14 sont refermés. C'est le seul document du
dossier dont la liste d'origine est entièrement traitée.

**Pourquoi 80 et pas 95.** Un audit qui referme tous ses findings ne prouve qu'une chose : que
*ces* findings étaient les bons. Or celui-ci porte, de son propre aveu, sur ce qui est
**mesurable**, géométrie, troncatures, tailles de cible, z-index, tokens, et pas sur
l'esthétique ni l'équilibre visuel, faute de captures d'écran au moment de l'audit. Et le finding
structurel qui explique la moitié de cette liste vit ailleurs : **deux langages visuels mobiles
coexistent** (cf. [`MOBILE.md`](../MOBILE.md) §2, adhérence 13 %). Tant qu'il tient, cette liste se
reconstituera.

**Le geste qui ferait vraiment monter la note** est donc un audit visuel, captures, comparaison,
jugement, et non une mesure de plus.

---

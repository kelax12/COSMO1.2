# Audit VoiceOver iOS · check-list à jouer d'une traite

**Statut : à jouer.** C'est le **quatrième** des audits d'accessibilité listés par `C-24`
(`a-faire-code.md`), et le seul que le 2026-09-03 n'a pas passé. Les trois autres (parcours
clavier, modales, `/agenda`) l'ont été, sur **Chromium desktop**, avec le harnais
`e2e/a11y-keyboard-audit.spec.ts`.

🔴 **Il ne se simule pas, et il ne se déduit pas.** Playwright interroge le DOM et
`document.activeElement` : ce qui est prouvé aujourd'hui, c'est le **FOCUS**, jamais l'**ANNONCE**.
La limite complète est écrite dans [`ACCESSIBILITY.md`](./ACCESSIBILITY.md) § « Ce que nos mesures
prouvent, et ce qu'elles ne prouvent pas ». Cette page existe pour qu'une seule séance sur un
iPhone réel la referme.

- **Durée** : environ 60 minutes, préparation comprise.
- **Où** : `https://thecosmo.app`, **en mode démo**. Aucune donnée réelle n'est touchée, et les
  seeds garantissent qu'il y a quelque chose à lire sur chaque écran.
- **Ce que ça produit** : des findings `V-xx`, qui rejoignent `a-faire-code.md` comme les autres.
  Pas de correctif pendant la séance : on mesure, on note, on corrige après.

---

## 0. Préparation (5 min)

1. **Un iPhone réel.** Le simulateur Xcode ne compte pas : son VoiceOver n'est pas le même et les
   gestes n'existent pas. C'est la même règle que M-25 dans `a-faire-manuel.md`.
2. **Noter en tête du compte-rendu** : modèle, version d'iOS, version de Safari
   (Réglages › Général › Informations). Sans ces trois lignes, un finding n'est pas reproductible.
3. **Raccourci d'accessibilité** : Réglages › Accessibilité › Raccourci d'accessibilité ›
   VoiceOver. Un triple-clic sur le bouton latéral l'allume et l'éteint. Indispensable : sans lui,
   sortir de VoiceOver au milieu de l'audit est pénible.
4. **Débit de parole vers 40 %** (Réglages › Accessibilité › VoiceOver › Débit). À vitesse par
   défaut on entend une bouillie, et on note ce qu'on croit avoir entendu.
5. **Safari, portrait, thème clair, aucun zoom d'affichage** pour la première passe. Les variantes
   se jouent à l'étape 12.
6. **Le dictaphone en marche.** C'est le seul moyen fiable de garder l'annonce **verbatim** :
   reformuler ce que VoiceOver a dit, c'est perdre le défaut.

## Les gestes qui suffisent

| Geste | Ce qu'il fait |
|---|---|
| balayage droite / gauche (1 doigt) | élément suivant / précédent dans l'ordre de lecture |
| double tap | activer l'élément sous le curseur VoiceOver |
| toucher-déplacer | explorer par la **position** à l'écran (révèle l'ordre visuel réel) |
| balayage 2 doigts vers le haut | lire toute la page depuis le haut |
| balayage 3 doigts | faire défiler |
| rotor (2 doigts, rotation) puis balayage haut/bas | parcourir par **titres**, **liens**, **contrôles**, **champs de formulaire** |
| « Z » à 2 doigts (scrub) | revenir en arrière, fermer une couche |

## 🧪 Le témoin · à jouer en PREMIER, sinon rien ne compte

Le harnais clavier embarque un témoin ; cette check-list en a un aussi, pour la même raison : une
mesure dont on ne sait pas si l'instrument fonctionnait ne vaut rien.

Sur `https://thecosmo.app`, balayer jusqu'au bouton principal du hero.

- **Attendu** : « **Essayer la démo sans inscription, bouton** ». Ce nom accessible vient de
  `landing.demoAria` et **diffère volontairement du texte visible** (« Essayer la démo gratuite »).
- ✅ Tu entends la phrase longue : VoiceOver lit bien l'arbre d'accessibilité, l'audit peut
  commencer.
- ❌ Tu entends le texte visible : soit le nom accessible n'est pas appliqué, soit la verbosité a
  été modifiée. **Arrêter là.** Aucune ligne de la suite ne serait interprétable.

## Comment consigner

Gabarit de finding, à recopier tel quel :

```
[V-01] /tasks · balayage droite depuis le titre de la liste
Attendu : « Marquer Faire les courses comme faite, case à cocher, non cochée »
Entendu : « bouton »
Appareil : iPhone 13, iOS 18.5, Safari 18.5
```

- **Écrire l'ENTENDU avant l'attendu.** Dans l'autre sens, on écrit ce qu'on espérait.
- Statuts : ✅ conforme · ❌ défaut · ⚠️ douteux. **Un ⚠️ non rejoué compte comme non mesuré**,
  jamais comme conforme.
- Un écran non atteint se note « non atteint », pas « rien à signaler ».

---

## 1. Landing `/` · 5 min · page publique, donc EAA sans réserve

| # | Geste | Ce qui doit se produire | Piège connu |
|---|---|---|---|
| 1.1 | rotor › Titres, balayer vers le bas | un seul `h1`, puis des niveaux qui descendent d'un cran à la fois | `heading-order` a été mesuré caduc sur `/okr`, jamais sur la landing |
| 1.2 | lire depuis le haut (2 doigts) | rien de décoratif n'est lu : les illustrations et icônes doivent être muettes | une icône lucide sans `aria-hidden` se lit « image » |
| 1.3 | atteindre l'aiguillage perso / entreprise | les deux parcours sont annoncés comme deux liens distincts, compréhensibles hors contexte | c'est la structure de la page, cf. `CLAUDE.md` § Landing |
| 1.4 | atteindre la grille de tarifs | le montant est lu **avec** son unité et sa période, et un prix barré est annoncé comme tel | l'offre de lancement affiche « Gratuit » et garde l'ancien prix barré : lu sans le mot « barré », ce sont deux prix contradictoires |
| 1.5 | bandeau cookies, s'il apparaît | il est annoncé, atteignable au balayage, et ses deux choix sont distincts | `CookieBanner` est un `aside` avec `aria-label` |

## 2. Entrée en démo et changement de route · 5 min

| # | Geste | Ce qui doit se produire | Piège connu |
|---|---|---|---|
| 2.1 | double tap sur « Essayer la démo » | l'application s'ouvre sur `/dashboard` | |
| 2.2 | juste après l'ouverture | **quelque chose est annoncé** : titre de page, ou premier élément du nouvel écran | 🔴 la classe de défaut la plus probable de tout cet audit : dans une SPA, changer d'URL n'annonce **rien** par défaut, et le curseur VoiceOver peut rester sur l'écran précédent |
| 2.3 | naviguer `/dashboard` → `/tasks` → `/habits` par la barre d'onglets | même question à chaque fois, et le curseur ne doit pas retomber tout en haut du document à chaque route | |

## 3. Navigation mobile · barre d'onglets et feuille « Plus » · 5 min

| # | Geste | Ce qui doit se produire | Piège connu |
|---|---|---|---|
| 3.1 | atteindre la barre d'onglets | elle est annoncée comme une navigation, et l'onglet courant dit « page active » ou « sélectionné » | `aria-current="page"` est posé, reste à l'entendre |
| 3.2 | atteindre un badge | le nombre est annoncé avec son sens (« 3 demandes en attente »), jamais « 3 » seul | les libellés existent (`nav.badge.*`), la question est leur audibilité |
| 3.3 | ouvrir « Plus » | la feuille est annoncée comme une boîte de dialogue, et le curseur y entre | `MobileMoreSheet` est le **seul** accès mobile à OKR, Statistiques, Réglages et à la déconnexion |
| 3.4 | balayer à droite en boucle dans la feuille | 🔴 **on ne doit pas ressortir sur la page en dessous** | C-53 : aucune modale maison ne piège le focus. Ici on mesure ce que le lecteur d'écran en fait vraiment |
| 3.5 | « Z » à 2 doigts | la feuille se ferme, et le curseur revient sur le bouton « Plus » | |

## 4. `/tasks` · cases à cocher et retours d'action · 10 min

| # | Geste | Ce qui doit se produire | Piège connu |
|---|---|---|---|
| 4.1 | atteindre une ligne de tâche | « case à cocher, non cochée », avec le **nom de la tâche** | `role="checkbox"` + `aria-checked` sont posés (TodayTasks, task-table) : ne jamais entendre « bouton » |
| 4.2 | double tap dessus | le **nouvel état** est annoncé (« cochée ») sans qu'il faille rebalayer | |
| 4.3 | juste après | le toast de confirmation est-il lu ? et **sans voler le curseur** ? | Sonner porte sa propre région live ; un toast qui déplace le curseur casse le parcours |
| 4.4 | atteindre le titre d'une tâche | il est annoncé comme un contrôle activable, pas comme du texte inerte | |
| 4.5 | ouvrir la fiche d'une tâche | le curseur entre dans la modale, son titre est annoncé, et le fond n'est plus atteignable au balayage | `aria-modal` est posé sur les modales Radix ; C-53 dit que les modales maison ne piègent rien |
| 4.6 | « Z » à 2 doigts dans la fiche | elle se ferme | |

## 5. Le calendrier COSMO · 10 min · le composant le plus jeune du produit

Il a remplacé le sélecteur natif sur **six surfaces** et n'a **jamais** été entendu par un lecteur
d'écran. Ouvrir celui de l'échéance depuis la fiche de tâche.

| # | Geste | Ce qui doit se produire | Piège connu |
|---|---|---|---|
| 5.1 | ouvrir le calendrier | le curseur entre dedans, et le mois affiché est annoncé | C-51 : le mois affiché était le mois courant, pas celui du champ |
| 5.2 | balayer dans la grille | chaque jour est annoncé avec sa date **complète et en français** | 🔴 C-52 : `react-day-picker` traduit ses dates, **pas** ses libellés ARIA. « Go to the Previous Month » a été corrigé, rien ne garantit qu'il n'en reste pas |
| 5.3 | atteindre le jour sélectionné | il dit « sélectionné » | |
| 5.4 | atteindre les flèches de mois et les presets | libellés en français, et rôle de bouton | |
| 5.5 | choisir un jour | le champ annonce la nouvelle valeur | |
| 5.6 | rouvrir depuis un **menu** et non depuis un champ | même comportement | C-55 : trois surfaces que les sondes clavier n'ont jamais atteintes |

## 6. `/agenda` · 5 min · le point le plus faible connu

| # | Geste | Ce qui doit se produire | Piège connu |
|---|---|---|---|
| 6.1 | explorer la grille au toucher-déplacer | les jours et les événements sont lisibles, avec heure et titre | C-54 : **0 cellule de jour focalisable sur 8** au clavier |
| 6.2 | balayage droite depuis le haut | combien de balayages avant d'atteindre le premier événement ? **Le noter.** | c'est l'équivalent VoiceOver des 38 tabulations de C-54 |
| 6.3 | changer de mois | l'action est atteignable et le nouveau mois est annoncé | |
| 6.4 | ouvrir un événement (`EventModal`) | le curseur entre dans la modale | C-53 : au clavier, le focus **restait derrière**, et Échap ne fermait pas |
| 6.5 | « Z » à 2 doigts | la modale se ferme | |

## 7. `/habits` · 5 min

| # | Geste | Ce qui doit se produire | Piège connu |
|---|---|---|---|
| 7.1 | atteindre une case de jour | « case à cocher », avec **nom de l'habitude et date en toutes lettres** | les libellés existent (`table.dayCell`) ; le risque est une date lue en fragments |
| 7.2 | cocher | le nouvel état est annoncé | |
| 7.3 | atteindre la série | « série de 12 jours », pas « 12 » seul | la valeur affichée vient du serveur, ne jamais la recalculer depuis `completions` |
| 7.4 | balayer une ligne entière | l'ordre de lecture suit la ligne, pas la colonne | une grille lue en colonnes est illisible |

## 8. `/okr` · 5 min

| # | Geste | Ce qui doit se produire | Piège connu |
|---|---|---|---|
| 8.1 | atteindre une barre d'avancement | « Avancement de X sur Y », avec des nombres, pas un pourcentage seul | |
| 8.2 | rotor › Titres | la hiérarchie tient (mesurée caduque à l'œil le 2026-08-24, jamais à l'oreille) | |
| 8.3 | ouvrir la suppression d'une catégorie | l'impact (« n tâches, n objectifs ») est **lu** avant la confirmation | R-02 : réaffecter avant de supprimer suppose d'avoir compris l'impact |

## 9. `/entreprise` · 5 min · thème noir, et trois correctifs jamais entendus

Les correctifs D4, D5 et E2 du 2026-08-27 ont été écrits **sans qu'un lecteur d'écran les
vérifie**. Cette étape est leur première mesure réelle.

| # | Geste | Ce qui doit se produire | Piège connu |
|---|---|---|---|
| 9.1 | frise, pastille de date | « 27 août 2026 », en un seul bloc | D4 : elle se lisait « 27août » |
| 9.2 | en-tête « Mes tâches (3) · 1 h 45 » | le séparateur s'entend | D5 : un `ml-2` n'existe pas pour un lecteur d'écran |
| 9.3 | pastille de priorité | elle est annoncée | E2 : elle n'était portée que par `title=`, muet au toucher |
| 9.4 | pyramide managériale | la structure se parcourt, et un membre est annoncé avec son rôle | jamais entendue |

## 10. Formulaires et erreurs · 5 min

Se déconnecter (feuille « Plus »), puis `/login`.

| # | Geste | Ce qui doit se produire | Piège connu |
|---|---|---|---|
| 10.1 | atteindre chaque champ | le **libellé** est annoncé, pas « champ de texte » | |
| 10.2 | valider avec un e-mail mal formé | l'erreur est **annoncée toute seule** | `AuthForm` porte une région live ; reste à l'entendre |
| 10.3 | après l'erreur | le curseur n'a pas sauté ailleurs | une région live ne doit pas voler le curseur |
| 10.4 | rotor › Champs de formulaire | tous les champs y sont, dans l'ordre visuel | |

## 11. Deux questions transverses, à se poser sur chaque écran

- **L'ordre de lecture au balayage suit-il l'ordre visuel ?** Comparer un balayage droite avec un
  toucher-déplacer. C'est la question que le clavier ne pose pas : l'ordre de tabulation ignore tout
  ce qui n'est pas focalisable, l'ordre de lecture non.
- **Quelque chose est-il lu deux fois ?** Un texte à la fois visible et en `sr-only` s'entend en
  double. C'est précisément le risque introduit par les correctifs D4 et D5.

## 12. Variantes système · 5 min · bonus qui rejoint M-25

À jouer VoiceOver **éteint**, ce sont d'autres réglages :

- **Texte plus grand** au maximum (Accessibilité › Affichage et taille du texte) : la mise en page
  tient-elle sur `/dashboard`, `/tasks` et la feuille « Plus » ?
- **Réduire les animations** activé : les feuilles s'ouvrent-elles vraiment ? C'est la classe de
  bug du 2026-08-24, où `MobileMoreSheet` s'ouvrait à **0 px visible**, et le seul chemin mobile
  vers les réglages était sans issue.
- **Thème sombre** : l'icône des sélecteurs de date natifs est-elle visible sur `/agenda` ?
  Corrigée le 2026-09-03, jamais vue sur un écran iOS.

---

## Hors périmètre, volontairement

Android TalkBack, VoiceOver macOS, le contraste (déjà mesuré, cf. `ACCESSIBILITY.md`) et la
performance (M-38). Cet audit répond à **une** question : ce que le produit **dit** à quelqu'un qui
ne le voit pas, sur l'appareil où il est le plus utilisé.

## Après la séance

1. Reporter chaque finding dans `a-faire-code.md`, en gardant le verbatim.
2. Refermer **C-24** : c'est le quatrième et dernier des quatre audits.
3. Renoter l'accessibilité dans [`ACCESSIBILITY.md`](./ACCESSIBILITY.md) et dans le tableau de bord
   de [`README.md`](./README.md), en disant ce qui a été mesuré et sur quel appareil.
4. Si l'audit n'a pas pu aller au bout, l'écrire ainsi. Un audit partiel est « à refaire », pas
   « fait » : c'est déjà l'arbitrage rendu pour A-4.

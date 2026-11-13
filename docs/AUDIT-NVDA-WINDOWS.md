<!-- echeance-lecteur-ecran: 2027-01-15 initiale=2027-01-15 -->

# Audit NVDA (Windows) et revue humaine WCAG : check-list à jouer d'une traite

Lire pour jouer la séance NVDA, ou en touchant `scripts/check-lecteurs-ecran.mjs`. Ce qui fait foi : le registre ci-dessous et `npm run check:lecteurs-ecran`. Pendant Windows de [`AUDIT-VOICEOVER-IOS.md`](./AUDIT-VOICEOVER-IOS.md) (`M-40`, `M-52`) et support de la revue humaine des critères qu'`axe-core` ne voit pas (`M-51`, `ACCESSIBILITY.md` AM-1).

**Statut : à jouer, échéance 2027-01-15. Rien n'est coché.** Une seule séance d'environ 75 minutes : la partie B réutilise ce que la partie A fait entendre.

- 🔴 `npm run check:lecteurs-ecran` échoue en CI passé l'échéance sans ligne `✅ joué` au [registre](#registre-des-séances). ❌ Repousser l'échéance de plus de 30 jours après `initiale=` (reconduction). ❌ Supprimer des étapes : la garde exige un plancher d'étapes et un résultat attendu non vide pour chacune.
- 🔴 Il ne se simule pas : Playwright prouve le FOCUS, jamais l'ANNONCE ; NVDA lit l'arbre d'accessibilité.

## 0. Préparation (5 min)

1. Windows réel, NVDA à jour (version notée), **Firefox** pour la passe principale, **Chrome** pour l'étape 8. Noter versions de Windows, de NVDA, du navigateur : sans elles un finding n'est pas reproductible.
2. Touche NVDA = `Insert` (ou `Verr. Maj`). `NVDA+Espace` bascule mode navigation / mode formulaire.
3. Débit de parole vers 40 %, enregistreur de parole NVDA ou dictaphone : l'annonce se garde VERBATIM.
4. Site `https://thecosmo.app`, thème clair, zoom 100 %, SANS souris (la débrancher).
5. Gabarit de finding : [`AUDIT-VOICEOVER-IOS.md`](./AUDIT-VOICEOVER-IOS.md) § « Comment consigner » (l'ENTENDU avant l'attendu). Statuts : ✅ conforme · ❌ défaut · ⚠️ douteux · ⬜ non atteint (une ligne de justification).

## 1. Le témoin : à jouer EN PREMIER

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 1.1 | `Tab` jusqu'au bouton principal du hero de `/` | NVDA dit « **Essayer la démo sans inscription** » puis « bouton » | « gratuite » entendu : nom accessible (`landing:hero.demoAria`) non appliqué, **arrêter**, rien de la suite n'est interprétable |
| 1.2 | `NVDA+F7` (liste des éléments), onglet Titres | un seul titre de niveau 1, puis des niveaux qui descendent d'un cran à la fois | `heading-order` jamais mesuré à la landing |

## 2. Landing `/` · 8 min

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 2.1 | `NVDA+Bas` (tout lire) depuis le haut | rien de décoratif n'est lu : illustrations et icônes sont muettes | une icône sans `aria-hidden` se lit « graphique » |
| 2.2 | `K` (lien suivant) jusqu'à l'aiguillage perso / entreprise | deux liens distincts, compréhensibles hors contexte | structure : [`src/pages/landing/CLAUDE.md`](../src/pages/landing/CLAUDE.md) |
| 2.3 | atteindre la grille de tarifs | le montant est lu avec son unité et sa période, un prix barré est annoncé comme barré | deux prix lus sans « barré » se contredisent |
| 2.4 | bandeau cookies, s'il apparaît | annoncé à son apparition, ses deux choix sont atteignables au `Tab` et distincts | `CookieBanner` est un `aside` avec `aria-label` |
| 2.5 | `D` (repère suivant) | les repères principaux (navigation, contenu, pied de page) sont annoncés avec un nom | un repère sans nom ne se distingue pas d'un autre |

## 3. Entrée en démo et changement de route · 5 min

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 3.1 | `Entrée` sur « Essayer la démo » | l'application s'ouvre sur `/dashboard` | |
| 3.2 | juste après l'ouverture | quelque chose est annoncé : titre de page ou premier élément du nouvel écran | 🔴 dans une SPA, changer d'URL n'annonce rien par défaut |
| 3.3 | naviguer `/dashboard` → `/tasks` → `/habits` au clavier | même annonce à chaque route, et le focus ne retombe pas au sommet du document | |

## 4. `/tasks` · 12 min

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 4.1 | `Tab` jusqu'à une ligne de tâche | « case à cocher, non cochée » **avec le nom de la tâche** | jamais « bouton » seul |
| 4.2 | `Espace` dessus | le nouvel état est annoncé (« cochée ») sans rebalayer | |
| 4.3 | juste après | le toast de confirmation est lu, **sans voler le focus** | Sonner porte sa propre région live |
| 4.4 | `Shift+F10` sur une ligne de tâche | la feuille d'actions s'ouvre et son nom est annoncé (« Actions pour \<nom\> ») | chemin `contextmenu`, annoncé par `aria-keyshortcuts` |
| 4.5 | une tâche en retard | l'état « en retard » est annoncé, pas seulement montré en rouge | une couleur n'est pas une information pour un lecteur d'écran |
| 4.6 | ouvrir la fiche d'une tâche | le focus entre dans la modale, son titre est annoncé, le fond n'est plus atteignable | surface Radix : piège de la bibliothèque |
| 4.7 | `Échap` dans la fiche | elle se ferme et le focus revient sur le contrôle qui l'avait ouverte | |

## 5. Modales maison · 6 min

Les quatre détecteurs M1 à M4 de [`AUDIT-VOICEOVER-IOS.md`](./AUDIT-VOICEOVER-IOS.md), sur une surface représentative.

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 5.1 | ouvrir « Nouvelle liste » depuis `/tasks` | M1 : le nom « Nouvelle liste » puis « boîte de dialogue » est annoncé, et le focus est dans la surface | |
| 5.2 | `Tab` en boucle une dizaine de fois | M3 : on ne ressort jamais sur la page dessous | un seul élément d'arrière-plan annoncé est un ❌ |
| 5.3 | `Échap` | M4 : la surface se ferme, le focus revient sur le déclencheur | |

## 6. Formulaires et erreurs · 6 min

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 6.1 | `/login`, mode formulaire, `Tab` sur chaque champ | chaque champ est annoncé avec son libellé et son type (« modifier, e-mail ») | un `placeholder` seul n'est pas un libellé |
| 6.2 | soumettre vide | l'erreur est annoncée sans qu'il faille la chercher, et le champ fautif est identifiable | une erreur rouge muette est invisible pour NVDA |

## 7. `/entreprise` · 8 min · thème noir

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 7.1 | ouvrir le mode entreprise depuis la démo | le changement de contexte est annoncé (titre ou région) | |
| 7.2 | parcourir la navigation latérale | l'entrée de la section courante est annoncée « page actuelle » (ou équivalent) | `aria-current="page"` vient de `NavLink` |
| 7.3 | un tableau de membres ou de tâches d'équipe, `T` puis `Ctrl+Alt+Flèches` | les en-têtes de colonnes sont annoncés avec chaque cellule | un tableau sans `th` se lit comme une suite de nombres |

## 8. Contrôle sous Chrome · 3 min

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 8.1 | rejouer 1.1, 4.1 et 5.1 sous Chrome | les trois annonces sont identiques à celles de Firefox, ou la différence est consignée | NVDA ne lit pas l'arbre de la même façon sous les deux moteurs |

## B. Revue humaine des critères qu'axe-core ne voit pas · 12 min

`ACCESSIBILITY.md` AM-1 (`M-51`) : ordre de lecture, pertinence d'un libellé, sens porté par une couleur seule, non automatisables par nature. Chaque étape se juge à l'écoute NVDA, sur les écrans de la partie A.

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| B.1 | 1.3 (ordre de lecture) : lire `/dashboard` en entier avec `NVDA+Bas` | l'ordre entendu suit le sens de la page, titre avant contenu, sans saut incohérent | l'ordre visuel (CSS) peut différer de l'ordre du DOM |
| B.2 | 1.3 : lire `/tasks` de même | l'ordre entendu est celui d'un voyant : filtres, liste, puis actions | |
| B.3 | 2.4.6 (libellés) : atteindre dix boutons-icônes au `Tab` | chacun dit **ce qu'il fait**, jamais « bouton » seul ni un nom technique | un libellé existant mais faux est pire qu'un libellé absent, axe ne le voit pas |
| B.4 | 2.4.4 (liens) : liste des liens `NVDA+F7` | chaque lien se comprend hors contexte, aucun « cliquer ici » ni doublon ambigu | |
| B.5 | 1.4.1 (couleur) : repérer trois informations portées par la couleur (retard, priorité, état) | chacune a un équivalent textuel ou annoncé | une pastille rouge seule n'informe pas un daltonien |
| B.6 | 3.3.2 (étiquettes) : un formulaire de création (tâche, habitude) | chaque champ dit ce qu'on attend de lui, format compris | |
| B.7 | 4.1.3 (messages d'état) : créer, puis supprimer une tâche | chaque action produit une annonce, sans déplacer le focus | |

## Registre des séances

Une ligne par séance RÉELLEMENT jouée, jamais avant. `✅ joué` exige les parties A et B en entier ; `⚠️ partiel` est à refaire et n'éteint PAS l'échéance. Findings : issues (étiquette `zone:accessibilite`), verbatim conservé.

| Date | Appareil (Windows · NVDA · navigateur) | Statut | Findings |
|---|---|---|---|
| _(aucune séance à ce jour)_ | | | |

---

## Après la séance

1. Une issue par finding (`zone:accessibilite`), verbatim gardé.
2. Mettre à jour [`ACCESSIBILITY.md`](./ACCESSIBILITY.md) (AM-1 et AM-3) en disant ce qui a été mesuré, sur quelle version de NVDA.
3. ❌ Refermer `M-40`, `M-51` ou `M-52` sur une séance partielle.

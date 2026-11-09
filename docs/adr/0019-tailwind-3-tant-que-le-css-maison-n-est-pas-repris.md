# ADR 0019 · Tailwind 3, tant que le CSS maison n'est pas repris

- **Statut** : acceptée
- **Date** : 2026-11-09 (vague 18.2 du plan de reprise, constat DEP-01)

## Contexte

L'audit externe du 2026-11-06 relève Tailwind 3.4 avec une majeure de retard (`npm outdated` du
2026-11-08 : 4.3.5). Le [guide de l'éditeur](https://tailwindcss.com/docs/upgrade-guide) annonce
un nouveau moteur (configuration en CSS, `@tailwindcss/postcss`), des utilitaires renommés
(`shadow-sm` → `shadow-xs`, `rounded` → `rounded-sm`, `ring` → `ring-3`, `outline-none` →
`outline-hidden`…), une couleur de bordure par défaut passée à `currentColor`, un `ring` d'un
pixel au lieu de trois, et des navigateurs minimums relevés (Safari 16.4, Chrome 111,
Firefox 128).

Essai fait le 2026-11-09 dans le dépôt avec l'outil officiel (`npx @tailwindcss/upgrade@4`) :

- **311 fichiers réécrits** (+1 724, −2 018 lignes), dont `src/index.css` (1 986 lignes) restructuré.
- **Des renommages faux.** La classe maison `.ring` du spinner de démarrage est devenue `ring-3`,
  un utilitaire de bordure sans rapport, dans `index.html` mais pas dans `BootScreen.tsx` qui
  partage le même CSS ; l'outil a réécrit en même temps `src/prerender-hero.guard.test.ts` pour
  qu'il valide ce renommage. Rien
  ne distingue, dans les 338 `ring-2`, 261 `outline-none` et 185 `ring` touchés, une classe
  Tailwind d'une classe maison du même nom, sinon une relecture une par une.
- **Le mode sombre et les thèmes changent de nature.** Les sélecteurs de thème du CSS maison
  (`.dark …`, 40 occurrences ; `.gris`, `.noir`) et d'état (`.active`, `.filled`) sont convertis
  en `@utility dark { & .task-priority-1 { … } }` : ils passent de la couche `base`/`components`
  à la couche `utilities`, donc changent de rang dans la cascade et ne sont plus émis que si le
  nom apparaît dans les sources. Le rendu des trois thèmes n'est plus garanti sans les revoir
  écran par écran.
- Les références visuelles de la CI étendue bougeraient toutes : leur régénération passe par la
  procédure revue de la vague 15.4.

## Décision

**Tailwind 4 est écarté.** Le dépôt reste en Tailwind 3.4. La montée n'est pas une mise à jour de
dépendance mais une reprise du CSS maison et de la totalité des écrans, en clair, en sombre et
dans les thèmes `gris` et `noir`, ce qu'une vague qui exige un rendu inchangé ne peut pas
absorber.

## Conséquences

- **Positives.** Rendu, thèmes et références visuelles inchangés ; navigateurs pris en charge
  inchangés.
- **Négatives.** Une majeure de retard sur l'outil de style de toute l'application ; la 3.4 ne
  recevra plus que des correctifs de sécurité.
- **Ce qui rouvre la décision.** Un chantier dédié, en trois temps : (1) sortir de `src/index.css`
  les sélecteurs de thème et d'état vers des variantes déclarées (`@custom-variant dark`, attributs
  de thème) et renommer les classes maison qui portent un nom d'utilitaire (`.ring`) ; (2) lancer
  l'outil officiel sur cette base, relire son diff ; (3) revue visuelle des trois thèmes, desktop
  et mobile, puis régénération des références par la procédure de la vague 15.4.
- **À ne pas faire.** Ne pas accepter le diff de l'outil officiel sans relecture : il renomme des
  classes maison et réécrit les tests qui les gardent.

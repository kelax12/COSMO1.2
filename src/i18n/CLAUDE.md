# i18n · règles du dossier

> Repris de `CLAUDE.md` le 2026-09-16, **sans une coupe**. Chargé automatiquement dès
> qu un fichier de ce dossier est touché. Règles transversales : [`CLAUDE.md`](../../CLAUDE.md) à la racine.

---

## i18n — catalogues maison (fr + en)

L'app est **bilingue fr/en**, sans framework i18n (pas d'i18next). Socle dans `src/i18n/`,
catalogues JSON par namespace dans `src/locales/{fr,en}/*.json` (**23 namespaces** : `common`,
`tasks`, `org`, `landing`, `seo`, `settings`…). ⚠️ Ce fichier a écrit « 19 » jusqu'au 2026-09-14 :
le chiffre datait du levier de chargement paresseux du 2026-08-25 et n'a jamais été recompté
pendant que quatre catalogues entraient. Il se relit en une commande, `npm run i18n:check` l'annonce
à chaque exécution, et il figurait exact dans le tableau de gardes de `faille.md`, jamais ici.

```typescript
import { useT } from '@/i18n/useT';
const { t, tp } = useT('org');   // tp = pluriel
t('project.name')                // clé plate dans le namespace
```

- **`fr` est le catalogue de référence** : le moteur retombe clé par clé sur lui. Un catalogue
  traduit incomplet n'affiche donc jamais de clé brute — et ne se voit pas non plus.
  `npm run i18n:check` (bloquant CI) est la seule protection réelle **sur les clés**.
  ⚠️ Il ne regarde jamais le CONTENU d'une valeur : une valeur `en` recopiée du français passe
  sans bruit. C'est `npm run i18n:identical` (bloquant CI, cliquet à **0**) qui ferme cet
  angle-là. ❌ Ne jamais conclure d'un `i18n:check` vert que l'anglais est traduit.
- **Slugs de routes localisés** : `src/i18n/routes.ts` + `route-slugs.json`. Une seule URL
  canonique par langue et par page (`/en/about` répond, `/en/a-propos` → 404, voulu).
- Le préfixe de locale est porté par le `basename` du routeur, **figé au montage** — changer de
  langue implique un rechargement complet (cf. `src/i18n/bootstrap.ts`).
- Les dates passent par `src/i18n/format.ts` (locale date-fns alignée sur la locale active).
- ⚠️ **« Servie » ≠ « indexable »** : `SUPPORTED_LOCALES` (`src/i18n/locale.ts`) ouvre une langue
  aux utilisateurs ; `INDEXABLE_LOCALES` (`src/i18n/seo-urls.mjs`) l'ouvre à Google. Les deux
  valent aujourd'hui `fr` + `en` : **l'anglais est indexable depuis le 2026-09-08** (C-20). `es`
  n'est ni servie ni indexable, alors qu'elle figure dans `route-slugs.json` : c'est le mécanisme
  prévu, pas un oubli.
  ❌ **Ne jamais ajouter une locale à `INDEXABLE_LOCALES` avant d'avoir traduit le CORPS des
  pages**, pas seulement les métas : c'est le duplicate content que toute l'architecture i18n
  existe pour empêcher. Pour `en`, les 50 pages ont été mesurées une par une avant la bascule.
  🔴 **Les trois fichiers se commitent ENSEMBLE** (`src/i18n/seo-urls.mjs`, `prerender.mjs`,
  `vercel.json`) : l'état à moitié ouvert, où le `noindex` est retiré mais la locale absente
  d'`INDEXABLE_LOCALES`, est le PIRE des trois, Google indexant alors `/en` sans `hreflang` ni
  sitemap. `npm run i18n:check` est la gate qui refuse cet état.
  ⚠️ Ouvrir une locale découvre aussi les routes applicatives sous son préfixe : `Disallow:`
  est un **préfixe**, `/dashboard` ne couvre pas `/en/dashboard`, et c'est le `noindex` retiré
  qui les bouchait. Procédure complète dans [`docs/SEO.md`](../../docs/SEO.md).
- ❌ **Ne jamais écrire un slug localisé en dur dans un `to=`.** Le préfixe de locale est porté par
  le `basename` : `<Link to="/politique-confidentialite">` devient `/en/politique-confidentialite`,
  qui rend une **404** (une seule URL canonique par langue, comportement voulu). Mesuré dans le
  navigateur le 2026-09-02 : les quatre liens vers les pages contractuelles (bandeau cookies + pied
  de landing) tombaient tous sur une 404 en anglais. Passer par `useLocalizedPath()`
  (`src/i18n/useLocalizedPath.ts`).
- 📄 **Les trois pages contractuelles vivent dans le namespace `legal`**, en français et en anglais
  (CGU, confidentialité, mentions légales). Les pages ne portent plus que la STRUCTURE du document
  (`src/pages/legal/LegalDocument.tsx`) ; le gras et les liens sont dans le catalogue, en
  `**gras**` et `[libellé](url)`, rendus par `RichText`.
  🔴 **Le français fait foi** : chaque document porte une clause de langue disant que la version
  française prévaut. Modifier le fond d'un de ces documents n'est pas une tâche de traduction —
  c'est modifier un contrat, avec le préavis de 30 jours prévu à son article 11.
- ❌ **Ne jamais identifier une erreur par son message en français** — il est traduit.
- ❌ Ne jamais concaténer des fragments traduits : une clé = une phrase complète.

---


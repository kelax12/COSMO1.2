# `src/i18n/` · catalogues fr/en, slugs, locales

Lire en touchant `src/i18n/**`, `src/locales/**`, un `t(...)`, un `to=` localisé, une page légale. Détail : [`docs/I18N.md`](../../docs/I18N.md), [`docs/SEO.md`](../../docs/SEO.md).
Règles transversales : [`CLAUDE.md`](../../CLAUDE.md). Nombre de catalogues : [`docs/FAITS.md`](../../docs/FAITS.md).

```typescript
import { useT } from '@/i18n/useT';
const { t, tp } = useT('org');   // tp = pluriel ; clé plate dans le namespace
```

## Catalogues

- ✅ Catalogues JSON maison par namespace, `src/locales/{fr,en}/*.json`, pas d'i18next. `fr` est la référence : le moteur retombe sur lui clé par clé.
- ❌ Conclure d'un `npm run i18n:check` vert que l'anglais est traduit : il compare les clés, jamais le contenu. `i18n:identical` (cliquet 0) ferme les copies du français ; `i18n:pages` (C-99) compare le corps des pages prérendues, les pluriels et les dates.
- 🔴 Les quatre gates ne mesurent pas la QUALITÉ : une traduction fausse mais différente les passe. Relire l'anglais est un geste humain (`M-50`).
- ❌ Concaténer des fragments traduits : une clé = une phrase complète.
- ❌ Identifier une erreur par son message : il est traduit.

## Routes et préfixe

- ✅ `src/i18n/routes.ts` + `route-slugs.json` : une URL canonique par langue et par page (`/en/about` répond, `/en/a-propos` → 404, voulu).
- ✅ Le préfixe de locale est le `basename` du routeur, figé au montage : changer de langue recharge la page (`src/i18n/bootstrap.ts`).
- ❌ Un slug localisé en dur dans un `to=` : `<Link to="/politique-confidentialite">` devient `/en/politique-confidentialite`, une 404. Passer par `useLocalizedPath()` (`src/i18n/useLocalizedPath.ts`).
- ✅ Dates par `src/i18n/format.ts`. Garde `date-format.guard.test.ts` (AM-3) : refuse `toLocale*String()` sans locale, `Intl` en dur, `{ locale: fr }`, noms de jours à la main. ❌ Une entrée d'allowlist sans raison.

## Locales : servie ≠ indexable

- ⚠️ `SUPPORTED_LOCALES` (`src/i18n/locale.ts`) ouvre une langue aux utilisateurs ; `INDEXABLE_LOCALES` (`src/i18n/seo-urls.mjs`) l'ouvre à Google. Valeurs : `fr` + `en`. `es` figure dans `route-slugs.json` sans être servie : c'est le mécanisme prévu.
- ❌ Ajouter une locale à `INDEXABLE_LOCALES` avant d'avoir traduit le CORPS des pages (duplicate content).
- 🔴 `src/i18n/seo-urls.mjs`, `prerender/` et `vercel.json` se commitent ENSEMBLE : le `noindex` retiré sans locale dans `INDEXABLE_LOCALES` fait indexer `/en` sans `hreflang` ni sitemap. `npm run i18n:check` refuse cet état.
- ⚠️ Ouvrir une locale expose les routes applicatives sous son préfixe : `Disallow:` est un préfixe, `/dashboard` ne couvre pas `/en/dashboard`. Procédure : `docs/SEO.md`.

## Pages contractuelles

- ✅ Trois catalogues, chacun chargé par sa seule page, fr et en : `legalTerms` (CGU), `legalPrivacy` (confidentialité), `legal` (mentions, libellés communs). Structure : `src/pages/legal/LegalDocument.tsx` ; gras et liens dans le catalogue (`**gras**`, `[libellé](url)`, rendus par `RichText`).
- 🔴 Le français fait foi (clause de langue). Changer le fond d'un document est une modification de contrat, avec préavis de 30 jours (art. 11 des CGU), pas une tâche de traduction.
- ✅ `npm run check:legal-journal` (`C-107`) exige l'empreinte datée de chaque langue dans [`docs/LEGAL-JOURNAL.md`](../../docs/LEGAL-JOURNAL.md). ⚠️ Il prouve la traçabilité, jamais la conformité.

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import exhaustiveDepsJustified from './eslint-rules/exhaustive-deps-justified.js';

export default tseslint.config(
  // `.worktrees/**` : ce depot travaille a plusieurs sessions, chacune dans son
  // arbre. Sans cette exclusion, `npm run lint` lance a la racine rend les
  // erreurs des arbres VOISINS — mesure le 2026-09-12 : 2 erreurs, toutes deux
  // dans un `e2e/fixtures.ts` de worktree, que le motif `e2e/**` ne couvre pas
  // une fois prefixe. La regle du depot est « 0 erreur avant chaque commit » :
  // une sortie polluee par le travail des autres la rend inapplicable.
  // ═══ C-102 · CE QUI ÉTAIT HORS DE TOUT INVARIANT D'IMPORT ═══════
  //
  // 🔴 Jusqu'au 2026-09-20, cette ligne ignorait `e2e/**` et
  // `src/components/showcase/**`, et `supabase/functions/**` n'était couvert
  // par aucun `files:`. Trois arbres entiers hors de TOUTES les règles du
  // tableau d'`ARCHITECTURE.md` : pas d'alias `@/` imposé, pas de
  // `no-empty`, pas de `no-unused-vars`. Le troisième est le code qui déplace
  // de l'argent.
  //
  // LA DETTE, MESURÉE avant de retirer l'exclusion, et elle est petite :
  //   · `e2e/`                     1 erreur, 0 avertissement
  //   · `src/components/showcase/` 0 erreur, 1 avertissement
  //   · `supabase/functions/`      0 erreur, 0 avertissement (15 fichiers)
  // L'unique erreur est un FAUX POSITIF de `react-hooks/rules-of-hooks` sur la
  // fixture Playwright `e2e/fixtures.ts`, où `use` est le paramètre de
  // `base.extend` — rien à voir avec le hook React `use`. Elle est traitée par
  // le bloc dédié plus bas, qui désarme les règles React sur un arbre qui n'a
  // pas de React, et non par une entrée d'allowlist.
  //
  // ⚠️ `.worktrees/**` RESTE exclu, et ce n'est pas la même chose : ce dépôt
  // travaille à plusieurs sessions, chacune dans son arbre, et `npm run lint`
  // lancé à la racine rendait les erreurs des arbres VOISINS. La règle
  // « 0 erreur avant chaque commit » devient inapplicable quand la sortie est
  // polluée par le travail des autres.
  { ignores: ['dist', 'coverage', 'coverage-tooling', 'src/__test__/**', '.agents/**', '.claude/**', '.worktrees/**'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      // Regles locales, definies dans `eslint-rules/`. Un plugin en ligne
      // plutot qu'une dependance : `eslint-plugin-eslint-comments` ferait le
      // meme travail, mais reecrire `package-lock.json` pour une regle de
      // vingt lignes n'en vaut pas le prix (cf. C-18, qui demande justement
      // qu'aucune autre session ne travaille dans l'arbre ce jour-la).
      cosmo: { rules: { 'exhaustive-deps-justified': exhaustiveDepsJustified } },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // C-06 — voir l'en-tete de `eslint-rules/exhaustive-deps-justified.js`.
      // Le desarmement reste possible ; ce qui devient impossible, c'est de le
      // poser sans avoir ecrit pourquoi la dependance retiree ne peut pas
      // perimer la valeur.
      'cosmo/exhaustive-deps-justified': 'error',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      // Audit archi 2026-08-07 (M3) — un `catch {}` totalement vide rend une
      // panne réelle indiscernable d'un no-op volontaire. Le code actuel n'en
      // contient AUCUN (tous portent au minimum un commentaire d'intention) :
      // cette règle verrouille cet état plutôt que de le laisser dériver.
      //
      // `allowEmptyCatch: false` (défaut de `no-empty`, réaffirmé ici pour que
      // l'intention soit lisible) : un catch délibérément silencieux doit
      // porter un commentaire expliquant POURQUOI l'erreur est ignorable.
      // Un commentaire suffit à satisfaire la règle — l'objectif est la
      // justification écrite, pas la gestion d'erreur cérémonielle.
      'no-empty': ['error', { allowEmptyCatch: false }],
      // Audit doc 2026-08-24 — la convention « toujours l'alias `@/` »
      // (CLAUDE.md) n'était portée par aucun outil : elle est passée de
      // 1 entorse le 2026-08-14 à 6 le 2026-08-24, sans qu'aucune revue ne
      // le voie. Une convention non outillée se dilue ; celle-ci est
      // structurante (elle garde le pattern repository comme frontière de
      // données unique, donc rend une sortie de Supabase envisageable).
      //
      // Périmètre volontairement étroit : on interdit de remonter au-dessus
      // du dossier courant pour atteindre `src/`. Les imports relatifs
      // INTERNES à un module (`./constants`, `./types`) restent légitimes —
      // ce sont eux qui rendent un module déplaçable.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../modules/*', '../../modules/*', '../../../modules/*',
                      '../lib/*', '../../lib/*', '../../../lib/*',
                      '../components/*', '../../components/*', '../../../components/*',
                      '../pages/*', '../../pages/*', '../../../pages/*',
                      '../i18n/*', '../../i18n/*', '../../../i18n/*'],
              message: "Utiliser l'alias `@/` (CLAUDE.md → Conventions de code).",
            },
          ],
        },
      ],
    },
  },

  // ── C-102 · l'arbre Playwright : du Node, pas du React ────────────
  //
  // 🔴 `react-hooks/rules-of-hooks` y produit un FAUX POSITIF structurel :
  // `base.extend({ demoPage: async ({ page }, use) => …})` appelle `use()`, le
  // paramètre de la fixture, et la règle y lit le hook React `use`. Ce n'est
  // pas une dispense de confort — la règle ne peut pas être vraie ici, il n'y
  // a pas un composant React dans cet arbre.
  //
  // ❌ Ne pas désarmer autre chose : `no-unused-vars`, `no-empty` et l'alias
  //    `@/` s'appliquent à `e2e/` comme au reste, et y passent déjà.
  //
  // `globals.node` : ces fichiers tournent sous Node (`process.env.CI`,
  // `__dirname`), pas dans un navigateur.
  {
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },

  // ── C-102 · les Edge Functions : du Deno ──────────────────────────
  //
  // Elles n'étaient couvertes par aucun `files:` — ni ignorées, ni lintées :
  // le silence le plus discret des trois. Mesuré à leur entrée : 15 fichiers,
  // 0 erreur, 0 avertissement. Elles entrent donc SANS dette.
  //
  // ⚠️ `Deno` est déclaré en global : sans lui, une règle qui s'appuierait sur
  // `no-undef` accuserait chaque fichier. `globals.node` n'est PAS posé — ces
  // modules ne tournent pas sous Node, et laisser croire le contraire ferait
  // passer un `process.env` pour légitime alors qu'il est vide en Deno.
  //
  // ⚠️ L'alias `@/` ne vaut pas ici : ces fonctions vivent hors de `src/` et
  // importent leurs voisines en relatif (`../_shared/alert.ts`). La règle
  // `no-restricted-imports` de `src/` ne les vise pas, ses motifs étant écrits
  // pour l'arborescence de `src/`.
  {
    files: ['supabase/functions/**/*.ts'],
    languageOptions: {
      globals: { Deno: 'readonly' },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-refresh/only-export-components': 'off',
    },
  }
);

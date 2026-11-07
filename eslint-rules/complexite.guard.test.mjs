// ═══════════════════════════════════════════════════════════════════
// complexite.guard.test.mjs · le CLIQUET de complexité (ARC-05, V17.4)
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// `eslint.config.js` pose trois règles STANDARD (`complexity`, `max-depth`,
// `max-lines-per-function`) et donne à chaque fichier de
// `complexite.baseline.json` sa valeur mesurée comme plafond. Une règle
// ESLint ne sait plafonner qu'un FICHIER, pas une fonction : seule, elle
// laisserait une deuxième fonction grossir jusqu'au niveau de la pire du même
// fichier, et ne dirait rien quand une valeur baisse (le cliquet reprendrait
// du mou en silence). Ce témoin ferme les deux trous :
//
//   · chaque fichier listé est relinté au SEUIL commun, et la liste de ses
//     dépassements doit être EXACTEMENT celle de la ligne de base ;
//   · plus haut → rouge (ce qui casse) ; plus bas → rouge aussi, avec la
//     valeur à recopier (ce qui resserre).
//
// ❌ Ce n'est pas une allowlist : on n'y ajoute jamais un fichier, on n'y
//    relève jamais une valeur. Mesures et décision : `docs/ARCHITECTURE.md` § 3.
//
// La logique des règles n'est jamais réimplémentée : chaque mesure vient d'un
// vrai `ESLint`. Une garde qui réécrit ce qu'elle teste ne teste que sa copie.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { ESLint, Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const RACINE = process.cwd();
const BASE = JSON.parse(
  readFileSync(path.join(RACINE, 'eslint-rules', 'complexite.baseline.json'), 'utf8'),
);
const REGLES = ['complexity', 'max-depth', 'max-lines-per-function'];

/** Configuration minimale : le seul parseur TypeScript et les trois règles au seuil commun. */
const regles = (s) => ({
  complexity: ['error', s.complexity],
  'max-depth': ['error', s['max-depth']],
  'max-lines-per-function': [
    'error',
    { max: s['max-lines-per-function'], skipBlankLines: true, skipComments: true },
  ],
});

/** La valeur mesurée, lue dans le message d'ESLint (« of 37 », « (5) », « (379) »). */
function valeur(message) {
  const m = message.match(/complexity of (\d+)|\((\d+)\)/);
  if (!m) throw new Error(`Message ESLint illisible, la garde ne mesure plus : ${message}`);
  return Number(m[1] ?? m[2]);
}

describe('complexité · la ligne de base est honnête', () => {
  it('porte les trois seuils, et chaque valeur est AU-DESSUS du seuil, triée', () => {
    expect(Object.keys(BASE.seuils).sort()).toEqual([...REGLES].sort());
    const fautes = [];
    for (const [fichier, mesures] of Object.entries(BASE.fichiers)) {
      for (const [regle, vs] of Object.entries(mesures)) {
        if (!REGLES.includes(regle)) fautes.push(`${fichier} : règle inconnue ${regle}`);
        if (vs.length === 0) fautes.push(`${fichier} : liste vide pour ${regle}`);
        if (vs.some((v) => v <= BASE.seuils[regle])) fautes.push(`${fichier} : ${regle} sous le seuil`);
        if (vs.join() !== [...vs].sort((a, b) => b - a).join()) fautes.push(`${fichier} : ${regle} non triée`);
      }
    }
    expect(fautes).toEqual([]);
  });
});

describe('complexité · le détecteur détecte (témoins négatifs et positifs)', () => {
  const linter = new Linter();
  const lint = (code) =>
    linter.verify(code, { rules: regles(BASE.seuils) }).filter((m) => REGLES.includes(m.ruleId));
  // Une fonction de complexité 1 + n : n `if` à la suite.
  const fonction = (n) =>
    `function f(x) {\n${Array.from({ length: n }, (_, i) => `  if (x === ${i}) return ${i};`).join('\n')}\n  return -1;\n}`;

  it(`une fonction de complexité ${BASE.seuils.complexity + 1} est refusée, avec sa valeur`, () => {
    const msgs = lint(fonction(BASE.seuils.complexity));
    expect(msgs.map((m) => [m.ruleId, valeur(m.message)])).toEqual([
      ['complexity', BASE.seuils.complexity + 1],
    ]);
  });

  it(`une fonction de complexité ${BASE.seuils.complexity} passe`, () => {
    expect(lint(fonction(BASE.seuils.complexity - 1))).toEqual([]);
  });

  it('une imbrication trop profonde et une fonction trop longue sont refusées', () => {
    const d = BASE.seuils['max-depth'] + 1;
    const profonde = `function g(x) {\n${'  if (x) {\n'.repeat(d)}  x++;\n${'  }\n'.repeat(d)}}`;
    // ESLint compte la fonction entière, accolades comprises : ouverture,
    // `let`, (max - 3) incréments, `return`, fermeture = max + 1 lignes.
    const max = BASE.seuils['max-lines-per-function'];
    const longue = `function h() {\n  let a = 0;\n${'  a++;\n'.repeat(max - 3)}  return a;\n}`;
    expect(lint(profonde).map((m) => [m.ruleId, valeur(m.message)])).toEqual([['max-depth', d]]);
    expect(lint(longue).map((m) => [m.ruleId, valeur(m.message)])).toEqual([
      ['max-lines-per-function', max + 1],
    ]);
    // Une ligne de moins, exactement au seuil : passe.
    expect(lint(longue.replace('  a++;\n', ''))).toEqual([]);
  });
});

describe('complexité · `eslint.config.js` applique bien les seuils et la ligne de base', { timeout: 120_000 }, () => {
  // Le premier appel charge `eslint.config.js` et tous ses plugins : mesuré à
  // 20,5 s sur un poste partagé le 2026-11-07. Délai explicite, comme le cliquet.
  const eslint = new ESLint({ cwd: RACINE });
  const niveau = async (fichier) => (await eslint.calculateConfigForFile(fichier)).rules;

  it('un fichier NEUF de src/ reçoit le seuil commun', async () => {
    const r = await niveau('src/modules/__temoin__/nouveau.ts');
    expect(r.complexity).toEqual([2, BASE.seuils.complexity]);
    expect(r['max-depth']).toEqual([2, BASE.seuils['max-depth']]);
    expect(r['max-lines-per-function'][1].max).toBe(BASE.seuils['max-lines-per-function']);
  });

  it('un fichier listé reçoit sa pire valeur mesurée, et rien de plus', async () => {
    const [fichier, mesures] = Object.entries(BASE.fichiers).find(([, m]) => m.complexity);
    const r = await niveau(fichier);
    expect(r.complexity).toEqual([2, Math.max(...mesures.complexity)]);
  });

  it('les tests et shadcn restent hors périmètre', async () => {
    for (const f of ['src/modules/tasks/hooks.test.ts', 'src/components/ui/button.tsx']) {
      const r = await niveau(f);
      expect(r.complexity?.[0] ?? 0, f).toBe(0);
    }
  });
});

describe('complexité · le cliquet, fonction par fonction', () => {
  it(
    'chaque fichier listé a EXACTEMENT les dépassements de la ligne de base',
    async () => {
      const fichiers = Object.keys(BASE.fichiers);
      const disparus = fichiers.filter((f) => !existsSync(path.join(RACINE, f)));
      const eslint = new ESLint({
        cwd: RACINE,
        overrideConfigFile: true,
        overrideConfig: [
          {
            files: ['**/*.{ts,tsx}'],
            languageOptions: {
              parser: tseslint.parser,
              parserOptions: { ecmaFeatures: { jsx: true } },
            },
            rules: regles(BASE.seuils),
          },
        ],
      });
      const resultats = await eslint.lintFiles(fichiers.filter((f) => !disparus.includes(f)));

      const fautes = disparus.map(
        (f) => `${f} : fichier disparu ou renommé, retirer son entrée (ou la reporter sous le nouveau nom).`,
      );
      for (const r of resultats) {
        const f = path.relative(RACINE, r.filePath).split(path.sep).join('/');
        const fatal = r.messages.find((m) => m.fatal);
        if (fatal) {
          fautes.push(`${f} : analyse impossible, la garde ne mesure rien (${fatal.message})`);
          continue;
        }
        for (const regle of REGLES) {
          const mesure = r.messages
            .filter((m) => m.ruleId === regle)
            .map((m) => valeur(m.message))
            .sort((a, b) => b - a);
          const attendu = BASE.fichiers[f]?.[regle] ?? [];
          if (mesure.join() === attendu.join()) continue;
          const monte =
            mesure.length > attendu.length || mesure.some((v, i) => v > (attendu[i] ?? 0));
          fautes.push(
            monte
              ? `${f} · ${regle} : [${mesure.join(', ')}] au lieu de [${attendu.join(', ')}]. ` +
                  'Ça MONTE : découper la fonction, ne pas relever la ligne de base.'
              : `${f} · ${regle} : [${mesure.join(', ')}] au lieu de [${attendu.join(', ')}]. ` +
                  'Ça BAISSE, bravo : recopier la nouvelle valeur dans complexite.baseline.json ' +
                  '(retirer la règle, ou le fichier, si la liste est vide).',
          );
        }
      }
      expect(resultats.length + disparus.length).toBe(fichiers.length);
      expect(fautes, `Cliquet de complexité (docs/ARCHITECTURE.md § 3) :\n${fautes.join('\n')}`).toEqual([]);
    },
    300_000,
  );
});

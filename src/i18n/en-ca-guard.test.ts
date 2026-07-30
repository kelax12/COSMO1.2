// Garde anti-régression : `toLocaleDateString('en-CA')` NE DOIT PAS être
// localisé.
//
// Ce n'est pas un formatage anglais : `'en-CA'` est l'étiquette qui produit un
// `YYYY-MM-DD` en heure LOCALE, utilisée comme clé de date dans tout le
// projet. Un refactor i18n zélé qui remplacerait ces appels par la locale de
// l'utilisateur ressusciterait la classe de bugs de décalage de fuseau déjà
// éradiquée (les complétions d'habitudes basculaient d'un jour la nuit, parce
// que `toISOString()` renvoie de l'UTC).
//
// Ce test lit le SOURCE plutôt que d'appeler les fonctions : le comportement
// est correct dans les deux cas quand on est en UTC+0, donc seul le code peut
// témoigner de l'intention.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** Fichiers où l'idiome est délibéré, avec la fonction qui le porte. */
const GUARDED = [
  { file: 'src/lib/date-presets.ts', fn: 'toLocalYMD' },
  { file: 'src/lib/quick-add-parser.ts', fn: 'toLocalDateString' },
  { file: 'src/lib/stats-insights.ts', fn: 'localDay' },
] as const;

describe("idiome 'en-CA' (YYYY-MM-DD local)", () => {
  it.each(GUARDED)('$file conserve son en-CA', ({ file }) => {
    const source = readFileSync(file, 'utf8');
    expect(
      source.includes("'en-CA'"),
      `${file} a perdu son 'en-CA'. Ce n'est PAS un formatage anglais mais la ` +
        `production d'un YYYY-MM-DD en heure locale. Le remplacer par la locale ` +
        `utilisateur réintroduit les bugs de décalage de fuseau.`
    ).toBe(true);
  });

  it.each(GUARDED)('$file expose toujours $fn', ({ file, fn }) => {
    // Si le helper est renommé ou supprimé, la garde ci-dessus deviendrait un
    // test vide et silencieusement inutile.
    expect(readFileSync(file, 'utf8')).toContain(fn);
  });

  it('ne passe jamais en-CA au chemin localisé de src/i18n/format.ts', () => {
    // `formatDate` est le chemin LOCALISÉ : y coder 'en-CA' en dur signifierait
    // que quelqu'un a confondu les deux usages.
    //
    // On retire les commentaires avant d'assertir — `format.ts` DOCUMENTE
    // justement cette distinction, et sa documentation ne doit pas déclencher
    // sa propre garde.
    const code = stripComments(readFileSync('src/i18n/format.ts', 'utf8'));
    expect(code).not.toContain('en-CA');
  });
});

/** Retire commentaires de bloc et de ligne. Suffisant pour ce garde-fou. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

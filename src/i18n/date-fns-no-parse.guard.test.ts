// Garde : le bundle livre les locales date-fns SANS leur parseur ni leur
// `formatRelative`.
//
// `vite.config.ts` (plugin `cosmo-strip-date-fns-locale-parsers`) remplace les
// clés `match` et `formatRelative` des locales `fr` et `en-US` par un objet qui
// lève. Gain mesuré sur `vendor-utils`, chunk du chemin critique, le
// 2026-10-22 : cf. `docs/PERFORMANCE.md`. Ce n'est juste que tant qu'AUCUN code
// n'appelle `parse()`, `isMatch()` ni `formatRelative()` : ce sont les seules
// fonctions de date-fns qui lisent ces deux clés.
//
// Vitest n'applique pas les plugins de `vite.config.ts` : un test qui
// appellerait `parse()` passerait ici et lèverait en production. D'où une
// garde sur le SOURCE.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RETIRED = ['parse', 'isMatch', 'formatRelative'];
const LOCALE_PARTS = ['match', 'formatRelative'];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe('date-fns sans parseur ni formatRelative dans le bundle', () => {
  it("aucun fichier de src/ n'importe parse(), isMatch() ni formatRelative() de date-fns", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles('src')) {
      const source = readFileSync(file, 'utf8');
      for (const m of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]date-fns(?:\/[^'"]*)?['"]/g)) {
        const names = m[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0]);
        for (const n of names) if (RETIRED.includes(n)) offenders.push(`${file} : ${n}`);
      }
      if (/from\s*['"]date-fns\/(parse|isMatch|formatRelative)['"]/.test(source)) {
        offenders.push(`${file} : import direct`);
      }
    }
    expect(
      offenders,
      'Le build retire ces parties des locales date-fns (vite.config.ts). Les utiliser demande de ' +
        'retirer le plugin, et de repayer leur poids sur le chemin critique. ' +
        'Pour « il y a 2 h », passer par formatRelativeTime (src/i18n/format.ts).',
    ).toEqual([]);
  });

  it('le plugin est toujours branché dans vite.config.ts', () => {
    const config = readFileSync('vite.config.ts', 'utf8');
    expect(config).toMatch(/plugins:\s*\[[^\]]*stripDateFnsLocaleParsers\(\)/);
  });

  // Une montée de date-fns qui change la forme des fichiers ferait échouer le
  // build ; ce test le dit plus tôt, et dit pourquoi.
  it.each(['fr', 'en-US'])('la locale %s a toujours la forme que le plugin attend', (locale) => {
    const source = readFileSync(`node_modules/date-fns/locale/${locale}.mjs`, 'utf8');
    for (const part of LOCALE_PARTS) {
      expect(source).toContain(`import { ${part} } from "./${locale}/_lib/${part}.mjs";`);
      expect(source).toContain(`  ${part}: ${part},`);
    }
  });
});

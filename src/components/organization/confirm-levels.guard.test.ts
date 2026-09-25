// Garde des trois niveaux de confirmation du mode entreprise (cf. OrgConfirmDialog).
//
// Un `window.confirm` ne dit pas l'impact, garde des boutons « OK / Annuler »
// dans la langue du navigateur et bloque le fil principal. Il en restait trois
// le 2026-09-25 (code d'invitation, réorganisation, suppression d'objectif).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS = ['src/components/organization', 'src/pages/organization'];

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sources(p);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });

/** Retire les commentaires : un commentaire peut citer ce qu'il a remplacé. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('confirmations du mode entreprise', () => {
  const files = ROOTS.flatMap(sources).concat('src/pages/OrganizationPage.tsx');

  it('lit bien des fichiers', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("n'utilise jamais window.confirm ni confirm() nu", () => {
    const offenders = files.filter((f) => /(^|[^\w.])(window\.)?confirm\s*\(/.test(code(readFileSync(f, 'utf8'))));
    expect(offenders).toEqual([]);
  });

  it('témoin : la règle voit un confirm() nu', () => {
    expect(/(^|[^\w.])(window\.)?confirm\s*\(/.test(code("if (!window.confirm('x')) return;"))).toBe(true);
    expect(/(^|[^\w.])(window\.)?confirm\s*\(/.test(code('const ok = confirm(msg);'))).toBe(true);
    expect(/(^|[^\w.])(window\.)?confirm\s*\(/.test(code('deleteFlow.confirm(id); // confirm()'))).toBe(false);
  });
});

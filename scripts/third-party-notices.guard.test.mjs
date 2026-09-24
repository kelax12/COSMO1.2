import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectNotices, renderNotices, licenseName, licenseText } from './third-party-notices.mjs';

/**
 * Garde des notices de licences tierces (ligne F9 de docs/LEGAL.md).
 *
 * Le fichier produit est une OBLIGATION de licence : une dépendance
 * transitive oubliée est une mention de copyright qu'on ne reproduit pas.
 * Les cas portent donc sur la FERMETURE du parcours (transitif, imbriqué,
 * dédoublonné), pas sur la mise en forme.
 */

let root;

function pkg(dir, json, license) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(json));
  if (license) fs.writeFileSync(path.join(dir, 'LICENSE'), license);
}

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'notices-'));
  const nm = path.join(root, 'node_modules');
  pkg(root, { name: 'app', dependencies: { a: '1', b: '1' }, devDependencies: { dev: '1' } });
  pkg(path.join(nm, 'a'), { name: 'a', version: '1.0.0', license: 'MIT', dependencies: { c: '1' } }, 'MIT (a)');
  pkg(path.join(nm, 'b'), { name: 'b', version: '2.0.0', license: 'ISC', dependencies: { c: '2' } }, 'ISC (b)');
  // c@1 hissé à la racine, c@2 imbriqué sous b : deux versions, deux notices.
  pkg(path.join(nm, 'c'), { name: 'c', version: '1.0.0', license: 'BSD-3-Clause' }, 'BSD (c1)');
  pkg(path.join(nm, 'b', 'node_modules', 'c'), { name: 'c', version: '2.0.0', license: { type: 'Apache-2.0' } });
  pkg(path.join(nm, 'dev'), { name: 'dev', version: '9.9.9', license: 'GPL-3.0' }, 'GPL');
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('third-party-notices', () => {
  it('suit les dependances TRANSITIVES, y compris imbriquees, sans les devDependencies', () => {
    const entries = collectNotices(root);
    expect(entries.map((e) => `${e.name}@${e.version}`)).toEqual([
      'a@1.0.0', 'b@2.0.0', 'c@1.0.0', 'c@2.0.0',
    ]);
  });

  it('reproduit le texte de la licence, et dit quand le paquet n en fournit pas', () => {
    const out = renderNotices(collectNotices(root));
    expect(out).toContain('MIT (a)');
    expect(out).toContain('BSD (c1)');
    expect(out).toContain('c@2.0.0 · Apache-2.0');
    expect(out).toContain('Aucun fichier de licence fourni par le paquet. Licence déclarée : Apache-2.0.');
    expect(out).not.toContain('GPL');
  });

  it('lit les trois formes du champ licence', () => {
    expect(licenseName({ license: 'MIT' })).toBe('MIT');
    expect(licenseName({ license: { type: 'ISC' } })).toBe('ISC');
    expect(licenseName({ licenses: [{ type: 'MIT' }, { type: 'Apache-2.0' }] })).toBe('MIT OR Apache-2.0');
    expect(licenseName({})).toBe('UNKNOWN');
  });

  it('reconnait LICENCE, LICENSE.md et COPYING', () => {
    for (const file of ['LICENCE', 'LICENSE.md', 'COPYING']) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lic-'));
      fs.writeFileSync(path.join(dir, file), ' texte ');
      expect(licenseText(dir)).toBe('texte');
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

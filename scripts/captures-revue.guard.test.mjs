// ═══════════════════════════════════════════════════════════════════
// captures-revue.guard.test.mjs · le TÉMOIN de l'artefact de revue (V15.4)
//
// Il fabrique de vrais PNG, rejoue `captures-revue.mjs` et refuse un artefact
// qui ne montrerait pas ce qui a changé : une capture modifiée doit sortir
// avec son avant, son après et sa différence, une capture identique ne doit
// rien produire, et une régénération qui n'a rien écrit doit échouer.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { comparer, listerPng, pageIndex, produire, run } from './captures-revue.mjs';

const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle');

function png(w, h, [r, g, b], pixelsRouges = []) {
  const p = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) { p.data[i * 4] = r; p.data[i * 4 + 1] = g; p.data[i * 4 + 2] = b; p.data[i * 4 + 3] = 255; }
  for (const i of pixelsRouges) { p.data[i * 4] = 255; p.data[i * 4 + 1] = 0; p.data[i * 4 + 2] = 0; }
  return PNG.sync.write(p);
}

function monde() {
  const d = mkdtempSync(join(tmpdir(), 'captures-revue-'));
  for (const s of ['avant', 'apres']) mkdirSync(join(d, s, 'linux'), { recursive: true });
  const poser = (s, nom, octets) => writeFileSync(join(d, s, 'linux', nom), octets);
  return { d, poser, avant: join(d, 'avant'), apres: join(d, 'apres'), sortie: join(d, 'out') };
}

describe('comparer', () => {
  it('compte les pixels qui diffèrent, seuil 0', () => {
    const a = PNG.sync.read(png(10, 10, [255, 255, 255]));
    const b = PNG.sync.read(png(10, 10, [255, 255, 255], [3, 4]));
    const c = comparer(a, b);
    expect(c.memeTaille).toBe(true);
    expect(c.pixels).toBe(2);
    expect(c.total).toBe(100);
    expect(c.image.data[3 * 4]).toBe(255);
    expect(c.image.data[3 * 4 + 1]).toBe(0);
  });
  it('signale des tailles différentes sans fabriquer de diff', () => {
    const c = comparer(PNG.sync.read(png(10, 10, [0, 0, 0])), PNG.sync.read(png(10, 12, [0, 0, 0])));
    expect(c.memeTaille).toBe(false);
    expect(c.image).toBeNull();
  });
});

describe('produire : modifiée, ajoutée, supprimée, identique', () => {
  it('écrit avant, après, diff et l index pour ce qui change, et rien pour l identique', () => {
    const m = monde();
    try {
      m.poser('avant', 'stable.png', png(8, 8, [10, 10, 10]));
      m.poser('apres', 'stable.png', png(8, 8, [10, 10, 10]));
      m.poser('avant', 'bouge.png', png(8, 8, [255, 255, 255]));
      m.poser('apres', 'bouge.png', png(8, 8, [255, 255, 255], [0, 1, 2]));
      m.poser('avant', 'taille.png', png(8, 8, [0, 0, 0]));
      m.poser('apres', 'taille.png', png(8, 9, [0, 0, 0]));
      m.poser('apres', 'neuve.png', png(8, 8, [1, 2, 3]));
      m.poser('avant', 'partie.png', png(8, 8, [1, 2, 3]));
      const r = produire(m);
      expect(r.compte).toEqual({ modifiee: 2, ajoutee: 1, supprimee: 1, identique: 1 });
      const sortie = (p) => existsSync(join(m.sortie, p));
      expect(sortie('avant/linux/bouge.png') && sortie('apres/linux/bouge.png') && sortie('diff/linux/bouge.png')).toBe(true);
      expect(sortie('diff/linux/taille.png')).toBe(false);
      expect(sortie('apres/linux/neuve.png')).toBe(true);
      expect(sortie('avant/linux/partie.png')).toBe(true);
      expect(sortie('avant/linux/stable.png')).toBe(false);
      const html = readFileSync(join(m.sortie, 'index.html'), 'utf8');
      expect(html).toContain('3 pixel(s) sur 64');
      expect(html).toContain('MODIFIÉE');
      expect(html).toContain('AJOUTÉE');
      expect(html).toContain('SUPPRIMÉE');
      expect(html).toContain('dimensions différentes');
      expect(html).not.toContain('stable.png');
      expect(html).not.toMatch(/<script/);
    } finally { rmSync(m.d, { recursive: true, force: true }); }
  });

  it('octets identiques : aucune entrée à relire', () => {
    const m = monde();
    try {
      m.poser('avant', 'a.png', png(4, 4, [9, 9, 9]));
      m.poser('apres', 'a.png', png(4, 4, [9, 9, 9]));
      const r = produire(m);
      expect(r.compte.identique).toBe(1);
      expect(pageIndex(r)).toContain('rien à relire');
    } finally { rmSync(m.d, { recursive: true, force: true }); }
  });

  it('échappe un nom de fichier piégé dans la page', () => {
    const html = pageIndex({ compte: { modifiee: 0, ajoutee: 1, supprimee: 0, identique: 0 }, entrees: [{ chemin: '<img src=x onerror=1>.png', etat: 'ajoutee' }] });
    expect(html).not.toContain('<img src=x onerror=1>');
  });
});

describe('run', () => {
  it('échoue quand la régénération n a rien écrit, au lieu d un artefact vide et vert', () => {
    const m = monde();
    try {
      m.poser('avant', 'a.png', png(4, 4, [9, 9, 9]));
      const erreurs = [];
      expect(run({ argv: ['--avant', m.avant, '--apres', m.apres, '--sortie', m.sortie], log: () => {}, erreur: (l) => erreurs.push(l) })).toBe(1);
      expect(erreurs.join()).toMatch(/aucun PNG/);
      expect(run({ argv: [], log: () => {}, erreur: () => {} })).toBe(1);
    } finally { rmSync(m.d, { recursive: true, force: true }); }
  });
  it('réussit et compte', () => {
    const m = monde();
    try {
      m.poser('apres', 'a.png', png(4, 4, [9, 9, 9]));
      const lignes = [];
      expect(run({ argv: ['--avant', m.avant, '--apres', m.apres, '--sortie', m.sortie], log: (l) => lignes.push(l), erreur: () => {} })).toBe(0);
      expect(lignes[0]).toMatch(/1 ajoutée/);
      expect(listerPng(m.apres)).toEqual(['linux/a.png']);
    } finally { rmSync(m.d, { recursive: true, force: true }); }
  });
});

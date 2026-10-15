// ═══════════════════════════════════════════════════════════════════
// TÉMOIN — le rejeu des sabotages (C-81, AM-1) se vérifie lui-même
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 `check:sabotages` est la garde qui garde les gardes. Si son compteur se
// trompe, le ratio publié ment ; si son juge confond un plantage avec un
// rouge, chaque sabotage passe pour « vu » ; si son nettoyage suit le lien
// `node_modules`, il efface le dépôt. Chacun de ces trois défauts est soumis
// ici à un cas qui DOIT le voir.

import { describe, it, expect } from 'vitest';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

import {
  porteLaMarque, temoinsDuSource, motifDuGabarit, jugerVitest, jugerCommande, lireRapportVitest,
  verifierModif, appliquerModifs, restaurer, verifierCatalogue, nettoyerAtelier, selonLeFichier, repartir, CATALOGUE,
} from './replay-sabotages.mjs';

const ts = createRequire(join(process.cwd(), 'package.json'))('typescript');
const LF = String.fromCharCode(10);

/** Un cas de rapport vitest, réduit à ce que le juge lit. */
const cas = (titre, statut, chemin = []) => ({ titre, chemin, cle: [...chemin, titre].join(' > '), statut });

describe('témoin — le recensement des témoins (AM-1)', () => {
  it('voit la marque en capitales, et l étiquette en tête ou entre parenthèses', () => {
    expect(porteLaMarque('TEMOIN : le detecteur voit un window.confirm')).toBe(true);
    expect(porteLaMarque('TEMOIN DU TEMOIN : sans `dist`, la garde ECHOUE')).toBe(true);
    expect(porteLaMarque('TÉMOIN — sans le hook, Échap est mort')).toBe(true);
    // 🔴 Le cas qui distingue les capitales de l'étiquette : `TÉMOIN` en
    // MILIEU de titre. En tête, la variante minuscule (`/i`) le rattrapait, et
    // un `É` oublié dans les capitales passait inaperçu (rejeu du 2026-10-15).
    expect(porteLaMarque('le découpage, TÉMOIN du plafond')).toBe(true);
    expect(porteLaMarque('témoin : la règle voit un confirm() nu')).toBe(true);
    expect(porteLaMarque('témoin — effacement dérivé du schéma (C-92)')).toBe(true);
    expect(porteLaMarque('détecte réellement une poignée sans geste (témoin)')).toBe(true);
  });

  it('ne compte PAS un titre qui PARLE des témoins sans en être un', () => {
    expect(porteLaMarque('AUCUNE Edge Function n est sans temoin')).toBe(false);
    expect(porteLaMarque('`listerTemoins` ramasse les trois familles de tests')).toBe(false);
    expect(porteLaMarque('chaque sabotage nomme sa cible, son témoin et ce qu il protège')).toBe(false);
    expect(porteLaMarque('refuse un temoin a un seul palier')).toBe(false);
  });

  it('lit l AST : describe porteur, it.each, regex.test et appel sans fonction', () => {
    const source = [
      "describe('témoin — un groupe', () => {",
      "  it('un cas sans marque', () => {});",
      "  it.each([1, 2])('cas %s', () => {});",
      '});',
      "it('TEMOIN : un cas marqué', () => { expect(/TEMOIN/.test('TEMOIN')).toBe(true); });",
      "it('un cas ordinaire', () => {});",
      "describe('ordinaire', () => { it(`(témoin) ${'gabarit'}`, () => {}); });",
      "it.todo('TEMOIN : pas encore écrit');",
      "const x = REGEX.test('TEMOIN : une chaîne testée par une regex');",
    ].join(LF);
    const t = temoinsDuSource(source, 'x.test.ts', ts);
    expect(t.map((e) => e.cle)).toEqual([
      'témoin — un groupe > un cas sans marque',
      'témoin — un groupe > cas %s',
      'TEMOIN : un cas marqué',
      "ordinaire > (témoin) ${'gabarit'}",
    ]);
    expect(t.map((e) => e.parSonNom)).toEqual([false, false, true, true]);
    expect(t.map((e) => e.gabarit)).toEqual([false, true, false, true]);
    expect(t[2].ligne).toBe(5);
  });

  it('un titre construit ne s apparie qu aux cas de SON gabarit', () => {
    const m = motifDuGabarit('verifierJob : sabotages (témoins) > %s');
    expect(m.test('verifierJob : sabotages (témoins) > un continue-on-error')).toBe(true);
    expect(m.test('verifierJob : autre chose > un continue-on-error')).toBe(false);
    expect(motifDuGabarit('d > ${table} finit en SET NULL').test('d > friends finit en SET NULL')).toBe(true);
    expect(motifDuGabarit('d > ${table} finit en SET NULL').test('d > friends finit en CASCADE')).toBe(false);
  });

  it('lit le TSX sans se tromper de nombre', () => {
    const source = "it('TÉMOIN — rend', () => { render(<Harness withHook={false} />); });";
    expect(temoinsDuSource(source, 'x.test.tsx', ts)).toHaveLength(1);
  });
});

describe('témoin — le juge d un sabotage (AM-1)', () => {
  const base = { cas: [cas('garde', 'passed'), cas('TEMOIN : voit', 'passed'), cas('deja', 'failed')] };

  it('rend VU un cas attendu passé du vert au rouge, et liste les bascules', () => {
    const sabote = { cas: [cas('garde', 'failed'), cas('TEMOIN : voit', 'failed'), cas('deja', 'failed')] };
    const v = jugerVitest(['garde'], base, sabote);
    expect(v.ok).toBe(true);
    expect(v.bascules).toEqual(['garde', 'TEMOIN : voit']);
  });

  it('REFUSE un cas resté vert', () => {
    const v = jugerVitest(['garde'], base, { cas: [cas('garde', 'passed')] });
    expect(v.ok).toBe(false);
    expect(v.motif).toMatch(/reste VERT/);
  });

  it('REFUSE un fichier qui a planté : un cas ABSENT du rapport n est pas un rouge', () => {
    const v = jugerVitest(['garde'], base, { cas: [], message: 'SyntaxError: Unexpected token' });
    expect(v.ok).toBe(false);
    expect(v.motif).toMatch(/ABSENT du rapport/);
  });

  it('REFUSE un cas déjà rouge sur la copie propre', () => {
    const v = jugerVitest(['deja'], base, { cas: [cas('deja', 'failed')] });
    expect(v.ok).toBe(false);
    expect(v.motif).toMatch(/déjà failed sur la copie PROPRE/);
  });

  it('REFUSE un nom ambigu ou disparu, et un catalogue sans attendu', () => {
    const double = { cas: [cas('x', 'passed', ['a']), cas('x', 'passed', ['b'])] };
    expect(jugerVitest(['x'], double, { cas: [] }).motif).toMatch(/2 cas portent ce nom/);
    expect(jugerVitest(['a > x'], double, { cas: [cas('x', 'failed', ['a'])] }).ok).toBe(true);
    expect(jugerVitest(['disparu'], base, base).motif).toMatch(/0 cas portent ce nom/);
    expect(jugerVitest([], base, base).ok).toBe(false);
  });

  it('une commande : rouge, raison nommée, et ABSENTE de la référence', () => {
    const raison = /`sabotage_notes` porte/;
    const propre = { code: 0, sortie: 'ok' };
    expect(jugerCommande(raison, propre, { code: 1, sortie: '- `sabotage_notes` porte une colonne' }).ok).toBe(true);
    expect(jugerCommande(raison, propre, { code: 0, sortie: '`sabotage_notes` porte' }).motif).toMatch(/reste VERTE/);
    expect(jugerCommande(raison, propre, { code: 1, sortie: 'Error: ENOENT' }).motif).toMatch(/autre raison/);
    expect(jugerCommande(raison, { code: 1, sortie: '`sabotage_notes` porte' }, { code: 1, sortie: '`sabotage_notes` porte' }).motif)
      .toMatch(/DÉJÀ dans la sortie de la copie propre/);
  });

  it('le rapport doit porter le fichier visé, et lui seul', () => {
    const un = { testResults: [{ name: '/tmp/x/src/a.guard.test.ts', assertionResults: [{ title: 't', ancestorTitles: ['d'], status: 'passed' }] }] };
    expect(lireRapportVitest(un, 'src/a.guard.test.ts', 0).cas[0].cle).toBe('d > t');
    expect(lireRapportVitest(un, 'src/b.guard.test.ts', 0).panne).toMatch(/attendu : src\/b\.guard\.test\.ts seul/);
    const deux = { testResults: [...un.testResults, { name: '/tmp/x/src/aa.guard.test.ts', assertionResults: [] }] };
    expect(lireRapportVitest(deux, 'src/a.guard.test.ts', 0).panne).toMatch(/2 fichier/);
  });
});

describe('témoin — sabotage et restauration dans la copie (AM-1)', () => {
  it('refuse un motif ambigu ou absent, applique littéralement, restaure octet pour octet', () => {
    const d = mkdtempSync(join(tmpdir(), 'sabot-'));
    try {
      writeFileSync(join(d, 'a.txt'), 'un deux deux\r\ntrois');
      expect(verifierModif(d, { fichier: 'a.txt', chercher: 'deux', remplacer: 'x' })).toMatch(/2 fois/);
      expect(verifierModif(d, { fichier: 'a.txt', chercher: 'quatre', remplacer: 'x' })).toMatch(/0 fois/);
      expect(verifierModif(d, { fichier: 'b.txt', creer: 'x' })).toBeNull();
      expect(verifierModif(d, { fichier: 'a.txt', creer: 'x' })).toMatch(/existe déjà/);

      const originaux = appliquerModifs(d, [
        { fichier: 'a.txt', chercher: 'trois', remplacer: '$& $1' },
        { fichier: 'sous/b.txt', creer: 'neuf' },
      ]);
      // `$&` reste LITTÉRAL : un remplacement interprété saboterait autre chose.
      expect(readFileSync(join(d, 'a.txt'), 'utf8')).toBe('un deux deux\r\n$& $1');
      expect(existsSync(join(d, 'sous', 'b.txt'))).toBe(true);

      expect(restaurer(d, originaux)).toEqual([]);
      expect(readFileSync(join(d, 'a.txt'), 'utf8')).toBe('un deux deux\r\ntrois');
      expect(existsSync(join(d, 'sous', 'b.txt'))).toBe(false);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it('un motif sur plusieurs lignes suit les fins de ligne du fichier (CRLF ici, LF sur le runner)', () => {
    const d = mkdtempSync(join(tmpdir(), 'sabot-crlf-'));
    try {
      writeFileSync(join(d, 'w.txt'), 'a\r\nb\r\nc');
      writeFileSync(join(d, 'l.txt'), 'a\nb\nc');
      const m = (fichier) => ({ fichier, chercher: 'a\nb', remplacer: 'x\ny' });
      expect(verifierModif(d, m('w.txt'))).toBeNull();
      expect(verifierModif(d, m('l.txt'))).toBeNull();
      appliquerModifs(d, [m('w.txt'), m('l.txt')]);
      expect(readFileSync(join(d, 'w.txt'), 'utf8')).toBe('x\r\ny\r\nc');
      expect(readFileSync(join(d, 'l.txt'), 'utf8')).toBe('x\ny\nc');
      expect(selonLeFichier('sans fin de ligne', 'a\nb')).toBe('a\nb');
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it('TEMOIN : le nettoyage ne traverse JAMAIS le lien node_modules', () => {
    // 🔴 Le défaut que ce cas existe pour voir a déjà coûté un node_modules
    // entier (mémoire « worktree + junction », récidive du 2026-09-25).
    const cible = mkdtempSync(join(tmpdir(), 'sabot-cible-'));
    const base = mkdtempSync(join(tmpdir(), 'sabot-atelier-'));
    try {
      writeFileSync(join(cible, 'precieux.txt'), 'ne pas effacer');
      const copie = join(base, 'arbre');
      mkdirSync(copie);
      writeFileSync(join(copie, 'f.txt'), 'x');
      symlinkSync(cible, join(copie, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');

      expect(nettoyerAtelier({ base, copie })).toBe(true);
      expect(existsSync(base)).toBe(false);
      expect(readFileSync(join(cible, 'precieux.txt'), 'utf8')).toBe('ne pas effacer');
    } finally {
      rmSync(base, { recursive: true, force: true });
      rmSync(cible, { recursive: true, force: true });
    }
  });
});

describe('les voies parallèles', () => {
  it('une garde ne se partage jamais entre deux copies, et les voies s équilibrent', () => {
    const s = (id, garde) => ({ id, garde });
    const cat = [
      s('a1', 'a.test.ts'), s('a2', 'a.test.ts'), s('a3', 'a.test.ts'),
      s('b1', 'b.test.ts'), s('b2', 'b.test.ts'),
      s('c1', { commande: 'scripts/c.mjs' }), s('c2', { commande: 'scripts/c.mjs' }),
      s('d1', 'd.test.ts'),
    ];
    const voies = repartir(cat, 3);
    expect(voies).toHaveLength(3);
    expect(voies.flat().map((x) => x.id).sort()).toEqual(cat.map((x) => x.id).sort());
    for (const g of ['a.test.ts', 'b.test.ts', 'd.test.ts']) {
      expect(voies.filter((v) => v.some((x) => x.garde === g))).toHaveLength(1);
    }
    expect(Math.max(...voies.map((v) => v.length))).toBe(3);
    // Une seule voie demandée : tout le catalogue, une seule copie.
    expect(repartir(cat, 1)).toHaveLength(1);
    expect(repartir(cat, 10)).toHaveLength(4);
  });
});

describe('témoin — la forme du catalogue (C-81)', () => {
  it('le catalogue réel est bien formé', () => {
    expect(verifierCatalogue(CATALOGUE)).toEqual([]);
  });

  it('refuse un sabotage sans attendu, sans raison, ou qui ne change rien', () => {
    const e = verifierCatalogue([
      { id: 'a', famille: 'produit', garde: 'src/x.guard.test.ts', modifs: [{ fichier: 'f', chercher: 'x', remplacer: 'y' }], pourquoi: 'p'.repeat(50) },
      { id: 'b', famille: 'produit', garde: { commande: 'scripts/x.mjs' }, modifs: [{ fichier: 'f', creer: '' }], pourquoi: 'p'.repeat(50) },
      { id: 'c', famille: 'autre', garde: 'src/x.guard.test.ts', attendu: ['t'], modifs: [{ fichier: 'f', chercher: 'x', remplacer: 'x' }], pourquoi: 'court' },
    ]);
    expect(e.join(LF)).toMatch(/a : aucun cas `attendu`/);
    expect(e.join(LF)).toMatch(/b : une garde-commande exige/);
    expect(e.join(LF)).toMatch(/c : famille/);
    expect(e.join(LF)).toMatch(/c : modification de f sans/);
    expect(e.join(LF)).toMatch(/c : `pourquoi` absent ou trop court/);
  });
});

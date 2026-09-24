// ═══════════════════════════════════════════════════════════════════
// TÉMOIN — le budget de bundle, et son plafond PAR CHUNK (C-85)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI CE FICHIER. `check-bundle-budget.mjs` est la garde la plus
// facile à désarmer du dépôt sans que personne le voie : elle lit `dist/`, et
// `dist/` n'existe pas dans un checkout frais. Une expression cassée, un nom
// de base mal découpé, une boucle qui ne parcourt plus rien — et elle imprime
// « Budget de bundle respecté » sur zéro chunk mesuré.
//
// Le précédent est écrit dans le fichier lui-même : le quantificateur `{8,}`
// du découpage de hash mangeait le nom (`vendor-charts-DMeWk7Ji.js` devenait
// `vendor`), et les exemptions ne matchaient plus rien. Personne ne l'a vu
// par la lecture.
//
// CE QUE CE TÉMOIN FAIT : il construit un `dist/` SYNTHÉTIQUE dans un dossier
// jetable, y pose des chunks de taille choisie, lance la vraie garde en
// sous-processus, et vérifie qu'elle rougit sur ce qu'elle doit voir et reste
// verte sur ce qu'elle doit laisser passer.
//
// ⚠️ Les chunks synthétiques sont remplis d'octets ALÉATOIRES : ils sont donc
// incompressibles, et leur taille gzip est à peu près leur taille brute. Du
// texte répété donnerait 200 octets gzip pour 200 ko de fichier, et le témoin
// ne mesurerait plus rien — le piège est le même que celui qu'il garde.

import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const GARDE = join(process.cwd(), 'scripts', 'check-bundle-budget.mjs');
const LF = String.fromCharCode(10);

/**
 * Les noms de base declares dans `PLAFONDS_PAR_CHUNK`, lus dans la SOURCE.
 *
 * 🔴 Pourquoi les lire au lieu de les importer : la garde s'execute a
 * l'import (elle lit `dist/` et sort en 1 s'il manque). L'importer ici
 * tuerait le test avant son premier `expect`.
 *
 * ⚠️ Pourquoi il FAUT les poser dans chaque dist synthetique : la garde
 * echoue sur un plafond PERIME, c'est-a-dire declare pour un chunk qui n'est
 * plus dans le build. C'est voulu — une table de plafonds qui decrit des
 * chunks morts cesse d'etre relue. Mais ca veut dire qu'un dist synthetique
 * qui n'en poserait aucun serait rouge pour cette raison-la, et le temoin
 * mesurerait le mauvais defaut.
 */
function basesDeclarees() {
  const source = readFileSync(GARDE, 'utf8');
  const debut = source.indexOf('const PLAFONDS_PAR_CHUNK = {');
  const fin = source.indexOf('};', debut);
  expect(debut, 'PLAFONDS_PAR_CHUNK introuvable dans la garde').toBeGreaterThan(-1);
  const bloc = source.slice(debut, fin);
  return [...bloc.matchAll(/^\s*'?([A-Za-z][A-Za-z0-9-]*)'?:\s*[\d_]+/gm)].map((m) => m[1]);
}

/**
 * Taille du chunk MINUSCULE posé pour une base déclarée : 1 000 octets, ou la
 * MOITIÉ de son plafond s'il est plus bas.
 *
 * 🔴 Un 1 000 fixe supposait qu'aucun plafond ne descend sous ~1 ko. Faux
 * depuis le 2026-09-24 : `legalShared` (deux libellés, 231 o mesurés) a un
 * plafond de 300 o, et le témoin rougissait sur son propre remplissage, pas
 * sur ce qu'il annonce mesurer. La moitié du plafond laisse la marge de
 * l'en-tête gzip (~20 o) sur des octets aléatoires.
 */
function remplissage(base) {
  const source = readFileSync(GARDE, 'utf8');
  const bloc = source.slice(source.indexOf('const PLAFONDS_PAR_CHUNK = {'));
  const ligne = bloc.split(LF).find((l) => l.trim().replace(/'/g, '').startsWith(`${base}:`));
  const chiffre = ligne ? /:\s*([\d_]+)/.exec(ligne) : null;
  const plafond = chiffre ? Number(chiffre[1].replace(/_/g, '')) : Infinity;
  return Math.min(1_000, Math.floor(plafond / 2));
}

/** Un chunk de `octets` octets incompressibles, nommé comme Vite le nomme. */
function poserChunk(dossier, base, octets) {
  // 8 caractères de hash exactement : c'est ce que découpe la garde.
  const nom = `${base}-Ab3xZ9_q.js`;
  writeFileSync(join(dossier, nom), randomBytes(octets));
  return nom;
}

/**
 * Monte un `dist/` synthétique et rend son chemin.
 *
 * `sentry-client` est toujours posé au-dessus de son plancher : sans lui la
 * garde échoue pour une AUTRE raison (« Sentry n'est pas expédié »), et le
 * témoin ne mesurerait plus ce qu'il croit mesurer.
 */
function monterDist(chunks) {
  const racine = mkdtempSync(join(tmpdir(), 'c85-'));
  const assets = join(racine, 'dist', 'assets');
  mkdirSync(assets, { recursive: true });

  const entree = poserChunk(assets, 'index', 40_000);
  poserChunk(assets, 'sentry-client', 45_000);
  // Chaque base declaree recoit un chunk MINUSCULE : la garde ne peut alors
  // rougir sur un plafond perime, et le cas mesure ce qu'il annonce.
  for (const base of basesDeclarees()) {
    if (base === 'index' || base === 'sentry-client') continue;
    if (base in chunks) continue;
    poserChunk(assets, base, remplissage(base));
  }
  for (const [base, octets] of Object.entries(chunks)) poserChunk(assets, base, octets);

  writeFileSync(
    join(racine, 'dist', 'index.html'),
    `<!doctype html><html><head><script type="module" src="/assets/${entree}"></script></head><body></body></html>`,
  );
  return racine;
}

/** Lance la vraie garde dans `racine`, rend `{ code, sortie }`. */
function lancer(racine) {
  try {
    const sortie = execFileSync(process.execPath, [GARDE], {
      cwd: racine,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, sortie };
  } catch (e) {
    return { code: e.status ?? 1, sortie: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

function avec(chunks, verifier) {
  const racine = monterDist(chunks);
  try {
    verifier(lancer(racine));
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}

describe('témoin — budget de bundle par chunk (C-85)', () => {
  it('un build sain passe, et la garde dit combien de chunks elle a mesures', () => {
    // 🔴 Le contrôle anti-« garde qui répond sans mesurer » : si elle sortait
    // 0 en n'ayant lu aucun chunk, ce cas passerait quand même. On exige donc
    // qu'elle NOMME ce qu'elle a vu.
    avec({ TasksPage: 30_000, autre: 5_000 }, ({ code, sortie }) => {
      expect(sortie).toContain('Budget de bundle respecté');
      expect(sortie).toMatch(/\d+ chunks/);
      expect(sortie).toContain('TasksPage');
      expect(code).toBe(0);
    });
  });

  it('un chunk qui DEPASSE son plafond propre fait rougir la garde', () => {
    // `TasksPage` est plafonné à 37 000 o depuis C-85. À 60 ko il reste sous
    // le budget de page générique (70 ko) : AVANT C-85, ce cas passait au
    // vert. C'est exactement la dérive que l'item décrit.
    avec({ TasksPage: 60_000 }, ({ code, sortie }) => {
      expect(code).toBe(1);
      expect(sortie).toContain('TasksPage');
      expect(sortie).toContain('plafond propre');
      expect(sortie).toContain('CLIQUET');
    });
  });

  it('un chunk SANS plafond propre reste juge par le budget de page', () => {
    // Un écran neuf n'a pas à être déclaré pour exister ; il doit seulement
    // rester sous la borne générique.
    avec({ EcranNeuf: 90_000 }, ({ code, sortie }) => {
      expect(code).toBe(1);
      expect(sortie).toContain('EcranNeuf');
      expect(sortie).toContain('à EXEMPT');
    });
    avec({ EcranNeuf: 40_000 }, ({ code }) => {
      expect(code).toBe(0);
    });
  });

  it('un plafond PERIME (chunk disparu) fait rougir la garde', () => {
    // 🔴 Sans ce contrôle, la table des plafonds deviendrait un inventaire de
    // chunks morts, c'est-à-dire un document qu'on cesse de relire. Ce cas
    // monte donc un dist À LA MAIN, sans les bases déclarées.
    const racine = mkdtempSync(join(tmpdir(), 'c85p-'));
    try {
      const assets = join(racine, 'dist', 'assets');
      mkdirSync(assets, { recursive: true });
      const entree = poserChunk(assets, 'index', 40_000);
      poserChunk(assets, 'sentry-client', 45_000);
      writeFileSync(
        join(racine, 'dist', 'index.html'),
        `<!doctype html><html><head><script type="module" src="/assets/${entree}"></script></head><body></body></html>`,
      );
      const { code, sortie } = lancer(racine);
      expect(code).toBe(1);
      expect(sortie).toContain("n'existe plus dans");
      expect(sortie).toContain('vendor-charts');
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it('LA SOMME par nom de base, pas le plus gros fichier', () => {
    // 🔴 Vite émet plusieurs fichiers sous un même nom de base. Juger le plus
    // gros laisserait un baril de plus arriver gratuitement. Ici, trois
    // fichiers `TasksPage-*` de 15 ko chacun : chacun est sous le plafond de
    // 37 ko, leur somme (45 ko) ne l'est pas.
    const racine = mkdtempSync(join(tmpdir(), 'c85s-'));
    try {
      const assets = join(racine, 'dist', 'assets');
      mkdirSync(assets, { recursive: true });
      const entree = 'index-Ab3xZ9_q.js';
      writeFileSync(join(assets, entree), randomBytes(40_000));
      writeFileSync(join(assets, 'sentry-client-Ab3xZ9_q.js'), randomBytes(45_000));
      for (const base of basesDeclarees()) {
        if (base === 'index' || base === 'sentry-client' || base === 'TasksPage') continue;
        poserChunk(assets, base, remplissage(base));
      }
      for (const h of ['Aa1aaaaa', 'Bb2bbbbb', 'Cc3ccccc']) {
        writeFileSync(join(assets, `TasksPage-${h}.js`), randomBytes(15_000));
      }
      writeFileSync(
        join(racine, 'dist', 'index.html'),
        `<!doctype html><html><head><script type="module" src="/assets/${entree}"></script></head><body></body></html>`,
      );
      const { code, sortie } = lancer(racine);
      expect(sortie).toContain('(3 chunks)');
      expect(sortie).toContain('TasksPage');
      expect(code).toBe(1);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("le chunk d'ENTREE n'est pas compte deux fois", () => {
    // 🔴 L'entrée porte le nom de base `index`, comme les huit barils de
    // modules. La compter dans la somme `index` ferait échouer la garde sur
    // une ADDITION et non sur une dérive — un rouge qu'on finirait par
    // « corriger » en remontant le plafond.
    // Ici : une entrée de 40 ko seule. Si elle était comptée dans la somme
    // `index`, la ligne `chunk index` apparaîtrait ; elle ne doit pas.
    avec({ TasksPage: 10_000 }, ({ code, sortie }) => {
      expect(code).toBe(0);
      expect(sortie).toMatch(/entrée\s+40\.0 ko/);
      expect(sortie).not.toMatch(/^chunk\s+index\s/m);
    });
  });

  it('TEMOIN DU TEMOIN : sans `dist`, la garde ECHOUE au lieu de se taire', () => {
    // Une garde qui, faute d'artefact, imprimerait « respecté » serait la
    // pire des quatre gardes que `scripts/CLAUDE.md` met en cause.
    const vide = mkdtempSync(join(tmpdir(), 'c85v-'));
    try {
      const { code, sortie } = lancer(vide);
      expect(code).toBe(1);
      expect(sortie).toContain('dist/assets introuvable');
      expect(sortie).not.toContain('respecté');
    } finally {
      rmSync(vide, { recursive: true, force: true });
    }
  });

  it('le decoupage du hash ne mange pas le nom de base', () => {
    // 🔴 Le défaut réel documenté dans la garde : `{8,}` gourmand transformait
    // `vendor-charts-DMeWk7Ji.js` en `vendor`. Le hash Vite est en base64url
    // et peut contenir un tiret — ce cas en pose un exprès.
    avec({ 'vendor-charts': 100_000 }, ({ sortie }) => {
      expect(sortie).toContain('vendor-charts');
      expect(sortie).not.toMatch(/chunk\s+vendor\s/);
    });
  });
});

// Sans cette ligne, un `console.log` du sous-processus se mêlerait à la sortie
// de vitest sur certains terminaux Windows.
export const _ = LF;

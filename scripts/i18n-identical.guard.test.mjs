// ═══════════════════════════════════════════════════════════════════
// i18n-identical.guard.test.mjs — le TEMOIN du cliquet des identites fr/en
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// `i18n-identical.mjs` est un cliquet a ZERO qui repond « rien a traduire ».
// Une garde qui se trompe dans le sens rassurant est pire qu'une garde absente
// (CLAUDE.md, § « une garde se verifie sur ce qu'elle REGARDE ») : quatre l'ont
// deja fait dans ce depot en cinq jours, dont `i18n:scan` TROIS fois.
//
// Chaque cas ci-dessous SOUMET au script reel un catalogue fabrique et exige
// qu'il rende le bon verdict. Le plus important est le premier : sans lui, un
// script qui ne detecterait plus RIEN passerait tous les autres.
//
// Le script est execute TEL QUEL dans un dossier temporaire pris pour cwd
// (`src/locales` et l'allowlist sont des chemins relatifs) — jamais
// re-implemente ici. Une garde qui reecrit la logique qu'elle teste ne teste
// que sa copie.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = resolve(process.cwd(), 'scripts/i18n-identical.mjs');

const CATEGORIES = {
  'nom-propre': 'Nom de marque.',
  'mot-identique': 'Meme graphie dans les deux langues.',
};

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'i18n-identical-guard-'));
  mkdirSync(join(dir, 'src/locales/fr'), { recursive: true });
  mkdirSync(join(dir, 'src/locales/en'), { recursive: true });
  mkdirSync(join(dir, 'scripts'), { recursive: true });
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/**
 * Ecrit un couple de catalogues + une allowlist, joue le script reel, et rend
 * son code de sortie avec sa sortie complete.
 */
function run({ fr, en, entrees = {}, categories = CATEGORIES }) {
  writeFileSync(join(dir, 'src/locales/fr/probe.json'), JSON.stringify(fr), 'utf8');
  writeFileSync(join(dir, 'src/locales/en/probe.json'), JSON.stringify(en), 'utf8');
  writeFileSync(
    join(dir, 'scripts/i18n-identical-allowlist.json'),
    JSON.stringify({ categories, entrees }),
    'utf8',
  );
  const r = spawnSync(process.execPath, [SCRIPT, '--list'], { cwd: dir, encoding: 'utf8' });
  if (r.error) throw r.error;
  return { code: r.status, out: r.stdout + r.stderr };
}

describe('i18n-identical : temoin de corpus', () => {
  // 🔴 SANS CE CAS, tous les autres pourraient passer sur un script casse qui
  // ne compterait plus jamais rien. Il fixe le plancher : la mesure detecte une
  // identite, et elle ne prend PAS une traduction pour une identite.
  it('compte une valeur `en` restee en francais, et ignore une valeur traduite', () => {
    const { code, out } = run({
      fr: { copiee: 'Aucune tâche à afficher', traduite: 'Bonjour' },
      en: { copiee: 'Aucune tâche à afficher', traduite: 'Hello' },
    });
    expect(code).toBe(1);
    expect(out).toContain('NON DÉCLARÉES: 1');
    expect(out).toContain('probe.copiee');
    expect(out).not.toContain('probe.traduite');
  });

  it('ne compte pas une identite declaree legitime', () => {
    const { code, out } = run({
      fr: { marque: 'Cosmo' },
      en: { marque: 'Cosmo' },
      entrees: { 'probe.marque': { categorie: 'nom-propre', valeur: 'Cosmo' } },
    });
    expect(code).toBe(0);
    expect(out).toContain('DÉCLARÉES LÉGITIMES: 1');
    expect(out).toContain('NON DÉCLARÉES: 0');
  });

  it('descend dans les clés imbriquées', () => {
    const { code, out } = run({
      fr: { section: { bloc: { titre: 'Rapport hebdomadaire' } } },
      en: { section: { bloc: { titre: 'Rapport hebdomadaire' } } },
    });
    expect(code).toBe(1);
    expect(out).toContain('probe.section.bloc.titre');
  });

  it('ignore une clé absente de `en` — c est le travail d i18n:check', () => {
    const { code, out } = run({
      fr: { seulementFr: 'Brouillon' },
      en: {},
    });
    expect(code).toBe(0);
    expect(out).toContain('COUPLES COMPARABLES: 0');
  });
});

describe('i18n-identical : l allowlist est verifiee, pas crue', () => {
  // Le piege : une dispense accordee a « Manager » qui survit au renommage du
  // libelle en « Responsable d equipe ». Sans la valeur epinglee, la nouvelle
  // chaine heriterait de l ancienne decision sans que personne ne la relise.
  it('echoue quand la valeur francaise a change depuis la declaration', () => {
    const { code, out } = run({
      fr: { role: 'Responsable' },
      en: { role: 'Responsable' },
      entrees: { 'probe.role': { categorie: 'mot-identique', valeur: 'Manager' } },
    });
    expect(code).toBe(1);
    expect(out).toContain('Allowlist périmée');
    expect(out).toContain('probe.role');
  });

  it('echoue quand la clé declaree n existe plus', () => {
    const { code, out } = run({
      fr: { autre: 'Bonjour' },
      en: { autre: 'Hello' },
      entrees: { 'probe.disparue': { categorie: 'nom-propre', valeur: 'Cosmo' } },
    });
    expect(code).toBe(1);
    expect(out).toContain('Allowlist périmée');
    expect(out).toContain('probe.disparue');
  });

  it('echoue quand la clé declaree a fini par etre traduite', () => {
    const { code, out } = run({
      fr: { role: 'Manager' },
      en: { role: 'Team lead' },
      entrees: { 'probe.role': { categorie: 'mot-identique', valeur: 'Manager' } },
    });
    expect(code).toBe(1);
    expect(out).toContain('Allowlist périmée');
  });

  it('echoue sur une catégorie inventee', () => {
    const { code, out } = run({
      fr: { role: 'Manager' },
      en: { role: 'Manager' },
      entrees: { 'probe.role': { categorie: 'parce-que', valeur: 'Manager' } },
    });
    expect(code).toBe(1);
    expect(out).toContain('catégorie inconnue');
  });
});

describe('i18n-identical : le cliquet du depot', () => {
  // Joue le script sur les VRAIS catalogues. C'est lui qui echoue le jour ou
  // une nouvelle clé part en prod avec sa valeur francaise dans `en`.
  it('est vert sur src/locales, allowlist comprise', () => {
    const r = spawnSync(process.execPath, [SCRIPT, '--list'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    expect(r.stdout + r.stderr).toContain('NON DÉCLARÉES: 0');
    expect(r.status).toBe(0);
  });
});

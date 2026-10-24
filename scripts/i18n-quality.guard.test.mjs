// ═══════════════════════════════════════════════════════════════════
// i18n-quality.guard.test.mjs · le TÉMOIN de la garde de qualité (AM-1)
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// `i18n-quality.mjs` répond « glossaire tenu, aucun français dans en ». Une
// garde qui se trompe dans le sens rassurant est pire qu'une garde absente
// (`scripts/CLAUDE.md`) : le premier cas ci-dessous SOUMET au script réel une
// traduction fautive et exige le rouge. Sans lui, un détecteur qui ne verrait
// plus rien passerait tous les autres.
//
// Deux moitiés :
//   · le script est joué TEL QUEL dans un dossier temporaire pris pour cwd,
//     jamais réimplémenté ici (une garde qui réécrit sa logique ne teste que
//     sa copie) ;
//   · ses fonctions pures sont aussi importées, pour les homographes anglais
//     qu'il NE DOIT PAS lever, et pour que la couverture de l'outillage
//     (C-82) voie ce qu'un sous-processus lui cache.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { detecterFrancais, termesManquants, juger } from './i18n-quality.mjs';

const SCRIPT = resolve(process.cwd(), 'scripts/i18n-quality.mjs');
const POURQUOI = 'justification assez longue pour passer le contrôle.';

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'i18n-quality-guard-'));
  mkdirSync(join(dir, 'src/locales/fr'), { recursive: true });
  mkdirSync(join(dir, 'src/locales/en'), { recursive: true });
  mkdirSync(join(dir, 'scripts'), { recursive: true });
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** Écrit un couple de catalogues et une allowlist, joue le script réel. */
function run({ fr, en, allow = {} }) {
  writeFileSync(join(dir, 'src/locales/fr/probe.json'), JSON.stringify(fr), 'utf8');
  writeFileSync(join(dir, 'src/locales/en/probe.json'), JSON.stringify(en), 'utf8');
  writeFileSync(join(dir, 'scripts/i18n-quality-allowlist.json'), JSON.stringify(allow), 'utf8');
  const r = spawnSync(process.execPath, [SCRIPT, '--list'], { cwd: dir, encoding: 'utf8' });
  if (r.error) throw r.error;
  return { code: r.status, out: r.stdout + r.stderr };
}

describe('i18n-quality : témoin de corpus', () => {
  it('une traduction fausse mais différente fait ROUGIR la garde', () => {
    const r = run({ fr: { a: 'Supprimer la tâche' }, en: { a: 'Delete the item' } });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/probe\.a \[tâche\]/);
  });

  it('la même clé correctement traduite passe, et la garde dit ce qu elle a lu', () => {
    const r = run({ fr: { a: 'Supprimer la tâche' }, en: { a: 'Delete the task' } });
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/1 valeurs en lues/);
    expect(r.out).toMatch(/« tâche » : 1 source\(s\) fr, 0 sans/);
  });

  it('une valeur en à moitié française rougit, avec ses indices', () => {
    const r = run({
      fr: { a: 'Supprimer la tâche', b: 'Créer une tâche' },
      en: { a: 'Supprimer the task', b: 'Créer a task' },
    });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/probe\.a \[supprimer\]/);
    expect(r.out).toMatch(/probe\.b \[é\]/);
  });

  it('les guillemets français dans en rougissent', () => {
    const r = run({ fr: { a: 'La tâche « X »' }, en: { a: 'The task « X »' } });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/probe\.a \[«, »\]/);
  });

  it('une garde qui n a rien lu ne sort pas vert', () => {
    const r = run({ fr: { a: 'Bonjour' }, en: { a: 'Hello' } });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/rien lu/);
  });
});

describe('i18n-quality : allowlist vérifiée, pas crue', () => {
  const fr = { a: 'Objectif 1 000', t: 'Une tâche' };
  const en = { a: 'Target 1,000', t: 'A task' };

  it('une exception déclarée et justifiée passe', () => {
    const r = run({ fr, en, allow: { glossaire: { 'probe.a': { termes: ['objectif'], fr: fr.a, pourquoi: POURQUOI } } } });
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/1 exception\(s\) déclarée\(s\)/);
  });

  it('une valeur fr changée fait expirer la dispense', () => {
    const r = run({ fr, en, allow: { glossaire: { 'probe.a': { termes: ['objectif'], fr: 'Objectif 2 000', pourquoi: POURQUOI } } } });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/probe\.a : glossaire : valeur fr épinglée/);
  });

  it('une exception qui ne déclenche plus rien est périmée', () => {
    const r = run({ fr, en: { ...en, a: 'Objective 1,000' }, allow: { glossaire: { 'probe.a': { termes: ['objectif'], fr: fr.a, pourquoi: POURQUOI } } } });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/ne déclenche plus rien/);
  });

  it('une exception sans justification est refusée', () => {
    const r = run({ fr, en, allow: { glossaire: { 'probe.a': { termes: ['objectif'], fr: fr.a } } } });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/justification absente/);
  });

  it('une dispense de français épingle la valeur en', () => {
    const allow = { francais: { 'probe.t': { indices: ['le'], en: 'A task, le test', pourquoi: POURQUOI } } };
    const traduit = { a: 'Objective 1,000' };
    expect(run({ fr, en: { ...traduit, t: 'A task, le test' }, allow }).code).toBe(0);
    const r = run({ fr, en: { ...traduit, t: 'A task, le test modifié' }, allow });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/valeur en épinglée/);
  });
});

describe('i18n-quality : fonctions pures', () => {
  it('ne lève pas les homographes anglais, les variables ni les liens', () => {
    expect(detecterFrancais('Add a task on the plus side for your son, at the date')).toEqual([]);
    expect(detecterFrancais('Hello {{le}} [link](/fr/les-taches) https://x.fr/la')).toEqual([]);
  });

  it('lit un mot outil français, pas un mot anglais qui le contient', () => {
    expect(detecterFrancais('Calendar table')).toEqual([]);
    expect(detecterFrancais('Open la page')).toEqual(['la']);
  });

  it('cherche le terme anglais comme radical, le terme fr comme mot', () => {
    expect(termesManquants('Ajouter une sous-tâche', 'Add a subtask')).toEqual([]);
    expect(termesManquants('Sans catégorie', 'Uncategorized')).toEqual([]);
    expect(termesManquants('Mes résultats clés', 'My metrics')).toEqual(['résultat clé']);
    expect(termesManquants('Attacher', 'Attach')).toEqual([]);
  });

  it('juger compte chaque source fr et chaque écart', () => {
    const v = juger([
      { id: 'n.a', fr: 'Une habitude', en: 'A routine' },
      { id: 'n.b', fr: 'Une habitude', en: 'A habit' },
      { id: 'n.c', fr: undefined, en: 'Orphan' },
    ]);
    expect(v.valeursEn).toBe(3);
    expect(v.parTerme['habitude']).toEqual({ occurrences: 2, ecarts: 1 });
    expect(v.glossaire.map((e) => e.id)).toEqual(['n.a']);
  });
});

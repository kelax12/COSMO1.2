// ═══════════════════════════════════════════════════════════════════
// restore-drill-fraicheur.guard.test.mjs · LE TEMOIN DE LA GARDE D'ABSENCE
//
// La garde doit rougir quand le drill ne tourne plus, et ne jamais rendre un
// vert qu'elle n'a pas lu. Chaque cas soumet au code REEL un historique qui
// doit rougir ; le plancher : un drill vert recent passe.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { verdictFraicheur, lireRuns, JOURS_MAX, JOB } from './restore-drill-fraicheur.mjs';

const MAINTENANT = new Date('2026-12-20T06:19:00Z');
const vert = (id, date) => ({ id, date, jobs: [{ name: JOB, conclusion: 'success' }, { name: 'drill', conclusion: 'skipped' }] });

describe('fraicheur du drill · l absence rougit', () => {
  it('PLANCHER : un drill-auto vert il y a 11 jours passe', () => {
    const v = verdictFraicheur([vert(1, '2026-12-09T05:50:00Z')], MAINTENANT);
    expect(v).toMatchObject({ ok: true, ageJours: 11 });
  });

  it('aucun run : rouge', () => {
    expect(verdictFraicheur([], MAINTENANT).ok).toBe(false);
    expect(verdictFraicheur(undefined, MAINTENANT).ok).toBe(false);
  });

  it(`un drill vert de plus de ${JOURS_MAX} jours : rouge`, () => {
    const v = verdictFraicheur([vert(1, '2026-11-14T05:50:00Z')], MAINTENANT);
    expect(v.ok).toBe(false);
    expect(v.message).toMatch(/il y a 36 jours, au-dela de 35/);
  });

  it('un run vert SANS job drill-auto (ancien drill manuel) ne compte pas', () => {
    const ancien = { id: 2, date: '2026-12-15T00:00:00Z', jobs: [{ name: 'dump-check', conclusion: 'success' }, { name: 'drill', conclusion: 'success' }] };
    expect(verdictFraicheur([ancien], MAINTENANT).ok).toBe(false);
  });

  it('un drill-auto en echec ne compte pas', () => {
    const rouge = { id: 3, date: '2026-12-15T00:00:00Z', jobs: [{ name: JOB, conclusion: 'failure' }] };
    expect(verdictFraicheur([rouge], MAINTENANT).ok).toBe(false);
  });

  it('juge sur le PLUS RECENT, quel que soit l ordre de la liste', () => {
    const v = verdictFraicheur([vert(1, '2026-10-01T00:00:00Z'), vert(2, '2026-12-09T00:00:00Z')], MAINTENANT);
    expect(v).toMatchObject({ ok: true, dernier: expect.objectContaining({ id: 2 }) });
  });

  it('une date illisible ne vaut pas un vert', () => {
    expect(verdictFraicheur([vert(1, 'pas une date')], MAINTENANT).ok).toBe(false);
  });
});

describe('fraicheur du drill · dans le doute, rouge', () => {
  const reponse = (corps, ok = true, status = 200) => ({ ok, status, json: async () => corps });

  it('jeton ou depot absent : erreur, pas de vert', async () => {
    await expect(lireRuns({ repo: '', jeton: 'x' })).rejects.toThrow(/absent/);
  });

  it('API qui refuse : erreur', async () => {
    const fetcher = async () => reponse({}, false, 403);
    await expect(lireRuns({ repo: 'o/r', jeton: 'x', fetcher })).rejects.toThrow(/403/);
  });

  it('reponse sans workflow_runs : erreur', async () => {
    const fetcher = async () => reponse({ message: 'Not Found' });
    await expect(lireRuns({ repo: 'o/r', jeton: 'x', fetcher })).rejects.toThrow(/illisible/);
  });

  it('lit les jobs de chaque run, et s arrete au premier drill-auto vert', async () => {
    const urls = [];
    const fetcher = async (url) => {
      urls.push(url);
      if (url.includes('/workflows/restore-drill.yml/runs')) {
        expect(url).toMatch(/branch=main&status=success/);
        return reponse({ workflow_runs: [{ id: 10, updated_at: '2026-12-09T00:00:00Z' }, { id: 9, updated_at: '2026-11-09T00:00:00Z' }] });
      }
      return reponse({ jobs: [{ name: JOB, conclusion: 'success' }] });
    };
    const runs = await lireRuns({ repo: 'o/r', jeton: 'x', fetcher });
    expect(runs).toHaveLength(1);
    expect(urls.filter((u) => u.includes('/jobs'))).toHaveLength(1);
  });
});

describe('fraicheur du drill · le workflow et l alerte', () => {
  const wf = readFileSync(resolve('.github/workflows/restore-drill-fraicheur.yml'), 'utf8');
  const alerte = readFileSync(resolve('.github/workflows/ci-alert.yml'), 'utf8');
  const drill = readFileSync(resolve('.github/workflows/restore-drill.yml'), 'utf8');

  it('planifie, et appelle le module', () => {
    expect(wf).toMatch(/schedule:\s*\n(?:\s*#[^\n]*\n)*\s*- cron:/);
    expect(wf).toMatch(/node scripts\/restore-drill-fraicheur\.mjs/);
  });

  it('le drill et sa garde d absence sonnent par ci-alert.yml', () => {
    const nom = wf.match(/^name: (.+)$/m)[1];
    expect(alerte).toMatch(new RegExp(`\\n {6}- ${nom}\\n`));
    expect(alerte).toMatch(/\n {6}- restore-drill\n/);
  });

  it('le job surveille porte bien le nom que la garde cherche', () => {
    expect(drill).toMatch(new RegExp(`\\n  ${JOB}:\\n`));
  });

  it('le drill est mensuel', () => {
    expect(drill).toMatch(/- cron: '\d+ \d+ \d+ \* \*'/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// gardes-rouges-7j.guard.test.mjs · LE TÉMOIN DE LA RÈGLE DES 7 JOURS (V9.4)
//
// Chaque cas soumet au noyau pur une situation qu'il DOIT signaler, et échoue
// s'il répond « rien à signaler ». Le plancher (tout vert, ou rouge récent)
// empêche une garde qui signalerait tout de passer les autres cas.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rougeDepuis, validerDecisions, juger, signature, corps, run, EXCLUS } from './gardes-rouges-7j.mjs';

const MAINTENANT = new Date('2026-11-07T12:00:00Z');
const il = (jours) => new Date(MAINTENANT.getTime() - jours * 86_400_000).toISOString();
const r = (jours, conclusion, o = {}) => ({
  created_at: il(jours), conclusion, status: 'completed', event: 'schedule', html_url: `https://x.test/${jours}`, ...o,
});
const decision = (o = {}) => ({
  workflow: 'Secrets age',
  decide_le: '2026-11-07',
  revoir_le: '2026-11-21',
  mesure: 'run 41474391054 du 2026-11-02 : 44 écarts',
  motif: 'attend un geste hors code : poser le jeton de lecture, sans quoi rien ne se mesure',
  doc: 'docs/SECURITY.md',
  ...o,
});

describe('gardes-rouges-7j · depuis quand un workflow est rouge', () => {
  it('plancher : dernier run vert → pas rouge', () => {
    expect(rougeDepuis([r(1, 'success'), r(2, 'failure')])).toBeNull();
    expect(rougeDepuis([])).toBeNull();
  });

  it('TÉMOIN : la série remonte jusqu au premier rouge après le dernier vert', () => {
    const v = rougeDepuis([r(1, 'failure'), r(5, 'failure'), r(9, 'failure'), r(10, 'success'), r(11, 'failure')]);
    expect(v).toMatchObject({ depuis: il(9), complet: true, url: 'https://x.test/1', n: 3 });
  });

  it('annulés, sautés et PR ne comptent ni pour vert ni pour rouge', () => {
    const v = rougeDepuis([
      r(1, 'cancelled'),
      r(2, 'failure'),
      r(3, 'success', { event: 'pull_request' }),
      r(4, 'skipped'),
      r(8, 'timed_out'),
      r(12, 'success'),
    ]);
    expect(v).toMatchObject({ depuis: il(8), complet: true, n: 2 });
    expect(rougeDepuis([r(1, 'skipped'), r(2, 'success')])).toBeNull();
  });

  it('sans vert dans la fenêtre, `depuis` est une borne basse (complet = false)', () => {
    expect(rougeDepuis([r(1, 'failure'), r(20, 'failure')])).toMatchObject({ depuis: il(20), complet: false });
  });
});

describe('gardes-rouges-7j · le verdict', () => {
  const rouge = (workflow, jours) => ({ workflow, depuis: il(jours), complet: true, url: 'u' });

  it('plancher : rouge depuis 7 jours pile, pas encore une violation', () => {
    expect(juger({ rouges: [rouge('Posture', 7)], decisions: [], maintenant: MAINTENANT }).violations).toEqual([]);
  });

  it('TÉMOIN : rouge depuis 8 jours sans décision → violation', () => {
    const v = juger({ rouges: [rouge('Posture', 8)], decisions: [], maintenant: MAINTENANT });
    expect(v.violations.map((x) => [x.workflow, x.jours])).toEqual([['Posture', 8]]);
  });

  it('une décision en cours de validité recale, une décision ÉCHUE ne recale plus', () => {
    const ok = juger({ rouges: [rouge('Secrets age', 12)], decisions: [decision()], maintenant: MAINTENANT });
    expect(ok.violations).toEqual([]);
    expect(ok.recales.map((x) => x.workflow)).toEqual(['Secrets age']);
    const echue = juger({ rouges: [rouge('Secrets age', 12)], decisions: [decision({ revoir_le: '2026-11-06' })], maintenant: MAINTENANT });
    expect(echue.violations[0].decisionEchue.revoir_le).toBe('2026-11-06');
  });

  it('une décision pour un AUTRE workflow ne recale rien, et est signalée sans objet', () => {
    const v = juger({ rouges: [rouge('Posture', 9)], decisions: [decision()], maintenant: MAINTENANT });
    expect(v.violations.map((x) => x.workflow)).toEqual(['Posture']);
    expect(v.decisionsSansObjet).toEqual(['Secrets age']);
  });

  it('la signature ne change qu avec la liste (pas de commentaire quotidien identique)', () => {
    const a = juger({ rouges: [rouge('B', 9), rouge('A', 10)], decisions: [], maintenant: MAINTENANT }).violations;
    const b = juger({ rouges: [rouge('A', 10), rouge('B', 9)], decisions: [], maintenant: new Date(MAINTENANT.getTime() + 3_600_000) }).violations;
    expect(signature(a)).toBe(signature(b));
    expect(signature(a)).not.toBe(signature(a.slice(1)));
  });

  it('le corps nomme le workflow, la date, le lien, et rien d autre', () => {
    const verdict = juger({ rouges: [rouge('restore-drill', 22)], decisions: [], maintenant: MAINTENANT });
    const t = corps({ ...verdict, maintenant: MAINTENANT, runUrl: 'https://x.test/run' });
    expect(t).toMatch(/^<!-- gardes-rouges-7j restore-drill@2026-10-16 -->/);
    expect(t).toContain('**restore-drill** : rouge depuis 22 j');
    expect(t).toContain('2026-11-07');
  });
});

describe('gardes-rouges-7j · les décisions', () => {
  it('plancher : une décision complète passe', () => {
    expect(validerDecisions({ decisions: [decision()] })).toEqual([]);
  });

  it('TÉMOIN : refuse une décision posée pour plus de 30 jours, sans motif, sans mesure, sans doc, en double', () => {
    const t = (d) => validerDecisions({ decisions: [decision(d)] }).join('\n');
    expect(t({ revoir_le: '2026-12-08' })).toMatch(/plafond 30 j/);
    expect(t({ motif: 'parce que' })).toMatch(/motif/);
    expect(t({ mesure: '' })).toMatch(/mesure/);
    expect(t({ doc: '' })).toMatch(/doc/);
    expect(t({ decide_le: '7/11/2026' })).toMatch(/decide_le/);
    expect(validerDecisions({ decisions: [decision(), decision()] }).join()).toMatch(/deux décisions/);
    expect(validerDecisions({})).toHaveLength(1);
  });

  it('le fichier commité est bien formé, et ne dépasse aucun plafond', () => {
    const f = JSON.parse(readFileSync(resolve(process.cwd(), '.github/gardes-rouges-decisions.json'), 'utf8'));
    expect(validerDecisions(f)).toEqual([]);
  });
});

describe('gardes-rouges-7j · échec fermé', () => {
  it('sans jeton, run() sort en 1 sans rien mesurer', async () => {
    const v = await run({}, MAINTENANT);
    expect(v.exit).toBe(1);
    expect(v.lignes.join()).toMatch(/GH_TOKEN ou REPO absent/);
  });

  it('`CI alert` s exclut lui-même (ses runs sont des `skipped` par construction)', () => {
    expect(EXCLUS.has('CI alert')).toBe(true);
  });
});

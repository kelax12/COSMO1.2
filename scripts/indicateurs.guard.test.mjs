// ═══════════════════════════════════════════════════════════════════
// Témoin de `scripts/indicateurs.mjs` (V20.2, PRO-05, ADR 0012)
//
// Une mesure qui ne saurait plus rougir est pire qu'une note : elle donne un
// chiffre, et on le croit. Ce fichier prouve, sur des données fabriquées,
// que chaque indicateur :
//   · franchit son seuil quand il le doit, et seulement alors ;
//   · écrit « non mesuré » avec sa raison plutôt qu'un chiffre de repli ;
//   · ne rend jamais un vert sur une source qui n'a pas été lue (échec fermé).
// Et que le workflow qui le planifie garde ses permissions minimales, son
// artefact déclaré `sans-prod`, et sa place dans `ci-alert.yml`.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';

import {
  NON_MESURE, SEUILS, tauxDeVert, drillRestauration, couvertureParcours, ageSecrets, lignesDAge,
  deriveProduction, incidentsOuverts, auditExterne, toutesLesAlertes, rendre, calculer,
  verdictSeuils, dernierConclu, lireSources, clientGitHub,
} from './indicateurs.mjs';

const RACINE = process.cwd();
const MAINTENANT = new Date('2026-11-08T09:00:00Z');
const run = (conclusion, jourIso = '2026-11-07', extra = {}) => ({
  id: Math.floor(Math.random() * 1e6), status: 'completed', conclusion,
  created_at: `${jourIso}T10:00:00Z`, html_url: `https://example.test/runs/${conclusion}`, ...extra,
});
const serie = (verts, rouges) => [
  ...Array.from({ length: rouges }, () => run('failure')),
  ...Array.from({ length: verts }, () => run('success')),
];

describe('1 · taux de vert de main', () => {
  it('rend le taux, la fenêtre et la date du dernier run', () => {
    const r = tauxDeVert([run('success', '2026-11-08'), run('failure'), run('success')], { source: 's' });
    expect(r.taux).toBe(66.7);
    expect(r.valeur).toContain('66,7 %');
    expect(r.mesureLe).toBe('2026-11-08');
  });
  it('sonne sous 80 %, se tait à 80 % pile', () => {
    expect(tauxDeVert(serie(39, 11)).alertes).toHaveLength(1);
    expect(tauxDeVert(serie(40, 10)).alertes).toHaveLength(0);
  });
  it('les runs annulés et sautés ne comptent ni pour ni contre', () => {
    const r = tauxDeVert([run('cancelled'), run('skipped'), run('success'), run('failure')]);
    expect(r.valeur).toContain('1 verts sur 2');
  });
  it('ne regarde que les N derniers runs conclus', () => {
    const r = tauxDeVert([...serie(0, 50), ...serie(100, 0)], { fenetre: 50 });
    expect(r.taux).toBe(0);
  });
  it('sans aucun run conclu : « non mesuré » avec sa raison, et une alerte', () => {
    const r = tauxDeVert([run('cancelled')]);
    expect(r.valeur).toBe(NON_MESURE);
    expect(r.raison).toMatch(/aucun run conclu/);
    expect(r.alertes).toHaveLength(1);
  });
});

describe('2 · délai de restauration éprouvé', () => {
  const drill = (jourIso, conclusion = 'success') => ({
    id: 77, date: `${jourIso}T05:50:00Z`, html_url: 'https://example.test/drill',
    jobs: [{
      name: 'drill-auto', conclusion,
      started_at: '2026-11-08T05:43:00Z', completed_at: '2026-11-08T05:43:37Z',
      steps: [{ name: 'Restaurer le dernier dump et comparer ses comptages', conclusion: 'success', started_at: '2026-11-08T05:43:10Z', completed_at: '2026-11-08T05:44:25Z' }],
    }],
  });
  it('rend la durée de l\'étape, celle du job, et la date du dernier vert', () => {
    const r = drillRestauration([drill('2026-11-08')], { maintenant: MAINTENANT });
    expect(r.valeur).toContain('1 min 15 s');
    expect(r.valeur).toContain('2026-11-08');
    expect(r.details.join('\n')).toContain('37 s');
    expect(r.alertes).toEqual([]);
  });
  it('sonne au-delà de 35 jours, pas à 35', () => {
    expect(drillRestauration([drill('2026-10-03')], { maintenant: MAINTENANT }).alertes).toHaveLength(1);
    expect(drillRestauration([drill('2026-10-04')], { maintenant: MAINTENANT }).alertes).toHaveLength(0);
  });
  it('aucun drill vert : alerte, jamais une durée inventée', () => {
    const r = drillRestauration([], { maintenant: MAINTENANT });
    expect(r.valeur).toBe('aucun drill vert');
    expect(r.alertes).toHaveLength(1);
    const rouge = drillRestauration([drill('2026-11-08', 'failure')], { maintenant: MAINTENANT });
    expect(rouge.alertes).toHaveLength(1);
  });
  it('reprend la borne de la garde d\'absence, pas une seconde', () => {
    expect(SEUILS.drillJoursMax).toBe(35);
  });
});

describe('3 · couverture des parcours critiques', () => {
  const decl = { parcours: [
    { id: 'a', libelle: 'Parcours A', specs: ['e2e/a.spec.ts', 'e2e/real/a.spec.ts'] },
    { id: 'b', libelle: 'Parcours B', specs: ['e2e/b.spec.ts'] },
  ] };
  it('compte un parcours couvert quand AU MOINS une de ses specs existe', () => {
    const r = couvertureParcours(decl, (c) => c === 'e2e/real/a.spec.ts', { source: 's', mesureLe: '2026-11-08' });
    expect(r.couverts).toBe(1);
    expect(r.valeur).toContain('1 sur 2');
    expect(r.details.join('\n')).toContain('Parcours B');
  });
  it('une spec supprimée fait baisser le chiffre (la liste ne se vide pas pour le faire monter)', () => {
    expect(couvertureParcours(decl, () => true).couverts).toBe(2);
    expect(couvertureParcours(decl, () => false).couverts).toBe(0);
  });
  it('liste vide ou absente : « non mesuré »', () => {
    expect(couvertureParcours({ parcours: [] }, () => true).valeur).toBe(NON_MESURE);
    expect(couvertureParcours(null, () => true).valeur).toBe(NON_MESURE);
  });
  it('la config du dépôt déclare des parcours dont les specs existent encore', () => {
    const config = JSON.parse(readFileSync(join(RACINE, 'scripts/indicateurs.config.json'), 'utf8'));
    const r = couvertureParcours(config, (c) => {
      try { readFileSync(join(RACINE, c)); return true; } catch { return false; }
    });
    expect(r.total).toBeGreaterThanOrEqual(8);
    expect(r.couverts).toBe(r.total);
  });
});

describe('4 · âge maximal des secrets', () => {
  const registre = { entries: [
    { name: 'A_KEY', store: 'github', kind: 'secret', owner: 'x', criticality: 'high', maxAgeDays: 90, lastRotated: '2026-10-09' },
    { name: 'B_KEY', store: 'vercel', kind: 'secret', owner: 'x', criticality: 'high', maxAgeDays: 180, lastRotated: null },
    { name: 'C_URL', store: 'public', kind: 'config', owner: 'x', criticality: 'low' },
  ] };
  it('lit les lignes du journal de Secrets age, `?` = inconnu', () => {
    const j = [
      '2026-11-07T06:17:10.1Z 12 j / 90 j  github/A_KEY',
      '2026-11-07T06:17:10.2Z ? j / 180 j  vercel/B_KEY',
      '2026-11-07T06:17:10.3Z ✖ 2 ecart(s) :',
    ].join('\n');
    expect(lignesDAge(j)).toEqual([
      { id: 'github/A_KEY', age: 12, max: 90 },
      { id: 'vercel/B_KEY', age: null, max: 180 },
    ]);
    expect(lignesDAge('rien')).toEqual([]);
  });
  it('la date vivante l\'emporte sur le registre ; l\'âge maximal est rendu avec son secret', () => {
    const r = ageSecrets(registre, { maintenant: MAINTENANT, vivant: [{ id: 'github/A_KEY', age: 40, max: 90 }, { id: 'vercel/B_KEY', age: 100, max: 180 }] });
    expect(r.valeur).toContain('100 j (B_KEY, échéance 180 j)');
    expect(r.alertes).toEqual([]);
  });
  it('un secret au-delà de son échéance sonne', () => {
    const r = ageSecrets(registre, { maintenant: MAINTENANT, vivant: [{ id: 'github/A_KEY', age: 91, max: 90 }, { id: 'vercel/B_KEY', age: 1, max: 180 }] });
    expect(r.alertes.join('\n')).toContain('github/A_KEY au-delà de son échéance');
  });
  it('date inconnue = échue, sauf si le dernier run de Secrets age est vert', () => {
    const sans = ageSecrets(registre, { maintenant: MAINTENANT });
    expect(sans.alertes.join('\n')).toContain('1 secret(s) sans date de rotation connue');
    expect(sans.alertes.join('\n')).not.toContain('B_KEY');
    expect(sans.details.join('\n')).not.toContain('B_KEY');
    expect(sans.valeur).toContain('1 sans date de rotation connue');
    const vert = ageSecrets(registre, { maintenant: MAINTENANT, runSecrets: { conclusion: 'success', created_at: '2026-11-07T06:00:00Z' } });
    expect(vert.alertes).toEqual([]);
    expect(vert.mesureLe).toBe('2026-11-07');
    const rouge = ageSecrets(registre, { maintenant: MAINTENANT, runSecrets: { conclusion: 'failure' } });
    expect(rouge.alertes).toHaveLength(1);
  });
  it('un secret échu au registre sonne même quand Secrets age est vert', () => {
    const vieux = { entries: [{ ...registre.entries[0], lastRotated: '2026-01-01' }] };
    const r = ageSecrets(vieux, { maintenant: MAINTENANT, runSecrets: { conclusion: 'success' } });
    expect(r.alertes).toHaveLength(1);
  });
  it('registre mal formé : « non mesuré »', () => {
    expect(ageSecrets({ entries: [] }, {}).valeur).toBe(NON_MESURE);
    const sansEcheance = { entries: [{ ...registre.entries[0], maxAgeDays: undefined }] };
    expect(ageSecrets(sansEcheance, {}).raison).toContain('sans échéance');
  });
  it('ne redouble pas la forme du registre : un champ de plus exigé par la garde ne le fait pas taire', () => {
    // Les fixtures de ce fichier n'ont ni `readers`, ni `leak`, ni `rotation`.
    expect(ageSecrets(registre, { maintenant: MAINTENANT }).etat).toBe('mesure');
  });
  it('ne recopie aucune valeur : seulement des noms', () => {
    const r = ageSecrets(registre, { maintenant: MAINTENANT });
    expect(JSON.stringify(r)).not.toMatch(/sk_live|eyJ|postgres:\/\//);
  });
});

describe('5 · dérive de la production', () => {
  const sonde = (nom, conclusion) => ({ nom, regarde: 'x', run: conclusion ? run(conclusion) : null, erreur: conclusion ? undefined : 'API GitHub 500' });
  it('trois sondes vertes : pas d\'alerte', () => {
    const r = deriveProduction([sonde('A', 'success'), sonde('B', 'success'), sonde('C', 'success')]);
    expect(r.valeur).toBe('3 sondes sur 3 vertes');
    expect(r.alertes).toEqual([]);
  });
  it('une sonde rouge sonne et se nomme', () => {
    const r = deriveProduction([sonde('A', 'success'), sonde('B', 'failure'), sonde('C', 'success')]);
    expect(r.valeur).toContain('B');
    expect(r.alertes).toHaveLength(1);
  });
  it('une sonde illisible n\'est pas un vert : non mesuré et alerte', () => {
    const r = deriveProduction([sonde('A', 'success'), sonde('B', null), sonde('C', 'success')]);
    expect(r.etat).toBe('non-mesure');
    expect(r.valeur).toContain(NON_MESURE);
    expect(r.alertes.join(' ')).toContain('API GitHub 500');
    expect(deriveProduction([sonde('A', null)]).valeur).toBe(NON_MESURE);
  });
  it('dernierConclu saute les runs annulés', () => {
    expect(dernierConclu([run('cancelled'), run('failure'), run('success')]).conclusion).toBe('failure');
  });
});

describe('6 · incidents ouverts', () => {
  it('compte les issues ouvertes par étiquette, sans alerte propre', () => {
    const r = incidentsOuverts({
      ciRed: [{ number: 64, title: 'CI en echec', created_at: '2026-10-10T00:00:00Z' }],
      incident: [],
    }, { mesureLe: '2026-11-08' });
    expect(r.valeur).toBe('1 (ci-red 1, incident 0)');
    expect(r.details.join('\n')).toContain('#64');
    expect(r.alertes).toEqual([]);
  });
});

describe('audit externe semestriel', () => {
  it('rend l\'échéance à six mois', () => {
    const a = auditExterne({ dernier: '2026-11-06', periodiciteMois: 6 }, MAINTENANT);
    expect(a.echeance).toBe('2027-05-06');
    expect(a.alertes).toEqual([]);
  });
  it('sonne une fois l\'échéance dépassée', () => {
    const a = auditExterne({ dernier: '2026-11-06', periodiciteMois: 6 }, new Date('2027-05-08T00:00:00Z'));
    expect(a.alertes).toHaveLength(1);
  });
  it('config absente : alerte, pas de date inventée', () => {
    expect(auditExterne(undefined, MAINTENANT).alertes).toHaveLength(1);
  });
});

describe('rendu et verdict', () => {
  const ok = () => ({ ok: true, valeur: [] });
  const ko = (e) => ({ ok: false, erreur: e });
  const config = JSON.parse(readFileSync(join(RACINE, 'scripts/indicateurs.config.json'), 'utf8'));
  const registre = JSON.parse(readFileSync(join(RACINE, '.github/secrets-registry.json'), 'utf8'));
  const sources = (surcharge = {}) => ({
    depot: 'o/r',
    noyau: { ok: true, valeur: serie(9, 1) },
    drills: ko('API GitHub 403 sur /actions/workflows/restore-drill.yml/runs'),
    etendue: ok(), secrets: ok(), journalSecrets: ko('aucun run conclu de Secrets age'),
    issuesRouges: ok(), issuesIncident: ok(),
    sondes: [{ ok: true, valeur: [run('success')] }, { ok: true, valeur: [run('success')] }, { ok: true, valeur: [run('success')] }],
    config: { ok: true, valeur: config },
    registre: { ok: true, valeur: registre },
    existe: () => true,
    ...surcharge,
  });

  it('six indicateurs, toujours, même quand des sources tombent', () => {
    const r = calculer(sources(), MAINTENANT);
    expect(r.indicateurs.map((i) => i.id)).toEqual([
      'taux-de-vert', 'delai-de-restauration', 'parcours-critiques', 'age-des-secrets', 'derive-production', 'incidents-ouverts',
    ]);
  });
  it('une source illisible devient « non mesuré » ET une alerte (échec fermé)', () => {
    const r = calculer(sources(), MAINTENANT);
    const drill = r.indicateurs[1];
    expect(drill.valeur).toBe(NON_MESURE);
    expect(drill.raison).toContain('403');
    expect(r.alertes.join('\n')).toContain('Délai de restauration');
  });
  it('un indicateur ne cache pas les autres : la panne du drill laisse le taux de vert lu', () => {
    const r = calculer(sources(), MAINTENANT);
    expect(r.indicateurs[0].valeur).toContain('90 %');
  });
  it('config et registre illisibles : non mesuré, jamais un zéro', () => {
    const r = calculer(sources({ config: ko('config illisible'), registre: ko('registre illisible') }), MAINTENANT);
    expect(r.indicateurs[2].valeur).toBe(NON_MESURE);
    expect(r.indicateurs[3].valeur).toBe(NON_MESURE);
    expect(r.audit.alertes).toHaveLength(1);
  });
  it('le markdown porte, pour chaque indicateur, valeur, date de mesure et source, sans tiret cadratin', () => {
    const r = calculer(sources(), MAINTENANT);
    const md = rendre({ ...r, meta: { genereLe: MAINTENANT, sha: 'abcdef1234', depot: 'o/r' } });
    expect(md).not.toContain('note-audit');
    expect(md).toContain('NE PAS EDITER A LA MAIN');
    expect(md).not.toContain('—');
    expect(md).not.toMatch(/undefined|NaN|\[object/);
    for (let n = 1; n <= 6; n++) expect(md).toMatch(new RegExp(`\\| ${n} \\|`));
    expect(md).toContain('Mesuré le');
    expect(md).toContain('`abcdef1`');
    expect(md).toContain('Audit externe semestriel');
  });
  it('verdictSeuils : sort en 1 sur une alerte, en 0 sans, en 1 sur un résultat illisible', () => {
    expect(verdictSeuils({ alertes: [] }).exit).toBe(0);
    const v = verdictSeuils({ alertes: ['main sous 80 %'] });
    expect(v.exit).toBe(1);
    expect(v.lignes[0]).toMatch(/^::error title=indicateurs::/);
    expect(verdictSeuils({}).exit).toBe(1);
    expect(verdictSeuils(null).exit).toBe(1);
  });
  it('toutesLesAlertes ajoute celles de l\'audit', () => {
    expect(toutesLesAlertes([{ alertes: ['a'] }, {}], { alertes: ['b'] })).toEqual(['a', 'b']);
  });
});

describe('lecture : aucune exception ne sort, un échec d\'API est isolé', () => {
  it('une API qui répond 500 sur tout rend six lectures en échec, sans lever', async () => {
    const lire = clientGitHub({ jeton: 'x', depot: 'o/r', fetcher: async () => ({ ok: false, status: 500 }) });
    const src = await lireSources({ lire, racine: RACINE, depot: 'o/r' });
    expect(src.noyau.ok).toBe(false);
    expect(src.drills.erreur).toContain('500');
    expect(src.sondes.every((s) => !s.ok)).toBe(true);
    expect(src.config.ok).toBe(true);
    const r = calculer(src, MAINTENANT);
    expect(r.alertes.length).toBeGreaterThanOrEqual(5);
  });
  it('une réponse sans `workflow_runs` n\'est pas un vert', async () => {
    const lire = clientGitHub({ jeton: 'x', depot: 'o/r', fetcher: async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' }) });
    const src = await lireSources({ lire, racine: RACINE, depot: 'o/r' });
    expect(src.noyau.ok).toBe(false);
    expect(src.noyau.erreur).toContain('workflow_runs');
  });
  it('les issues d\'une étiquette ne comptent pas les pull requests', async () => {
    const fetcher = async (url) => ({
      ok: true, status: 200, text: async () => '',
      json: async () => (String(url).includes('/issues?') ? [{ number: 1, title: 't' }, { number: 2, title: 'pr', pull_request: {} }] : { workflow_runs: [], jobs: [] }),
    });
    const lire = clientGitHub({ jeton: 'x', depot: 'o/r', fetcher });
    const src = await lireSources({ lire, racine: RACINE, depot: 'o/r' });
    expect(src.issuesRouges.valeur.map((i) => i.number)).toEqual([1]);
  });
});

describe('le workflow `indicateurs.yml`', () => {
  const yml = readFileSync(join(RACINE, '.github/workflows/indicateurs.yml'), 'utf8');
  const doc = load(yml);
  const alerte = load(readFileSync(join(RACINE, '.github/workflows/ci-alert.yml'), 'utf8'));
  const autres = ['ci-noyau', 'secrets-age', 'restore-drill-fraicheur', 'sabotages', 'seo-signals', 'posture', 'gardes-calendrier']
    .map((f) => load(readFileSync(join(RACINE, `.github/workflows/${f}.yml`), 'utf8')));

  it('porte le nom que `ci-alert.yml` écoute', () => {
    expect(doc.name).toBe('Indicateurs');
    expect(alerte.on.workflow_run.workflows).toContain('Indicateurs');
  });
  it('est hebdomadaire, à une minute que les autres crons n\'utilisent pas à cette heure', () => {
    const cron = doc.on.schedule[0].cron;
    expect(cron).toMatch(/^\d{1,2} \d{1,2} \* \* \d$/);
    const toutes = autres.flatMap((d) => (d.on?.schedule ?? []).map((s) => s.cron));
    expect(toutes).not.toContain(cron);
    expect(doc.on.workflow_dispatch).toBeDefined();
  });
  it('mesure avec des droits en lecture seule, et ne pousse que dans un job à part', () => {
    expect(doc.permissions).toEqual({ contents: 'read' });
    expect(doc.jobs.mesurer.permissions).toEqual({ contents: 'read', actions: 'read', issues: 'read' });
    expect(doc.jobs.publier.permissions).toEqual({ contents: 'write' });
    expect(doc.jobs.publier.needs).toBe('mesurer');
    expect(yml).not.toMatch(/continue-on-error/);
  });
  it('dépose son résultat en artefact déclaré `sans-prod`', () => {
    // Lu en texte : importer ce fichier rejouerait ses propres cas dans celui-ci.
    const garde = readFileSync(join(RACINE, 'scripts/artefacts-donnees-prod.guard.test.mjs'), 'utf8');
    expect(garde).toMatch(/'indicateurs\.yml › indicateurs': \{\s*nature: 'sans-prod'/);
    expect(yml).toMatch(/upload-artifact@/);
  });
  it('ne reçoit aucun secret du dépôt', () => {
    expect(yml).not.toMatch(/secrets\.(?!GITHUB_TOKEN)/);
  });
});

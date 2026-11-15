import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadReportPdf, type ReportPdfModel } from './report-pdf';

// Faux jsPDF : on enregistre les appels pour vérifier CE QUI est écrit dans le
// document (textes nettoyés, pagination, nom du fichier), pas le binaire.
const calls: { texts: string[]; pages: number; save: string | null; pageSet: number[] } = {
  texts: [],
  pages: 1,
  save: null,
  pageSet: [],
};

vi.mock('@/lib/vendor-pdf', () => {
  class FakeDoc {
    setTextColor() {}
    setFillColor() {}
    setDrawColor() {}
    setLineWidth() {}
    setFont() {}
    setFontSize() {}
    roundedRect() {}
    rect() {}
    circle() {}
    line() {}
    getTextWidth(s: string) {
      return s.length;
    }
    splitTextToSize(s: string) {
      return [s];
    }
    text(s: string | string[]) {
      calls.texts.push(...(Array.isArray(s) ? s : [s]));
    }
    addPage() {
      calls.pages += 1;
    }
    getNumberOfPages() {
      return calls.pages;
    }
    setPage(i: number) {
      calls.pageSet.push(i);
    }
    save(name: string) {
      calls.save = name;
    }
  }
  return { jsPDF: FakeDoc };
});

const baseModel = (): ReportPdfModel => ({
  fileName: 'rapport.pdf',
  title: 'Rapport d’activité',
  scopeLabel: 'Entreprise',
  periodLabel: '7 jours',
  generatedLabel: 'Généré le 1er',
  pageLabel: (p, t) => `Page ${p}/${t}`,
  summaryTitle: 'Résumé',
  summary: ['Tout va bien.', 'Deux projets avancés.'],
  kpis: [
    { label: 'Tâches', value: '12 000', trend: '+4', tone: 'up', series: [1, 2, 3] },
    { label: 'Retards', value: '3', trend: '-1', tone: 'down', series: [3, 2] },
    { label: 'Neutre', value: '0', trend: null, tone: null, series: [] },
  ],
  teamsTitle: 'Équipes',
  teams: [
    { name: 'Dev', color: '#3B82F6', value: 8, label: '8 tâches' },
    { name: 'Ops', color: 'pas-une-couleur', value: 2, label: '2 tâches' },
  ],
  projectsTitle: 'Projets',
  projects: [
    { name: 'Site', sub: 'Équipe Dev', before: 20, after: 80, badge: '+60 pts', detail: '80 %' },
    { name: 'App', before: 10, after: 10, badge: null, detail: '3 tâches · 10 %' },
  ],
  krsTitle: 'Résultats clés',
  krs: [],
  peopleTitle: 'Personnes',
  people: [
    {
      name: 'Ada',
      meta: '2 tâches',
      tasksTitle: 'Tâches',
      eventsTitle: 'Événements',
      noTasks: 'Aucune tâche',
      noEvents: 'Aucun événement',
      tasks: [{ text: 'Revue', when: 'lun.' }],
      events: [],
    },
    {
      name: 'Bob',
      meta: '0',
      tasksTitle: 'Tâches',
      eventsTitle: 'Événements',
      noTasks: 'Aucune tâche',
      noEvents: 'Aucun événement',
      tasks: [],
      events: [{ text: 'Démo', when: 'mar.' }],
    },
  ],
  footer: 'COSMO → rapport',
});

describe('downloadReportPdf', () => {
  beforeEach(() => {
    calls.texts = [];
    calls.pages = 1;
    calls.save = null;
    calls.pageSet = [];
  });

  it('enregistre le fichier sous le nom demandé et numérote chaque page', async () => {
    await downloadReportPdf(baseModel());
    expect(calls.save).toBe('rapport.pdf');
    expect(calls.pageSet).toEqual([1]);
    expect(calls.texts).toContain('Page 1/1');
  });

  it('écrit titre, KPI, projets, personnes et équipes', async () => {
    await downloadReportPdf(baseModel());
    for (const expected of ['Entreprise · 7 jours', 'Tout va bien. Deux projets avancés.', 'Site', 'App', 'Ada', 'Bob', 'Dev', 'Ops', '8 tâches']) {
      expect(calls.texts).toContain(expected);
    }
  });

  it('remplace les espaces insécables et la flèche, que la police du PDF ne sait pas dessiner', async () => {
    await downloadReportPdf(baseModel());
    expect(calls.texts).toContain('12 000');
    expect(calls.texts).toContain('COSMO -> rapport');
    expect(calls.texts.join('')).not.toMatch(new RegExp('[\u202f\u00a0\u2192]'));
  });

  it('affiche les messages vides pour une personne sans tâche ou sans événement', async () => {
    await downloadReportPdf(baseModel());
    expect(calls.texts).toContain('Aucune tâche');
    expect(calls.texts).toContain('Aucun événement');
  });

  it('un badge absent retombe sur le dernier segment du détail', async () => {
    await downloadReportPdf(baseModel());
    expect(calls.texts).toContain('10 %');
    expect(calls.texts).toContain('+60 pts');
  });

  it('ajoute des pages quand le contenu déborde et numérote toutes les pages', async () => {
    const model = baseModel();
    const person = model.people[0];
    model.people = Array.from({ length: 40 }, (_, i) => ({ ...person, name: `P${i}` }));
    await downloadReportPdf(model);
    expect(calls.pages).toBeGreaterThan(1);
    expect(calls.pageSet).toHaveLength(calls.pages);
    expect(calls.texts).toContain(`Page ${calls.pages}/${calls.pages}`);
  });

  it('sans résumé, ni équipes, ni personnes : le document reste valide', async () => {
    const model = baseModel();
    model.summary = [];
    model.teams = [];
    model.people = [];
    model.projects = [];
    await downloadReportPdf(model);
    expect(calls.save).toBe('rapport.pdf');
    expect(calls.texts).not.toContain('Équipes');
    expect(calls.texts).not.toContain('Résumé');
  });
});

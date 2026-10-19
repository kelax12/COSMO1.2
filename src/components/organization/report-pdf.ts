/**
 * Export PDF du rapport d'activité : même ordre et même lecture que l'écran
 * (chiffres clés, projets et OKR, fiches par personne, équipes), dessiné à la main
 * avec jsPDF. Le modèle arrive déjà traduit : ce fichier ne connaît aucun texte.
 *
 * jsPDF pèse ~350 ko : il n'est chargé qu'au clic sur « Exporter ».
 */

export interface PdfKpi {
  label: string;
  value: string;
  trend: string | null;
  tone: 'up' | 'down' | 'flat' | null;
  series: number[];
}

export interface PdfProgress {
  name: string;
  /** Sous-titre (OKR parent), facultatif. */
  sub?: string;
  before: number;
  after: number;
  badge: string | null;
  detail: string;
}

export interface PdfPerson {
  name: string;
  meta: string;
  tasksTitle: string;
  eventsTitle: string;
  noTasks: string;
  noEvents: string;
  /** `when` vide : rapport d'une seule journée, la date n'apporte rien. */
  tasks: { text: string; when: string }[];
  events: { text: string; when: string }[];
}

export interface ReportPdfModel {
  fileName: string;
  title: string;
  scopeLabel: string;
  periodLabel: string;
  generatedLabel: string;
  pageLabel: (page: number, total: number) => string;
  summaryTitle: string;
  summary: string[];
  kpis: PdfKpi[];
  teamsTitle: string;
  teams: { name: string; color: string; value: number; label: string }[];
  projectsTitle: string;
  projects: PdfProgress[];
  krsTitle: string;
  krs: PdfProgress[];
  peopleTitle: string;
  people: PdfPerson[];
  footer: string;
}

type Rgb = [number, number, number];
const INK: Rgb = [24, 24, 27];
const MUTED: Rgb = [113, 113, 122];
const LINE: Rgb = [228, 228, 231];
const SOFT: Rgb = [244, 244, 245];
const GREEN: Rgb = [16, 185, 129];
const GREEN_TEXT: Rgb = [4, 120, 87];
const GREEN_BG: Rgb = [209, 250, 229];
const AMBER_TEXT: Rgb = [180, 83, 9];
const AMBER_BG: Rgb = [254, 243, 199];
const BEFORE: Rgb = [212, 212, 216];

const PAGE_W = 210;
const PAGE_H = 297;
const M = 16;
const W = PAGE_W - M * 2;

/** Helvetica (WinAnsi) n'a ni espace fine insécable ni flèche. */
const clean = (s: string) => s.replace(/[\u202f\u00a0]/g, ' ').replace(/\u2192/g, '->');

const hexToRgb = (hex: string): Rgb => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return Number.isNaN(n) ? MUTED : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const downloadReportPdf = async (model: ReportPdfModel): Promise<void> => {
  const { jsPDF } = await import('@/lib/vendor-pdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = M;

  const color = (c: Rgb) => doc.setTextColor(c[0], c[1], c[2]);
  const fill = (c: Rgb) => doc.setFillColor(c[0], c[1], c[2]);
  const font = (size: number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
  };
  const text = (s: string, x: number, yy: number, opts?: { align?: 'left' | 'right' | 'center'; maxWidth?: number }) =>
    doc.text(clean(s), x, yy, opts);
  const ensure = (h: number) => {
    if (y + h > PAGE_H - M - 6) {
      doc.addPage();
      y = M;
    }
  };
  const bar = (x: number, yy: number, w: number, before: number, after: number) => {
    const b = Math.min(100, Math.max(0, before));
    const a = Math.min(100, Math.max(b, after));
    fill(SOFT); doc.roundedRect(x, yy, w, 1.8, 0.9, 0.9, 'F');
    if (b > 0) { fill(BEFORE); doc.rect(x, yy, (w * b) / 100, 1.8, 'F'); }
    if (a > b) { fill(GREEN); doc.rect(x + (w * b) / 100, yy, (w * (a - b)) / 100, 1.8, 'F'); }
  };
  const pill = (label: string, xRight: number, yy: number, tone: 'green' | 'amber' | 'muted') => {
    font(7.5, true);
    const w = doc.getTextWidth(clean(label)) + 4;
    fill(tone === 'green' ? GREEN_BG : tone === 'amber' ? AMBER_BG : SOFT);
    doc.roundedRect(xRight - w, yy - 3.2, w, 4.4, 2.2, 2.2, 'F');
    color(tone === 'green' ? GREEN_TEXT : tone === 'amber' ? AMBER_TEXT : MUTED);
    text(label, xRight - w / 2, yy, { align: 'center' });
  };
  const sectionTitle = (s: string) => {
    ensure(12);
    font(11, true); color(INK);
    text(s, M, y + 4);
    y += 8;
  };

  // En-tête
  font(18, true); color(INK);
  text(model.title, M, y + 6);
  font(9); color(MUTED);
  text(model.generatedLabel, M + W, y + 6, { align: 'right' });
  y += 12;
  font(11, true); color(INK);
  text(`${model.scopeLabel} · ${model.periodLabel}`, M, y + 4);
  y += 9;
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.line(M, y, M + W, y);
  y += 6;

  // En bref
  if (model.summary.length > 0) {
    const lines = doc.splitTextToSize(clean(model.summary.join(' ')), W - 10) as string[];
    const h = 10 + lines.length * 4.6;
    ensure(h);
    fill(SOFT); doc.roundedRect(M, y, W, h, 3, 3, 'F');
    font(8.5, true); color(MUTED);
    text(model.summaryTitle, M + 5, y + 6);
    font(10); color(INK);
    doc.text(lines, M + 5, y + 11.5);
    y += h + 6;
  }

  // Chiffres clés
  const gap = 4;
  const kw = (W - gap * (model.kpis.length - 1)) / model.kpis.length;
  const kh = model.kpis.some((k) => k.series.length > 1) ? 26 : 19;
  ensure(kh + 2);
  model.kpis.forEach((k, i) => {
    const x = M + i * (kw + gap);
    fill(SOFT); doc.roundedRect(x, y, kw, kh, 3, 3, 'F');
    font(8); color(MUTED);
    text(k.label, x + 4, y + 6, { maxWidth: kw - 8 });
    font(16, true); color(INK);
    text(k.value, x + 4, y + 14);
    if (k.trend) pill(k.trend, x + kw - 4, y + 13.5, k.tone === 'up' ? 'green' : k.tone === 'down' ? 'amber' : 'muted');
    const max = Math.max(1, ...k.series);
    if (k.series.length > 1) {
      const c = k.tone === 'down' ? AMBER_TEXT : k.tone === 'up' ? GREEN : MUTED;
      doc.setDrawColor(c[0], c[1], c[2]);
      doc.setLineWidth(0.5);
      const sx = (kw - 8) / (k.series.length - 1);
      for (let j = 1; j < k.series.length; j++) {
        doc.line(x + 4 + sx * (j - 1), y + 23 - (k.series[j - 1] / max) * 5, x + 4 + sx * j, y + 23 - (k.series[j] / max) * 5);
      }
      doc.setLineWidth(0.2);
    }
  });
  y += kh + 6;

  // Projets et résultats clés
  const progressBlock = (title: string, items: PdfProgress[]) => {
    if (items.length === 0) return;
    sectionTitle(title);
    for (const it of items) {
      const h = it.sub ? 15.5 : 13;
      ensure(h);
      font(9.5); color(INK);
      text(it.name, M, y + 3, { maxWidth: W - 40 });
      if (it.badge) pill(it.badge, M + W, y + 3, 'green');
      else { font(8.5, true); color(GREEN_TEXT); text(it.detail.split(' · ').pop() ?? '', M + W, y + 3, { align: 'right' }); }
      bar(M, y + 5.2, W, it.before, it.after);
      font(8); color(MUTED);
      text(it.sub ? `${it.sub} · ${it.detail}` : it.detail, M, y + 10.2);
      y += h;
    }
    y += 3;
  };
  progressBlock(model.projectsTitle, model.projects);
  progressBlock(model.krsTitle, model.krs);

  // Qui a fait quoi : une fiche par personne, tâches à gauche, événements à droite (comme l'écran)
  if (model.people.length > 0) {
    sectionTitle(model.peopleTitle);
    const leftW = W * 0.58 - 4;
    const rightX = M + W * 0.58 + 4;
    const rightW = W * 0.42 - 4;
    for (const p of model.people) {
      ensure(22);
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
      doc.line(M, y, M + W, y);
      y += 5;
      font(10, true); color(INK);
      text(p.name, M, y);
      font(8.5); color(MUTED);
      text(p.meta, M + W, y, { align: 'right' });
      y += 6;
      font(8); color(MUTED);
      text(p.tasksTitle, M, y);
      text(p.eventsTitle, rightX, y);
      y += 4.5;
      const left = p.tasks.length ? p.tasks : null;
      const right = p.events.length ? p.events : null;
      const rows = Math.max(left?.length ?? 1, right?.length ?? 1);
      for (let i = 0; i < rows; i++) {
        font(9);
        const lt = left?.[i];
        const rt = right?.[i];
        const lLines = lt ? (doc.splitTextToSize(clean(lt.text), leftW - (lt.when ? 22 : 6)) as string[]) : [];
        const rLines = rt ? (doc.splitTextToSize(clean(rt.text), rightW - 4) as string[]) : [];
        const h = Math.max(lLines.length, rLines.length + (rt ? 1 : 0), 1) * 4.2 + 1;
        ensure(h);
        if (i === 0 && !left) { font(9); color(MUTED); text(p.noTasks, M, y); }
        if (lt) {
          fill(GREEN); doc.circle(M + 1.2, y - 1.1, 0.9, 'F');
          font(9); color(INK); doc.text(lLines, M + 4, y);
          if (lt.when) { font(8); color(MUTED); text(lt.when, M + leftW, y, { align: 'right' }); }
        }
        if (i === 0 && !right) { font(9); color(MUTED); text(p.noEvents, rightX, y); }
        if (rt) {
          font(8); color(MUTED); text(rt.when, rightX, y);
          font(9); color(INK); doc.text(rLines, rightX, y + 4.2);
        }
        y += h;
      }
      y += 3;
    }
  }

  // Performance par équipe (rapport d'entreprise), en fin de rapport comme à l'écran
  if (model.teams.length > 0) {
    sectionTitle(model.teamsTitle);
    const max = Math.max(1, ...model.teams.map((tm) => tm.value));
    for (const tm of model.teams) {
      ensure(7);
      const c = hexToRgb(tm.color);
      fill(c); doc.circle(M + 1.2, y + 1.6, 1.2, 'F');
      font(9.5); color(INK);
      text(tm.name, M + 5, y + 2.6, { maxWidth: 45 });
      bar(M + 52, y + 0.8, W - 52 - 38, 0, (tm.value / max) * 100);
      font(8.5); color(MUTED);
      text(tm.label, M + W, y + 2.6, { align: 'right' });
      y += 7;
    }
    y += 4;
  }

  // Pied
  ensure(10);
  y += 2;
  font(8); color(MUTED);
  doc.text(doc.splitTextToSize(clean(model.footer), W) as string[], M, y);

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    font(8); color(MUTED);
    text(model.pageLabel(i, total), M + W, PAGE_H - 8, { align: 'right' });
  }
  doc.save(model.fileName);
};

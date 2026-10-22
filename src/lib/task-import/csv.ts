// ═══════════════════════════════════════════════════════════════════
// Analyseur CSV de l'import de tâches (RFC 4180, plus ce que les exports
// réels font vraiment)
//
// Pas de dépendance : le format est petit, et les exports qu'on lit ont des
// particularités qu'une bibliothèque générique laisse passer sans les voir :
//   · BOM UTF-8 en tête (Excel, Notion) ;
//   · retours à la ligne DANS un champ entre guillemets (descriptions
//     Todoist, contenu des checklists TickTick) ;
//   · séparateur `;` (Excel en français) ou tabulation.
// Logique pure, testée dans csv.test.ts.
// ═══════════════════════════════════════════════════════════════════

export type CsvDelimiter = ',' | ';' | '\t';
const DELIMITERS: readonly CsvDelimiter[] = [',', ';', '\t'];

const stripBom = (text: string): string => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

/**
 * Le séparateur le plus fréquent HORS guillemets sur la première ligne non
 * vide. Virgule par défaut, y compris pour un fichier d'une seule colonne.
 */
export function detectDelimiter(text: string): CsvDelimiter {
  const body = stripBom(text);
  const counts = new Map<CsvDelimiter, number>(DELIMITERS.map((d) => [d, 0]));
  let inQuotes = false;
  let seen = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (seen) break;
      continue;
    } else {
      seen = true;
      if (!inQuotes && counts.has(ch as CsvDelimiter)) {
        counts.set(ch as CsvDelimiter, (counts.get(ch as CsvDelimiter) ?? 0) + 1);
      }
    }
  }
  let best: CsvDelimiter = ',';
  for (const d of DELIMITERS) if ((counts.get(d) ?? 0) > (counts.get(best) ?? 0)) best = d;
  return best;
}

/** Lignes du fichier, champs déjà débarrassés de leurs guillemets. Lignes vides ignorées. */
export function parseCsv(text: string, delimiter: CsvDelimiter = detectDelimiter(text)): string[][] {
  const body = stripBom(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const endField = () => { row.push(field); field = ''; };
  const endRow = () => {
    endField();
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inQuotes) {
      if (ch === '"') {
        if (body[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === delimiter) endField();
    else if (ch === '\r') { endRow(); if (body[i + 1] === '\n') i++; }
    else if (ch === '\n') endRow();
    else field += ch;
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

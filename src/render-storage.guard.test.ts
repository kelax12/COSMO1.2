// ═══════════════════════════════════════════════════════════════════
// Garde statique : aucun initialiseur de RENDU ne lit le stockage à nu
//
// POURQUOI CE FICHIER EXISTE (audit A-7, 2026-09-03)
//
// Un `useState(() => …)` ou un `useMemo(() => …)` s'exécute EN PHASE DE RENDU.
// Ce qui y lève ne remonte pas dans un `onError` : ça remonte à la frontière
// d'erreur la plus proche, et l'écran devient « Une erreur inattendue s'est
// produite », sans cause et sans issue.
//
// LE CAS MESURÉ, dans le navigateur le 2026-09-03 (`src/components/Layout.tsx`) :
//
//     const [isCollapsed, setIsCollapsed] = useState(() => {
//       const saved = localStorage.getItem('sidebar-collapsed');
//       return saved ? JSON.parse(saved) : false;      // ❌ ni try, ni safeParse
//     });
//
// `Layout` est le parent de TOUTES les pages protégées. Trois entrées mesurées
// donnent le même écran générique :
//   1. une valeur non-JSON dans la clé (`'oui'`) → `JSON.parse` lève ;
//   2. un navigateur qui REFUSE le stockage (navigation privée stricte,
//      « bloquer les données de site ») → `getItem` lève, sur un profil neuf,
//      sans aucune valeur corrompue ;
//   3. le bouton « Rafraîchir la page », seule sortie proposée, relit la même
//      clé et rend le MÊME écran : l'impasse est permanente.
//
// C'est la règle B14 de CLAUDE.md (« ❌ `JSON.parse(localStorage.getItem(...))`
// sans try/catch — utiliser `safeParse<T>` »), et le helper existait déjà
// (`src/lib/safe-json.ts`).
//
// FORME : garde textuelle, avec TÉMOIN. Elle ne prouve pas que l'écran tient,
// elle prouve qu'aucun initialiseur de rendu n'a reperdu sa protection.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(process.cwd(), 'src');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Corps d'un `useState(() => { … })` / `useMemo(() => { … })`, accolades appariées. */
const INITIALISER = /use(?:State|Memo)\s*(?:<[^>]*>)?\s*\(\s*\(\s*\)\s*=>\s*\{/g;

function bodyFrom(code: string, openBrace: number): string {
  let depth = 0;
  for (let i = openBrace; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}' && --depth === 0) return code.slice(openBrace, i + 1);
  }
  return code.slice(openBrace);
}

/** Initialiseurs qui touchent au stockage ou à `JSON.parse` sans aucun `try`. */
export function unguardedRenderReads(code: string): string[] {
  const found: string[] = [];
  for (const match of code.matchAll(INITIALISER)) {
    const body = bodyFrom(code, match.index! + match[0].length - 1);
    const touchesStorage = /localStorage|sessionStorage|JSON\.parse/.test(body);
    if (touchesStorage && !/\btry\b/.test(body)) found.push(body.replace(/\s+/g, ' ').slice(0, 120));
  }
  return found;
}

describe('Aucun initialiseur de rendu ne lit le stockage à nu (audit A-7)', () => {
  it('TÉMOIN : le détecteur voit un initialiseur non protégé', () => {
    // Sans ce témoin, un détecteur cassé rendrait « zéro occurrence », donc
    // vert, donc rassurant — le défaut relevé quatre fois sur ce dépôt.
    const echantillon = `
      const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem('sidebar-collapsed');
        return saved ? JSON.parse(saved) : false;
      });
    `;
    expect(unguardedRenderReads(echantillon)).toHaveLength(1);
  });

  it('TÉMOIN INVERSE : un initialiseur protégé n\'est pas signalé', () => {
    const echantillon = `
      const [v] = useState(() => {
        try { return JSON.parse(localStorage.getItem('k') ?? 'null'); } catch { return null; }
      });
    `;
    expect(unguardedRenderReads(echantillon)).toHaveLength(0);
  });

  it('aucune occurrence dans src/', () => {
    const coupables: string[] = [];
    for (const file of sourceFiles(SRC)) {
      for (const body of unguardedRenderReads(readFileSync(file, 'utf8'))) {
        coupables.push(`${path.relative(SRC, file).split(path.sep).join('/')} → ${body}`);
      }
    }
    expect(coupables, 'utiliser readJson / safeParse (src/lib/safe-json.ts)').toEqual([]);
  });
});

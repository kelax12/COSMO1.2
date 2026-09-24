// ═══════════════════════════════════════════════════════════════════
// GARDE : une lecture plafonnée ne trie JAMAIS le temps en croissant
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI (audit « passage à l'échelle » du mode entreprise, 2026-09-24).
//
// `getProjects` lisait `order('created_at', { ascending: true }).limit(200)`.
// Sous un plafond, un tri croissant garde les lignes les PLUS ANCIENNES : une
// organisation qui passait 200 projets ne voyait plus ceux qu'elle venait de
// créer, sans une erreur. Le même motif vivait dans quatre autres lectures
// (membres, équipes, demandes d'adhésion, commentaires), et le seul signal
// était un toast montré une fois par session.
//
// La forme juste : trier DÉCROISSANT sous le plafond, puis inverser côté
// client si l'écran veut l'ordre chronologique (`.reverse()`).
//
// Le détecteur ne vise que les colonnes TEMPORELLES (`*_at`, `date`,
// `start_time`) : un tri par nom ou par position sous plafond coupe
// l'alphabet, c'est un autre sujet, et il ne fait pas disparaître le dernier
// objet créé.
//
// ── LE TÉMOIN ────────────────────────────────────────────────────────
//
// Le motif fautif est soumis au détecteur, qui DOIT le voir. Sans ça, une
// regex cassée rendrait cette garde verte pour toujours.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const MODULES = join(process.cwd(), 'src', 'modules');

/**
 * Lectures plafonnées dont le tri croissant est VOULU, nommées une par une
 * avec leur raison. Vide aujourd'hui : un fichier ajouté à l'avenir doit
 * échouer, pas hériter d'une dispense.
 */
const ALLOWED = new Set<string>([]);

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [p] : [];
  });

/**
 * Rend les tris temporels croissants suivis d'un `.limit(` dans la même
 * chaîne (jusqu'au prochain `;`). Chaque résultat est `<colonne>@<ligne>`.
 */
export function findAscendingCappedReads(source: string): string[] {
  const hits: string[] = [];
  const re = /\.order\(\s*'([a-z_]+)'\s*,\s*\{[^}]*ascending:\s*true[^}]*\}\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const col = m[1];
    if (!/_at$|^date$|^start_time$/.test(col)) continue;
    const end = source.indexOf(';', m.index);
    const chain = source.slice(m.index, end === -1 ? undefined : end);
    if (!/\.limit\(/.test(chain)) continue;
    const line = source.slice(0, m.index).split('\n').length;
    hits.push(`${col}@${line}`);
  }
  return hits;
}

describe('lectures plafonnées : jamais de tri temporel croissant', () => {
  it('témoin : le détecteur voit le motif fautif, et laisse passer la forme juste', () => {
    const faulty = `await supabase.rpc('x').select('*')\n  .order('created_at', { ascending: true })\n  .limit(200);`;
    const fixed = `await supabase.rpc('x').select('*')\n  .order('created_at', { ascending: false })\n  .limit(200);`;
    const byName = `await supabase.from('x').select('*')\n  .order('name', { ascending: true })\n  .limit(200);`;
    const uncapped = `await supabase.from('x').select('*')\n  .order('created_at', { ascending: true });\nfoo.limit(3);`;
    expect(findAscendingCappedReads(faulty)).toEqual(['created_at@2']);
    expect(findAscendingCappedReads(fixed)).toEqual([]);
    expect(findAscendingCappedReads(byName)).toEqual([]);
    expect(findAscendingCappedReads(uncapped)).toEqual([]);
  });

  it('aucun repository ne garde les lignes les plus anciennes sous un plafond', () => {
    const files = walk(MODULES);
    // Garde contre un balayage vide (mauvais cwd, dossier renommé).
    expect(files.length).toBeGreaterThan(20);
    const offenders = files.flatMap((f) => {
      const rel = relative(MODULES, f).replace(/\\/g, '/');
      if (ALLOWED.has(rel)) return [];
      return findAscendingCappedReads(readFileSync(f, 'utf8')).map((h) => `${rel}:${h}`);
    });
    expect(offenders).toEqual([]);
  });
});

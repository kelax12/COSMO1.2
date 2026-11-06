// ═══════════════════════════════════════════════════════════════════
// fichiers-suivis.guard.test.mjs · aucun fichier interdit n'est SUIVI
// (SEC-01, SEC-07, 2026-11-06)
//
// 🔴 POURQUOI · le hook `.githooks/pre-commit` se saute d'un `--no-verify`.
// Cette garde relit tout ce que l'index suit (`git ls-files`) avec la MÊME
// liste que le hook (`scripts/check-fichiers-sensibles.mjs`, source unique) :
// un fichier interdit commité malgré tout fait rougir `npm test`, donc le
// noyau CI (`test:coverage`). Le job CI `fichiers-sensibles` relit en plus
// l'arbre de HEAD et chaque version poussée.
//
// ⚠️ Fichier À PART du témoin du hook : le rejeu des sabotages joue celui-là
// dans une copie SANS `.git`, où `git ls-files` ne lirait rien.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lireSuivis, juger, exceptionsPerimees, executerGit } from './check-fichiers-sensibles.mjs';

describe('git ls-files : le dépôt réel ne suit aucun fichier interdit', () => {
  it('l index est lu en entier, et aucun fichier suivi n est refusé', () => {
    const suivis = lireSuivis();
    // Jamais un vert muet : une lecture vide ou partielle n'est pas un dépôt propre.
    expect(suivis.length).toBeGreaterThan(1000);
    expect(suivis.some((e) => e.chemin === 'package.json')).toBe(true);
    expect(suivis.some((e) => e.chemin === 'scripts/check-fichiers-sensibles.mjs')).toBe(true);
    expect(juger(suivis)).toEqual([]);
    expect(exceptionsPerimees(suivis)).toEqual([]);
  });

  it('TÉMOIN : des fichiers interdits commités avec --no-verify sont vus et nommés', () => {
    const d = mkdtempSync(join(tmpdir(), 'fichiers-suivis-'));
    try {
      const g = (...args) => spawnSync('git', args, { cwd: d, encoding: 'utf8' });
      g('init', '-q');
      g('config', 'user.email', 'temoin@example.invalid');
      g('config', 'user.name', 'temoin');
      g('config', 'commit.gpgsign', 'false');
      const fichiers = {
        'src/a.ts': 'export const a = 1;\n',
        'prive/faille.md': '# findings ouverts\n',
        'leads-50.csv': 'nom,email\nA,a@example.invalid\n',
        '.claude/settings.local.json': '{}\n',
        'supabase/.temp/pooler-url': 'postgres://exemple.invalid\n',
      };
      for (const [chemin, contenu] of Object.entries(fichiers)) {
        mkdirSync(join(d, chemin, '..'), { recursive: true });
        writeFileSync(join(d, chemin), contenu);
      }
      g('add', '-f', '.');
      const commit = g('commit', '-q', '--no-verify', '-m', 'contournement');
      expect(commit.status, commit.stderr).toBe(0);

      const refus = juger(lireSuivis(executerGit(d)));
      expect(refus).toHaveLength(4);
      expect(refus.join('\n')).toMatch(/^prive\/faille\.md : dossier local/m);
      expect(refus.join('\n')).toMatch(/^leads-50\.csv : fichier de prospection/m);
      expect(refus.join('\n')).toMatch(/^\.claude\/settings\.local\.json : réglages locaux/m);
      expect(refus.join('\n')).toMatch(/^supabase\/\.temp\/pooler-url : état local du CLI Supabase/m);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  }, 30_000);
});

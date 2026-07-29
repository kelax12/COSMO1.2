import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────
// G-9 (faille.md) — garde d'invariant.
//
// L'analyse de risque de l'open redirect react-router conclut « exploitabilite
// nulle » sur un fait verifiable : AUCUNE destination de navigation n'est
// construite a partir d'un parametre d'URL. Ce n'est pas une propriete du
// framework, c'est une propriete de NOTRE code — donc elle peut se perdre
// silencieusement au prochain flux « retourne d'ou tu viens apres login ».
//
// Ce test la verrouille. Si tu tombes dessus en ajoutant une redirection :
// ne mets pas le fichier en liste blanche sans valider la destination contre
// une allowlist de chemins internes (cf. RESUMABLE_PAGES dans App.tsx).
// ─────────────────────────────────────────────────────────────────────────

const SRC = join(__dirname, '..');

// Lecture d'une destination depuis l'URL : searchParams, query string, hash.
const URL_INPUT = /searchParams|location\.search|location\.hash|URLSearchParams|window\.location\.href/;
// Usage de cette valeur comme cible de navigation.
const NAV_SINK = /\bnavigate\s*\(|\bto=\{|\bredirectTo\b|\bwindow\.location\s*=|\blocation\.assign\s*\(|\blocation\.replace\s*\(/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('G-9 — aucune navigation alimentee par un parametre d URL', () => {
  it('ne trouve aucune ligne combinant lecture d URL et cible de navigation', () => {
    const offenders: string[] = [];

    for (const file of walk(SRC)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (URL_INPUT.test(line) && NAV_SINK.test(line)) {
          offenders.push(`${relative(SRC, file)}:${i + 1} → ${line.trim()}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});

// Garde statique du design system mobile (cf. docs/MOBILE.md).
//
// Le mobile de COSMO a dérivé parce que chaque composant inventait sa propre
// taille de texte : `text-[8px]`, `[9px]`, `[10px]`, `[11px]`, `[13px]`,
// `[15px]`, `[17px]` coexistaient avec les 9 tailles Tailwind — d'où un rendu
// illisible et incohérent sur téléphone.
//
// L'échelle mobile est désormais FERMÉE à 6 crans
// (display / title / headline / body / label / caption), plancher 11px.
//
// Ce fichier pose deux gardes de nature différente :
//
//  1. `ENFORCED_SCOPE` — plancher DUR de 11px. Toute zone déjà migrée y entre.
//     Le desktop n'y est volontairement pas : le migrer changerait son rendu,
//     ce qui est hors périmètre de la refonte mobile.
//  2. Budget global — le stock de tailles arbitraires restantes ne doit jamais
//     augmenter. Chaque migration doit faire BAISSER `ARBITRARY_BUDGET`.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

/** Zones où le plancher de 11px est appliqué strictement. À étendre à chaque migration. */
const ENFORCED_SCOPE = ['src/components/mobile'];

const SCAN_ROOTS = ['src/components', 'src/pages'];
/** shadcn (non modifiable) + showcases marketing (déjà ignorés par ESLint). */
const EXCLUDED_DIRS = new Set(['ui', 'showcase']);

/**
 * Stock de tailles arbitraires en px hors zone migrée, mesuré au 2026-07-22.
 * Ce nombre ne doit JAMAIS monter. Il baisse au fil des pages migrées.
 */
const ARBITRARY_BUDGET = 294;

/** `text-[10px]` → capture "10". Ignore rem/%/var — seul le px pose problème. */
const ARBITRARY_TEXT_SIZE = /text-\[(\d+(?:\.\d+)?)px\]/g;

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc; // dossier pas encore créé (ex. src/components/mobile au 1er run)
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (EXCLUDED_DIRS.has(entry)) continue;
      collectSourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

const files = SCAN_ROOTS.flatMap((root) => collectSourceFiles(path.resolve(process.cwd(), root)));
const rel = (file: string) => path.relative(process.cwd(), file).replace(/\\/g, '/');
const isEnforced = (file: string) => ENFORCED_SCOPE.some((scope) => rel(file).startsWith(scope));

describe('design system mobile — échelle typographique', () => {
  it('trouve bien des fichiers source à analyser', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('interdit toute taille de texte arbitraire dans les zones migrées', () => {
    const violations = files
      .filter(isEnforced)
      .flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(ARBITRARY_TEXT_SIZE)].map(
          (m) => `${rel(file)} → ${m[0]}`,
        ),
      );

    expect(
      violations,
      "Zone migrée : utiliser l'échelle mobile " +
        '(text-display/title/headline/body/label/caption), pas une taille arbitraire :\n' +
        violations.join('\n'),
    ).toEqual([]);
  });

  it('interdit partout une taille sous le plancher de 11px', () => {
    // Le plancher bas s'applique même hors zone migrée : personne ne doit
    // AJOUTER un nouveau text-[8px]. Les occurrences historiques sont listées
    // ici — cette liste ne doit que rétrécir.
    const KNOWN_SUB_11PX = 143;

    const count = files.reduce(
      (sum, file) =>
        sum +
        [...readFileSync(file, 'utf8').matchAll(ARBITRARY_TEXT_SIZE)].filter(
          (m) => Number(m[1]) < 11,
        ).length,
      0,
    );

    expect(
      count,
      `${count} tailles sous 11px détectées (référence : ${KNOWN_SUB_11PX}). ` +
        "Ne jamais en ajouter : le plancher mobile est text-caption (11px).",
    ).toBeLessThanOrEqual(KNOWN_SUB_11PX);
  });

  it('ne laisse pas repartir à la hausse le stock de tailles arbitraires', () => {
    const total = files.reduce(
      (sum, file) => sum + [...readFileSync(file, 'utf8').matchAll(ARBITRARY_TEXT_SIZE)].length,
      0,
    );

    expect(
      total,
      `Stock de tailles arbitraires : ${total} > budget ${ARBITRARY_BUDGET}. ` +
        "Utiliser l'échelle mobile. Si une migration fait baisser ce nombre, " +
        'baisser aussi ARBITRARY_BUDGET dans ce fichier.',
    ).toBeLessThanOrEqual(ARBITRARY_BUDGET);
  });
});

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
//
// Detection sur DEUX axes, parce qu'une detection ligne-a-ligne ratait la
// forme la plus naturelle du bug (mesure : 1 cas sur 4 attrape) :
//   1. Teinte — on collecte les identifiants affectes depuis l'URL, puis on
//      signale toute cible de navigation qui les reference. C'est la forme
//      canonique : `const next = searchParams.get('next')` puis `navigate(next)`.
//   2. Fenetre glissante de 3 lignes — attrape les appels multi-lignes, ou
//      la lecture d'URL est passee directement en argument.
// ─────────────────────────────────────────────────────────────────────────

const SRC = join(__dirname, '..');

// Lecture d'une destination depuis l'URL courante : query string, hash,
// searchParams. `window.location.href` en est volontairement ABSENT : en
// pratique il apparait toujours a gauche d'une affectation (`… = data.url`),
// donc l'inclure faisait s'auto-detecter les redirections Stripe legitimes,
// dont la cible vient de l'Edge Function et non de l'URL. Il reste couvert
// comme CIBLE via NAV_SINK, et comme SOURCE via ASSIGN_FROM_URL (qui exige
// un `const`/`let`/`var`, donc une vraie lecture).
const URL_INPUT =
  /searchParams|location\.search|location\.hash|URLSearchParams|\bparams\.get\s*\(/;

/** Usage d'une valeur comme cible de navigation. */
const NAV_SINK =
  /\bnavigate\s*\(|\bto=\{|\bredirectTo\b|\bwindow\.location\s*=|\blocation\.href\s*=|\blocation\.assign\s*\(|\blocation\.replace\s*\(|\bwindow\.open\s*\(/;

/** `const next = searchParams.get('next')` → capture `next` comme teinte. */
const ASSIGN_FROM_URL = new RegExp(
  String.raw`(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=[^=]*(?:` +
    String.raw`searchParams|location\.search|location\.hash|URLSearchParams|window\.location\.href|params\.get\s*\(` +
    String.raw`)`
);

const WINDOW = 3;

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

/** Reproduit la logique de detection sur un contenu deja decoupe en lignes. */
function detect(lines: string[]): { line: number; why: string }[] {
  const hits: { line: number; why: string }[] = [];

  const tainted = new Set<string>();
  for (const l of lines) {
    const m = ASSIGN_FROM_URL.exec(l);
    if (m) tainted.add(m[1]);
  }

  lines.forEach((line, i) => {
    if (!NAV_SINK.test(line)) return;

    if (URL_INPUT.test(line)) {
      hits.push({ line: i, why: 'url-inline' });
      return;
    }

    for (const name of tainted) {
      // \b…\b pour ne pas confondre `next` et `nextStep`.
      if (new RegExp(String.raw`\b${name}\b`).test(line)) {
        hits.push({ line: i, why: `teinte:${name}` });
        return;
      }
    }

    const from = Math.max(0, i - WINDOW);
    const to = Math.min(lines.length, i + WINDOW + 1);
    for (let j = from; j < to; j++) {
      if (j !== i && URL_INPUT.test(lines[j])) {
        hits.push({ line: i, why: `url-proche:L${j + 1}` });
        return;
      }
    }
  });

  return hits;
}

describe('G-9 — aucune navigation alimentee par un parametre d URL', () => {
  it('ne trouve aucune cible de navigation derivee de l URL', () => {
    const offenders = walk(SRC).flatMap((file) => {
      const lines = readFileSync(file, 'utf8').split('\n');
      return detect(lines).map(
        ({ line, why }) => `${relative(SRC, file)}:${line + 1} [${why}] → ${lines[line].trim()}`
      );
    });

    expect(offenders).toEqual([]);
  });

  it('detecte bien les 4 formes realistes de reintroduction', () => {
    // Auto-test de la garde : sans lui, un affaiblissement des regex passerait
    // inapercu — le test principal resterait vert en ne detectant plus rien.
    const probes: Record<string, string> = {
      inline: `navigate(searchParams.get('next') ?? '/');`,
      'deux-lignes': `const next = searchParams.get('returnTo');\nnavigate(next ?? '/');`,
      'location-href': `window.location.href = params.get('next')!;`,
      'multi-lignes': `navigate(\n  searchParams.get('next') ?? '/'\n);`,
    };

    const undetected = Object.entries(probes)
      .filter(([, code]) => detect(code.split('\n')).length === 0)
      .map(([name]) => name);

    expect(undetected).toEqual([]);
  });
});

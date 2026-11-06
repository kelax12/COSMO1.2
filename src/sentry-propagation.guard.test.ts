/**
 * Garde M-32 (2026-10-16) : Sentry ajoute `baggage` et `sentry-trace` à toute
 * requête couverte par `tracePropagationTargets`. Si une cible couvre
 * `/functions/v1/`, chaque Edge Function appelée du navigateur doit autoriser
 * ces deux en-têtes, sinon la pré-requête CORS échoue et aucun POST ne part.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const main = readFileSync(join(root, 'src/main.tsx'), 'utf8');

function propagationTargets(): RegExp[] {
  const m = main.match(/tracePropagationTargets:\s*\[(.*)\],/);
  if (!m) throw new Error('tracePropagationTargets introuvable dans src/main.tsx');
  const literals = m[1].match(/\/(?:\\.|[^/\\])+\/[a-z]*/g) ?? [];
  return literals.map((lit) => {
    const end = lit.lastIndexOf('/');
    return new RegExp(lit.slice(1, end), lit.slice(end + 1));
  });
}

/**
 * Les en-têtes autorisés par chaque fonction : écrits sur place, ou hérités de
 * la politique unique `_shared/cors.ts` (COD-03, 2026-11-06) pour celles qui
 * importent `_shared/env.ts`. Sans ce second cas, les neuf fonctions migrées
 * sortiraient de la liste, et la garde ne verrait plus que `affiliation-api`.
 */
function functionsAllowHeaders(): Array<{ name: string; headers: string }> {
  const dir = join(root, 'supabase/functions');
  const shared = readFileSync(join(dir, '_shared/cors.ts'), 'utf8')
    .match(/CORS_ALLOW_HEADERS\s*=\s*'([^']*)'/);
  if (!shared) throw new Error('CORS_ALLOW_HEADERS introuvable dans _shared/cors.ts');
  return readdirSync(dir)
    .map((name) => ({ name, file: join(dir, name, 'index.ts') }))
    .filter(({ file }) => existsSync(file))
    .flatMap(({ name, file }) => {
      const src = readFileSync(file, 'utf8');
      const h = src.match(/'Access-Control-Allow-Headers':\s*'([^']*)'/);
      if (h) return [{ name, headers: h[1].toLowerCase() }];
      if (src.includes("from '../_shared/env.ts'") && src.includes('corsHeadersFor(')) {
        return [{ name, headers: shared[1].toLowerCase() }];
      }
      return [];
    });
}

describe('propagation Sentry vers les Edge Functions', () => {
  const targets = propagationTargets();

  it('lit au moins une cible de propagation', () => {
    expect(targets.length).toBeGreaterThan(0);
  });

  it('PostgREST reste couvert (corrélation des appels lents)', () => {
    expect(targets.some((r) => r.test('https://x.supabase.co/rest/v1/tasks'))).toBe(true);
  });

  it("aucune cible ne couvre /functions/v1/ tant qu'une fonction refuse baggage ou sentry-trace", () => {
    const fnUrl = 'https://x.supabase.co/functions/v1/report-bug';
    const covers = targets.some((r) => r.test(fnUrl));
    const fns = functionsAllowHeaders();
    // Dix fonctions appelées du navigateur au 2026-11-06 (neuf par `_shared/cors.ts`).
    expect(fns.length).toBeGreaterThanOrEqual(10);
    const refusing = fns
      .filter(({ headers }) => !(headers.includes('baggage') && headers.includes('sentry-trace')))
      .map(({ name }) => name);
    if (covers) expect(refusing).toEqual([]);
  });
});

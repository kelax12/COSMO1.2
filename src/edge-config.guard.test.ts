// ═══════════════════════════════════════════════════════════════════
// Témoin : chaque Edge Function déclare son `verify_jwt` (A-3, 2026-09-30)
//
// 🔴 `org-webhook-dispatch` était ABSENTE de `supabase/config.toml`. Déployée
// avec le défaut `verify_jwt = true`, elle recevait du workflow un appel sans
// `Authorization` : la passerelle répondait 401 avant le code, et aucun
// webhook d'entreprise n'est jamais parti. Rien ne le voyait, parce que la
// règle « jamais déployer sans entrée dans config.toml » (docs/SECURITY.md)
// n'était vérifiée par aucun script.
//
// Deux invariants, lus sur les fichiers :
//   1. chaque dossier de `supabase/functions/` (hors `_shared`) a sa section
//      `[functions.<slug>]` avec un `verify_jwt` explicite ;
//   2. une fonction qui s'authentifie par `x-cron-secret` (appelée par la CI,
//      jamais par un utilisateur) est en `verify_jwt = false`, et une fonction
//      qui lit le JWT de l'appelant est en `verify_jwt = true`.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const FUNCTIONS = join(ROOT, 'supabase/functions');

/** `{ slug: verify_jwt }` tel que `config.toml` le déclare. */
function declaredVerifyJwt(toml: string): Map<string, boolean> {
  const out = new Map<string, boolean>();
  let current: string | null = null;
  for (const raw of toml.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const section = line.match(/^\[functions\.([a-z0-9-]+)\]$/);
    if (section) { current = section[1]; continue; }
    if (line.startsWith('[')) { current = null; continue; }
    const v = line.match(/^verify_jwt\s*=\s*(true|false)$/);
    if (current && v) out.set(current, v[1] === 'true');
  }
  return out;
}

const slugs = readdirSync(FUNCTIONS).filter(
  (n) => n !== '_shared' && statSync(join(FUNCTIONS, n)).isDirectory(),
);
const declared = declaredVerifyJwt(readFileSync(join(ROOT, 'supabase/config.toml'), 'utf8'));
const source = (slug: string) => readFileSync(join(FUNCTIONS, slug, 'index.ts'), 'utf8');

describe('supabase/config.toml ↔ supabase/functions/', () => {
  it('le lecteur de TOML voit ce qu il doit voir (témoin)', () => {
    const m = declaredVerifyJwt('[functions.a]\nverify_jwt = false # cron\n[functions.b]\n# verify_jwt = false\n[db]\nverify_jwt = true\n');
    expect([...m]).toEqual([['a', false]]);
    // Sans ce témoin, un lecteur cassé qui ne voit rien rendrait le test suivant
    // inopérant sur une liste vide.
    expect(slugs.length).toBeGreaterThanOrEqual(12);
  });

  it.each(slugs)('%s déclare un verify_jwt explicite', (slug) => {
    expect(declared.has(slug), `[functions.${slug}] absente de supabase/config.toml`).toBe(true);
  });

  it.each(slugs)('%s : verify_jwt cohérent avec son mode d authentification', (slug) => {
    const src = source(slug);
    if (src.includes("req.headers.get('x-cron-secret')")) {
      expect(declared.get(slug), `${slug} est appelée par la CI sans JWT`).toBe(false);
    } else if (src.includes('auth.getUser()')) {
      expect(declared.get(slug), `${slug} identifie l appelant par son JWT`).toBe(true);
    }
  });
});

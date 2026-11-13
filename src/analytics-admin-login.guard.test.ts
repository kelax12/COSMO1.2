// ═══════════════════════════════════════════════════════════════════
// GARDE : connexion admin de cosmo-analytics (analytics-admin-login)
// ═══════════════════════════════════════════════════════════════════
// La connexion repose sur le seul code TOTP (choix de produit). Ce qui la
// borne est donc le plafond de débit, l'origine et l'échec fermé : chacun est
// épinglé ici, sur le texte de la fonction (module Deno, non exécutable sous
// vitest).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LF = String.fromCharCode(10);
const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8').split('\r\n').join(LF);
const index = read('supabase/functions/analytics-admin-login/index.ts');
const code = index.split(LF).filter((l) => !l.trim().startsWith('//')).join(LF);

/** Chaque appel `consumeRateLimits(...)` avec ses seaux : [domaine, limite]. */
function buckets(): { domain: string; limit: number }[] {
  return [...code.matchAll(/domain: '([^']+)'[^}]*?limit: (\d+)/g)].map((m) => ({ domain: m[1], limit: Number(m[2]) }));
}

describe('analytics-admin-login', () => {
  it('TEMOIN : le détecteur de seaux voit les plafonds de la fonction', () => {
    expect(buckets().length).toBeGreaterThanOrEqual(6);
  });

  it('est déclarée sans JWT du gateway (l appelant n a pas encore de session)', () => {
    const toml = read('supabase/config.toml');
    expect(toml).toMatch(/\[functions\.analytics-admin-login\]\s*\nverify_jwt = false/);
  });

  it('échoue FERMÉ : tout appel au plafond passe failClosed, et la base illisible refuse', () => {
    const appels = code.match(/consumeRateLimits\(/g) ?? [];
    const stricts = code.match(/\], STRICT\)/g) ?? [];
    expect(appels.length).toBeGreaterThanOrEqual(3);
    expect(code).toContain('const STRICT = { failClosed: true }');
    expect(appels.length).toBe(stricts.length);
    const rl = read('supabase/functions/_shared/rate-limit.ts');
    expect(rl).toMatch(/if \(options\.failClosed\) \{[^]{0,300}?allowed: false, misconfigured: true/);
  });

  it('un tiers isolé est refusé bien avant le verrou global', () => {
    const b = buckets();
    const ip = b.filter((x) => x.domain.includes('-ip-') || x.domain === 'analytics-admin-login');
    const global = b.filter((x) => x.domain.includes('global'));
    expect(ip.length).toBe(3);
    expect(global.length).toBe(2);
    // Plafond horaire par adresse (le palier 15 min borne l heure à 20) < global horaire.
    const h = global.find((x) => x.domain.endsWith('global'))!;
    expect(Math.max(...ip.map((x) => x.limit))).toBeLessThan(h.limit);
    // Le plafond par adresse est consommé AVANT le global.
    expect(code.indexOf("'analytics-admin-login-ip-1m'")).toBeLessThan(code.indexOf("'analytics-admin-login-global'"));
  });

  it('vérifie l origine côté serveur, avant de lire le corps', () => {
    expect(code).toContain('analyticsOrigins()');
    expect(code).toMatch(/!origin \|\| !ORIGINS\.has\(origin\)\) return json\(\{ error: 'forbidden_origin' \}, 403/);
    expect(code.indexOf('forbidden_origin')).toBeLessThan(code.indexOf('await login(req)'));
    expect(read('supabase/functions/_shared/env.ts')).toContain("requireEnv('AFFILIATION_ALLOWED_ORIGINS')");
  });

  it('ne journalise jamais le code, ne renvoie jamais le détail d une erreur', () => {
    for (const l of code.split(LF).filter((x) => /console\./.test(x))) {
      expect(l, l).not.toMatch(/\bcode\b|body|factor|token/);
    }
  });
});

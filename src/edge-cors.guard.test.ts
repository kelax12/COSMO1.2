// ═══════════════════════════════════════════════════════════════════
// GARDE — une seule politique CORS, aucune valeur par défaut localhost
// (COD-03, SEC-09, audit du 2026-11-06)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 CE QUI A EXISTÉ. Dix Edge Functions recopiaient leur `corsHeadersFor`,
// avec trois politiques différentes, dont trois qui acceptaient
// `http://localhost:5173` et `http://localhost:3000` EN PRODUCTION. Et huit
// déclaraient `APP_URL ?? 'http://localhost:5173'` : une variable absente ne
// faisait pas échouer la fonction, elle renvoyait les clients de Stripe vers
// localhost après paiement.
//
// Trois invariants :
//   1. la politique de `_shared/cors.ts` (testée ici en l'EXÉCUTANT, c'est du
//      TS pur) : origine de production seule, origine locale seulement par
//      `CORS_DEV_ORIGINS`, jamais le joker, `Vary: Origin` ;
//   2. aucun `index.ts` n'écrit son CORS sur place : il importe
//      `corsHeadersFor` de `_shared/env.ts` ;
//   3. aucun fichier de `supabase/functions/` ne porte une valeur par défaut
//      `localhost` (`?? 'http://localhost…'`, `|| 'http://127.0.0.1…'`).
//
// ⚠️ UNE EXCEPTION, NOMMÉE ET À DURÉE DE VIE : `affiliation-api` garde son
// CORS propre (allowlist `AFFILIATION_ALLOWED_ORIGINS`, autre politique,
// en-tête `x-affiliation-token`) parce qu'une autre session la modifiait le
// jour de cette migration. Le jour où elle passe par `_shared/env.ts`, le cas
// « l exception est encore nécessaire » ROUGIT : on retire alors la ligne, sans
// quoi l'exception survivrait à sa raison.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  allowedOrigins,
  corsHeaders,
  requireValue,
} from '../supabase/functions/_shared/cors';

const ROOT = process.cwd();
const FUNCTIONS = join(ROOT, 'supabase/functions');
const LF = String.fromCharCode(10);

/** Fonctions qui gardent un CORS écrit sur place, et pourquoi. */
const EXCEPTIONS: Record<string, string> = {
  'affiliation-api': 'modifiée par une autre session le 2026-11-06 ; migration vers _shared/env.ts à faire',
};

const read = (path: string) => readFileSync(path, 'utf8').split('\r\n').join(LF);

/** Le CODE seul : ces fichiers racontent leurs anciens pièges en commentaire. */
function codeOnly(texte: string): string {
  return texte
    .replace(/[/][*][^]*?[*][/]/g, ' ')
    .split(LF)
    .map((ligne) => {
      const at = ligne.indexOf('//');
      // `https://` n'est pas un commentaire : on ne coupe qu'un `//` hors URL.
      return at === -1 || /:$/.test(ligne.slice(0, at)) ? ligne : ligne.slice(0, at);
    })
    .join(LF);
}

/** Un CORS calculé sur place : l'en-tête d'origine, l'allowlist, ou la fonction. */
const CORS_SUR_PLACE = /Access-Control-Allow-Origin|ALLOWED_ORIGINS|function\s+corsHeadersFor\b/;

/** Une valeur par défaut qui pointe vers la machine locale. */
const DEFAUT_LOCAL = /(\?\?|\|\|)\s*['"`]https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)/;

const slugs = readdirSync(FUNCTIONS).filter(
  (n) => n !== '_shared' && statSync(join(FUNCTIONS, n)).isDirectory(),
);
const indexCode = (slug: string) => codeOnly(read(join(FUNCTIONS, slug, 'index.ts')));

/** Tous les `.ts` de `supabase/functions/`, `_shared/` compris. */
function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return tsFiles(p);
    return n.endsWith('.ts') ? [p] : [];
  });
}

describe('politique CORS unique (_shared/cors.ts)', () => {
  const prod = allowedOrigins('https://thecosmo.app/');

  it("n'autorise que l'origine de production, réduite à son origine", () => {
    expect([...prod]).toEqual(['https://thecosmo.app']);
    expect(corsHeaders('https://thecosmo.app', prod)['Access-Control-Allow-Origin']).toBe('https://thecosmo.app');
  });

  it("refuse localhost en production : aucune origine locale sans CORS_DEV_ORIGINS", () => {
    for (const o of ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173']) {
      expect(corsHeaders(o, prod)).not.toHaveProperty('Access-Control-Allow-Origin');
    }
  });

  it("n'accepte une origine locale que posée explicitement, et seulement locale", () => {
    const dev = allowedOrigins('https://thecosmo.app', 'http://localhost:5173, http://127.0.0.1:3000');
    expect(corsHeaders('http://localhost:5173', dev)['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    expect(corsHeaders('http://localhost:4000', dev)).not.toHaveProperty('Access-Control-Allow-Origin');
    // La variable ne peut pas ouvrir la porte à un site tiers, même posée par erreur.
    expect(() => allowedOrigins('https://thecosmo.app', 'https://evil.example')).toThrow(/origines locales/);
    expect(() => allowedOrigins('https://thecosmo.app', 'http://localhost')).toThrow(/origines locales/);
    expect(() => allowedOrigins('https://thecosmo.app', '*')).toThrow(/origines locales/);
  });

  it('ne rend jamais le joker, et porte toujours Vary: Origin', () => {
    for (const o of [null, '', '*', 'null', 'https://evil.example', 'https://thecosmo.app.evil.example']) {
      const h = corsHeaders(o, prod);
      expect(h['Access-Control-Allow-Origin']).toBeUndefined();
      expect(h.Vary).toBe('Origin');
    }
  });

  it("une variable obligatoire absente ou vide fait échouer, sans valeur par défaut", () => {
    expect(() => requireValue('APP_URL', undefined)).toThrow(/APP_URL/);
    expect(() => requireValue('APP_URL', '   ')).toThrow(/APP_URL/);
    expect(requireValue('APP_URL', ' https://thecosmo.app ')).toBe('https://thecosmo.app');
    // Une APP_URL qui n'est pas une URL ne devient pas une origine.
    expect(() => allowedOrigins('thecosmo.app')).toThrow();
  });
});

describe('les Edge Functions passent par _shared/env.ts', () => {
  it('TEMOIN : les détecteurs voient leur défaut, et le nettoyage ne mange pas le code', () => {
    // Sans ces sondes, un `codeOnly` cassé ou une expression aveugle rendrait
    // les cas suivants verts sur du vide.
    expect(slugs.length).toBeGreaterThanOrEqual(15);
    const delete_ = indexCode('delete-account');
    expect(delete_).toContain('Deno.serve');
    expect(delete_).toContain("requireEnv('APP_URL')");
    expect(codeOnly("const u = 'https://thecosmo.app' // note")).toContain('https://thecosmo.app');
    expect(codeOnly("const u = 1 // ALLOWED_ORIGINS")).not.toMatch(CORS_SUR_PLACE);

    // Les deux formes de CORS sur place que ce dépôt a portées.
    const anciennes = [
      "const ALLOWED_ORIGINS = new Set([APP_URL])",
      "if (allow) headers['Access-Control-Allow-Origin'] = allow",
      "function corsHeadersFor(req: Request): Record<string, string> {",
      "const h = { 'Access-Control-Allow-Origin': '*' }",
    ];
    for (const a of anciennes) expect(codeOnly(a), a).toMatch(CORS_SUR_PLACE);
    // Et l'import, qui n'en est pas un.
    expect("import { corsHeadersFor, requireEnv } from '../_shared/env.ts'").not.toMatch(CORS_SUR_PLACE);

    // Les valeurs par défaut locales, sous toutes leurs graphies.
    for (const d of [
      "Deno.env.get('APP_URL') ?? 'http://localhost:5173'",
      'Deno.env.get("APP_URL") || "http://127.0.0.1:3000"',
      "env('APP_URL') ?? `http://localhost:${port}`",
      "x ?? 'https://localhost'",
    ]) expect(d, d).toMatch(DEFAUT_LOCAL);
    expect("Deno.env.get('APP_URL') ?? 'https://thecosmo.app'").not.toMatch(DEFAUT_LOCAL);
    expect("requireEnv('APP_URL')").not.toMatch(DEFAUT_LOCAL);
  });

  it.each(slugs.filter((s) => !(s in EXCEPTIONS)))("%s n'écrit pas son CORS sur place", (slug) => {
    const code = indexCode(slug);
    expect(code, `${slug} calcule son CORS sur place : importer corsHeadersFor de ../_shared/env.ts`).not.toMatch(CORS_SUR_PLACE);
    if (code.includes('corsHeadersFor(')) {
      expect(code).toContain("from '../_shared/env.ts'");
    }
  });

  it.each(Object.keys(EXCEPTIONS))('l exception %s est encore nécessaire (sinon, la retirer)', (slug) => {
    expect(slugs).toContain(slug);
    expect(indexCode(slug), `${slug} n'écrit plus son CORS : retirer son exception (${EXCEPTIONS[slug]})`).toMatch(CORS_SUR_PLACE);
  });

  it('les neuf fonctions appelées du navigateur importent la politique unique', () => {
    const attendues = [
      'delete-account', 'report-bug', 'send-org-invite', 'stripe-create-checkout', 'stripe-org-checkout',
      'stripe-org-portal', 'stripe-org-refund', 'stripe-org-subscription', 'verify-org-domain',
    ];
    for (const slug of attendues) {
      const code = indexCode(slug);
      expect(code, slug).toContain("import { corsHeadersFor, requireEnv } from '../_shared/env.ts'");
      expect(code, slug).toContain("requireEnv('APP_URL')");
      expect(code, slug).toContain('corsHeadersFor(req)');
    }
  });

  it.each(tsFiles(FUNCTIONS).map((p) => p.slice(FUNCTIONS.length + 1).replace(/\\/g, '/')))(
    '%s ne porte aucune valeur par défaut localhost',
    (rel) => {
      expect(codeOnly(read(join(FUNCTIONS, rel))), `${rel} : une variable absente doit échouer, pas pointer vers localhost`).not.toMatch(DEFAUT_LOCAL);
    },
  );
});

// Garde statique de la Content-Security-Policy servie par Vercel.
//
// POURQUOI CE FICHIER EXISTE
// Le 2026-09-01, `connect-src` autorisait `https://*.supabase.co` mais PAS
// `wss://*.supabase.co`. En CSP, un schéma écrit explicitement doit
// correspondre : `https:` ne couvre pas `wss:`. Toutes les connexions
// Realtime étaient donc bloquées par le navigateur, en production, en
// silence — la console disait « The action has been blocked », l'écran ne
// disait rien.
//
// Ce que ça cassait : les TROIS canaux montés dans `App.tsx`
// (`useSharedTasksRealtime`, `useOrgInboxRealtime`, `useFriendsInboxRealtime`),
// c'est-à-dire toute la synchronisation de la collaboration. Et comme ces
// canaux ont justement REMPLACÉ huit sondages permanents, il n'y avait plus
// aucun filet derrière eux : une tâche partagée n'arrivait jamais.
//
// 🔴 La règle : tout hôte contacté en WebSocket doit être listé avec son
// schéma `wss://`, en plus de son `https://`. Un test qui compte les
// directives ne prouverait rien — celui-ci vérifie la propriété qui a
// manqué.
//
// SEC-09 (audit du 2026-11-06) : la CSP autorisait `https://js.stripe.com` en
// `script-src` et `frame-src` alors qu'AUCUN SDK Stripe n'est chargé côté
// client (checkout par redirection serveur), et le joker `*.supabase.co` alors
// qu'un seul projet sert l'application. Une origine autorisée sans usage est
// une porte ouverte pour rien : tout projet Supabase, celui d'un attaquant
// compris, devenait une destination admise pour un script injecté. Le ref du
// projet est lu dans `.github/edge-deploy.json`, sa seule déclaration du dépôt.
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

interface VercelHeader {
  key?: string;
  value?: string;
}
interface VercelHeaderRule {
  headers?: VercelHeader[];
}
interface VercelConfig {
  headers?: VercelHeaderRule[];
}

/** Le ref du projet Supabase de production. */
const PROJECT_REF = (
  JSON.parse(readFileSync(path.join(process.cwd(), '.github/edge-deploy.json'), 'utf8')) as { projectRef: string }
).projectRef;
const SUPABASE_HOST = `${PROJECT_REF}.supabase.co`;

/** Les directives d'une valeur de CSP, indexées par nom. */
function parseCsp(value: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const part of value.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) directives.set(name, sources);
  }
  return directives;
}

/** Les directives de la CSP servie, indexées par nom. */
function cspDirectives(): Map<string, string[]> {
  const raw = readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8');
  const config = JSON.parse(raw) as VercelConfig;

  const values = (config.headers ?? [])
    .flatMap((rule) => rule.headers ?? [])
    .filter((h) => (h.key ?? '').toLowerCase() === 'content-security-policy')
    .map((h) => h.value ?? '');

  expect(values.length, 'aucun header Content-Security-Policy dans vercel.json').toBe(1);
  return parseCsp(values[0]);
}

/** Un joker sur l'hébergement Supabase, quel que soit le schéma. */
const JOKER_SUPABASE = /^((https?|wss?):\/\/)?\*\.supabase\.(co|in)$/;

/** Ce que SEC-09 refuse, lu sur une CSP : vide si rien. */
function sec09Violations(d: Map<string, string[]>): string[] {
  const out: string[] = [];
  for (const [name, sources] of d) {
    for (const src of sources) {
      if (JOKER_SUPABASE.test(src)) out.push(`${name} : joker ${src}`);
      if (/(^|[/.])stripe\.com$/.test(src.replace(/^\w+:\/\//, ''))) out.push(`${name} : ${src} sans SDK ni appel Stripe côté client`);
    }
  }
  return out;
}

/** Les fichiers servis ou compilés vers le client : là où Stripe.js serait chargé. */
function clientFiles(rel: string): string[] {
  const abs = path.join(process.cwd(), rel);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isDirectory()) return readdirSync(abs).flatMap((n) => clientFiles(path.join(rel, n)));
  return /\.(tsx?|jsx?|mjs|html|json)$/.test(rel) && !/\.test\./.test(rel) ? [rel] : [];
}

/** Un chargement du SDK Stripe côté client, sous ses trois formes. */
const STRIPE_JS = /js\.stripe\.com|@stripe\/stripe-js|loadStripe\(/;

describe('CSP servie par Vercel', () => {
  it('autorise le WebSocket Realtime de Supabase (schéma wss, pas seulement https)', () => {
    const connect = cspDirectives().get('connect-src') ?? [];
    expect(connect).toContain(`https://${SUPABASE_HOST}`);
    // La ligne qui manquait. Sans elle, Realtime est bloqué en production.
    expect(connect).toContain(`wss://${SUPABASE_HOST}`);
  });

  it('garde les directives de confinement qui ne doivent jamais se relâcher', () => {
    const d = cspDirectives();
    expect(d.get('default-src')).toEqual(["'self'"]);
    expect(d.get('object-src')).toEqual(["'none'"]);
    expect(d.get('frame-ancestors')).toEqual(["'none'"]);
    expect(d.get('base-uri')).toEqual(["'self'"]);
    expect(d.get('form-action')).toEqual(["'self'"]);
  });

  it("n'autorise pas 'unsafe-eval' ni un joker total dans les scripts", () => {
    const script = cspDirectives().get('script-src') ?? [];
    expect(script).not.toContain("'unsafe-eval'");
    expect(script).not.toContain('*');
  });

  it('laisse passer le QR code TOTP, servi en data: URI', () => {
    // `AdminMfaGate` rend le QR par `<img src="data:image/svg+xml,...">`.
    // Retirer `data:` de `img-src` casserait l'enrôlement admin.
    expect(cspDirectives().get('img-src') ?? []).toContain('data:');
  });

  it('SEC-09 : le seul projet Supabase, et aucun Stripe.js sans SDK client', () => {
    const d = cspDirectives();
    expect(sec09Violations(d)).toEqual([]);
    // Avatars et fichiers du Storage : le même hôte, en https.
    expect(d.get('img-src') ?? []).toContain(`https://${SUPABASE_HOST}`);
  });

  it('COD-03 : aucun domaine Stripe dans la CSP, le checkout passe par une redirection serveur', () => {
    for (const [name, sources] of cspDirectives()) {
      expect(sources.filter((x) => x.includes('stripe')), name).toEqual([]);
    }
  });

  it("SEC-09 : Stripe.js n'est chargé nulle part côté client (sinon, la CSP doit le rouvrir)", () => {
    // La raison du retrait doit rester vraie : un `<script src=js.stripe.com>`
    // ajouté plus tard serait bloqué en production, en silence.
    const fichiers = ['index.html', 'prerender', 'src', 'public'].flatMap(clientFiles);
    expect(fichiers.length).toBeGreaterThan(100);
    const charge = fichiers.filter((p) => STRIPE_JS.test(readFileSync(path.join(process.cwd(), p), 'utf8')));
    expect(charge).toEqual([]);
  });

  it('TEMOIN : la lecture SEC-09 voit le joker et Stripe.js, et le ref est lu', () => {
    // Sans ce témoin, une expression aveugle rendrait le cas SEC-09 vert sur
    // la CSP d'avant le correctif.
    expect(PROJECT_REF).toMatch(/^[a-z0-9]{20}$/);
    const avant = "script-src 'self' https://js.stripe.com; connect-src https://*.supabase.co wss://*.supabase.co; "
      + 'frame-src https://js.stripe.com; img-src https://*.supabase.co *.supabase.co';
    expect(sec09Violations(parseCsp(avant))).toHaveLength(6);
    expect(sec09Violations(parseCsp(`connect-src https://${SUPABASE_HOST} wss://${SUPABASE_HOST}`))).toEqual([]);
    expect(STRIPE_JS.test("const s = await loadStripe('pk_live_x')")).toBe(true);
    expect(STRIPE_JS.test('<script src="https://js.stripe.com/v3"></script>')).toBe(true);
    // COD-03 : `api.stripe.com` en connect-src n'a aucun appelant client non plus.
    expect(sec09Violations(parseCsp('connect-src https://api.stripe.com'))).toHaveLength(1);
  });
});

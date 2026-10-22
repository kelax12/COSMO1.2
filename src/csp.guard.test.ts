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
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
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

/** Les directives de la CSP, indexées par nom. */
function cspDirectives(): Map<string, string[]> {
  const raw = readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8');
  const config = JSON.parse(raw) as VercelConfig;

  const values = (config.headers ?? [])
    .flatMap((rule) => rule.headers ?? [])
    .filter((h) => (h.key ?? '').toLowerCase() === 'content-security-policy')
    .map((h) => h.value ?? '');

  expect(values.length, 'aucun header Content-Security-Policy dans vercel.json').toBe(1);

  const directives = new Map<string, string[]>();
  for (const part of values[0].split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) directives.set(name, sources);
  }
  return directives;
}

describe('CSP servie par Vercel', () => {
  it('autorise le WebSocket Realtime de Supabase (schéma wss, pas seulement https)', () => {
    const connect = cspDirectives().get('connect-src') ?? [];
    expect(connect).toContain('https://*.supabase.co');
    // La ligne qui manquait. Sans elle, Realtime est bloqué en production.
    expect(connect).toContain('wss://*.supabase.co');
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
});

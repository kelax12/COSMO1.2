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
    const cron = src.includes("req.headers.get('x-cron-secret')");
    const user = src.includes('auth.getUser()');
    if (cron && user) {
      // Double mode (C-121, 2026-10-22) : `delete-account` sert une personne
      // connectée ET le cron des comptes inactifs. Le chemin utilisateur garde
      // la passerelle (`verify_jwt = true`) ; son appelant cron n'est donc
      // jamais la CI nue, c'est `inactive-accounts`, qui DOIT porter un JWT.
      expect(declared.get(slug), `${slug} sert aussi une personne connectée`).toBe(true);
      const callers = slugs.filter((s) => s !== slug && source(s).includes(`/functions/v1/${slug}`));
      expect(callers.length, `${slug} en mode cron sans appelant connu`).toBeGreaterThan(0);
      for (const c of callers) {
        expect(source(c), `${c} appelle ${slug} sans JWT : la passerelle le refuserait`).toMatch(
          /Authorization:\s*`Bearer \$\{SERVICE_ROLE_KEY\}`/,
        );
      }
    } else if (cron) {
      expect(declared.get(slug), `${slug} est appelée par la CI sans JWT`).toBe(false);
    } else if (src.includes('auth.getUser()')) {
      expect(declared.get(slug), `${slug} identifie l appelant par son JWT`).toBe(true);
    }
  });
});

// ─── CI-05 : toute RPC appelee par une Edge Function est dans l'inventaire des migrations ───
// Le 2026-11-09, cinq fonctions planifiees appelaient `cron_lease_acquire` avant que la prod ait la
// migration 245 : 404 quotidiens, sonde `Erreurs de prod` rouge cinq jours. A la revue, un nom de RPC
// absent de `supabase/rpc-inventory.md` (regenere par `check:contrat` depuis les migrations) rougit ici ;
// au deploiement, `edge-deploy.yml` refuse le lot tant qu'une migration du depot manque en prod.
// Ce test prouve que le depot definit la RPC, pas que la prod l'a.
/** Les noms passés à `rpc(` : `rpc('nom'`, `rpc(\n  'nom'`, `rpc("nom"`. */
function nomsRpc(source: string): string[] {
  const noms = new Set<string>();
  for (const m of source.matchAll(/\brpc\(\s*['"`]([a-z_][a-z0-9_]*)['"`]/g)) noms.add(m[1]);
  return [...noms];
}

/** Les fonctions de l'inventaire : lignes `| \`nom(arguments)\` | ...`. */
function nomsInventaire(md: string): Set<string> {
  const noms = new Set<string>();
  for (const m of md.matchAll(/^\| `([a-z_][a-z0-9_]*)\(/gm)) noms.add(m[1]);
  return noms;
}

function sourcesTs(dossier: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dossier)) {
    const p = join(dossier, e);
    if (statSync(p).isDirectory()) out.push(...sourcesTs(p));
    else if (e.endsWith('.ts') && !e.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

describe('Edge Functions · RPC appelées présentes dans l inventaire des migrations (CI-05)', () => {
  const inventaire = nomsInventaire(readFileSync(join(ROOT, 'supabase', 'rpc-inventory.md'), 'utf8'));

  it('TEMOIN : l extracteur voit un appel sur une ligne, sur deux lignes et avec guillemets doubles', () => {
    expect(nomsRpc("await admin.rpc('a_une_ligne', { x: 1 })")).toEqual(['a_une_ligne']);
    expect(nomsRpc("await admin.rpc(\n  'sur_deux_lignes',\n  {})")).toEqual(['sur_deux_lignes']);
    expect(nomsRpc('rpc("guillemets_doubles", {})')).toEqual(['guillemets_doubles']);
    expect(nomsRpc("const x = tables.rpc_name('ignore')")).toEqual([]);
  });

  it('TEMOIN : l inventaire est lu (il connaît le bail et au moins une RPC d une autre fonction)', () => {
    expect(inventaire.size).toBeGreaterThan(100);
    expect(inventaire.has('cron_lease_acquire')).toBe(true);
    expect(inventaire.has('consume_rate_limit')).toBe(true);
    expect(inventaire.has('une_rpc_qui_n_existe_pas')).toBe(false);
  });

  it('chaque RPC appelée sous supabase/functions/ est définie par une migration du dépôt', () => {
    const fichiers = sourcesTs(FUNCTIONS);
    expect(fichiers.length).toBeGreaterThan(10);
    const appels = new Map<string, string[]>();
    for (const f of fichiers) {
      for (const nom of nomsRpc(readFileSync(f, 'utf8'))) {
        appels.set(nom, [...(appels.get(nom) ?? []), f.slice(ROOT.length + 1).split('\\').join('/')]);
      }
    }
    // Les appels attendus existent : un extracteur qui ne verrait rien rendrait ce test vert à vide.
    expect([...appels.keys()]).toEqual(expect.arrayContaining(['cron_lease_acquire', 'consume_rate_limit']));
    const absentes = [...appels.entries()].filter(([nom]) => !inventaire.has(nom));
    expect(
      absentes.map(([nom, par]) => `${nom} (appelée par ${par.join(', ')})`),
      'RPC appelée par une Edge Function mais absente de supabase/rpc-inventory.md : migration manquante ou `npm run contrat:generer` à rejouer',
    ).toEqual([]);
  });
});

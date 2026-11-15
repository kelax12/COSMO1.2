// ═══════════════════════════════════════════════════════════════════
// Garde · toute RPC appelée par une Edge Function existe dans les migrations (CI-05)
// ═══════════════════════════════════════════════════════════════════
//
// Le 2026-11-09, les cinq fonctions planifiées ont été déployées avec un appel
// à `cron_lease_acquire`, créée par une migration que la production n'avait pas
// encore : 404 quotidiens, sonde `Erreurs de prod` rouge pendant cinq jours.
//
// Deux portes, deux moments :
//   · ICI, à la revue : un nom de RPC appelé par `supabase/functions/**` doit
//     figurer dans `supabase/rpc-inventory.md`, que `check:contrat` régénère
//     depuis les migrations rejouées sur une base vierge. Une faute de frappe
//     ou une migration oubliée du dépôt rougit avant le déploiement ;
//   · au DÉPLOIEMENT, `edge-deploy.yml` (étape « Porte · toutes les
//     migrations du depot sont en production ») refuse le lot tant qu'une
//     migration du dépôt manque en prod : la migration part avant le code.
//
// ⚠️ Ce test ne prouve PAS que la prod a la fonction : seule la porte du
// déploiement lit la prod. Il prouve que le dépôt la définit.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = process.cwd();
const FONCTIONS = join(RACINE, 'supabase', 'functions');

/** Les noms passés à `rpc(` : `rpc('nom'`, `rpc(\n  'nom'`, `rpc("nom"`. */
export function nomsRpc(source: string): string[] {
  const noms = new Set<string>();
  for (const m of source.matchAll(/\brpc\(\s*['"`]([a-z_][a-z0-9_]*)['"`]/g)) noms.add(m[1]);
  return [...noms];
}

/** Les fonctions de l'inventaire : lignes `| \`nom(arguments)\` | ...`. */
export function nomsInventaire(md: string): Set<string> {
  const noms = new Set<string>();
  for (const m of md.matchAll(/^\| `([a-z_][a-z0-9_]*)\(/gm)) noms.add(m[1]);
  return noms;
}

function sources(dossier: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dossier)) {
    const p = join(dossier, e);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (e.endsWith('.ts') && !e.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

describe('Edge Functions · RPC appelées présentes dans l inventaire des migrations (CI-05)', () => {
  const inventaire = nomsInventaire(readFileSync(join(RACINE, 'supabase', 'rpc-inventory.md'), 'utf8'));

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
    const fichiers = sources(FONCTIONS);
    expect(fichiers.length).toBeGreaterThan(10);
    const appels = new Map<string, string[]>();
    for (const f of fichiers) {
      for (const nom of nomsRpc(readFileSync(f, 'utf8'))) {
        appels.set(nom, [...(appels.get(nom) ?? []), f.slice(RACINE.length + 1).split('\\').join('/')]);
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

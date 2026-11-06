// ═══════════════════════════════════════════════════════════════════
// contrat-donnees.guard.test.mjs · LE TEMOIN DU CONTRAT DE DONNEES (MAI-01, API-01, ARC-07)
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// `contrat-donnees.mjs` decide si trois fichiers commites (schema, inventaire
// des fonctions, types) decrivent encore la base que les migrations
// fabriquent. Une garde de ce genre se trompe dans le sens rassurant de trois
// facons : elle compare deux fois la meme chose, elle ne voit pas un ecart
// qui tient en une ligne, ou elle laisse varier ce qui ne devrait pas (une
// version de pg_dump) et rougit sans commit. Chaque cas ci-dessous soumet au
// code REEL une entree qui doit changer le verdict.
//
// La base est remplacee par un faux client : ces cas ne prouvent PAS que les
// requetes SQL sont justes. Cela, seul le job `contrat-donnees` de `CI noyau`
// le mesure, sur une vraie base.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CHEMINS, normaliserDump, assemblerSchema, rendreComplements, rendreInventaire, chercherAppelants,
  comparer, extraireEcart, verifier, produire, decouperCommande, assemblerTypes, lireBase,
  listerSources, commandesParDefaut, projetId, SQL_FONCTIONS,
} from './contrat-donnees.mjs';

const fonction = (o) => ({
  nom: 'f', args: '', genre: 'f', est_trigger: false, definer: false, search_path: null,
  anon: false, authenticated: false, service_role: false, public_role: false, ...o,
});

describe('normaliserDump : ce qui varie sans que le schema change', () => {
  const dump = (version, jeton) => [
    '--', '-- PostgreSQL database dump', '--', '',
    `\\restrict ${jeton}`, '',
    `-- Dumped from database version ${version}`,
    `-- Dumped by pg_dump version ${version}`, '',
    'CREATE TABLE public.t (id integer);   ', '', '', '', '',
    `\\unrestrict ${jeton}`, '',
  ].join('\r\n');

  it('deux dumps du meme schema, versions et jetons differents, donnent le meme texte', () => {
    expect(normaliserDump(dump('17.4', 'AAA'))).toBe(normaliserDump(dump('17.6', 'ZZZ')));
  });

  it('retire version, jeton, espaces de fin, fins de ligne Windows et lignes vides en rafale', () => {
    const n = normaliserDump(dump('17.4', 'AAA'));
    expect(n).not.toMatch(/Dumped|restrict|\r|[ \t]\n/);
    expect(n).not.toMatch(/\n{4}/);
    expect(n.endsWith('\n') && !n.endsWith('\n\n')).toBe(true);
    expect(n).toContain('CREATE TABLE public.t (id integer);');
  });

  it('TEMOIN : une vraie difference de schema reste visible', () => {
    const a = normaliserDump(dump('17.4', 'AAA'));
    const b = normaliserDump(dump('17.4', 'AAA').replace('id integer', 'ident integer'));
    expect(a).not.toBe(b);
  });
});

describe('comparer / verifier : un ecart d\'une ligne fait echouer', () => {
  it('identiques : aucun ecart', () => {
    expect(comparer('a\nb\n', 'a\nb\n').identique).toBe(true);
    expect(comparer('a\r\nb\r\n', 'a\nb\n').identique).toBe(true);
  });

  it('une colonne de plus, au milieu : ligne et contenu de l\'ecart', () => {
    const c = comparer('a\nb\nc\n', 'a\nb\nNEW\nc\n');
    expect(c.identique).toBe(false);
    expect(c.ligne).toBe(3);
    expect(c.genere).toEqual(['NEW']);
    expect(c.commite).toEqual([]);
    expect(extraireEcart(c)).toContain('+ NEW');
  });

  it('une ligne en moins en fin de fichier', () => {
    const c = comparer('a\nb\nc\n', 'a\nb\n');
    expect(c.identique).toBe(false);
    expect(c.commite).toEqual(['c']);
  });

  it('un extrait trop long est borne et dit combien manquent', () => {
    const c = comparer('x\n', `x\n${Array.from({ length: 80 }, (_, i) => `l${i}`).join('\n')}\n`);
    const e = extraireEcart(c, 10);
    expect(e).toMatch(/\.\.\. 70 ligne\(s\) de plus/);
  });

  it('TEMOIN : migration ajoutee sans regeneration (fichier commite en retard) => ecart', () => {
    const produits = new Map([[CHEMINS.schema, 'CREATE TABLE a;\nCREATE TABLE nouvelle;\n']]);
    const ecarts = verifier(produits, () => 'CREATE TABLE a;\n');
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0].chemin).toBe(CHEMINS.schema);
    expect(ecarts[0].extrait).toContain('+ CREATE TABLE nouvelle;');
  });

  it('TEMOIN : un fichier jamais commite est un ecart, pas un vert', () => {
    const ecarts = verifier(new Map([[CHEMINS.types, 'x\n']]), () => null);
    expect(ecarts).toEqual([{ chemin: CHEMINS.types, absent: true, extrait: 'fichier absent du depot' }]);
  });

  it('tout identique : aucun ecart', () => {
    const produits = new Map([[CHEMINS.schema, 's\n'], [CHEMINS.inventaire, 'i\n']]);
    expect(verifier(produits, (c) => produits.get(c))).toEqual([]);
  });
});

describe('inventaire des fonctions', () => {
  const fonctions = [
    fonction({ nom: 'zeta', args: 'p_id uuid', definer: true, search_path: '""', authenticated: true, service_role: true }),
    fonction({ nom: 'alpha', args: '', definer: true, anon: true, authenticated: true, service_role: true, public_role: true }),
    fonction({ nom: 'alpha', args: 'x integer', definer: false, authenticated: true, service_role: true }),
    fonction({ nom: 'trg', args: '', est_trigger: true }),
  ];
  const appelants = new Map([
    ['alpha', { directs: ['src/a.ts'], chaines: ['src/b.ts'] }],
  ]);
  const md = rendreInventaire(fonctions, appelants);

  it('trie par nom puis arguments, quel que soit l\'ordre d\'entree', () => {
    expect(rendreInventaire([...fonctions].reverse(), appelants)).toBe(md);
    const tout = md.slice(md.indexOf('## Toutes les fonctions'));
    expect(tout.indexOf('`alpha()`')).toBeLessThan(tout.indexOf('`alpha(x integer)`'));
    expect(tout.indexOf('`alpha(x integer)`')).toBeLessThan(tout.indexOf('`zeta(p_id uuid)`'));
  });

  it('dit DEFINER / INVOKER, le search_path, les trois roles, les appelants (directs et ~chaines)', () => {
    expect(md).toMatch(/\| `alpha\(\)` \| DEFINER \| non fige \| oui \| oui \| oui \| `src\/a\.ts`<br>~`src\/b\.ts` \|/);
    expect(md).toMatch(/\| `zeta\(p_id uuid\)` \| DEFINER \| `""` \| - \| oui \| oui \| - \|/);
    expect(md).toContain('`trg()` (trigger)');
  });

  it('la synthese compte la surface ouverte', () => {
    expect(md).toContain('| Fonctions | 4 |');
    expect(md).toContain('| Executables par `anon` | 1 |');
    expect(md).toContain('| SECURITY DEFINER | 2 |');
    expect(md).toContain('| SECURITY DEFINER sans `search_path` fige | 1 |');
    expect(md).toContain('| SECURITY DEFINER executables par `anon` | 1 |');
    expect(md).toContain('| Droit accorde a `PUBLIC` | 1 |');
  });

  it('TEMOIN : un droit `anon` accorde a une fonction change l\'inventaire', () => {
    const avant = rendreInventaire([fonction({ nom: 'f', authenticated: true })], new Map());
    const apres = rendreInventaire([fonction({ nom: 'f', authenticated: true, anon: true })], new Map());
    expect(apres).not.toBe(avant);
    expect(avant).toContain('Aucune.');
  });

  it('echappe les barres verticales d\'un argument', () => {
    expect(rendreInventaire([fonction({ nom: 'f', args: 'a text | b' })], new Map())).toContain('a text \\| b');
  });

  it('ne contient aucun tiret cadratin', () => {
    expect(md).not.toContain('—');
  });
});

describe('appelants du front, trouves par texte', () => {
  const sources = {
    'src/a.ts': "supabase.rpc('get_x', { a: 1 })",
    'src/b.ts': 'await supabase\n  .rpc<Foo[]>(\n    "get_y",\n    {})',
    'src/c.ts': "const NOMS = ['get_x', 'get_z']",
    'src/d.ts': "// pas d'appel ici : rpc('inconnue')\nconst s = `get_y`",
    'supabase/functions/f/index.ts': 'admin.rpc("get_z", {})',
  };
  const r = chercherAppelants(['get_x', 'get_y', 'get_z', 'get_w'], (f) => sources[f], Object.keys(sources));

  it('rpc(\'nom\'), rpc<T>(\\n"nom" et les Edge Functions sont des appelants directs', () => {
    expect(r.get('get_x').directs).toEqual(['src/a.ts']);
    expect(r.get('get_y').directs).toEqual(['src/b.ts']);
    expect(r.get('get_z').directs).toEqual(['supabase/functions/f/index.ts']);
  });

  it('une simple chaine est signalee a part, un nom inconnu est ignore, rien n\'est un appelant par erreur', () => {
    expect(r.get('get_x').chaines).toEqual(['src/c.ts']);
    expect(r.get('get_y').chaines).toEqual(['src/d.ts']);
    expect(r.get('get_z').chaines).toEqual(['src/c.ts']);
    expect(r.get('get_w')).toEqual({ directs: [], chaines: [] });
  });

  it('listerSources voit le vrai depot et exclut tests et types generes', () => {
    const f = listerSources(process.cwd());
    expect(f.length).toBeGreaterThan(300);
    expect(f.some((x) => x.startsWith('supabase/functions/'))).toBe(true);
    expect(f.some((x) => /\.test\.[jt]sx?$/.test(x))).toBe(false);
    expect(f.some((x) => x.includes('/generated/'))).toBe(false);
  });
});

describe('schema.sql et complements hors `public`', () => {
  const vide = { triggers: [], policies: [], buckets: [], cron: [] };

  it('assemblage : en-tete, dump normalise, complements', () => {
    const s = assemblerSchema('-- Dumped from x\nCREATE TABLE t;\n', vide);
    expect(s.startsWith('-- GENERE par scripts/contrat-donnees.mjs')).toBe(true);
    expect(s).toContain('CREATE TABLE t;');
    expect(s).not.toContain('Dumped from');
    expect(s).toContain('Objets poses hors du schema `public`');
  });

  it('rend triggers, policies, buckets et taches cron sans identifiant interne', () => {
    const t = rendreComplements({
      triggers: [{ def: 'CREATE TRIGGER trg AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.f()' }],
      policies: [{
        schemaname: 'storage', tablename: 'objects', policyname: 'avatars_read', permissive: 'PERMISSIVE',
        roles: ['authenticated'], cmd: 'SELECT', qual: "(bucket_id = 'avatars'::text)", with_check: null,
      }],
      buckets: [{ id: 'avatars', public: true, file_size_limit: null, allowed_mime_types: ['image/png'] }],
      cron: [{ jobname: 'purge', schedule: '0 3 * * *', command: "select 'a'" }],
    });
    expect(t).toContain('CREATE TRIGGER trg AFTER INSERT ON auth.users');
    expect(t).toContain('CREATE POLICY "avatars_read" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO authenticated USING ((bucket_id');
    expect(t).toContain('-- avatars | public=true | limit=null | mime=image/png');
    expect(t).toContain("SELECT cron.schedule('purge', '0 3 * * *', 'select ''a''');");
  });

  it('les sections vides le disent au lieu de disparaitre', () => {
    expect(rendreComplements(vide).match(/-- \(aucun/g)).toHaveLength(4);
  });
});

describe('types generes', () => {
  it('en-tete @generated, fins de ligne normalisees, un seul saut final', () => {
    const t = assemblerTypes('export type Json = string\r\n\r\n\r\n');
    expect(t.startsWith('// @generated')).toBe(true);
    expect(t.endsWith('export type Json = string\n')).toBe(true);
    expect(t).not.toContain('\r');
  });
});

describe('orchestration avec une base et des commandes simulees', () => {
  const requetes = [];
  const client = {
    async query(sql, params) {
      requetes.push(sql);
      if (sql.includes('to_regclass')) return { rows: [{ t: params[0] === 'cron.job' ? 'cron.job' : null }] };
      if (sql === SQL_FONCTIONS) return { rows: [fonction({ nom: 'get_a', anon: true })] };
      if (sql.includes('cron.job')) return { rows: [{ jobname: 'j', schedule: '* * * * *', command: 'select 1' }] };
      return { rows: [] };
    },
  };

  it('lireBase : une table optionnelle absente (storage) donne une liste vide', async () => {
    const { fonctions, complements } = await lireBase(client);
    expect(fonctions).toHaveLength(1);
    expect(complements.buckets).toEqual([]);
    expect(complements.cron).toHaveLength(1);
  });

  it('produire : trois fichiers, aux chemins attendus, deterministes', async () => {
    const entrees = {
      racine: '.',
      client,
      commandes: { pgDump: 'dump', genTypes: 'types' },
      lancer: (c) => (c === 'dump' ? '-- Dumped by x\nCREATE TABLE t;\n' : 'export type Json = string\n'),
      fichiers: ['src/x.ts'],
      lireFichier: () => "supabase.rpc('get_a')",
    };
    const a = await produire(entrees);
    const b = await produire(entrees);
    expect([...a.keys()]).toEqual([CHEMINS.schema, CHEMINS.inventaire, CHEMINS.types]);
    expect(a).toEqual(b);
    expect(a.get(CHEMINS.inventaire)).toContain('`src/x.ts`');
    expect(a.get(CHEMINS.types)).toContain('@generated');
  });

  it('une commande qui echoue fait echouer la generation, jamais un fichier vide', async () => {
    await expect(produire({
      racine: '.', client, commandes: { pgDump: 'd', genTypes: 't' }, fichiers: [], lireFichier: () => '',
      lancer: () => { throw new Error('docker absent'); },
    })).rejects.toThrow('docker absent');
  });

  it('decouperCommande : sans shell, guillemets respectes, commande vide refusee', () => {
    expect(decouperCommande('docker exec "a b" c')).toEqual(['docker', 'exec', 'a b', 'c']);
    expect(() => decouperCommande('  ')).toThrow('commande vide');
  });

  it('commandes par defaut : le conteneur porte le project_id de config.toml', () => {
    expect(projetId(process.cwd())).toBe('cosmo');
    const c = commandesParDefaut(process.cwd(), {});
    expect(c.pgDump).toContain('docker exec supabase_db_cosmo pg_dump');
    expect(c.pgDump).toContain('--schema-only --schema=public --no-owner');
    expect(c.genTypes).toContain('gen types typescript --local');
    expect(commandesParDefaut(process.cwd(), { COSMO_PG_DUMP: 'x', COSMO_GEN_TYPES: 'y' })).toEqual({ pgDump: 'x', genTypes: 'y' });
  });
});

describe('le fichier commite existe et porte l\'en-tete du generateur', () => {
  it.each(Object.values(CHEMINS))('%s', (chemin) => {
    const texte = readFileSync(join(process.cwd(), chemin), 'utf8');
    expect(texte).toMatch(/GENERE par scripts\/contrat-donnees\.mjs|@generated par scripts\/contrat-donnees\.mjs/);
    // Le dump garde les commentaires des migrations (tirets compris) : seul l'inventaire est ecrit par le generateur.
    if (chemin === CHEMINS.inventaire) expect(texte).not.toContain('—');
  });
});

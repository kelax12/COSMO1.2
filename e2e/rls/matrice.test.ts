// ═══════════════════════════════════════════════════════════════════
// RLS · matrice générée depuis le catalogue (TST-04, risque SEC-10).
//
// POURQUOI CE FICHIER EXISTE (audit indépendant du 2026-11-06)
//
// Les autres fichiers de `e2e/rls/` attaquent une vingtaine de tables, choisies
// à la main. `habits`, `events`, `okrs`, `key_results`, `kr_completions`,
// `categories`, `lists`, `friends`… n'étaient jamais attaquées par un second
// compte. Et `000_default_privileges.sql` accorde `ALL` à `anon` sur toute
// table FUTURE : une table créée sans `ENABLE ROW LEVEL SECURITY` serait
// ouverte en lecture et en écriture à Internet, sans qu'aucun écran change.
//
// CE QU'IL FAIT
//   1. Lit dans `pg_class` et les privilèges toutes les relations de `public`
//      que PostgREST expose à `anon` ou `authenticated`. Rien n'est recopié.
//   2. Vérifie que chaque table exposée a la RLS activée, que chaque vue
//      exposée est `security_invoker`, et que chaque table a sa déclaration
//      dans `matrice.declarations.ts` (une table nouvelle sans entrée échoue).
//   3. Sème UNE ligne par table au nom d'un propriétaire (`matrice.graine.ts`).
//   4. Pour chaque table, trois acteurs : le PROPRIÉTAIRE lit sa ligne (témoin
//      positif : le filtre désigne bien la ligne), un TIERS authentifié sans
//      aucun lien et un ANONYME tentent `select`, `insert`, `update`, `delete`.
//
// LA MESURE. Chaque attaque passe par PostgREST avec le client de l'acteur
// (JWT + clé anon, donc la RLS réelle, `helpers.ts`). Le verdict, lui, est relu
// dans la base sous `postgres`, jamais déduit de l'absence d'erreur :
//   · update : `xmin` de la ligne. Même réécrite à l'identique, une ligne mise
//     à jour change de `xmin` ; la valeur envoyée est l'actuelle, pour qu'aucun
//     CHECK ne refuse à la place de la RLS ;
//   · delete : la ligne existe-t-elle encore ;
//   · insert : copie de la ligne du propriétaire, identité du propriétaire
//     FORGÉE dans chaque colonne d'utilisateur. Une erreur `23xxx` (unicité,
//     clé étrangère, CHECK) prouve que la RLS a ACCEPTÉ : PostgreSQL évalue le
//     WITH CHECK avant les contraintes. Seul `42501` ou un trigger qui lève
//     (`P0xxx`) vaut refus ;
//   · une erreur `PGRST…` ou de type de donnée dit que le HARNAIS n'a pas su
//     poser la question : la cellule est « indéterminée », et échoue.
// ═══════════════════════════════════════════════════════════════════
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { anonClient, createTestUser, deleteTestUsers, TestUser } from './helpers';
import { connecter, decrireTable, OPS, relationsExposees, type Op, type Role, type Table } from './catalogue';
import { colonnesUtilisateur, Semeur, texte, type Ligne } from './matrice.graine';
import { DECLARATIONS, type Declaration } from './matrice.declarations';

type Acteur = 'proprietaire' | 'tiers' | 'anon';
type Verdict = 'refuse' | 'accepte' | 'indetermine';

interface Cellule {
  acteur: Acteur;
  op: Op;
  verdict: Verdict;
  detail: string;
}

const db = await connecter();
const exposees = await relationsExposees(db);
const tables = new Map<string, Table>();
for (const rel of exposees.filter((r) => r.kind === 'r' || r.kind === 'p')) {
  tables.set(rel.nom, await decrireTable(db, rel));
}
const nomsTables = [...tables.keys()].sort();

function declaration(nom: string): Declaration | undefined {
  return Object.prototype.hasOwnProperty.call(DECLARATIONS, nom) ? DECLARATIONS[nom] : undefined;
}

interface ErreurPg {
  code?: string;
  message?: string;
}

/** Un refus de la base, ou une question que le harnais n'a pas su poser. */
function lireErreur(err: ErreurPg, op: Op): { verdict: Verdict; detail: string } {
  const code = err.code ?? '';
  const detail = `${code} ${err.message ?? ''}`.trim();
  if (code === '42501') return { verdict: 'refuse', detail };
  if (code.startsWith('P0')) return { verdict: 'refuse', detail: `trigger : ${detail}` };
  if (op === 'insert' && code.startsWith('23')) {
    return { verdict: 'accepte', detail: `RLS passée, bloqué ensuite par contrainte : ${detail}` };
  }
  return { verdict: 'indetermine', detail };
}

function clauseCle(t: Table, depart = 1): string {
  return t.cle.map((c, i) => `(to_jsonb(t.*) ->> '${c}') = $${i + depart}`).join(' AND ');
}

describe('RLS · matrice du catalogue : invariants', () => {
  it('le catalogue expose bien des tables (sinon la matrice ne prouverait rien)', () => {
    expect(nomsTables.length).toBeGreaterThan(50);
  });

  it('toute table exposée de public a la RLS activée', () => {
    const sansRls = nomsTables.filter((n) => !tables.get(n)!.rls);
    expect(sansRls, 'tables exposées à anon/authenticated SANS row level security').toEqual([]);
  });

  it('toute vue exposée est security_invoker, et aucune vue matérialisée ni table étrangère n’est exposée', () => {
    const fautives = exposees
      .filter((r) => (r.kind === 'v' && !r.securityInvoker) || r.kind === 'm' || r.kind === 'f')
      .map((r) => `${r.nom} (relkind ${r.kind})`);
    expect(fautives, 'relations exposées qui contournent la RLS des tables lues').toEqual([]);
  });

  it('chaque table exposée a sa déclaration, et chaque déclaration sa table', async () => {
    const sansEntree = nomsTables.filter((n) => !declaration(n));
    expect(sansEntree, 'tables nouvelles à classer dans e2e/rls/matrice.declarations.ts').toEqual([]);
    // Une déclaration peut viser une table VERROUILLÉE (`REVOKE ALL … FROM anon,
    // authenticated`, écrite par `service_role` ou une fonction DEFINER) : elle
    // n'est pas exposée, donc absente du catalogue, et c'est voulu. Si elle
    // l'était un jour, elle entrerait dans la matrice avec sa déclaration. Une
    // déclaration est morte seulement quand la table n'existe plus du tout.
    const { rows } = await db.query<{ nom: string }>(
      `SELECT c.relname::text AS nom FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')`,
    );
    const existantes = new Set(rows.map((r) => r.nom));
    const mortes = Object.keys(DECLARATIONS).filter((n) => !existantes.has(n)).sort();
    expect(mortes, 'déclarations dont la table n’existe plus dans public').toEqual([]);
  });

  it('chaque déclaration qui élargit l’accès est motivée', () => {
    const fautes: string[] = [];
    for (const [nom, d] of Object.entries(DECLARATIONS)) {
      if (d.visibilite !== 'proprietaire' && !d.motif?.trim()) fautes.push(`${nom} : motif manquant`);
      if (d.visibilite === 'partagee' && !d.perimetre?.trim()) fautes.push(`${nom} : périmètre manquant`);
      for (const [qui, ops] of [['tiers', d.tiers], ['anon', d.anon]] as const) {
        for (const [op, raison] of Object.entries(ops ?? {})) {
          if (!raison?.trim()) fautes.push(`${nom} : ${qui}.${op} sans raison`);
        }
      }
    }
    expect(fautes).toEqual([]);
  });
});

describe('RLS · matrice du catalogue : propriétaire, tiers, anonyme', () => {
  let proprio: TestUser;
  let tiers: TestUser;
  let figurant: TestUser;
  let semeur: Semeur;

  beforeAll(async () => {
    proprio = await createTestUser();
    tiers = await createTestUser();
    figurant = await createTestUser();
    semeur = new Semeur(db, tables, proprio.id, figurant.id, (n) => declaration(n)?.graine);
    await semeur.semerTout();

    // Relevé des policies de la base fraîche, pour lire un écart sans rejouer.
    const lignes = nomsTables.map((n) => {
      const t = tables.get(n)!;
      const pols = t.policies.map(
        (p) => `  ${p.nom} [${p.cmd}${p.permissive ? '' : ' RESTRICTIVE'} → ${p.roles.join(',')}] ` +
          `using=${p.using ?? '-'} check=${p.check ?? '-'}`,
      );
      return [`RLS-POLICIES ${n} (rls=${t.rls}, clé=${t.cle.join(',') || '∅'})`, ...pols].join('\n');
    });
    console.log(lignes.join('\n'));
  }, 180_000);

  afterAll(async () => {
    // Graines créées (pas réutilisées), dans l'ordre inverse de création.
    const creees = [...(semeur?.graines.values() ?? [])].filter((g) => !g.reutilisee).reverse();
    for (const g of creees) {
      const t = tables.get(g.table)!;
      if (!t.cle.length) continue;
      try {
        await db.query(`DELETE FROM public."${t.nom}" t WHERE ${clauseCle(t)}`, t.cle.map((c) => texte(g.ligne[c])));
      } catch {
        // journal inaltérable, ligne déjà emportée par cascade : sans importance sur une base jetable
      }
    }
    await deleteTestUsers(proprio, tiers, figurant);
    await db.end();
  }, 120_000);

  async function etat(t: Table, ligne: Ligne): Promise<string | null> {
    const { rows } = await db.query<{ xmin: string }>(
      `SELECT t.xmin::text AS xmin FROM public."${t.nom}" t WHERE ${clauseCle(t)}`,
      t.cle.map((c) => texte(ligne[c])),
    );
    return rows[0]?.xmin ?? null;
  }

  /** Lignes attribuées au propriétaire : colonne d'utilisateur, ou parent semé. */
  async function compterAttribuees(t: Table, ligne: Ligne): Promise<number> {
    const cols = new Set<string>(colonnesUtilisateur(t));
    for (const fk of t.fks) if (fk.schemaRef === 'public') fk.colonnes.forEach((c) => cols.add(c));
    const liees = [...cols].filter((c) => ligne[c] !== null && ligne[c] !== undefined);
    const where = liees.length
      ? liees.map((c, i) => `(to_jsonb(t.*) ->> '${c}') = $${i + 1}`).join(' OR ')
      : 'true';
    const { rows } = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM public."${t.nom}" t WHERE ${where}`,
      liees.map((c) => texte(ligne[c])),
    );
    return Number(rows[0].n);
  }

  async function lire(client: SupabaseClient, t: Table, filtre: Record<string, string>, acteur: Acteur): Promise<Cellule> {
    const { data, error } = await client.from(t.nom).select(t.cle.join(',')).match(filtre);
    if (error) return { acteur, op: 'select', ...lireErreur(error, 'select') };
    const n = (data ?? []).length;
    return { acteur, op: 'select', verdict: n > 0 ? 'accepte' : 'refuse', detail: `${n} ligne(s)` };
  }

  async function modifier(
    client: SupabaseClient, role: Role, t: Table, ligne: Ligne, filtre: Record<string, string>, acteur: Acteur,
  ): Promise<Cellule> {
    const candidates = t.colonnes.filter((c) => c.generee !== 's' && c.identite !== 'a' && c.peut[role].update);
    const col = candidates.find((c) => !t.cle.includes(c.nom)) ?? candidates[0];
    if (!col) return { acteur, op: 'update', verdict: 'refuse', detail: 'aucun privilège UPDATE de colonne' };
    const avant = await etat(t, ligne);
    if (avant === null) return { acteur, op: 'update', verdict: 'indetermine', detail: 'ligne graine absente' };
    const { error } = await client.from(t.nom).update({ [col.nom]: ligne[col.nom] }).match(filtre);
    const apres = await etat(t, ligne);
    if (apres !== avant) {
      return { acteur, op: 'update', verdict: 'accepte', detail: `${col.nom} réécrite (xmin ${avant} → ${apres})` };
    }
    // La ligne n'a pas bougé : refus, sauf si PostgREST n'a pas su poser la question.
    if (error?.code?.startsWith('PGRST')) return { acteur, op: 'update', ...lireErreur(error, 'update') };
    return {
      acteur,
      op: 'update',
      verdict: 'refuse',
      detail: error ? `${error.code} ${error.message}` : `0 ligne (${col.nom})`,
    };
  }

  async function supprimer(client: SupabaseClient, t: Table, ligne: Ligne, filtre: Record<string, string>, acteur: Acteur): Promise<Cellule> {
    if ((await etat(t, ligne)) === null) return { acteur, op: 'delete', verdict: 'indetermine', detail: 'ligne graine absente' };
    const { error } = await client.from(t.nom).delete().match(filtre);
    if ((await etat(t, ligne)) === null) return { acteur, op: 'delete', verdict: 'accepte', detail: 'ligne supprimée' };
    if (error && error.code?.startsWith('PGRST')) return { acteur, op: 'delete', ...lireErreur(error, 'delete') };
    return { acteur, op: 'delete', verdict: 'refuse', detail: error ? `${error.code} ${error.message}` : '0 ligne' };
  }

  async function inserer(client: SupabaseClient, role: Role, t: Table, ligne: Ligne, acteur: Acteur): Promise<Cellule> {
    const charge: Record<string, unknown> = {};
    const cleSimple = t.cle.length === 1 ? t.colonnes.find((c) => c.nom === t.cle[0]) : undefined;
    for (const c of t.colonnes) {
      if (c.generee === 's' || c.identite === 'a' || !c.peut[role].insert) continue;
      if (cleSimple && c.nom === cleSimple.nom) {
        if (c.aDefaut || c.identite) continue;
        if (c.base === 'uuid') { charge[c.nom] = randomUUID(); continue; }
        if (c.categorie === 'S') { charge[c.nom] = `rls-copie-${randomUUID().slice(0, 8)}`; continue; }
      }
      charge[c.nom] = ligne[c.nom];
    }
    const avant = await compterAttribuees(t, ligne);
    const { error } = await client.from(t.nom).insert(charge);
    if (error) return { acteur, op: 'insert', ...lireErreur(error, 'insert') };
    const apres = await compterAttribuees(t, ligne);
    return apres > avant
      ? { acteur, op: 'insert', verdict: 'accepte', detail: `ligne insérée au nom du propriétaire (${avant} → ${apres})` }
      : { acteur, op: 'insert', verdict: 'refuse', detail: 'insérée mais réattribuée à l’appelant par un trigger' };
  }

  for (const nom of nomsTables) {
    it(nom, async () => {
      const t = tables.get(nom)!;
      const d = declaration(nom);
      expect(d, `${nom} : aucune déclaration`).toBeDefined();
      const graineErreur = semeur.erreurs.get(nom);
      expect(graineErreur, `${nom} : graine impossible, la matrice ne prouverait rien`).toBeUndefined();
      expect(t.cle.length, `${nom} : aucune clé primaire ni unique pour désigner la ligne`).toBeGreaterThan(0);
      const ligne = semeur.graines.get(nom)!.ligne;
      const filtre = Object.fromEntries(t.cle.map((c) => [c, texte(ligne[c]) ?? '']));

      const cellules: Cellule[] = [await lire(proprio.client, t, filtre, 'proprietaire')];
      const attaquants: [Acteur, SupabaseClient, Role][] = [
        ['tiers', tiers.client, 'authenticated'],
        ['anon', anonClient, 'anon'],
      ];
      for (const [acteur, client] of attaquants) cellules.push(await lire(client, t, filtre, acteur));
      for (const [acteur, client, role] of attaquants) cellules.push(await modifier(client, role, t, ligne, filtre, acteur));
      for (const [acteur, client, role] of attaquants) cellules.push(await inserer(client, role, t, ligne, acteur));
      for (const [acteur, client] of attaquants) cellules.push(await supprimer(client, t, ligne, filtre, acteur));

      const attendu = (c: Cellule): Verdict => {
        if (c.acteur === 'proprietaire') return d!.visibilite === 'serveur' ? 'refuse' : 'accepte';
        const permis = c.acteur === 'tiers' ? d!.tiers : d!.anon;
        return permis?.[c.op] ? 'accepte' : 'refuse';
      };
      const signe = (v: Verdict) => (v === 'accepte' ? '✓' : v === 'refuse' ? '✗' : '?');
      console.log(
        `RLS-MATRICE ${nom} [${d!.visibilite}] ` +
          (['proprietaire', 'tiers', 'anon'] as Acteur[])
            .map((a) => `${a}:${OPS.map((op) => {
              const c = cellules.find((x) => x.acteur === a && x.op === op);
              return c ? `${op[0]}${signe(c.verdict)}` : '';
            }).join('')}`)
            .join(' '),
      );
      const ecarts = cellules
        .filter((c) => c.verdict !== attendu(c))
        .map((c) => `${c.acteur}.${c.op} : observé ${c.verdict}, attendu ${attendu(c)} (${c.detail})`);
      expect(ecarts, `${nom} : écarts à la déclaration`).toEqual([]);
    });
  }
});

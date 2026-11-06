// ═══════════════════════════════════════════════════════════════════
// Lecture du CATALOGUE de la base fraîche, pour la matrice RLS.
//
// La liste des tables testées ne se recopie pas : elle se lit ici, dans
// `pg_class` et les privilèges, sur la base où toutes les migrations viennent
// d'être rejouées. Une table créée demain entre dans la matrice sans que
// personne ait à s'en souvenir.
//
// Connexion : `DATABASE_URL`, posée par le job CI `rls-integration` à partir
// de `supabase status -o env`. Le rôle est `postgres`, PROPRIÉTAIRE des tables
// (il a rejoué les migrations) : la RLS ne s'applique pas à lui. Il ne sert
// qu'à poser le décor et à CONSTATER ; aucune assertion de lecture d'un acteur
// ne passe par lui (règle de `helpers.ts`).
// ═══════════════════════════════════════════════════════════════════
import pg from 'pg';

export type Op = 'select' | 'insert' | 'update' | 'delete';
export const OPS: Op[] = ['select', 'insert', 'update', 'delete'];
export type Role = 'anon' | 'authenticated';
export const ROLES: Role[] = ['anon', 'authenticated'];

export interface Colonne {
  nom: string;
  /** `format_type`, utilisable tel quel dans un cast (`$1::<type>`). */
  type: string;
  /** Nom du type de base (domaine résolu), ex. `uuid`, `text`, `timestamptz`. */
  base: string;
  /** `typcategory` du type de base : `A` tableau, `E` enum, `S` chaîne… */
  categorie: string;
  baseOid: number;
  nonNull: boolean;
  aDefaut: boolean;
  /** `a` (ALWAYS), `d` (BY DEFAULT) ou vide. */
  identite: string;
  /** `s` pour une colonne générée. */
  generee: string;
  /** Privilèges de colonne, par rôle. */
  peut: Record<Role, { insert: boolean; update: boolean }>;
}

export interface CleEtrangere {
  colonnes: string[];
  schemaRef: string;
  tableRef: string;
  colonnesRef: string[];
}

export interface Policy {
  nom: string;
  cmd: string;
  permissive: boolean;
  roles: string[];
  using: string | null;
  check: string | null;
}

export interface Relation {
  nom: string;
  /** `r` table, `p` partitionnée, `v` vue, `m` vue matérialisée, `f` étrangère. */
  kind: string;
  rls: boolean;
  securityInvoker: boolean;
  privileges: Record<Role, Record<Op, boolean>>;
}

export interface Table extends Relation {
  colonnes: Colonne[];
  /** Clé primaire, à défaut premier index unique total. Vide si aucune. */
  cle: string[];
  cleEstPrimaire: boolean;
  fks: CleEtrangere[];
  checks: string[];
  policies: Policy[];
}

/** Sous-ensemble de `pg.Client` utilisé ici (le paquet n'embarque pas ses types). */
export interface Db {
  query<R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: R[] }>;
  end(): Promise<void>;
}

export async function connecter(): Promise<Db> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'Matrice RLS : DATABASE_URL requise (posée par le job `rls-integration` depuis ' +
        '`supabase status -o env`, ou `postgresql://postgres:postgres@127.0.0.1:54322/postgres` en local).',
    );
  }
  const client = new pg.Client({ connectionString });
  await client.connect();
  return client as unknown as Db;
}

/**
 * Toutes les relations de `public` sur lesquelles `anon` ou `authenticated`
 * détient au moins un privilège de lecture ou d'écriture : ce que PostgREST
 * expose. Les partitions sont exclues (on y accède par leur table mère).
 */
export async function relationsExposees(db: Db): Promise<Relation[]> {
  const privs = ROLES.flatMap((r) =>
    OPS.map((op) => {
      const P = op.toUpperCase();
      const colonne = op === 'delete' ? 'false' : `has_any_column_privilege('${r}', c.oid, '${P}')`;
      return `(has_table_privilege('${r}', c.oid, '${P}') OR ${colonne}) AS "${r}_${op}"`;
    }),
  ).join(',\n           ');
  const { rows } = await db.query<Record<string, unknown>>(`
    SELECT c.relname::text AS nom, c.relkind::text AS kind, c.relrowsecurity AS rls,
           coalesce((SELECT lower(option_value) IN ('true', 'on', '1', 'yes')
                       FROM pg_options_to_table(c.reloptions)
                      WHERE option_name = 'security_invoker'), false) AS security_invoker,
           ${privs}
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
       AND NOT c.relispartition
     ORDER BY c.relname`);
  return rows
    .map((r) => {
      const privileges = Object.fromEntries(
        ROLES.map((role) => [role, Object.fromEntries(OPS.map((op) => [op, Boolean(r[`${role}_${op}`])]))]),
      ) as Record<Role, Record<Op, boolean>>;
      return {
        nom: String(r.nom),
        kind: String(r.kind),
        rls: Boolean(r.rls),
        securityInvoker: Boolean(r.security_invoker),
        privileges,
      };
    })
    .filter((r) => ROLES.some((role) => OPS.some((op) => r.privileges[role][op])));
}

/** Colonnes, clé, clés étrangères, CHECK et policies d'une table. */
export async function decrireTable(db: Db, rel: Relation): Promise<Table> {
  const reg = `public."${rel.nom}"`;
  const { rows: cols } = await db.query<Record<string, unknown>>(
    `SELECT a.attname::text AS nom, format_type(a.atttypid, a.atttypmod) AS type,
            bt.typname::text AS base, bt.typcategory::text AS categorie, bt.oid::int AS base_oid,
            (a.attnotnull OR coalesce(t.typnotnull, false)) AS non_null,
            (a.atthasdef OR t.typdefault IS NOT NULL) AS a_defaut,
            a.attidentity::text AS identite, a.attgenerated::text AS generee,
            has_column_privilege('anon', a.attrelid, a.attname, 'INSERT') AS anon_insert,
            has_column_privilege('anon', a.attrelid, a.attname, 'UPDATE') AS anon_update,
            has_column_privilege('authenticated', a.attrelid, a.attname, 'INSERT') AS auth_insert,
            has_column_privilege('authenticated', a.attrelid, a.attname, 'UPDATE') AS auth_update
       FROM pg_attribute a
       JOIN pg_type t ON t.oid = a.atttypid
       JOIN pg_type bt ON bt.oid = CASE WHEN t.typtype = 'd' THEN t.typbasetype ELSE t.oid END
      WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attnum`,
    [reg],
  );
  const colonnes: Colonne[] = cols.map((c) => ({
    nom: String(c.nom),
    type: String(c.type),
    base: String(c.base),
    categorie: String(c.categorie),
    baseOid: Number(c.base_oid),
    nonNull: Boolean(c.non_null),
    aDefaut: Boolean(c.a_defaut),
    identite: String(c.identite ?? ''),
    generee: String(c.generee ?? ''),
    peut: {
      anon: { insert: Boolean(c.anon_insert), update: Boolean(c.anon_update) },
      authenticated: { insert: Boolean(c.auth_insert), update: Boolean(c.auth_update) },
    },
  }));

  const { rows: idx } = await db.query<{ cols: string[]; primaire: boolean }>(
    `SELECT ARRAY(SELECT a.attname::text
                    FROM unnest(i.indkey::int2[]) WITH ORDINALITY k(n, o)
                    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.n
                   ORDER BY k.o) AS cols,
            i.indisprimary AS primaire
       FROM pg_index i
      WHERE i.indrelid = $1::regclass
        AND (i.indisprimary OR (i.indisunique AND i.indpred IS NULL AND i.indexprs IS NULL))
      ORDER BY i.indisprimary DESC, array_length(i.indkey::int2[], 1)`,
    [reg],
  );

  const { rows: fks } = await db.query<{ cols: string[]; ref_schema: string; ref_table: string; ref_cols: string[] }>(
    `SELECT ARRAY(SELECT a.attname::text FROM unnest(con.conkey) WITH ORDINALITY k(n, o)
                    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.n ORDER BY k.o) AS cols,
            nf.nspname::text AS ref_schema, cf.relname::text AS ref_table,
            ARRAY(SELECT a.attname::text FROM unnest(con.confkey) WITH ORDINALITY k(n, o)
                    JOIN pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = k.n ORDER BY k.o) AS ref_cols
       FROM pg_constraint con
       JOIN pg_class cf ON cf.oid = con.confrelid
       JOIN pg_namespace nf ON nf.oid = cf.relnamespace
      WHERE con.conrelid = $1::regclass AND con.contype = 'f'
      ORDER BY con.conname`,
    [reg],
  );

  const { rows: checks } = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid = $1::regclass AND contype = 'c' ORDER BY conname`,
    [reg],
  );

  const { rows: pols } = await db.query<Record<string, unknown>>(
    `SELECT p.polname::text AS nom, p.polcmd::text AS cmd, p.polpermissive AS permissive,
            ARRAY(SELECT CASE WHEN r = 0 THEN 'public' ELSE pg_get_userbyid(r)::text END
                    FROM unnest(p.polroles) r) AS roles,
            pg_get_expr(p.polqual, p.polrelid) AS using_expr,
            pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr
       FROM pg_policy p WHERE p.polrelid = $1::regclass ORDER BY p.polname`,
    [reg],
  );

  return {
    ...rel,
    colonnes,
    cle: idx[0]?.cols ?? [],
    cleEstPrimaire: Boolean(idx[0]?.primaire),
    fks: fks.map((f) => ({
      colonnes: f.cols,
      schemaRef: f.ref_schema,
      tableRef: f.ref_table,
      colonnesRef: f.ref_cols,
    })),
    checks: checks.map((c) => c.def),
    policies: pols.map((p) => ({
      nom: String(p.nom),
      cmd: String(p.cmd),
      permissive: Boolean(p.permissive),
      roles: (p.roles as string[]) ?? [],
      using: (p.using_expr as string | null) ?? null,
      check: (p.check_expr as string | null) ?? null,
    })),
  };
}

/** Premier libellé d'une énumération. */
export async function premierLibelle(db: Db, typeOid: number): Promise<string | null> {
  const { rows } = await db.query<{ l: string }>(
    `SELECT enumlabel::text AS l FROM pg_enum WHERE enumtypid = $1 ORDER BY enumsortorder LIMIT 1`,
    [typeOid],
  );
  return rows[0]?.l ?? null;
}

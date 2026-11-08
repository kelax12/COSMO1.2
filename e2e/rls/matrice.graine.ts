// ═══════════════════════════════════════════════════════════════════
// Graine de la matrice RLS : UNE ligne par table exposée, au nom du
// propriétaire, sans connaître le schéma à l'avance.
//
// Les valeurs se déduisent du catalogue :
//   · clé étrangère vers `auth.users` → l'identifiant du propriétaire ;
//   · clé étrangère NOT NULL vers une table de `public` → la ligne graine de
//     cette table, semée d'abord (récursion, cycle détecté) ;
//   · autre colonne NOT NULL sans DEFAULT → une valeur du bon type, la
//     première valeur admise par un CHECK `= ANY (ARRAY[...])` quand il y en a.
// Ce que le catalogue ne suffit pas à deviner (un CHECK numérique, deux
// colonnes liées) se déclare table par table dans `matrice.declarations.ts`,
// champ `graine`. Une table qui n'a pas pu être semée fait ÉCHOUER son cas :
// une cellule « rien vu » sur une table vide ne prouverait rien.
//
// L'écriture passe par `postgres`, propriétaire des tables, avec
// `request.jwt.claims` au nom du propriétaire : `auth.uid()` lui répond dans
// les triggers, comme lors d'une écriture réelle de l'application.
// ═══════════════════════════════════════════════════════════════════
import { randomUUID } from 'node:crypto';
import type { Colonne, Db, Table } from './catalogue';
import { premierLibelle } from './catalogue';

export type Ligne = Record<string, unknown>;

export interface ContexteGraine {
  proprietaire: string;
  /**
   * Un troisième compte, ni propriétaire ni tiers attaquant : pour une colonne
   * qui doit désigner une autre personne que le propriétaire (`invitee_id`,
   * CHECK `inviter_id <> invitee_id`) sans donner de droit de lecture au tiers.
   */
  figurant: string;
  /** Ligne graine d'une autre table (semée à la demande). */
  ligne(table: string): Promise<Ligne>;
  /**
   * Une AUTRE ligne de cette table, distincte de la graine : pour une table de
   * liens `a -> b` qui refuse `a = b` (dépendances, cycle détecté par trigger).
   * Elle partage les parents de la graine (même organisation, même projet).
   * `valeurs` écrase des colonnes (texte casté au type de la colonne) : un
   * second membre d'une organisation (`user_id` = le figurant, `role` = member).
   */
  autre(table: string, valeurs?: Record<string, string | null>): Promise<Ligne>;
}

/** Valeur forcée d'une colonne : texte (casté au type de la colonne) ou `null`. */
export type ValeurForcee = string | null | ((ctx: ContexteGraine) => string | null | Promise<string | null>);

export interface OptionsGraine {
  /** Colonnes forcées. Priment sur tout le reste. */
  valeurs?: Record<string, ValeurForcee>;
  /** Clés étrangères NULLABLES à remplir quand même (nom de la 1re colonne). */
  remplir?: string[];
  /** Ne pas réutiliser une ligne existante du propriétaire (créée par un trigger). */
  sansReutiliser?: boolean;
}

export interface Graine {
  table: string;
  ligne: Ligne;
  /** La ligne existait (trigger d'inscription, effet d'une autre graine). */
  reutilisee: boolean;
}

/** Une colonne d'utilisateur sans clé étrangère, reconnue à son nom. */
const NOM_UTILISATEUR = /(^|_)(user_id|owner_id|created_by|author_id|creator_id|uploaded_by|invited_by)$/;

/** Textes comparés tels que `to_jsonb(...) ->> col` les rend. */
export function texte(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function aleatoire(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

function echapperRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Première valeur littérale admise par un CHECK `col = 'x'` ou `col = ANY (ARRAY['x', ...])`. */
function litteralDeCheck(col: string, checks: string[]): string | null {
  const c = echapperRegex(col);
  const motif = new RegExp(
    `\\b${c}\\b\\)?(?:::[a-z ]+)?\\)?\\s*=\\s*(?:ANY\\s*\\(\\(?ARRAY\\[)?'([^']*)'`,
  );
  for (const def of checks) {
    const m = motif.exec(def);
    if (m) return m[1];
  }
  return null;
}

function longueurMax(type: string): number | null {
  const m = /^(?:character varying|character|varchar|char)\((\d+)\)/.exec(type);
  return m ? Number(m[1]) : null;
}

function texteParNom(nom: string, type: string): string {
  const r = aleatoire();
  let v: string;
  if (/email/.test(nom)) v = `rls.${r}@example.com`;
  else if (/(url|href|link|website|endpoint)$/.test(nom)) v = `https://example.com/${r}`;
  else if (/domain/.test(nom)) v = `rls${r}.example.com`;
  else if (/colou?r/.test(nom)) v = '#3b82f6';
  else if (/currency/.test(nom)) v = 'eur';
  else if (/(locale|lang|language)$/.test(nom)) v = 'fr';
  else if (/(timezone|time_zone)$/.test(nom)) v = 'Europe/Paris';
  else if (/country/.test(nom)) v = 'FR';
  else if (/(hash|digest|signature|secret|token)/.test(nom)) v = (r + r + r + r + r + r).slice(0, 64);
  else if (/(^|_)ip(_address)?$/.test(nom)) v = '127.0.0.1';
  else if (/(code|slug|key)$/.test(nom)) v = `rls${r}`;
  else v = `rls-matrice ${r}`;
  const max = longueurMax(type);
  return max !== null ? v.slice(0, max) : v;
}

async function valeurGeneree(db: Db, t: Table, col: Colonne): Promise<string> {
  if (col.categorie === 'A') return '{}';
  if (col.categorie === 'E') {
    const l = await premierLibelle(db, col.baseOid);
    if (l === null) throw new Error(`${t.nom}.${col.nom} : énumération vide`);
    return l;
  }
  const check = litteralDeCheck(col.nom, t.checks);
  switch (col.base) {
    case 'uuid':
      return randomUUID();
    case 'text':
    case 'varchar':
    case 'bpchar':
    case 'citext':
    case 'name':
      return check ?? texteParNom(col.nom, col.type);
    case 'int2':
    case 'int4':
    case 'int8':
    case 'numeric':
    case 'float4':
    case 'float8':
      return check ?? '1';
    case 'bool': {
      const vrai = new RegExp(`\\b${echapperRegex(col.nom)}\\b\\s*(=\\s*true|IS TRUE)`).test(t.checks.join(' '));
      return vrai ? 'true' : 'false';
    }
    case 'timestamptz':
    case 'timestamp':
      return new Date().toISOString();
    case 'date':
      return new Date().toISOString().slice(0, 10);
    case 'time':
    case 'timetz':
      return '12:00:00';
    case 'interval':
      return '1 day';
    case 'json':
    case 'jsonb':
      return '{}';
    case 'inet':
    case 'cidr':
      return '127.0.0.1';
    case 'bytea':
      return '\\x00';
    case 'tsvector':
      return '';
    default:
      throw new Error(`${t.nom}.${col.nom} : type « ${col.type} » non géré par la graine`);
  }
}

/** Colonnes qui désignent un utilisateur : FK vers `auth.users`, ou nom reconnu (uuid). */
export function colonnesUtilisateur(t: Table): string[] {
  const parFk = t.fks
    .filter((f) => f.schemaRef === 'auth' && f.tableRef === 'users')
    .flatMap((f) => f.colonnes);
  const parNom = t.colonnes
    .filter((c) => c.base === 'uuid' && NOM_UTILISATEUR.test(c.nom) && !t.fks.some((f) => f.colonnes.includes(c.nom)))
    .map((c) => c.nom);
  return [...new Set([...parFk, ...parNom])];
}

export class Semeur {
  readonly graines = new Map<string, Graine>();
  readonly erreurs = new Map<string, string>();
  private readonly enCours = new Set<string>();

  constructor(
    private readonly db: Db,
    private readonly tables: Map<string, Table>,
    private readonly proprietaire: string,
    private readonly figurant: string,
    private readonly options: (table: string) => OptionsGraine | undefined,
  ) {}

  /** Sème toutes les tables ; les échecs sont rangés dans `erreurs`, jamais levés. */
  async semerTout(): Promise<void> {
    for (const nom of [...this.tables.keys()].sort()) {
      try {
        await this.semer(nom);
      } catch {
        // déjà consigné dans `erreurs`
      }
    }
  }

  async semer(nom: string): Promise<Ligne> {
    const deja = this.graines.get(nom);
    if (deja) return deja.ligne;
    const echec = this.erreurs.get(nom);
    if (echec) throw new Error(echec);
    if (this.enCours.has(nom)) throw new Error(`cycle de clés étrangères NOT NULL passant par ${nom}`);
    const t = this.tables.get(nom);
    if (!t) throw new Error(`${nom} : table absente du catalogue exposé`);
    this.enCours.add(nom);
    try {
      const g = await this.creer(t);
      this.graines.set(nom, g);
      return g.ligne;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.erreurs.set(nom, msg);
      throw new Error(msg, { cause: e });
    } finally {
      this.enCours.delete(nom);
    }
  }

  /** Seconde ligne d'une table, hors mémoire : voir `ContexteGraine.autre`. */
  private async semerAutre(nom: string, valeurs?: Record<string, string | null>): Promise<Ligne> {
    const t = this.tables.get(nom);
    if (!t) throw new Error(`${nom} : table absente du catalogue exposé`);
    await this.semer(nom);
    const g = await this.creer(t, true, valeurs);
    this.graines.set(`${nom}#autre${this.graines.size}`, g);
    return g.ligne;
  }

  private async creer(t: Table, neuve = false, surcharge?: Record<string, string | null>): Promise<Graine> {
    const opts = this.options(t.nom) ?? {};
    const ctx: ContexteGraine = {
      proprietaire: this.proprietaire,
      figurant: this.figurant,
      ligne: (x) => this.semer(x),
      autre: (x, v) => this.semerAutre(x, v),
    };
    const valeurs = new Map<string, string | null>();
    const utilisateurs = colonnesUtilisateur(t);

    // 1. Clés étrangères. Vers `auth.users` : le propriétaire, dans chaque
    // colonne NOT NULL ; une colonne nullable ne le reçoit que si la table n'a
    // aucune colonne d'utilisateur obligatoire (`created_by` seul porteur de
    // l'identité). Sinon `manager_id`, `assignee_id`… resteraient égaux à
    // `user_id`, ce que des CHECK interdisent (`manager_id <> user_id`).
    const estUtilisateur = (f: (typeof t.fks)[number]) => f.schemaRef === 'auth' && f.tableRef === 'users';
    const colonne = (n: string) => t.colonnes.find((x) => x.nom === n)!;
    const obligatoire = (n: string) => colonne(n).nonNull && !colonne(n).aDefaut;
    const aUnUtilisateurObligatoire = t.fks.some((f) => estUtilisateur(f) && f.colonnes.some(obligatoire));
    for (const fk of t.fks) {
      if (estUtilisateur(fk)) {
        for (const c of fk.colonnes) {
          if (obligatoire(c) || colonne(c).nonNull || !aUnUtilisateurObligatoire) valeurs.set(c, this.proprietaire);
        }
        continue;
      }
      const cols = fk.colonnes.map((c) => t.colonnes.find((x) => x.nom === c)!);
      const requise = cols.some((c) => c.nonNull && !c.aDefaut) || (opts.remplir ?? []).includes(fk.colonnes[0]);
      if (!requise) continue;
      if (fk.schemaRef !== 'public') {
        throw new Error(`${t.nom}.${fk.colonnes.join(',')} : clé étrangère NOT NULL vers ${fk.schemaRef}.${fk.tableRef}`);
      }
      if (fk.tableRef === t.nom) {
        throw new Error(`${t.nom}.${fk.colonnes.join(',')} : auto-référence NOT NULL (déclarer la graine)`);
      }
      let parent: Ligne;
      try {
        parent = await this.semer(fk.tableRef);
      } catch (e) {
        throw new Error(`dépend de ${fk.tableRef} : ${e instanceof Error ? e.message : String(e)}`, { cause: e });
      }
      fk.colonnes.forEach((c, i) => valeurs.set(c, texte(parent[fk.colonnesRef[i]])));
    }
    // Colonnes d'utilisateur reconnues à leur nom, sans clé étrangère.
    for (const c of utilisateurs) {
      if (!t.fks.some((f) => f.colonnes.includes(c))) valeurs.set(c, this.proprietaire);
    }

    // 2. Valeurs forcées par la déclaration (peuvent semer d'autres tables).
    for (const [col, v] of Object.entries(opts.valeurs ?? {})) {
      if (!t.colonnes.some((c) => c.nom === col)) throw new Error(`${t.nom} : colonne forcée inconnue « ${col} »`);
      valeurs.set(col, typeof v === 'function' ? await v(ctx) : v);
    }

    for (const [col, v] of Object.entries(surcharge ?? {})) {
      if (!t.colonnes.some((c) => c.nom === col)) throw new Error(`${t.nom} : colonne surchargée inconnue « ${col} »`);
      valeurs.set(col, v);
    }

    // 3. Ligne déjà présente pour le propriétaire (trigger d'inscription, effet d'une graine) ?
    if (!neuve && !opts.sansReutiliser && utilisateurs.length > 0) {
      const { rows } = await this.db.query<{ ligne: Ligne }>(
        `SELECT to_jsonb(t.*) AS ligne FROM public."${t.nom}" t
          WHERE ${utilisateurs.map((c) => `(to_jsonb(t.*) ->> '${c}') = $1`).join(' OR ')}
          LIMIT 1`,
        [this.proprietaire],
      );
      if (rows[0]) return { table: t.nom, ligne: rows[0].ligne, reutilisee: true };
    }

    // 4. Colonnes NOT NULL restantes.
    for (const col of t.colonnes) {
      if (valeurs.has(col.nom) || col.generee === 's' || col.identite === 'a') continue;
      if (!col.nonNull || col.aDefaut || col.identite === 'd') continue;
      valeurs.set(col.nom, await valeurGeneree(this.db, t, col));
    }

    const cols = [...valeurs.keys()];
    const types = new Map(t.colonnes.map((c) => [c.nom, c.type]));
    const sql = cols.length
      ? `INSERT INTO public."${t.nom}" (${cols.map((c) => `"${c}"`).join(', ')})
         VALUES (${cols.map((c, i) => `$${i + 1}::${types.get(c)}`).join(', ')})
         RETURNING to_jsonb("${t.nom}".*) AS ligne`
      : `INSERT INTO public."${t.nom}" DEFAULT VALUES RETURNING to_jsonb("${t.nom}".*) AS ligne`;

    await this.db.query('BEGIN');
    try {
      await this.db.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: this.proprietaire, role: 'authenticated' }),
      ]);
      await this.db.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [this.proprietaire]);
      const { rows } = await this.db.query<{ ligne: Ligne }>(sql, cols.map((c) => valeurs.get(c)));
      await this.db.query('COMMIT');
      return { table: t.nom, ligne: rows[0].ligne, reutilisee: false };
    } catch (e) {
      await this.db.query('ROLLBACK');
      const err = e as { code?: string; message?: string; detail?: string };
      throw new Error(
        `insertion refusée (${err.code ?? '?'}) ${err.message ?? String(e)}` +
          (err.detail ? ` · ${err.detail}` : '') +
          ` · colonnes posées : ${cols.join(', ') || 'aucune'}`,
        { cause: e },
      );
    }
  }
}

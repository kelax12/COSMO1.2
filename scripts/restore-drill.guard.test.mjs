// ═══════════════════════════════════════════════════════════════════
// restore-drill.guard.test.mjs · LE TEMOIN DU DRILL MENSUEL (ROB-01)
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// Le drill est le seul controle qui RESTAURE la seule sauvegarde de la base.
// Il juge sur trois choses qui savent toutes se tromper dans le sens
// rassurant : un classement d'erreurs (une tolerance trop large avale une
// table perdue), une comparaison de comptages (une table absente des deux
// cotes ne se voit pas si on ne regarde que le manifeste), et un controle
// d'isolation (celui d'avant capturait le mot ROLLBACK et ne pouvait PAS
// echouer, cf. `docs/DEPLOYMENT.md` § 7).
//
// Chaque cas soumet au code REEL une situation qui doit rougir. Le plancher :
// un drill sain passe, et le dechiffre ne survit dans aucun cas.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  SQL_COMPTAGES, SUFFIXE_MANIFESTE, EXTENSIONS_ABSENTES, classerManifeste, lireComptages,
  altererPourTemoin, comparer, decouperErreurs, raisonTolerance, libelle, classerErreurs,
  verifierCible, verdictIsolation, sqlRoles, drill, resumeMarkdown,
} from './restore-drill.mjs';
import { ATTENDUES } from './dump-check.mjs';

const PHRASE = 'phrase-de-test-de-trente-deux-caracteres-au-moins';
const SKESK = Buffer.from([0x8c, 0x0d, 0x04, 0x09]); // premier octet reel de `gpg --symmetric`
const CLAIR = Buffer.concat([Buffer.from('PGDMP'), Buffer.alloc(200_000, 1)]);
const TOC = ATTENDUES.map((t, i) => `${i}; 1259 1 TABLE public ${t} postgres`).join('\n') + '\n';
const ETAT_OK = ['[GNUPG:] BEGIN_DECRYPTION', '[GNUPG:] DECRYPTION_OKAY', '[GNUPG:] END_DECRYPTION'].join('\n');
const MANIFESTE = [
  'meta|policies_public|140', 'meta|tables_rls_public|3',
  'table|auth.users|27', 'table|public.profiles|27', 'table|public.tasks|724', 'table|public.habits|80',
].join('\n') + '\n';
const LOCAL = { PGHOST: 'localhost', PGDATABASE: 'drill' };

const dossiers = [];
function dossier(fichiers) {
  const d = mkdtempSync(join(tmpdir(), 'restore-drill-'));
  dossiers.push(d);
  for (const [nom, contenu] of Object.entries(fichiers)) writeFileSync(join(d, nom), contenu);
  return d;
}
afterEach(() => { while (dossiers.length) rmSync(dossiers.pop(), { recursive: true, force: true }); });

/** Un faux monde : gpg, pg_restore et psql qui ENREGISTRENT leurs appels. */
function monde({
  restaure = MANIFESTE, restore = { status: 0, stderr: '' }, version = '170006',
  isolation = 'total|724\nsiennes|300\nclaims|t\nvisibles|300\n',
} = {}) {
  const appels = [];
  const executer = (cmd, args, opts = {}) => {
    appels.push({ cmd, args, opts });
    if (cmd === 'gpg') {
      const entree = args[args.indexOf('-d') + 1];
      writeFileSync(args[args.indexOf('-o') + 1], entree.endsWith(SUFFIXE_MANIFESTE) ? MANIFESTE : CLAIR);
      return { status: 0, stdout: ETAT_OK, stderr: '' };
    }
    if (cmd === 'pg_restore') return args.includes('--list') ? { status: 0, stdout: TOC, stderr: '' } : { ...restore };
    if (cmd === 'psql') {
      const sql = String(opts.input ?? '');
      if (args.includes(SQL_COMPTAGES)) return { status: 0, stdout: restaure, stderr: '' };
      if (/server_version_num/.test(sql)) return { status: 0, stdout: `${version}\n`, stderr: '' };
      if (/SET LOCAL ROLE authenticated/.test(sql)) return { status: 0, stdout: isolation, stderr: '' };
      return { status: 0, stdout: '', stderr: '' };
    }
    throw new Error(`commande inattendue ${cmd}`);
  };
  return { appels, executer };
}

function artefacts() {
  return {
    dossierDump: dossier({ 'cosmo-2026-11-07.dump.gpg': SKESK }),
    dossierManifeste: dossier({ [`cosmo-2026-11-07${SUFFIXE_MANIFESTE}`]: SKESK }),
  };
}

// ─── Le manifeste ───────────────────────────────────────────────────

describe('restore-drill · un manifeste douteux ne se compare pas', () => {
  it('accepte un manifeste bien forme', () => {
    const m = lireComptages(MANIFESTE);
    expect(m.tables.get('public.tasks')).toBe(724);
    expect(m.meta.get('policies_public')).toBe(140);
  });

  it.each([
    ['une ligne illisible', `${MANIFESTE}table|public.x|douze\n`, /ligne 7 illisible/],
    ['une table comptee deux fois', `${MANIFESTE}table|public.tasks|724\n`, /deux fois/],
    ['aucune table de public', 'meta|policies_public|1\nmeta|tables_rls_public|1\ntable|auth.users|3\n', /aucune table du schema public/],
    ['un compteur RLS absent', 'meta|policies_public|1\ntable|public.tasks|3\n', /tables_rls_public absent/],
    ['un manifeste vide', '', /aucune table/],
  ])('refuse %s', (_, texte, motif) => {
    expect(() => lireComptages(texte)).toThrow(motif);
  });

  it('ne cite jamais le contenu de la ligne fautive', () => {
    expect(() => lireComptages(`${MANIFESTE}jean.dupont@example.com\n`)).toThrow(/^(?!.*dupont).*$/);
  });

  it('artefact : exactement un manifeste chiffre, rien en clair a cote', () => {
    expect(() => classerManifeste([])).toThrow(/vide ou absent/);
    expect(() => classerManifeste([`a${SUFFIXE_MANIFESTE}`, 'a.comptages.tsv'])).toThrow(/non chiffre/);
    expect(() => classerManifeste([`a${SUFFIXE_MANIFESTE}`, `b${SUFFIXE_MANIFESTE}`])).toThrow(/un seul attendu/);
    expect(classerManifeste([`a${SUFFIXE_MANIFESTE}`])).toBe(`a${SUFFIXE_MANIFESTE}`);
  });
});

describe('restore-drill · une ligne d ecart, une table de plus ou de moins = ecart', () => {
  const attendu = () => lireComptages(MANIFESTE);

  it('identiques : aucun ecart, et chaque table est listee', () => {
    const c = comparer(attendu(), attendu());
    expect(c.ecarts).toEqual([]);
    expect(c.lignes.filter((l) => l.genre === 'table')).toHaveLength(4);
  });

  it('une ligne de moins dans une table', () => {
    const c = comparer(attendu(), lireComptages(MANIFESTE.replace('public.tasks|724', 'public.tasks|723')));
    expect(c.ecarts.map((e) => e.nom)).toEqual(['public.tasks']);
  });

  it('une table perdue a la restauration', () => {
    const c = comparer(attendu(), lireComptages(MANIFESTE.replace('table|public.habits|80\n', '')));
    expect(c.ecarts).toEqual([expect.objectContaining({ nom: 'public.habits', attendu: 80, obtenu: null })]);
  });

  it('une table restauree que le manifeste ne connait pas', () => {
    const c = comparer(attendu(), lireComptages(`${MANIFESTE}table|public.fantome|0\n`));
    expect(c.ecarts).toEqual([expect.objectContaining({ nom: 'public.fantome', attendu: null })]);
  });

  it('auth.users perdu', () => {
    const c = comparer(attendu(), lireComptages(MANIFESTE.replace('table|auth.users|27\n', '')));
    expect(c.ecarts.map((e) => e.nom)).toEqual(['auth.users']);
  });

  it('des policies perdues, a comptages de lignes identiques', () => {
    const c = comparer(attendu(), lireComptages(MANIFESTE.replace('policies_public|140', 'policies_public|139')));
    expect(c.ecarts.map((e) => e.nom)).toEqual(['policies_public']);
  });

  it('le temoin altere un comptage de +1, et la comparaison le voit', () => {
    const m = attendu();
    expect(altererPourTemoin(m)).toBe('public.tasks');
    expect(comparer(m, attendu()).ecarts).toEqual([expect.objectContaining({ nom: 'public.tasks', attendu: 725, obtenu: 724 })]);
  });
});

// ─── Les erreurs de pg_restore ──────────────────────────────────────

const STDERR = [
  'pg_restore: error: could not execute query: ERROR:  extension "pg_graphql" is not available',
  'DETAIL:  Could not open extension control file "/usr/share/postgresql/17/extension/pg_graphql.control".',
  'HINT:  The extension must first be installed on the system where PostgreSQL is running.',
  'Command was: CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;',
  'pg_restore: error: could not execute query: ERROR:  schema "net" does not exist',
  'Command was: GRANT ALL ON FUNCTION net.http_get(url text) TO postgres;',
  'pg_restore: error: could not execute query: ERROR:  relation "vault.secrets" does not exist',
  'Command was: COPY vault.secrets (id, name, secret) FROM stdin;',
  'pg_restore: warning: errors ignored on restore: 3',
].join('\n');

describe('restore-drill · une erreur n est toleree que pour une extension Supabase absente', () => {
  it('decoupe trois erreurs, et le nombre annonce', () => {
    const { erreurs, annoncees } = decouperErreurs(STDERR);
    expect(erreurs).toHaveLength(3);
    expect(annoncees).toBe(3);
    expect(JSON.stringify(erreurs)).not.toMatch(/DETAIL|HINT|control file/);
  });

  it('les trois sont tolerees : extension absente, son schema, ses donnees', () => {
    const c = classerErreurs(1, STDERR);
    expect(c.bloquantes).toEqual([]);
    expect(c.tolerees.map((t) => t.raison)).toEqual([
      'extension pg_graphql absente de postgres:17', 'objet du schema net (extension absente)',
      'donnees du schema vault (extension absente)',
    ]);
  });

  it.each([
    ['une extension hors liste', { message: 'extension "vector" is not available', commande: 'CREATE EXTENSION vector;' }],
    ['un objet de public, meme cause', { message: 'schema "net" does not exist', commande: 'CREATE FUNCTION public.notifier() RETURNS void' }],
    ['une policy de public', { message: 'function vault.decrypt(uuid) does not exist', commande: 'CREATE POLICY p ON public.tasks USING (vault.decrypt(id))' }],
    ['un objet d auth', { message: 'schema "net" does not exist', commande: 'CREATE TRIGGER t AFTER INSERT ON auth.users' }],
    ['un role manquant', { message: 'role "supabase_nouveau" does not exist', commande: 'GRANT ALL ON SCHEMA x TO supabase_nouveau;' }],
    ['un chargement de public', { message: 'invalid input syntax', commande: 'COPY public.tasks (id, name) FROM stdin;' }],
    ['un chargement d auth.users', { message: 'x', commande: '', table: 'auth.users' }],
    ['un schema inconnu', { message: 'schema "graphql_public" does not exist', commande: 'CREATE FUNCTION graphql_public.graphql()' }],
  ])('bloque %s', (_, e) => {
    expect(raisonTolerance(e)).toBeNull();
  });

  it('la liste fermee ne couvre aucune extension de contrib', () => {
    for (const ext of ['pgcrypto', 'uuid-ossp', 'pg_stat_statements', 'pg_trgm', 'citext']) {
      expect(ext in EXTENSIONS_ABSENTES).toBe(false);
    }
  });

  it('un echec de COPY n imprime JAMAIS son message (il peut citer une valeur)', () => {
    const l = libelle({ message: 'invalid input syntax for type uuid: "jean.dupont@example.com"', commande: 'COPY public.tasks (id) FROM stdin;' });
    expect(l).not.toMatch(/dupont/);
    expect(l).toMatch(/public\.tasks/);
  });

  it('le nombre annonce differe du nombre classe : bloquant', () => {
    const tronque = STDERR.replace('errors ignored on restore: 3', 'errors ignored on restore: 4');
    expect(classerErreurs(1, tronque).bloquantes.join()).toMatch(/annonce 4 erreur\(s\), 3 classee/);
  });

  it('un code non nul sans annonce : bloquant', () => {
    expect(classerErreurs(1, 'pg_restore: error: connection to server failed').bloquantes.length).toBeGreaterThan(0);
    expect(classerErreurs(2, '').bloquantes.join()).toMatch(/sans annoncer/);
  });

  it('un code 0 avec des erreurs au journal : bloquant', () => {
    expect(classerErreurs(0, STDERR).bloquantes.join()).toMatch(/incoherent/);
  });
});

// ─── La cible et l isolation ────────────────────────────────────────

describe('restore-drill · jamais la production', () => {
  it.each([
    ['l hote de production', { PGHOST: 'aws-0-eu-west-3.pooler.supabase.com' }],
    ['un hote vide', {}],
    ['une DATABASE_URL a cote', { PGHOST: 'localhost', DATABASE_URL: 'postgres://x' }],
  ])('refuse %s', (_, env) => {
    expect(() => verifierCible(env)).toThrow(/refusee|DATABASE_URL/);
  });

  it('accepte le Postgres du runner', () => {
    expect(() => verifierCible(LOCAL)).not.toThrow();
  });

  it('le drill refuse la cible AVANT tout appel', () => {
    const { appels, executer } = monde();
    const r = drill({ ...artefacts(), phrase: PHRASE, env: { PGHOST: 'db.prod.supabase.co' }, executer });
    expect(r.exit).toBe(1);
    expect(appels).toEqual([]);
  });

  it('les roles crees ne contournent pas la RLS, sauf service_role', () => {
    const sql = sqlRoles();
    expect(sql).toMatch(/CREATE ROLE %I NOLOGIN/);
    expect(sql).toMatch(/'authenticated'/);
    expect(sql.match(/BYPASSRLS/g)).toHaveLength(1);
    expect(sql).toMatch(/ALTER ROLE service_role BYPASSRLS/);
  });
});

describe('restore-drill · l isolation se mesure, elle ne s affirme pas', () => {
  it('un utilisateur qui voit plus que ses taches : rouge', () => {
    expect(verdictIsolation('total|724\nsiennes|300\nclaims|t\nvisibles|724\n').ok).toBe(false);
  });

  it('une sortie sans les trois comptes : rouge (le piege du ROLLBACK)', () => {
    expect(verdictIsolation('total|724\nROLLBACK\n').ok).toBe(false);
  });

  it('aucune tache restauree : rouge', () => {
    expect(verdictIsolation('total|0\nsiennes|0\nvisibles|0\n').ok).toBe(false);
  });

  it('ne voit que les siennes : vert', () => {
    expect(verdictIsolation('total|724\nsiennes|300\nclaims|t\nvisibles|300\n')).toMatchObject({ ok: true, visibles: 300 });
  });
});

// ─── Le drill de bout en bout ───────────────────────────────────────

describe('restore-drill · bout en bout, avec un faux monde', () => {
  it('PLANCHER : un drill sain passe, et le dechiffre est efface', () => {
    const a = artefacts();
    const { executer } = monde();
    const r = drill({ ...a, phrase: PHRASE, env: LOCAL, executer });
    expect(r.lines.join('\n')).not.toMatch(/::error/);
    expect(r.exit).toBe(0);
    expect(r.resume.comparaison.ecarts).toEqual([]);
    expect(existsSync(join(a.dossierDump, 'cosmo-2026-11-07.dump'))).toBe(false);
  });

  it('TEMOIN : un comptage altere fait rougir le drill', () => {
    const a = artefacts();
    const r = drill({ ...a, phrase: PHRASE, env: LOCAL, temoin: true, executer: monde().executer });
    expect(r.exit).toBe(1);
    expect(r.resume.temoin).toBe('public.tasks');
    expect(r.lines.join('\n')).toMatch(/ecart public\.tasks : manifeste 725, restaure 724/);
    expect(existsSync(join(a.dossierDump, 'cosmo-2026-11-07.dump'))).toBe(false);
  });

  it('une table perdue a la restauration fait rougir le drill', () => {
    const r = drill({ ...artefacts(), phrase: PHRASE, env: LOCAL,
      executer: monde({ restaure: MANIFESTE.replace('table|public.habits|80\n', '') }).executer });
    expect(r.exit).toBe(1);
    expect(r.lines.join('\n')).toMatch(/ecart public\.habits : manifeste 80, restaure absent/);
  });

  it('une erreur de restauration bloquante fait rougir, meme a comptages egaux', () => {
    const stderr = 'pg_restore: error: could not execute query: ERROR:  role "x" does not exist\nCommand was: GRANT ALL ON TABLE public.tasks TO x;\npg_restore: warning: errors ignored on restore: 1';
    const r = drill({ ...artefacts(), phrase: PHRASE, env: LOCAL, executer: monde({ restore: { status: 1, stderr } }).executer });
    expect(r.exit).toBe(1);
    expect(r.resume.bloquantes).toHaveLength(1);
  });

  it('une isolation perdue fait rougir, a comptages egaux', () => {
    const r = drill({ ...artefacts(), phrase: PHRASE, env: LOCAL,
      executer: monde({ isolation: 'total|724\nsiennes|300\nclaims|t\nvisibles|724\n' }).executer });
    expect(r.exit).toBe(1);
    expect(r.lines.join('\n')).toMatch(/isolation n est PAS revenue/);
  });

  it('un Postgres jetable qui n est pas en 17 : rouge', () => {
    const r = drill({ ...artefacts(), phrase: PHRASE, env: LOCAL, executer: monde({ version: '160004' }).executer });
    expect(r.exit).toBe(1);
    expect(r.resume.verdict).toMatch(/production est en 17/);
  });

  it('sans manifeste : rouge, et le dechiffre est efface quand meme', () => {
    const a = { dossierDump: dossier({ 'x.dump.gpg': SKESK }), dossierManifeste: dossier({}) };
    const r = drill({ ...a, phrase: PHRASE, env: LOCAL, executer: monde().executer });
    expect(r.exit).toBe(1);
    expect(r.resume.verdict).toMatch(/db-comptages vide ou absent/);
    expect(existsSync(join(a.dossierDump, 'x.dump'))).toBe(false);
  });

  it('la phrase passe par stdin, jamais en argument', () => {
    const { appels, executer } = monde();
    drill({ ...artefacts(), phrase: PHRASE, env: LOCAL, executer });
    for (const a of appels) expect(a.args.join(' ')).not.toContain(PHRASE);
  });

  it('le resume porte les comptages, et seulement des noms et des nombres', () => {
    const r = drill({ ...artefacts(), phrase: PHRASE, env: LOCAL, executer: monde().executer });
    const md = resumeMarkdown(r.resume, '42', '2026-11-07');
    expect(md).toMatch(/\| `public\.tasks` \| 724 \| 724 \| ✅ \|/);
    expect(md).toMatch(/\| `auth\.users` \| 27 \| 27 \| ✅ \|/);
    expect(md).toMatch(/Ne prouve pas/);
  });
});

// ─── Une seule requete, jouee des deux cotes ────────────────────────

describe('restore-drill · le manifeste et sa relecture lisent la MEME requete', () => {
  const sql = readFileSync(SQL_COMPTAGES, 'utf8');
  const backup = readFileSync(resolve('.github/workflows/db-backup.yml'), 'utf8');

  it('db-backup la joue dans le snapshot exporte vers pg_dump', () => {
    expect(backup).toMatch(/\\i scripts\/sql\/comptages-sauvegarde\.sql/);
    expect(backup).toMatch(/pg_export_snapshot\(\)/);
    expect(backup).toMatch(/--snapshot="\$SNAP"/);
    expect(backup).toMatch(/REPEATABLE READ READ ONLY/);
  });

  it('elle ne rend que des comptes : ni SELECT *, ni colonne de table', () => {
    const code = sql.replace(/--[^\n]*/g, '');
    expect(code).not.toMatch(/SELECT\s+\*/i);
    expect(code).toMatch(/count\(\*\)/);
    const lues = [...code.matchAll(/\b(?:FROM|JOIN)\s+([a-z_][\w.]*)/gi)].map((m) => m[1].toLowerCase());
    expect(lues.every((r) => /^pg_(class|namespace|depend|policies)$/.test(r))).toBe(true);
  });

  it('elle couvre public et auth.users, hors tables d extension', () => {
    expect(sql).toMatch(/n\.nspname = 'public' OR \(n\.nspname = 'auth' AND c\.relname = 'users'\)/);
    expect(sql).toMatch(/deptype = 'e'/);
  });
});

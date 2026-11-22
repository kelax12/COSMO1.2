// ═══════════════════════════════════════════════════════════════════
// restore-drill.guard.test.mjs · LE TEMOIN DU DRILL MENSUEL (ROB-01)
//
// Le drill restaure la seule sauvegarde de la base. Il juge sur ce qui sait se
// tromper dans le sens rassurant : une comparaison de comptages, un controle
// d'isolation (celui d'avant capturait le mot ROLLBACK et ne pouvait PAS
// echouer), des preuves par API (connexion, anon, RPC). Chaque cas soumet au
// code REEL une situation qui doit rougir ; le plancher : un drill sain passe.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  SQL_COMPTAGES, SUFFIXE_MANIFESTE, classerManifeste, lireComptages,
  altererPourTemoin, comparer, decouperErreurs, libelle, classerErreurs,
  verifierCible, drill, resumeMarkdown, verdictStack, SQL_STACK,
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
const LOCAL = { PGHOST: 'localhost', PGDATABASE: 'postgres', API_URL: 'http://127.0.0.1:54321', ANON_KEY: 'cle-anon' };

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
  stack = {},
} = {}) {
  // La stack : comptes lus en SQL, puis ce que GoTrue et PostgREST repondent.
  const k = { users: 27, orphelins: 0, total: 724, siennes: 300, email: 'a@b.c', visibles: 300, rpc: 300, jeton: true, api: 300, apiRpc: 300, anon: 0, ...stack };
  let vide = false;
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
      if (/TRUNCATE auth\.users/.test(sql)) vide = true;
      if (args.includes(SQL_COMPTAGES)) return { status: 0, stdout: vide ? restaure.replace('table|auth.users|27\n', '') : restaure, stderr: '' };
      if (/drill_compte/.test(sql)) {
        const mail = k.email && !vide ? `email|${k.email}\n` : '';
        return { status: 0, stdout: `users|${vide ? 0 : k.users}\ntotal|${k.total}\nsiennes|${k.siennes}\norphelins|${k.orphelins}\n${mail}claims|t\nvisibles|${k.visibles}\nrpc|${k.rpc}\n`, stderr: '' };
      }
      if (/server_version_num/.test(sql)) return { status: 0, stdout: `${version}\n`, stderr: '' };
      return { status: 0, stdout: '', stderr: '' };
    }
    if (cmd === 'docker') return { status: 0, stdout: '', stderr: '' };
    if (cmd === 'curl') {
      const url = args.at(-1);
      const sortie = (corps, code, n = 0) => ({ status: 0, stdout: `${corps}\n${code}\n0-0/${n}`, stderr: '' });
      if (/auth\/v1\/token/.test(url)) return k.jeton ? sortie('{"access_token":"jwt"}', 200) : sortie('{"error":"invalid"}', 400);
      if (args.includes('Authorization: Bearer cle-anon')) return sortie('[]', 200, k.anon);
      return sortie('[]', 200, /rpc/.test(url) ? k.apiRpc : k.api);
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
  'pg_restore: error: could not execute query: ERROR:  relation "public.tasks" already exists',
  'DETAIL:  Key (id)=(jean.dupont@example.com) already exists.',
  'Command was: CREATE TABLE public.tasks (',
  'pg_restore: error: could not execute query: ERROR:  schema "net" does not exist',
  'Command was: GRANT ALL ON FUNCTION net.http_get(url text) TO postgres;',
  'pg_restore: warning: errors ignored on restore: 2',
].join('\n');

describe('restore-drill · sur une stack Supabase, aucune erreur de pg_restore n est attendue', () => {
  it('decoupe les erreurs et le nombre annonce, sans DETAIL ni valeur', () => {
    const { erreurs, annoncees } = decouperErreurs(STDERR);
    expect(erreurs).toHaveLength(2);
    expect(annoncees).toBe(2);
    expect(JSON.stringify(erreurs)).not.toMatch(/DETAIL|dupont/);
  });

  it('toute erreur est bloquante, meme celle d une extension absente', () => {
    expect(classerErreurs(1, STDERR).bloquantes).toHaveLength(2);
    expect(classerErreurs(1, STDERR.split('\n').slice(3).join('\n').replace(': 2', ': 1')).bloquantes).toHaveLength(1);
  });

  it('un echec de COPY n imprime JAMAIS son message (il peut citer une valeur)', () => {
    const l = libelle({ message: 'invalid input syntax for type uuid: "jean.dupont@example.com"', commande: 'COPY public.tasks (id) FROM stdin;' });
    expect(l).not.toMatch(/dupont/);
    expect(l).toMatch(/public\.tasks/);
  });

  it('le nombre annonce differe du nombre classe : bloquant', () => {
    const tronque = STDERR.replace('errors ignored on restore: 2', 'errors ignored on restore: 4');
    expect(classerErreurs(1, tronque).bloquantes.join()).toMatch(/annonce 4 erreur\(s\), 2 classee/);
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
      executer: monde({ stack: { visibles: 724, api: 724 } }).executer });
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

// ─── La stack Supabase : ce que le Postgres nu ne prouve pas ────────

describe('restore-drill · la stack Supabase juge au-dela des comptages', () => {
  const rouge = (opts, motif, extra = {}) => {
    const r = drill({ ...artefacts(), phrase: PHRASE, env: LOCAL, executer: monde(opts).executer, ...extra });
    expect(r.exit).toBe(1);
    expect(r.lines.join('\n')).toMatch(motif);
    return r;
  };

  it('PLANCHER : un drill sain rend ses preuves, en nombres seulement', () => {
    const r = drill({ ...artefacts(), phrase: PHRASE, env: LOCAL, executer: monde().executer });
    expect(r.exit).toBe(0);
    expect(r.resume.stack).toMatchObject({ users: 27, connexion: true, authentifie: 300, anon: 0, rpc: 300 });
    expect(resumeMarkdown(r.resume, '42')).not.toMatch(/a@b\.c|jwt/);
  });

  it('TEMOIN : une restauration qui perd auth.users rougit (comptage ET connexion)', () => {
    const r = rouge({}, /ecart auth\.users : manifeste 27, restaure absent/, { perteAuth: true });
    expect(r.lines.join('\n')).toMatch(/stack : auth\.users vide apres restauration/);
    expect(r.lines.join('\n')).toMatch(/stack : connexion d un utilisateur restaure/);
  });

  it('une connexion qui echoue rougit, a comptages egaux', () => {
    rouge({ stack: { jeton: false } }, /stack : connexion d un utilisateur restaure/);
  });

  it('un profil sans utilisateur auth rougit', () => {
    rouge({ stack: { orphelins: 2 } }, /2 profil\(s\) sans utilisateur auth/);
  });

  it('un utilisateur authentifie qui lit plus que sous RLS rougit', () => {
    rouge({ stack: { api: 724 } }, /724 taches par l API, 300 sous RLS/);
  });

  it('anon qui lit des lignes rougit', () => {
    rouge({ stack: { anon: 724 } }, /anon voit 724 taches/);
  });

  it('une RPC qui ne rend pas ce que la RLS donne rougit', () => {
    rouge({ stack: { apiRpc: 0 } }, /RPC get_my_tasks : 0 lignes, 300 attendues/);
  });

  it('une stack introuvable rougit, sans cacher les autres fautes', () => {
    const r = drill({ ...artefacts(), phrase: PHRASE, temoin: true, executer: monde().executer,
      env: { ...LOCAL, API_URL: 'https://prod.supabase.co' } });
    expect(r.lines.join('\n')).toMatch(/ecart public\.tasks[\s\S]*stack : API_URL \(locale\)/);
  });

  it('verdictStack : chaque mesure manquante est une faute', () => {
    expect(verdictStack({})).not.toEqual([]);
    expect(verdictStack({ users: 1, orphelins: 0, total: 2, siennes: 1, connexion: true, authentifie: 1, visibles: 1, anon: 0, rpc: 1, rpcAttendu: 1 })).toEqual([]);
  });

  it('le compte recoit un mot de passe connu, rien ne s imprime', () => {
    expect(SQL_STACK).toMatch(/UPDATE auth\.users SET encrypted_password/);
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

// ── Garde d'absence : restore-drill.mjs fraicheur ──
import { verdictFraicheur, lireRuns, JOURS_MAX, JOB } from './restore-drill.mjs';

const MAINTENANT = new Date('2026-12-20T06:19:00Z');
const vert = (id, date) => ({ id, date, jobs: [{ name: JOB, conclusion: 'success' }, { name: 'drill', conclusion: 'skipped' }] });

describe('fraicheur du drill · l absence rougit', () => {
  it('PLANCHER : un drill-auto vert il y a 11 jours passe', () => {
    const v = verdictFraicheur([vert(1, '2026-12-09T05:50:00Z')], MAINTENANT);
    expect(v).toMatchObject({ ok: true, ageJours: 11 });
  });

  it('aucun run : rouge', () => {
    expect(verdictFraicheur([], MAINTENANT).ok).toBe(false);
    expect(verdictFraicheur(undefined, MAINTENANT).ok).toBe(false);
  });

  it(`un drill vert de plus de ${JOURS_MAX} jours : rouge`, () => {
    const v = verdictFraicheur([vert(1, '2026-11-14T05:50:00Z')], MAINTENANT);
    expect(v.ok).toBe(false);
    expect(v.message).toMatch(/il y a 36 jours, au-dela de 35/);
  });

  it('un run vert SANS job drill-auto (ancien drill manuel) ne compte pas', () => {
    const ancien = { id: 2, date: '2026-12-15T00:00:00Z', jobs: [{ name: 'dump-check', conclusion: 'success' }, { name: 'drill', conclusion: 'success' }] };
    expect(verdictFraicheur([ancien], MAINTENANT).ok).toBe(false);
  });

  it('un drill-auto en echec ne compte pas', () => {
    const rouge = { id: 3, date: '2026-12-15T00:00:00Z', jobs: [{ name: JOB, conclusion: 'failure' }] };
    expect(verdictFraicheur([rouge], MAINTENANT).ok).toBe(false);
  });

  it('juge sur le PLUS RECENT, quel que soit l ordre de la liste', () => {
    const v = verdictFraicheur([vert(1, '2026-10-01T00:00:00Z'), vert(2, '2026-12-09T00:00:00Z')], MAINTENANT);
    expect(v).toMatchObject({ ok: true, dernier: expect.objectContaining({ id: 2 }) });
  });

  it('une date illisible ne vaut pas un vert', () => {
    expect(verdictFraicheur([vert(1, 'pas une date')], MAINTENANT).ok).toBe(false);
  });
});

describe('fraicheur du drill · dans le doute, rouge', () => {
  const reponse = (corps, ok = true, status = 200) => ({ ok, status, json: async () => corps });

  it('jeton ou depot absent : erreur, pas de vert', async () => {
    await expect(lireRuns({ repo: '', jeton: 'x' })).rejects.toThrow(/absent/);
  });

  it('API qui refuse : erreur', async () => {
    const fetcher = async () => reponse({}, false, 403);
    await expect(lireRuns({ repo: 'o/r', jeton: 'x', fetcher })).rejects.toThrow(/403/);
  });

  it('reponse sans workflow_runs : erreur', async () => {
    const fetcher = async () => reponse({ message: 'Not Found' });
    await expect(lireRuns({ repo: 'o/r', jeton: 'x', fetcher })).rejects.toThrow(/illisible/);
  });

  it('lit les jobs de chaque run, et s arrete au premier drill-auto vert', async () => {
    const urls = [];
    const fetcher = async (url) => {
      urls.push(url);
      if (url.includes('/workflows/restore-drill.yml/runs')) {
        expect(url).toMatch(/branch=main&status=success/);
        return reponse({ workflow_runs: [{ id: 10, updated_at: '2026-12-09T00:00:00Z' }, { id: 9, updated_at: '2026-11-09T00:00:00Z' }] });
      }
      return reponse({ jobs: [{ name: JOB, conclusion: 'success' }] });
    };
    const runs = await lireRuns({ repo: 'o/r', jeton: 'x', fetcher });
    expect(runs).toHaveLength(1);
    expect(urls.filter((u) => u.includes('/jobs'))).toHaveLength(1);
  });
});

describe('fraicheur du drill · le workflow et l alerte', () => {
  const wf = readFileSync(resolve('.github/workflows/restore-drill-fraicheur.yml'), 'utf8');
  const alerte = readFileSync(resolve('.github/workflows/ci-alert.yml'), 'utf8');
  const drill = readFileSync(resolve('.github/workflows/restore-drill.yml'), 'utf8');

  it('planifie, et appelle le module', () => {
    expect(wf).toMatch(/schedule:\s*\n(?:\s*#[^\n]*\n)*\s*- cron:/);
    expect(wf).toMatch(/node scripts\/restore-drill\.mjs fraicheur/);
  });

  it('le drill et sa garde d absence sonnent par ci-alert.yml', () => {
    const nom = wf.match(/^name: (.+)$/m)[1];
    expect(alerte).toMatch(new RegExp(`\\n {6}- ${nom}\\n`));
    expect(alerte).toMatch(/\n {6}- restore-drill\n/);
  });

  it('le job surveille porte bien le nom que la garde cherche', () => {
    expect(drill).toMatch(new RegExp(`\\n  ${JOB}:\\n`));
  });

  it('le drill est mensuel', () => {
    expect(drill).toMatch(/- cron: '\d+ \d+ \d+ \* \*'/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// restore-drill.mjs · LE DRILL MENSUEL : LE DERNIER DUMP SE RESTAURE-T-IL ?
//
// Appele par le job `drill-auto` de `.github/workflows/restore-drill.yml`
// (mensuel, ROB-01), apres le `gh run download` des artefacts `db-dump` et
// `db-comptages` d'un MEME run de `db-backup.yml`. Une sauvegarde jamais
// restauree dans sa forme actuelle est une hypothese.
//
// Dans l'ordre ; chaque refus est un exit 1 :
//   1. relit et dechiffre le dump (memes regles que `dump-check.mjs`) ;
//   2. dechiffre le manifeste de comptages ecrit AU MOMENT du dump, dans le
//      meme snapshot (`scripts/sql/comptages-sauvegarde.sql`) ;
//   3. restaure `public` et `auth` dans une STACK SUPABASE locale jetable du
//      runner (Postgres 17, rôles, GoTrue, PostgREST ; PGHOST local impose :
//      jamais la production). Aucune erreur de `pg_restore` n'est attendue ;
//   4. recompte avec la MEME requete et compare au manifeste ;
//   5. rejoue l'isolation par la stack : connexion d'un utilisateur restaure
//      par GoTrue, lecture en `authenticated` (ses seules lignes, en SQL puis
//      par PostgREST) et en `anon` (rien), RPC `get_my_tasks`, profils sans orphelin.
// Le dechiffre est efface en sortie, reussite ou echec.
//
// 🔴 DONNEES PERSONNELLES (depot PUBLIC) : n'en sortent que des NOMS d'objets
//    et des COMPTES. D'une erreur de pg_restore : la premiere ligne du message
//    et de la commande, jamais DETAIL / CONTEXT / HINT ; d'un echec de COPY :
//    la table seule. L'email du compte d'essai ne quitte pas la memoire.
// ❌ Ne prouve PAS : `docs/DEPLOYMENT.md` § 7 (pg_cron, Vault, Edge Functions,
//    Storage, parcours applicatif).
// 🔴 PAS DE SHEBANG (cf. `ops-alert.mjs`) : le temoin importe ce module.
//    Temoin : `scripts/restore-drill.guard.test.mjs`.
// ═══════════════════════════════════════════════════════════════════
import { spawnSync } from 'node:child_process';
import {
  readFileSync, readdirSync, existsSync, rmSync, mkdtempSync, openSync, readSync, closeSync,
} from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { relireDump, RefusDump, verifierChiffre, verdictGpg } from './dump-check.mjs';

export const SQL_COMPTAGES = join(dirname(fileURLToPath(import.meta.url)), 'sql', 'comptages-sauvegarde.sql');

/** Le suffixe du manifeste chiffre que `db-backup.yml` depose. */
export const SUFFIXE_MANIFESTE = '.comptages.tsv.gpg';

// ─── 1 · Le manifeste ──────────────────────────────────────────────

function lister(dossier) {
  if (!existsSync(dossier)) return [];
  const out = [];
  const parcourir = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) parcourir(p);
      else out.push(relative(dossier, p).split('\\').join('/'));
    }
  };
  parcourir(dossier);
  return out.sort();
}

function debut(chemin, n) {
  const fd = openSync(chemin, 'r');
  try {
    const b = Buffer.alloc(n);
    return b.subarray(0, readSync(fd, b, 0, n, 0));
  } finally {
    closeSync(fd);
  }
}

/** Exactement un `*.comptages.tsv.gpg`, rien d'autre (un clair a cote = refus). */
export function classerManifeste(noms) {
  if (noms.length === 0) {
    throw new RefusDump('Artefact db-comptages vide ou absent : sans manifeste, aucun comptage a comparer.');
  }
  const autres = noms.filter((n) => !n.endsWith(SUFFIXE_MANIFESTE));
  if (autres.length > 0) {
    throw new RefusDump(`Artefact db-comptages : fichier(s) non chiffre(s) (${autres.join(', ')}).`);
  }
  if (noms.length !== 1) throw new RefusDump(`Artefact db-comptages : ${noms.length} manifestes, un seul attendu.`);
  return noms[0];
}

/** Dechiffre le manifeste vers un dossier temporaire, rend son texte, efface. */
export function dechiffrerManifeste({ dossier, phrase, executer = spawnSync }) {
  const nom = classerManifeste(lister(dossier));
  const chiffre = join(dossier, nom);
  if (!phrase || phrase.length < 32) {
    throw new RefusDump('Secret BACKUP_PASSPHRASE absent ou trop court : le manifeste ne se dechiffre pas.');
  }
  verifierChiffre(debut(chiffre, 16));
  const tmp = mkdtempSync(join(tmpdir(), 'drill-manifeste-'));
  const sortie = join(tmp, 'comptages.tsv');
  try {
    const g = executer(
      'gpg',
      ['--batch', '--yes', '--pinentry-mode', 'loopback', '--passphrase-fd', '0',
        '--status-fd', '1', '-o', sortie, '-d', chiffre],
      { input: phrase, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 120_000 },
    );
    verdictGpg(g.status, g.stdout, g.error, g.stderr);
    if (!existsSync(sortie)) throw new RefusDump('gpg n a produit aucun manifeste dechiffre.');
    return readFileSync(sortie, 'utf8');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** `genre|nom|valeur`, une ligne par compte. Une ligne illisible = refus : un
 *  manifeste qu'on lit a moitie compare a moitie. Le contenu de la ligne
 *  fautive n'est pas cite. */
export function lireComptages(texte, origine = 'manifeste') {
  const tables = new Map();
  const meta = new Map();
  const lignes = String(texte ?? '').split(/\r?\n/).filter((l) => l.trim() !== '');
  lignes.forEach((l, i) => {
    const m = l.match(/^(table|meta)\|([a-z_][\w.$-]*)\|(\d+)$/i);
    if (!m) throw new RefusDump(`${origine} : ligne ${i + 1} illisible (attendu genre|nom|nombre).`);
    const cible = m[1] === 'table' ? tables : meta;
    if (cible.has(m[2])) throw new RefusDump(`${origine} : ${m[2]} compte deux fois.`);
    cible.set(m[2], Number(m[3]));
  });
  if (![...tables.keys()].some((t) => t.startsWith('public.'))) {
    throw new RefusDump(`${origine} : aucune table du schema public.`);
  }
  for (const k of ['policies_public', 'tables_rls_public']) {
    if (!meta.has(k)) throw new RefusDump(`${origine} : compteur ${k} absent.`);
  }
  return { tables, meta };
}

/** Le temoin : un comptage altere de +1, pour voir le drill rougir. */
export function altererPourTemoin(manifeste, nom = 'public.tasks') {
  const cible = manifeste.tables.has(nom) ? nom : [...manifeste.tables.keys()][0];
  manifeste.tables.set(cible, manifeste.tables.get(cible) + 1);
  return cible;
}

/** Une ligne par table (union des deux cotes) puis par compteur. */
export function comparer(attendu, obtenu) {
  const lignes = [];
  const noms = [...new Set([...attendu.tables.keys(), ...obtenu.tables.keys()])].sort();
  for (const nom of noms) {
    const a = attendu.tables.get(nom);
    const o = obtenu.tables.get(nom);
    lignes.push({ genre: 'table', nom, attendu: a ?? null, obtenu: o ?? null, ok: a !== undefined && a === o });
  }
  for (const nom of [...new Set([...attendu.meta.keys(), ...obtenu.meta.keys()])].sort()) {
    const a = attendu.meta.get(nom);
    const o = obtenu.meta.get(nom);
    lignes.push({ genre: 'meta', nom, attendu: a ?? null, obtenu: o ?? null, ok: a !== undefined && a === o });
  }
  return { lignes, ecarts: lignes.filter((l) => !l.ok) };
}

// ─── 2 · Les erreurs de pg_restore ─────────────────────────────────

/**
 * Decoupe le stderr de pg_restore en erreurs. Ne garde de chacune que la
 * premiere ligne du message et la premiere de la commande : DETAIL, CONTEXT
 * et HINT peuvent citer une valeur de ligne, ils ne sont jamais retenus.
 */
export function decouperErreurs(stderr) {
  const erreurs = [];
  let annoncees = null;
  let courante = null;
  for (const l of String(stderr ?? '').split(/\r?\n/)) {
    const ann = l.match(/^pg_restore: warning: errors ignored on restore: (\d+)$/);
    if (ann) { annoncees = Number(ann[1]); courante = null; continue; }
    const e = l.match(/^pg_restore: error: (.*)$/);
    if (e) {
      const msg = e[1].replace(/^could not execute query: /, '');
      const copie = msg.match(/^COPY failed for table "([^"]+)"/);
      courante = { message: msg.replace(/^ERROR:\s+/, ''), commande: '', table: copie ? copie[1] : null };
      erreurs.push(courante);
      continue;
    }
    if (l.startsWith('pg_restore:')) { courante = null; continue; }
    const c = l.match(/^Command was: (.*)$/);
    if (c && courante && !courante.commande) courante.commande = c[1].trim();
  }
  return { erreurs, annoncees };
}

/** Ce qu'une erreur laisse imprimer : rien d'une valeur de ligne. */
export function libelle({ message, commande, table }) {
  const cmd = String(commande ?? '');
  if (/^COPY\s/i.test(cmd) || table) {
    const t = table ?? cmd.match(/^COPY\s+(\S+)/i)?.[1] ?? '?';
    return `chargement de ${t} en echec (message tu : il peut citer une valeur)`;
  }
  return `${String(message).slice(0, 200)} :: ${cmd.slice(0, 120)}`;
}

/** Verdict sur la restauration : sur une stack Supabase, AUCUNE erreur n'est attendue. */
export function classerErreurs(code, stderr) {
  const { erreurs, annoncees } = decouperErreurs(stderr);
  const bloquantes = erreurs.map(libelle);
  if (code !== 0 && annoncees === null) {
    bloquantes.push(`pg_restore sorti en ${code} sans annoncer de nombre d erreurs : echec hors classement`);
  }
  if (annoncees !== null && annoncees !== erreurs.length) {
    bloquantes.push(`pg_restore annonce ${annoncees} erreur(s), ${erreurs.length} classee(s) : le classement a rate quelque chose`);
  }
  if (code === 0 && erreurs.length > 0) {
    bloquantes.push(`pg_restore sorti en 0 avec ${erreurs.length} erreur(s) au journal : incoherent`);
  }
  return { bloquantes, total: erreurs.length };
}

// ─── 3 · La base jetable ───────────────────────────────────────────

/** Le drill n'ecrit QUE dans le Postgres du runner. */
export function verifierCible(env) {
  const hote = String(env.PGHOST ?? '');
  if (!/^(localhost|127\.0\.0\.1|::1)$/.test(hote)) {
    throw new RefusDump(`Cible ${hote || '(PGHOST vide)'} refusee : le drill ne restaure que dans le Postgres jetable du runner (localhost).`);
  }
  for (const k of ['DATABASE_URL', 'PGSERVICE', 'PGSERVICEFILE']) {
    if (env[k]) throw new RefusDump(`${k} defini : le drill ne suit que PGHOST=localhost.`);
  }
}

// ─── 4 · La stack Supabase : ce qu'un Postgres nu ne prouve pas ─────

const MDP_JETABLE = 'Drill-jetable-0001';

/** Le compte le plus charge (confirme, non banni) recoit un mot de passe connu, puis ses
 *  comptes sont lus en `authenticated`. L'email reste en memoire, jamais imprime. */
export const SQL_STACK = [
  'CREATE TEMP TABLE drill_compte AS',
  '  SELECT u.id, u.email FROM auth.users u',
  '  WHERE u.email IS NOT NULL AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL',
  '    AND (u.banned_until IS NULL OR u.banned_until < now())',
  '  ORDER BY (SELECT count(*) FROM public.tasks t WHERE t.user_id = u.id) DESC, u.id LIMIT 1;',
  `UPDATE auth.users SET encrypted_password = extensions.crypt('${MDP_JETABLE}', extensions.gen_salt('bf'))`,
  '  WHERE id = (SELECT id FROM drill_compte);',
  "SELECT 'users', count(*) FROM auth.users;",
  "SELECT 'total', count(*) FROM public.tasks;",
  "SELECT 'siennes', count(*) FROM public.tasks WHERE user_id = (SELECT id FROM drill_compte);",
  "SELECT 'orphelins', count(*) FROM public.profiles p WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);",
  "SELECT 'email', email FROM drill_compte;",
  'BEGIN;',
  "SELECT 'claims', length(set_config('request.jwt.claims',",
  "  json_build_object('sub', (SELECT id::text FROM drill_compte), 'role', 'authenticated')::text, true)) > 0;",
  'SET LOCAL ROLE authenticated;',
  "SELECT 'visibles', count(*) FROM public.tasks;",
  "SELECT 'rpc', count(*) FROM public.get_my_tasks();",
  'ROLLBACK;',
].join('\n');

/** `--no-owner` : tout appartient a celui qui restaure. GoTrue, qui migre son schema en
 *  `supabase_auth_admin`, doit redevenir proprietaire de `auth`, comme sur un projet neuf. */
export const SQL_PROPRIETAIRE = [
  'DO $$ DECLARE o record; BEGIN',
  "  FOR o IN SELECT format('%s auth.%I', CASE c.relkind WHEN 'v' THEN 'VIEW' WHEN 'm' THEN 'MATERIALIZED VIEW' ELSE 'TABLE' END, c.relname) AS d",
  "    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'auth' AND c.relkind IN ('r', 'p', 'v', 'm')",
  "    UNION ALL SELECT format('FUNCTION %s', p.oid::regprocedure) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'auth'",
  "    UNION ALL SELECT format('TYPE auth.%I', t.typname) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'auth' AND t.typtype = 'e'",
  "  LOOP EXECUTE 'ALTER ' || o.d || ' OWNER TO supabase_auth_admin'; END LOOP;",
  '  ALTER SCHEMA auth OWNER TO supabase_auth_admin;',
  'END $$;',
].join('\n');

const LOCAL_HTTP = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

/** curl, sans rien imprimer : `-w` ajoute le code et l'en-tete content-range apres le corps. */
function http(executer, base, cle, { chemin, jeton = cle, corps = null, compte = false }) {
  const args = ['-sS', '--max-time', '30', '--retry', '20', '--retry-delay', '3', '--retry-all-errors',
    '-w', '\n%{http_code}\n%header{content-range}', '-H', `apikey: ${cle}`, '-H', `Authorization: Bearer ${jeton}`,
    ...(compte ? ['-H', 'Prefer: count=exact', '-H', 'Range-Unit: items', '-H', 'Range: 0-0'] : []),
    ...(corps ? ['-X', 'POST', '-H', 'Content-Type: application/json', '--data-binary', '@-'] : []), `${base}${chemin}`];
  const r = executer('curl', args, { input: corps ?? undefined, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300_000 });
  if (r.error || r.status !== 0) throw new RefusDump(`curl a echoue (code ${r.status ?? r.error?.code}) sur ${chemin.split('?')[0]}`);
  const l = String(r.stdout ?? '').split('\n');
  const range = (l.pop() ?? '').trim();
  const code = Number((l.pop() ?? '').trim());
  return { code, corps: l.join('\n'), lignes: /\/(\d+)$/.test(range) ? Number(range.split('/')[1]) : 0 };
}

/** Verdict sur des mesures deja prises : une faute par preuve manquante. */
export function verdictStack(m) {
  const f = [];
  if (!m.users) f.push('auth.users vide apres restauration');
  if (m.orphelins !== 0) f.push(`${m.orphelins ?? '?'} profil(s) sans utilisateur auth`);
  if (!m.connexion) f.push(`connexion d un utilisateur restaure par l API auth en echec (${m.diag ?? 'sans diagnostic'})`);
  if (m.connexion && m.authentifie !== m.visibles) f.push(`lecture authentifiee : ${m.authentifie ?? '?'} taches par l API, ${m.visibles ?? '?'} sous RLS`);
  if (m.connexion && !(m.authentifie > 0)) f.push('lecture authentifiee : aucune tache visible pour le compte le plus charge');
  if (!m.total) f.push('aucune tache restauree : isolation non demontrable');
  if (m.visibles !== m.siennes) f.push(`un utilisateur voit ${m.visibles ?? '?'} taches pour ${m.siennes ?? '?'} a lui : l isolation n est PAS revenue`);
  if (m.anon !== 0) f.push(`anon voit ${m.anon ?? '?'} taches`);
  if (m.connexion && (m.rpc !== m.rpcAttendu || !(m.rpc > 0))) f.push(`RPC get_my_tasks : ${m.rpc ?? '?'} lignes, ${m.rpcAttendu ?? '?'} attendues`);
  return f;
}

/** Les preuves qui exigent GoTrue et PostgREST sur la base restauree. Des comptes, jamais une valeur. */
export function preuvesStack(executer, env) {
  const base = String(env.API_URL ?? '');
  const cle = String(env.ANON_KEY ?? '');
  if (!LOCAL_HTTP.test(base) || !cle) throw new RefusDump('API_URL (locale) ou ANON_KEY absente : la stack Supabase jetable est introuvable.');
  psql(executer, { sql: SQL_PROPRIETAIRE });
  const v = {};
  for (const l of psql(executer, { sql: SQL_STACK }).split(/\r?\n/)) {
    const n = l.match(/^(users|orphelins|total|siennes|visibles|rpc)\|(\d+)$/);
    if (n) v[n[1]] = Number(n[2]);
    const e = l.match(/^email\|(.+)$/);
    if (e) v.email = e[1];
  }
  // La base a ete remplacee sous les services : caches (OID, schema) a vider.
  const r = executer('docker', ['restart', 'supabase_auth_cosmo', 'supabase_rest_cosmo', 'supabase_kong_cosmo'], { encoding: 'utf8', timeout: 180_000 });
  if (r.error || r.status !== 0) throw new RefusDump('docker restart des services auth et rest en echec.');
  const m = { diag: 'aucun compte connectable', users: v.users, orphelins: v.orphelins, total: v.total, siennes: v.siennes, visibles: v.visibles, rpcAttendu: v.rpc, connexion: false };
  if (v.email) {
    const t = http(executer, base, cle, {
      chemin: '/auth/v1/token?grant_type=password', corps: JSON.stringify({ email: v.email, password: MDP_JETABLE }),
    });
    let jeton = null;
    let code = '';
    try {
      const j = JSON.parse(t.corps);
      jeton = j.access_token ?? null;
      code = /^[a-z_]{1,40}$/.test(j.error_code ?? '') ? j.error_code : '';
    } catch { /* corps illisible : pas de jeton */ }
    m.diag = `HTTP ${t.code} ${code}`.trim();
    m.connexion = t.code === 200 && typeof jeton === 'string';
    if (m.connexion) {
      m.authentifie = http(executer, base, cle, { chemin: '/rest/v1/tasks?select=id', jeton, compte: true }).lignes;
      m.rpc = http(executer, base, cle, { chemin: '/rest/v1/rpc/get_my_tasks', jeton, corps: '{}', compte: true }).lignes;
    }
  }
  const a = http(executer, base, cle, { chemin: '/rest/v1/tasks?select=id', compte: true });
  m.anon = a.code >= 200 && a.code < 300 ? a.lignes : 0;
  return { mesures: { ...m, anonCode: a.code }, fautes: verdictStack(m) };
}

// ─── 5 · Le drill ──────────────────────────────────────────────────

const PSQL = ['-X', '-q', '-tA', '-F', '|', '-v', 'ON_ERROR_STOP=1'];

/** `sql` passe par stdin (`-f -`) : avec `-c`, psql n'imprime que le
 *  resultat de la DERNIERE commande, et les trois comptes de l'isolation
 *  seraient perdus. */
function psql(executer, { sql = null, fichier = null }) {
  const r = executer('psql', [...PSQL, '-f', fichier ?? '-'], {
    input: sql ?? undefined, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 600_000,
  });
  if (r.error || r.status !== 0) {
    // stderr de psql : messages du serveur sur NOS requetes (comptes, roles),
    // jamais une ligne de table. Premiere ligne seulement.
    const pourquoi = String(r.stderr ?? r.error?.message ?? '').trim().split('\n')[0];
    throw new RefusDump(`psql a echoue (code ${r.status ?? r.error?.code}) : ${pourquoi}`);
  }
  return String(r.stdout ?? '');
}

/**
 * Le drill complet. Rend `{ exit, lines, resume }` sans sortir lui-meme, pour
 * que le temoin l'execute. `executer` est `spawnSync` en production.
 */
export function drill({
  dossierDump, dossierManifeste, phrase, env = process.env, temoin = false, perteAuth = false,
  executer = spawnSync, horloge = () => Date.now(),
}) {
  const t0 = horloge();
  const lines = [];
  const resume = {
    fichier: null, taille: null, objets: null, serveur: null, dureeRestauration: null, dureeTotale: null,
    erreurs: null, bloquantes: [], comparaison: null,
    temoin: null, stack: null, verdict: null,
  };
  let clair = null;
  try {
    verifierCible(env);
    const d = relireDump({ dossier: dossierDump, phrase, executer, conserver: true });
    for (const l of d.lines) lines.push(l);
    if (d.exit !== 0) {
      // `d.lines` porte deja le `::error` : ne pas le dire deux fois.
      resume.verdict = d.resume.verdict;
      return { exit: 1, lines, resume };
    }
    clair = d.clair;
    resume.fichier = d.resume.fichier;
    resume.taille = d.resume.taille;
    resume.objets = d.resume.objets;

    const manifeste = lireComptages(dechiffrerManifeste({ dossier: dossierManifeste, phrase, executer }));
    if (temoin) {
      resume.temoin = altererPourTemoin(manifeste);
      lines.push(`::warning title=drill::TEMOIN : le comptage de ${resume.temoin} est altere (+1) dans le manifeste. Le drill DOIT rougir.`);
    }

    // Meme majeure que la production : un drill sur une 16 ou une 18 ne dit
    // rien de la restauration qu'on ferait le jour d'un sinistre.
    const version = Number(psql(executer, { sql: 'SHOW server_version_num;' }).trim());
    resume.serveur = version;
    if (!(version >= 170000 && version < 180000)) {
      throw new RefusDump(`Postgres jetable en version ${version || 'illisible'} : la production est en 17.`);
    }

    const t1 = horloge();
    // `--clean --if-exists` : la stack a deja ses tables auth et storage, comme un projet neuf.
    // Deux schemas : les extensions et `storage` (version propre a la stack) ne se rejouent pas.
    const r = executer('pg_restore', ['--no-owner', '--clean', '--if-exists', '-n', 'public', '-n', 'auth',
      '--dbname', env.PGDATABASE ?? 'postgres', clair], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 1_800_000,
    });
    resume.dureeRestauration = Math.round((horloge() - t1) / 1000);
    if (r.error) throw new RefusDump(`pg_restore n a pas pu etre lance (${r.error.code ?? r.error.message}).`);
    const c = classerErreurs(r.status, r.stderr);
    resume.erreurs = c.total;
    resume.bloquantes = c.bloquantes;

    if (perteAuth) {
      psql(executer, { sql: 'TRUNCATE auth.users CASCADE;' });
      lines.push('::warning title=drill::TEMOIN : auth.users videe apres la restauration. Le drill DOIT rougir.');
    }
    const obtenu = lireComptages(psql(executer, { fichier: SQL_COMPTAGES }), 'base restauree');
    resume.comparaison = comparer(manifeste, obtenu);
    let stack;
    try {
      stack = preuvesStack(executer, env);
    } catch (e) {
      if (!(e instanceof RefusDump)) throw e;
      stack = { mesures: null, fautes: [e.message] };
    }
    resume.stack = stack.mesures;

    const fautes = [
      ...c.bloquantes.map((b) => `erreur de restauration : ${b}`),
      ...resume.comparaison.ecarts.map((e) => `ecart ${e.nom} : manifeste ${e.attendu ?? 'absent'}, restaure ${e.obtenu ?? 'absent'}`),
      ...stack.fautes.map((f) => `stack : ${f}`),
    ];
    if (fautes.length > 0) {
      for (const f of fautes.slice(0, 40)) lines.push(`::error title=drill::${f}`);
      throw new RefusDump(`${fautes.length} faute(s) : la restauration ne rend pas la base du dump.`);
    }
    const nbTables = resume.comparaison.lignes.filter((l) => l.genre === 'table').length;
    resume.verdict = 'ok';
    lines.push(
      `::notice title=drill::Dump restaure en ${resume.dureeRestauration} s : ${nbTables} tables, `
        + 'comptages identiques au manifeste, isolation effective.',
    );
    return { exit: 0, lines, resume };
  } catch (e) {
    if (!(e instanceof RefusDump)) throw e;
    resume.verdict = e.message;
    lines.push(`::error title=drill::${e.message}`);
    return { exit: 1, lines, resume };
  } finally {
    if (clair) rmSync(clair, { force: true });
    resume.dureeTotale = Math.round((horloge() - t0) / 1000);
  }
}

/** Le resume de job, en Markdown : des noms et des comptes, rien d'autre. */
export function resumeMarkdown(resume, runId, aujourdhui = new Date().toISOString().slice(0, 10)) {
  const tic = '`';
  const out = [`## Drill de restauration automatique · ${aujourdhui} (UTC)`, ''];
  if (resume.temoin) {
    out.push(`> ⚠️ **RUN TEMOIN** : le comptage de ${tic}${resume.temoin}${tic} a ete altere (+1). Ce run DOIT etre rouge.`, '');
  }
  const k = resume.stack;
  const stack = k
    ? `${k.users ?? '?'} comptes auth, ${k.orphelins ?? '?'} profils orphelins, connexion ${k.connexion ? 'ok' : 'EN ECHEC'}, ${k.visibles ?? '?'} taches sur ${k.total ?? '?'} visibles de ses ${k.siennes ?? '?'} (${k.authentifie ?? '?'} par l API), ${k.anon ?? '?'} en anon, RPC ${k.rpc ?? '?'}/${k.rpcAttendu ?? '?'}`
    : '?';
  const verdict = resume.verdict === 'ok'
    ? '✅ restaure, comptages identiques au manifeste'
    : `❌ ${String(resume.verdict).replace(/\|/g, '/')}`;
  out.push(
    '| Mesure | Valeur |',
    '|---|---|',
    `| Run db-backup | ${tic}${runId ?? '?'}${tic} |`,
    `| Dump | ${resume.fichier ?? '?'} · ${resume.taille ?? '?'} octets en clair (efface) · ${resume.objets ?? '?'} objets |`,
    `| Duree de la restauration | **${resume.dureeRestauration ?? '?'} s** (drill complet : ${resume.dureeTotale ?? '?'} s) |`,
    `| Erreurs pg_restore | ${resume.erreurs ?? '?'} (attendu 0), dont ${resume.bloquantes.length} bloquantes |`,
    `| Stack Supabase | ${stack} |`,
    `| Verdict | ${verdict} |`,
    '',
  );
  if (resume.comparaison) {
    out.push('### Comptages : manifeste ecrit au dump, base restauree', '');
    out.push('| Table ou compteur | Manifeste | Restaure | |', '|---|---:|---:|---|');
    for (const l of resume.comparaison.lignes) {
      out.push(`| ${tic}${l.nom}${tic} | ${l.attendu ?? 'absent'} | ${l.obtenu ?? 'absent'} | ${l.ok ? '✅' : '❌'} |`);
    }
    out.push('');
  }
  if (resume.bloquantes.length) {
    out.push('### Erreurs bloquantes', '');
    for (const b of resume.bloquantes.slice(0, 40)) out.push(`- ${b}`);
    out.push('');
  }
  out.push(`Ne prouve pas : pg_cron, Vault, pg_net, Edge Functions, Storage, parcours applicatif (${tic}docs/DEPLOYMENT.md${tic} § 7).`, '');
  return out.join('\n');
}

// ── Garde d absence (ROB-01) : un drill vert de moins de 35 jours ? ──
// Appelee par `.github/workflows/restore-drill-fraicheur.yml` (`node scripts/restore-drill.mjs fraicheur`),
// volontairement HORS de `restore-drill.yml` : une garde logee dans le fichier qu elle surveille se tait
// le jour ou il ne tourne plus. Dans le doute elle rougit (API en panne, jeton refuse = exit 1).
export const JOURS_MAX = 35;
export const JOB = 'drill-auto';
const JOUR_MS = 86_400_000;

/**
 * Le verdict, sur des runs DEJA lus : `[{ id, date, jobs: [{ name, conclusion }] }]`.
 * Rend `{ ok, dernier, ageJours, message }`.
 */
export function verdictFraicheur(runs, maintenant = new Date(), joursMax = JOURS_MAX) {
  const verts = (runs ?? [])
    .filter((r) => (r.jobs ?? []).some((j) => j.name === JOB && j.conclusion === 'success'))
    .map((r) => ({ id: r.id, t: Date.parse(r.date) }))
    .filter((r) => Number.isFinite(r.t))
    .sort((a, b) => b.t - a.t);
  if (verts.length === 0) {
    return {
      ok: false, dernier: null, ageJours: null,
      message: `Aucun drill de restauration vert (job ${JOB}) sur main dans l historique lu : la seule sauvegarde n est pas eprouvee.`,
    };
  }
  const d = verts[0];
  const ageJours = Math.floor((maintenant.getTime() - d.t) / JOUR_MS);
  const quand = new Date(d.t).toISOString().slice(0, 10);
  if (ageJours > joursMax) {
    return {
      ok: false, dernier: d, ageJours,
      message: `Dernier drill de restauration vert le ${quand} (run ${d.id}), il y a ${ageJours} jours, au-dela de ${joursMax} : le drill mensuel ne tourne plus, ou ne passe plus.`,
    };
  }
  return { ok: true, dernier: d, ageJours, message: `Dernier drill vert le ${quand} (run ${d.id}), il y a ${ageJours} jour(s).` };
}

/** Lit les runs reussis de `restore-drill.yml` sur main, et leurs jobs. */
export async function lireRuns({ repo, jeton, fetcher = fetch, limite = 30 }) {
  if (!repo || !jeton) throw new Error('REPO ou GH_TOKEN absent : historique illisible.');
  const entetes = { authorization: `Bearer ${jeton}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' };
  const lire = async (url) => {
    const r = await fetcher(url, { headers: entetes });
    if (!r.ok) throw new Error(`API GitHub ${r.status} sur ${url.replace(/\?.*$/, '')}`);
    return r.json();
  };
  const base = `https://api.github.com/repos/${repo}/actions`;
  const liste = await lire(`${base}/workflows/restore-drill.yml/runs?branch=main&status=success&per_page=${limite}`);
  if (!Array.isArray(liste?.workflow_runs)) throw new Error('Reponse de l API illisible (workflow_runs absent).');
  const runs = [];
  for (const run of liste.workflow_runs) {
    const j = await lire(`${base}/runs/${run.id}/jobs?per_page=50`);
    if (!Array.isArray(j?.jobs)) throw new Error(`Jobs du run ${run.id} illisibles.`);
    runs.push({
      id: run.id,
      date: run.updated_at ?? run.created_at,
      jobs: j.jobs.map((x) => ({ name: x.name, conclusion: x.conclusion })),
    });
    // Le plus recent qui porte un drill-auto vert suffit : la liste est triee.
    if (runs.at(-1).jobs.some((x) => x.name === JOB && x.conclusion === 'success')) break;
  }
  return runs;
}

// Entree CLI. `import.meta.main` n'existe pas en Node 20 : on compare argv.
if (process.argv[1] && process.argv[1].endsWith('restore-drill.mjs') && process.argv[2] === 'fraicheur') {
  let code = 1;
  try {
    const v = verdictFraicheur(await lireRuns({ repo: process.env.REPO, jeton: process.env.GH_TOKEN }));
    console.log(v.ok ? `::notice title=fraicheur du drill::${v.message}` : `::error title=fraicheur du drill::${v.message}`);
    code = v.ok ? 0 : 1;
  } catch (e) {
    console.log(`::error title=fraicheur du drill::Historique illisible, donc rouge : ${e.message}`);
  }
  process.exit(code);
} else if (process.argv[1] && process.argv[1].endsWith('restore-drill.mjs')) {
  const { appendFileSync } = await import('node:fs');
  const { exit, lines, resume } = drill({
    dossierDump: process.argv[2] ?? 'dump',
    dossierManifeste: process.argv[3] ?? 'comptages',
    phrase: process.env.BACKUP_PASSPHRASE,
    temoin: process.env.TEMOIN === 'true',
    perteAuth: process.env.PERTE_AUTH === 'true',
  });
  for (const l of lines) console.log(l);
  const md = resumeMarkdown(resume, process.env.RUN_ID);
  // Le MEME resume au journal, replie : le resume de job ne se lit qu'en
  // session GitHub, le journal se relit aussi par l'API (`gh run view --log`).
  // Des noms de tables et des comptes, rien d'autre.
  console.log('::group::Resume du drill (comptages par table)');
  console.log(md);
  console.log('::endgroup::');
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  process.exit(exit);
}

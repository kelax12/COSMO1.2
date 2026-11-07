// ═══════════════════════════════════════════════════════════════════
// restore-drill.mjs · LE DRILL MENSUEL : LE DERNIER DUMP SE RESTAURE-T-IL ?
//
// Appele par le job `drill-auto` de `.github/workflows/restore-drill.yml`
// (mensuel, ROB-01, vague 4.4), apres le `gh run download` des artefacts
// `db-dump` et `db-comptages` d'un MEME run de `db-backup.yml`.
//
// 🔴 POURQUOI CE DRILL EXISTE (audit externe du 2026-11-06, ROB-01)
//
// Plan Free, pas de PITR : le dump quotidien chiffre est la SEULE copie de la
// base. Jusqu'ici, rien d'automatique ne le restaurait : `dump-check` lisait
// une table des matieres (`pg_restore --list`), pas une ligne, et le vrai
// drill exigeait un projet jetable, une confirmation tapee et un secret qui
// n'existe que ce jour-la. Dernier drill reussi : 2026-09-01. Une sauvegarde
// jamais restauree dans sa forme actuelle est une hypothese.
//
// CE QUE FAIT CE MODULE, dans l'ordre ; chaque refus est un exit 1 :
//   1. relit et dechiffre le dump (memes regles que `dump-check.mjs`) ;
//   2. dechiffre le manifeste de comptages ecrit AU MOMENT du dump, dans le
//      meme snapshot (`scripts/sql/comptages-sauvegarde.sql`) ;
//   3. cree les roles Supabase dans un Postgres 17 JETABLE du runner
//      (service container, `localhost` impose : jamais la production) ;
//   4. restaure avec `pg_restore`, et classe CHAQUE erreur : seules sont
//      tolerees celles d'une extension propre a Supabase absente de l'image
//      Postgres officielle (liste fermee ci-dessous), et jamais sur un objet
//      de `public` ou de `auth` ; le nombre d'erreurs classees doit egaler
//      celui que pg_restore annonce, sinon le classement a rate quelque chose ;
//   5. recompte avec la MEME requete, et compare au manifeste : une table de
//      plus, de moins, ou une ligne d'ecart = echec ;
//   6. rejoue l'isolation : le role `authenticated`, avec les claims d'un vrai
//      proprietaire, ne voit que ses taches.
// Le dechiffre est efface en sortie, reussite ou echec.
//
// 🔴 DONNEES PERSONNELLES. Le journal et le resume d'un depot PUBLIC se lisent
//    par tous. N'en sortent que des NOMS d'objets et des COMPTES. Des erreurs
//    de pg_restore ne sont imprimes que la premiere ligne du message et celle
//    de la commande ; les lignes DETAIL / CONTEXT / HINT, qui peuvent citer
//    une valeur, ne sont jamais lues, et un echec de COPY n'imprime que la
//    table, jamais le message.
// ❌ Ne prouve PAS : cf. `docs/DEPLOYMENT.md` § 7 (pg_cron, Vault, Edge
//    Functions, Storage, parcours applicatif).
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

/** Roles qu'un dump Supabase cite (GRANT, policies, ALTER DEFAULT PRIVILEGES).
 *  pg_dump ne les porte pas : ce sont des objets du cluster, pas de la base. */
export const ROLES_SUPABASE = [
  'anon', 'authenticated', 'service_role', 'authenticator', 'supabase_admin',
  'supabase_auth_admin', 'supabase_storage_admin', 'supabase_realtime_admin',
  'supabase_replication_admin', 'supabase_read_only_user', 'supabase_functions_admin',
  'supabase_etl_admin', 'dashboard_user', 'pgbouncer',
  'pgsodium_keyholder', 'pgsodium_keyiduser', 'pgsodium_keymaker',
];

/** Extensions propres a Supabase, ABSENTES de l'image `postgres:17` officielle,
 *  et le schema qu'elles possedent. Liste FERMEE : une erreur qui cite une
 *  autre extension est bloquante. ❌ Ne pas l'allonger pour faire passer un
 *  drill : une entree dit qu'une partie de la base n'est PAS restauree. */
export const EXTENSIONS_ABSENTES = {
  pg_graphql: 'graphql',
  pg_net: 'net',
  supabase_vault: 'vault',
  pgsodium: 'pgsodium',
  pg_cron: 'cron',
  pgjwt: null,
};
const SCHEMAS_ABSENTS = new Set(Object.values(EXTENSIONS_ABSENTES).filter(Boolean));

/** Schemas dont aucun objet ne peut etre perdu en silence. */
const SCHEMAS_PROTEGES = /(?:^|[\s("',])"?(?:public|auth)"?\./;

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

/** Une erreur est-elle celle d'une extension Supabase absente, hors public/auth ? */
export function raisonTolerance({ message, commande, table }) {
  const cmd = String(commande ?? '');
  const copie = /^COPY\s/i.test(cmd) || table != null;
  if (SCHEMAS_PROTEGES.test(cmd) || (table && /^(public|auth)\./.test(table))) return null;
  if (copie) {
    const s = cmd.match(/^COPY\s+"?([a-z_]\w*)"?\./i)?.[1];
    return s && SCHEMAS_ABSENTS.has(s) ? `donnees du schema ${s} (extension absente)` : null;
  }
  const ext = String(message).match(/extension "([^"]+)"/)?.[1];
  if (ext) return ext in EXTENSIONS_ABSENTES ? `extension ${ext} absente de postgres:17` : null;
  // Une signature de fonction porte des espaces (`f(bytea, bigint)`) : elle a
  // son motif. Vu sur le premier drill reel, le 2026-11-07 (Vault).
  const schema = String(message).match(/schema "([^"]+)" does not exist/)?.[1]
    ?? String(message).match(/(?:relation|type|operator|table) "?([a-z_]\w*)\.[^\s"]+"? does not exist/i)?.[1]
    ?? String(message).match(/^function ([a-z_]\w*)\.\w+\([^)]*\) does not exist/i)?.[1]
    ?? null;
  if (schema && SCHEMAS_ABSENTS.has(schema)) return `objet du schema ${schema} (extension absente)`;
  return null;
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

/** Verdict sur la restauration : bloquantes, tolerees, et coherence du compte. */
export function classerErreurs(code, stderr) {
  const { erreurs, annoncees } = decouperErreurs(stderr);
  const bloquantes = [];
  const tolerees = [];
  for (const e of erreurs) {
    const r = raisonTolerance(e);
    if (r) tolerees.push({ raison: r, libelle: libelle(e) });
    else bloquantes.push(libelle(e));
  }
  if (code !== 0 && annoncees === null) {
    bloquantes.push(`pg_restore sorti en ${code} sans annoncer de nombre d erreurs : echec hors classement`);
  }
  if (annoncees !== null && annoncees !== erreurs.length) {
    bloquantes.push(`pg_restore annonce ${annoncees} erreur(s), ${erreurs.length} classee(s) : le classement a rate quelque chose`);
  }
  if (code === 0 && erreurs.length > 0) {
    bloquantes.push(`pg_restore sorti en 0 avec ${erreurs.length} erreur(s) au journal : incoherent`);
  }
  return { bloquantes, tolerees, total: erreurs.length };
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

export function sqlRoles(roles = ROLES_SUPABASE) {
  const liste = roles.map((r) => `'${r}'`).join(', ');
  return [
    'DO $$ DECLARE r text; BEGIN',
    `  FOREACH r IN ARRAY ARRAY[${liste}] LOOP`,
    '    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN',
    "      EXECUTE format('CREATE ROLE %I NOLOGIN', r);",
    '    END IF;',
    '  END LOOP;',
    'END $$;',
    // Le seul role qui contourne la RLS chez Supabase. `authenticated` et
    // `anon` ne la contournent pas : c'est ce que le controle d'isolation teste.
    'ALTER ROLE service_role BYPASSRLS;',
  ].join('\n');
}

/** L'isolation EFFECTIVE : le proprietaire le plus charge, place dans le role
 *  `authenticated` avec ses claims, ne doit voir que ses taches. L'identifiant
 *  reste dans une table temporaire : il n'est jamais imprime. */
export const SQL_ISOLATION = [
  "SELECT 'total', count(*) FROM public.tasks;",
  'CREATE TEMP TABLE drill_cible AS',
  '  SELECT user_id FROM public.tasks GROUP BY user_id ORDER BY count(*) DESC, user_id LIMIT 1;',
  "SELECT 'siennes', count(*) FROM public.tasks WHERE user_id = (SELECT user_id FROM drill_cible);",
  'BEGIN;',
  "SELECT 'claims', length(set_config('request.jwt.claims',",
  "  json_build_object('sub', (SELECT user_id::text FROM drill_cible), 'role', 'authenticated')::text, true)) > 0;",
  'SET LOCAL ROLE authenticated;',
  "SELECT 'visibles', count(*) FROM public.tasks;",
  'ROLLBACK;',
].join('\n');

export function verdictIsolation(texte) {
  const v = {};
  for (const l of String(texte ?? '').split(/\r?\n/)) {
    const m = l.match(/^(total|siennes|visibles)\|(\d+)$/);
    if (m) v[m[1]] = Number(m[2]);
  }
  if (v.total === undefined || v.siennes === undefined || v.visibles === undefined) {
    return { ...v, ok: false, raison: 'controle d isolation illisible (un des trois comptes manque)' };
  }
  if (v.total === 0) return { ...v, ok: false, raison: 'aucune tache restauree : isolation non demontrable' };
  if (v.visibles !== v.siennes) {
    return { ...v, ok: false, raison: `un utilisateur voit ${v.visibles} taches pour ${v.siennes} a lui : l isolation n est PAS revenue` };
  }
  if (v.siennes === v.total) return { ...v, ok: true, raison: 'un seul proprietaire : isolation non discriminante' };
  return { ...v, ok: true, raison: 'ne voit que les siennes' };
}

// ─── 4 · Le drill ──────────────────────────────────────────────────

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
  dossierDump, dossierManifeste, phrase, env = process.env, temoin = false,
  executer = spawnSync, horloge = () => Date.now(),
}) {
  const t0 = horloge();
  const lines = [];
  const resume = {
    fichier: null, taille: null, objets: null, serveur: null, dureeRestauration: null, dureeTotale: null,
    erreurs: null, tolerees: [], bloquantes: [], comparaison: null, isolation: null,
    temoin: null, verdict: null,
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

    psql(executer, { sql: sqlRoles() });

    const t1 = horloge();
    const r = executer('pg_restore', ['--no-owner', '--dbname', env.PGDATABASE ?? 'drill', clair], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 1_800_000,
    });
    resume.dureeRestauration = Math.round((horloge() - t1) / 1000);
    if (r.error) throw new RefusDump(`pg_restore n a pas pu etre lance (${r.error.code ?? r.error.message}).`);
    const c = classerErreurs(r.status, r.stderr);
    resume.erreurs = c.total;
    resume.tolerees = c.tolerees;
    resume.bloquantes = c.bloquantes;

    const obtenu = lireComptages(psql(executer, { fichier: SQL_COMPTAGES }), 'base restauree');
    resume.comparaison = comparer(manifeste, obtenu);
    resume.isolation = verdictIsolation(psql(executer, { sql: SQL_ISOLATION }));

    const fautes = [
      ...c.bloquantes.map((b) => `erreur de restauration : ${b}`),
      ...resume.comparaison.ecarts.map((e) => `ecart ${e.nom} : manifeste ${e.attendu ?? 'absent'}, restaure ${e.obtenu ?? 'absent'}`),
      ...(resume.isolation.ok ? [] : [`isolation : ${resume.isolation.raison}`]),
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
  const iso = resume.isolation;
  const tic = '`';
  const out = [`## Drill de restauration automatique · ${aujourdhui} (UTC)`, ''];
  if (resume.temoin) {
    out.push(`> ⚠️ **RUN TEMOIN** : le comptage de ${tic}${resume.temoin}${tic} a ete altere (+1). Ce run DOIT etre rouge.`, '');
  }
  const isolation = iso
    ? `${iso.visibles ?? '?'} taches visibles pour ${iso.siennes ?? '?'} a lui, sur ${iso.total ?? '?'} : ${iso.raison}`
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
    `| Erreurs pg_restore | ${resume.erreurs ?? '?'}, dont ${resume.tolerees.length} tolerees (extensions Supabase absentes) et ${resume.bloquantes.length} bloquantes |`,
    `| Isolation | ${isolation} |`,
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
  if (resume.tolerees.length) {
    const parRaison = new Map();
    for (const t of resume.tolerees) parRaison.set(t.raison, (parRaison.get(t.raison) ?? 0) + 1);
    out.push('### Erreurs tolerees (non restaure, et dit)', '');
    for (const [r, n] of parRaison) out.push(`- ${r} : ${n}`);
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

// Entree CLI. `import.meta.main` n'existe pas en Node 20 : on compare argv.
if (process.argv[1] && process.argv[1].endsWith('restore-drill.mjs')) {
  const { appendFileSync } = await import('node:fs');
  const { exit, lines, resume } = drill({
    dossierDump: process.argv[2] ?? 'dump',
    dossierManifeste: process.argv[3] ?? 'comptages',
    phrase: process.env.BACKUP_PASSPHRASE,
    temoin: process.env.TEMOIN === 'true',
  });
  for (const l of lines) console.log(l);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, resumeMarkdown(resume, process.env.RUN_ID));
  }
  process.exit(exit);
}

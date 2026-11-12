// ═══════════════════════════════════════════════════════════════════
// contrat-donnees.mjs · LE SCHEMA VIVANT, LU DEPUIS LE DEPOT (MAI-01, API-01, ARC-07)
//
// Trois constats de l'audit du 2026-11-06, une seule source :
//   · MAI-01 : 217 migrations, environ 250 fonctions dont 93 redefinies
//     jusqu'a six fois, aucun instantane. Le schema vivant ne se lisait pas
//     depuis le depot.
//   · API-01 : aucun inventaire des fonctions exposees a `anon` et
//     `authenticated`.
//   · ARC-07 : aucun type genere depuis le schema. Les mappers sont ecrits a
//     la main, donc un renommage de colonne cassait le client sans erreur de
//     compilation.
//
// La source est la base FRAICHE du job `contrat-donnees` de `CI noyau` : une
// stack Supabase locale vierge, toutes les migrations rejouees par
// `scripts/apply-migrations.mjs`. Trois fichiers sont derives de cette base et
// COMMITES :
//   · supabase/schema.sql              `pg_dump --schema-only`, normalise ;
//   · supabase/rpc-inventory.md        fonctions, droits, appelants du front ;
//   · src/generated/database.types.ts `supabase gen types typescript`.
// La CI regenere les trois et ECHOUE si l'un diverge du fichier commite.
//
// Deux modes :
//   node scripts/contrat-donnees.mjs --ecrire     ecrit les trois fichiers ;
//   node scripts/contrat-donnees.mjs --verifier [--sortie <dossier>]
//                                                 compare, sort en 1 si ecart.
//
// Entrees (la base doit etre celle d'une stack locale ou toutes les
// migrations ont ete rejouees) :
//   DATABASE_URL     defaut postgresql://postgres:postgres@127.0.0.1:54322/postgres
//   COSMO_PG_DUMP    commande pg_dump, defaut `docker exec supabase_db_<project_id> pg_dump ...`
//   COSMO_GEN_TYPES  commande de types, defaut `supabase gen types typescript --local --schema public`
//
// ⚠️ Les appelants du front sont cherches par TEXTE (`rpc('nom'`) dans src/,
// supabase/functions/ et api/, tests exclus. Un appel par constante ou depuis
// SQL (une fonction qui en appelle une autre, une policy, un trigger) n'est
// pas vu : une reference par chaine est signalee `~`, le reste l'est pas.
// ⚠️ Pas de shebang : le temoin importe ce module (cf. `scripts/CLAUDE.md`).
// ═══════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, sep } from 'node:path';

export const CHEMINS = {
  schema: 'supabase/schema.sql',
  inventaire: 'supabase/rpc-inventory.md',
  types: 'src/generated/database.types.ts',
};

/** Les dossiers ou l'on cherche des appels `rpc('nom'`. */
export const DOSSIERS_APPELANTS = ['src', 'supabase/functions', 'api'];

const REGENERER = 'npm run contrat:generer (Docker, supabase start, node scripts/apply-migrations.mjs) '
  + 'ou copier les fichiers de l\'artefact `contrat-donnees` du job CI';

// ─── pg_dump ────────────────────────────────────────────────────────

/**
 * Rend un `pg_dump` comparable d'un run a l'autre : retire ce qui varie sans
 * que le schema change (version du serveur et de l'outil, jeton `\restrict`
 * des versions recentes de pg_dump, fins de ligne, lignes vides en rafale).
 */
export function normaliserDump(brut) {
  const lignes = String(brut)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => !/^-- Dumped (from|by) /.test(l))
    .filter((l) => !/^\\(un)?restrict(\s|$)/.test(l))
    .map((l) => l.replace(/[ \t]+$/, ''));
  const sortie = [];
  let vides = 0;
  for (const l of lignes) {
    if (l === '') {
      vides += 1;
      if (vides > 2) continue;
    } else {
      vides = 0;
    }
    sortie.push(l);
  }
  return sortie.join('\n').replace(/^\n+/, '').replace(/\n+$/, '') + '\n';
}

const ENTETE_SCHEMA = [
  '-- GENERE par scripts/contrat-donnees.mjs. NE PAS EDITER A LA MAIN.',
  '-- Instantane du schema `public` d\'une base vierge sur laquelle toutes les migrations de',
  '-- supabase/migration/ ont ete rejouees (pg_dump --schema-only, normalise), suivi des objets',
  '-- poses hors `public` par ces migrations. La CI echoue si ce fichier diverge.',
  `-- Regenerer : ${REGENERER}.`,
  '',
].join('\n');

const guillemets = (s) => `'${String(s).replace(/'/g, "''")}'`;
const ident = (s) => `"${String(s).replace(/"/g, '""')}"`;

/**
 * Les objets que `pg_dump --schema=public` ne voit pas : les migrations posent
 * des triggers sur `auth.users`, des policies sur `storage.objects`, des
 * buckets et des taches `pg_cron`. Rendus en texte stable a partir du
 * catalogue (aucun identifiant interne, aucun jobid).
 */
export function rendreComplements({ triggers, policies, buckets, cron }) {
  const out = ['-- ─── Objets poses hors du schema `public` par les migrations ───', ''];
  out.push('-- Triggers hors `public` qui appellent une fonction de `public`', '');
  for (const t of triggers) out.push(`${t.def};`);
  if (triggers.length === 0) out.push('-- (aucun)');
  out.push('', '-- Policies hors `public`', '');
  for (const p of policies) {
    const roles = (p.roles ?? []).join(', ') || 'public';
    out.push(
      `CREATE POLICY ${ident(p.policyname)} ON ${ident(p.schemaname)}.${ident(p.tablename)}`
      + ` AS ${p.permissive} FOR ${p.cmd} TO ${roles}`
      + `${p.qual ? ` USING (${p.qual})` : ''}${p.with_check ? ` WITH CHECK (${p.with_check})` : ''};`,
    );
  }
  if (policies.length === 0) out.push('-- (aucune)');
  out.push('', '-- storage.buckets (id, public, file_size_limit, allowed_mime_types)', '');
  for (const b of buckets) {
    out.push(`-- ${b.id} | public=${b.public} | limit=${b.file_size_limit ?? 'null'} | mime=${(b.allowed_mime_types ?? []).join(',') || 'null'}`);
  }
  if (buckets.length === 0) out.push('-- (aucun)');
  out.push('', '-- pg_cron (nom, planning, commande)', '');
  for (const c of cron) out.push(`SELECT cron.schedule(${guillemets(c.jobname)}, ${guillemets(c.schedule)}, ${guillemets(c.command)});`);
  if (cron.length === 0) out.push('-- (aucune)');
  return out.join('\n') + '\n';
}

/** Le fichier schema.sql : en-tete, dump normalise, complements. */
export function assemblerSchema(dumpBrut, complements) {
  return ENTETE_SCHEMA + '\n' + normaliserDump(dumpBrut) + '\n' + rendreComplements(complements);
}

// ─── Inventaire des fonctions ───────────────────────────────────────

/** Requete du catalogue : une ligne par fonction de `public`, droits EFFECTIFS. */
export const SQL_FONCTIONS = `
select p.proname as nom,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prokind as genre,
       (p.prorettype = 'trigger'::regtype) as est_trigger,
       p.prosecdef as definer,
       (select substring(c from '^search_path=(.*)$')
          from unnest(coalesce(p.proconfig, '{}'::text[])) c
         where c like 'search_path=%' limit 1) as search_path,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role,
       exists (select 1
                 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public_role
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
 order by p.proname, pg_get_function_identity_arguments(p.oid)`;

export const SQL_TRIGGERS_HORS_PUBLIC = `
select pg_get_triggerdef(t.oid) as def
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace cn on cn.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  join pg_namespace pn on pn.oid = p.pronamespace
 where not t.tgisinternal and cn.nspname <> 'public' and pn.nspname = 'public'
 order by cn.nspname, c.relname, t.tgname`;

export const SQL_POLICIES_HORS_PUBLIC = `
select schemaname, tablename, policyname, permissive, roles::text[] as roles, cmd, qual, with_check
  from pg_policies
 where schemaname not in ('public', 'cron')
 order by schemaname, tablename, policyname`;

export const SQL_BUCKETS = `
select id, public, file_size_limit, allowed_mime_types
  from storage.buckets order by id`;

export const SQL_CRON = `
select jobname, schedule, command from cron.job order by jobname, schedule, command`;

const tri = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Une table optionnelle (storage, cron) : absente de la stack, la liste est vide et on le dit. */
async function lireOptionnel(client, table, sql) {
  const present = await client.query('select to_regclass($1) as t', [table]);
  if (!present.rows[0]?.t) return [];
  return (await client.query(sql)).rows;
}

/** Tout ce que la base fournit, lu par un client `pg` (ou un faux, en test). */
export async function lireBase(client) {
  const fonctions = (await client.query(SQL_FONCTIONS)).rows;
  const triggers = (await client.query(SQL_TRIGGERS_HORS_PUBLIC)).rows;
  const policies = (await client.query(SQL_POLICIES_HORS_PUBLIC)).rows;
  const buckets = await lireOptionnel(client, 'storage.buckets', SQL_BUCKETS);
  const cron = await lireOptionnel(client, 'cron.job', SQL_CRON);
  return { fonctions, complements: { triggers, policies, buckets, cron } };
}

const EXCLUS_DOSSIER = new Set(['node_modules', '.git', 'dist', 'coverage', '__test__', '__tests__', 'test', 'generated']);
const EST_TEST = /\.(test|spec)\.[cm]?[jt]sx?$/;
const EST_SOURCE = /\.[cm]?[jt]sx?$/;

/** Les fichiers source (chemins POSIX relatifs a `racine`), tests exclus. */
export function listerSources(racine, dossiers = DOSSIERS_APPELANTS) {
  const out = [];
  const marche = (rel) => {
    let entrees;
    try {
      entrees = readdirSync(join(racine, rel));
    } catch {
      return;
    }
    for (const e of entrees.sort()) {
      if (EXCLUS_DOSSIER.has(e)) continue;
      const enfant = `${rel}/${e}`;
      if (statSync(join(racine, enfant)).isDirectory()) marche(enfant);
      else if (EST_SOURCE.test(e) && !EST_TEST.test(e) && !e.endsWith('.d.ts')) out.push(enfant);
    }
  };
  for (const d of dossiers) marche(d.split(sep).join('/'));
  return out;
}

// `rpc('nom'`, `rpc<Type>('nom'`, `rpc(\n 'nom'`.
const RE_RPC = /\brpc\s*(?:<[^()]*?>)?\s*\(\s*(['"`])([A-Za-z_][A-Za-z0-9_]*)\1/g;
const RE_CHAINE = /(['"`])([A-Za-z_][A-Za-z0-9_]*)\1/g;

/**
 * Pour chaque nom de fonction : les fichiers qui l'appellent par `rpc('nom'`
 * (`directs`) et ceux qui le citent seulement comme chaine (`chaines`).
 */
export function chercherAppelants(noms, lireFichier, fichiers) {
  const connus = new Set(noms);
  const directs = new Map();
  const chaines = new Map();
  const ajouter = (m, nom, fichier) => {
    if (!m.has(nom)) m.set(nom, new Set());
    m.get(nom).add(fichier);
  };
  for (const f of fichiers) {
    const texte = lireFichier(f);
    const vusDirects = new Set();
    for (const m of texte.matchAll(RE_RPC)) {
      if (connus.has(m[2])) {
        ajouter(directs, m[2], f);
        vusDirects.add(m[2]);
      }
    }
    for (const m of texte.matchAll(RE_CHAINE)) {
      if (connus.has(m[2]) && !vusDirects.has(m[2])) ajouter(chaines, m[2], f);
    }
  }
  const lister = (m, nom) => [...(m.get(nom) ?? [])].sort(tri);
  return new Map(noms.map((n) => [n, { directs: lister(directs, n), chaines: lister(chaines, n) }]));
}

const oui = (b) => (b ? 'oui' : '-');
const cellule = (s) => String(s).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

/** Une fonction est « a relire » si `anon` peut l'appeler. */
const estAnon = (f) => f.anon === true;

export function rendreInventaire(fonctions, appelants) {
  const triees = [...fonctions].sort((a, b) => tri(a.nom, b.nom) || tri(a.args, b.args));
  const total = triees.length;
  const compte = (pred) => triees.filter(pred).length;
  const definer = triees.filter((f) => f.definer);
  const sansPath = definer.filter((f) => !f.search_path);
  const anon = triees.filter(estAnon);
  const anonDefiner = anon.filter((f) => f.definer);
  const publicRole = triees.filter((f) => f.public_role);

  const ligne = (f) => {
    const a = appelants.get(f.nom) ?? { directs: [], chaines: [] };
    const liste = [...a.directs.map((p) => `\`${p}\``), ...a.chaines.map((p) => `~\`${p}\``)].join('<br>');
    const genre = f.est_trigger ? ' (trigger)' : f.genre === 'p' ? ' (procedure)' : f.genre === 'a' ? ' (agregat)' : '';
    return `| \`${cellule(f.nom)}(${cellule(f.args)})\`${genre} | ${f.definer ? 'DEFINER' : 'INVOKER'}`
      + ` | ${f.search_path ? `\`${cellule(f.search_path)}\`` : 'non fige'}`
      + ` | ${oui(f.anon)} | ${oui(f.authenticated)} | ${oui(f.service_role)} | ${liste || '-'} |`;
  };
  const ENTETE_TABLE = [
    '| Fonction (arguments) | Mode | search_path | anon | authenticated | service_role | Appelants |',
    '|---|---|---|---|---|---|---|',
  ];

  const out = [
    '<!-- GENERE par scripts/contrat-donnees.mjs. NE PAS EDITER A LA MAIN. -->',
    '# Inventaire des fonctions SQL du schema `public`',
    '',
    'Genere depuis une base vierge sur laquelle toutes les migrations de `supabase/migration/` ont ete',
    'rejouees. La CI echoue si ce fichier diverge de ce que les migrations produisent : chaque ajout',
    'ou changement de droit d\'une fonction est donc relu dans le diff.',
    '',
    `Regenerer : ${REGENERER}.`,
    '',
    '- Les droits sont les droits EFFECTIFS (`has_function_privilege`), le droit accorde a `PUBLIC` compris.',
    '- Les appelants sont cherches par texte (`rpc(\'nom\'`) dans `src/`, `supabase/functions/` et `api/`,',
    '  tests exclus. `~` : le nom n\'apparait que comme chaine (constante, table de noms). Un appel depuis SQL',
    '  (fonction, policy, trigger) n\'est pas liste : `-` ne prouve pas qu\'une fonction est inutilisee.',
    '',
    '## Synthese',
    '',
    '| Mesure | Nombre |',
    '|---|---|',
    `| Fonctions | ${total} |`,
    `| Executables par \`anon\` | ${anon.length} |`,
    `| Executables par \`authenticated\` | ${compte((f) => f.authenticated)} |`,
    `| Executables par \`service_role\` | ${compte((f) => f.service_role)} |`,
    `| Droit accorde a \`PUBLIC\` | ${publicRole.length} |`,
    `| SECURITY DEFINER | ${definer.length} |`,
    `| SECURITY DEFINER sans \`search_path\` fige | ${sansPath.length} |`,
    `| SECURITY DEFINER executables par \`anon\` | ${anonDefiner.length} |`,
    '',
    '## Executables par `anon` (surface ouverte sans session)',
    '',
  ];
  if (anon.length === 0) out.push('Aucune.');
  else out.push(...ENTETE_TABLE, ...anon.map(ligne));
  out.push('', '## SECURITY DEFINER sans `search_path` fige', '');
  if (sansPath.length === 0) out.push('Aucune.');
  else out.push(...ENTETE_TABLE, ...sansPath.map(ligne));
  out.push('', '## Toutes les fonctions', '', ...ENTETE_TABLE, ...triees.map(ligne));
  return out.join('\n') + '\n';
}

// ─── Types ──────────────────────────────────────────────────────────

const ENTETE_TYPES = [
  '// @generated par scripts/contrat-donnees.mjs (supabase gen types typescript). NE PAS EDITER A LA MAIN.',
  '// Source : une base vierge sur laquelle toutes les migrations de supabase/migration/ ont ete rejouees.',
  '// La CI echoue si ce fichier diverge. Les mappers s\'y accrochent par src/lib/db-contract.ts :',
  '// un renommage de colonne casse `tsc`.',
  `// Regenerer : ${REGENERER}.`,
  '',
].join('\n');

export function assemblerTypes(sortieCli) {
  const corps = String(sortieCli).replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n+$/, '');
  return ENTETE_TYPES + corps + '\n';
}

// ─── Orchestration ──────────────────────────────────────────────────

/** `a b "c"` en [a, b, c], sans shell : un chemin de commande ne passe jamais par `sh`. */
export function decouperCommande(texte) {
  const mots = [];
  for (const m of String(texte).trim().matchAll(/"([^"]*)"|(\S+)/g)) mots.push(m[1] ?? m[2]);
  if (mots.length === 0) throw new Error('commande vide');
  return mots;
}

export function projetId(racine) {
  const m = readFileSync(join(racine, 'supabase/config.toml'), 'utf8').match(/^project_id\s*=\s*"([^"]+)"/m);
  if (!m) throw new Error('project_id introuvable dans supabase/config.toml');
  return m[1];
}

export function commandesParDefaut(racine, env = process.env) {
  return {
    pgDump: env.COSMO_PG_DUMP
      || `docker exec supabase_db_${projetId(racine)} pg_dump -U postgres -d postgres --schema-only --schema=public --no-owner --no-tablespaces`,
    genTypes: env.COSMO_GEN_TYPES || 'supabase gen types typescript --local --schema public',
  };
}

/** Lance une commande, rend sa sortie standard ; toute sortie non nulle jette avec la fin de stderr. */
export function executer(commande) {
  const [exe, ...args] = decouperCommande(commande);
  const r = spawnSync(exe, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.error) throw new Error(`${exe} : ${r.error.message}`);
  if (r.status !== 0) {
    const fin = String(r.stderr || '').trim().split('\n').slice(-15).join('\n');
    throw new Error(`${exe} a rendu ${r.status}\n${fin}`);
  }
  return r.stdout;
}

/**
 * Produit les trois fichiers : Map chemin -> contenu. Les entrees (client,
 * executeur, lecteur de sources) sont injectees : le temoin les remplace.
 */
export async function produire({ racine, client, lancer = executer, commandes, lireFichier, fichiers }) {
  const { fonctions, complements } = await lireBase(client);
  const dump = lancer(commandes.pgDump);
  const types = lancer(commandes.genTypes);
  const sources = fichiers ?? listerSources(racine);
  const lire = lireFichier ?? ((f) => readFileSync(join(racine, f), 'utf8'));
  const appelants = chercherAppelants(fonctions.map((f) => f.nom), lire, sources);
  return new Map([
    [CHEMINS.schema, assemblerSchema(dump, complements)],
    [CHEMINS.inventaire, rendreInventaire(fonctions, appelants)],
    [CHEMINS.types, assemblerTypes(types)],
  ]);
}

/** La premiere zone qui differe : lignes communes de tete et de queue retirees. */
export function comparer(attendu, actuel) {
  const a = String(attendu).replace(/\r\n/g, '\n');
  const b = String(actuel).replace(/\r\n/g, '\n');
  if (a === b) return { identique: true };
  const la = a.split('\n');
  const lb = b.split('\n');
  let debut = 0;
  while (debut < la.length && debut < lb.length && la[debut] === lb[debut]) debut += 1;
  let finA = la.length;
  let finB = lb.length;
  while (finA > debut && finB > debut && la[finA - 1] === lb[finB - 1]) {
    finA -= 1;
    finB -= 1;
  }
  return {
    identique: false,
    ligne: debut + 1,
    commite: la.slice(debut, finA),
    genere: lb.slice(debut, finB),
    lignesCommite: la.length,
    lignesGenere: lb.length,
  };
}

/** Un extrait lisible de l'ecart, borne. */
export function extraireEcart(c, max = 30) {
  if (c.identique) return '';
  const moins = c.commite.slice(0, max).map((l) => `- ${l}`);
  const plus = c.genere.slice(0, max).map((l) => `+ ${l}`);
  const reste = Math.max(0, c.commite.length - max) + Math.max(0, c.genere.length - max);
  return [`@@ ligne ${c.ligne} @@`, ...moins, ...plus, ...(reste ? [`... ${reste} ligne(s) de plus`] : [])].join('\n');
}

/** Compare ce qui est commite a ce que les migrations produisent. */
export function verifier(produits, lireCommite) {
  const ecarts = [];
  for (const [chemin, genere] of produits) {
    const commite = lireCommite(chemin);
    if (commite === null) {
      ecarts.push({ chemin, absent: true, extrait: 'fichier absent du depot' });
      continue;
    }
    const c = comparer(commite, genere);
    if (!c.identique) ecarts.push({ chemin, absent: false, extrait: extraireEcart(c), ...c });
  }
  return ecarts;
}

function ecrireFichier(racine, chemin, contenu) {
  const cible = join(racine, chemin);
  mkdirSync(dirname(cible), { recursive: true });
  writeFileSync(cible, contenu, 'utf8');
}

function annoter(message, chemin) {
  if (!process.env.GITHUB_ACTIONS) return;
  const echappe = String(message).replace(/%/g, '%25').replace(/\r?\n/g, '%0A');
  console.log(`::error${chemin ? ` file=${chemin}` : ''},title=Contrat de donnees::${echappe}`);
}

function argument(nom) {
  const i = process.argv.indexOf(nom);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export async function main(argv = process.argv.slice(2)) {
  const ecrire = argv.includes('--ecrire');
  const verif = argv.includes('--verifier');
  if (ecrire === verif) {
    console.error('Usage : node scripts/contrat-donnees.mjs --ecrire | --verifier [--sortie <dossier>]');
    return 2;
  }
  const racine = process.cwd();
  const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
  } catch (err) {
    const sur = String(err.message).replace(/:\/\/[^@]*@/, '://***@');
    console.error(`✖ Connexion impossible : ${sur}`);
    annoter(`Connexion a la base impossible : ${sur}`);
    return 1;
  }
  let produits;
  try {
    produits = await produire({ racine, client, commandes: commandesParDefaut(racine) });
  } catch (err) {
    console.error(`✖ Generation impossible : ${err.message}`);
    annoter(`Generation impossible : ${err.message}`);
    return 1;
  } finally {
    await client.end();
  }

  if (ecrire) {
    for (const [chemin, contenu] of produits) {
      ecrireFichier(racine, chemin, contenu);
      console.log(`✓ ${chemin} (${contenu.split('\n').length - 1} lignes)`);
    }
    return 0;
  }

  const sortie = argument('--sortie');
  if (sortie) for (const [chemin, contenu] of produits) ecrireFichier(join(racine, sortie), chemin, contenu);

  const ecarts = verifier(produits, (chemin) => {
    const p = join(racine, chemin);
    return existsSync(p) ? readFileSync(p, 'utf8') : null;
  });
  if (ecarts.length === 0) {
    console.log(`✓ Contrat de donnees a jour (${produits.size} fichiers identiques a ce que les migrations produisent).`);
    return 0;
  }
  const resume = process.env.GITHUB_STEP_SUMMARY;
  for (const e of ecarts) {
    console.error(`✖ ${e.chemin} ne correspond pas aux migrations\n${e.extrait}\n`);
    annoter(
      `${e.chemin} diverge de ce que les migrations produisent. Regenerer : ${REGENERER}, puis commiter.\n${e.extrait.split('\n').slice(0, 12).join('\n')}`,
      e.chemin,
    );
    if (resume) {
      appendFileSync(resume, `### ✖ ${e.chemin}\n\n\`\`\`diff\n${e.extrait}\n\`\`\`\n\n`);
    }
  }
  if (resume) {
    appendFileSync(resume, `Regenerer : ${REGENERER}.\n`);
  }
  return 1;
}

// Lancement direct seulement : l'import par un temoin ne connecte rien.
if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].split(sep).join('/').replace(/^\//, '')}`).href) {
  process.exit(await main());
}

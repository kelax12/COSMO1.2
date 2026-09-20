// ═══════════════════════════════════════════════════════════════════
// C-87 — aucune mesure du coût SERVEUR ni de la CROISSANCE en continu
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LE DÉFAUT. Les plans d'exécution et les temps de RPC sont rejoués à la
// main à chaque passe d'audit. Le dépôt sait donc dire ce que coûte une
// lecture AUJOURD'HUI, jamais à quelle VITESSE ce coût monte. Or la question
// qui décide de C-15 (le tableau de bord charge tout) n'est pas « combien
// coûte une lecture », c'est « à partir de quel volume elle cesse de tenir ».
//
// Un point isolé ne répond pas à ça. Une PENTE, oui.
//
// ── CE QUE CE SCRIPT FAIT ───────────────────────────────────────────
//
// Il joue les requêtes de RÉFÉRENCE contre la production, en `EXPLAIN
// (ANALYZE, BUFFERS)`, et ajoute un point daté à une série COMMITÉE
// (`docs/db-cost-series.json`). Il échoue :
//   · si une requête dépasse son plafond ABSOLU (le garde-fou grossier) ;
//   · si sa PENTE sur les derniers points dépasse un facteur déclaré — c'est
//     le contrôle qui compte, et celui qu'aucun relevé manuel ne rend.
//
// 🔴 LES REQUÊTES SONT JOUÉES SOUS LE RÔLE `authenticated`, AVEC LES CLAIMS
// D'UN COMPTE RÉEL, DANS UNE TRANSACTION ANNULÉE. Sans ça, l'API Management
// exécute en superutilisateur, la RLS ne s'applique pas, et le plan mesuré
// n'est PAS celui que rencontre un utilisateur — c'est même exactement
// l'inverse de ce qu'on veut savoir, puisque la RLS entreprise coûte ~60× le
// prédicat de `tasks` (mémoire « RLS entreprise non indexable »).
//
// ⚠️ `ROLLBACK` systématique. Aucune écriture, jamais : ces requêtes sont
// des `SELECT`, et la transaction est annulée de toute façon.
//
// ── CE QUE ÇA NE MESURE PAS ─────────────────────────────────────────
//
// ⚠️ Le coût FACTURÉ. Supabase ne l'expose pas par requête. Ce qu'on suit est
// le coût du planificateur et le temps d'exécution, qui en sont le proxy.
// ⚠️ La charge réelle : une requête peu chère jouée mille fois coûte plus
// qu'une requête chère jouée une fois. C'est `scalability-volume.yml` qui
// répond à ça, et il est désormais mensuel (C-86).
//
// ❌ NE JAMAIS RELEVER UN PLAFOND POUR FAIRE PASSER LE JOB. Un dépassement
//    dit que la requête a changé de plan — presque toujours un index perdu
//    ou une policy réécrite.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';

const RACINE = process.cwd();
const SERIE = join(RACINE, 'docs', 'db-cost-series.json');
const PROJET_DEFAUT = 'ykeugqfgklejcdbrmawy';

/**
 * Le compte de référence. C'est le compte de SEED, choisi exprès : il porte
 * des données dans toutes les tables, et il n'appartient à personne.
 */
const COMPTE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

/**
 * LES REQUÊTES DE RÉFÉRENCE.
 *
 * `plafond_ms`   : garde-fou absolu sur le temps d'exécution.
 * `plafond_cout` : garde-fou absolu sur le coût du planificateur.
 * `pourquoi`     : ce que cette requête représente dans le produit.
 *
 * ⚠️ Les plafonds sont posés LARGES : ils attrapent un changement de plan,
 * pas une variation de charge du serveur. C'est la pente qui attrape la
 * dérive lente.
 */
export const REQUETES = [
  {
    id: 'tasks-liste',
    sql: 'SELECT * FROM public.tasks ORDER BY created_at DESC LIMIT 50',
    plafond_ms: 400,
    plafond_cout: 20000,
    pourquoi:
      'La lecture la plus fréquente du produit : la liste de tâches. Son '
      + 'prédicat RLS porte un `OR` (tâches partagées) qui interdit un simple '
      + 'parcours d index.',
  },
  {
    id: 'events-mois',
    sql: "SELECT * FROM public.events WHERE start_time >= now() - interval '31 days' ORDER BY start_time",
    plafond_ms: 400,
    plafond_cout: 20000,
    pourquoi: "Le mois courant de l'agenda, rechargé à chaque navigation de vue.",
  },
  {
    id: 'habits-completions',
    sql: 'SELECT * FROM public.habits ORDER BY created_at',
    plafond_ms: 400,
    plafond_cout: 20000,
    pourquoi:
      'Les habitudes portent leurs complétions en JSON, bornées par la '
      + 'mig. 119 : cette ligne est celle qui mesure si la borne tient.',
  },
  {
    id: 'kr-completions-stats',
    sql: "SELECT count(*), sum(1) FROM public.kr_completions WHERE completed_at >= now() - interval '365 days'",
    plafond_ms: 400,
    plafond_cout: 20000,
    pourquoi:
      'La source du temps investi sur les OKR (C-77). Elle grossit d une '
      + 'ligne par complétion et ne sera jamais purgée.',
  },
];

/** Combien de facteurs d'augmentation on tolère entre le plus vieux point gardé et le plus récent. */
const FACTEUR_PENTE = 3;

/** Sur combien de points on juge la pente. En dessous, on ne juge pas. */
const POINTS_MIN_POUR_PENTE = 4;

/** Exécute du SQL via l'API Management. */
export async function interroger(sql, { token, projet, fetchImpl = fetch }) {
  const res = await fetchImpl(`https://api.supabase.com/v1/projects/${projet}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`API Management : HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

/** Le SQL d'un EXPLAIN joué sous la RLS, dans une transaction annulée. */
export function sqlExplain(requete, compte = COMPTE) {
  const claims = JSON.stringify({ sub: compte, role: 'authenticated' });
  return [
    'BEGIN;',
    'SET LOCAL ROLE authenticated;',
    `SET LOCAL request.jwt.claims = '${claims}';`,
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${requete.sql};`,
    'ROLLBACK;',
  ].join('\n');
}

/** Les chiffres qui comptent, extraits d'un plan JSON. */
export function extraire(planJson) {
  const racine = Array.isArray(planJson) ? planJson[0] : planJson;
  const p = racine?.Plan ?? {};
  const noeuds = [];
  const parcourir = (n) => {
    noeuds.push(n['Node Type']);
    for (const f of n.Plans ?? []) parcourir(f);
  };
  if (p['Node Type']) parcourir(p);
  return {
    cout: p['Total Cost'] ?? null,
    ms: racine?.['Execution Time'] ?? null,
    planification_ms: racine?.['Planning Time'] ?? null,
    blocs: p['Shared Hit Blocks'] ?? null,
    lignes: p['Actual Rows'] ?? null,
    seq_scans: noeuds.filter((n) => n === 'Seq Scan').length,
  };
}

/** La pente entre le premier et le dernier point d'une série de valeurs. */
export function pente(valeurs) {
  const propres = valeurs.filter((v) => typeof v === 'number' && v > 0);
  if (propres.length < 2) return null;
  return propres[propres.length - 1] / propres[0];
}

// ── Exécution ──────────────────────────────────────────────────────

const estLanceDirectement =
  process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estLanceDirectement) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projet = process.env.SUPABASE_PROJECT_REF || PROJET_DEFAUT;

  // 🔴 Pas de repli : sans jeton ce script ne mesure rien.
  if (!token) {
    console.error(
      '✖ SUPABASE_ACCESS_TOKEN absent. Ce script joue des EXPLAIN contre la\n'
        + '  production : sans jeton il n a rien à ajouter à la série, et un run vert\n'
        + '  laisserait croire que le coût a été suivi.',
    );
    process.exit(1);
  }

  const point = { date: new Date().toISOString().slice(0, 10), mesures: {} };
  const erreurs = [];

  console.log('Coût serveur · EXPLAIN sous RLS, rôle `authenticated`, transaction annulée');
  for (const r of REQUETES) {
    let m;
    try {
      const reponse = await interroger(sqlExplain(r), { token, projet });
      const lignes = Array.isArray(reponse) ? reponse : reponse.result ?? [];
      const plan = lignes[0]?.['QUERY PLAN'] ?? lignes[0]?.['Query Plan'] ?? lignes[0];
      m = extraire(plan);
    } catch (e) {
      erreurs.push(`\`${r.id}\` : ${e.message}`);
      continue;
    }
    point.mesures[r.id] = m;
    console.log(
      `  ${r.id.padEnd(24)} coût ${String(Math.round(m.cout ?? -1)).padStart(7)}  `
        + `${String(Math.round(m.ms ?? -1)).padStart(5)} ms  `
        + `${String(m.blocs ?? '—').padStart(6)} blocs  ${m.seq_scans} seq-scan(s)`,
    );
    if (m.ms !== null && m.ms > r.plafond_ms) {
      erreurs.push(
        `\`${r.id}\` : ${Math.round(m.ms)} ms > plafond ${r.plafond_ms} ms.\n    ${r.pourquoi}`,
      );
    }
    if (m.cout !== null && m.cout > r.plafond_cout) {
      erreurs.push(
        `\`${r.id}\` : coût ${Math.round(m.cout)} > plafond ${r.plafond_cout}.\n`
          + '    Un coût qui explose vient presque toujours d un index perdu ou d une\n'
          + '    policy réécrite. ❌ Ne pas relever le plafond.',
      );
    }
  }

  // ── La série, et la PENTE ────────────────────────────────────────
  const serie = existsSync(SERIE)
    ? JSON.parse(readFileSync(SERIE, 'utf8'))
    : {
      _comment: [
        'C-87 — série temporelle du coût serveur. Écrite par',
        '`node scripts/check-db-cost.mjs`, jamais à la main.',
        "🔴 Ce qui compte ici n'est pas un point, c'est la PENTE : le dépôt savait",
        'dire ce que coûte une lecture aujourd hui, jamais à quelle vitesse ce coût',
        'monte.',
      ],
      points: [],
    };

  // Un point par jour : un rejeu le même jour remplace, il ne double pas.
  serie.points = serie.points.filter((p) => p.date !== point.date);
  serie.points.push(point);
  // On garde deux ans de points quotidiens au maximum : au-delà, la pente se
  // lit sur un fichier qu'on ne relit plus.
  serie.points = serie.points.slice(-730);

  if (serie.points.length >= POINTS_MIN_POUR_PENTE) {
    console.log(`\nPente sur ${serie.points.length} point(s)`);
    for (const r of REQUETES) {
      const couts = serie.points.map((p) => p.mesures?.[r.id]?.cout);
      const f = pente(couts);
      if (f === null) continue;
      console.log(`  ${r.id.padEnd(24)} ×${f.toFixed(2)} depuis ${serie.points[0].date}`);
      if (f > FACTEUR_PENTE) {
        erreurs.push(
          `\`${r.id}\` : le coût a été multiplié par ${f.toFixed(2)} depuis `
            + `${serie.points[0].date} (tolérance ×${FACTEUR_PENTE}).\n`
            + `    ${r.pourquoi}\n`
            + "    C'est le contrôle que ce script existe pour rendre : une pente, pas\n"
            + '    une valeur. ❌ Ne pas élargir la tolérance.',
        );
      }
    }
  } else {
    console.log(
      `\n⚠️ ${serie.points.length} point(s) dans la série : il en faut ${POINTS_MIN_POUR_PENTE}`
        + '\n   pour juger une pente. Les plafonds ABSOLUS, eux, s appliquent déjà.',
    );
  }

  writeFileSync(SERIE, `${JSON.stringify(serie, null, 2)}\n`, 'utf8');
  console.log(`\nSérie écrite : ${SERIE} (${serie.points.length} point(s)).`);

  if (erreurs.length > 0) {
    console.error('\n✖ Coût serveur :');
    for (const e of erreurs) console.error(`  - ${e}\n`);
    process.exit(1);
  }
  console.log('✓ Aucun plafond franchi, aucune pente au-delà de la tolérance.');
}

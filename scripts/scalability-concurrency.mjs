#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// scalability-concurrency.mjs — mesurer le mode entreprise EN CONCURRENCE
//
// ── POURQUOI CE SCRIPT EXISTE ──────────────────────────────────────
//
// `docs/SCALABILITY.md` §9ter a leve l'inconnue du planificateur : 200 puis
// 2 000 `team_tasks`, aucun basculement de plan, 354× entre les deux chemins.
// Sa derniere phrase dit ce qu'elle ne dit pas : « elle est MONO-SESSION ».
// C'est l'item C-16, et c'est ce qui decide de C-15 : tant qu'on ignore si le
// cout vient du volume par compte (289 taches au maximum mesure) ou du nombre
// de sessions simultanees, toute decision de pagination est un pari.
//
// Une mesure de volume repond a « combien coute UNE lecture ». Une mesure de
// concurrence repond a une autre question, qui n'en decoule pas : « a partir de
// combien de lecteurs simultanes la base cesse-t-elle de rendre du debit ». Un
// cout par lecture parfaitement plat peut saturer a 8 sessions ; un cout
// dix fois plus lourd peut tenir a 64 s'il n'est pas CPU-bound. Le §9ter ne
// pouvait pas le dire, quel que soit le nombre de paliers de volume ajoutes.
//
// ── CE QU'IL FAIT ──────────────────────────────────────────────────
//
//   1. seme la MEME organisation que le harnais de volume
//      (`scalability-seed.mjs`, source unique) et la remplit au volume voulu ;
//   2. balaie des paliers de concurrence (1, 2, 4, 8, 16 par defaut). A chaque
//      palier, N connexions Postgres DISTINCTES, chacune sous un membre
//      DIFFERENT, martelent `get_my_team_tasks(org)` en parallele ;
//   3. rend un chiffre PAR SESSION (p50, p95, debit) et un chiffre AGREGE
//      (p50/p95/p99 global, debit total, ECART entre la session la plus lente
//      et la plus rapide) ;
//   4. rejoue le meme balayage sur le TEMOIN — le chemin direct
//      `select count(*) from team_tasks`, celui que la mig. 113 interdit — et
//      ECHOUE si ce temoin n'apparait pas comme sature.
//
// ── TROIS CHOIX DE METHODE, ET POURQUOI ────────────────────────────
//
// 1. 🔴 **N acteurs DISTINCTS, jamais N fois le meme.** Faire marteler la meme
//    ligne d'`organization_members` par seize sessions mesure la contention sur
//    un seul cache d'autorisation, pas la charge d'une organisation. Les
//    acteurs sont pris parmi les feuilles de la pyramide (le cas frequent).
//
// 2. 🔴 **La requete mesuree rend UNE ligne (`count(*)`), pas 400.** Sans ca,
//    a seize sessions, le fil unique de Node passe son temps a desserialiser
//    des lignes et c'est LUI qu'on chronometre — la garde mesurerait le
//    harnais. Le travail serveur est identique : le predicat est evalue ligne
//    par ligne dans les deux cas. Ce que cette mesure ne couvre donc pas est le
//    cout de TRANSFERT des lignes, et c'est ecrit plutot que sous-entendu.
//    Un temoin de ce choix est integre : si le rapport de latence entre le
//    chemin direct et la RPC s'effondre, c'est que le client est redevenu le
//    goulot, et la sortie le dit.
//
// 3. 🔴 **La saturation se lit sur le GAIN MARGINAL, pas sur un seuil
//    d'efficacite absolu.** Sur un runner a 4 cœurs, aucune charge CPU-bound ne
//    peut depasser 0,25 d'efficacite a N=16 : un seuil absolu declarerait
//    « sature » toute mesure au-dela de 4 sessions, base saine comprise.
//    Detail dans `scalability-concurrency.stats.mjs`.
//
// ── USAGE ──────────────────────────────────────────────────────────
//
//   DATABASE_URL=postgres://... node scripts/scalability-concurrency.mjs
//   ... --sessions=1,2,4,8,16     # paliers de concurrence (N parametrable)
//   ... --volume=2000             # team_tasks semees
//   ... --members=50              # taille de l'organisation
//   ... --iterations=30           # requetes par session et par palier
//   ... --witness-iterations=6    # idem pour le temoin (chaque requete est chere)
//   ... --no-witness              # ⚠️ desarme la garde : diagnostic seulement
//
// ⚠️ Refuse de tourner ailleurs que sur une base LOCALE, sauf
// `--i-know-this-is-not-production`. Ce script ECRIT.
// ═══════════════════════════════════════════════════════════════════
import pg from 'pg';
import { assertDisposable, fillTo, seedOrg } from './scalability-seed.mjs';
import { aggregateLevel, classify, witnessVerdict } from './scalability-concurrency.stats.mjs';

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const SESSIONS = [
  ...new Set(
    arg('sessions', '1,2,4,8,16')
      .split(',')
      .map((n) => Number(n.trim()))
      .filter((n) => Number.isFinite(n) && n >= 1),
  ),
].sort((a, b) => a - b);
const VOLUME = Number(arg('volume', '2000'));
const MEMBERS = Number(arg('members', '50'));
const ITERATIONS = Number(arg('iterations', '30'));
const WITNESS_ITERATIONS = Number(arg('witness-iterations', '6'));
const WITNESS = !process.argv.includes('--no-witness');
const FORCE = process.argv.includes('--i-know-this-is-not-production');
const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('DATABASE_URL manquante. Ce script attend une base Postgres jetable.');
  process.exit(2);
}
assertDisposable(DB_URL, FORCE);

// Le premier palier sert de REFERENCE a toute la lecture (inflation de
// latence, gain marginal). Sans lui il n'y a pas de « avant », donc pas de
// regime : on le remet plutot que de rendre un tableau qu'on ne sait pas lire.
if (SESSIONS[0] !== 1) SESSIONS.unshift(1);

const admin = new pg.Client({ connectionString: DB_URL });

/** Ouvre une connexion deja campee sur un acteur `authenticated` donne. */
async function openActor(uid) {
  const c = new pg.Client({ connectionString: DB_URL });
  await c.connect();
  // Au niveau SESSION (`is_local = false`), pas dans une transaction : chaque
  // requete mesuree doit etre un aller-retour nu, sans BEGIN/ROLLBACK autour
  // qui ajouterait deux aller-retours au chronometre.
  await c.query("SELECT set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: uid, role: 'authenticated' }),
  ]);
  await c.query('SET ROLE authenticated');
  return c;
}

/**
 * Joue UN palier de concurrence.
 *
 * Les N sessions sont ouvertes et prechauffees AVANT le depart, puis lancees
 * dans le meme tick : la fenetre de mesure ne contient ni connexion, ni
 * compilation de plan, ni cache froid — seulement la charge.
 */
async function runLevel({ concurrency, actors, sql, paramsFor, iterations, label }) {
  const clients = [];
  try {
    for (let i = 0; i < concurrency; i += 1) {
      clients.push(await openActor(actors[i % actors.length]));
    }
    // Prechauffage : plan compile, cache chaud, sur chaque connexion.
    await Promise.all(
      clients.map((c, i) => c.query(sql, paramsFor(i)).then(() => c.query(sql, paramsFor(i)))),
    );

    const results = new Array(concurrency);
    const t0 = process.hrtime.bigint();
    await Promise.all(
      clients.map(async (c, i) => {
        const params = paramsFor(i);
        const latencies = [];
        const start = process.hrtime.bigint();
        for (let k = 0; k < iterations; k += 1) {
          const a = process.hrtime.bigint();
          await c.query(sql, params);
          latencies.push(Number(process.hrtime.bigint() - a) / 1e6);
        }
        results[i] = {
          id: i + 1,
          latencies,
          elapsedMs: Number(process.hrtime.bigint() - start) / 1e6,
        };
      }),
    );
    const spanMs = Number(process.hrtime.bigint() - t0) / 1e6;

    return aggregateLevel({ sessions: results, spanMs, concurrency, label });
  } finally {
    await Promise.allSettled(clients.map((c) => c.end()));
  }
}

const fmt = (n, d = 2) => (n === null || n === undefined ? 'n/a' : Number(n).toFixed(d));

function printLevel(lvl) {
  console.log(
    `\n── ${lvl.label} · ${lvl.concurrency} session(s) ──────────────────────────`,
  );
  // PAR SESSION d'abord : c'est le chiffre qu'une moyenne cache.
  for (const s of lvl.perSession) {
    console.log(
      `  session ${String(s.id).padStart(2)} : ` +
        `p50=${fmt(s.p50).padStart(8)} ms  p95=${fmt(s.p95).padStart(8)} ms  ` +
        `max=${fmt(s.max).padStart(8)} ms  debit=${fmt(s.throughput).padStart(8)} req/s`,
    );
  }
  console.log(
    `  AGREGE     : p50=${fmt(lvl.p50)} ms  p95=${fmt(lvl.p95)} ms  p99=${fmt(lvl.p99)} ms  ` +
      `debit total=${fmt(lvl.throughput)} req/s  (${lvl.queries} requetes en ${fmt(lvl.spanMs)} ms)`,
  );
  console.log(
    `  ECART entre sessions : la plus lente ${fmt(lvl.slowestSessionP50)} ms contre ` +
      `${fmt(lvl.fastestSessionP50)} ms pour la plus rapide, soit ×${fmt(lvl.sessionSpread)}`,
  );
}

function levelRows(levels) {
  return levels.map(
    (l) =>
      `| ${l.concurrency} | ${fmt(l.throughput)} | ${fmt(l.p50)} | ${fmt(l.p95)} | ${fmt(l.p99)} | ` +
      `${fmt(l.sessionSpread)} | ${l.marginalGain === null ? '—' : `${fmt(l.marginalGain)}× / ${fmt(l.idealGain)}×`} | ` +
      `${l.efficiency === null ? '—' : fmt(l.efficiency)} | ×${fmt(l.latencyInflation, 1)} | **${l.regime}** |`,
  );
}

function sessionRows(levels) {
  const out = [];
  for (const l of levels) {
    for (const s of l.perSession) {
      out.push(
        `| ${l.concurrency} | ${s.id} | ${fmt(s.p50)} | ${fmt(s.p95)} | ${fmt(s.max)} | ${fmt(s.throughput)} |`,
      );
    }
  }
  return out;
}

async function main() {
  await admin.connect();
  const ctx = await seedOrg(admin, MEMBERS);
  await fillTo(admin, ctx.org_id, VOLUME);
  const { rows: vol } = await admin.query(
    'SELECT count(*)::int AS n FROM public.team_tasks WHERE org_id = $1',
    [ctx.org_id],
  );
  console.log(
    `Organisation ${ctx.org_id} — ${ctx.membres} membres, ${ctx.projets} projets, ` +
      `${vol[0].n} team_tasks.\n` +
      `Paliers de concurrence : ${SESSIONS.join(', ')} · ${ITERATIONS} requetes par session.`,
  );

  const actors = ctx.member_ids;
  const paramsFor = () => [ctx.org_id];

  // ── La mesure : le chemin impose (RPC de la mig. 113) ──────────────
  const main_ = [];
  for (const n of SESSIONS) {
    const lvl = await runLevel({
      concurrency: n,
      actors,
      sql: 'SELECT count(*) FROM public.get_my_team_tasks($1)',
      paramsFor,
      iterations: ITERATIONS,
      label: 'get_my_team_tasks',
    });
    printLevel(lvl);
    main_.push(lvl);
  }
  const mainLevels = classify(main_);

  // ── Le TEMOIN : le chemin direct, celui que la mig. 113 interdit ────
  let witnessLevels = [];
  let verdict = { ok: true, reason: 'temoin desarme (--no-witness) : cette mesure ne prouve rien' };
  if (WITNESS) {
    console.log('\n════ TEMOIN — chemin direct sur team_tasks (mig. 113 l\'interdit) ════');
    const w = [];
    for (const n of SESSIONS) {
      const lvl = await runLevel({
        concurrency: n,
        actors,
        sql: 'SELECT count(*) FROM public.team_tasks',
        paramsFor: () => [],
        iterations: WITNESS_ITERATIONS,
        label: 'temoin (direct)',
      });
      printLevel(lvl);
      w.push(lvl);
    }
    witnessLevels = classify(w);
    verdict = witnessVerdict(witnessLevels);
  }

  // Temoin du choix de methode n°2 : si le chemin direct cesse d'etre
  // massivement plus lent que la RPC, ce n'est plus la base qu'on chronometre,
  // c'est le client Node.
  const topMain = mainLevels[mainLevels.length - 1];
  const topWitness = witnessLevels[witnessLevels.length - 1];
  const pathRatio = topWitness && topMain.p50 > 0 ? topWitness.p50 / topMain.p50 : null;

  console.log('\n════ VERDICT ════');
  for (const l of mainLevels) {
    console.log(
      `  ${String(l.concurrency).padStart(3)} sessions : debit ${fmt(l.throughput).padStart(9)} req/s · ` +
        `p50 ${fmt(l.p50).padStart(8)} ms · gain marginal ` +
        `${l.marginalGain === null ? '  (reference)' : `${fmt(l.marginalGain)}× pour ${fmt(l.idealGain)}× ideal`} · ${l.regime}`,
    );
  }
  console.log(`\n  TEMOIN : ${verdict.ok ? '✅' : '❌'} ${verdict.reason}`);
  if (pathRatio !== null) {
    console.log(
      `  Rapport direct/RPC au palier le plus charge : ×${fmt(pathRatio, 1)} ` +
        `(s'il s'effondre vers 1, c'est Node qu'on mesure, plus la base)`,
    );
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import('node:fs');
    const header =
      '| Sessions | Debit (req/s) | p50 (ms) | p95 (ms) | p99 (ms) | Ecart entre sessions | Gain marginal / ideal | Efficacite | Latence | Regime |';
    const sep = '|---|---|---|---|---|---|---|---|---|---|';
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      [
        '### Scalabilite du mode entreprise — mesure en CONCURRENCE (C-16)',
        '',
        `Organisation de ${MEMBERS} membres, ${ctx.projets} projets, ${vol[0].n} \`team_tasks\`. ` +
          `${ITERATIONS} requetes par session, acteurs distincts.`,
        '',
        '#### Chemin impose — `get_my_team_tasks(org)`',
        '',
        header,
        sep,
        ...levelRows(mainLevels),
        '',
        '#### Temoin — chemin direct `select count(*) from team_tasks` (mig. 113 l\'interdit)',
        '',
        WITNESS ? header : '_Temoin desarme (`--no-witness`) : cette mesure ne prouve rien._',
        ...(WITNESS ? [sep, ...levelRows(witnessLevels)] : []),
        '',
        verdict.ok
          ? `✅ **Temoin** — ${verdict.reason}. La detection detecte quelque chose, la mesure principale est donc lisible.`
          : `❌ **Temoin** — ${verdict.reason}.`,
        pathRatio === null
          ? ''
          : `\nRapport de latence direct/RPC au palier le plus charge : **×${fmt(pathRatio, 1)}**. ` +
            'S\'il s\'effondre vers 1, le goulot est le client Node et non la base.',
        '',
        '<details><summary>Detail PAR SESSION (le chiffre qu\'une moyenne cache)</summary>',
        '',
        '| Sessions | # | p50 (ms) | p95 (ms) | max (ms) | Debit (req/s) |',
        '|---|---|---|---|---|---|',
        ...sessionRows(mainLevels),
        '',
        '</details>',
        '',
        'Lecture : la saturation est le PLATEAU du debit (gain marginal < 1,1×), jamais un seuil ' +
          'd\'efficacite absolu — celui-ci est borne par le nombre de cœurs du runner.',
      ].join('\n') + '\n',
    );
  }

  await admin.end();
  if (!verdict.ok) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  try {
    await admin.end();
  } catch {
    /* la connexion est deja tombee */
  }
  process.exit(1);
});

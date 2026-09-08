// ═══════════════════════════════════════════════════════════════════
// scalability-concurrency.stats.mjs — la lecture d'une mesure de concurrence
//
// Separe du harnais pour UNE raison : ces fonctions decident du verdict
// (« ca tient » / « ca sature »), et un verdict qui n'est teste par rien est
// exactement la garde que CLAUDE.md decrit — celle qui repond sans mesurer.
// Ici elles sont pures, donc jouables sans base :
// `scripts/scalability-concurrency.stats.test.mjs`.
//
// ── POURQUOI PAS UNE MOYENNE ───────────────────────────────────────
//
// Une moyenne de latences cache exactement le regime qu'on cherche. Quand une
// base sature, elle ne ralentit pas uniformement : elle met en file. Deux
// sessions sur seize prennent dix fois le temps des autres, la moyenne bouge
// d'un facteur deux, et on conclut « ca tient ». Ce fichier ne rend donc jamais
// un chiffre seul : par session (p50, p95, debit) ET agrege (p50, p95, p99,
// debit total, ECART entre la session la plus lente et la plus rapide).
//
// ── COMMENT ON DECIDE QU'UNE MESURE SATURE ─────────────────────────
//
// ❌ Pas par un seuil d'efficacite absolu. L'efficacite (acceleration / N) est
// bornee par le nombre de cœurs : sur un runner a 4 cœurs, AUCUNE charge
// CPU-bound ne peut depasser 0,25 d'efficacite a N=16. Un seuil absolu
// declarerait donc « sature » tout ce qui depasse 4 sessions, y compris une
// base parfaitement saine. C'est la garde qui repond toujours la meme chose.
//
// ✅ Par le GAIN MARGINAL, palier a palier : est-ce qu'ajouter des sessions
// achete encore du debit ? Le plateau est le signal de la mise en file, et il
// se produit la ou il se produit, quel que soit le nombre de cœurs.
// ═══════════════════════════════════════════════════════════════════

/** En dessous de ce gain de debit d'un palier au suivant, le debit plafonne. */
export const SATURATION_GAIN = 1.1;
/** Au-dessus de cette efficacite marginale, le palier suit encore la pente ideale. */
export const LINEAR_EFFICIENCY = 0.8;

/** Percentile par interpolation lineaire, sur un tableau NON trie. */
export function percentile(values, p) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  if (s.length === 1) return s[0];
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

/** Resume d'une serie de latences (ms). */
export function summarize(latencies) {
  return {
    n: latencies.length,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    max: latencies.length ? Math.max(...latencies) : null,
    mean: latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null,
  };
}

/**
 * Agrege les sessions d'UN palier.
 *
 * `sessions` : [{ id, latencies, elapsedMs }]
 * `spanMs`   : duree de la fenetre de mesure du palier, du depart de la
 *              premiere session a l'arrivee de la derniere. C'est elle qui
 *              donne le debit reel du palier, jamais la somme des debits par
 *              session (qui suppose qu'elles ont toutes tourne tout le temps).
 */
export function aggregateLevel({ sessions, spanMs, concurrency, label }) {
  const perSession = sessions.map((s) => ({
    id: s.id,
    ...summarize(s.latencies),
    throughput: s.elapsedMs > 0 ? (s.latencies.length / s.elapsedMs) * 1000 : null,
  }));
  const all = sessions.flatMap((s) => s.latencies);
  const p50s = perSession.map((s) => s.p50).filter((v) => v !== null);

  return {
    label,
    concurrency,
    queries: all.length,
    spanMs,
    throughput: spanMs > 0 ? (all.length / spanMs) * 1000 : null,
    ...summarize(all),
    perSession,
    // L'ECART entre sessions : c'est lui qui montre la mise en file. Une
    // moyenne stable avec un ecart qui explose est une base qui sature.
    slowestSessionP50: p50s.length ? Math.max(...p50s) : null,
    fastestSessionP50: p50s.length ? Math.min(...p50s) : null,
    sessionSpread: p50s.length ? Math.max(...p50s) / Math.min(...p50s) : null,
  };
}

/**
 * Classe chaque palier par rapport au precedent.
 *
 * Rend, par palier : l'acceleration observee du debit, l'acceleration IDEALE
 * (le rapport des concurrences), l'efficacite marginale, l'inflation de latence
 * par rapport au premier palier, et le regime.
 */
export function classify(levels) {
  const sorted = [...levels].sort((a, b) => a.concurrency - b.concurrency);
  const base = sorted[0];
  return sorted.map((lvl, i) => {
    if (i === 0) {
      return { ...lvl, regime: 'reference', marginalGain: null, idealGain: null, efficiency: null, latencyInflation: 1 };
    }
    const prev = sorted[i - 1];
    const idealGain = lvl.concurrency / prev.concurrency;
    const marginalGain = prev.throughput > 0 ? lvl.throughput / prev.throughput : null;
    const efficiency = marginalGain === null ? null : marginalGain / idealGain;
    const latencyInflation = base.p50 > 0 ? lvl.p50 / base.p50 : null;

    let regime;
    if (marginalGain === null) regime = 'indetermine';
    else if (efficiency >= LINEAR_EFFICIENCY) regime = 'lineaire';
    else if (marginalGain >= SATURATION_GAIN) regime = 'degrade';
    else regime = 'sature';

    return { ...lvl, idealGain, marginalGain, efficiency, latencyInflation, regime };
  });
}

/**
 * Le TEMOIN.
 *
 * 🔴 Un harnais qui rend toujours « ca tient » ne mesure rien. On fait donc
 * jouer, au meme moment et sur la meme base, une charge dont on SAIT qu'elle
 * sature : le chemin direct sur `team_tasks`, celui que la mig. 113 interdit,
 * qui balaie la table entiere et evalue `can_access_team_project` par ligne.
 * S'il n'apparait PAS comme sature dans la sortie, ce n'est pas la base qui va
 * bien : c'est la detection qui ne detecte rien, et le harnais doit echouer.
 *
 * Le verdict porte sur le palier le plus charge, seul endroit ou le plateau est
 * exigible.
 */
export function witnessVerdict(classifiedWitnessLevels) {
  const levels = classifiedWitnessLevels;
  if (levels.length < 2) {
    return { ok: false, reason: 'le temoin exige au moins deux paliers pour montrer un plateau' };
  }
  const top = levels[levels.length - 1];
  if (top.regime === 'sature') {
    return {
      ok: true,
      reason:
        `le temoin sature a ${top.concurrency} sessions ` +
        `(gain marginal ${top.marginalGain?.toFixed(2)}× pour ${top.idealGain?.toFixed(2)}× ideal, ` +
        `latence ×${top.latencyInflation?.toFixed(1)})`,
    };
  }
  return {
    ok: false,
    reason:
      `le temoin n'a PAS sature a ${top.concurrency} sessions (regime « ${top.regime} », ` +
      `gain marginal ${top.marginalGain?.toFixed(2)}×) — la detection ne detecte rien, ` +
      'la mesure principale ne prouve donc rien non plus',
  };
}

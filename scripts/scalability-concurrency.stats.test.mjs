// ═══════════════════════════════════════════════════════════════════
// Garde du VERDICT de la mesure de concurrence (C-16).
//
// Le harnais lui-meme exige une stack Supabase, donc il ne tourne qu'en CI.
// Ce qui DECIDE, en revanche, est pur : ces fonctions disent « ca tient » ou
// « ca sature », et un verdict que rien ne teste est exactement la garde que
// CLAUDE.md decrit — celle qui repond sans mesurer.
//
// 🔴 Ce fichier porte donc ses propres TEMOINS, dans les deux sens :
//   • une mesure volontairement saturee DOIT ressortir « sature » ;
//   • une mesure volontairement saine DOIT ressortir « lineaire », sinon le
//     detecteur est une constante deguisee et ne prouve rien ;
//   • une moyenne stable avec une file d'attente DOIT quand meme se voir, par
//     l'ecart entre sessions.
// ═══════════════════════════════════════════════════════════════════
import { describe, expect, it } from 'vitest';
import {
  aggregateLevel,
  classify,
  percentile,
  summarize,
  witnessVerdict,
} from './scalability-concurrency.stats.mjs';

/** Fabrique un palier a partir de latences par session. */
const level = (concurrency, perSessionLatencies, spanMs) =>
  aggregateLevel({
    concurrency,
    label: 'test',
    spanMs,
    sessions: perSessionLatencies.map((latencies, i) => ({
      id: i + 1,
      latencies,
      // Chaque session tourne toute la fenetre : c'est le cas nominal.
      elapsedMs: latencies.reduce((a, b) => a + b, 0),
    })),
  });

const flat = (n, ms, count = 10) => Array.from({ length: n }, () => Array(count).fill(ms));

describe('percentile et resume', () => {
  it('interpole et ne se laisse pas tirer par une valeur unique', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentile([10], 95)).toBe(10);
    expect(percentile([], 50)).toBeNull();
  });

  it('rend p50, p95, p99 et max, jamais la seule moyenne', () => {
    const s = summarize([1, 1, 1, 1, 100]);
    expect(s.p50).toBe(1);
    expect(s.max).toBe(100);
    // La moyenne dit 20,8 la ou la mediane dit 1 : c'est precisement pourquoi
    // on ne rend jamais la moyenne seule.
    expect(s.mean).toBeGreaterThan(s.p50);
  });
});

describe('agregation par palier', () => {
  it('rend un chiffre PAR SESSION en plus de l agrege', () => {
    const lvl = level(4, flat(4, 10), 100);
    expect(lvl.perSession).toHaveLength(4);
    expect(lvl.perSession[0].p50).toBe(10);
    expect(lvl.queries).toBe(40);
  });

  it('montre la mise en file par l ECART, la ou la moyenne ne bouge presque pas', () => {
    // Deux sessions sur quatre sont dix fois plus lentes. La moyenne globale
    // passe de 10 a 55 ms — un facteur 5,5 qu'on pourrait mettre sur le compte
    // du bruit. L'ecart entre sessions, lui, dit ×10, sans ambiguite.
    const lvl = level(4, [...flat(2, 10), ...flat(2, 100)], 1000);
    expect(lvl.sessionSpread).toBeCloseTo(10, 5);
    expect(lvl.slowestSessionP50).toBe(100);
    expect(lvl.fastestSessionP50).toBe(10);
  });

  it('calcule le debit sur la fenetre du palier, pas sur la somme des sessions', () => {
    // 4 sessions × 10 requetes en 1 000 ms = 40 req/s, meme si chaque session
    // ne fait individuellement que 10 req/s.
    const lvl = level(4, flat(4, 100), 1000);
    expect(lvl.throughput).toBeCloseTo(40, 5);
    expect(lvl.perSession[0].throughput).toBeCloseTo(10, 5);
  });
});

describe('classification des regimes', () => {
  it('TEMOIN SAIN — une base qui absorbe la charge ressort « lineaire »', () => {
    // Le debit double a chaque doublement de sessions, la latence ne bouge pas.
    const levels = classify([
      level(1, flat(1, 10), 100),
      level(2, flat(2, 10), 100),
      level(4, flat(4, 10), 100),
    ]);
    expect(levels.map((l) => l.regime)).toEqual(['reference', 'lineaire', 'lineaire']);
    expect(levels[2].latencyInflation).toBeCloseTo(1, 5);
  });

  it('TEMOIN SATURE — un debit qui plafonne pendant que la latence enfle', () => {
    // 4 → 8 sessions : le debit ne bouge pas (100 req/s), chaque session met
    // deux fois plus de temps. C'est la definition de la mise en file.
    const levels = classify([
      level(1, flat(1, 10), 100),
      level(4, flat(4, 40, 10), 400),
      level(8, flat(8, 80, 10), 800),
    ]);
    expect(levels[1].throughput).toBeCloseTo(levels[2].throughput, 5);
    expect(levels[2].regime).toBe('sature');
    expect(levels[2].latencyInflation).toBeCloseTo(8, 5);
  });

  it('un palier qui progresse encore, mais moins vite que l ideal, est « degrade »', () => {
    // ×2 sessions pour ×1,5 de debit : ce n'est ni la pente ideale, ni un
    // plateau. Sans ce troisieme etat, tout ce qui n'est pas parfait serait
    // declare sature et le verdict ne voudrait rien dire.
    const levels = classify([
      level(1, flat(1, 10), 100),
      level(2, flat(2, 10), 133.33),
    ]);
    expect(levels[1].marginalGain).toBeCloseTo(1.5, 2);
    expect(levels[1].regime).toBe('degrade');
  });

  it('trie les paliers : un tableau desordonne ne doit pas fabriquer un faux regime', () => {
    const levels = classify([
      level(4, flat(4, 10), 100),
      level(1, flat(1, 10), 100),
      level(2, flat(2, 10), 100),
    ]);
    expect(levels.map((l) => l.concurrency)).toEqual([1, 2, 4]);
    expect(levels[0].regime).toBe('reference');
  });
});

describe('le TEMOIN du harnais', () => {
  it('accepte une charge qui sature au palier le plus charge', () => {
    const levels = classify([
      level(1, flat(1, 700), 700),
      level(4, flat(4, 2800, 4), 2800),
      level(16, flat(16, 11200, 4), 11200),
    ]);
    const v = witnessVerdict(levels);
    expect(v.ok).toBe(true);
    expect(v.reason).toContain('sature a 16 sessions');
  });

  it('🔴 REFUSE une mesure ou le temoin ne sature pas — sinon le harnais rend toujours « ca tient »', () => {
    // Meme forme de donnees, mais le temoin monte en debit comme une base
    // saine. Si ce cas passait, la sortie du harnais serait une constante.
    const levels = classify([
      level(1, flat(1, 10), 100),
      level(4, flat(4, 10), 100),
      level(16, flat(16, 10), 100),
    ]);
    const v = witnessVerdict(levels);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain('la detection ne detecte rien');
  });

  it('refuse un temoin a un seul palier : un plateau exige un « avant »', () => {
    const v = witnessVerdict(classify([level(1, flat(1, 10), 100)]));
    expect(v.ok).toBe(false);
    expect(v.reason).toContain('au moins deux paliers');
  });
});

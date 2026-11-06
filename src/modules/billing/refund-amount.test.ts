// ═══════════════════════════════════════════════════════════════════
// Combien on rembourse une rétractation (décision du 2026-11-01).
// ═══════════════════════════════════════════════════════════════════
//
// L'import relatif hors de `src/` est délibéré, comme `org-tiers.parity.test.ts` :
// `_shared/refund-amount.ts` est du TS pur sans API Deno, et ce fichier de test
// n'entre jamais dans le bundle Vite.
import { describe, it, expect } from 'vitest';
import {
  refundAmount,
  withinWithdrawalWindow,
  withdrawalDeadline,
  WITHDRAWAL_DAYS,
} from '../../../supabase/functions/_shared/refund-amount';

const DAY = 24 * 60 * 60;
const START = 1_800_000_000;

describe('prorata journalier, jour en cours compté comme utilisé', () => {
  it('mensuel de 30 jours, rétractation au jour 1 : 29/30 rendus, arrondi inférieur', () => {
    const d = refundAmount({
      amountPaidCents: 2000,
      periodStart: START,
      periodEnd: START + 30 * DAY,
      now: START + 3600,
      immediateAccessRequested: true,
    });
    // 2000 × 29 / 30 = 1933,33… → 1933
    expect(d).toEqual({ amountCents: 1933, reason: 'daily_prorata', daysRemaining: 29, daysInPeriod: 30 });
  });

  it('le jour entamé compte : 10 jours et 1 seconde écoulés = 11 jours utilisés', () => {
    const d = refundAmount({
      amountPaidCents: 3000,
      periodStart: START,
      periodEnd: START + 30 * DAY,
      now: START + 10 * DAY + 1,
      immediateAccessRequested: true,
    });
    expect(d.daysRemaining).toBe(19);
    expect(d.amountCents).toBe(1900);
  });

  it('annuel de 365 jours, rétractation au jour 14', () => {
    const d = refundAmount({
      amountPaidCents: 16_800_00,
      periodStart: START,
      periodEnd: START + 365 * DAY,
      now: START + 13 * DAY + 5,
      immediateAccessRequested: true,
    });
    expect(d.daysRemaining).toBe(351);
    expect(d.amountCents).toBe(Math.floor((16_800_00 * 351) / 365));
  });

  it('sans demande expresse d accès immédiat : remboursement INTÉGRAL', () => {
    const d = refundAmount({
      amountPaidCents: 2000,
      periodStart: START,
      periodEnd: START + 30 * DAY,
      now: START + 12 * DAY,
      immediateAccessRequested: false,
    });
    expect(d.amountCents).toBe(2000);
    expect(d.reason).toBe('full_no_immediate_access');
  });
});

describe('bornes', () => {
  const base = { periodStart: START, periodEnd: START + 30 * DAY, immediateAccessRequested: true };

  it('rien d encaissé, rien rendu', () => {
    expect(refundAmount({ ...base, amountPaidCents: 0, now: START }).amountCents).toBe(0);
    expect(refundAmount({ ...base, amountPaidCents: Number.NaN, now: START }).amountCents).toBe(0);
  });

  it('période terminée ou dernier jour : zéro, jamais négatif', () => {
    expect(refundAmount({ ...base, amountPaidCents: 2000, now: START + 30 * DAY }).amountCents).toBe(0);
    expect(refundAmount({ ...base, amountPaidCents: 2000, now: START + 29 * DAY + 1 }).amountCents).toBe(0);
  });

  it('jamais plus que l encaissé, même avec une horloge avant la période', () => {
    const d = refundAmount({ ...base, amountPaidCents: 2000, now: START - 10 * DAY });
    expect(d.amountCents).toBeLessThanOrEqual(2000);
    expect(d.amountCents).toBeGreaterThanOrEqual(0);
  });

  it('période incohérente : zéro', () => {
    expect(refundAmount({ ...base, periodEnd: START, amountPaidCents: 2000, now: START }).amountCents).toBe(0);
  });
});

// AM-3 (2026-11-06) : les bornes ci-dessus ne regardaient que `amountCents`. Un
// mutant qui laissait passer un cas limite rendait le même montant par un autre
// chemin (autre `reason`, autre `daysInPeriod`) et survivait. On compare donc la
// décision ENTIÈRE, et on pose chaque borne pile sur sa valeur, avec et sans
// demande d'accès immédiat (sans elle, le chemin « tout rendre » exposerait un
// garde manquant en rendant l'encaissé en entier).
describe('bornes : la décision entière, pile sur chaque seuil', () => {
  const NOTHING = { amountCents: 0, reason: 'nothing_to_refund', daysRemaining: 0, daysInPeriod: 0 };
  const base = { periodStart: START, periodEnd: START + 30 * DAY };

  describe.each([true, false])('accès immédiat demandé : %s', (immediateAccessRequested) => {
    it.each([
      ['zéro', 0],
      ['négatif', -100],
      ['NaN', Number.NaN],
      ['+Infinity', Number.POSITIVE_INFINITY],
      ['-Infinity', Number.NEGATIVE_INFINITY],
    ])('montant encaissé %s : rien à rendre, décision complète', (_nom, amountPaidCents) => {
      expect(refundAmount({ ...base, amountPaidCents, now: START + DAY, immediateAccessRequested })).toEqual(NOTHING);
    });

    it('période de durée nulle (fin = début) : rien à rendre, daysInPeriod 0', () => {
      const d = refundAmount({
        amountPaidCents: 2000,
        periodStart: START,
        periodEnd: START,
        now: START,
        immediateAccessRequested,
      });
      expect(d).toEqual(NOTHING);
    });

    it('période à l envers (fin avant début) : rien à rendre', () => {
      const d = refundAmount({
        amountPaidCents: 2000,
        periodStart: START,
        periodEnd: START - DAY,
        now: START - DAY,
        immediateAccessRequested,
      });
      expect(d).toEqual(NOTHING);
    });

    it.each([
      ['début NaN', { periodStart: Number.NaN, periodEnd: START + 30 * DAY }],
      ['fin NaN', { periodStart: START, periodEnd: Number.NaN }],
      ['début -Infinity', { periodStart: Number.NEGATIVE_INFINITY, periodEnd: START + 30 * DAY }],
      ['fin +Infinity', { periodStart: START, periodEnd: Number.POSITIVE_INFINITY }],
      ['début +Infinity', { periodStart: Number.POSITIVE_INFINITY, periodEnd: START + 30 * DAY }],
      ['fin -Infinity', { periodStart: START, periodEnd: Number.NEGATIVE_INFINITY }],
    ])('période illisible (%s) : rien à rendre', (_nom, periode) => {
      const d = refundAmount({ ...periode, amountPaidCents: 2000, now: START + DAY, immediateAccessRequested });
      expect(d).toEqual(NOTHING);
    });
  });

  describe('instant de la demande', () => {
    const immediate = { ...base, amountPaidCents: 2000, immediateAccessRequested: true };
    const NOTHING_30 = { ...NOTHING, daysInPeriod: 30 };

    it.each([
      ['NaN', Number.NaN],
      ['-Infinity', Number.NEGATIVE_INFINITY],
      ['+Infinity', Number.POSITIVE_INFINITY],
    ])('instant %s : rien à rendre, jamais un montant NaN', (_nom, now) => {
      expect(refundAmount({ ...immediate, now })).toEqual(NOTHING_30);
    });

    it('pile à la fin de la période : rien à rendre', () => {
      expect(refundAmount({ ...immediate, now: START + 30 * DAY })).toEqual(NOTHING_30);
    });

    it('une seconde avant la fin, dernier jour entamé : rien à rendre, motif « rien »', () => {
      // 30 jours utilisés sur 30 : `daysRemaining` vaut 0, pas un prorata de 0.
      expect(refundAmount({ ...immediate, now: START + 30 * DAY - 1 })).toEqual(NOTHING_30);
      expect(refundAmount({ ...immediate, now: START + 29 * DAY })).toEqual(NOTHING_30);
    });

    it('avant le dernier jour : un jour rendu, motif prorata', () => {
      expect(refundAmount({ ...immediate, now: START + 29 * DAY - 1 })).toEqual({
        amountCents: Math.floor(2000 / 30),
        reason: 'daily_prorata',
        daysRemaining: 1,
        daysInPeriod: 30,
      });
    });
  });
});

describe('fenêtre de 14 jours à compter de la conclusion', () => {
  it('ouverte du premier instant à J+14 exclu', () => {
    expect(WITHDRAWAL_DAYS).toBe(14);
    expect(withinWithdrawalWindow(START, START)).toBe(true);
    expect(withinWithdrawalWindow(START, START + 14 * DAY - 1)).toBe(true);
    expect(withinWithdrawalWindow(START, START + 14 * DAY)).toBe(false);
    expect(withinWithdrawalWindow(START, START - 1)).toBe(false);
    expect(withdrawalDeadline(START)).toBe(START + 14 * DAY);
  });

  it('témoin : une date invalide ferme la fenêtre', () => {
    expect(withinWithdrawalWindow(Number.NaN, START)).toBe(false);
  });

  // La fonction n'a plus de garde `Number.isFinite` (équivalente à son absence) :
  // ce sont ces cas qui tiennent la promesse « une valeur illisible ferme ».
  it.each([
    ['conclusion NaN', Number.NaN, START],
    ['instant NaN', START, Number.NaN],
    ['conclusion +Infinity', Number.POSITIVE_INFINITY, START],
    ['conclusion -Infinity', Number.NEGATIVE_INFINITY, START],
    ['instant +Infinity', START, Number.POSITIVE_INFINITY],
    ['instant -Infinity', START, Number.NEGATIVE_INFINITY],
    ['les deux +Infinity', Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
    ['les deux -Infinity', Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
  ])('valeur non finie (%s) : fenêtre fermée', (_nom, contractStart, now) => {
    expect(withinWithdrawalWindow(contractStart, now)).toBe(false);
  });
});

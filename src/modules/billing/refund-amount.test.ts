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
});

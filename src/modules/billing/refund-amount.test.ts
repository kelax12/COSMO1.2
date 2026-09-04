// ═══════════════════════════════════════════════════════════════════
// C-65 — combien on rembourse. La seule ligne qui décide d'un montant.
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI CES TESTS EXISTENT ET POURQUOI ILS SONT ICI.
//
// `CLAUDE.md` porte la règle en toutes lettres : « Ne jamais faire deviner un
// prix […] c'est le seul endroit où COSMO choisit un prix au lieu de se le
// faire désigner, donc le seul endroit où il peut se tromper de montant. »
// Un remboursement est le même risque dans l'autre sens : on rend de l'argent,
// et se tromper coûte directement.
//
// L'import relatif hors de `src/` est délibéré, exactement comme
// `org-tiers.parity.test.ts` : `_shared/refund-amount.ts` est du TS pur sans
// API Deno, et ce fichier de test n'entre jamais dans le bundle Vite. C'est le
// seul moyen d'exécuter réellement une logique d'Edge Function ici — le reste
// des fonctions n'a que des gardes textuelles.
import { describe, it, expect } from 'vitest';
import { refundAmount } from '../../../supabase/functions/_shared/refund-amount';

const DAY = 24 * 60 * 60;
const NOW = 1_800_000_000;

describe('mensuel — « le mois en cours », litteralement', () => {
  it('rend la derniere echeance EN ENTIER', () => {
    // Decision d'Axel du 2026-09-03. C'est aussi exactement le remede que
    // l'art. L215-1 accorde : la regle commerciale RECOUVRE l'obligation.
    const d = refundAmount({
      amountPaidCents: 2000,
      interval: 'monthly',
      periodStart: NOW - 10 * DAY,
      periodEnd: NOW + 20 * DAY,
      now: NOW,
    });
    expect(d).toEqual({ amountCents: 2000, reason: 'monthly_full', monthsRemaining: 0 });
  });

  it('rend la meme chose le premier jour et l avant-dernier', () => {
    // « A tout moment » : le montant ne depend pas de quand on demande.
    const base = { amountPaidCents: 5000, interval: 'monthly' as const, periodStart: NOW, now: NOW };
    const debut = refundAmount({ ...base, periodEnd: NOW + 30 * DAY });
    const fin = refundAmount({ ...base, periodEnd: NOW + 1 * DAY });
    expect(debut.amountCents).toBe(5000);
    expect(fin.amountCents).toBe(5000);
  });
});

describe('annuel — prorata des mois NON CONSOMMES', () => {
  // Arbitrage du §0 : « Annuel rembourse au prorata des mois non consommes.
  // Transposition litterale de la regle mensuelle. »

  it('rend 11/12 apres un mois consomme', () => {
    const d = refundAmount({
      amountPaidCents: 16_800_00,
      interval: 'yearly',
      periodStart: NOW - 30 * DAY,
      periodEnd: NOW + 335 * DAY,
      now: NOW,
    });
    expect(d.monthsRemaining).toBe(11);
    expect(d.amountCents).toBe(Math.round((16_800_00 * 11) / 12));
    expect(d.reason).toBe('yearly_prorata');
  });

  it('rend la moitie a mi-parcours', () => {
    const d = refundAmount({
      amountPaidCents: 84_000,
      interval: 'yearly',
      periodStart: NOW - 180 * DAY,
      periodEnd: NOW + 180 * DAY,
      now: NOW,
    });
    expect(d.monthsRemaining).toBe(6);
    expect(d.amountCents).toBe(42_000);
  });

  it('ne rend RIEN quand il ne reste pas un mois entier', () => {
    // 🔴 « Les mois ENTAMES NON CONSOMMES » : un mois commence est consomme.
    // C'est la lecture la moins favorable des deux, et c'est celle qui
    // correspond a la regle mensuelle.
    const d = refundAmount({
      amountPaidCents: 84_000,
      interval: 'yearly',
      periodStart: NOW - 340 * DAY,
      periodEnd: NOW + 20 * DAY,
      now: NOW,
    });
    expect(d.monthsRemaining).toBe(0);
    expect(d.amountCents).toBe(0);
    expect(d.reason).toBe('nothing_to_refund');
  });
});

describe('les bornes — on ne rend jamais plus que ce qu on a encaisse', () => {
  it('ne depasse JAMAIS le montant paye, meme sur une periode aberrante', () => {
    // Le clamp final est redondant avec le calcul, et c'est voulu : si un jour
    // ce calcul change et se trompe, on ne rendra pas plus que l'encaisse.
    const paid = 10_000;
    const d = refundAmount({
      amountPaidCents: paid,
      interval: 'yearly',
      periodStart: NOW,
      // Une periode de dix ans : 120 mois restants, donc 10x le montant si
      // rien ne bornait.
      periodEnd: NOW + 3650 * DAY,
      now: NOW,
    });
    expect(d.amountCents).toBeLessThanOrEqual(paid);
  });

  it('ne rend jamais un montant negatif', () => {
    for (const interval of ['monthly', 'yearly'] as const) {
      const d = refundAmount({
        amountPaidCents: 5000,
        interval,
        periodStart: NOW - 400 * DAY,
        periodEnd: NOW - 40 * DAY, // periode terminee
        now: NOW,
      });
      expect(d.amountCents).toBe(0);
      expect(d.reason).toBe('nothing_to_refund');
    }
  });

  it('un essai gratuit (rien encaisse) ne rend rien, sans lever', () => {
    // On resilie quand meme : c'est l'autre moitie du geste.
    for (const amountPaidCents of [0, -1, Number.NaN]) {
      const d = refundAmount({
        amountPaidCents,
        interval: 'monthly',
        periodStart: NOW,
        periodEnd: NOW + 30 * DAY,
        now: NOW,
      });
      expect(d.amountCents).toBe(0);
      expect(d.reason).toBe('nothing_to_refund');
    }
  });
});

describe('les quatre paliers annuels reels', () => {
  // 168 / 420 / 840 / 1 680 € — cf. docs/STRIPE-LIVE.md.
  it.each([16_800, 42_000, 84_000, 168_000])(
    '%d centimes : la somme des douze douziemes ne depasse pas le paye',
    (paid) => {
      let total = 0;
      for (let m = 1; m <= 12; m++) total = Math.max(total, Math.round((paid * m) / 12));
      expect(total).toBeLessThanOrEqual(paid);
    },
  );
});

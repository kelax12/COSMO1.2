// ═══════════════════════════════════════════════════════════════════
// C-65 — le REJEU. Le seul verrou du remboursement qui n'avait aucun test.
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI CES TESTS EXISTENT.
//
// Le critère de sortie de C-65 demande « un test [qui] couvre les trois : le
// cas nominal, le rejeu, et la période déjà remboursée ». Seul le MONTANT en
// avait (`refund-amount.test.ts`, 12 cas) ; la borne anti-rejeu vivait en ligne
// dans l'entrypoint Deno, entre deux appels réseau, donc inexécutable ici.
// Elle décide pourtant du montant FINAL : c'est elle qui transforme un rejeu en
// « rien de plus à rendre ».
//
// ⚠️ Ce que ces tests ne prouvent pas, et qu'aucun test de ce poste ne peut
// prouver : que Stripe rende bien la liste des remboursements existants, ni que
// la clé d'idempotence tienne sur deux appels CONCURRENTS. Ils prouvent
// l'arithmétique, qui est la partie qui coûte de l'argent en se trompant.
//
// L'import relatif hors de `src/` est délibéré, comme dans
// `refund-amount.test.ts` : du TS pur sans API Deno, jamais dans le bundle.
import { describe, it, expect } from 'vitest';
import {
  alreadyRefundedCents,
  remainingRefundableCents,
  type PriorRefund,
} from '../../../supabase/functions/_shared/refund-replay';

/** 20,00 € — palier « Équipe », mensuel. La facture de référence de ces cas. */
const PAID = 2000;

describe('cas NOMINAL — rien n’a jamais été remboursé', () => {
  it('rend exactement ce que la règle de montant a décidé', () => {
    expect(
      remainingRefundableCents({ decidedCents: PAID, amountPaidCents: PAID, priorRefunds: [] }),
    ).toBe(PAID);
  });

  it('rend le prorata décidé sur un annuel, sans le réinventer', () => {
    // 210,00 € sur 420,00 € encaissés : la borne ne doit pas remonter le
    // montant à l'encaissé sous prétexte qu'il reste de la place.
    expect(
      remainingRefundableCents({ decidedCents: 21000, amountPaidCents: 42000, priorRefunds: [] }),
    ).toBe(21000);
  });
});

describe('REJEU — le même remboursement demandé deux fois', () => {
  it('ne rend RIEN de plus quand la période a déjà été rendue en entier', () => {
    // 🔴 Le cas qui coûte. La clé d'idempotence Stripe protège deux appels
    // CONCURRENTS ; elle expire, donc elle ne protège pas un rejeu tardif.
    // C'est ce verrou-ci, et lui seul, qui l'arrête.
    expect(
      remainingRefundableCents({
        decidedCents: PAID,
        amountPaidCents: PAID,
        priorRefunds: [{ amount: PAID, status: 'succeeded' }],
      }),
    ).toBe(0);
  });

  it('ne rend que le SOLDE après un remboursement partiel', () => {
    expect(
      remainingRefundableCents({
        decidedCents: PAID,
        amountPaidCents: PAID,
        priorRefunds: [{ amount: 500, status: 'succeeded' }],
      }),
    ).toBe(1500);
  });

  it('borne sur l’ENCAISSÉ, pas seulement sur la décision', () => {
    // 🔴 Le mode de panne silencieux : deux appels espacés rendraient chacun le
    // montant décidé, soit le double du payé. Stripe accepte volontiers deux
    // remboursements partiels qui, ensemble, dépassent.
    expect(
      remainingRefundableCents({
        decidedCents: PAID,
        amountPaidCents: PAID,
        priorRefunds: [{ amount: 1800, status: 'succeeded' }],
      }),
    ).toBe(200);
  });

  it('ne rend jamais un montant NÉGATIF, même si le déjà-rendu dépasse', () => {
    // Situation anormale (un geste commercial posé à la main dans le tableau de
    // bord Stripe, par exemple). On ne réclame rien : on ne rend rien.
    expect(
      remainingRefundableCents({
        decidedCents: PAID,
        amountPaidCents: PAID,
        priorRefunds: [{ amount: 3000, status: 'succeeded' }],
      }),
    ).toBe(0);
  });
});

describe('PÉRIODE DÉJÀ REMBOURSÉE — et les statuts qui n’en sont pas', () => {
  it('un remboursement EN COURS compte comme rendu', () => {
    // ⚠️ Sinon on rembourse par-dessus un virement en vol. `pending` est un
    // engagement pris, pas une intention.
    expect(
      remainingRefundableCents({
        decidedCents: PAID,
        amountPaidCents: PAID,
        priorRefunds: [{ amount: PAID, status: 'pending' }],
      }),
    ).toBe(0);
  });

  it('un remboursement ÉCHOUÉ ou ANNULÉ ne compte PAS comme rendu', () => {
    // ⚠️ L'erreur symétrique, et elle est pire : compter un échec priverait la
    // personne de son argent, définitivement, sans qu'aucun écran ne le dise.
    for (const status of ['failed', 'canceled'] as const) {
      expect(
        remainingRefundableCents({
          decidedCents: PAID,
          amountPaidCents: PAID,
          priorRefunds: [{ amount: PAID, status }],
        }),
      ).toBe(PAID);
    }
  });

  it('additionne plusieurs remboursements, en ignorant les seuls qui ont échoué', () => {
    const priors: PriorRefund[] = [
      { amount: 500, status: 'succeeded' },
      { amount: 700, status: 'failed' },
      { amount: 300, status: 'pending' },
      { amount: 900, status: 'canceled' },
    ];
    expect(alreadyRefundedCents(priors)).toBe(800);
    expect(
      remainingRefundableCents({ decidedCents: PAID, amountPaidCents: PAID, priorRefunds: priors }),
    ).toBe(1200);
  });

  // TÉMOIN — sans lui, une implémentation qui rendrait TOUJOURS 0 passerait
  // tous les cas « rejeu » ci-dessus, et le fichier entier dirait que la borne
  // marche alors qu'elle bloquerait tout remboursement légitime. C'est le
  // défaut que ce dépôt a attrapé cinq fois en douze jours.
  it('TEMOIN — la borne n’est pas un zéro constant', () => {
    expect(
      remainingRefundableCents({ decidedCents: 1, amountPaidCents: PAID, priorRefunds: [] }),
    ).toBe(1);
    expect(alreadyRefundedCents([])).toBe(0);
  });
});

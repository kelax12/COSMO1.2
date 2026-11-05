import { describe, it, expect } from 'vitest';
import { historyLabelKey } from './billing-history-labels';

const paid = 'invoice.payment_succeeded';

describe('historyLabelKey : une ligne dit pourquoi on a payé', () => {
  it('changement de forfait par le portail → prorata nommé', () => {
    expect(historyLabelKey({ eventType: paid, billingReason: 'subscription_update' })).toBe('historyReasonUpdate');
  });
  it('souscription et renouvellement ont leur libellé', () => {
    expect(historyLabelKey({ eventType: paid, billingReason: 'subscription_create' })).toBe('historyReasonCreate');
    expect(historyLabelKey({ eventType: paid, billingReason: 'subscription_cycle' })).toBe('historyReasonCycle');
  });
  it('sans motif (mig. 241 non appliquée) → libellé d’avant', () => {
    expect(historyLabelKey({ eventType: paid, billingReason: null })).toBe('historyPaid');
  });
  it('un échec reste un échec, même avec un motif', () => {
    expect(historyLabelKey({ eventType: 'invoice.payment_failed', billingReason: 'subscription_update' })).toBe('historyFailed');
  });
  it('motif inconnu → libellé de l’event, jamais masqué', () => {
    expect(historyLabelKey({ eventType: paid, billingReason: 'manual' })).toBe('historyPaid');
    expect(historyLabelKey({ eventType: 'x.y', billingReason: null })).toBe('historyOther');
  });
});

// ═══════════════════════════════════════════════════════════════════
// SEC-08 — deux événements d'abonnement livrés dans l'ORDRE INVERSE
// ═══════════════════════════════════════════════════════════════════
//
// Stripe ne garantit pas l'ordre de livraison. Ces tests rejouent la séquence
// qui coûtait : un `updated` ancien (actif) livré APRÈS le `deleted` qui l'a
// suivi. Ils l'exécutent deux fois : avec l'ancienne règle (appliquer la
// charge de l'événement), qui rend un abonnement résilié actif, et avec la
// règle du webhook (relire l'état courant, `decideSubscriptionEvent`), qui
// converge.
//
// ⚠️ Ce que ces tests ne prouvent pas : que `stripe.subscriptions.retrieve`
// rende bien l'état courant, ni l'écriture en base. Ils prouvent la décision,
// et, par lecture du source, que l'entrypoint relit avant de décider.
//
// L'import relatif hors de `src/` est délibéré, comme `refund-replay.test.ts` :
// du TS pur sans API Deno, jamais dans le bundle.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  decideSubscriptionEvent,
  type SubscriptionEventType,
  type SubscriptionSnapshot,
} from '../../../supabase/functions/_shared/subscription-event';

interface Event {
  id: string;
  type: SubscriptionEventType;
  /** La charge figée au moment où Stripe a créé l'événement. */
  payload: SubscriptionSnapshot;
}

interface Row {
  subscriptionId: string;
  plan: 'premium' | 'free';
}

const ACTIVE = new Set(['active', 'trialing']);

/** L'effet en base d'une décision, au plus près des deux handlers du webhook. */
function applyTo(row: Row, snapshot: SubscriptionSnapshot, action: 'apply' | 'terminate'): Row {
  if (action === 'terminate') {
    // Filtré sur l'abonnement ENREGISTRÉ (S-5) : un ancien abonnement ne dégrade rien.
    return row.subscriptionId === snapshot.id ? { ...row, plan: 'free' } : row;
  }
  return { subscriptionId: snapshot.id, plan: ACTIVE.has(snapshot.status) ? 'premium' : 'free' };
}

/** La règle du webhook : relire l'état courant, décider sur lui seul. */
function deliverReread(row: Row, events: Event[], stripeNow: Map<string, SubscriptionSnapshot>): Row {
  return events.reduce((acc, e) => {
    const current = stripeNow.get(e.payload.id);
    if (!current) throw new Error('relecture impossible : le webhook lèverait, Stripe retenterait');
    const d = decideSubscriptionEvent(e.type, e.payload.id, current);
    if (d.action === 'retry') throw new Error(d.reason);
    return applyTo(acc, current, d.action);
  }, row);
}

/** L'ANCIENNE règle : la charge de l'événement fait foi. Le défaut corrigé. */
function deliverPayload(row: Row, events: Event[]): Row {
  return events.reduce((acc, e) => {
    const terminal = e.type === 'customer.subscription.deleted' || e.payload.status === 'canceled';
    return applyTo(acc, e.payload, terminal ? 'terminate' : 'apply');
  }, row);
}

const SUB = 'sub_1';
const updatedActive: Event = {
  id: 'evt_1', type: 'customer.subscription.updated', payload: { id: SUB, status: 'active' },
};
const deleted: Event = {
  id: 'evt_2', type: 'customer.subscription.deleted', payload: { id: SUB, status: 'canceled' },
};
const premium: Row = { subscriptionId: SUB, plan: 'premium' };

describe('SEC-08 — ordre inverse : updated(actif) livré après deleted', () => {
  // Chez Stripe, aujourd'hui : l'abonnement est résilié.
  const stripeNow = new Map([[SUB, { id: SUB, status: 'canceled' }]]);
  const reversed = [deleted, updatedActive];

  it("TEMOIN : l'ancienne règle (charge de l'événement) ressuscite l'abonnement résilié", () => {
    // Sans ce témoin, le cas suivant pourrait passer avec un scénario qui ne
    // reproduit pas le défaut.
    expect(deliverPayload(premium, reversed).plan).toBe('premium');
    expect(deliverPayload(premium, [updatedActive, deleted]).plan).toBe('free');
  });

  it("la relecture converge vers l'état de Stripe, dans les deux ordres", () => {
    expect(deliverReread(premium, reversed, stripeNow)).toEqual({ subscriptionId: SUB, plan: 'free' });
    expect(deliverReread(premium, [updatedActive, deleted], stripeNow)).toEqual({ subscriptionId: SUB, plan: 'free' });
  });

  it('deux updated inversés (impayé puis rattrapé) finissent sur le paiement rattrapé', () => {
    const pastDue: Event = { id: 'evt_a', type: 'customer.subscription.updated', payload: { id: SUB, status: 'past_due' } };
    const recovered: Event = { id: 'evt_b', type: 'customer.subscription.updated', payload: { id: SUB, status: 'active' } };
    const now = new Map([[SUB, { id: SUB, status: 'active' }]]);
    expect(deliverPayload(premium, [recovered, pastDue]).plan).toBe('free');
    expect(deliverReread(premium, [recovered, pastDue], now).plan).toBe('premium');
  });

  it("le deleted tardif d'un ANCIEN abonnement ne dégrade pas le nouveau", () => {
    const now = new Map([[SUB, { id: SUB, status: 'canceled' }]]);
    const renewed: Row = { subscriptionId: 'sub_2', plan: 'premium' };
    expect(deliverReread(renewed, [deleted], now)).toEqual(renewed);
  });

  it('une relecture qui échoue ne retombe jamais sur la charge : elle lève', () => {
    expect(() => deliverReread(premium, reversed, new Map())).toThrow(/relecture impossible/);
  });
});

describe('decideSubscriptionEvent', () => {
  it('un statut terminal relu termine, quel que soit le type', () => {
    for (const status of ['canceled', 'incomplete_expired']) {
      expect(decideSubscriptionEvent('customer.subscription.updated', SUB, { id: SUB, status })).toEqual({ action: 'terminate' });
      expect(decideSubscriptionEvent('customer.subscription.deleted', SUB, { id: SUB, status })).toEqual({ action: 'terminate' });
    }
  });

  it('un statut vivant ou inconnu relu sur un updated passe par le chemin habituel', () => {
    for (const status of ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused', 'statut_futur']) {
      expect(decideSubscriptionEvent('customer.subscription.updated', SUB, { id: SUB, status })).toEqual({ action: 'apply' });
    }
  });

  it("en cas de doute, Stripe retente : deleted relu vivant, ou relecture d'un autre abonnement", () => {
    expect(decideSubscriptionEvent('customer.subscription.deleted', SUB, { id: SUB, status: 'active' }).action).toBe('retry');
    expect(decideSubscriptionEvent('customer.subscription.updated', SUB, { id: 'sub_autre', status: 'active' }).action).toBe('retry');
  });
});

describe("l'entrypoint relit avant de décider", () => {
  const LF = String.fromCharCode(10);
  const source = readFileSync(join(process.cwd(), 'supabase/functions/stripe-webhook/index.ts'), 'utf8')
    .split('\r\n').join(LF);
  /** Les deux `case` d'abonnement, jusqu'au `break` qui les ferme. */
  const casesOf = (src: string) => {
    const start = src.indexOf("case 'customer.subscription.updated':");
    return start === -1 ? '' : src.slice(start, src.indexOf('break', start));
  };
  const handlerOf = (src: string) => {
    const start = src.indexOf('async function handleSubscriptionEvent(');
    return start === -1 ? '' : src.slice(start, src.indexOf(LF + '}', start));
  };

  /** Le défaut que ce fichier existe pour voir, lu sur une source. */
  function violations(src: string): string[] {
    const out: string[] = [];
    const cases = casesOf(src);
    const handler = handlerOf(src);
    if (!cases.includes("case 'customer.subscription.deleted':")) out.push('les deux types ne partagent plus le même chemin');
    if (!cases.includes('handleSubscriptionEvent(')) out.push('un case applique la charge sans relire');
    if (!/const current = await stripe\.subscriptions\.retrieve\(fromEvent\.id\)/.test(handler)) out.push('pas de relecture');
    if (!handler.includes('decideSubscriptionEvent(type, fromEvent.id, current)')) out.push('la décision ne lit pas l état relu');
    if (/handle(Org)?Subscription(Updated|Deleted)\(fromEvent\)/.test(handler)) out.push('un handler reçoit la charge de l événement');
    if (/catch\s*\{|catch\s*\(/.test(handler)) out.push('la relecture avale une erreur');
    return out;
  }

  it('relit par stripe.subscriptions.retrieve et décide sur l état relu', () => {
    expect(violations(source)).toEqual([]);
  });

  it('TEMOIN : la lecture du source voit chaque sabotage', () => {
    const sabotages: Array<[string, string, string]> = [
      ['retour à la charge', 'await handleSubscriptionEvent(event.type, event.data.object as Stripe.Subscription)',
        'await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)'],
      ['relecture retirée', 'const current = await stripe.subscriptions.retrieve(fromEvent.id)', 'const current = fromEvent'],
      ['handler sur la charge', 'else await handleSubscriptionUpdated(current)', 'else await handleSubscriptionUpdated(fromEvent)'],
      ['erreur avalée', 'const current = await stripe.subscriptions.retrieve(fromEvent.id)',
        'const current = await stripe.subscriptions.retrieve(fromEvent.id).catch(() => fromEvent)'],
    ];
    for (const [nom, chercher, remplacer] of sabotages) {
      const sabote = source.replace(chercher, remplacer);
      expect(sabote, `le sabotage « ${nom} » n a rien remplacé`).not.toEqual(source);
      expect(violations(sabote), nom).not.toEqual([]);
    }
  });
});

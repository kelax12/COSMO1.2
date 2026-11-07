import { describe, it, expect } from 'vitest';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { createAuthEvents } from './auth-events';

const someUser = { id: 'u1' } as unknown as SupabaseUser;

describe('createAuthEvents', () => {
  it("émet dans l'ordre d'abonnement, synchronement", () => {
    const events = createAuthEvents();
    const order: string[] = [];
    events.subscribe({ sessionOpened: (u) => order.push(`a:${u.id}`) });
    events.subscribe({ sessionOpened: (u) => order.push(`b:${u.id}`) });
    events.emit('sessionOpened', someUser);
    order.push('après emit');
    expect(order).toEqual(['a:u1', 'b:u1', 'après emit']);
  });

  it("n'appelle que l'écouteur de l'événement émis", () => {
    const events = createAuthEvents();
    const seen: string[] = [];
    events.subscribe({
      userLeaving: (id) => seen.push(`leaving:${id}`),
      signedOut: () => seen.push('signedOut'),
      dataScopeOpened: ({ userId, initial }) => seen.push(`scope:${userId}:${initial}`),
    });
    events.emit('dataScopeOpened', { userId: 'u2', initial: false });
    events.emit('userLeaving', 'u1');
    expect(seen).toEqual(['scope:u2:false', 'leaving:u1']);
  });

  it('le désabonnement retire le jeu, même pendant une émission', () => {
    const events = createAuthEvents();
    const seen: string[] = [];
    const unsubA = events.subscribe({
      signedOut: () => {
        seen.push('a');
        unsubA();
      },
    });
    events.subscribe({ signedOut: () => seen.push('b') });
    events.emit('signedOut', undefined);
    events.emit('signedOut', undefined);
    // `b` n'est pas sauté au premier tour, `a` n'est plus là au second.
    expect(seen).toEqual(['a', 'b', 'b']);
  });

  it("TÉMOIN : une exception d'écouteur remonte et arrête la suite, comme avant la coupe", () => {
    const events = createAuthEvents();
    const seen: string[] = [];
    events.subscribe({
      sessionOpened: () => {
        throw new Error('boom');
      },
    });
    events.subscribe({ sessionOpened: () => seen.push('jamais') });
    expect(() => events.emit('sessionOpened', someUser)).toThrow('boom');
    expect(seen).toEqual([]);
  });

  it('deux émetteurs sont étanches', () => {
    const first = createAuthEvents();
    const second = createAuthEvents();
    const seen: string[] = [];
    first.subscribe({ signedOut: () => seen.push('first') });
    second.emit('signedOut', undefined);
    expect(seen).toEqual([]);
  });
});

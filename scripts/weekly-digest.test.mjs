import { describe, expect, it } from 'vitest';
import { buildDigest, delta, parseDays } from './weekly-digest.mjs';

const base = {
  from: '06/10', to: '12/10', signups: 10, signupsPrev: 8, users: 36, active7d: 7, orgs: 1, paidSubs: 0,
};

describe('weekly-digest', () => {
  it('ne calcule pas de variation sur une semaine précédente vide', () => {
    expect(delta(5, 0)).toBeNull();
    expect(delta(10, 8)).toBe(25);
  });

  it('résume la semaine sans trafic quand la mesure maison manque', () => {
    const msg = buildDigest({ ...base, traffic: null });
    expect(msg).toContain('Inscriptions : 10 (+25 %)');
    expect(msg).toContain('mesure maison pas encore en place');
    expect(msg).not.toContain('Conversion');
  });

  it('ajoute visiteurs et conversion quand le trafic est mesuré', () => {
    const msg = buildDigest({ ...base, traffic: { visitors: 200, visitorsPrev: 100, pageviews: 640 } });
    expect(msg).toContain('Visiteurs (pages publiques) : 200 (+100 %)');
    expect(msg).toContain('Conversion visiteurs → inscriptions : 5 %');
  });

  it('titre le rapport quotidien sur la seule journée de la veille', () => {
    const msg = buildDigest({ ...base, days: 1, from: '16/10', to: '17/10', traffic: null });
    expect(msg.split('\n')[0]).toBe('📊 [cosmo] Journée du 17/10');
  });

  it('lit la période demandée et retombe sur 7 jours si elle est absurde', () => {
    expect(parseDays(['node', 'x', '--days=1'])).toBe(1);
    expect(parseDays(['node', 'x'])).toBe(7);
    expect(parseDays(['node', 'x', '--days=0'])).toBe(7);
    expect(parseDays(['node', 'x', '--days=abc'])).toBe(7);
  });

  it('ne contient aucune adresse email', () => {
    const msg = buildDigest({ ...base, traffic: null });
    expect(msg).not.toMatch(/@/);
  });
});

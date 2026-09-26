// @vitest-environment jsdom
// Info-bulle au PREMIER affichage de chaque rôle (cohérence globale, 2026-09-25).
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { claimFirstSight, resetTermClaimsForTests, ROLE_TERMS, OBJECT_TERMS } from './org-glossary';

describe('claimFirstSight', () => {
  beforeEach(() => {
    localStorage.clear();
    resetTermClaimsForTests();
  });

  it('vrai une seule fois par terme et par appareil', () => {
    expect(claimFirstSight('manager')).toBe(true);
    expect(claimFirstSight('manager')).toBe(false);
    resetTermClaimsForTests(); // nouveau chargement de page
    expect(claimFirstSight('manager')).toBe(false);
  });

  // TÉMOIN : cent badges « Membre » montés d'un coup n'ouvrent qu'UNE info-bulle.
  it('une liste de cent badges ne revendique le terme qu une fois', () => {
    const opened = Array.from({ length: 100 }, () => claimFirstSight('member')).filter(Boolean);
    expect(opened).toHaveLength(1);
  });

  it('chaque terme est indépendant', () => {
    expect(claimFirstSight('admin')).toBe(true);
    expect(claimFirstSight('teamLead')).toBe(true);
  });

  it('un stockage illisible ne rouvre jamais tout', () => {
    localStorage.setItem('cosmo_org_terms_seen_v1', '{pas du json');
    expect(claimFirstSight('owner')).toBe(false);
  });
});

describe('glossaire : chaque terme est défini dans les deux langues', () => {
  for (const locale of ['fr', 'en']) {
    it(locale, () => {
      const account = JSON.parse(readFileSync(`src/locales/${locale}/orgAccount.json`, 'utf8'));
      for (const term of [...ROLE_TERMS, ...OBJECT_TERMS]) {
        expect(account.glossary.names[term], term).toBeTruthy();
        expect(account.glossary.defs[term], term).toBeTruthy();
      }
    });
  }
});

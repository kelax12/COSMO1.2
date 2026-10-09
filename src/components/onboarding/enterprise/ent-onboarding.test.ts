// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTeamOKRSchema } from '@/modules/team-okrs/team-okr.schema';
import {
  buildCompanyOkrInput,
  joinedSinceWelcome,
  markMemberWelcomeSeen,
  readMemberWelcomeSeen,
} from './ent-onboarding';
import { NORTH, PEOPLE_SLOTS, PROJECT, SKY, TEAM_HULL, YOU, clip, initials, personInitial, starField } from './constellation-geometry';

describe('buildCompanyOkrInput (étoile polaire)', () => {
  const now = new Date(2026, 9, 3, 10, 0, 0);

  it('crée un objectif d ENTREPRISE : toute l organisation, aucune équipe', () => {
    const input = buildCompanyOkrInput('  Devenir la référence  ', ' Signer des clients ', '20', now);
    expect(input.title).toBe('Devenir la référence');
    expect(input.audience).toBe('org');
    expect(input.teamIds).toEqual([]);
    expect(input.keyResults).toEqual([{ title: 'Signer des clients', targetValue: 20, currentValue: 0 }]);
  });

  it('n invente jamais de cible : sans nombre, le résultat clé est binaire', () => {
    expect(buildCompanyOkrInput('O', 'KR', '', now).keyResults[0].targetValue).toBe(1);
    expect(buildCompanyOkrInput('O', 'KR', 'beaucoup', now).keyResults[0].targetValue).toBe(1);
    // Garde B17 : on divise par la cible, zéro et négatif valent « absent ».
    expect(buildCompanyOkrInput('O', 'KR', '0', now).keyResults[0].targetValue).toBe(1);
    expect(buildCompanyOkrInput('O', 'KR', '-4', now).keyResults[0].targetValue).toBe(1);
    expect(buildCompanyOkrInput('O', 'KR', '2,5', now).keyResults[0].targetValue).toBe(2.5);
  });

  it('ouvre un trimestre en jours locaux, comme TeamOKRModal', () => {
    const input = buildCompanyOkrInput('O', 'KR', '', now);
    expect(input.startDate).toBe('2026-10-03');
    expect(input.endDate).toBe('2027-01-01');
  });

  it('passe le schéma de création réel (au moins un résultat clé, cible > 0)', () => {
    expect(createTeamOKRSchema.safeParse(buildCompanyOkrInput('O', 'KR', '', now)).success).toBe(true);
  });
});

describe('accueil membre : une fois par entreprise et par appareil', () => {
  beforeEach(() => localStorage.clear());

  it('vierge, puis vu une fois marqué', () => {
    expect(readMemberWelcomeSeen('org-1', 'u-1')).toBe(false);
    markMemberWelcomeSeen('org-1', 'u-1');
    expect(readMemberWelcomeSeen('org-1', 'u-1')).toBe(true);
  });

  it('rejoindre une SECONDE entreprise mérite son propre accueil', () => {
    markMemberWelcomeSeen('org-1', 'u-1');
    expect(readMemberWelcomeSeen('org-2', 'u-1')).toBe(false);
  });

  it('stockage illisible = déjà vu : jamais un accueil qui revient à chaque visite', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readMemberWelcomeSeen('org-1', 'u-1')).toBe(true);
    spy.mockRestore();
  });
});

describe('constellation : géométrie', () => {
  const inside = (x: number, y: number) => x >= 0 && x <= SKY.width && y >= 0 && y <= SKY.height;

  it('tout tient dans le ciel', () => {
    for (const p of [NORTH, YOU, ...PEOPLE_SLOTS]) expect(inside(p.x, p.y)).toBe(true);
    expect(inside(TEAM_HULL.cx - TEAM_HULL.rx, TEAM_HULL.cy - TEAM_HULL.ry)).toBe(true);
    expect(inside(TEAM_HULL.cx + TEAM_HULL.rx, TEAM_HULL.cy + TEAM_HULL.ry)).toBe(true);
    expect(inside(PROJECT.x + PROJECT.w / 2, PROJECT.y + PROJECT.h / 2)).toBe(true);
  });

  it('l étoile polaire est au-dessus de vous, l équipe en dessous, le projet tout en bas', () => {
    expect(NORTH.y).toBeLessThan(YOU.y);
    expect(YOU.y).toBeLessThan(TEAM_HULL.cy);
    expect(TEAM_HULL.cy + TEAM_HULL.ry).toBeLessThan(PROJECT.y);
  });

  it('le champ d étoiles est déterministe (même ciel au rendu et à la capture)', () => {
    expect(starField()).toEqual(starField());
  });

  it('initiales, coupe et première lettre', () => {
    expect(initials('Axel Martin')).toBe('AM');
    expect(initials('  marie  ')).toBe('M');
    expect(initials('')).toBe('·');
    expect(personInitial('lea@nova.fr')).toBe('L');
    expect(clip('Nova Studio', 40)).toBe('Nova Studio');
    expect(clip('Une entreprise au nom vraiment très long', 12)).toBe('Une entrepr…');
  });
});

describe('ajouts du 2026-10-05', () => {
  it('l accueil membre ne vise que les personnes arrivées depuis sa sortie', () => {
    const members = [
      { userId: 'old', joinedAt: '2026-09-01T10:00:00+00:00' },
      { userId: 'new', joinedAt: '2026-10-04T08:12:00.123456+00:00' },
    ];
    expect(joinedSinceWelcome(members, 'new')).toBe(true);
    expect(joinedSinceWelcome(members, 'old')).toBe(false);
    // Annuaire pas encore chargé : on ne sait pas, donc on n'ouvre rien.
    expect(joinedSinceWelcome([], 'new')).toBe(false);
  });
});

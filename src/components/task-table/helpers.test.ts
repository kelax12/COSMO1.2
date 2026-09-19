import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDeadlineSmart, formatOverdueSince } from './helpers';

// Mercredi 8 juillet 2026
const NOW = new Date(2026, 6, 8, 12, 0);

describe('formatDeadlineSmart — dates relatives (#28)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("aujourd'hui / demain / hier", () => {
    expect(formatDeadlineSmart('2026-07-08')).toBe("Aujourd'hui");
    expect(formatDeadlineSmart('2026-07-09')).toBe('Demain');
    expect(formatDeadlineSmart('2026-07-07')).toBe('Hier');
  });

  it('sous 7 jours futurs : jour de la semaine', () => {
    expect(formatDeadlineSmart('2026-07-10')).toBe('vendredi');
    expect(formatDeadlineSmart('2026-07-13')).toBe('lundi');
  });

  it('retard récent : « il y a X j »', () => {
    expect(formatDeadlineSmart('2026-07-05')).toBe('il y a 3 j');
  });

  it('au-delà de ±7 jours : date absolue', () => {
    expect(formatDeadlineSmart('2026-07-20')).toBe('20 juillet');
    expect(formatDeadlineSmart('2026-06-20')).toBe('20 juin');
  });

  it('valeurs invalides : tiret', () => {
    expect(formatDeadlineSmart(undefined)).toBe('—');
    expect(formatDeadlineSmart('')).toBe('—');
    expect(formatDeadlineSmart('garbage')).toBe('—');
  });
});

// ── Maquette 87 : le retard est EXPRIMÉ, pas laissé à soustraire ─────────
//
// L'énoncé gardé ici : aucune surface ne rend plus une date brute pour dire
// un retard. `/tasks` affichait « 17/09/2026 » en rouge, l'accueil affichait
// « 2026-09-16 » — deux formats, sur la même donnée, dont aucun ne disait de
// combien on est en retard.
describe('formatOverdueSince — maquette 87', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('dit le nombre de jours, pas la date', () => {
    expect(formatOverdueSince('2026-07-06')).toBe('en retard de 2 j');
    expect(formatOverdueSince('2026-06-08')).toBe('en retard de 30 j');
  });

  it("d'un seul jour aussi : « Hier » ne dit pas qu'on est en retard", () => {
    expect(formatOverdueSince('2026-07-07')).toBe('en retard de 1 j');
  });

  it("accepte une date ISO complète comme une clé de jour", () => {
    expect(formatOverdueSince('2026-07-06T09:30:00.000Z')).toBe('en retard de 2 j');
  });

  it('jamais de retard négatif sur une échéance à venir', () => {
    // Garde-fou : appelée à tort sur une date future, elle retombe sur le
    // format relatif au lieu de rendre « en retard de -2 j ».
    expect(formatOverdueSince('2026-07-10')).toBe('vendredi');
    expect(formatOverdueSince('2026-07-08')).toBe("Aujourd'hui");
  });

  it('sans échéance : le tiret, comme les autres formatteurs', () => {
    expect(formatOverdueSince(undefined)).toBe('—');
    expect(formatOverdueSince(null)).toBe('—');
  });
});

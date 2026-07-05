import { describe, it, expect } from 'vitest';
import { parseQuickAdd } from './quick-add-parser';

// Mercredi 8 juillet 2026
const NOW = new Date(2026, 6, 8, 15, 0);

describe('parseQuickAdd — récurrence (#26)', () => {
  it('« tous les jours » → daily, deadline aujourd\'hui', () => {
    const r = parseQuickAdd('Méditer tous les jours', NOW);
    expect(r.recurrence).toBe('daily');
    expect(r.deadline).toBe('2026-07-08');
    expect(r.name).toBe('Méditer');
  });

  it('« chaque semaine » → weekly, deadline J+7', () => {
    const r = parseQuickAdd('Point équipe chaque semaine', NOW);
    expect(r.recurrence).toBe('weekly');
    expect(r.deadline).toBe('2026-07-15');
    expect(r.name).toBe('Point équipe');
  });

  it('« tous les lundis » → weekly + prochain lundi', () => {
    const r = parseQuickAdd('Sortir les poubelles tous les lundis', NOW);
    expect(r.recurrence).toBe('weekly');
    expect(r.deadline).toBe('2026-07-13'); // lundi suivant
    expect(r.name).toBe('Sortir les poubelles');
  });

  it('« tous les mois » → monthly', () => {
    const r = parseQuickAdd('Payer le loyer tous les mois', NOW);
    expect(r.recurrence).toBe('monthly');
    expect(r.deadline).toBe('2026-08-08');
    expect(r.name).toBe('Payer le loyer');
  });

  it('se combine avec les autres tokens (#catégorie, durée)', () => {
    const r = parseQuickAdd('Sport tous les jours #santé ~45m', NOW);
    expect(r.recurrence).toBe('daily');
    expect(r.categoryToken).toBe('santé');
    expect(r.estimatedTime).toBe(45);
    expect(r.name).toBe('Sport');
  });

  it('sans expression de récurrence : recurrence undefined', () => {
    const r = parseQuickAdd('Appeler le dentiste demain', NOW);
    expect(r.recurrence).toBeUndefined();
  });
});

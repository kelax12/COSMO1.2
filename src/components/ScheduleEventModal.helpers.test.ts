// Tests des fonctions pures de ScheduleEventModal (pas de rendu React nécessaire).
import { describe, it, expect } from 'vitest';
import { isoToLocalInput, localInputToIso, defaultSlot } from './ScheduleEventModal';

describe('isoToLocalInput', () => {
  it('retourne "" pour une chaîne vide', () => {
    expect(isoToLocalInput('')).toBe('');
    expect(isoToLocalInput(undefined)).toBe('');
  });

  it('retourne "" pour une date invalide', () => {
    expect(isoToLocalInput('not-a-date')).toBe('');
  });

  it('formate une ISO en valeur datetime-local locale', () => {
    // Utilise une date locale fixe pour éviter la dépendance au fuseau horaire
    // du runner CI. On crée la date localement puis on vérifie l'aller-retour.
    const d = new Date(2025, 5, 15, 14, 30, 0); // 15 juin 2025 14:30 heure locale
    const result = isoToLocalInput(d.toISOString());
    expect(result).toBe('2025-06-15T14:30');
  });
});

describe('localInputToIso', () => {
  it('retourne "" pour une chaîne vide', () => {
    expect(localInputToIso('')).toBe('');
  });

  it('retourne "" pour une valeur invalide', () => {
    expect(localInputToIso('invalid')).toBe('');
  });

  it('parse une valeur datetime-local en ISO', () => {
    const input = '2025-06-15T14:30';
    const result = localInputToIso(input);
    expect(result).not.toBe('');
    const d = new Date(result);
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(5); // juin = 5
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
  });

  it('aller-retour isoToLocalInput → localInputToIso → même heure locale', () => {
    const original = new Date(2025, 11, 25, 9, 0, 0); // 25 déc. 2025 09:00
    const localStr = isoToLocalInput(original.toISOString());
    const backIso = localInputToIso(localStr);
    const roundTripped = new Date(backIso);
    expect(roundTripped.getHours()).toBe(9);
    expect(roundTripped.getMinutes()).toBe(0);
  });
});

describe('defaultSlot', () => {
  it('retourne start à 12:00 quand task est null', () => {
    const { start } = defaultSlot(null);
    expect(start).toMatch(/T12:00$/);
  });

  it('utilise la deadline de la tâche comme date de base', () => {
    const d = new Date(2025, 3, 10, 0, 0, 0); // 10 avr. 2025
    const task = { deadline: d.toISOString(), estimatedTime: 60 } as Parameters<typeof defaultSlot>[0];
    const { start } = defaultSlot(task);
    // La date extraite doit être le 10 avril
    expect(start).toMatch(/^2025-04-10/);
    expect(start).toMatch(/T12:00$/);
  });

  it('end = start + estimatedTime minutes', () => {
    const d = new Date(2025, 3, 10, 0, 0, 0);
    const task = { deadline: d.toISOString(), estimatedTime: 90 } as Parameters<typeof defaultSlot>[0];
    const { start, end } = defaultSlot(task);
    // start est 12:00, end doit être 13:30
    expect(start).toMatch(/T12:00$/);
    expect(end).toMatch(/T13:30$/);
  });

  it('utilise 60 min par défaut si estimatedTime absent', () => {
    const d = new Date(2025, 3, 10, 0, 0, 0);
    const task = { deadline: d.toISOString() } as Parameters<typeof defaultSlot>[0];
    const { start, end } = defaultSlot(task);
    expect(start).toMatch(/T12:00$/);
    expect(end).toMatch(/T13:00$/);
  });

  it('start et end ne sont jamais vides (task valide)', () => {
    const d = new Date(2025, 0, 1, 0, 0, 0);
    const task = { deadline: d.toISOString(), estimatedTime: 30 } as Parameters<typeof defaultSlot>[0];
    const { start, end } = defaultSlot(task);
    expect(start).not.toBe('');
    expect(end).not.toBe('');
  });
});

describe('canSave (logique de validation)', () => {
  // canSave = title.trim().length > 0 && !!start && !!end
  // Pas de gate sur start < end — à documenter comme limitation connue.
  const canSave = (title: string, start: string, end: string) =>
    title.trim().length > 0 && !!start && !!end;

  it('false si titre vide', () => {
    expect(canSave('', '2025-06-15T12:00', '2025-06-15T13:00')).toBe(false);
    expect(canSave('   ', '2025-06-15T12:00', '2025-06-15T13:00')).toBe(false);
  });

  it('false si start manquant', () => {
    expect(canSave('Mon événement', '', '2025-06-15T13:00')).toBe(false);
  });

  it('false si end manquant', () => {
    expect(canSave('Mon événement', '2025-06-15T12:00', '')).toBe(false);
  });

  it('true quand titre + start + end sont fournis', () => {
    expect(canSave('Mon événement', '2025-06-15T12:00', '2025-06-15T13:00')).toBe(true);
  });

  // Limitation connue : start >= end n'est pas validé côté client.
  // Une correction future devrait ajouter : start < end comme condition.
  it('LIMITATION : true même si end <= start (pas de validation chronologique)', () => {
    expect(canSave('Test', '2025-06-15T13:00', '2025-06-15T12:00')).toBe(true);
  });
});

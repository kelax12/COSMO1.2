import { describe, it, expect } from 'vitest';
import {
  formatEventDuration,
  headerTitle,
  submitButtonText,
  getMissingEventFields,
  validateEventRange,
} from './helpers';

describe('formatEventDuration', () => {
  it('returns null when any field is empty', () => {
    expect(formatEventDuration('', '10:00', '2026-01-01', '11:00')).toBeNull();
  });
  it('formats hours and minutes', () => {
    expect(formatEventDuration('2026-01-01', '10:00', '2026-01-01', '11:30')).toBe('1h30min');
  });
  it('formats whole hours', () => {
    expect(formatEventDuration('2026-01-01', '10:00', '2026-01-01', '12:00')).toBe('2h');
  });
  it('formats minutes only', () => {
    expect(formatEventDuration('2026-01-01', '10:00', '2026-01-01', '10:45')).toBe('45 min');
  });
  it('flags an end before start', () => {
    expect(formatEventDuration('2026-01-01', '11:00', '2026-01-01', '10:00')).toBe('⚠️ Fin avant début');
  });
});

describe('headerTitle / submitButtonText', () => {
  it('maps each mode', () => {
    expect(headerTitle('add')).toBe('Ajouter un événement');
    expect(headerTitle('edit')).toBe("Modifier l'événement");
    expect(headerTitle('convert')).toBe('Convertir en événement');
    expect(submitButtonText('add')).toBe('Valider');
    expect(submitButtonText('edit')).toBe('Enregistrer');
    expect(submitButtonText('convert')).toBe('Convertir en événement');
  });
});

describe('getMissingEventFields', () => {
  const full = { title: 'X', startDate: '2026-01-01', endDate: '2026-01-01', startTime: '10:00', endTime: '11:00' };
  it('returns empty when complete', () => {
    expect(getMissingEventFields(full)).toEqual([]);
  });
  it('flags an empty title', () => {
    expect(getMissingEventFields({ ...full, title: '  ' })).toContain('title');
  });
  it('flags a missing date', () => {
    expect(getMissingEventFields({ ...full, endDate: '' })).toContain('date');
  });
  it('flags missing times', () => {
    expect(getMissingEventFields({ ...full, startTime: '', endTime: '' })).toEqual(
      expect.arrayContaining(['startTime', 'endTime'])
    );
  });
});

describe('validateEventRange', () => {
  it('accepts a valid range', () => {
    expect(validateEventRange('2026-01-01T10:00:00', '2026-01-01T11:00:00')).toBe('ok');
  });
  it('rejects an invalid date', () => {
    expect(validateEventRange('not-a-date', '2026-01-01T11:00:00')).toBe('invalid-date');
  });
  it('rejects end <= start', () => {
    expect(validateEventRange('2026-01-01T11:00:00', '2026-01-01T11:00:00')).toBe('end-before-start');
  });
});

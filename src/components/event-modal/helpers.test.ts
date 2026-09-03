import { describe, it, expect } from 'vitest';
import {
  formatEventDuration,
  headerTitleKey,
  submitButtonKey,
  getMissingEventFields,
  validateEventRange,
} from './helpers';

describe('formatEventDuration', () => {
  it('returns null when any field is empty', () => {
    expect(formatEventDuration('', '10:00', '2026-01-01', '11:00')).toBeNull();
  });
  it('formats hours and minutes', () => {
    expect(formatEventDuration('2026-01-01', '10:00', '2026-01-01', '11:30')).toEqual({ kind: 'duration', text: '1h30min' });
  });
  it('formats whole hours', () => {
    expect(formatEventDuration('2026-01-01', '10:00', '2026-01-01', '12:00')).toEqual({ kind: 'duration', text: '2h' });
  });
  it('formats minutes only', () => {
    expect(formatEventDuration('2026-01-01', '10:00', '2026-01-01', '10:45')).toEqual({ kind: 'duration', text: '45 min' });
  });
  // Un FAIT, pas une phrase : la formulation vit au catalogue `eventModal`
  // (revue du 2026-09-02, point 7 — ce module est pur, il n'a pas de locale).
  it('flags an end before start', () => {
    expect(formatEventDuration('2026-01-01', '11:00', '2026-01-01', '10:00')).toEqual({ kind: 'invalid' });
  });
});

describe('headerTitleKey / submitButtonKey', () => {
  it('maps each mode to a catalogue key', () => {
    expect(headerTitleKey('add')).toBe('headerAdd');
    expect(headerTitleKey('edit')).toBe('headerEdit');
    expect(headerTitleKey('convert')).toBe('headerConvert');
    expect(submitButtonKey('add')).toBe('submitAdd');
    expect(submitButtonKey('edit')).toBe('submitEdit');
    // « Convertir » est le même libellé que le titre en mode conversion.
    expect(submitButtonKey('convert')).toBe('headerConvert');
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

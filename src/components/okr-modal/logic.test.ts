import { describe, it, expect } from 'vitest';
import { calcOkrDuration, validKeyResults, type KeyResultForm } from './logic';

describe('calcOkrDuration', () => {
  it('returns null when a date is missing', () => {
    expect(calcOkrDuration('', '2026-02-01')).toBeNull();
    expect(calcOkrDuration('2026-01-01', '')).toBeNull();
  });
  it('flags an end date before the start', () => {
    expect(calcOkrDuration('2026-02-01', '2026-01-01')).toEqual({ text: 'La date doit être dans le futur', isError: true });
  });
  it('formats days under a week', () => {
    expect(calcOkrDuration('2026-01-01', '2026-01-04')).toEqual({ text: '3j', isError: false });
  });
  it('formats weeks (+ remaining days)', () => {
    expect(calcOkrDuration('2026-01-01', '2026-01-11')).toEqual({ text: '1 sem. 3j', isError: false }); // 10 days
  });
  it('formats months (+ remaining days)', () => {
    expect(calcOkrDuration('2026-01-01', '2026-03-07')).toEqual({ text: '2 mois 5j', isError: false }); // 65 days
  });
});

describe('validKeyResults', () => {
  const kr = (over: Partial<KeyResultForm> = {}): KeyResultForm =>
    ({ title: 'KR', targetValue: '10', currentValue: '0', estimatedTime: '30', weight: '1', ...over });

  it('keeps KRs with a title and positive numeric target', () => {
    expect(validKeyResults([kr(), kr({ title: 'B', targetValue: '5' })])).toHaveLength(2);
  });
  it('drops KRs with an empty title', () => {
    expect(validKeyResults([kr({ title: '  ' })])).toHaveLength(0);
  });
  it('drops KRs with a zero or missing target', () => {
    expect(validKeyResults([kr({ targetValue: '0' }), kr({ targetValue: '' })])).toHaveLength(0);
  });
});

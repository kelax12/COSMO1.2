import { describe, it, expect, vi, beforeEach } from 'vitest';
import { warnIfTruncated } from './pagination.warning';
import { toast } from 'sonner';

vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }));

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('warnIfTruncated', () => {
  it('returns rows unchanged and does NOT warn below the limit', () => {
    const rows = [1, 2, 3];
    expect(warnIfTruncated(rows, 5000, 'categories')).toBe(rows);
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('warns once when rows reach the limit, then dedupes per table', () => {
    const rows = new Array(10).fill(0);
    warnIfTruncated(rows, 10, 'tasks');
    expect(toast.warning).toHaveBeenCalledTimes(1);
    // Second call for the same table is deduped (module-level `warned` set).
    warnIfTruncated(rows, 10, 'tasks');
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });

  it('uses a friendly label and still returns the rows', () => {
    const rows = new Array(3).fill(0);
    const out = warnIfTruncated(rows, 3, 'habits');
    expect(out).toBe(rows);
    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining('habitudes'),
      expect.objectContaining({ description: expect.any(String) }),
    );
  });
});

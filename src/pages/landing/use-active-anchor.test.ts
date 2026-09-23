import { describe, it, expect } from 'vitest';
import { pickActiveAnchor } from './use-active-anchor';

describe('pickActiveAnchor', () => {
  const LINE = 100;

  it('ne désigne rien au-dessus de la première section (le hero)', () => {
    expect(pickActiveAnchor([{ id: 'features', top: 400, bottom: 1400 }], LINE)).toBeNull();
  });

  it('désigne la section qui traverse la ligne de lecture', () => {
    expect(
      pickActiveAnchor(
        [
          { id: 'features', top: -600, bottom: 400 },
          { id: 'solutions', top: 400, bottom: 900 },
        ],
        LINE,
      ),
    ).toBe('features');
  });

  it('prend la DERNIÈRE quand deux sections se chevauchent sur la ligne', () => {
    expect(
      pickActiveAnchor(
        [
          { id: 'features', top: -900, bottom: 101 },
          { id: 'solutions', top: 99, bottom: 700 },
        ],
        LINE,
      ),
    ).toBe('solutions');
  });

  it('ne désigne rien entre deux sections (un bloc sans ancre sous la ligne)', () => {
    expect(
      pickActiveAnchor(
        [
          { id: 'features', top: -900, bottom: 50 },
          { id: 'solutions', top: 300, bottom: 900 },
        ],
        LINE,
      ),
    ).toBeNull();
  });

  it('borne basse exclusive : une section dont le bas EST la ligne est finie', () => {
    expect(pickActiveAnchor([{ id: 'faq', top: -500, bottom: LINE }], LINE)).toBeNull();
    expect(pickActiveAnchor([{ id: 'faq', top: LINE, bottom: 800 }], LINE)).toBe('faq');
  });
});

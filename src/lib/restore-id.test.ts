import { describe, it, expect } from 'vitest';
import { splitRestore, type CreateOptions } from './restore-id';

describe('splitRestore', () => {
  it("sort l'identifiant du payload au lieu de le jeter", () => {
    // Les cinq chemins d'annulation ecrivaient `const { id: _id, ...rest }`,
    // qui perdait l'identite de l'objet sans le dire (R-08).
    const snapshot = { id: 'cat-1', name: 'Travail', color: 'blue' };
    const { payload, options } = splitRestore(snapshot);

    expect(options.restoreId).toBe('cat-1');
    expect(payload).toEqual({ name: 'Travail', color: 'blue' });
    expect('id' in payload).toBe(false);
  });

  it('ne mute pas la source', () => {
    const snapshot = { id: 'x', name: 'A' };
    splitRestore(snapshot);
    expect(snapshot).toEqual({ id: 'x', name: 'A' });
  });

  it("garde l'identifiant HORS du payload, c'est tout l'interet", () => {
    // Le payload est ce qui traverse `mapToDb`. Y laisser `id` rouvrirait
    // l'oracle d'existence que le test de garde des repositories refuse.
    const { payload, options }: { payload: Record<string, unknown>; options: CreateOptions } =
      splitRestore({ id: 'evt-9', title: 'Reunion', start: 'a', end: 'b' });
    expect(Object.keys(payload).sort()).toEqual(['end', 'start', 'title']);
    expect(options).toEqual({ restoreId: 'evt-9' });
  });
});

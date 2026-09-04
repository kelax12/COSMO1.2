import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';
import * as monitoring from '@/lib/monitoring';
import { reportRestoreFailure, splitRestore, type CreateOptions } from './restore-id';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
// ⚠️ On mocke `@/lib/monitoring`, plus `@sentry/react` directement : depuis
// l'arbitrage C-13 · C-14, Sentry est charge APRES le premier rendu et
// `monitoring` est la seule porte (elle tamponne ce qui arrive avant). Ce qui
// est teste ici n'a pas change — l'erreur doit REMONTER — seul le chemin a
// change.
vi.mock('@/lib/monitoring', () => ({ captureException: vi.fn() }));

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

// ═══════════════════════════════════════════════════════════════════
// Un « Annuler » qui rate doit se voir (revue du 2026-09-02)
//
// Les cinq hooks se contentaient d'un `console.error`, et le build de
// production SUPPRIME `console.error` (`vite.config.ts → esbuild.pure`). En
// prod, une restauration ratée ne produisait donc rien du tout : la personne
// repartait en croyant son objet revenu.
// ═══════════════════════════════════════════════════════════════════
describe('reportRestoreFailure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche un toast traduit ET remonte l\'erreur à Sentry', () => {
    const error = new Error('Cette ressource existe déjà.');
    reportRestoreFailure('task', error);

    expect(toast.error).toHaveBeenCalledTimes(1);
    const shown = vi.mocked(toast.error).mock.calls[0][0];
    expect(String(shown)).toContain('restaurer la tâche');
    expect(String(shown)).toContain('Cette ressource existe déjà.');

    expect(monitoring.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ tags: expect.objectContaining({ context: 'restore-undo', restore_entity: 'task' }) }),
    );
  });

  it.each([
    ['category', 'catégorie'],
    ['list', 'liste'],
    ['event', 'événement'],
    ['okr', 'objectif'],
  ] as const)('nomme l\'entité restaurée : %s', (entity, fragment) => {
    reportRestoreFailure(entity, new Error('boom'));
    expect(String(vi.mocked(toast.error).mock.calls[0][0])).toContain(fragment);
  });
});

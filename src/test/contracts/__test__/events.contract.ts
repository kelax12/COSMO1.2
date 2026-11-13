// Contrat de `IEventsRepository` (agenda PERSONNEL), joué contre la démo et
// contre Supabase. Cadre et règle des divergences : `./harness.ts`.
//
// Périmètre : lecture, fenêtre, filtres, pagination, création, mise à jour,
// suppression, restauration. NON couvert : `getWindowForUser` et `createForUser`
// (agenda d'un subordonné), qui exigent une hiérarchie d'organisation à deux
// comptes ; leur frontière est la RLS `events_manager_*` (mig. 077), jouée par
// les tests `e2e/rls/`.
//
// 🔴 Chaque cas range ses événements dans une ANNÉE qui lui est propre : le
// même compte porte tous les événements de la suite, et un filtre par dates ne
// doit jamais attraper ceux d'un autre cas (ni le seed de la démo, en 2026).
import { describe, expect, beforeAll } from 'vitest';
import type { IEventsRepository } from '@/modules/events/repository';
import type { CalendarEvent, CreateEventInput } from '@/modules/events/types';
import { contractCase, rejects, unique, type ContractOptions } from './harness';

export interface EventsContractContext {
  repo: IEventsRepository;
  /** Identifiant d'une tâche existante (la colonne `task_id` est une clé étrangère). */
  newTaskId: () => Promise<string>;
}

const pad = (n: number): string => String(n).padStart(2, '0');
/** Instant UTC `YYYY-MM-DDTHH:00:00.000Z`, le format que l'application écrit (`toISOString`). */
const at = (year: number, month: number, day: number, hour = 10): string =>
  `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:00:00.000Z`;
const instant = (iso: string | undefined): number => Date.parse(iso ?? '');

const input = (year: number, over: Partial<CreateEventInput> = {}): CreateEventInput => ({
  title: unique('Contrat événement'),
  start: at(year, 3, 10, 10),
  end: at(year, 3, 10, 11),
  ...over,
});

export function eventsContract(side: string, make: () => Promise<EventsContractContext>, opts?: ContractOptions): void {
  describe(`contrat IEventsRepository · ${side}`, () => {
    let repo: IEventsRepository;
    let newTaskId: () => Promise<string>;
    beforeAll(async () => {
      ({ repo, newTaskId } = await make());
    });

    const find = async (id: string): Promise<CalendarEvent | undefined> => (await repo.getAll()).find((e) => e.id === id);

    contractCase(opts, 'crée puis relit un événement, champ par champ', async () => {
      const created = await repo.create(
        input(2061, { title: 'Relire le contrat', color: '#3B82F6', description: 'Détail', notes: 'Une note' }),
      );
      const read = await find(created.id);
      expect(read).toBeDefined();
      expect({
        title: read!.title,
        start: instant(read!.start),
        end: instant(read!.end),
        color: read!.color,
        description: read!.description,
        notes: read!.notes,
        taskId: read!.taskId ?? null,
        recurrence: read!.recurrence,
        recurrenceDays: read!.recurrenceDays,
        exceptions: read!.exceptions,
        isPrivate: read!.isPrivate,
        reviewDismissedAt: read!.reviewDismissedAt,
      }).toEqual({
        title: 'Relire le contrat',
        start: instant(at(2061, 3, 10, 10)),
        end: instant(at(2061, 3, 10, 11)),
        color: '#3B82F6',
        description: 'Détail',
        notes: 'Une note',
        taskId: null,
        recurrence: 'none',
        recurrenceDays: [],
        exceptions: [],
        isPrivate: false,
        reviewDismissedAt: null,
      });
    });

    contractCase(opts, 'met à jour un événement et relit la valeur écrite', async () => {
      const created = await repo.create(input(2062, { color: '#3B82F6' }));
      const updated = await repo.update(created.id, {
        title: 'Renommé',
        notes: 'Ajoutée',
        end: at(2062, 3, 10, 12),
        isPrivate: true,
      });
      expect([updated.title, updated.notes, instant(updated.end), updated.isPrivate]).toEqual([
        'Renommé',
        'Ajoutée',
        instant(at(2062, 3, 10, 12)),
        true,
      ]);
      const read = await find(created.id);
      expect([read!.title, read!.notes, instant(read!.end), read!.isPrivate, read!.color]).toEqual([
        'Renommé',
        'Ajoutée',
        instant(at(2062, 3, 10, 12)),
        true,
        '#3B82F6',
      ]);
    });

    contractCase(opts, 'la récurrence personnalisée, ses jours et ses exceptions se relisent', async () => {
      const created = await repo.create(
        input(2063, { recurrence: 'custom', recurrenceDays: [1, 3], exceptions: ['2063-03-12'] }),
      );
      const read = await find(created.id);
      expect([read!.recurrence, read!.recurrenceDays, read!.exceptions]).toEqual(['custom', [1, 3], ['2063-03-12']]);
      const updated = await repo.update(created.id, { exceptions: ['2063-03-12', '2063-03-19'] });
      expect(updated.exceptions).toEqual(['2063-03-12', '2063-03-19']);
    });

    // `reviewDismissedAt: null` est une valeur SIGNIFIANTE (« ne plus ignorer ce créneau »).
    contractCase(opts, 'ignorer un créneau pose l’instant, le reporter le remet à null', async () => {
      const created = await repo.create(input(2064));
      const dismissed = at(2064, 3, 10, 12);
      await repo.update(created.id, { reviewDismissedAt: dismissed });
      expect(instant((await find(created.id))!.reviewDismissedAt ?? undefined)).toBe(instant(dismissed));
      await repo.update(created.id, { reviewDismissedAt: null });
      expect((await find(created.id))!.reviewDismissedAt).toBeNull();
    });

    contractCase(opts, 'une fin antérieure au début est refusée, à la création comme à la mise à jour', async () => {
      expect(await rejects(repo.create(input(2065, { start: at(2065, 3, 10, 11), end: at(2065, 3, 10, 10) })))).toBe(true);
      const created = await repo.create(input(2065));
      expect(await rejects(repo.update(created.id, { end: at(2065, 3, 10, 9) }))).toBe(true);
      expect(instant((await find(created.id))!.end)).toBe(instant(at(2065, 3, 10, 11)));
    });

    contractCase(opts, 'une récurrence hors énumération est refusée', async () => {
      expect(await rejects(repo.create(input(2066, { recurrence: 'monthly' as never })))).toBe(true);
    });

    contractCase(opts, '« Annuler » recrée l’événement sous son identifiant d’origine (R-08)', async () => {
      const created = await repo.create(input(2067));
      await repo.delete(created.id);
      const restored = await repo.create(input(2067, { title: created.title }), { restoreId: created.id });
      expect(restored.id).toBe(created.id);
      expect((await find(created.id))?.title).toBe(created.title);
    });

    contractCase(opts, 'supprimer retire l’événement de toutes les lectures', async () => {
      const created = await repo.create(input(2068));
      await repo.delete(created.id);
      expect(await find(created.id)).toBeUndefined();
      const window = await repo.getWindow(at(2068, 3, 1, 0), at(2068, 3, 31, 0));
      expect(window.map((e) => e.id)).not.toContain(created.id);
    });

    contractCase(opts, 'un identifiant inconnu : mise à jour refusée, suppression sans effet', async () => {
      const ghost = crypto.randomUUID();
      expect(await rejects(repo.update(ghost, { title: 'fantôme' }))).toBe(true);
      expect(await rejects(repo.delete(ghost))).toBe(false);
    });

    contractCase(opts, 'getAll rend les événements par début croissant', async () => {
      const late = await repo.create(input(2069, { start: at(2069, 3, 12, 10), end: at(2069, 3, 12, 11) }));
      const early = await repo.create(input(2069, { start: at(2069, 3, 10, 10), end: at(2069, 3, 10, 11) }));
      const middle = await repo.create(input(2069, { start: at(2069, 3, 11, 10), end: at(2069, 3, 11, 11) }));
      const mine = new Set([late.id, early.id, middle.id]);
      expect((await repo.getAll()).filter((e) => mine.has(e.id)).map((e) => e.id)).toEqual([early.id, middle.id, late.id]);
    });

    // PER-01 : l'export de portabilité ne passe par aucun plafond.
    contractCase(opts, 'getAllForExport rend tous les événements, y compris loin dans le temps', async () => {
      const far = await repo.create(input(2073, { start: at(2073, 3, 10, 10), end: at(2073, 3, 10, 11) }));
      const exported = await repo.getAllForExport();
      expect(exported.map((e) => e.id)).toContain(far.id);
      expect(new Set(exported.map((e) => e.id)).size, 'aucune ligne en double entre deux pages').toBe(exported.length);
    });

    contractCase(opts, 'getWindow rend ce qui chevauche la fenêtre, bornes comprises, et tous les récurrents', async () => {
      const year = 2070;
      const inside = await repo.create(input(year, { start: at(year, 3, 10, 10), end: at(year, 3, 10, 11) }));
      const straddling = await repo.create(input(year, { start: at(year, 3, 9, 23), end: at(year, 3, 10, 1) }));
      const touching = await repo.create(input(year, { start: at(year, 3, 9, 22), end: at(year, 3, 10, 0) }));
      const before = await repo.create(input(year, { start: at(year, 3, 8, 10), end: at(year, 3, 8, 11) }));
      const after = await repo.create(input(year, { start: at(year, 3, 12, 10), end: at(year, 3, 12, 11) }));
      const recurring = await repo.create(
        input(year, { start: at(2000, 1, 1, 10), end: at(2000, 1, 1, 11), recurrence: 'daily' }),
      );
      const mine = new Set([inside.id, straddling.id, touching.id, before.id, after.id, recurring.id]);
      const window = await repo.getWindow(at(year, 3, 10, 0), at(year, 3, 11, 0));
      const ids = window.filter((e) => mine.has(e.id)).map((e) => e.id);
      expect(new Set(ids)).toEqual(new Set([inside.id, straddling.id, touching.id, recurring.id]));
      // Début croissant : l'ordre de la base.
      const starts = window.filter((e) => mine.has(e.id)).map((e) => instant(e.start));
      expect(starts).toEqual([...starts].sort((a, b) => a - b));
    });

    contractCase(opts, 'getFiltered par tâche ne rend que les événements de cette tâche', async () => {
      const taskId = await newTaskId();
      const linked = await repo.create(input(2071, { taskId }));
      await repo.create(input(2071));
      const filtered = await repo.getFiltered({ taskId });
      expect(filtered.map((e) => e.id)).toEqual([linked.id]);
      expect(filtered[0].taskId).toBe(taskId);
    });

    contractCase(opts, 'getFiltered par bornes de début et de fin, bornes comprises', async () => {
      const year = 2072;
      const a = await repo.create(input(year, { start: at(year, 3, 10, 10), end: at(year, 3, 10, 11) }));
      const b = await repo.create(input(year, { start: at(year, 3, 11, 10), end: at(year, 3, 11, 11) }));
      const c = await repo.create(input(year, { start: at(year, 3, 12, 10), end: at(year, 3, 12, 11) }));
      const ids = async (f: Parameters<IEventsRepository['getFiltered']>[0]): Promise<string[]> =>
        (await repo.getFiltered(f)).map((e) => e.id);
      const startA = at(year, 3, 10, 10);
      const startB = at(year, 3, 11, 10);
      const startC = at(year, 3, 12, 10);
      const endB = at(year, 3, 11, 11);
      const endC = at(year, 3, 12, 11);
      expect(await ids({ startAfter: startA, startBefore: startB }), 'début compris dans [a, b]').toEqual([a.id, b.id]);
      expect(await ids({ startAfter: startB, startBefore: startC }), 'début compris dans [b, c]').toEqual([b.id, c.id]);
      expect(await ids({ endAfter: endB, endBefore: endC }), 'fin comprise dans [b, c]').toEqual([b.id, c.id]);
      expect(await ids({ startAfter: at(year, 3, 10, 11), endBefore: at(year, 3, 11, 12) }), 'les deux').toEqual([b.id]);
    });

    contractCase(opts, 'getPage pagine du début le plus tardif au plus ancien, curseur compris', async () => {
      const year = 2099;
      const a = await repo.create(input(year, { start: at(year, 12, 10, 10), end: at(year, 12, 10, 11) }));
      const b = await repo.create(input(year, { start: at(year, 12, 20, 10), end: at(year, 12, 20, 11) }));
      const c = await repo.create(input(year, { start: at(year, 12, 30, 10), end: at(year, 12, 30, 11) }));
      const first = await repo.getPage({ limit: 2 });
      expect(first.data.map((e) => e.id)).toEqual([c.id, b.id]);
      expect(first.hasMore).toBe(true);
      const second = await repo.getPage({
        limit: 2,
        cursor: first.nextCursor ?? undefined,
        cursorDate: first.nextCursorDate ?? undefined,
      });
      expect(second.data[0]?.id).toBe(a.id);
    });
  });
}

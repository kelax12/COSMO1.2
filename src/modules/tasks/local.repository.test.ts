// @vitest-environment jsdom
// Couverture métier (audit P0a) : LocalStorageTasksRepository (démo) —
// CRUD, filtres (champs canoniques B6 : completed/bookmarked/deadline),
// toggles, pagination.
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageTasksRepository } from './local.repository';
import { dependencyErrorCode, DEPENDENCY_ERRORS } from './dependency-errors';

let repo: LocalStorageTasksRepository;
beforeEach(() => {
  localStorage.clear();
  repo = new LocalStorageTasksRepository();
});

describe('lecture & seeds', () => {
  it('seede les tâches démo au premier accès', async () => {
    const all = await repo.getAll();
    expect(all.length).toBeGreaterThanOrEqual(10);
    expect((await repo.getById('t002'))?.name).toBe('Préparer présentation Q1 2026');
    expect(await repo.getById('absent')).toBeNull();
  });

  it('getFiltered : completed / bookmarked / category / priorité', async () => {
    await repo.getAll();
    expect((await repo.getFiltered({ completed: true })).every((t) => t.completed)).toBe(true);
    expect((await repo.getFiltered({ bookmarked: true })).every((t) => t.bookmarked)).toBe(true);
    expect((await repo.getFiltered({ category: 'cat-3' })).every((t) => t.category === 'cat-3')).toBe(true);
    const p5 = await repo.getFiltered({ priorityMin: 5, priorityMax: 5 });
    expect(p5.every((t) => t.priority === 5)).toBe(true);
  });

  it('getByDate matche sur la partie date de la deadline', async () => {
    localStorage.clear();
    const created = await repo.create({
      name: 'Daté', priority: 3, category: 'cat-1', deadline: '2026-08-20T09:00:00.000Z', estimatedTime: 30,
    } as never);
    const res = await repo.getByDate('2026-08-20');
    expect(res.some((t) => t.id === created.id)).toBe(true);
  });
});

describe('écriture', () => {
  it('create applique les défauts et préfixe la liste', async () => {
    await repo.getAll();
    const created = await repo.create({
      name: 'Nouvelle', priority: 2, category: 'cat-2', deadline: '2026-09-01T00:00:00.000Z', estimatedTime: 15,
    } as never);
    expect(created.id).toBeTruthy();
    expect(created.completed).toBe(false);
    expect(created.bookmarked).toBe(false);
    expect(created.pendingInvites).toEqual([]);
    expect((await repo.getAll())[0].id).toBe(created.id);
  });

  it('update modifie / throw si introuvable', async () => {
    await repo.getAll();
    expect((await repo.update('t002', { name: 'Renommée' })).name).toBe('Renommée');
    await expect(repo.update('absent', { name: 'x' })).rejects.toThrow();
  });

  it('delete supprime / throw si introuvable', async () => {
    await repo.getAll();
    await repo.delete('t010');
    expect(await repo.getById('t010')).toBeNull();
    await expect(repo.delete('absent')).rejects.toThrow();
  });

  it('toggleComplete bascule completed + completedAt', async () => {
    await repo.getAll();
    const done = await repo.toggleComplete('t002'); // t002 non complétée
    expect(done.task.completed).toBe(true);
    expect(done.task.completedAt).toBeTruthy();
    const undone = await repo.toggleComplete('t002');
    expect(undone.task.completed).toBe(false);
    expect(undone.task.completedAt).toBeUndefined();
    await expect(repo.toggleComplete('absent')).rejects.toThrow();
  });

  it('toggleBookmark bascule bookmarked', async () => {
    await repo.getAll();
    const before = (await repo.getById('t003'))!.bookmarked;
    const after = await repo.toggleBookmark('t003');
    expect(after.bookmarked).toBe(!before);
    await expect(repo.toggleBookmark('absent')).rejects.toThrow();
  });

  it('getPage pagine avec curseur', async () => {
    await repo.getAll();
    const p1 = await repo.getPage({ limit: 5 });
    expect(p1.data).toHaveLength(5);
    expect(p1.hasMore).toBe(true);
    const p2 = await repo.getPage({ limit: 5, cursor: p1.nextCursor! });
    expect(p2.data[0].id).not.toBe(p1.data[0].id);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Récurrence — parité démo/prod (audit archi 2026-08-07, H1)
//
// La génération de l'occurrence suivante existe en DEUX exemplaires : la RPC
// `toggle_task_complete_v2` (mig. 086) et ce repository LocalStorage. C'est la
// duplication structurelle imposée par le mode démo (cf. CLAUDE.md,
// `recordKRCompletion`). Ces tests verrouillent l'invariant qui compte —
// l'IDEMPOTENCE — pour que les deux implémentations ne divergent pas en
// silence. Côté serveur c'est l'index unique `ux_tasks_recurrence_parent` ;
// ici c'est la recherche d'un enfant existant.
// ═══════════════════════════════════════════════════════════════════
describe('récurrence : génération de l\'occurrence suivante', () => {
  const seedRecurring = async () => {
    await repo.getAll();
    return repo.create({
      name: 'Réunion hebdo',
      description: 'Point équipe',
      priority: 3,
      category: 'cat-1',
      deadline: '2026-06-15',
      estimatedTime: 60,
      bookmarked: false,
      completed: false,
      recurrence: 'weekly',
      subtasks: [{ id: 's1', title: 'Préparer l\'ordre du jour', completed: true }],
    } as never);
  };

  it('génère l\'occurrence suivante à la validation, décochée et rattachée au parent', async () => {
    const parent = await seedRecurring();
    const { spawned } = await repo.toggleComplete(parent.id, '2026-06-22');

    expect(spawned).not.toBeNull();
    expect(spawned!.deadline).toBe('2026-06-22');
    expect(spawned!.completed).toBe(false);
    expect(spawned!.recurrenceParentId).toBe(parent.id);
    expect(spawned!.name).toBe('Réunion hebdo');
    // Les sous-tâches sont reportées mais DÉCOCHÉES (parité SQL).
    expect(spawned!.subtasks?.every((s) => !s.completed)).toBe(true);
  });

  it('est IDEMPOTENT : décocher puis recocher ne crée pas de doublon', async () => {
    const parent = await seedRecurring();

    await repo.toggleComplete(parent.id, '2026-06-22'); // validée → 1 occurrence
    await repo.toggleComplete(parent.id, '2026-06-22'); // dé-validée → retirée
    await repo.toggleComplete(parent.id, '2026-06-22'); // re-validée → 1 occurrence

    const children = (await repo.getAll()).filter((t) => t.recurrenceParentId === parent.id);
    expect(children).toHaveLength(1);
  });

  it('ne génère rien pour une tâche non récurrente ni sans date calculée', async () => {
    await repo.getAll();
    expect((await repo.toggleComplete('t002', '2026-06-22')).spawned).toBeNull(); // recurrence 'none'

    const parent = await seedRecurring();
    expect((await repo.toggleComplete(parent.id, null)).spawned).toBeNull();
  });

  it('la dé-validation ne supprime PAS une occurrence déjà retravaillée', async () => {
    const parent = await seedRecurring();
    const { spawned } = await repo.toggleComplete(parent.id, '2026-06-22');

    // L'utilisateur modifie l'occurrence : elle lui appartient désormais.
    await repo.update(spawned!.id, { name: 'Réunion hebdo (agenda revu)', updatedAt: new Date(Date.now() + 5000).toISOString() } as never);

    await repo.toggleComplete(parent.id, '2026-06-22'); // dé-validation

    const survivor = await repo.getById(spawned!.id);
    expect(survivor).not.toBeNull();
    // Détachée du parent, mais conservée.
    expect(survivor!.recurrenceParentId).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Dépendances (mig. 132) — parité démo / production
//
// Les invariants sont tenus par des TRIGGERS en production. Le mode démo n'en
// a pas : s'ils ne sont pas reproduits ici, la démo laisse construire un
// graphe que la production refuserait, et le bug ne se voit qu'à la
// conversion en compte réel.
// ═══════════════════════════════════════════════════════════════════

describe('dépendances', () => {
  it('ajoute une arête, la relit, et ignore un doublon', async () => {
    await repo.getAll();
    expect(await repo.getDependencies()).toEqual([]);

    await repo.addDependency('t013', 't002');
    await repo.addDependency('t013', 't002');

    expect(await repo.getDependencies()).toEqual([{ taskId: 't013', dependsOnId: 't002' }]);
  });

  // ⚠️ C-48 — ces trois refus s'assertaient sur le TEXTE anglais du message
  // (`/itself/`, `/must exist/`, `/cycle/`). C'est exactement ce que la règle
  // « ne jamais identifier une erreur par son message » interdit : le message
  // vient désormais du catalogue, donc il est TRADUIT, et un test qui le lit
  // casserait au premier changement de langue ou de formulation. On asserte
  // l'IDENTIFIANT, qui est le contrat partagé avec les triggers (mig. 137).

  it('refuse une tâche qui dépendrait d elle-même', async () => {
    await repo.getAll();
    // Une auto-dépendance EST un cycle de longueur 1 : même identifiant que la
    // contrainte `task_dependencies_no_self` de la mig. 132.
    const err = await repo.addDependency('t013', 't013').catch((e) => e);
    expect(dependencyErrorCode(err)).toBe(DEPENDENCY_ERRORS.cycle);
  });

  it('refuse une arête vers une tâche inexistante', async () => {
    await repo.getAll();
    const err = await repo.addDependency('t013', 'absente').catch((e) => e);
    expect(dependencyErrorCode(err)).toBe(DEPENDENCY_ERRORS.taskMissing);
  });

  it('refuse un cycle INDIRECT, comme le trigger', async () => {
    await repo.getAll();
    // t013 ← t002 ← t003 : rendre t013 dépendante de t003 referme la boucle.
    await repo.addDependency('t002', 't013');
    await repo.addDependency('t003', 't002');
    const err = await repo.addDependency('t013', 't003').catch((e) => e);
    expect(dependencyErrorCode(err)).toBe(DEPENDENCY_ERRORS.cycle);
    expect(await repo.getDependencies()).toHaveLength(2);
  });

  it('retire une arête, et ne se plaint pas d une arête absente', async () => {
    await repo.getAll();
    await repo.addDependency('t013', 't002');
    await repo.removeDependency('t013', 't002');
    await repo.removeDependency('t013', 't002');
    expect(await repo.getDependencies()).toEqual([]);
  });

  it('supprimer une tâche emporte ses arêtes (parité ON DELETE CASCADE)', async () => {
    await repo.getAll();
    await repo.addDependency('t013', 't002');
    await repo.addDependency('t003', 't013');

    await repo.delete('t013');

    expect(await repo.getDependencies()).toEqual([]);
  });

  it('repart d un graphe vide si le stockage est corrompu (B14)', async () => {
    localStorage.setItem('cosmo_demo_task_dependencies', '{pas du json');
    expect(await repo.getDependencies()).toEqual([]);
  });
});

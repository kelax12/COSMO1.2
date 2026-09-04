// @vitest-environment jsdom
// Couverture métier (audit P0a) : LocalStorageOKRsRepository (mode démo).
// Couvre les invariants critiques CLAUDE.md :
//   - journal append-only kr_completions à create/update/updateKeyResult ;
//   - guard targetValue>0 sur le recalcul de progression (B17) ;
//   - whitelist des champs updatables (B19) ;
//   - symétrie reps ± (append/remove) selon le delta de currentValue.
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageOKRsRepository } from './repository';
import { OKRS_STORAGE_KEY } from './constants';
import { KR_COMPLETIONS_STORAGE_KEY, MAX_REPS_PER_WRITE } from '@/modules/kr-completions/constants';
import type { OKR, KeyResult } from './types';
import type { KRCompletion } from '@/modules/kr-completions/types';

const kr = (over: Partial<KeyResult> = {}): KeyResult => ({
  id: 'kr-' + Math.random().toString(36).slice(2, 7),
  title: 'KR', currentValue: 0, targetValue: 100, unit: '', completed: false,
  estimatedTime: 0, completedAt: null, ...over,
});

const okr = (over: Partial<OKR> = {}): OKR => ({
  id: 'okr-' + Math.random().toString(36).slice(2, 7),
  title: 'Objectif', description: '', category: 'cat-1', progress: 0,
  completed: false, keyResults: [], startDate: '2026-01-01', endDate: '2026-12-31', ...over,
});

const seedOkrs = (rows: OKR[]) => localStorage.setItem(OKRS_STORAGE_KEY, JSON.stringify(rows));
const journal = (): KRCompletion[] => {
  const raw = localStorage.getItem(KR_COMPLETIONS_STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
};

let repo: LocalStorageOKRsRepository;
beforeEach(() => {
  localStorage.clear();
  repo = new LocalStorageOKRsRepository();
});

describe('lecture & seed', () => {
  it('seede les OKR démo au premier accès', async () => {
    const all = await repo.getAll();
    expect(all.length).toBeGreaterThan(0);
    expect(localStorage.getItem(OKRS_STORAGE_KEY)).not.toBeNull();
  });

  it('migre les anciens IDs de catégorie au chargement', async () => {
    seedOkrs([okr({ id: 'o1', category: 'health' })]);
    const all = await repo.getAll();
    expect(all[0].category).toBe('cat-3'); // health → cat-3
    // Persisté (migration sauvegardée).
    expect(JSON.parse(localStorage.getItem(OKRS_STORAGE_KEY)!)[0].category).toBe('cat-3');
  });

  it('getById / getByCategory / getFiltered', async () => {
    seedOkrs([
      okr({ id: 'o1', category: 'cat-1', completed: false, startDate: '2026-02-01', endDate: '2026-06-30' }),
      okr({ id: 'o2', category: 'cat-2', completed: true, startDate: '2026-03-01', endDate: '2026-08-31' }),
    ]);
    expect((await repo.getById('o1'))?.id).toBe('o1');
    expect(await repo.getById('nope')).toBeNull();
    expect((await repo.getByCategory('cat-2')).map((o) => o.id)).toEqual(['o2']);
    expect((await repo.getFiltered({ completed: true })).map((o) => o.id)).toEqual(['o2']);
    expect((await repo.getFiltered({ startAfter: '2026-02-15' })).map((o) => o.id)).toEqual(['o2']);
    expect((await repo.getFiltered({ endBefore: '2026-07-01' })).map((o) => o.id)).toEqual(['o1']);
  });

  it('getPage pagine avec curseur et hasMore', async () => {
    seedOkrs([okr({ id: 'o1' }), okr({ id: 'o2' }), okr({ id: 'o3' })]);
    const p1 = await repo.getPage({ limit: 2 });
    expect(p1.data.map((o) => o.id)).toEqual(['o1', 'o2']);
    expect(p1.hasMore).toBe(true);
    expect(p1.nextCursor).toBe('o2');
    const p2 = await repo.getPage({ limit: 2, cursor: 'o2' });
    expect(p2.data.map((o) => o.id)).toEqual(['o3']);
    expect(p2.hasMore).toBe(false);
  });
});

describe('create — journal append-only', () => {
  it("génère un id et NE journalise PAS la valeur initiale (état de base, pas des reps du jour)", async () => {
    seedOkrs([]);
    const created = await repo.create({
      title: 'Nouveau', description: '', category: 'cat-1', progress: 0, completed: false,
      startDate: '2026-01-01', endDate: '2026-12-31',
      keyResults: [kr({ id: 'k1', currentValue: 3, targetValue: 5 }), kr({ id: 'k2', currentValue: 0 })],
    });
    expect(created.id).toBeTruthy();
    // Aucune rep journalisée à la création — seuls les incréments ultérieurs
    // (update/updateKeyResult) le sont (cf. repository.ts:273-277).
    const j = journal();
    expect(j.filter((c) => c.krId === 'k1')).toHaveLength(0);
    expect(j.filter((c) => c.krId === 'k2')).toHaveLength(0);
  });
});

describe('update — whitelist + delta journal', () => {
  it('ignore les champs hors whitelist (id non mutable, B19)', async () => {
    seedOkrs([okr({ id: 'o1', title: 'Avant' })]);
    const updated = await repo.update('o1', { title: 'Après', id: 'HACK' } as never);
    expect(updated.id).toBe('o1');
    expect(updated.title).toBe('Après');
  });

  it('journalise le delta positif de currentValue par KR', async () => {
    seedOkrs([okr({ id: 'o1', keyResults: [kr({ id: 'k1', currentValue: 2, targetValue: 10 })] })]);
    await repo.update('o1', { keyResults: [kr({ id: 'k1', currentValue: 5, targetValue: 10 })] });
    // delta = 3 reps.
    expect(journal().filter((c) => c.krId === 'k1')).toHaveLength(3);
  });

  it('throw si OKR introuvable', async () => {
    seedOkrs([]);
    await expect(repo.update('absent', { title: 'x' })).rejects.toThrow();
  });
});

describe('delete', () => {
  it('supprime un OKR existant', async () => {
    seedOkrs([okr({ id: 'o1' }), okr({ id: 'o2' })]);
    await repo.delete('o1');
    expect((await repo.getAll()).map((o) => o.id)).toEqual(['o2']);
  });
  it('throw si OKR introuvable', async () => {
    seedOkrs([okr({ id: 'o1' })]);
    await expect(repo.delete('absent')).rejects.toThrow();
  });
});

describe('updateKeyResult — journal symétrique + guards', () => {
  it('append des reps quand currentValue augmente', async () => {
    seedOkrs([okr({ id: 'o1', keyResults: [kr({ id: 'k1', currentValue: 1, targetValue: 10 })] })]);
    await repo.updateKeyResult('o1', 'k1', { currentValue: 4 });
    expect(journal().filter((c) => c.krId === 'k1')).toHaveLength(3); // +3
  });

  it('retire les reps les plus récentes quand currentValue diminue', async () => {
    // 5 reps journalisées d'avance.
    const completions: KRCompletion[] = Array.from({ length: 5 }, (_, i) => ({
      id: 'c' + i, krId: 'k1', okrId: 'o1', userId: 'demo-user',
      completedAt: `2026-06-0${i + 1}T00:00:00.000Z`, krTitle: 'KR', okrTitle: 'OKR',
    }));
    localStorage.setItem(KR_COMPLETIONS_STORAGE_KEY, JSON.stringify(completions));
    seedOkrs([okr({ id: 'o1', keyResults: [kr({ id: 'k1', currentValue: 5, targetValue: 10 })] })]);
    await repo.updateKeyResult('o1', 'k1', { currentValue: 2 }); // delta -3
    const remaining = journal().filter((c) => c.krId === 'k1');
    expect(remaining).toHaveLength(2);
    // Les plus anciennes restent (c0, c1) ; les 3 plus récentes (c2..c4) retirées.
    expect(remaining.map((c) => c.id).sort()).toEqual(['c0', 'c1']);
  });

  it('guard targetValue=0 → pas de NaN dans progress (B17)', async () => {
    seedOkrs([okr({ id: 'o1', keyResults: [kr({ id: 'k1', currentValue: 0, targetValue: 0 })] })]);
    const res = await repo.updateKeyResult('o1', 'k1', { currentValue: 5 });
    expect(Number.isNaN(res.progress)).toBe(false);
    expect(res.progress).toBe(0);
  });

  it('auto-complète l’OKR quand tous les KR atteignent leur cible + pose completedAt', async () => {
    seedOkrs([okr({ id: 'o1', keyResults: [kr({ id: 'k1', currentValue: 9, targetValue: 10, completed: false })] })]);
    const res = await repo.updateKeyResult('o1', 'k1', { currentValue: 10, completed: true });
    expect(res.completed).toBe(true);
    expect(res.keyResults[0].completedAt).toBeTruthy();
    expect(res.progress).toBe(100);
  });

  it('efface completedAt quand le KR repasse non complété', async () => {
    seedOkrs([okr({ id: 'o1', keyResults: [kr({ id: 'k1', currentValue: 10, targetValue: 10, completed: true, completedAt: '2026-01-01T00:00:00.000Z' })] })]);
    // currentValue redescend sous la cible → completedAt effacé ET OKR non complété
    // (okr.completed est recalculé depuis les valeurs, pas le flag KR).
    const res = await repo.updateKeyResult('o1', 'k1', { completed: false, currentValue: 5 });
    expect(res.keyResults[0].completedAt).toBeNull();
    expect(res.completed).toBe(false);
  });

  it('throw si OKR ou KR introuvable', async () => {
    seedOkrs([okr({ id: 'o1', keyResults: [kr({ id: 'k1' })] })]);
    await expect(repo.updateKeyResult('absent', 'k1', {})).rejects.toThrow();
    await expect(repo.updateKeyResult('o1', 'absent', {})).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// PARITÉ AVEC LE REPOSITORY SUPABASE (audit A-2)
//
// Deux règles du journal n'existaient que côté serveur. Une règle métier
// portée par un seul des deux repositories diverge en silence : c'est
// exactement ce que CLAUDE.md protège déjà pour `recordKRCompletion`.
// ═══════════════════════════════════════════════════════════════════
describe('journal KR — parité démo ↔ Supabase', () => {
  it('borne les reps à MAX_REPS_PER_WRITE au lieu de saturer localStorage (B18)', async () => {
    seedOkrs([okr({ id: 'o1', keyResults: [kr({ id: 'k1', currentValue: 0, targetValue: 100 })] })]);
    // Le champ de progression est un `input[type=number]` sans `max` qui
    // remonte à chaque frappe : cette valeur est atteignable à la saisie.
    // Sans clamp, la boucle levait un QuotaExceededError après ~20 s.
    await expect(repo.updateKeyResult('o1', 'k1', { currentValue: 50_000 })).resolves.toBeTruthy();
    expect(journal()).toHaveLength(MAX_REPS_PER_WRITE);
  });

  // ── C-01 : le rejeu du journal a la restauration ───────────────────
  //
  // 🔴 L'ecriture du journal appartient au REPOSITORY, pas au client :
  // l'arbitrage du 2026-09-03 supprime `useCreateKRCompletion` parce qu'un
  // INSERT client libre dans un journal append-only est interdit. La borne
  // B18 doit donc vivre ICI, avec celle de `appendKRReps`.

  it('rejoue le journal d un OKR restaure, en conservant les horodatages', async () => {
    // Les reecrire a `now()` remettrait les N points d'un coup sur
    // aujourd'hui : ce n'est pas restaurer un graphique, c'est en inventer un.
    await repo.restoreCompletions([
      {
        id: 'ignore', krId: 'k1', okrId: 'o1', userId: 'demo-user',
        completedAt: '2026-06-01T10:00:00.000Z', krTitle: 'K', okrTitle: 'O',
      },
      {
        id: 'ignore2', krId: 'k1', okrId: 'o1', userId: 'demo-user',
        completedAt: '2026-07-01T10:00:00.000Z', krTitle: 'K', okrTitle: 'O',
      },
    ]);
    const rows = journal();
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.completedAt)).toEqual([
      '2026-06-01T10:00:00.000Z',
      '2026-07-01T10:00:00.000Z',
    ]);
    // Identifiant NEUF : rien ne reference une ligne de journal, seul son
    // contenu alimente le graphique.
    expect(rows.map((r) => r.id)).not.toContain('ignore');
  });

  it('borne AUSSI le rejeu de restauration a MAX_REPS_PER_WRITE (B18)', async () => {
    // Le tableau vient d'une lecture, mais il traverse l'etat d'un composant :
    // sans borne, on rouvrirait par la porte de l'annulation le trou que le
    // cap a ferme cote ecriture.
    const flood = Array.from({ length: MAX_REPS_PER_WRITE + 250 }, (_, i) => ({
      id: `c-${i}`, krId: 'k1', okrId: 'o1', userId: 'demo-user',
      completedAt: '2026-06-01T10:00:00.000Z', krTitle: 'K', okrTitle: 'O',
    }));
    await repo.restoreCompletions(flood);
    expect(journal()).toHaveLength(MAX_REPS_PER_WRITE);
  });

  it('un journal vide n ecrit rien', async () => {
    await repo.restoreCompletions([]);
    expect(journal()).toHaveLength(0);
  });

  it('borne aussi le retrait symétrique', async () => {
    seedOkrs([okr({ id: 'o1', keyResults: [kr({ id: 'k1', currentValue: 0, targetValue: 100 })] })]);
    await repo.updateKeyResult('o1', 'k1', { currentValue: 50 });
    expect(journal()).toHaveLength(50);
    await expect(repo.updateKeyResult('o1', 'k1', { currentValue: 0 })).resolves.toBeTruthy();
    expect(journal()).toHaveLength(0);
  });

  it('date les reps de MAINTENANT, jamais de la date d’achèvement du KR', async () => {
    // `completedAt` dit quand le KR a été ACHEVÉ, pas quand la rep est faite.
    // L'utiliser datait les reps d'un KR terminé au jour de son achèvement,
    // donc le graphique « KR réalisés » ne montrait rien pour aujourd'hui.
    const old = '2020-01-01T00:00:00.000Z';
    seedOkrs([okr({ id: 'o1', keyResults: [kr({ id: 'k1', currentValue: 1, completed: true, completedAt: old })] })]);
    await repo.updateKeyResult('o1', 'k1', { currentValue: 2 });
    const rows = journal();
    expect(rows).toHaveLength(1);
    expect(rows[0].completedAt).not.toBe(old);
    expect(new Date(rows[0].completedAt).getUTCFullYear()).toBeGreaterThan(2020);
  });
});

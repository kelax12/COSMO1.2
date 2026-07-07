// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageTeamOKRsRepository } from './local.repository';

const ORG = 'org-demo-1';

describe('LocalStorageTeamOKRsRepository (démo)', () => {
  let repo: LocalStorageTeamOKRsRepository;

  beforeEach(() => {
    localStorage.clear();
    repo = new LocalStorageTeamOKRsRepository();
  });

  it('seede 3 OKR avec des KR assignés', async () => {
    const okrs = await repo.getAll(ORG);
    expect(okrs.length).toBe(3);
    expect(okrs.every((o) => o.keyResults.length > 0)).toBe(true);
    expect(okrs.flatMap((o) => o.keyResults).some((kr) => kr.assigneeId)).toBe(true);
  });

  it('garantit target_value > 0 sur tous les KR seedés (garde B17)', async () => {
    const okrs = await repo.getAll(ORG);
    expect(okrs.flatMap((o) => o.keyResults).every((kr) => kr.targetValue > 0)).toBe(true);
  });

  it('met à jour la valeur courante d\'un KR', async () => {
    const okrs = await repo.getAll(ORG);
    const kr = okrs[0].keyResults[0];
    await repo.updateKeyResult(kr.id, { currentValue: kr.currentValue + 10 });
    const after = (await repo.getAll(ORG))[0].keyResults[0];
    expect(after.currentValue).toBe(kr.currentValue + 10);
  });

  it('complète un KR (completedAt renseigné)', async () => {
    const okrs = await repo.getAll(ORG);
    const kr = okrs[1].keyResults[0];
    await repo.updateKeyResult(kr.id, { completed: true });
    const after = (await repo.getAll(ORG)).find((o) => o.id === kr.okrId)!.keyResults.find((k) => k.id === kr.id)!;
    expect(after.completed).toBe(true);
    expect(after.completedAt).toBeTruthy();
  });

  it('ignore une cible ≤ 0 lors d\'une mise à jour (garde B17)', async () => {
    const okrs = await repo.getAll(ORG);
    const kr = okrs[0].keyResults[0];
    await repo.updateKeyResult(kr.id, { targetValue: 0 });
    const after = (await repo.getAll(ORG))[0].keyResults[0];
    expect(after.targetValue).toBe(kr.targetValue); // inchangé
  });

  it('crée un OKR avec ses KR', async () => {
    const created = await repo.create(ORG, {
      title: 'Nouvel objectif',
      keyResults: [{ title: 'KR A', targetValue: 100, assigneeId: 'friend-1' }],
    });
    expect(created.keyResults.length).toBe(1);
    expect(created.keyResults[0].targetValue).toBe(100);
    expect((await repo.getAll(ORG)).length).toBe(4);
  });

  it('supprime un OKR', async () => {
    const okrs = await repo.getAll(ORG);
    await repo.remove(okrs[0].id);
    expect((await repo.getAll(ORG)).length).toBe(2);
  });
});

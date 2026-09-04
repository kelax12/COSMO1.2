// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// C-48 — un refus de dependance dit UNE chose, et elle est lisible
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI. Les triggers refusaient par des PHRASES anglaises, et le
// repository local levait les memes par souci de parite. Les deux modes se
// cassaient chacun a sa facon :
//
//   • EN PRODUCTION, `normalizeApiError` ne promeut un message serveur en code
//     metier que s il matche `BUSINESS_CODE_RE` (`^[a-z][a-z0-9_]{2,49}$`).
//     Une phrase avec des espaces et des majuscules ne matche pas : le refus
//     retombait sur le message generique. Ce qu on voulait surtout ne pas
//     perdre etait exactement ce qui etait perdu.
//   • EN MODE DEMO, la phrase anglaise arrivait telle quelle dans le gabarit
//     francais : « Dependance impossible : This dependency would create a
//     cycle ».
//
// ❌ Le correctif n est PAS « traduire la chaine du repository local » : les
//    deux chemins doivent CONVERGER, sinon la divergence revient au prochain
//    message.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalStorageTasksRepository } from './local.repository';
import { normalizeApiError, ApiError } from '@/lib/normalizeApiError';
import { dependencyErrorCode, DEPENDENCY_ERRORS } from './dependency-errors';
import { localeStore } from '@/i18n/store';
import { registerCatalog } from '@/i18n/catalog';
import enErrors from '@/locales/en/errors.json';

beforeEach(() => localStorage.clear());
afterEach(() => localeStore.setLocale('fr'));

describe('les deux chemins refusent par le MEME identifiant', () => {
  it('production : le RAISE de la mig. 137 est promu en code metier', () => {
    // C est le format que PostgREST renvoie pour un `RAISE EXCEPTION '<id>'`.
    const err = normalizeApiError({ code: 'P0001', message: DEPENDENCY_ERRORS.cycle });
    expect(err.code).toBe('dependency_cycle');
    expect(dependencyErrorCode(err)).toBe('dependency_cycle');
  });

  it('demo : le repository local leve le MEME identifiant', async () => {
    const repo = new LocalStorageTasksRepository();
    const tasks = await repo.getAll();
    const [a, b] = tasks;
    await repo.addDependency(a.id, b.id);
    const err = await repo.addDependency(b.id, a.id).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(dependencyErrorCode(err)).toBe('dependency_cycle');
  });
});

describe('un francophone lit du francais, dans les DEUX modes', () => {
  it('production', () => {
    const err = normalizeApiError({ code: 'P0001', message: DEPENDENCY_ERRORS.cycle });
    expect(err.message).toMatch(/boucle/i);
    expect(err.message).not.toMatch(/would create a cycle/);
  });

  it('demo', async () => {
    const repo = new LocalStorageTasksRepository();
    const tasks = await repo.getAll();
    const [a, b] = tasks;
    await repo.addDependency(a.id, b.id);
    const err = await repo.addDependency(b.id, a.id).catch((e) => e);
    expect(err.message).toMatch(/boucle/i);
    expect(err.message).not.toMatch(/would create a cycle/);
  });

  it('et un anglophone lit de l anglais', async () => {
    // ⚠️ Seuls DEUX namespaces sont eager, et pour la LOCALE COURANTE
    // seulement : changer de langue a chaud ne charge pas le catalogue `en`
    // (dans l app, un changement de langue force un rechargement complet, cf.
    // `i18n/bootstrap.ts`). Sans cet enregistrement explicite, le moteur
    // retomberait sur `fr`, catalogue de reference — et le test verifierait
    // le repli au lieu de la traduction.
    registerCatalog('en', 'errors', enErrors);
    localeStore.setLocale('en');
    const repo = new LocalStorageTasksRepository();
    const tasks = await repo.getAll();
    const [a, b] = tasks;
    await repo.addDependency(a.id, b.id);
    const err = await repo.addDependency(b.id, a.id).catch((e) => e);
    expect(err.message).toMatch(/loop/i);
  });
});

describe('table de transition — le correctif marche AVANT la mig. 137', () => {
  // Une migration se DEPLOIE : entre le push du front et son application, le
  // serveur repond encore par les anciennes phrases.
  it.each([
    ['This dependency would create a cycle', DEPENDENCY_ERRORS.cycle],
    ['Both tasks must exist', DEPENDENCY_ERRORS.taskMissing],
    ['A dependency must stay within a single account', DEPENDENCY_ERRORS.crossAccount],
    ['A dependency must stay within a single project', DEPENDENCY_ERRORS.crossProject],
  ])('« %s » est reconnu', (phrase, code) => {
    expect(dependencyErrorCode(normalizeApiError({ code: 'P0001', message: phrase }))).toBe(code);
  });

  it('TEMOIN : une erreur quelconque n est PAS prise pour un refus de dependance', () => {
    expect(dependencyErrorCode(new Error('Failed to fetch'))).toBeNull();
    expect(dependencyErrorCode(normalizeApiError({ code: '500', message: 'boom' }))).toBeNull();
    expect(dependencyErrorCode(null)).toBeNull();
  });
});

describe('auto-dependance', () => {
  it('est refusee comme un cycle de longueur 1', async () => {
    // Meme sens que la contrainte `task_dependencies_no_self` de la mig. 132.
    const repo = new LocalStorageTasksRepository();
    const tasks = await repo.getAll();
    const err = await repo.addDependency(tasks[0].id, tasks[0].id).catch((e) => e);
    expect(dependencyErrorCode(err)).toBe('dependency_cycle');
  });
});

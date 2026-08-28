// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// `useTeamTasks({ background: true })` — la pastille ne recharge plus
//
// POURQUOI CE FICHIER EXISTE
//
// `Layout` monte la pastille de nav d'entreprise sur TOUTES les pages
// protégées. Elle n'affiche pas la liste des tâches d'équipe : elle en compte
// quelques-unes. Elle montait pourtant `useTeamTasks` avec 30 s de fraîcheur
// et `refetchOnWindowFocus`, donc un `getTasks()` complet à chaque retour
// d'onglet, sur toutes les pages, pour peindre un nombre.
//
// Le correctif du 2026-08-27 (commit 73f6734) ajoute `background`, symétrique
// de `live`. Son gain a été livré NON CHIFFRÉ : le mode démo est en
// `localStorage`, il n'émet aucune requête à compter, et la mesure en
// `edge_logs` demandait une vraie session sur une version déployée.
//
// ⚠️ « Non chiffré » ne doit pas vouloir dire « non vérifié ». Ce que le gain
// suppose est un COMPORTEMENT, pas un nombre : au retour d'onglet, le
// repository ne doit pas être rappelé. C'est mesurable ici, en comptant les
// appels, sans réseau et sans attendre un déploiement. Le nombre de requêtes
// épargnées en production suit ce comportement ; il ne le remplace pas.
//
// ⚠️ ET SURTOUT : `background` ne doit RIEN éteindre pour les autres. Les
// options de React Query sont PAR OBSERVATEUR. Si un écran de /entreprise
// monte la même clé sans `background`, lui doit continuer à se rafraîchir.
// Un correctif de performance qui gèlerait la donnée des écrans qui
// l'affichent serait une régression, pas un gain.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const getTasks = vi.fn();

vi.mock('@/lib/repository.factory', () => ({
  getTeamProjectsRepository: () => ({ getTasks }),
}));

import { useTeamTasks } from './hooks';

const ORG = 'org-1';

function wrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

/** Rejoue un retour sur l'onglet, ce que fait `refetchOnWindowFocus`. */
async function returnToTab(): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    await Promise.resolve();
  });
}

describe('useTeamTasks — option `background` (commit 73f6734)', () => {
  let client: QueryClient;

  beforeEach(() => {
    getTasks.mockReset();
    getTasks.mockResolvedValue([]);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    client.clear();
    vi.useRealTimers();
  });

  it('ne recharge pas au retour d’onglet', async () => {
    const { result } = renderHook(() => useTeamTasks(ORG, undefined, { background: true }), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getTasks).toHaveBeenCalledTimes(1);

    // Mêmes conditions que le témoin négatif : horloge avancée au-delà de
    // tout `staleTime` plausible, puis retour d'onglet. Sans ça on comparerait
    // deux situations différentes.
    vi.setSystemTime(Date.now() + 31_000);
    await returnToTab();
    await returnToTab();

    // C'est TOUT le correctif : le premier chargement a lieu, les suivants non.
    expect(getTasks).toHaveBeenCalledTimes(1);
  });

  it('SANS `background`, le MÊME retour d’onglet recharge bien', async () => {
    // 🔴 TÉMOIN NÉGATIF, et il doit passer par EXACTEMENT le même
    // `returnToTab()` que le test précédent. Une première version périmait la
    // donnée avec `invalidateQueries` : elle prouvait que l'invalidation
    // marche, pas que le retour d'onglet déclenche quoi que ce soit dans ce
    // harnais. Le test du dessus aurait alors été vide de sens — il aurait
    // constaté l'absence d'un rechargement que rien ne demandait.
    const { result } = renderHook(() => useTeamTasks(ORG), { wrapper: wrapper(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getTasks).toHaveBeenCalledTimes(1);

    // `refetchOnWindowFocus` ne rappelle que si la donnée est PÉRIMÉE, et
    // `staleTime` vaut 30 s hors `background` : on avance l'horloge au lieu
    // d'attendre, sinon le témoin serait faussement muet.
    vi.setSystemTime(Date.now() + 31_000);
    await returnToTab();

    await waitFor(() => expect(getTasks.mock.calls.length).toBeGreaterThan(1));
  });

  it('ne gèle pas la donnée des écrans qui l’affichent', async () => {
    // Deux observateurs sur la MÊME clé : la pastille en arrière-plan, et un
    // écran de /entreprise. L'écran doit garder son propre rafraîchissement.
    const { result } = renderHook(
      () => ({
        badge: useTeamTasks(ORG, undefined, { background: true }),
        screen: useTeamTasks(ORG),
      }),
      { wrapper: wrapper(client) },
    );

    await waitFor(() => expect(result.current.screen.isSuccess).toBe(true));
    const afterMount = getTasks.mock.calls.length;

    await act(async () => {
      await client.invalidateQueries({ queryKey: ['team-projects', 'tasks', ORG] });
    });

    await waitFor(() => expect(getTasks.mock.calls.length).toBeGreaterThan(afterMount));
  });
});

// @vitest-environment jsdom
//
// Filet de caractérisation de la modale d'événement d'agenda (vague 15.1,
// TST-02) : ajout depuis une tâche, édition, conversion, validation des
// horaires, brouillon, fermeture gardée, fuseau manuel.
//
// La modale est pilotée par props : on la monte seule, avec le catalogue de
// catégories de démonstration, et on observe les rappels (onAddEvent,
// onUpdateEvent...) que reçoit le parent, qui sont ce que l'agenda enregistre.
//
// Le DOM contient les champs desktop ET mobile (bascule en CSS) : on cible les
// champs par leur placeholder, et les horaires par leur type.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { screen, within, waitFor, cleanup, fireEvent, act, renderHook } from '@testing-library/react';
import EventModal from './EventModal';
import { categoryKeys } from '@/modules/categories/constants';
import { renderApp, resetDemoWorld, setViewport, makeTask, fakeAuth, lazyT, warmDemoCaches, itBug } from '@/test/tasks-ui-harness';
import { useTimezonePref } from '@/lib/timezone';
import type { CalendarEvent } from '@/modules/events';

vi.mock('@/modules/auth/AuthContext', async (orig) => ({
  ...(await orig<typeof import('@/modules/auth/AuthContext')>()),
  useAuth: () => fakeAuth(),
}));

const ev = lazyT('eventModal');

/** Monte la modale dans le client de test (catégories et listes en cache, cf. le harnais). */
function renderModal(ui: React.ReactElement) {
  return renderApp(ui, { route: '/agenda' });
}

const TASK = makeTask({ id: 't1', name: 'Préparer la démo', estimatedTime: 90, category: 'cat-2' });

const EVENT: CalendarEvent = {
  id: 'e1',
  title: 'Réunion équipe',
  start: '2026-11-09T09:00:00.000Z',
  end: '2026-11-09T10:30:00.000Z',
  color: '#3B82F6',
  notes: 'Ordre du jour : budget',
  recurrence: 'none',
};

beforeAll(async () => { await warmDemoCaches(); });

beforeEach(() => {
  setViewport('desktop');
  resetDemoWorld([]);
});
afterEach(() => cleanup());

const titleField = () => screen.getByPlaceholderText(ev.t('titlePlaceholder')) as HTMLInputElement;
const timeInputs = () => Array.from(document.querySelectorAll('input[type="time"]')) as HTMLInputElement[];
/** Les deux champs desktop (début, fin) sont les 2e et 4e : mobile d'abord, desktop ensuite. */
const startTime = () => timeInputs()[1];
const endTime = () => timeInputs()[3];

function setTimes(start: string, end: string) {
  for (const input of timeInputs().slice(0, 2)) fireEvent.change(input, { target: { value: start } });
  for (const input of timeInputs().slice(2)) fireEvent.change(input, { target: { value: end } });
}

describe('EventModal · ajout depuis une tâche', () => {
  const slot = { start: '2026-11-09T09:00:00', end: '2026-11-09T10:30:00' };

  function openAdd(props: Partial<React.ComponentProps<typeof EventModal>> = {}) {
    const onAddEvent = vi.fn();
    const onClose = vi.fn();
    const view = renderModal(
      <EventModal isOpen onClose={onClose} mode="add" task={TASK} prefilledTimeSlot={slot} onAddEvent={onAddEvent} {...props} />,
    );
    return { ...view, onAddEvent, onClose };
  }

  it('montre le titre « Ajouter un événement », le nom de la tâche et la durée du créneau', async () => {
    openAdd();
    expect(await screen.findByRole('heading', { name: ev.t('headerAdd') })).toBeTruthy();
    expect(titleField().value).toBe('Préparer la démo');
    expect(screen.getByText('1 h 30')).toBeTruthy();
    expect(screen.getByRole('button', { name: ev.t('submitAdd') })).toBeTruthy();
  });

  it('expose un dialogue modal nommé', async () => {
    openAdd();
    const dialog = await screen.findByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('valide : transmet titre, instants, tâche, récurrence « aucune » et événement privé, puis ferme', async () => {
    const { onAddEvent, onClose } = openAdd();
    await screen.findByRole('heading', { name: ev.t('headerAdd') });
    fireEvent.change(titleField(), { target: { value: '  Démo client  ' } });
    fireEvent.click(screen.getByRole('button', { name: ev.t('submitAdd') }));

    expect(onAddEvent).toHaveBeenCalledTimes(1);
    const payload = onAddEvent.mock.calls[0][0];
    expect(payload.title).toBe('Démo client');
    expect(payload.taskId).toBe('t1');
    expect(payload.start).toBe(new Date(slot.start).toISOString());
    expect(payload.end).toBe(new Date(slot.end).toISOString());
    expect(payload.recurrence).toBe('none');
    expect(payload.recurrenceDays).toEqual([]);
    expect(payload.isPrivate).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('un événement créé côté entreprise est public (visible de la hiérarchie)', async () => {
    const { onAddEvent } = openAdd({ enterprisePublic: true });
    await screen.findByRole('heading', { name: ev.t('headerAdd') });
    fireEvent.click(screen.getByRole('button', { name: ev.t('submitAdd') }));
    expect(onAddEvent.mock.calls[0][0].isPrivate).toBe(false);
  });

  it('refuse un titre vidé : rien n\'est transmis, la modale reste ouverte', async () => {
    const { onAddEvent, onClose } = openAdd();
    await screen.findByRole('heading', { name: ev.t('headerAdd') });
    fireEvent.change(titleField(), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: ev.t('submitAdd') }));
    expect(onAddEvent).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('refuse une fin antérieure au début, et le dit dans la durée', async () => {
    const { onAddEvent } = openAdd();
    await screen.findByRole('heading', { name: ev.t('headerAdd') });
    setTimes('11:00', '10:00');
    expect(await screen.findByText(ev.t('endBeforeStart'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: ev.t('submitAdd') }));
    expect(onAddEvent).not.toHaveBeenCalled();
  });

  it('refuse un horaire manquant', async () => {
    const { onAddEvent } = openAdd();
    await screen.findByRole('heading', { name: ev.t('headerAdd') });
    setTimes('', '');
    fireEvent.click(screen.getByRole('button', { name: ev.t('submitAdd') }));
    expect(onAddEvent).not.toHaveBeenCalled();
  });

  it('sans créneau imposé, une tâche avec durée propose midi et la durée estimée', async () => {
    openAdd({ prefilledTimeSlot: undefined });
    await screen.findByRole('heading', { name: ev.t('headerAdd') });
    expect(startTime().value).toBe('12:00');
    expect(endTime().value).toBe('13:30');
  });

  it('verrouille les champs demandés (titre en lecture seule)', async () => {
    openAdd({ lockedFields: ['title'] });
    await screen.findByRole('heading', { name: ev.t('headerAdd') });
    expect(titleField().readOnly).toBe(true);
  });

  it('récurrence « Personnaliser » : choisir les jours puis valider les transmet', async () => {
    const { onAddEvent } = openAdd();
    await screen.findByRole('heading', { name: ev.t('headerAdd') });
    // Le sélecteur de récurrence est un menu COSMO (pas un <select> natif).
    fireEvent.keyDown(screen.getByLabelText(ev.t('recurrenceAria')), { key: 'Enter' });
    fireEvent.click(within(await screen.findByRole('menu')).getByText(ev.t('form.recurrenceCustom')));
    const dialog = await screen.findByRole('dialog', { name: ev.t('repeatDays') });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Lundi' }));
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Mercredi' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Valider' }));
    // La feuille des jours se ferme avec une animation : on vise le bouton du formulaire.
    fireEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement);
    expect(onAddEvent).toHaveBeenCalledTimes(1);
    expect(onAddEvent.mock.calls[0][0].recurrence).toBe('custom');
    expect(onAddEvent.mock.calls[0][0].recurrenceDays).toEqual([1, 3]);
  });

  it('Échap ferme la modale', async () => {
    const { onClose } = openAdd();
    await screen.findByRole('heading', { name: ev.t('headerAdd') });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('création libre : le titre saisi est gardé en brouillon et restitué à la réouverture', async () => {
    const free = { id: '', name: '' };
    const first = renderModal(<EventModal isOpen onClose={vi.fn()} mode="add" task={free} onAddEvent={vi.fn()} />);
    await screen.findByRole('heading', { name: ev.t('headerAdd') });
    fireEvent.change(titleField(), { target: { value: 'Idée de rendez-vous' } });
    first.unmount();
    renderModal(<EventModal isOpen onClose={vi.fn()} mode="add" task={free} onAddEvent={vi.fn()} />);
    await waitFor(() => expect(titleField().value).toBe('Idée de rendez-vous'));
  });

  it('ne rend rien sans tâche en mode ajout, ni fermée', () => {
    const closed = renderModal(<EventModal isOpen={false} onClose={vi.fn()} mode="add" task={TASK} />);
    expect(closed.container.querySelector('[role="dialog"]')).toBeNull();
    closed.unmount();
    const noTask = renderModal(<EventModal isOpen onClose={vi.fn()} mode="add" task={null} />);
    expect(noTask.container.querySelector('[role="dialog"]')).toBeNull();
  });
});

describe('EventModal · édition', () => {
  function openEdit(props: Partial<React.ComponentProps<typeof EventModal>> = {}) {
    const onUpdateEvent = vi.fn();
    const onDeleteEvent = vi.fn();
    const onDuplicateEvent = vi.fn();
    const onClose = vi.fn();
    const view = renderModal(
      <EventModal
        isOpen onClose={onClose} mode="edit" event={EVENT}
        onUpdateEvent={onUpdateEvent} onDeleteEvent={onDeleteEvent} onDuplicateEvent={onDuplicateEvent}
        {...props}
      />,
    );
    return { ...view, onUpdateEvent, onDeleteEvent, onDuplicateEvent, onClose };
  }

  it('relit le titre et la durée de l\'événement', async () => {
    openEdit();
    expect(await screen.findByRole('heading', { name: ev.t('headerEdit') })).toBeTruthy();
    expect(titleField().value).toBe('Réunion équipe');
    expect(screen.getByText('1 h 30')).toBeTruthy();
  });

  // 🔴 BUG DÉCRIT : à l'ouverture, `showDescription` se décide d'après l'état
  // `notes`, encore vide à cet instant (il n'est rempli que par l'effet
  // d'initialisation, qui tourne après). Un événement qui a des notes s'ouvre
  // donc avec « + Ajouter un commentaire » au lieu de montrer ses notes, alors
  // que le commentaire du code promet « visible si l'event a déjà des notes ».
  itBug('relit les notes de l\'événement dès l\'ouverture (BUG : section Description repliée)', async () => {
    openEdit();
    await screen.findByRole('heading', { name: ev.t('headerEdit') });
    expect(screen.getByDisplayValue('Ordre du jour : budget')).toBeTruthy();
  });

  it('les notes restent accessibles : « + Ajouter un commentaire » révèle celles de l\'événement', async () => {
    openEdit();
    await screen.findByRole('heading', { name: ev.t('headerEdit') });
    fireEvent.click(screen.getByRole('button', { name: ev.t('form.addComment') }));
    expect(screen.getByDisplayValue('Ordre du jour : budget')).toBeTruthy();
  });

  it('enregistre le titre modifié sans changer les instants, et ne ferme pas de lui-même', async () => {
    const { onUpdateEvent, onClose } = openEdit();
    await screen.findByRole('heading', { name: ev.t('headerEdit') });
    fireEvent.change(titleField(), { target: { value: 'Réunion équipe élargie' } });
    fireEvent.click(screen.getByRole('button', { name: ev.t('submitEdit') }));
    expect(onUpdateEvent).toHaveBeenCalledTimes(1);
    const [id, data] = onUpdateEvent.mock.calls[0];
    expect(id).toBe('e1');
    expect(data.title).toBe('Réunion équipe élargie');
    expect(data.start).toBe(EVENT.start);
    expect(data.end).toBe(EVENT.end);
    expect(data.isPrivate).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('supprime et duplique en déléguant au parent', async () => {
    const { onDeleteEvent, onDuplicateEvent } = openEdit();
    await screen.findByRole('heading', { name: ev.t('headerEdit') });
    fireEvent.click(screen.getByRole('button', { name: 'Dupliquer' }));
    expect(onDuplicateEvent).toHaveBeenCalledWith('e1');
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(onDeleteEvent).toHaveBeenCalledWith('e1');
  });

  it('ferme sans question quand rien n\'a changé', async () => {
    const { onClose } = openEdit();
    await screen.findByRole('heading', { name: ev.t('headerEdit') });
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('demande confirmation avant d\'abandonner une saisie non enregistrée (croix comme Échap)', async () => {
    const { onClose } = openEdit();
    await screen.findByRole('heading', { name: ev.t('headerEdit') });
    fireEvent.change(titleField(), { target: { value: 'Autre titre' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(await screen.findByText('Abandonner les modifications ?')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Continuer la saisie' }));
    expect(titleField().value).toBe('Autre titre');

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(await screen.findByRole('button', { name: 'Abandonner' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ne rend rien en mode édition sans événement', () => {
    const view = renderModal(<EventModal isOpen onClose={vi.fn()} mode="edit" event={null} />);
    expect(view.container.querySelector('[role="dialog"]')).toBeNull();
  });
});

describe('EventModal · saisie et rafraîchissement des catégories', () => {
  // Garde de caractérisation : un rafraîchissement de la liste de catégories
  // (nouvelle référence) pendant la saisie ne remet pas le titre à zéro.
  it('la saisie en cours survit à un rafraîchissement des catégories', async () => {
    const view = renderModal(<EventModal isOpen onClose={vi.fn()} mode="edit" event={EVENT} onUpdateEvent={vi.fn()} />);
    await screen.findByRole('heading', { name: ev.t('headerEdit') });
    fireEvent.change(titleField(), { target: { value: 'Titre en cours de saisie' } });
    await act(async () => {
      view.queryClient.setQueryData(categoryKeys.lists(), [{ id: 'cat-x', name: 'Nouvelle', color: '#FF0000', parentId: null }]);
    });
    expect(titleField().value).toBe('Titre en cours de saisie');
  });
});

describe('EventModal · conversion', () => {
  it('convertit une tâche en événement : propose midi + durée, puis transmet sans taskId', async () => {
    const onConvert = vi.fn();
    const onClose = vi.fn();
    renderModal(<EventModal isOpen onClose={onClose} mode="convert" task={TASK} onConvert={onConvert} />);
    expect(await screen.findByRole('heading', { name: ev.t('headerConvert') })).toBeTruthy();
    expect(titleField().value).toBe('Préparer la démo');
    expect(startTime().value).toBe('12:00');
    expect(endTime().value).toBe('13:30');
    fireEvent.click(screen.getByRole('button', { name: ev.t('headerConvert') }));
    expect(onConvert).toHaveBeenCalledTimes(1);
    expect(onConvert.mock.calls[0][0].taskId).toBeUndefined();
    expect(onConvert.mock.calls[0][0].title).toBe('Préparer la démo');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('EventModal · fuseau manuel', () => {
  it('affiche et enregistre les horaires dans le fuseau choisi, sans décaler l\'instant stocké', async () => {
    const { result } = renderHook(() => useTimezonePref());
    act(() => result.current.setMode('manual'));
    act(() => result.current.setOffsetHours(5));
    try {
      const onUpdateEvent = vi.fn();
      renderModal(<EventModal isOpen onClose={vi.fn()} mode="edit" event={EVENT} onUpdateEvent={onUpdateEvent} />);
      await screen.findByRole('heading', { name: ev.t('headerEdit') });
      // 09:00 UTC vu depuis UTC+5 : 14:00 à 15:30, quelle que soit la machine.
      expect(startTime().value).toBe('14:00');
      expect(endTime().value).toBe('15:30');
      fireEvent.change(titleField(), { target: { value: 'Réunion décalée' } });
      fireEvent.click(screen.getByRole('button', { name: ev.t('submitEdit') }));
      const data = onUpdateEvent.mock.calls[0][1];
      expect(data.start).toBe(EVENT.start);
      expect(data.end).toBe(EVENT.end);
    } finally {
      act(() => result.current.setMode('default'));
      act(() => result.current.setOffsetHours(0));
    }
  });
});

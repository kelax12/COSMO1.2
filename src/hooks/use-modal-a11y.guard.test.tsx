// @vitest-environment jsdom
//
// C-53 — comportement de `useModalA11y`, mesuré sur un DOM réel (jsdom).
//
// 🔴 TÉMOINS OBLIGATOIRES. Trois des tests ci-dessous montent la MÊME modale
// SANS le hook et vérifient que la mesure vire au rouge. Sans eux, un piège
// qui ne piège plus rendrait quand même le fichier vert : c'est exactement le
// mode d'échec relevé par la passe du 2026-09-03 (« une garde se vérifie sur
// ce qu'elle REGARDE »).
//
// La mesure E2E équivalente, dans un vrai navigateur, est
// `e2e/a11y-keyboard-audit.spec.ts`.
import { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { useModalA11y } from './use-modal-a11y';

afterEach(cleanup);

/**
 * Tab n'est pas simulé par jsdom : aucune navigation séquentielle native n'y
 * existe. Le piège, lui, est un écouteur `keydown` en capture sur `document` —
 * il se mesure donc en émettant l'évènement, ce qui est justement le chemin
 * que le défaut d'origine empruntait (`onKeyDown` sur l'overlay, mort dès que
 * le focus sortait).
 */
function press(key: string, shiftKey = false) {
  act(() => {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }),
    );
  });
}

interface HarnessProps {
  /** Faux = la même modale SANS le hook (témoin). */
  withHook?: boolean;
  onClose?: () => void;
}

function Harness({ withHook = true, onClose }: HarnessProps) {
  const [open, setOpen] = useState(false);
  const close = () => {
    onClose?.();
    setOpen(false);
  };
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Nouveau
      </button>
      <button type="button">Derrière la modale</button>
      {open && (withHook ? <TrappedModal onClose={close} /> : <NaiveModal onClose={close} />)}
    </div>
  );
}

function TrappedModal({ onClose }: { onClose: () => void }) {
  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose,
    label: 'Nouvel évènement',
  });
  return (
    <div ref={ref} {...dialogProps} data-testid="overlay">
      <input aria-label="Titre" />
      <button type="button" onClick={onClose}>
        Annuler
      </button>
      <button type="submit">Enregistrer</button>
    </div>
  );
}

/** La forme d'origine : Échap posé sur l'overlay, aucun piège, aucun rôle. */
function NaiveModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      data-testid="overlay"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <input aria-label="Titre" />
      <button type="button" onClick={onClose}>
        Annuler
      </button>
      <button type="submit">Enregistrer</button>
    </div>
  );
}

/**
 * Ouvre la modale ET laisse passer une frame.
 *
 * ⚠️ La mise au focus initiale passe par `requestAnimationFrame` — le contenu
 * peut n'être monté qu'au frame suivant (AnimatePresence, variantes mobile et
 * desktop). Mesurer sans attendre rendrait « focus non entré » sur une modale
 * conforme, donc un finding faux.
 */
async function open() {
  const trigger = screen.getByRole('button', { name: 'Nouveau' });
  await act(async () => {
    trigger.focus();
    trigger.click();
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 32));
  });
  return trigger;
}

describe('useModalA11y — sémantique ARIA', () => {
  it('pose role="dialog", aria-modal et un nom accessible', async () => {
    render(<Harness />);
    await open();
    const dialog = screen.getByRole('dialog', { name: 'Nouvel évènement' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('tabindex')).toBe('-1');
  });

  it('TÉMOIN — la même modale sans le hook n’a ni rôle ni aria-modal', async () => {
    render(<Harness withHook={false} />);
    await open();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('useModalA11y — le focus entre (focusMovedIn)', () => {
  it('déplace le focus dans la modale à l’ouverture', async () => {
    render(<Harness />);
    await open();
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect((document.activeElement as HTMLElement).getAttribute('aria-label')).toBe('Titre');
  });

  it('TÉMOIN — sans le hook, le focus reste sur le déclencheur', async () => {
    render(<Harness withHook={false} />);
    const trigger = await open();
    expect(document.activeElement).toBe(trigger);
    expect(screen.getByTestId('overlay').contains(document.activeElement)).toBe(false);
  });
});

describe('useModalA11y — le focus est piégé (trapped)', () => {
  it('boucle du dernier au premier focalisable', async () => {
    render(<Harness />);
    await open();
    const dialog = screen.getByRole('dialog');
    const save = screen.getByRole('button', { name: 'Enregistrer' });
    act(() => save.focus());
    press('Tab');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect((document.activeElement as HTMLElement).getAttribute('aria-label')).toBe('Titre');
  });

  it('boucle du premier au dernier avec Maj+Tab', async () => {
    render(<Harness />);
    await open();
    press('Tab', true);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Enregistrer' }));
  });

  it('RAMÈNE un focus déjà sorti — le scénario mesuré sur /agenda', async () => {
    render(<Harness />);
    await open();
    const behind = screen.getByRole('button', { name: 'Derrière la modale' });
    act(() => behind.focus());
    press('Tab');
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });
});

describe('useModalA11y — Échap ferme (escClosed)', () => {
  it('ferme même quand le focus est SORTI de la modale', async () => {
    let closed = 0;
    render(<Harness onClose={() => (closed += 1)} />);
    await open();
    act(() => screen.getByRole('button', { name: 'Derrière la modale' }).focus());
    press('Escape');
    expect(closed).toBe(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('TÉMOIN — sans le hook, Échap est mort dès que le focus est sorti', async () => {
    let closed = 0;
    render(<Harness withHook={false} onClose={() => (closed += 1)} />);
    await open();
    act(() => screen.getByRole('button', { name: 'Derrière la modale' }).focus());
    press('Escape');
    expect(closed).toBe(0);
    expect(screen.getByTestId('overlay')).toBeTruthy();
  });
});

describe('useModalA11y — restitution du focus au déclencheur', () => {
  it('rend le focus au bouton qui a ouvert la modale', async () => {
    render(<Harness />);
    const trigger = await open();
    expect(document.activeElement).not.toBe(trigger);
    press('Escape');
    expect(document.activeElement).toBe(trigger);
  });
});

describe('useModalA11y — modales empilées', () => {
  function Nested() {
    const [inner, setInner] = useState(false);
    const outer = useModalA11y<HTMLDivElement>({ open: true, onClose: () => {}, label: 'Externe' });
    const innerA11y = useModalA11y<HTMLDivElement>({
      open: inner,
      onClose: () => setInner(false),
      label: 'Interne',
    });
    return (
      <div ref={outer.ref} {...outer.dialogProps}>
        <button type="button" onClick={() => setInner(true)}>
          Ouvrir la confirmation
        </button>
        {inner && (
          <div ref={innerA11y.ref} {...innerA11y.dialogProps}>
            <button type="button">Confirmer</button>
          </div>
        )}
      </div>
    );
  }

  it('Échap ne ferme QUE la modale du dessus', async () => {
    render(<Nested />);
    const opener = screen.getByRole('button', { name: 'Ouvrir la confirmation' });
    await act(async () => {
      opener.focus();
      opener.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 32));
    });
    expect(screen.getByRole('dialog', { name: 'Interne' })).toBeTruthy();
    press('Escape');
    expect(screen.queryByRole('dialog', { name: 'Interne' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Externe' })).toBeTruthy();
    // Et le focus revient au bouton qui l'avait ouverte, pas au premier
    // focalisable de la modale parente.
    expect(document.activeElement).toBe(opener);
  });
});

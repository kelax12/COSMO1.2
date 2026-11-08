// @vitest-environment jsdom
//
// FRO-01 (vague 16.3) · le contrat clavier des surfaces modales RADIX, mesure en jsdom.
//
// Les 19 fichiers qui montent `Dialog`, `Sheet` ou `AlertDialog` passent tous par ces trois
// enveloppes : le contrat se mesure donc UNE fois ici, sur le composant reel, et le nom
// accessible de chaque surface est verifie fichier par fichier par
// `src/components/modal-a11y.guard.test.ts`.
//
// Les cinq criteres :
//   (a) le focus entre dans la surface a l'ouverture ;
//   (b) Tab et Maj+Tab restent dans la surface (piege Radix, `FocusScope`) ;
//   (c) Echap ferme ;
//   (d) le focus revient au declencheur, MEME quand la surface est pilotee de l'exterieur
//       (aucun `DialogTrigger`) ou ouverte depuis l'entree d'un menu qui disparait ;
//   (e) `role` dialog ou alertdialog, `aria-modal` et un nom accessible.
//
// 🔴 (d) etait FAUX pour toute surface sans `DialogTrigger`, soit la quasi-totalite : Radix
// appelle `event.preventDefault()` dans `onCloseAutoFocus`, puis ne rend le focus qu'a
// `context.triggerRef`, qui est nul. Le focus tombait sur `body`. Le produit pilote ses
// surfaces par un etat (`open` / `onOpenChange`), jamais par `DialogTrigger`.
//
// ⚠️ jsdom ne simule pas Tab natif : le piege est donc mesure par `Tab` emis sur le DERNIER
// puis le PREMIER element focalisable. C'est la limite deja dite dans `docs/ACCESSIBILITY.md`.
import { useState } from 'react';
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { installFocusHistory } from '@/lib/focus-history';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './dialog';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from './sheet';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from './alert-dialog';

// Comme `src/main.tsx` : l'historique des focus existe AVANT l'ouverture de toute surface.
beforeAll(() => installFocusHistory());
afterEach(cleanup);

type Kind = 'dialog' | 'sheet' | 'alert';

function Surface({ kind, onOpenChange, autoFocusField = false }: { kind: Kind; onOpenChange: (o: boolean) => void; autoFocusField?: boolean }) {
  const body = (
    <>
      <input aria-label="Champ" autoFocus={autoFocusField} />
      <button type="button">Dernier</button>
    </>
  );
  if (kind === 'dialog') {
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Titre</DialogTitle>
          <DialogDescription>Description</DialogDescription>
          {body}
        </DialogContent>
      </Dialog>
    );
  }
  if (kind === 'sheet') {
    return (
      <Sheet open onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetTitle>Titre</SheetTitle>
          <SheetDescription>Description</SheetDescription>
          {body}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>Titre</AlertDialogTitle>
        <AlertDialogDescription>Description</AlertDialogDescription>
        <AlertDialogCancel>Annuler</AlertDialogCancel>
        <AlertDialogAction>Confirmer</AlertDialogAction>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Surface PILOTEE de l'exterieur, sans `DialogTrigger` : la forme du produit. */
function Controlled({ kind, viaMenu = false, autoFocusField = false, remountTrigger = false }: { kind: Kind; viaMenu?: boolean; autoFocusField?: boolean; remountTrigger?: boolean }) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div>
      {viaMenu ? (
        <>
          <button type="button" id="menu-btn" onClick={() => setMenuOpen(true)}>
            Menu
          </button>
          {menuOpen && (
            <div role="menu" aria-labelledby="menu-btn">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setOpen(true);
                }}
              >
                Ouvrir la surface
              </button>
            </div>
          )}
        </>
      ) : (
        <button key={remountTrigger && open ? 'recree' : 'initial'} type="button" aria-label="Ouvrir" onClick={() => setOpen(true)}>
          Ouvrir
        </button>
      )}
      {open && <Surface kind={kind} onOpenChange={(o) => setOpen(o)} autoFocusField={autoFocusField} />}
    </div>
  );
}

const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });

function openFromButton() {
  const trigger = screen.getByRole('button', { name: 'Ouvrir' });
  act(() => trigger.focus());
  fireEvent.click(trigger);
  return trigger;
}

describe.each<[Kind, 'dialog' | 'alertdialog']>([
  ['dialog', 'dialog'],
  ['sheet', 'dialog'],
  ['alert', 'alertdialog'],
])('contrat clavier Radix · %s', (kind, role) => {
  it('(a) le focus entre dans la surface', async () => {
    render(<Controlled kind={kind} />);
    openFromButton();
    await tick();
    const surface = screen.getByRole(role);
    expect(surface.contains(document.activeElement)).toBe(true);
  });

  it('(b) le piege garde Tab dans la surface', async () => {
    render(<Controlled kind={kind} />);
    openFromButton();
    await tick();
    const surface = screen.getByRole(role);
    // Radix boucle le focus sur `keydown` Tab quand le focus est au bout : on le mesure.
    const items = Array.from(
      surface.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])'),
    );
    const last = items[items.length - 1];
    act(() => last.focus());
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(surface.contains(document.activeElement)).toBe(true);
    const first = items[0];
    act(() => first.focus());
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(surface.contains(document.activeElement)).toBe(true);
  });

  it('(c) Echap ferme', async () => {
    render(<Controlled kind={kind} />);
    openFromButton();
    await tick();
    fireEvent.keyDown(screen.getByRole(role), { key: 'Escape' });
    await tick();
    expect(screen.queryByRole(role)).toBeNull();
  });

  it('(d) le focus revient au declencheur, sans DialogTrigger', async () => {
    render(<Controlled kind={kind} />);
    const trigger = openFromButton();
    await tick();
    fireEvent.keyDown(screen.getByRole(role), { key: 'Escape' });
    await tick();
    expect(document.activeElement).toBe(trigger);
  });

  it('(d) ouverte depuis une entree de menu demontee, le focus revient au bouton du menu', async () => {
    render(<Controlled kind={kind} viaMenu />);
    const menuBtn = screen.getByRole('button', { name: 'Menu' });
    act(() => menuBtn.focus());
    fireEvent.click(menuBtn);
    const item = screen.getByRole('menuitem');
    act(() => item.focus());
    fireEvent.click(item);
    await tick();
    fireEvent.keyDown(screen.getByRole(role), { key: 'Escape' });
    await tick();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(menuBtn);
  });

  it('(e) role, aria-modal et nom accessible', async () => {
    render(<Controlled kind={kind} />);
    openFromButton();
    await tick();
    const surface = screen.getByRole(role, { name: 'Titre' });
    expect(surface.getAttribute('aria-modal')).toBe('true');
  });
});

// Un enfant `autoFocus` prend le focus AU COMMIT, avant le `FocusScope` de Radix : le declencheur ne
// doit donc pas etre lu dans `onOpenAutoFocus` (qui ne part pas alors). Ce cas ne reproduit PAS le
// defaut mesure dans le navigateur (cf. le cas suivant) : il garde seulement ce chemin.
describe.each<[Kind, 'dialog' | 'alertdialog']>([
  ['dialog', 'dialog'],
  ['sheet', 'dialog'],
])('retour du focus avec un enfant autoFocus · %s', (kind, role) => {
  it('(d) le focus revient au declencheur', async () => {
    render(<Controlled kind={kind} autoFocusField />);
    const trigger = openFromButton();
    await tick();
    expect(screen.getByRole(role).contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(screen.getByRole(role), { key: 'Escape' });
    await tick();
    expect(document.activeElement).toBe(trigger);
  });
});

// 🔴 CAUSE REELLE du defaut mesure dans le navigateur le 2026-11-07 : a l'ouverture de « Nouvelle
// tâche », le meme rendu RECREE le bouton declencheur. L'element d'origine est detache avant que la
// surface ne monte ; l'historique des focus le sautait (`isConnected`), et rien n'etait restitue.
describe.each<[Kind, 'dialog' | 'alertdialog']>([
  ['dialog', 'dialog'],
  ['sheet', 'dialog'],
  ['alert', 'alertdialog'],
])('declencheur recree par le rendu qui ouvre la surface · %s', (kind, role) => {
  it('(d) le focus revient a son equivalent monte', async () => {
    render(<Controlled kind={kind} remountTrigger />);
    const original = openFromButton();
    await tick();
    expect(original.isConnected).toBe(false);
    fireEvent.keyDown(screen.getByRole(role), { key: 'Escape' });
    await tick();
    const recreated = screen.getByRole('button', { name: 'Ouvrir' });
    expect(recreated).not.toBe(original);
    expect(document.activeElement).toBe(recreated);
  });
});

describe('croix de fermeture des surfaces Radix', () => {
  it('la croix de SheetContent porte un nom accessible traduit, jamais « Close » en dur', async () => {
    render(<Controlled kind="sheet" />);
    openFromButton();
    await tick();
    // Aucun catalogue charge dans ce test : `useT` rend alors la CLE, jamais le litteral anglais.
    const closes = screen.getAllByRole('button').filter((b) => /close/i.test(b.textContent ?? ''));
    expect(closes.map((b) => b.textContent)).not.toContain('Close');
  });
});

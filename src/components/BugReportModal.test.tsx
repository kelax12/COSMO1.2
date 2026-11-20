// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const invoke = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}));

import BugReportModal from './BugReportModal';
import { toast } from '@/lib/toast';

const fill = (title: string, description: string) => {
  fireEvent.change(screen.getByLabelText('fields.title'), { target: { value: title } });
  fireEvent.change(screen.getByLabelText('fields.description'), { target: { value: description } });
};

describe('BugReportModal', () => {
  beforeEach(() => {
    invoke.mockReset();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it('ne rend rien tant que la fenêtre est fermée', () => {
    render(<BugReportModal open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('refuse un titre trop court sans appeler le serveur', () => {
    render(<BugReportModal open onOpenChange={vi.fn()} />);
    fill('ab', 'une description assez longue');
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));
    expect(screen.getByRole('alert').textContent).toBe('errors.title');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('refuse une description trop courte, puis efface l’erreur dès la frappe', () => {
    render(<BugReportModal open onOpenChange={vi.fn()} />);
    fill('Un titre', 'court');
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));
    expect(screen.getByRole('alert').textContent).toBe('errors.description');
    fireEvent.change(screen.getByLabelText('fields.description'), {
      target: { value: 'Une description cette fois suffisante' },
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('refuse une pièce jointe d’un type non accepté', () => {
    render(<BugReportModal open onOpenChange={vi.fn()} />);
    fill('Un titre', 'Une description suffisante');
    const exe = new File(['x'], 'virus.exe', { type: 'application/x-msdownload' });
    fireEvent.change(document.getElementById('bug-attachment') as HTMLInputElement, {
      target: { files: [exe] },
    });
    expect(screen.getByText('virus.exe')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));
    expect(screen.getByRole('alert').textContent).toBe('errors.attachment');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('retire la pièce jointe choisie', () => {
    render(<BugReportModal open onOpenChange={vi.fn()} />);
    const png = new File(['x'], 'capture.png', { type: 'image/png' });
    fireEvent.change(document.getElementById('bug-attachment') as HTMLInputElement, {
      target: { files: [png] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'removeFile' }));
    expect(screen.queryByText('capture.png')).toBeNull();
  });

  it('envoie le rapport nettoyé avec sa pièce jointe encodée puis affiche le remerciement', async () => {
    invoke.mockResolvedValue({ error: null });
    render(<BugReportModal open onOpenChange={vi.fn()} />);
    fill('  Titre du bug  ', '  Description complète du bug  ');
    const png = new File(['hello'], 'capture.png', { type: 'image/png' });
    fireEvent.change(document.getElementById('bug-attachment') as HTMLInputElement, {
      target: { files: [png] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(await screen.findByText('successTitle')).toBeTruthy();
    const [fn, opts] = invoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(fn).toBe('report-bug');
    expect(opts.body.title).toBe('Titre du bug');
    expect(opts.body.description).toBe('Description complète du bug');
    expect(opts.body.attachment).toMatchObject({ name: 'capture.png', type: 'image/png', content: 'aGVsbG8=' });
    expect(toast.success).toHaveBeenCalledWith('toastSuccess');
  });

  it('bascule sur le lien mailto pré-rempli quand l’envoi échoue', async () => {
    invoke.mockResolvedValue({ error: new Error('mail_not_configured') });
    render(<BugReportModal open onOpenChange={vi.fn()} />);
    fill('Titre', 'Description du problème rencontré');
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('toastError'));
    const link = screen.getByRole('link') as HTMLAnchorElement;
    expect(link.href.startsWith('mailto:')).toBe(true);
    expect(decodeURIComponent(link.href)).toContain('[Bug] Titre');
    expect(decodeURIComponent(link.href)).toContain('Description du problème rencontré');
  });

  it('se ferme par la croix, par Échap et par le fond, mais pas par un clic dans la carte', () => {
    const onOpenChange = vi.fn();
    render(<BugReportModal open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole('presentation'));
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledTimes(3);
  });

  it('verrouille la fermeture pendant l’envoi', async () => {
    let resolve!: (v: unknown) => void;
    invoke.mockReturnValue(new Promise((r) => { resolve = r; }));
    const onOpenChange = vi.fn();
    render(<BugReportModal open onOpenChange={onOpenChange} />);
    fill('Titre', 'Description du problème rencontré');
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));
    const sending = await screen.findByRole('button', { name: 'sending' });
    expect((sending as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'close' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('presentation'));
    expect(onOpenChange).not.toHaveBeenCalled();
    resolve({ error: null });
    expect(await screen.findByText('successTitle')).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import OrgSizeStep from './OrgSizeStep';

afterEach(cleanup);

const slider = () => screen.getByRole('slider');
const setCount = (n: number) => fireEvent.change(slider(), { target: { value: String(n) } });

describe('OrgSizeStep : le forfait suit l’effectif annoncé', () => {
  it('10 personnes par défaut → Département proposé, avec un « plus tard »', () => {
    const onContinue = vi.fn();
    render(<OrgSizeStep onContinue={onContinue} onSkip={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toContain('Département couvre vos 10 personnes');
    fireEvent.click(screen.getByRole('button', { name: /Prendre Département/ }));
    expect(onContinue).toHaveBeenCalledWith('t20');
    expect(screen.getByRole('button', { name: 'Plus tard, commencer en gratuit' })).toBeTruthy();
  });

  it('5 personnes → gratuit, un seul bouton, aucun paiement', () => {
    const onContinue = vi.fn();
    render(<OrgSizeStep onContinue={onContinue} onSkip={vi.fn()} />);
    setCount(5);
    expect(screen.getByRole('status').textContent).toContain('gratuit');
    fireEvent.click(screen.getByRole('button', { name: /Commencer gratuitement/ }));
    expect(onContinue).toHaveBeenCalledWith('free');
    expect(screen.queryByRole('button', { name: /Plus tard/ })).toBeNull();
  });

  it('150 personnes → Illimité, places illimitées', () => {
    const onContinue = vi.fn();
    render(<OrgSizeStep onContinue={onContinue} onSkip={vi.fn()} />);
    setCount(150);
    expect(screen.getByRole('status').textContent).toContain('places illimitées');
    fireEvent.click(screen.getByRole('button', { name: /Prendre Illimité/ }));
    expect(onContinue).toHaveBeenCalledWith('tmax');
  });

  it('« plus tard » ne choisit aucun palier', () => {
    const onSkip = vi.fn();
    const onContinue = vi.fn();
    render(<OrgSizeStep onContinue={onContinue} onSkip={onSkip} />);
    fireEvent.click(screen.getByRole('button', { name: /Plus tard/ }));
    expect(onSkip).toHaveBeenCalledOnce();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('le curseur annonce son effectif aux lecteurs d’écran', () => {
    render(<OrgSizeStep onContinue={vi.fn()} onSkip={vi.fn()} />);
    setCount(1);
    expect(slider().getAttribute('aria-valuetext')).toBe('1 personne');
  });
});

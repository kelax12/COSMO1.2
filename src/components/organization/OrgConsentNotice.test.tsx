// @vitest-environment jsdom
//
// La notice d'adhésion est le moment où une personne apprend ce qu'une
// entreprise verra de son travail. Jusqu'au 2026-10-13, elle taisait la date de
// dernière activité (mig. 170) et les rapports quotidiens (mig. 202) : la FAQ
// promettait « tout voir avant de rejoindre », la notice ne le tenait pas.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrgConsentNotice from './OrgConsentNotice';

describe('OrgConsentNotice', () => {
  it('annonce la dernière activité et les rapports quotidiens, jamais les connexions', () => {
    render(<OrgConsentNotice checked={false} onChange={() => {}} />);
    expect(screen.getByText(/date de votre dernière activité/i)).toBeTruthy();
    expect(screen.getByText(/rapports d'activité quotidiens/i)).toBeTruthy();
    expect(screen.getByText(/jamais vos connexions/i)).toBeTruthy();
  });

  it('garde la case à cocher décochée par défaut', () => {
    render(<OrgConsentNotice checked={false} onChange={() => {}} />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  });
});

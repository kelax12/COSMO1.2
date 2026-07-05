// @vitest-environment jsdom
// Smoke tests de rendu : la page /admin n'est pas atteignable en E2E démo
// (gating admin serveur), on vérifie donc au moins que chaque composant
// chart monte sans jeter avec des données réalistes.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  SignupsChart,
  DauChart,
  PercentBars,
  CountBars,
  Donut,
  type LabeledValue,
} from './AdminCharts';

const labeled: LabeledValue[] = [
  { label: 'Tâches', value: 42, hint: '8/19 utilisateurs' },
  { label: 'Habitudes', value: 26 },
];

describe('AdminCharts (smoke)', () => {
  it('SignupsChart monte sans jeter', () => {
    const { container } = render(
      <SignupsChart data={[{ label: '5 jan', nouveaux: 2, total: 2 }, { label: '6 jan', nouveaux: 1, total: 3 }]} />
    );
    expect(container.firstChild).not.toBeNull();
  });

  it('DauChart monte sans jeter', () => {
    const { container } = render(<DauChart data={[{ label: '5 juil', actifs: 2 }]} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('PercentBars monte sans jeter', () => {
    const { container } = render(<PercentBars data={labeled} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('CountBars monte sans jeter', () => {
    const { container } = render(<CountBars data={labeled} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('Donut monte et affiche sa légende avec les pourcentages', () => {
    const { getByText } = render(<Donut data={labeled} />);
    expect(getByText('Tâches —')).toBeTruthy();
    expect(getByText('(62%)')).toBeTruthy(); // 42/68 arrondi
  });

  it('Donut tolère un total à zéro (pas de division par zéro)', () => {
    const { container } = render(<Donut data={[{ label: 'Vide', value: 0 }]} />);
    expect(container.firstChild).not.toBeNull();
  });
});

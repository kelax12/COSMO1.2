// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// C-72 — la borne `minDate` de DateCalendarPanel, aux DEUX bords
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 CE QUE CE FICHIER EXISTE POUR EMPÊCHER, ET CE QU'IL N'EST PAS.
//
// Le 2026-09-11, `e2e/demo-calendar.spec.ts` a déclaré que le report en masse
// « désactive aujourd'hui ». C'était FAUX du produit : le test comparait une
// date calculée dans le processus Node (UTC sur le runner) à une date rendue
// par le navigateur (`Europe/Paris` par `playwright.config.ts`), et les deux
// tombent sur des jours différents entre 22 h et minuit UTC.
//
// La leçon n'est pas « le test avait tort », c'est que **rien ne mesurait la
// borne elle-même** : il a fallu trois heures et un run CI nocturne pour
// savoir de quel côté était le défaut. Ce fichier répond à la seule question
// que l'e2e ne pouvait pas trancher — `{ before: floor }` ouvre-t-il le
// jour-pivot ? — et il la tranche sans horloge partagée, sans navigateur, et
// sans dépendre du fuseau de la machine.
//
// ⚠️ Il ne remplace PAS le cas e2e : celui-ci prouve que la borne est CÂBLÉE
// sur la bonne surface. Câblé et correct sont deux mesures différentes.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DateCalendarPanel } from './date-picker';

// Le panneau lit les catalogues i18n pour nommer ses raccourcis et ses jours.
// On ne teste pas les libellés ici : la borne se lit sur `data-disabled`.
vi.mock('@/i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key, tp: (key: string) => key }),
}));

/** `YYYY-MM-DD` d'un jour décalé, dans le fuseau de la machine de test. */
const dayKey = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString('en-CA');
};

const cell = (key: string) => document.querySelector(`td[data-day="${key}"]`);

/**
 * `data-disabled` de react-day-picker, lu à la main.
 *
 * ⚠️ Pas `toHaveAttribute` : les matchers `jest-dom` ne sont pas chargés dans
 * la configuration Vitest de ce dépôt, et `expect(...).toHaveAttribute` y rend
 * « Invalid Chai property » — un message qui ressemble à un défaut du produit
 * alors que c'est un défaut d'outillage. Vu ici avant d'être écrit autrement.
 */
const isDisabled = (el: Element | null): boolean =>
  el?.getAttribute('data-disabled') === 'true';

describe('DateCalendarPanel · borne minDate', () => {
  it('ouvre le jour-pivot et refuse la veille', () => {
    render(<DateCalendarPanel value={undefined} onSelect={() => {}} minDate={dayKey(0)} />);

    // Le bord HAUT : aujourd'hui doit rester choisissable. C'est la moitié que
    // personne ne vérifie, et c'est celle qui décide si quelqu'un peut
    // rattraper une tâche en retard le jour même plutôt que le lendemain.
    expect(isDisabled(cell(dayKey(0)))).toBe(false);

    // Le bord BAS : hier doit être refusé, sinon la borne ne sert à rien.
    // ⚠️ Le 1er du mois, hier n'est pas dans la grille affichée — même réserve
    // que dans le cas e2e, et pour la même raison.
    const yesterday = cell(dayKey(-1));
    if (yesterday) expect(isDisabled(yesterday)).toBe(true);
  });

  it('sans minDate, la veille reste ouverte', () => {
    // TÉMOIN. Sans lui, un panneau qui ne désactiverait plus RIEN rendrait le
    // premier cas vert sur sa première assertion et muet sur la seconde (le
    // `if` ci-dessus l'avalerait). Ici l'absence de borne DOIT se voir.
    render(<DateCalendarPanel value={undefined} onSelect={() => {}} />);

    const yesterday = cell(dayKey(-1));
    if (yesterday) expect(isDisabled(yesterday)).toBe(false);
    expect(isDisabled(cell(dayKey(0)))).toBe(false);
  });

  it('une borne dans le futur refuse bien aujourd’hui', () => {
    // Second TÉMOIN, et il porte le vrai risque : si le détecteur ci-dessus
    // lisait le mauvais attribut, les deux premiers cas passeraient quoi qu'il
    // arrive. Ici la borne est posée à demain, donc aujourd'hui DOIT tomber.
    render(<DateCalendarPanel value={undefined} onSelect={() => {}} minDate={dayKey(1)} />);

    expect(isDisabled(cell(dayKey(0)))).toBe(true);
  });
});

describe('DateCalendarPanel · raccourcis bornés', () => {
  it('ne propose plus « aujourd’hui » quand la borne est demain', () => {
    // La rangée de raccourcis est filtrée par la MÊME borne
    // (`p.value >= minDate`). Les deux filtres se sont déjà comportés
    // différemment : c'est cette asymétrie qui a d'abord fait soupçonner le
    // produit. Les garder d'accord se vérifie, ça ne se suppose pas.
    render(<DateCalendarPanel value={undefined} onSelect={() => {}} minDate={dayKey(1)} />);
    const group = screen.getByRole('group');
    expect(group.textContent).not.toMatch(/datePicker\.today\b/);
  });
});

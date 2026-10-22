// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// Maquette 47 — « Le chargement a la forme du résultat ».
//
// Ce squelette a DÉJÀ dérivé une fois : le 2026-09-05, les lignes de tâches ont
// perdu leur carte et il a continué à dessiner un cadre arrondi sur fond
// `surface`. Rien ne l'a signalé, parce qu'un squelette n'est visible qu'une
// fraction de seconde et jamais sur des données locales — c'est exactement le
// genre d'écran qu'aucune relecture ne rattrape.
//
// La garde compare donc les mesures MOBILE du squelette à celles de `TaskCard`,
// lues dans la source. Elle ne prouve pas que les deux se ressemblent à l'œil ;
// elle prouve qu'on ne peut plus changer l'une sans voir l'autre.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { render } from '@testing-library/react';
import { TaskCardSkeleton } from './index';

vi.mock('@/i18n/useT', () => ({ useT: () => ({ t: (k: string) => k, tp: (k: string) => k }) }));

const source = (rel: string) => readFileSync(path.resolve(process.cwd(), rel), 'utf8');

/** Classes mobiles (sans préfixe responsive) de l'élément rendu. */
const mobileClasses = (el: Element) =>
  (el.getAttribute('class') ?? '').split(/\s+/).filter((c) => c && !c.includes(':'));

describe('squelette de tâche — même forme que la ligne', () => {
  const row = render(<TaskCardSkeleton />).container.firstElementChild!;
  const classes = mobileClasses(row);

  it('reprend le rembourrage et la hauteur minimale de la ligne', () => {
    // Les mêmes valeurs doivent exister dans `TaskCard`, sinon l'une des deux
    // a bougé sans l'autre.
    const card = source('src/components/task-table/TaskCard.tsx');
    expect(card).toContain('px-3 py-2.5');
    expect(card).toContain("minHeight: '60px'");

    expect(classes).toContain('px-3');
    expect(classes).toContain('py-2.5');
    expect(classes).toContain('min-h-[60px]');
  });

  it('sépare par un filet, comme la liste', () => {
    expect(classes).toContain('border-b');
  });

  it("ne redessine pas la carte que la ligne n'a plus", () => {
    // Le fond `surface` et l'arrondi sont autorisés SOUS `md:` (le desktop a
    // gardé son rendu en carte) — jamais sans préfixe.
    expect(classes.some((c) => c.startsWith('rounded'))).toBe(false);
    expect(classes.some((c) => c.startsWith('bg-'))).toBe(false);
    expect(classes).not.toContain('border');
  });

  it('détecte réellement une carte remise sur mobile (témoin)', () => {
    // Le témoin fait passer la même vérification sur une valeur fautive : sans
    // lui, les trois attentes ci-dessus passeraient aussi sur une classe vide.
    const fautif = ['flex', 'rounded-xl', 'bg-[rgb(var(--color-surface))]', 'border'];
    expect(fautif.some((c) => c.startsWith('rounded'))).toBe(true);
    expect(fautif.some((c) => c.startsWith('bg-'))).toBe(true);
    expect(fautif).toContain('border');
  });
});

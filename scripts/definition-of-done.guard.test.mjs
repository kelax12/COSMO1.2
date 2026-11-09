// ═══════════════════════════════════════════════════════════════════
// Témoin de l'ADR 0020 (vagues 6.2 et 6.4, PRO-06, PRD-01, PRO-02) :
// Definition of Done, backlog en issues, gel fonctionnel.
//
// Ce n'est pas une garde de produit : rien n'empêche un commit sans revue.
// C'est la garde de la règle ELLE-MÊME, pour qu'elle ne s'érode pas en
// silence : les cinq critères restent nommés dans CONTRIBUTING.md, le gabarit
// d'issue existe et porte la DoD, l'ADR est indexé, et `a-faire-code.md`
// reste un renvoi au lieu de redevenir une liste que personne ne filtre.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = process.cwd();
const lire = (c) => readFileSync(join(RACINE, c), 'utf8');

export const CRITERES = [
  ['CI noyau sur le SHA exact', /CI noyau.{0,30}SHA exact/s],
  ['tests du parcours touché', /Tests du parcours touché/],
  ['double mode démo et Supabase', /Double mode, démo et Supabase/],
  ['doc d\'état à jour dans le même commit', /Doc d'état à jour dans le même commit/],
  ['revue pour la base et la sécurité', /Revue pour tout changement de base ou de sécurité/],
];

/** Les critères que le texte ne nomme pas : vide si la DoD est entière. */
export function criteresManquants(texte) {
  return CRITERES.filter(([, re]) => !re.test(texte)).map(([nom]) => nom);
}

describe('Definition of Done (ADR 0020)', () => {
  it('le détecteur voit un critère retiré (témoin)', () => {
    const entier = lire('CONTRIBUTING.md');
    expect(criteresManquants(entier)).toEqual([]);
    const sans = entier.replace('Revue pour tout changement de base ou de sécurité', 'x');
    expect(criteresManquants(sans)).toEqual(['revue pour la base et la sécurité']);
  });

  it('CONTRIBUTING.md porte la DoD en cinq critères numérotés et la règle de gel', () => {
    const t = lire('CONTRIBUTING.md');
    expect(t).toMatch(/^## Definition of Done$/m);
    expect(criteresManquants(t)).toEqual([]);
    const section = t.split(/^## Definition of Done$/m)[1] ?? '';
    for (const n of [1, 2, 3, 4, 5]) expect(section, `critère ${n}`).toMatch(new RegExp(`^${n}\\. \\*\\*`, 'm'));
    expect(t).toMatch(/^## Gel fonctionnel$/m);
    expect(t).toMatch(/Une fonctionnalité à la fois/);
    expect(t).toContain('0020-definition-of-done-et-gel-fonctionnel.md');
    // la règle de l'ADR 0013 garde son titre (elle a son propre témoin)
    expect(t).toMatch(/## Proposer une fonctionnalité de plus d'une semaine/);
  });

  it("l'ADR 0020 existe, est indexé et nomme les cinq critères", () => {
    const adr = 'docs/adr/0020-definition-of-done-et-gel-fonctionnel.md';
    expect(existsSync(join(RACINE, adr))).toBe(true);
    expect(lire('docs/adr/README.md')).toContain('0020-definition-of-done-et-gel-fonctionnel.md');
    const t = lire(adr);
    expect(t).toMatch(/Statut\*\* : acceptée/);
    expect(t).toMatch(/SHA exact/);
    expect(t).toMatch(/double mode/);
    expect(t).toMatch(/seconde session/);
    expect(t).toContain('0013-validation-d-usage-avant-toute-fonctionnalite-longue.md');
  });

  it('le gabarit de tâche de backlog existe, étiquette le backlog et porte la DoD', () => {
    const c = '.github/ISSUE_TEMPLATE/tache-de-backlog.md';
    expect(existsSync(join(RACINE, c))).toBe(true);
    const t = lire(c);
    expect(t).toMatch(/^labels: backlog$/m);
    expect(t).toMatch(/^assignees: kelax12$/m);
    expect(t).toMatch(/DÉPÔT PUBLIC/);
    expect(t).toMatch(/## Definition of Done/);
    expect(t).toMatch(/SHA exact/);
    // le gabarit de proposition (ADR 0013) reste à côté
    expect(existsSync(join(RACINE, '.github/ISSUE_TEMPLATE/proposition-de-fonctionnalite.md'))).toBe(true);
  });

  it('a-faire-code.md reste un renvoi vers les issues, pas une liste', () => {
    const t = lire('a-faire-code.md');
    expect(t).toMatch(/issues\?q=is%3Aissue\+is%3Aopen\+label%3Abacklog/);
    expect(t).toContain('docs/archive/a-faire-code-jusqua-2026-11-09.md');
    // un item ouvert ne s'écrit plus ici : pas de titre `### C-NN`
    expect(t).not.toMatch(/^#{2,4} .*\bC-\d+\b.*·/m);
    expect(t.split('\n').length, 'a-faire-code.md regrossit : le détail va dans l\'issue').toBeLessThan(120);
    expect(existsSync(join(RACINE, 'docs/archive/a-faire-code-jusqua-2026-11-09.md'))).toBe(true);
  });

  it('aucun de ces fichiers ne porte de tiret cadratin', () => {
    for (const c of [
      'CONTRIBUTING.md',
      'a-faire-code.md',
      'docs/adr/0020-definition-of-done-et-gel-fonctionnel.md',
      '.github/ISSUE_TEMPLATE/tache-de-backlog.md',
      '.github/ISSUE_TEMPLATE/config.yml',
    ]) {
      expect(lire(c), c).not.toContain('—');
    }
  });
});

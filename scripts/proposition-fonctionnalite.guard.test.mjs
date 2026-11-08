// ═══════════════════════════════════════════════════════════════════
// Témoin de la règle de l'ADR 0013 (V20.4, PRD-02) : validation d'usage
// avant toute fonctionnalité de plus d'une semaine.
//
// Ce n'est pas une garde de produit : rien n'empêche un commit sans
// proposition. C'est la garde de la règle ELLE-MÊME, pour qu'elle ne
// s'érode pas en silence : les six rubriques existent dans le gabarit ET dans
// l'issue, CONTRIBUTING.md les nomme, l'ADR est indexé. Une rubrique qui
// disparaît du gabarit sans que l'ADR change rend la règle creuse.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = process.cwd();
const lire = (c) => readFileSync(join(RACINE, c), 'utf8');

export const RUBRIQUES = [
  ['Problème', /problème/i],
  ["Preuve d'usage", /preuve d'usage/i],
  ['Maquette', /maquette/i],
  ['Test auprès de N utilisateurs', /test auprès de N utilisateurs/i],
  ["Mesure d'activation", /mesure d'activation/i],
  ["Critère d'abandon", /critère d'abandon/i],
];

describe('proposition de fonctionnalité (ADR 0013)', () => {
  it('le gabarit et l\'issue portent les six rubriques, numérotées de 1 à 6', () => {
    for (const chemin of ['docs/propositions/GABARIT.md', '.github/ISSUE_TEMPLATE/proposition-de-fonctionnalite.md']) {
      const t = lire(chemin);
      RUBRIQUES.forEach(([nom, re], i) => {
        const titre = new RegExp(`^## ${i + 1}\\. .*${re.source}`, re.flags + 'm');
        expect(t, `${chemin} : rubrique ${i + 1} (${nom})`).toMatch(titre);
      });
    }
  });
  it('le gabarit exige au moins 5 utilisateurs et un critère d\'abandon daté', () => {
    const t = lire('docs/propositions/GABARIT.md');
    expect(t).toMatch(/au moins 5/);
    expect(t).toMatch(/Date de lecture/);
    expect(t).toMatch(/Seuil/);
  });
  it('CONTRIBUTING.md nomme la règle, le seuil d\'une semaine et le gabarit', () => {
    const t = lire('CONTRIBUTING.md');
    expect(t).toMatch(/## Proposer une fonctionnalité de plus d'une semaine/);
    expect(t).toContain('docs/propositions/GABARIT.md');
    expect(t).toContain('0013-validation-d-usage-avant-toute-fonctionnalite-longue.md');
    for (const [nom, re] of RUBRIQUES) expect(t, nom).toMatch(re);
  });
  it('l\'ADR 0013 est indexé et son lien vers le gabarit résout', () => {
    const index = lire('docs/adr/README.md');
    expect(index).toContain('0013-validation-d-usage-avant-toute-fonctionnalite-longue.md');
    expect(index).toContain('0012-indicateurs-mesures-a-la-place-des-notes.md');
    expect(lire('docs/adr/0013-validation-d-usage-avant-toute-fonctionnalite-longue.md')).toContain('../propositions/GABARIT.md');
  });
  it('aucun de ces fichiers ne porte de tiret cadratin', () => {
    for (const c of [
      'docs/propositions/GABARIT.md', '.github/ISSUE_TEMPLATE/proposition-de-fonctionnalite.md',
      'docs/adr/0012-indicateurs-mesures-a-la-place-des-notes.md', 'docs/adr/0013-validation-d-usage-avant-toute-fonctionnalite-longue.md',
      'docs/INDICATEURS.md', 'scripts/indicateurs.mjs', 'scripts/indicateurs.config.json', '.github/workflows/indicateurs.yml',
    ]) {
      expect(lire(c), c).not.toContain('—');
    }
  });
});

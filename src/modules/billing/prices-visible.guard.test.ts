// ═══════════════════════════════════════════════════════════════════
// Garde · l'affichage des prix a UNE seule réponse (2026-10-16).
//
// `PRICES_VISIBLE` (premium-config.ts) masque les montants dans l'app et sur
// la landing. Le prérendu (`prerender.mjs`) est un script Node qui ne lit pas
// le TypeScript : il porte une constante miroir, `PRIX_VISIBLES`. Sans ce
// test, les deux divergent en silence et la page servie aux moteurs annonce
// des prix que la page rendue par React ne montre plus (ou l'inverse).
//
// Le prérendu est lu comme du TEXTE : l'importer exécuterait tout le build
// statique.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENTERPRISE_BILLING_ENFORCED, PRICES_VISIBLE } from './premium-config';

const PRERENDER = join(process.cwd(), 'prerender.mjs');

/** Valeur de `PRIX_VISIBLES` dans le texte du prérendu, ou `null` si absente. */
function lirePrixVisiblesPrerendu(source: string): boolean | null {
  const m = /^const PRIX_VISIBLES = (true|false);$/m.exec(source);
  return m ? m[1] === 'true' : null;
}

describe('garde : affichage des prix (PRICES_VISIBLE)', () => {
  const source = readFileSync(PRERENDER, 'utf-8');

  it('le prérendu porte la même valeur que premium-config.ts', () => {
    expect(lirePrixVisiblesPrerendu(source)).toBe(PRICES_VISIBLE);
  });

  it('le paragraphe « Tarifs » du prérendu passe par la constante, en fr et en en', () => {
    expect(source).toContain('${PRIX_VISIBLES ? `<h2>Tarifs</h2>');
    expect(source).toContain('${PRIX_VISIBLES ? `<h2>Pricing</h2>');
  });

  it('on ne vend pas sans afficher de prix', () => {
    // Le prérendu ne calcule pas le OU avec la facturation : si elle est
    // réactivée, sa constante doit être relevée à la main.
    if (ENTERPRISE_BILLING_ENFORCED) expect(lirePrixVisiblesPrerendu(source)).toBe(true);
  });

  it('TÉMOIN : le lecteur voit une divergence et une constante absente', () => {
    const inverse = source.replace(
      /^const PRIX_VISIBLES = (true|false);$/m,
      `const PRIX_VISIBLES = ${!PRICES_VISIBLE};`,
    );
    expect(lirePrixVisiblesPrerendu(inverse)).toBe(!PRICES_VISIBLE);
    expect(lirePrixVisiblesPrerendu('const AUTRE = false;')).toBeNull();
  });
});

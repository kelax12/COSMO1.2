// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// ChartStyle — l allowlist anti-XSS du CSS injecte
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI ces tests existent (C-44).
//
// `ui/chart.tsx` fait un `dangerouslySetInnerHTML` sur du CSS construit,
// protege par deux gardes ecrites a la main : `SAFE_COLOR_RE` (hex, `hsl()`,
// `rgb()`, `var(--…)`) et une validation de l `id` interpole dans le
// selecteur. Le commentaire du fichier explique le scenario d evasion —
// `; } body { display:none } #x{x:` — et AUCUN test ne le verifiait, dans un
// composant monte par quatre ecrans. C est exactement le cas de `RichText`
// avant le 2026-09-02, dans un fichier que la revue n avait pas atteint.
//
// ⚠️ Le risque est aujourd hui THEORIQUE : les quatre appelants passent des
// constantes hexadecimales. C est la garde qui n est pas eprouvee, pas une
// exposition mesuree.
//
// Le SECOND effet compte autant, et c est pour ca que les formats reels des
// quatre appelants sont testes un par un : une couleur legitime que
// `SAFE_COLOR_RE` refuserait disparaitrait EN SILENCE, sans erreur nulle part.

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ChartContainer, type ChartConfig } from './chart';

/** Rend un graphique et renvoie le CSS que `ChartStyle` a injecte. */
function injectedCss(config: ChartConfig, id?: string): string {
  const { container } = render(
    <ChartContainer id={id} config={config}>
      <div />
    </ChartContainer>,
  );
  return Array.from(container.querySelectorAll('style'))
    .map((s) => s.innerHTML)
    .join(String.fromCharCode(10));
}

describe('ChartStyle — couleurs acceptees', () => {
  // Les formats REELLEMENT passes par les quatre ecrans qui montent ce
  // composant. S ils cessaient de passer, le graphique perdrait ses couleurs
  // sans qu aucune erreur ne le dise.
  it.each([
    ['DashboardBarChart, minuscules', '#3b82f6'],
    ['StatisticsPage, MAJUSCULES', '#3B82F6'],
    ['TeamOverviewTab', '#10b981'],
    ['admin/AdminCharts', '#22c55e'],
    ['hex court', '#fff'],
    ['hex avec alpha', '#3b82f680'],
    ['jeton de theme', 'var(--color-accent-solid)'],
    ['hsl', 'hsl(220 90% 56%)'],
    ['rgb', 'rgb(59, 130, 246)'],
  ])('%s : %s traverse jusqu au CSS', (_label, color) => {
    expect(injectedCss({ serie: { label: 'S', color } })).toContain(`--color-serie: ${color};`);
  });
});

describe('ChartStyle — evasions refusees', () => {
  it('la couleur d evasion du commentaire ne produit AUCUNE regle', () => {
    // C est le scenario que le fichier decrit : fermer la declaration, puis
    // ouvrir un selecteur a soi.
    const css = injectedCss({
      serie: { label: 'S', color: '; } body { display:none } #x{x:' },
    });
    expect(css).not.toContain('display:none');
    expect(css).not.toContain('--color-serie');
  });

  it.each([
    ['expression url()', 'url(https://exfil.example/x)'],
    ['fin de balise style', '</style><script>alert(1)</script>'],
    ['accolade seule', 'red } body {'],
    ['couleur nommee', 'red'],
    ['var() avec argument', 'var(--x, url(//evil))'],
  ])('%s est refuse', (_label, color) => {
    expect(injectedCss({ serie: { label: 'S', color } })).not.toContain('--color-serie');
  });

  it('un id d evasion ne rend AUCUN style', () => {
    // L id est interpole dans le selecteur `[data-chart=…]`. `ChartContainer`
    // le prefixe par `chart-`, ce qui ne le rend pas sur pour autant : c est la
    // validation qui l est.
    expect(injectedCss({ serie: { label: 'S', color: '#3b82f6' } }, 'x] { } body { display:none } [y=')).toBe('');
  });

  it('une CLE d evasion ne produit aucune regle', () => {
    // La cle devient un nom de propriete personnalisee.
    const css = injectedCss({ 'a: red; b': { label: 'S', color: '#3b82f6' } } as ChartConfig);
    expect(css).not.toContain('a: red');
  });

  it('un id ordinaire, lui, rend bien le style', () => {
    // TEMOIN : sans lui, une garde trop large rendrait TOUS les cas ci-dessus
    // verts en ne rendant jamais rien.
    // (`ChartContainer` prefixe l id par `chart-`.)
    expect(injectedCss({ serie: { label: 'S', color: '#3b82f6' } }, 'abc-123')).toContain('[data-chart=chart-abc-123]');
  });
});

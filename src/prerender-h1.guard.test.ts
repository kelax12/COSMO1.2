import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error module .mjs sans déclaration de types (Node brut, partagé avec prerender.mjs)
import { demoteH1, countH1, bodyWords } from '../scripts/prerender-h1.mjs';

// 2026-11-06 · Un audit externe a compté DEUX <h1> sur chaque page de contenu
// servie (régression de 66f76355 : la copie peinte avant React portait le sien,
// à côté de celui du texte SEO), et 700 mots seulement pour le guide. Le build
// (`verifierPage`, prerender.mjs) refuse les deux ; ce fichier tient les pièces.

const ROOT = join(__dirname, '..');
const prerender = readFileSync(join(ROOT, 'prerender.mjs'), 'utf8');

describe('un seul <h1> par page prérendue', () => {
  const copie = '<div class="x"><h1 class="font-display">Titre</h1><h1>Vue mobile</h1></div>';
  const page = `<body><div id="lp-hero">${copie}</div><div id="root"><div id="seo-fallback"><h1>Titre</h1></div></div></body>`;

  it('témoin : sans rétrogradation, la page porte les deux <h1> du défaut', () => {
    expect(countH1(page)).toBe(3);
  });

  it('la copie rétrogradée laisse le seul <h1> du texte SEO', () => {
    const corrige = page.replace(copie, demoteH1(copie));
    expect(countH1(corrige)).toBe(1);
    expect(corrige).toContain('<div class="font-display">Titre</div>');
  });

  it('ne touche ni <header>, ni <hr>, ni <h10>', () => {
    const autres = '<header><hr><h10>x</h10><h1>a</h1></header>';
    expect(demoteH1(autres)).toBe('<header><hr><h10>x</h10><div>a</div></header>');
  });

  it('prerender.mjs rétrograde les <h1> des DEUX copies et vérifie chaque page écrite', () => {
    expect(prerender).toMatch(/data-track="\$\{track\}">\$\{demoteH1\(fragment\)\}/);
    expect(prerender).toMatch(/data-track="contenu">\$\{demoteH1\(fragment\)\}/);
    // Une page écrite sans passer par verifierPage échapperait à la garde.
    expect((prerender.match(/verifierPage\(/g) ?? []).length).toBe(3);
    expect((prerender.match(/writeFileSync\(join\((dir|DIST, localizePath\('\/', locale\)), 'index\.html'\)/g) ?? []).length).toBe(2);
  });
});

describe('le guide servi porte le guide entier', () => {
  it('bodyWords compte le texte du <body>, scripts et styles retirés', () => {
    expect(bodyWords('<head><title>a b c</title></head><body><script>x y z</script><style>p{}</style><p>un deux</p> trois &amp; quatre</body>')).toBe(4);
  });

  it('accepte une balise fermante avec espaces ou casse mixte (CodeQL js/bad-tag-filter)', () => {
    const page = '<body><script>un deux</script ><style>p{}</STYLE\t\n><p>trois</p></SCRIPT ></body>';
    expect(bodyWords(page)).toBe(1);
  });

  it('prerender.mjs fixe un plancher de mots pour /guide', () => {
    expect(prerender).toMatch(/MOTS_MIN = \{ '\/guide': \d{4} \}/);
  });

  it('la copie du guide ne coupe plus ses sections derrière le contexte de prérendu', () => {
    const guide = readFileSync(join(ROOT, 'src/pages/GuidePage.tsx'), 'utf8');
    // Seules les vitrines (balisage lourd, thème inconnu au build) sont écartées.
    expect(guide).not.toMatch(/\{!copie && \(<>/);
    expect((guide.match(/\{!copie && \(/g) ?? []).length).toBe(5);
  });
});

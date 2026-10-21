import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error module .mjs sans déclaration de types (Node brut, partagé avec prerender.mjs)
import { heroSourcesDigest, HERO_SOURCES, SOURCES_MANIFEST } from '../scripts/landing-hero-sources.mjs';
// @ts-expect-error idem
import { scopedCssFor } from '../scripts/landing-hero-css.mjs';

// 2026-10-21 · Le prérendu de la home peint une COPIE du header et du hero de
// la landing (#lp-hero) au lieu du texte SEO brut, que les visiteurs voyaient
// passer avant la landing (« corrigé » huit fois). Pourquoi et mécanique :
// `src/lib/prerender-hero.ts`.
//
// La copie est une capture, pas un rendu au build : ce fichier est ce qui
// l'empêche de se périmer en silence, et ce qui garde les règles CSS qui la
// rendent visible au seul visiteur sans session.

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const LOCALES = ['fr', 'en'] as const;

describe('copie du hero : fraîcheur de la capture', () => {
  it('a été capturée sur les sources ACTUELLES du header et du hero', () => {
    expect(existsSync(join(ROOT, SOURCES_MANIFEST)), `${SOURCES_MANIFEST} absent`).toBe(true);
    const enregistre = JSON.parse(read(SOURCES_MANIFEST)) as Record<string, string>;
    const actuel = heroSourcesDigest(ROOT) as Record<string, string>;
    const perimes = HERO_SOURCES.filter((p: string) => enregistre[p] !== actuel[p]);
    expect(
      perimes,
      'La copie du hero ne décrit plus ces sources : la relève copie → landing ferait un saut.\n' +
        'Refaire la capture : npm run build, npx vite preview --port 4173 --strictPort, ' +
        'puis npm run capture:landing-hero (cf. scripts/capture-landing-hero.mjs).',
    ).toEqual([]);
  });

  it('témoin : l’empreinte change quand une source change, fins de ligne mises à part', () => {
    const a = heroSourcesDigest(ROOT) as Record<string, string>;
    expect(Object.keys(a)).toEqual(HERO_SOURCES);
    expect(new Set(Object.values(a)).size).toBe(HERO_SOURCES.length);
  });

  for (const locale of LOCALES) {
    it(`${locale} : porte les textes du hero de son catalogue, et rien qui rejouerait une entrée`, () => {
      const html = read(`scripts/landing-hero/${locale}.html`);
      const hero = (JSON.parse(read(`src/locales/${locale}/landing.json`)) as { hero: Record<string, string> }).hero;
      const texte = html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
      for (const cle of ['line1', 'line2', 'subtitle', 'demoCta', 'signupCta']) {
        expect(texte, `hero.${cle}`).toContain(hero[cle]);
      }
      // Un id dupliquerait celui de l'app pendant la relève.
      expect(html).not.toMatch(/\sid="/);
      expect(html).not.toMatch(/\bhero-(line-in|rise|chip|window|link|dock-settle)\b/);
    });
  }
});

describe('copie du hero : visible pour le seul visiteur sans session', () => {
  const index = read('index.html');

  it('masquée par défaut, peinte en calque sous html[data-prerendered] seulement', () => {
    expect(index).toMatch(/#lp-hero\{display:none\}/);
    expect(index).toMatch(/html\[data-prerendered\] #lp-hero\{display:block;position:fixed;inset:0;z-index:10000/);
  });

  it('le texte SEO n’est plus peint quand la copie est là (il reste dans le balisage)', () => {
    expect(index).toMatch(/html\[data-prerendered\] #lp-hero ~ #root #seo-fallback\{display:none\}/);
  });

  it('sans JS : pas de copie aux boutons morts, et le texte SEO reprend le dessus', () => {
    const noscript = index.match(/<noscript>\s*<style>([^<]*)<\/style>\s*<\/noscript>/)?.[1] ?? '';
    expect(noscript).toContain('#lp-hero{display:none!important}');
    expect(noscript).toContain('#seo-fallback{display:block!important}');
  });

  it('prerender.mjs la pose HORS de #root (createRoot l’effacerait), inerte, avec sa langue', () => {
    const prerender = read('prerender.mjs');
    expect(prerender).toContain('<div id="lp-hero" inert data-locale="${locale}">${fragment}</div>');
    expect(prerender).toMatch(/replace\('<div id="root">', \(\) => `<div id="lp-hero"/);
    expect(prerender).toMatch(/let home = injectHeroCopy\(buildPage\(homeRoute/);
  });

  it('la landing la relève dans l’image où elle peint son hero, et ne rejoue pas ce qu’elle montrait', () => {
    const perso = read('src/pages/landing/PersoTrack.tsx');
    expect(perso).toContain('const reprise = usePrerenderHeroTakeover();');
    expect(read('src/pages/landing/use-prerender-hero-takeover.ts')).toMatch(/useLayoutEffect\(\(\) => \{\s*releasePrerenderHero\(\);/);
    expect(perso).toContain("${reprise ? '' : 'hero-line-in '}");
    expect(perso).toContain("if (!reprise) gsap.from('[data-hero-fade]'");
    const landing = read('src/pages/LandingPage.tsx');
    expect(landing).toContain('initial={reduceMotion || reprise ? false');
    // Le voile de transition de #track partait d'une opacité 1 au montage : il
    // blanchissait le hero relevé (mesuré le 2026-10-21, hero délavé à 4,7 s).
    expect(landing).toContain('initial={reprise && transitionKey === 0 ? false : { opacity: 1 }}');
  });

  it('les autres sorties la retirent : session vue par React, écran d’erreur, autre langue', () => {
    expect(read('src/App.tsx')).toMatch(/if \(isAuthenticated\) \{[\s\S]{0,200}releasePrerenderHero\(\);/);
    expect(read('src/components/RootErrorBoundary.tsx')).toContain('releasePrerenderHero();');
    expect(read('src/components/AppErrorBoundary.tsx')).toContain("if (!('fallback' in this.props)) releasePrerenderHero();");
    expect(read('src/boot.ts')).toContain('dropPrerenderHeroIfLocaleDiffers(locale);');
  });
});

describe('landing-hero-css : la CSS de la copie, confinée sous #lp-hero', () => {
  const html = '<div class="a b"><h1 class="t">x</h1><svg><path></path></svg></div>';
  const css = [
    'html{font-family:Inter}',
    ':root{--c:1}',
    '.a{color:red}',
    '.absente{color:blue}',
    '.a .b{margin:0}',
    '.a:hover{color:green}',
    '.group:hover .t{color:pink}',
    'h1{font-size:inherit}',
    'select{appearance:none}',
    '@media (min-width:640px){.t{font-size:2rem}.absente{x:y}}',
    '@media (min-width:9999px){.absente{x:y}}',
    '@keyframes spin{to{transform:rotate(1turn)}}',
    "@font-face{font-family:Inter;font-display:swap;src:url(/fonts/inter.woff2)}",
  ].join('\n');
  const out: string = scopedCssFor(html, css);

  it('garde les règles dont toutes les classes sont dans la copie, préfixées', () => {
    expect(out).toContain('#lp-hero .a{color:red}');
    expect(out).toContain('#lp-hero .a .b{margin:0}');
    expect(out).toContain('#lp-hero h1{font-size:inherit}');
    expect(out).toMatch(/@media \(min-width:640px\)\{\s*#lp-hero \.t\{font-size:2rem\}\s*\}/);
  });

  it('fait de html, body et :root la portée elle-même', () => {
    expect(out).toContain('#lp-hero{font-family:Inter}');
    expect(out).toContain('#lp-hero{--c:1}');
  });

  it('jette classes absentes, balises absentes, états interactifs, @keyframes et @media vidés', () => {
    expect(out).not.toContain('absente');
    expect(out).not.toContain('select');
    expect(out).not.toContain(':hover');
    expect(out).not.toContain('@keyframes');
    expect(out).not.toContain('9999px');
  });

  it('laisse passer @font-face, en block : peinte en police système, la copie est plus petite que le hero React, qui reprend le LCP', () => {
    expect(out).toContain('@font-face');
    expect(out).toContain('font-display:block');
    expect(out).not.toContain('font-display:swap');
  });
});

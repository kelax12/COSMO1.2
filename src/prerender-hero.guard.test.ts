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
// Espace insécable : écrit par son code, un littéral se lit comme une espace.
const NBSP = String.fromCharCode(160);

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

  const TEXTES = {
    perso: { catalogue: 'landing', chemin: ['hero'], cles: ['line1', 'line2', 'subtitle', 'demoCta', 'signupCta'] },
    entreprise: { catalogue: 'landingEnterprise', chemin: ['enterprise', 'hero'], cles: ['line1', 'line2', 'cta'] },
  } as const;
  const texteDe = (html: string) =>
    html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').split(NBSP).join(' ').replace(/\s+/g, ' ');

  const CAPTURES = [
    ...LOCALES.map((l) => ['perso', `perso-${l}`, l] as const),
    ...LOCALES.map((l) => ['entreprise', `entreprise-${l}`, l] as const),
    ...LOCALES.map((l) => ['entreprise', `entreprise-${l}-mobile`, l] as const),
  ];
  for (const [track, fichier, locale] of CAPTURES) {
    it(`${fichier} : porte les textes du hero de son catalogue, et rien qui rejouerait une entrée`, () => {
      const html = read(`scripts/landing-hero/${fichier}.html`);
      const { catalogue, chemin, cles } = TEXTES[track];
      let noeud = JSON.parse(read(`src/locales/${locale}/${catalogue}.json`)) as Record<string, unknown>;
      for (const k of chemin) noeud = noeud[k] as Record<string, unknown>;
      const texte = texteDe(html);
      for (const cle of cles) {
        expect(texte, `${chemin.join('.')}.${cle}`).toContain(String(noeud[cle]).split(NBSP).join(' '));
      }
      // Un id dupliquerait celui de l'app pendant la relève.
      expect(html).not.toMatch(/\sid="/);
      expect(html).not.toMatch(/\bhero-(line-in|rise|chip|window|link|dock-settle)\b/);
      // Un <canvas> cloné (shader entreprise) serait vide.
      expect(html).not.toContain('<canvas');
    });
  }

  it('entreprise : la pile garde son image (masquée, React la peignait plus grande et reprenait le LCP à 6,4 s)', () => {
    for (const fichier of LOCALES.flatMap((l) => [`entreprise-${l}`, `entreprise-${l}-mobile`])) {
      const html = read(`scripts/landing-hero/${fichier}.html`);
      expect(html, fichier).toMatch(/<img[^>]*\ssrc="\/[^"]+"[^>]*loading="eager"|<img[^>]*loading="eager"[^>]*\ssrc="\/[^"]+"/);
    }
  });

  it('entreprise : deux vues, bureau et mobile, au seuil de useIsMobile (768 px)', () => {
    const prerender = read('prerender.mjs');
    expect(prerender).toContain('`${track}-${locale}-mobile.html`');
    expect(prerender).toContain('@media (max-width:767px){#lp-hero>.lp-vue-bureau{display:none}#lp-hero>.lp-vue-mobile{display:block}}');
    expect(read('src/lib/hooks/use-mobile.tsx')).toContain('const MOBILE_BREAKPOINT = 768;');
  });
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
    expect(prerender).toContain('<div id="lp-hero" inert data-locale="${locale}" data-track="${track}">${fragment}</div>');
    expect(prerender).toMatch(/replace\('<div id="root">', \(\) => `<div id="lp-hero"/);
    expect(prerender).toMatch(/let home = injectHeroCopy\(buildPage\(homeRoute/);
    expect(prerender).toContain('route.heroTrack ? injectHeroCopy(page, locale, route.heroTrack) : page');
  });

  it('seules la home et l’entreprise sont PEINTES avant React ; les autres pages gardent le spinner', () => {
    const prerender = read('prerender.mjs');
    // Le texte SEO brut, sur fond blanc, peint sur le guide, le blog… : arbitré le 2026-10-21.
    expect(prerender).toContain("if (route.heroTrack) out = out.replace(/<html(?![^>]*data-prerendered)/, '<html data-prerendered');");
    expect((prerender.match(/heroTrack: '/g) ?? []).length).toBe(2);
    expect(index).toMatch(/html\[data-prerendered\] #lp-hero\[data-track=entreprise\]\{background:#08090C\}/);
  });

  it('les routes publiques se chargent derrière BootScreen, le spinner de démarrage à l’identique', () => {
    const app = read('src/App.tsx');
    for (const page of ['LoginPage', 'GuidePage', 'BlogIndexPage', 'BlogArticlePage', 'AProposPage', 'UseCasePage', 'CGUPage', 'NotFoundPage']) {
      expect(app, page).toContain(`<PublicPageWithSuspense><${page} /></PublicPageWithSuspense>`);
    }
    expect(app).toMatch(/const PublicPageWithSuspense[\s\S]{0,200}<Suspense fallback=\{<BootScreen \/>\}>/);
    expect(read('src/components/BootScreen.tsx')).toContain('<div className="boot-screen" role="status"');
    // Même CSS pour les deux, sinon un spinner en remplace un autre.
    expect(index).toContain('#boot-screen,.boot-screen{');
    expect(index).toContain('#boot-screen .ring,.boot-screen .ring{');
  });

  it('le spinner prend les couleurs EXACTES de chaque thème (fond et accent de src/index.css)', () => {
    const css = read('src/index.css');
    const hex = (rgb: string) =>
      '#' + rgb.trim().split(/\s+/).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
    const jeton = (selecteur: string, nom: string) => {
      const debut = css.indexOf(`${selecteur} {`);
      const bloc = css.slice(debut, css.indexOf('}', debut));
      const m = bloc.match(new RegExp(`--color-${nom}:\\s*([\\d\\s]+);`));
      expect(m, `${selecteur} --color-${nom}`).not.toBeNull();
      return hex(m![1]);
    };
    for (const [theme, selecteur] of [['light', ':root'], ['dark', '.dark'], ['gris', '.gris'], ['noir', '.noir']] as const) {
      const regle = index.match(new RegExp(`html\\[data-boot-theme=${theme}\\] :is\\(#boot-screen,\\.boot-screen\\)\\{([^}]*)\\}`))?.[1] ?? '';
      expect(regle, theme).toContain(`--bs-bg:${jeton(selecteur, 'background')}`);
      expect(regle, theme).toContain(`--bs-accent:${jeton(selecteur, 'accent-solid')}`);
    }
  });

  it('le hero entreprise la relève aussi, sans rejouer aucune entrée', () => {
    const hero = read('src/pages/landing/entreprise/EnterpriseHero.tsx');
    expect(hero).toContain('const reprise = usePrerenderHeroTakeover();');
    expect(hero).toMatch(/mm\.add\('\(prefers-reduced-motion: no-preference\)', \(\) => \{[\s\S]{0,400}if \(reprise\) return;/);
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

// Copie du haut de la landing, peinte par le prérendu de `/` et `/en/`.
//
// 🔴 POURQUOI (2026-10-21). Depuis C-116, une page prérendue se peint avant
// React, pour le LCP mobile. Sur la home, ce premier rendu était le texte SEO
// brut (#seo-fallback) : un visiteur voyait un mur de texte, puis le squelette
// gris de `LandingSkeleton`, puis la landing. Trois pages différentes, l'une
// après l'autre. Le bug a été « corrigé » huit fois : chaque correctif traitait
// un cas (personne connectée, CSP…) sans toucher la décision de C-116.
//
// Le prérendu de la home peint désormais `#lp-hero`, une COPIE du header et du
// hero rendus par React (`scripts/capture-landing-hero.mjs`), avec leur CSS
// réelle (`scripts/landing-hero-css.mjs`). Elle vit HORS de `#root`, en calque
// fixe : `createRoot` ne peut donc pas l'effacer, et l'attente de l'auth (rendu
// `null`) comme le squelette passent dessous, sans être vus. La landing la
// retire elle-même, dans l'image où elle peint son propre hero (`useLayoutEffect`
// de `PersoTrack`) : la relève se fait sans saut.
//
// Les autres sorties la retirent aussi, sinon elle couvrirait l'app : une
// session trouvée par React (redirection vers l'app), une erreur attrapée par
// une frontière, une locale différente de celle de la copie (`boot.ts`).
// ⚠️ Une personne connectée ne la voit jamais : le script inline d'index.html
// retire `data-prerendered` avant la première peinture, et le calque n'est
// affiché que sous cet attribut.

export const PRERENDER_HERO_ID = 'lp-hero';

function copie(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById(PRERENDER_HERO_ID);
}

/**
 * Vrai si la copie est À L'ÉCRAN : la landing qui la relève ne rejoue alors pas
 * les entrées de ce que la copie montrait déjà (titre, sous-titre, header), qui
 * disparaîtraient pour réapparaître. À lire au premier rendu, avant la relève.
 */
export function prerenderHeroShown(): boolean {
  const el = copie();
  return el !== null && document.documentElement.hasAttribute('data-prerendered');
}

/** Retire la copie. Sans effet si elle n'est pas (ou plus) là. */
export function releasePrerenderHero(): void {
  copie()?.remove();
}

/**
 * La copie est écrite dans UNE langue. Si l'amorçage du routeur en a choisi une
 * autre (`/` → `/en/` selon la préférence), la landing qui arrive ne lui
 * ressemblera pas : on la retire, et la page repasse sur le spinner plutôt que
 * de peindre le texte SEO d'une langue qui n'est pas celle du visiteur.
 */
export function dropPrerenderHeroIfLocaleDiffers(locale: string): void {
  const el = copie();
  if (!el || el.dataset.locale === locale) return;
  el.remove();
  document.documentElement.removeAttribute('data-prerendered');
}

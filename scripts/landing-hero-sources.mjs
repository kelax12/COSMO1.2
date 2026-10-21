// ═══════════════════════════════════════════════════════════════════
// Copie du hero de la landing : les sources dont elle est l'instantané
// ═══════════════════════════════════════════════════════════════════
//
// `scripts/landing-hero/<locale>.html` est une CAPTURE du rendu React, pas un
// rendu au build (Vercel n'a pas de navigateur). Elle se périme donc en
// silence : un header ou un hero modifié sans nouvelle capture, et la relève
// copie → landing refait un saut sous les yeux du visiteur, exactement le
// défaut qu'elle supprime.
//
// `capture-landing-hero.mjs` enregistre l'empreinte de ces fichiers à côté de
// la capture ; `src/prerender-hero.guard.test.ts` la recalcule et échoue dès
// qu'un d'eux a bougé. La CSS, elle, n'est pas concernée : `prerender.mjs`
// l'extrait de la feuille BUILDÉE à chaque build.
//
// ⚠️ Fins de ligne normalisées avant hachage : un checkout Windows (CRLF) et la
// CI (LF) doivent rendre la même empreinte.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

/** Tout ce qui décide du balisage capturé : header, sélecteur, heros des deux parcours, textes. */
export const HERO_SOURCES = [
  'src/pages/LandingPage.tsx',
  'src/pages/landing/TrackSwitcher.tsx',
  'src/pages/landing/TrackAnchors.tsx',
  'src/pages/landing/anchors.ts',
  'src/pages/landing/PersoTrack.tsx',
  'src/pages/landing/HeroAppIcon.tsx',
  'src/pages/landing/HeroModuleDock.tsx',
  'src/pages/landing/HeroBackdrop.tsx',
  'src/pages/landing/hero-modules.ts',
  'src/locales/fr/landing.json',
  'src/locales/en/landing.json',
  // Parcours entreprise (copie peinte par `/entreprise-presentation/`).
  'src/pages/landing/entreprise/EnterpriseTrack.tsx',
  'src/pages/landing/entreprise/EnterpriseHero.tsx',
  'src/pages/landing/entreprise/HeroStack.tsx',
  'src/pages/landing/entreprise/free-offer.ts',
  'src/locales/fr/landingEnterprise.json',
  'src/locales/en/landingEnterprise.json',
];

export const SOURCES_MANIFEST = 'scripts/landing-hero/sources.json';

/** `{ chemin: sha256 }` des sources, fins de ligne normalisées. */
export function heroSourcesDigest(root) {
  const out = {};
  for (const path of HERO_SOURCES) {
    const text = readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
    out[path] = createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
  }
  return out;
}

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
// ⚠️ Les COMMENTAIRES des sources .ts/.tsx sont ôtés avant hachage : ils ne
// changent pas le balisage capturé, et réécrire un commentaire ne doit pas
// exiger une nouvelle capture (navigateur requis).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { commentairesDe } from './check-commentaires.mjs';

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

/** Le texte d'une source sans ses commentaires (JSON : tel quel). */
export function sansCommentaires(text, path) {
  if (!/\.tsx?$/.test(path)) return text;
  let out = '';
  let curseur = 0;
  for (const c of commentairesDe(text, path)) {
    out += text.slice(curseur, c.pos);
    curseur = c.pos + c.texte.length;
  }
  out += text.slice(curseur);
  return out.replace(/[ \t]+$/gm, '').replace(/\n{2,}/g, '\n');
}

/** `{ chemin: sha256 }` des sources, fins de ligne normalisées, commentaires ôtés. */
export function heroSourcesDigest(root) {
  const out = {};
  for (const path of HERO_SOURCES) {
    const text = sansCommentaires(readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n'), path);
    out[path] = createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
  }
  return out;
}

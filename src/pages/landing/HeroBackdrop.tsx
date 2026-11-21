import React from 'react';

/**
 * Le fond du premier ecran du parcours perso : grille masquee, bruit, aurores
 * cuites, traceurs d'encre.
 *
 * Extrait de `PersoTrack` quand le fichier a depasse son plafond de 600 lignes
 * (`architecture.guard`). La frontiere est une SURFACE, pas un
 * compte de lignes : ici il n'y a que du decor, aucune donnee, aucun geste, et
 * le reste du hero se lit sans avoir a le traverser.
 *
 * Les deux couches que GSAP translate (parallax scrube) restent pilotees par
 * `PersoTrack`, qui tient la timeline : elles arrivent par ref.
 */

interface Props {
  /** Couche lente : la grille. */
  gridRef: React.RefObject<HTMLDivElement | null>;
  /** Couche moyenne : halo et aurores. */
  auroraRef: React.RefObject<HTMLDivElement | null>;
}

const HeroBackdrop: React.FC<Props> = ({ gridRef, auroraRef }) => (
  <>
      {/* ── Fond ambiant : grille masquée + noise + aurores + encre ──
          `z-0`, JAMAIS `-z-10` : un descendant en z négatif se peint avant le fond
          des blocs non positionnés, et le `<div>` racine du parcours porte un fond
          sans créer de contexte d'empilement. Avec `-z-10`, grille, aurores, bruit
          et traceurs étaient rasterisés puis recouverts.
          ⚠️ Le contenu reste au-dessus sans rien changer : il est `relative` et vient
          APRÈS dans l'arbre, donc il se peint après à la même étape. */}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        {/* Grille retiree (refonte 2026-11-19) : calque vide garde pour le parallax GSAP. */}
        <div ref={gridRef} className="absolute inset-0" />

        {/* Fond blanc pur : aurores et bruit retires (refonte 2026-11-19). Le
            calque reste, vide, parce que le parallax GSAP le vise. */}
        <div ref={auroraRef} className="absolute inset-0" />
      </div>
  </>
);

export default HeroBackdrop;

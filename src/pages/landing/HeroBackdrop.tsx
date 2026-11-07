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
        {/* Grille fine type Linear/Vercel, fondue — couche parallax lente (GSAP) */}
        <div
          ref={gridRef}
          className="absolute inset-0 opacity-[0.55]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(15,23,42,0.055) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.055) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse 80% 70% at 60% 35%, #000 50%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 60% 35%, #000 50%, transparent 100%)',
          }}
        />

        {/* Couche parallax moyenne (GSAP) : halo + aurores. Les loops
            d'opacité/scale restent en Framer sur les enfants ; GSAP ne
            translate que ce wrapper (pas de conflit de transform). */}
        {/* ── Aurores CUITES : des dégradés déjà doux, zéro `filter: blur()` ──
            Ces couches étaient des aplats floutés animés en boucle : la page bloquait
            le fil principal 2 856 ms sur 4 000 au repos, 259 sans les `filter: blur`
            (audit A-8). Le coût était la rastérisation d'une pile de surfaces floutées
            refaite à chaque frame, cumulative, pas les bibliothèques d'animation.
            ❌ Ne pas « réoptimiser » en remettant un `filter: blur()` ici, ni espérer le
            rattraper par `will-change`, `translateZ(0)`, `contain: paint` ou un rayon
            plus petit : mesurés, aucun ne change rien.
            ✅ Un `radial-gradient` qui s'éteint vers `transparent` EST déjà flou, et se
            peint comme un dégradé ordinaire.
            Les quatre couches sont FIXES : l'oscillation d'opacité (0,82 à 1) sur des
            dégradés d'alpha 0,16 posés sur du BLANC était sous le seuil de perception.
            Ne pas la remettre : la vie du fond, c'est la trace d'encre.
            Harnais de non-régression : `scripts/landing-motion-probe.mjs`. */}
        <div ref={auroraRef} className="absolute inset-0">
          {/* Nappe de teintes (remplace le halo conique tournant).
              ⚠️ Chaque dégradé DOIT atteindre `transparent` avant le bord de
              sa boîte : sans le flou qui adoucissait les arêtes, un stop
              encore coloré à 100 % dessine un rectangle visible. C'est le
              défaut qu'a montré la première capture après correctif. */}
          <div
            className="absolute left-1/2 top-[-18%] h-[58rem] w-[58rem] -translate-x-1/2 rounded-full"
            style={{
              background:
                'radial-gradient(circle closest-side, rgba(99,102,241,0.04) 0%, rgba(99,102,241,0.035) 34%, rgba(139,92,246,0.028) 56%, rgba(217,70,239,0.018) 76%, rgba(34,211,238,0.01) 90%, transparent 100%)',
            }}
          />
          {/* Aurores : alphas divisés par deux, deux fois. Réglés pour un fond
              `slate-900`, ils lavaient la page blanche en pastel ; et le titre, seul
              élément du premier écran, porte un dégradé bleu → fuchsia qui se détache
              mal d'un fond teinté des mêmes couleurs.
              ⚠️ Ce sont des teintes, pas un décor. Si le fond commence à se voir,
              c'est qu'il est déjà trop fort. */}
          <div
            className="absolute -top-40 left-1/2 h-[60rem] w-[60rem] -translate-x-1/2 rounded-full"
            style={{
              background:
                'radial-gradient(circle closest-side, rgba(37,99,235,0.045) 0%, rgba(37,99,235,0.04) 34%, rgba(37,99,235,0.032) 54%, rgba(139,92,246,0.022) 72%, rgba(217,70,239,0.012) 88%, transparent 100%)',
            }}
          />
          <div
            className="absolute -top-4 -left-40 h-[38rem] w-[38rem] rounded-full"
            style={{ background: 'radial-gradient(circle closest-side, rgba(6,182,212,0.035) 0%, rgba(6,182,212,0.03) 40%, rgba(6,182,212,0.015) 70%, transparent 100%)' }}
          />
          <div
            className="absolute top-8 -right-36 h-[38rem] w-[38rem] rounded-full"
            style={{ background: 'radial-gradient(circle closest-side, rgba(217,70,239,0.032) 0%, rgba(217,70,239,0.028) 40%, rgba(217,70,239,0.015) 70%, transparent 100%)' }}
          />
        </div>
        {/* Texture noise (SVG feTurbulence, ultra-léger) */}
        <div
          className="absolute inset-0 opacity-[0.035] mix-blend-multiply"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        {/* Fondu vers la section suivante */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-white" />

        {/* Vie permanente du fond, en ENCRE : une trace sombre se dessine le
            long d'une ligne de la grille, la traverse, puis s'efface ; les
            noeuds posés sur les intersections respirent (GSAP, gaté
            reduced-motion).
            ⚠️ La trace est un DÉGRADÉ qui part de `transparent` : c'est lui
            qui fait l'entrée et la sortie. Aucun tween d'opacité, et surtout
            aucun `blur-[…]` (cf. l'audit A-8 ci-dessus).
            Ce bloc est le DERNIER de la couche de fond, et doit le rester : placé
            avant les aurores, le bruit ou le fondu blanc de bas de section (opaque
            à son bord), il passerait dessous et serait invisible. */}
        <div className="hero-trace-h absolute top-[28%] left-0 h-px w-52 bg-gradient-to-r from-transparent via-slate-900/20 to-blue-600/45" />
        <div className="hero-trace-v absolute left-[68%] top-0 w-px h-52 bg-gradient-to-b from-transparent via-slate-900/15 to-violet-600/40" />
        <div className="hero-node absolute top-[20%] left-[10%] h-1.5 w-1.5 rounded-full bg-slate-900/25 opacity-50" />
        <div className="hero-node absolute top-[64%] left-[80%] h-1 w-1 rounded-full bg-slate-900/25 opacity-50" />
        <div className="hero-node absolute top-[40%] left-[52%] h-1.5 w-1.5 rounded-full bg-blue-600/35 opacity-50" />
      </div>
  </>
);

export default HeroBackdrop;

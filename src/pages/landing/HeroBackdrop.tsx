import React from 'react';

/**
 * Le fond du premier ecran du parcours perso : grille masquee, bruit, aurores
 * cuites, traceurs d'encre.
 *
 * Extrait de `PersoTrack` le 2026-09-22, quand le fichier a depasse son plafond
 * de 600 lignes (`architecture.guard`). La frontiere est une SURFACE, pas un
 * compte de lignes : ici il n'y a que du decor, aucune donnee, aucun geste, et
 * le reste du hero se lit sans avoir a le traverser.
 *
 * Les deux couches que GSAP translate (parallax scrube) restent pilotees par
 * `PersoTrack`, qui tient la timeline : elles arrivent par ref.
 */

interface Props {
  /** Couche lente : la grille. */
  gridRef: React.RefObject<HTMLDivElement>;
  /** Couche moyenne : halo et aurores. */
  auroraRef: React.RefObject<HTMLDivElement>;
}

const HeroBackdrop: React.FC<Props> = ({ gridRef, auroraRef }) => (
  <>
      {/* ── Fond ambiant : grille masquée + noise + aurores + encre ──
          🔴 `z-0`, JAMAIS `-z-10`. Cette couche a porté `-z-10` depuis
          l'origine, et elle n'a jamais été VISIBLE : un descendant en z
          négatif se peint à l'étape 2 d'un contexte d'empilement, le fond
          des blocs non positionnés à l'étape 3. Le `<div>` racine de ce
          parcours porte un fond (`bg-white` aujourd'hui, un dégradé
          `slate-900` avant le 2026-09-22) et ne crée AUCUN contexte
          d'empilement, la `<section>` étant `relative` sans `z-index` : ce
          fond se peignait donc PAR-DESSUS la grille, les quatre aurores, le
          bruit et les traceurs. Mesuré le 2026-09-22 en forçant un traceur
          en rouge plein de 3 px, invisible — puis visible d'un coup en
          passant cette seule couche à `z-0`.
          ⚠️ Le contenu reste au-dessus sans rien changer : il est `relative`
          et vient APRÈS dans l'arbre, donc il se peint après à la même
          étape. C'est bien l'ordre du DOM qui tient l'empilement ici. */}
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
            Ces quatre couches étaient des aplats floutés à 90-110 px, animés
            en boucle. Mesuré le 2026-09-03 (audit A-8, build de prod, fenêtre
            de 4 s AU REPOS, sans scroll ni clic) : la page bloquait le fil
            principal 2 856 ms sur 4 000, et neutraliser les seuls
            `filter: blur` la ramenait à 259 ms. `/guide`, sur le même build,
            en bloque 0.
            🔴 Le coût n'était PAS les bibliothèques d'animation, contrairement
            à ce que le bootup Lighthouse laissait croire : couper les 23
            ScrollTrigger, les 8 tweens infinis ou la rotation de la fenêtre
            produit ne déplaçait pas la mesure d'un point. C'était la
            rastérisation d'une pile de surfaces floutées, refaite à chaque
            frame — et le coût est CUMULATIF, les couches se superposant.
            ❌ Ne pas « réoptimiser » en remettant un `filter: blur()` ici, ni
            espérer le rattraper par un `will-change`, un `translateZ(0)`, un
            `contain: paint` ou un rayon plus petit : les quatre ont été
            mesurés, aucun ne change quoi que ce soit.
            ✅ Un `radial-gradient` qui s'éteint vers `transparent` EST déjà
            flou : il produit le même halo diffus, mais il se peint comme un
            dégradé ordinaire.
            🔴 ET DEPUIS LE 2026-09-22, ces quatre couches sont FIXES. Elles
            oscillaient en opacité entre 0,82 et 1 — sur des dégradés dont
            l'alpha maximal vaut 0,16, posés sur du BLANC. L'amplitude réelle
            était sous le seuil de perception ; la boucle, elle, tournait en
            continu sur quatre surfaces de la taille du premier écran. Ne pas
            la remettre « pour donner de la vie au fond » : la vie du fond,
            sur cette page, c'est la trace d'encre, qui se voit.
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
                'radial-gradient(circle closest-side, rgba(99,102,241,0.08) 0%, rgba(99,102,241,0.07) 34%, rgba(139,92,246,0.055) 56%, rgba(217,70,239,0.035) 76%, rgba(34,211,238,0.02) 90%, transparent 100%)',
            }}
          />
          {/* Aurores — alphas DIVISÉS PAR DEUX le 2026-09-22, en même temps
              que la couche est redevenue visible (cf. `z-0` plus haut). Ils
              avaient été réglés pour glisser sur un fond `slate-900` ; posés
              sur du blanc, ils lavaient la page en pastel. Une page blanche
              doit rester blanche : ce sont des teintes, pas un décor. */}
          <div
            className="absolute -top-40 left-1/2 h-[60rem] w-[60rem] -translate-x-1/2 rounded-full"
            style={{
              background:
                'radial-gradient(circle closest-side, rgba(37,99,235,0.09) 0%, rgba(37,99,235,0.08) 34%, rgba(37,99,235,0.065) 54%, rgba(139,92,246,0.045) 72%, rgba(217,70,239,0.025) 88%, transparent 100%)',
            }}
          />
          <div
            className="absolute -top-4 -left-40 h-[38rem] w-[38rem] rounded-full"
            style={{ background: 'radial-gradient(circle closest-side, rgba(6,182,212,0.07) 0%, rgba(6,182,212,0.06) 40%, rgba(6,182,212,0.03) 70%, transparent 100%)' }}
          />
          <div
            className="absolute top-8 -right-36 h-[38rem] w-[38rem] rounded-full"
            style={{ background: 'radial-gradient(circle closest-side, rgba(217,70,239,0.065) 0%, rgba(217,70,239,0.055) 40%, rgba(217,70,239,0.03) 70%, transparent 100%)' }}
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
            aucun `blur-[…]` — les orbes qu'ils remplacent en portaient un
            chacun, cf. l'audit A-8 ci-dessus.
            🔴 CE BLOC EST LE DERNIER DE LA COUCHE DE FOND, et il doit le
            rester. Placé à l'endroit des anciens faisceaux — juste après la
            grille —, il passait SOUS les aurores, sous le bruit et surtout
            sous le fondu blanc de bas de section, qui est opaque à son bord.
            Mesuré en forçant la trace en rouge plein de 3 px : invisible. Un
            effet de fond ne se vérifie pas en relisant sa couleur, seulement
            en le regardant peint. */}
        <div className="hero-trace-h absolute top-[28%] left-0 h-px w-52 bg-gradient-to-r from-transparent via-slate-900/20 to-blue-600/45" />
        <div className="hero-trace-v absolute left-[68%] top-0 w-px h-52 bg-gradient-to-b from-transparent via-slate-900/15 to-violet-600/40" />
        <div className="hero-node absolute top-[20%] left-[10%] h-1.5 w-1.5 rounded-full bg-slate-900/25 opacity-50" />
        <div className="hero-node absolute top-[64%] left-[80%] h-1 w-1 rounded-full bg-slate-900/25 opacity-50" />
        <div className="hero-node absolute top-[40%] left-[52%] h-1.5 w-1.5 rounded-full bg-blue-600/35 opacity-50" />
      </div>
  </>
);

export default HeroBackdrop;

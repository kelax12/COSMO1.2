# ⚠️ ARCHIVE — motion design de la landing PERSO, version « lumière »

> ⚠️ **Instantané daté, NON MAINTENU.** Ce fichier conserve le code de mouvement
> du parcours perso **tel qu'il était le 2026-09-22**, avant que la direction
> artistique blanche ne le remplace par un vocabulaire d'encre. Il n'est chargé
> par rien : ni build, ni ESLint, ni `tsc`, ni les gardes. **Le code fait foi
> contre cette archive** — ne jamais le lire comme l'état courant.
> État courant : [`src/pages/landing/CLAUDE.md`](../../src/pages/landing/CLAUDE.md).

Commit de référence, où ce code est encore vivant et rejouable :
`98e3c73a` (`git show 98e3c73a:src/pages/landing/PersoTrack.tsx`).

## Pourquoi ce motion design a été remplacé

Il avait été écrit pour un fond **sombre**, et il faisait tout son travail par la
**lumière émise** : des faisceaux translucides qui balaient la grille, des orbes
floutés qui dérivent, un halo conique en rotation permanente, une lueur
d'arrimage sous la barre des modules. Le parcours perso est passé au **blanc** le
2026-09-22 (commit `5a0f44b7`). Sur blanc, de la lumière posée sur de la lumière
ne se voit plus : les effets restaient **payés** — compositions permanentes,
surfaces floutées rasterisées à chaque frame — pour un rendu sous le seuil de
perception.

Deux cas méritent d'être nommés, parce qu'ils ne se voient pas en lisant le diff :

- **Les quatre boucles d'opacité des aurores** oscillaient entre `0.82` et `1`
  sur des dégradés dont l'alpha maximal vaut `0.16`. Sur blanc, l'amplitude
  réelle est invisible ; la boucle, elle, tournait en continu.
- **Le halo conique de la CTA finale** tournait indéfiniment avec un
  `filter: blur(60px)`. C'est exactement le motif que l'audit A-8 (2026-09-03) a
  fait retirer du hero — où neutraliser les seuls `filter: blur` ramenait la page
  de 2 856 ms bloquées sur 4 000 à 259. Il avait survécu dans la CTA.

---

## 1. Hero — orbes et faisceaux (GSAP), `PersoTrack.tsx`

```tsx

        // Vie permanente du fond : orbes qui dérivent (yoyo aléatoire
        // re-tiré à chaque cycle) + traceurs lumineux qui balayent la
        // grille à une hauteur/position aléatoire à chaque passage.
        gsap.utils.toArray<HTMLElement>('.hero-orb').forEach((orb, i) => {
          heroLoops.push(
            gsap.to(orb, {
              x: () => gsap.utils.random(-70, 70),
              y: () => gsap.utils.random(-50, 50),
              duration: () => gsap.utils.random(4, 7),
              ease: 'sine.inOut',
              repeat: -1,
              yoyo: true,
              repeatRefresh: true,
              delay: i * 0.9,
            }),
          );
        });
        const beamH = heroRef.current?.querySelector<HTMLElement>('.hero-beam-h');
        if (beamH) {
          heroLoops.push(
            gsap.fromTo(
              beamH,
              { x: -220 },
              {
                x: () => (heroRef.current?.offsetWidth ?? window.innerWidth) + 220,
                duration: 5.5,
                ease: 'power1.inOut',
                repeat: -1,
                repeatDelay: 1.8,
                onRepeat: () => {
                  beamH.style.top = `${gsap.utils.random(15, 72)}%`;
                },
              },
            ),
          );
        }
        const beamV = heroRef.current?.querySelector<HTMLElement>('.hero-beam-v');
        if (beamV) {
          heroLoops.push(
            gsap.fromTo(
              beamV,
              { y: -220 },
              {
                y: () => (heroRef.current?.offsetHeight ?? window.innerHeight) + 220,
                duration: 6.5,
                ease: 'power1.inOut',
                repeat: -1,
                repeatDelay: 2.6,
                delay: 2.2,
                onRepeat: () => {
                  beamV.style.left = `${gsap.utils.random(20, 82)}%`;
                },
              },
            ),
          );
        }
```

## 2. Hero — le JSX des faisceaux et des orbes

```tsx
          {/* Vie permanente : traceurs lumineux qui balayent la grille +
              orbes qui dérivent en continu (GSAP, gaté reduced-motion) */}
          <div className="hero-beam-h absolute top-[28%] left-0 h-px w-52 bg-gradient-to-r from-transparent via-blue-500/70 to-transparent" />
          <div className="hero-beam-v absolute left-[68%] top-0 w-px h-52 bg-gradient-to-b from-transparent via-violet-500/60 to-transparent" />
          <div className="hero-orb absolute top-[20%] left-[10%] h-3 w-3 rounded-full bg-blue-500/70 blur-[2px]" />
          <div className="hero-orb absolute top-[64%] left-[80%] h-2 w-2 rounded-full bg-violet-500/70 blur-[1px]" />
          <div className="hero-orb absolute top-[40%] left-[52%] h-2.5 w-2.5 rounded-full bg-cyan-500/60 blur-[2px]" />
```

## 3. Hero — les quatre aurores et leurs boucles d opacité

```tsx
                ⚠️ Chaque dégradé DOIT atteindre `transparent` avant le bord de
                sa boîte : sans le flou qui adoucissait les arêtes, un stop
                encore coloré à 100 % dessine un rectangle visible. C'est le
                défaut qu'a montré la première capture après correctif. */}
            <motion.div
              className="absolute left-1/2 top-[-18%] h-[58rem] w-[58rem] -translate-x-1/2 rounded-full"
              style={{
                background:
                  'radial-gradient(circle closest-side, rgba(99,102,241,0.16) 0%, rgba(99,102,241,0.14) 34%, rgba(139,92,246,0.11) 56%, rgba(217,70,239,0.07) 76%, rgba(34,211,238,0.04) 90%, transparent 100%)',
              }}
              whileInView={reduceMotion ? undefined : { opacity: [0.82, 1, 0.82] }}
              transition={reduceMotion ? undefined : { duration: 14, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Aurores */}
            <motion.div
              className="absolute -top-40 left-1/2 h-[60rem] w-[60rem] -translate-x-1/2 rounded-full"
              style={{
                background:
                  'radial-gradient(circle closest-side, rgba(37,99,235,0.18) 0%, rgba(37,99,235,0.16) 34%, rgba(37,99,235,0.13) 54%, rgba(139,92,246,0.09) 72%, rgba(217,70,239,0.05) 88%, transparent 100%)',
              }}
              whileInView={reduceMotion ? undefined : { opacity: [0.78, 1, 0.78] }}
              transition={reduceMotion ? undefined : { duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute -top-4 -left-40 h-[38rem] w-[38rem] rounded-full"
              style={{ background: 'radial-gradient(circle closest-side, rgba(6,182,212,0.14) 0%, rgba(6,182,212,0.12) 40%, rgba(6,182,212,0.06) 70%, transparent 100%)' }}
              whileInView={reduceMotion ? undefined : { opacity: [0.45, 0.7, 0.45] }}
              transition={reduceMotion ? undefined : { duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            />
            <motion.div
              className="absolute top-8 -right-36 h-[38rem] w-[38rem] rounded-full"
              style={{ background: 'radial-gradient(circle closest-side, rgba(217,70,239,0.13) 0%, rgba(217,70,239,0.11) 40%, rgba(217,70,239,0.055) 70%, transparent 100%)' }}
              whileInView={reduceMotion ? undefined : { opacity: [0.45, 0.72, 0.45] }}
              transition={reduceMotion ? undefined : { duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
            />
          </div>
```

## 4. CTA finale — halo conique rotatif (GSAP + JSX)

```tsx

        // Halo conique qui tourne en continu derrière le contenu de la CTA.
        // En pause hors écran (blur 60px qui tourne = cher en GPU).
        const ctaHalo = rootRef.current?.querySelector('.cta-halo');
        if (ctaHalo) {
          const haloLoop = gsap.to(ctaHalo, { rotation: 360, ease: 'none', duration: 16, repeat: -1 });
          pauseWhenOffscreen(ctaHalo, [haloLoop]);
        }
      });
    },
```

```tsx
            {/* Halo conique rotatif (GSAP) — mouvement ambiant permanent */}
            <div
              className="cta-halo absolute -inset-[45%] opacity-40 pointer-events-none"
              style={{
                background:
                  'conic-gradient(from 0deg, rgba(59,130,246,0.22), transparent 30%, rgba(139,92,246,0.18) 50%, transparent 70%, rgba(59,130,246,0.22))',
                filter: 'blur(60px)',
              }}
              aria-hidden="true"
            />

            <div className="relative z-10">
```

## 5. Barre des modules — lueur d arrimage (`HeroModuleDock.tsx`)

```tsx
    >
      {/* Lueur d'arrimage — décorative, une seule impulsion, jamais une boucle. */}
      <div
        className="hero-dock-glow pointer-events-none absolute inset-x-6 -bottom-2 h-10 rounded-full bg-gradient-to-r from-blue-500/0 via-violet-500/40 to-fuchsia-500/0 blur-xl"
        style={{ ['--d' as string]: `${DELAI_ARRIMAGE_MS}ms` }}
        aria-hidden="true"
      />
      {MODULES.map(({ cle, Icone, from, teinte, delai }) => (
```

## 6. Keyframes de la lueur d arrimage (`src/index.css`)

```css
/* Une seule impulsion quand les quatre se sont posés, jamais une
   boucle : le hero ne doit rien coûter une fois l'entrée finie. */
.hero-dock-glow {
  animation: hero-dock-glow 1100ms ease-out both;
  animation-delay: var(--d, 0ms);
}

@keyframes hero-dock-glow {
  0%,
  55% {
    opacity: 0;
  }
  72% {
    opacity: 0.55;
  }
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-line-in,
  .hero-rise,
  .hero-chip,
  .hero-window,
  .hero-dock-glow {
    animation: none;
  }
  /* La lueur d'arrimage n'a plus de sens sans le mouvement qu'elle
     ponctue : on la retire au lieu de la figer allumée. */
  .hero-dock-glow {
    opacity: 0;
  }
}

```

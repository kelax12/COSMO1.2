// Les cinq tuiles du hero perso : a l'ouverture, elles partent du centre (la
// place de l'ancienne tuile tournante) et se posent l'une apres l'autre autour
// du titre, dans l'ordre Taches, Agenda, OKR, Habitudes, Statistiques.
//
// - Placement SYMETRIQUE par rapport a l'axe vertical : les ecarts horizontaux
//   sont exprimes en % de la largeur du hero, par paires opposees (+/-).
// - ARRIERE-PLAN : la couche est en `z-0` sous le contenu (`relative z-10`), donc
//   le titre, le sous-titre et les boutons passent par-dessus une tuile.
// - Entree en CSS (`.hero-scatter`, `src/index.css`) : un seul `from`, l'etat
//   final est l'etat par defaut, donc sous mouvement reduit les tuiles sont
//   simplement posees. Aucune boucle : rien a mettre en pause (C-69).
import React from 'react';
import { TUILES } from './hero-tuiles';


const DEPART = TUILES[2];
const PREMIER_MS = 250;
const ECART_MS = 220;

const HeroIconScatter: React.FC = () => (
  <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
    {TUILES.map(({ cle, Icone, degrade, x, y, r }, i) => {
      const d = PREMIER_MS + i * ECART_MS;
      return (
        <div
          key={cle}
          className="hero-scatter absolute origin-top-left"
          style={{
            left: `calc(50% + ${x}%)`,
            top: `${y}px`,
            ['--d' as string]: `${d}ms`,
            // Depart : la place de la tuile centrale, a plat.
            ['--tx' as string]: `${DEPART.x - x}vw`,
            ['--ty' as string]: `${DEPART.y - y}px`,
            ['--r0' as string]: `${-r}deg`,
          }}
        >
          {/* Inclinaison de repos + mouvement lent sur place, demarre apres
              l'arrivee. Separe de l'entree : deux transforms, deux elements. */}
          <div
            className="hero-tile-idle origin-top-left"
            style={{
              ['--r' as string]: `${r}deg`,
              ['--di' as string]: `${d + 1000}ms`,
              ['--dur' as string]: `${7 + i * 0.9}s`,
            }}
          >
            <div
              className={`flex h-16 w-16 sm:h-20 sm:w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[1.4rem] ${degrade} ring-1 ring-slate-900/10`}
            >
              <Icone className="h-8 w-8 sm:h-9 sm:w-9 text-white" strokeWidth={1.75} />
            </div>
          </div>
        </div>
      );
    })}
  </div>
);

export default HeroIconScatter;

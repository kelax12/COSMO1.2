// Les quatre modules de COSMO, autour d'une seule application.
//
// POURQUOI CE COMPOSANT EXISTE. Le titre promet « Toute votre productivité,
// réunie dans une seule app », et le visuel montrait… un tableau de tâches.
// Un visiteur qui ne lit pas le titre en conclut « encore une to-do list ».
// Ici l'image dit la même chose que la phrase : quatre outils habituellement
// séparés se rassemblent autour de la même application.
//
// DEUX DISPOSITIONS, UN SEUL JEU DE PUCES (2026-09-22, hero centré) :
//   · < xl  — rangée centrée sous le sommaire, comme avant, avec le filet
//             d'arrimage qui ponctue l'arrivée des quatre ;
//   · ≥ xl  — les quatre FLOTTENT de part et d'autre du titre, dans les marges
//             que la mise en page centrée laisse libres, chacune reliée au
//             centre par un filet d'encre.
// 🔴 Les deux dispositions sont le MÊME DOM, basculé par des classes `xl:`.
// Rendre deux jeux de puces et en masquer un coûterait soit un doublon annoncé
// aux lecteurs d'écran, soit un `aria-hidden` sur la seule liste libellée —
// c'est-à-dire la disparition de `hero.modulesLabel` sur grand écran.
//
// LE SENS SURVIT SANS LE MOUVEMENT. Sous `prefers-reduced-motion`, les quatre
// puces sont simplement déjà en place, libellées, lisibles. C'est le critère
// qui a fait retenir cette idée plutôt qu'un effet : elle raconte quelque
// chose même à l'arrêt.
//
// La mécanique d'animation est en CSS (`src/index.css`, section « Hero de la
// landing ») : elle joue au premier rendu, sans attendre GSAP ni les fontes.
// Ce composant ne fait que poser la chorégraphie — qui vient d'où, et quand.
import React from 'react';
import { useT } from '@/i18n/useT';
import { DELAI_ARRIMAGE_MS, MODULES_HERO } from './hero-modules';

export { DELAI_ARRIMAGE_MS };

interface Props {
  /** Module actuellement affiché par la tuile, pour allumer la bonne puce. */
  actif?: string;
}

export const HeroModuleDock: React.FC<Props> = ({ actif }) => {
  const { t } = useT('landing');

  return (
    <div
      className="relative mb-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-2.5 xl:pointer-events-none xl:absolute xl:inset-0 xl:m-0 xl:block"
      // Une liste de quatre libellés : pour un lecteur d'écran, c'est le
      // contenu qui compte, pas la mise en scène.
      aria-label={t('hero.modulesLabel')}
    >
      {/* Trait d'arrimage de la disposition en RANGÉE — décoratif, une seule
          impulsion, jamais une boucle. Il n'a plus d'objet en disposition
          flottante, où chaque puce porte son propre filet : `xl:hidden`. */}
      <div
        className="hero-dock-settle pointer-events-none absolute inset-x-10 -bottom-1 mx-auto h-px origin-center bg-gradient-to-r from-transparent via-slate-900/35 to-transparent xl:hidden"
        style={{ ['--d' as string]: `${DELAI_ARRIMAGE_MS}ms` }}
        aria-hidden="true"
      />
      {MODULES_HERO.map(({ cle, Icone, from, teinte, delai, cote, place }) => (
        <span
          key={cle}
          // L'état actif suit le module affiché par la tuile. C'est une
          // transition d'opacité et d'anneau, pas une animation : elle ne
          // coûte rien et reste lisible sans mouvement.
          className={`hero-chip relative inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs sm:px-3 font-semibold ring-1 backdrop-blur-md transition-[opacity,box-shadow] duration-500 xl:absolute xl:bg-white/85 xl:shadow-[0_10px_30px_-18px_rgba(15,23,42,0.55)] ${place} ${teinte} ${
            actif === cle ? 'opacity-100 ring-2' : 'opacity-80'
          }`}
          style={{
            ['--tx' as string]: from.tx,
            ['--ty' as string]: from.ty,
            ['--d' as string]: `${delai}ms`,
          }}
        >
          <Icone size={14} aria-hidden={true} />
          {t(`hero.modules.${cle}`)}
          {/* Le filet qui relie la puce au titre : c'est LUI qui dit
              « ces quatre-là se rejoignent », maintenant que les puces sont
              écartées. Il se dessine une fois, depuis la puce vers le centre,
              et ne coûte plus rien ensuite.
              ⚠️ Encre, jamais lumière : sur une page blanche, un halo
              n'émet plus rien de visible mais se rastérise quand même. */}
          <span
            aria-hidden="true"
            className={`hero-link pointer-events-none absolute top-1/2 hidden h-px w-24 xl:block ${
              cote === 'gauche'
                ? 'left-full ml-2 origin-left bg-gradient-to-r from-slate-900/30 to-transparent'
                : 'right-full mr-2 origin-right bg-gradient-to-l from-slate-900/30 to-transparent'
            }`}
            style={{ ['--d' as string]: `${delai + 260}ms` }}
          />
        </span>
      ))}
    </div>
  );
};

export default HeroModuleDock;

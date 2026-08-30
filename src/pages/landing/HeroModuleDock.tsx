// Les quatre modules de COSMO qui viennent s'arrimer à une seule fenêtre.
//
// POURQUOI CE COMPOSANT EXISTE. Le titre promet « Toute votre productivité,
// réunie dans une seule app », et le visuel montrait… un tableau de tâches.
// Un visiteur qui ne lit pas le titre en conclut « encore une to-do list ».
// Ici l'image dit la même chose que la phrase : quatre outils habituellement
// séparés arrivent de quatre directions et se posent sur la même fenêtre.
//
// LE SENS SURVIT SANS LE MOUVEMENT. Sous `prefers-reduced-motion`, les quatre
// puces sont simplement déjà arrimées, libellées, lisibles. C'est le critère
// qui a fait retenir cette idée plutôt qu'un effet : elle raconte quelque
// chose même à l'arrêt.
//
// La mécanique d'animation est en CSS (`src/index.css`, section « Hero de la
// landing ») : elle joue au premier rendu, sans attendre GSAP ni les fontes.
// Ce composant ne fait que poser la chorégraphie — qui vient d'où, et quand.
import React from 'react';
import { CalendarDays, ListChecks, Repeat, Target, type LucideIcon } from 'lucide-react';
import { useT } from '@/i18n/useT';

/** Un module : sa provenance à l'écran, son retard, sa couleur. */
interface Module {
  cle: 'tasks' | 'habits' | 'agenda' | 'okr';
  Icone: LucideIcon;
  /** D'où la puce arrive. Les quatre directions disent « éparpillés ». */
  from: { tx: string; ty: string };
  /** Teinte de la puce, sur le continuum bleu → fuchsia de la DA perso. */
  teinte: string;
  delai: number;
}

const MODULES: Module[] = [
  { cle: 'tasks', Icone: ListChecks, from: { tx: '-120px', ty: '-70px' }, teinte: 'text-blue-300 ring-blue-400/40 bg-blue-500/10', delai: 260 },
  { cle: 'habits', Icone: Repeat, from: { tx: '-40px', ty: '-110px' }, teinte: 'text-cyan-300 ring-cyan-400/40 bg-cyan-500/10', delai: 350 },
  { cle: 'agenda', Icone: CalendarDays, from: { tx: '40px', ty: '-110px' }, teinte: 'text-violet-300 ring-violet-400/40 bg-violet-500/10', delai: 440 },
  { cle: 'okr', Icone: Target, from: { tx: '120px', ty: '-70px' }, teinte: 'text-fuchsia-300 ring-fuchsia-400/40 bg-fuchsia-500/10', delai: 530 },
];

/** Retard après lequel les quatre se sont posées : la lueur ponctue l'arrivée. */
export const DELAI_ARRIMAGE_MS = 530;

interface Props {
  /** Vue actuellement affichée par la fenêtre, pour allumer la bonne puce. */
  actif?: string;
}

export const HeroModuleDock: React.FC<Props> = ({ actif }) => {
  const { t } = useT('landing');

  return (
    <div
      className="relative mb-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-2.5"
      // Une liste de quatre libellés : pour un lecteur d'écran, c'est le
      // contenu qui compte, pas la mise en scène.
      aria-label={t('hero.modulesLabel')}
    >
      {/* Lueur d'arrimage — décorative, une seule impulsion, jamais une boucle. */}
      <div
        className="hero-dock-glow pointer-events-none absolute inset-x-6 -bottom-2 h-10 rounded-full bg-gradient-to-r from-blue-500/0 via-violet-400/70 to-fuchsia-500/0 blur-xl"
        style={{ ['--d' as string]: `${DELAI_ARRIMAGE_MS}ms` }}
        aria-hidden="true"
      />
      {MODULES.map(({ cle, Icone, from, teinte, delai }) => (
        <span
          key={cle}
          // L'état actif suit la vue affichée par la fenêtre. C'est une
          // transition d'opacité et d'anneau, pas une animation : elle ne
          // coûte rien et reste lisible sans mouvement.
          className={`hero-chip inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs sm:px-3 font-semibold ring-1 backdrop-blur-md transition-[opacity,box-shadow] duration-500 ${teinte} ${
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
        </span>
      ))}
    </div>
  );
};

export default HeroModuleDock;

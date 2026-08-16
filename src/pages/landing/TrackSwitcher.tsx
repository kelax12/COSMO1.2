import React from 'react';
import { Building2, User } from 'lucide-react';
import { useT } from '@/i18n/useT';
import type { LandingTrack } from './use-landing-track';

interface TrackSwitcherProps {
  track: LandingTrack;
  onSelect: (track: LandingTrack) => void;
  className?: string;
}

const TRACKS: { id: LandingTrack; Icon: typeof User }[] = [
  { id: 'perso', Icon: User },
  { id: 'entreprise', Icon: Building2 },
];

/**
 * Sélecteur de parcours — la garantie de ne jamais enfermer le visiteur.
 *
 * Posé dans le header sticky, il reste visible sur toute la page : quel que
 * soit le track affiché, l'autre est à un clic. C'est la contrepartie de
 * l'exclusivité des deux parcours.
 *
 * L'indicateur glissant est positionné en `left`/`width` (CSS), pas en
 * transform : sous `prefers-reduced-motion`, Framer laisserait un transform à
 * sa valeur initiale et la pastille resterait bloquée sous le mauvais onglet.
 */
const TrackSwitcher: React.FC<TrackSwitcherProps> = ({ track, onSelect, className = '' }) => {
  const { t } = useT('landing');
  const activeIndex = TRACKS.findIndex(({ id }) => id === track);
  const isEnterprise = track === 'entreprise';

  return (
    <div
      role="tablist"
      aria-label={t('enterprise.switcher.label')}
      className={`relative flex items-center rounded-xl border border-white/10 bg-white/[0.04] p-0.5 backdrop-blur-md ${className}`}
    >
      {/* Pastille active : `left`/`width` en pourcentage, animées en CSS. */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0.5 rounded-[10px] transition-[left,background-color,box-shadow] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isEnterprise
            ? 'bg-cyan-400/15 shadow-[0_0_0_1px_rgba(34,211,238,0.35),0_0_18px_-4px_rgba(34,211,238,0.7)]'
            : 'bg-blue-500/20 shadow-[0_0_0_1px_rgba(96,165,250,0.35),0_0_18px_-4px_rgba(96,165,250,0.7)]'
        }`}
        style={{ left: `calc(${activeIndex * 50}% + 2px)`, width: 'calc(50% - 4px)' }}
      />

      {TRACKS.map(({ id, Icon }) => {
        const active = id === track;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(id)}
            className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-2.5 py-1.5 text-xs font-semibold transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:px-3.5 ${
              active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon size={13} aria-hidden="true" />
            {t(id === 'perso' ? 'enterprise.switcher.perso' : 'enterprise.switcher.entreprise')}
          </button>
        );
      })}
    </div>
  );
};

export default TrackSwitcher;

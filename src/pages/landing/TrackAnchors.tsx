import React from 'react';
import { useT } from '@/i18n/useT';
import { TRACK_ANCHORS } from './anchors';
import type { LandingTrack } from './use-landing-track';

interface TrackAnchorsProps {
  track: LandingTrack;
  /** Étiquette du repère de navigation, propre au parcours. */
  label: string;
}

/**
 * Sommaire du parcours, collé sous le header.
 *
 * Il remplace la nav d'ancres qui vivait dans le header avant la scission en
 * deux parcours — la place y est prise par le sélecteur. Chaque track affiche
 * ses propres sections, donc un lien ne peut plus viser une ancre absente.
 *
 * Masqué sous `lg` : sur mobile, les mêmes liens sont dans le menu burger.
 */
const TrackAnchors: React.FC<TrackAnchorsProps> = ({ track, label }) => {
  const { t } = useT('landing');
  const isEnterprise = track === 'entreprise';

  return (
    <nav aria-label={label} className="sticky top-[4.5rem] z-30 hidden justify-center px-4 lg:flex">
      <ul
        className={`flex items-center gap-1 rounded-full border px-2 py-1.5 backdrop-blur-xl ${
          isEnterprise
          ? 'border-white/[0.08] bg-[#0A0C11]/85'
          : 'border-slate-900/[0.08] bg-white/80 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.45)]'
        }`}
      >
        {TRACK_ANCHORS[track].map(({ href, labelKey }) => (
          <li key={href}>
            <a
              href={href}
              className={`block rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                isEnterprise
                  ? 'text-slate-400 hover:bg-white/[0.06] hover:text-white focus-visible:ring-cyan-300'
                  : 'text-slate-600 hover:bg-slate-900/[0.05] hover:text-slate-900 focus-visible:ring-blue-500'
              }`}
            >
              {t(labelKey)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default TrackAnchors;

import React, { useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { TRACK_ANCHORS } from './anchors';
import type { LandingTrack } from './use-landing-track';

interface TrackAnchorsProps {
  track: LandingTrack;
  /** Étiquette du repère de navigation, propre au parcours. */
  label: string;
  /** Section en cours de lecture (sans `#`), cf. `useActiveAnchor`. */
  active: string | null;
  /**
   * `inline` : dans la rangée du header. `bar` : capsule collée SOUS le header,
   * pour le parcours entreprise, dont les sept ancres ne tiennent jamais dans
   * l'îlot (`max-w-6xl`) à côté du sélecteur et des actions.
   */
  variant: 'inline' | 'bar';
  className?: string;
}

/**
 * Sommaire du parcours.
 *
 * Il vivait dans une capsule collée sous le header, à `top-[4.5rem]` en dur :
 * au scroll elle passait 9,6 px SOUS l'îlot (à 1440 px),
 * et le texte des sections défilait entre les deux. Il est maintenant DANS le
 * header pour le parcours perso. En entreprise, la capsule reste, mais se
 * cale sur `--landing-header-h`, mesurée par `ResizeObserver` dans
 * `LandingPage` : le chevauchement est impossible par construction.
 *
 * La pastille du lien actif est placée en `left`/`width` CSS, jamais en
 * transform : même raison que `TrackSwitcher` (sous `prefers-reduced-motion`,
 * un transform piloté par Framer resterait figé à sa valeur initiale).
 *
 * Masqué sous `lg` : sur mobile, les mêmes liens sont dans le menu burger.
 */
const TrackAnchors: React.FC<TrackAnchorsProps> = ({ track, label, active, variant, className = '' }) => {
  const { t } = useT('landing');
  const isEnterprise = track === 'entreprise';
  const listRef = useRef<HTMLUListElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  // Mesure après rendu : la largeur d'un lien dépend de la fonte et de la
  // langue, elle ne se calcule pas. ⚠️ `offsetLeft` se lit depuis le `<ul>`
  // (seul ancêtre positionné) : un `<li>` en `relative` le ramène à 0 et
  // colle la pastille sur le premier lien, quel que soit le lien actif.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const place = () => {
      // Un lien de sous-menu actif allume son parent (`data-group`).
      const link = active
        ? list.querySelector<HTMLElement>(`:scope > li > a[href="#${active}"], :scope > li[data-group~="${active}"] > a`)
        : null;
      // Mesure en rects : le `<li>` d'un sous-menu est `relative`, `offsetLeft`
      // s'y ramènerait à 0.
      const base = list.getBoundingClientRect().left;
      setPill(link ? { left: link.getBoundingClientRect().left - base, width: link.offsetWidth } : null);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(list);
    return () => ro.disconnect();
  }, [active, track]);

  const bar = variant === 'bar';

  return (
    <nav
      aria-label={label}
      className={
        bar
          ? `sticky top-[calc(var(--landing-header-h,5rem)+0.5rem)] z-40 justify-center px-4 ${className}`
          : className
      }
    >
      <ul
        ref={listRef}
        className={`relative flex items-center gap-0.5 ${
          bar
            ? `rounded-full border px-2 py-1.5 backdrop-blur-xl ${
                isEnterprise
                  ? 'border-white/[0.08] bg-[#0A0C11]/85'
                  : 'border-slate-900/[0.08] bg-white/80'
              }`
            : ''
        }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute rounded-full transition-[left,width,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
            isEnterprise ? 'bg-white/[0.08]' : 'bg-slate-900/[0.06]'
          } ${bar ? 'inset-y-1.5' : 'inset-y-0'}`}
          style={{ left: pill?.left ?? 0, width: pill?.width ?? 0, opacity: pill ? 1 : 0 }}
        />
        {TRACK_ANCHORS[track].map(({ href, labelKey, children }) => {
          const ids = children?.map((c) => c.href.slice(1)) ?? [];
          const current = href === `#${active}` || (active !== null && ids.includes(active));
          const linkCls = `flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 ${
            isEnterprise
              ? `focus-visible:ring-[#58A6FF] ${current ? 'text-white' : 'text-slate-400 hover:text-white'}`
              : `focus-visible:ring-blue-500 ${current ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'}`
          }`;
          if (!children) {
            return (
              <li key={href}>
                <a href={href} aria-current={current ? 'location' : undefined} className={linkCls}>
                  {t(labelKey)}
                </a>
              </li>
            );
          }
          // Sous-menu : ouvert au survol ET au focus clavier (`focus-within`).
          // Le lien parent reste cliquable et mène à la première section.
          return (
            <li key={href} data-group={ids.join(' ')} className="group/menu relative">
              <a href={href} aria-haspopup="true" className={linkCls}>
                {t(labelKey)}
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  className="transition-transform duration-200 group-hover/menu:rotate-180 group-focus-within/menu:rotate-180"
                />
              </a>
              <div className="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2 opacity-0 transition-opacity duration-150 group-hover/menu:visible group-hover/menu:opacity-100 group-focus-within/menu:visible group-focus-within/menu:opacity-100">
                <ul
                  className={`min-w-[12rem] rounded-xl border p-1.5 shadow-xl backdrop-blur-xl ${
                    isEnterprise ? 'border-white/[0.08] bg-[#222428]/95' : 'border-slate-900/[0.08] bg-white/95'
                  }`}
                >
                  {children.map((c) => {
                    const on = c.href === `#${active}`;
                    return (
                      <li key={c.href}>
                        <a
                          href={c.href}
                          aria-current={on ? 'location' : undefined}
                          className={`block rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                            isEnterprise
                              ? `focus-visible:ring-[#58A6FF] ${on ? 'bg-white/[0.08] text-white' : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'}`
                              : `focus-visible:ring-blue-500 ${on ? 'bg-slate-900/[0.06] text-slate-900' : 'text-slate-600 hover:bg-slate-900/[0.04] hover:text-slate-900'}`
                          }`}
                        >
                          {t(c.labelKey)}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default TrackAnchors;

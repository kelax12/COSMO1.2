import React, { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Building2, User } from 'lucide-react';
import { gsap, useGSAP } from '@/lib/gsap';
import DotGrid from '@/components/reactbits/DotGrid';
import { useT } from '@/i18n/useT';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import type { LandingTrack } from './use-landing-track';

interface LandingGatewayProps {
  track: LandingTrack;
  onSelect: (track: LandingTrack) => void;
}

/**
 * L'aiguillage — le visiteur choisit son parcours juste après le header.
 *
 * Deux panneaux plein écran, chacun avec sa direction artistique : à gauche le
 * cosmique bleu/violet du mode perso, à droite le graphite + cyan du mode
 * entreprise. Le survol gonfle un côté (60/40) et le clic engage le track.
 *
 * ⚠️ Le partage 60/40 passe par `flex-grow`, JAMAIS par un transform : en
 * `prefers-reduced-motion`, Framer laisse la valeur `initial` appliquée et une
 * position finale portée par un transform reste figée à l'entrée (bug historique
 * `CookieBanner`, cf. CLAUDE.md). Ici la mise en page vient du CSS seul ; la
 * transition n'est qu'un confort, son absence ne casse rien.
 */
const LandingGateway: React.FC<LandingGatewayProps> = ({ track, onSelect }) => {
  const { t } = useT('landing');
  const reduceMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const [hovered, setHovered] = useState<LandingTrack | null>(null);
  const rootRef = useRef<HTMLElement>(null);

  // Entrée : les deux panneaux s'ouvrent depuis la ligne centrale (clip-path,
  // donc aucune position finale ne dépend d'un transform) puis le contenu monte.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.gate-panel', {
          clipPath: (i: number) =>
            i === 0 ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)',
          duration: 1.1,
          ease: 'expo.out',
          stagger: 0.08,
        });
        gsap.from('.gate-content > *', {
          y: 24,
          opacity: 0,
          duration: 0.7,
          ease: 'power3.out',
          stagger: 0.06,
          delay: 0.35,
        });
        gsap.from('.gate-seam', {
          scaleY: 0,
          duration: 1,
          ease: 'expo.out',
          delay: 0.2,
          transformOrigin: 'center',
        });
      });
    },
    { scope: rootRef },
  );

  // Un panneau non survolé s'efface au profit de l'autre ; au repos, 50/50.
  const flexFor = (panel: LandingTrack) => {
    if (isMobile || hovered === null) return 1;
    return hovered === panel ? 1.28 : 0.72;
  };

  return (
    <section
      ref={rootRef}
      id="aiguillage"
      aria-labelledby="gateway-title"
      className="relative isolate min-h-[100svh] w-full overflow-hidden bg-[#08090C]"
    >
      {/* Titre de section : lisible par les lecteurs d'écran et les crawlers,
          discret à l'œil pour ne pas voler la vedette aux deux portes. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-col items-center gap-1 px-4 pt-6 text-center sm:pt-8">
        <span className="text-caption font-mono uppercase tracking-[0.32em] text-slate-500">
          {t('enterprise.gateway.eyebrow')}
        </span>
        <h2
          id="gateway-title"
          className="max-w-2xl text-balance text-sm font-medium text-slate-300 sm:text-base"
        >
          {t('enterprise.gateway.title')}
        </h2>
      </div>

      <nav
        aria-label={t('enterprise.switcher.label')}
        className="flex min-h-[100svh] flex-col md:flex-row"
      >
        {/* ── Porte 1 : mode perso (DA cosmique, inchangée) ── */}
        <GatePanel
          side="left"
          selected={track === 'perso'}
          flex={flexFor('perso')}
          onHover={() => setHovered('perso')}
          onLeave={() => setHovered(null)}
          onClick={() => onSelect('perso')}
          ariaLabel={t('enterprise.gateway.perso.aria')}
          icon={<User size={16} aria-hidden="true" />}
          kicker={t('enterprise.gateway.perso.kicker')}
          title={t('enterprise.gateway.perso.title')}
          desc={t('enterprise.gateway.perso.desc')}
          features={[
            t('enterprise.gateway.perso.f1'),
            t('enterprise.gateway.perso.f2'),
            t('enterprise.gateway.perso.f3'),
          ]}
          enterLabel={t('enterprise.gateway.enter')}
          accentClass="text-blue-300"
          ringClass="focus-visible:ring-blue-400"
          ctaClass="bg-white/[0.06] border-white/15 text-white group-hover/panel:bg-blue-500/20 group-hover/panel:border-blue-300/40"
          background={
            <div className="absolute inset-0" aria-hidden="true">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
              <motion.div
                className="absolute left-1/2 top-1/3 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-blue-600/30 via-violet-600/20 to-fuchsia-600/20 blur-[110px]"
                animate={reduceMotion ? undefined : { opacity: [0.5, 0.85, 0.5], scale: [1, 1.08, 1] }}
                transition={reduceMotion ? undefined : { duration: 9, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div
                className="absolute inset-0 opacity-[0.14]"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, rgba(148,163,184,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.25) 1px, transparent 1px)',
                  backgroundSize: '48px 48px',
                  maskImage: 'radial-gradient(ellipse 70% 60% at 50% 45%, #000 40%, transparent 100%)',
                  WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 45%, #000 40%, transparent 100%)',
                }}
              />
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="absolute h-1.5 w-1.5 rounded-full bg-blue-300/70 blur-[1px]"
                  style={{ left: `${18 + i * 27}%`, top: `${28 + i * 19}%` }}
                  animate={reduceMotion ? undefined : { y: [0, -16, 0], opacity: [0.3, 0.9, 0.3] }}
                  transition={
                    reduceMotion
                      ? undefined
                      : { duration: 5 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.8 }
                  }
                />
              ))}
            </div>
          }
        />

        {/* Couture centrale : la ligne qui sépare les deux mondes. */}
        <div
          className="gate-seam relative z-20 hidden w-px shrink-0 self-stretch md:block"
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/25 to-transparent" />
          <div
            className={`absolute left-1/2 top-1/2 h-40 w-px -translate-x-1/2 -translate-y-1/2 transition-colors duration-500 ${
              hovered === 'entreprise' ? 'bg-cyan-300/80' : 'bg-blue-300/70'
            } blur-[2px]`}
          />
        </div>

        {/* ── Porte 2 : mode entreprise (DA graphite + cyan) ── */}
        <GatePanel
          side="right"
          selected={track === 'entreprise'}
          flex={flexFor('entreprise')}
          onHover={() => setHovered('entreprise')}
          onLeave={() => setHovered(null)}
          onClick={() => onSelect('entreprise')}
          ariaLabel={t('enterprise.gateway.entreprise.aria')}
          icon={<Building2 size={16} aria-hidden="true" />}
          kicker={t('enterprise.gateway.entreprise.kicker')}
          title={t('enterprise.gateway.entreprise.title')}
          desc={t('enterprise.gateway.entreprise.desc')}
          features={[
            t('enterprise.gateway.entreprise.f1'),
            t('enterprise.gateway.entreprise.f2'),
            t('enterprise.gateway.entreprise.f3'),
          ]}
          enterLabel={t('enterprise.gateway.enter')}
          accentClass="text-cyan-300"
          ringClass="focus-visible:ring-cyan-300"
          ctaClass="bg-cyan-400/10 border-cyan-300/30 text-cyan-100 group-hover/panel:bg-cyan-400/20 group-hover/panel:border-cyan-300/60"
          background={
            <div className="absolute inset-0 bg-[#08090C]" aria-hidden="true">
              {/* Grille de points réactive au curseur — le fond « instrument »
                  qui signe la DA entreprise. Canvas 2D, aucune dépendance. */}
              {!isMobile && !reduceMotion && (
                <DotGrid
                  dotSize={2}
                  gap={26}
                  baseColor="#1B2430"
                  activeColor="#22D3EE"
                  proximity={130}
                  shockRadius={210}
                  shockStrength={4}
                  className="absolute inset-0"
                />
              )}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_40%,rgba(34,211,238,0.12),transparent_70%)]" />
              <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#08090C] to-transparent" />
            </div>
          }
        />
      </nav>

      {/* Rassurance : on dit tout de suite que le choix est réversible. */}
      <p className="pointer-events-none absolute inset-x-0 bottom-4 z-30 px-4 text-center text-caption text-slate-500 sm:bottom-6">
        {t('enterprise.gateway.hint')}
      </p>
    </section>
  );
};

interface GatePanelProps {
  side: 'left' | 'right';
  selected: boolean;
  flex: number;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
  ariaLabel: string;
  icon: React.ReactNode;
  kicker: string;
  title: string;
  desc: string;
  features: string[];
  enterLabel: string;
  accentClass: string;
  ringClass: string;
  ctaClass: string;
  background: React.ReactNode;
}

/** Une porte : bouton plein écran, son fond, sa promesse, son appel à l'action. */
const GatePanel: React.FC<GatePanelProps> = ({
  side,
  selected,
  flex,
  onHover,
  onLeave,
  onClick,
  ariaLabel,
  icon,
  kicker,
  title,
  desc,
  features,
  enterLabel,
  accentClass,
  ringClass,
  ctaClass,
  background,
}) => (
  <button
    type="button"
    onClick={onClick}
    onMouseEnter={onHover}
    onMouseLeave={onLeave}
    onFocus={onHover}
    onBlur={onLeave}
    aria-label={ariaLabel}
    aria-current={selected ? 'true' : undefined}
    style={{ flexGrow: flex }}
    className={`gate-panel group/panel relative flex min-h-[52svh] flex-1 basis-0 cursor-pointer flex-col justify-end overflow-hidden text-left transition-[flex-grow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset md:min-h-[100svh] ${ringClass}`}
  >
    {background}

    {/* Voile qui s'éclaircit au survol — opacité seule, sûr en reduced-motion. */}
    <div
      className="absolute inset-0 bg-black/30 opacity-100 transition-opacity duration-500 group-hover/panel:opacity-0"
      aria-hidden="true"
    />

    <div
      // `pb-*` généreux : la ligne « vous pourrez basculer à tout moment » est
      // posée en absolu au bas de la section, le contenu doit passer au-dessus.
      className={`gate-content relative z-10 flex flex-col gap-5 px-7 pb-20 pt-7 sm:px-10 sm:pb-24 sm:pt-10 lg:px-14 ${
        side === 'right' ? 'md:items-start' : ''
      }`}
    >
      <span
        className={`inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-caption uppercase tracking-[0.22em] backdrop-blur-sm ${accentClass}`}
      >
        {icon}
        {kicker}
      </span>

      <h3 className="max-w-md text-3xl font-bold leading-[1.05] tracking-tight text-white sm:text-4xl lg:text-5xl">
        {title}
      </h3>

      <p className="max-w-sm text-sm leading-relaxed text-slate-400 sm:text-base">{desc}</p>

      <ul className="flex flex-col gap-1.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2.5 text-xs text-slate-500 sm:text-sm">
            <span className={`h-1 w-1 shrink-0 rounded-full ${accentClass} bg-current`} aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>

      <span
        className={`mt-1 inline-flex w-fit items-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold backdrop-blur-md transition-colors duration-300 ${ctaClass}`}
      >
        {enterLabel}
        <ArrowRight
          size={16}
          className="transition-transform duration-300 group-hover/panel:translate-x-1"
          aria-hidden="true"
        />
      </span>
    </div>
  </button>
);

export default LandingGateway;

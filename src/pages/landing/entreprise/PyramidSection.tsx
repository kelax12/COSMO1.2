import React, { useMemo, useRef, useState } from 'react';
import { Layers, Network, ShieldCheck } from 'lucide-react';
import { gsap, useGSAP } from '@/lib/gsap';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';
import { PYRAMID_NODES, subtreeOf, type PyramidNode } from './data';

const VIEW_W = 900;
const VIEW_H = 420;
const NODE_R = 27;

/** Les trois conséquences concrètes du périmètre déduit de la hiérarchie. */
const PYRAMID_BENEFITS: { Icon: typeof Network; titleKey: KeyOf<'landing'>; bodyKey: KeyOf<'landing'> }[] = [
  { Icon: Network, titleKey: 'enterprise.pyramid.b1t', bodyKey: 'enterprise.pyramid.b1d' },
  { Icon: Layers, titleKey: 'enterprise.pyramid.b2t', bodyKey: 'enterprise.pyramid.b2d' },
  { Icon: ShieldCheck, titleKey: 'enterprise.pyramid.b3t', bodyKey: 'enterprise.pyramid.b3d' },
];

/** Lien parent → enfant : une cubique verticale, plus douce qu'un coude. */
function linkPath(parent: PyramidNode, child: PyramidNode): string {
  const midY = (parent.y + child.y) / 2;
  return `M ${parent.x} ${parent.y + NODE_R} C ${parent.x} ${midY}, ${child.x} ${midY}, ${child.x} ${child.y - NODE_R}`;
}

/**
 * Section « organigramme » — la démonstration du seul argument qui n'existe
 * nulle part ailleurs : le périmètre de chacun est DÉDUIT de la hiérarchie.
 *
 * L'arbre se construit au scroll (les liens se tracent, puis les nœuds
 * apparaissent niveau par niveau), et survoler un manager éteint tout ce qui
 * n'appartient pas à son sous-arbre. C'est exactement la règle appliquée en
 * base de données ; la montrer vaut mieux que l'écrire.
 */
const PyramidSection: React.FC = () => {
  const { t } = useT('landing');
  const rootRef = useRef<HTMLElement>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const links = useMemo(
    () =>
      PYRAMID_NODES.filter((node) => node.parent).map((child) => {
        const parent = PYRAMID_NODES.find((n) => n.id === child.parent)!;
        return { id: `${parent.id}-${child.id}`, parentId: parent.id, childId: child.id, d: linkPath(parent, child) };
      }),
    [],
  );

  // Périmètre éclairé : le sous-arbre du nœud pointé. `null` = tout est actif.
  const scope = useMemo(() => (focusedId ? subtreeOf(focusedId) : null), [focusedId]);
  const inScope = (id: string) => scope === null || scope.has(id);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const tl = gsap.timeline({
          scrollTrigger: { trigger: '.pyramid-stage', start: 'top 78%', once: true },
        });

        // 1. Les liens se tracent depuis la racine.
        tl.from('.pyramid-link', {
          strokeDashoffset: (_i: number, target: SVGPathElement) => target.getTotalLength(),
          duration: 1,
          ease: 'power2.inOut',
          stagger: 0.06,
        });

        // 2. Les nœuds éclosent niveau par niveau.
        tl.from(
          '.pyramid-node',
          {
            opacity: 0,
            scale: 0.4,
            transformOrigin: 'center',
            duration: 0.6,
            ease: 'back.out(2)',
            stagger: 0.05,
          },
          '-=0.75',
        );

        // 3. Une impulsion descend le long des liens, en boucle discrète.
        gsap.to('.pyramid-pulse', {
          strokeDashoffset: -220,
          duration: 2.6,
          ease: 'none',
          repeat: -1,
          stagger: { each: 0.25, repeat: -1 },
          scrollTrigger: { trigger: '.pyramid-stage', start: 'top bottom', end: 'bottom top', toggleActions: 'play pause resume pause' },
        });
      });
    },
    { scope: rootRef },
  );

  return (
    <section
      ref={rootRef}
      id="organigramme"
      className="relative scroll-mt-40 border-t border-white/[0.06] py-24 lg:py-32"
      aria-labelledby="pyramid-title"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-14 max-w-3xl">
          <span className="mb-4 block font-mono text-caption uppercase tracking-[0.3em] text-cyan-400/80">
            {t('enterprise.pyramid.eyebrow')}
          </span>
          <h2
            id="pyramid-title"
            className="mb-5 text-balance text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-4xl lg:text-5xl"
          >
            {t('enterprise.pyramid.title')}
          </h2>
          <p className="text-base leading-relaxed text-slate-400 lg:text-lg">
            {t('enterprise.pyramid.subtitle')}
          </p>
        </header>

        {/* ── La scène : l'organigramme interactif ── */}
        <div className="pyramid-stage relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0C11] p-4 sm:p-8">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            aria-hidden="true"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(148,163,184,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.07) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />

          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="relative w-full"
            role="img"
            aria-label={t('enterprise.pyramid.subtitle')}
          >
            {/* Liens */}
            {links.map(({ id, childId, d }) => {
              const lit = inScope(childId);
              return (
                <g key={id}>
                  <path
                    d={d}
                    className="pyramid-link"
                    fill="none"
                    stroke={lit ? 'rgba(34,211,238,0.45)' : 'rgba(148,163,184,0.12)'}
                    strokeWidth={1.5}
                    style={{ transition: 'stroke 350ms ease' }}
                  />
                  {/* Impulsion qui circule : montre que la structure est vivante. */}
                  <path
                    d={d}
                    className="pyramid-pulse"
                    fill="none"
                    stroke={lit ? 'rgba(34,211,238,0.95)' : 'transparent'}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeDasharray="14 206"
                    style={{ transition: 'stroke 350ms ease' }}
                  />
                </g>
              );
            })}

            {/* Nœuds */}
            {PYRAMID_NODES.map((node) => {
              const lit = inScope(node.id);
              const isPointed = focusedId === node.id;
              const roleKey =
                node.level === 0
                  ? 'enterprise.pyramid.roleCeo'
                  : node.level === 1
                    ? 'enterprise.pyramid.roleLead'
                    : 'enterprise.pyramid.roleMember';
              return (
                <g
                  key={node.id}
                  className="pyramid-node cursor-pointer focus:outline-none"
                  tabIndex={0}
                  role="button"
                  aria-label={`${node.name} — ${t(roleKey)}`}
                  onMouseEnter={() => setFocusedId(node.id)}
                  onMouseLeave={() => setFocusedId(null)}
                  onFocus={() => setFocusedId(node.id)}
                  onBlur={() => setFocusedId(null)}
                  style={{ opacity: lit ? 1 : 0.22, transition: 'opacity 350ms ease' }}
                >
                  {/* Halo du nœud pointé */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={NODE_R + 12}
                    fill="rgba(34,211,238,0.12)"
                    style={{ opacity: isPointed ? 1 : 0, transition: 'opacity 300ms ease' }}
                  />
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={NODE_R}
                    fill={node.level === 0 ? 'rgba(34,211,238,0.16)' : '#12161D'}
                    stroke={isPointed ? '#22D3EE' : lit ? 'rgba(34,211,238,0.35)' : 'rgba(148,163,184,0.2)'}
                    strokeWidth={isPointed ? 2 : 1.25}
                    style={{ transition: 'stroke 300ms ease, stroke-width 300ms ease' }}
                  />
                  <text
                    x={node.x}
                    y={node.y + 5}
                    textAnchor="middle"
                    className="select-none fill-white font-sans text-body font-semibold"
                  >
                    {node.name.charAt(0)}
                  </text>
                  <text
                    x={node.x}
                    y={node.y + NODE_R + 20}
                    textAnchor="middle"
                    className="select-none fill-slate-400 font-sans text-label"
                  >
                    {node.name}
                  </text>
                  <text
                    x={node.x}
                    y={node.y + NODE_R + 35}
                    textAnchor="middle"
                    className="select-none fill-slate-600 font-mono text-caption uppercase tracking-[0.14em]"
                  >
                    {t(roleKey)}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Légende + invite au survol */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
            <p className="font-mono text-caption uppercase tracking-[0.2em] text-slate-500">
              {t('enterprise.pyramid.hint')}
            </p>
            <div className="flex items-center gap-5 text-caption text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-cyan-400" aria-hidden="true" />
                {t('enterprise.pyramid.legendScope')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-700" aria-hidden="true" />
                {t('enterprise.pyramid.legendOut')}
              </span>
            </div>
          </div>
        </div>

        {/* ── Les trois conséquences concrètes ── */}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PYRAMID_BENEFITS.map(({ Icon, titleKey, bodyKey }) => (
            <div
              key={titleKey}
              className="group rounded-xl border border-white/[0.08] bg-[#0A0C11] p-6 transition-colors duration-300 hover:border-cyan-300/25"
            >
              <Icon size={18} className="mb-4 text-cyan-400" aria-hidden="true" />
              <h3 className="mb-2 text-sm font-semibold text-white">{t(titleKey)}</h3>
              <p className="text-sm leading-relaxed text-slate-500">{t(bodyKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PyramidSection;

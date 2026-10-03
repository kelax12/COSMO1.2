import { motion, useReducedMotion } from 'framer-motion';
import {
  ORBITS,
  ORRERY_CENTER,
  ORRERY_VIEWBOX,
  PLANETS,
  PLANET_COLOR,
  orbitPath,
  outerTicks,
  planetPosition,
  planetStates,
  type Planet,
} from './orrery-geometry';

const INK = '#0F172A';
const HAIRLINE = '#CBD5E1';
const MUTED = '#64748B';
const TICKS = outerTicks();

interface OrreryProps {
  /** 0 = présentation, 1-4 = une étape par planète, 5 = système complet. */
  step: number;
  labels: Record<Planet | 'you', string>;
  /** Ce qui a déjà été saisi : la planète des tâches affiche leur nombre. */
  taskCount: number;
  /** Version réduite du haut d'écran mobile : pas d'étiquettes, trop petites à cette échelle. */
  compact?: boolean;
}

/**
 * Le planétaire, signature de l'accueil perso. Purement illustratif
 * (`aria-hidden` posé par le parent) : tout ce qu'il montre est dit en texte
 * dans la colonne du formulaire.
 *
 * 🔴 Sous `prefers-reduced-motion` (actif sur la machine d'Axel), RIEN ne
 * bouge : les orbites sont rendues tracées, les comètes ne sont pas montées
 * (`<animateMotion>` est du SMIL, qui ignore ce réglage), et le halo de la
 * planète active est un anneau fixe. Le dessin final doit donc tenir seul :
 * c'est lui, et pas l'animation, qui porte la composition.
 */
const Orrery = ({ step, labels, taskCount, compact = false }: OrreryProps) => {
  const reduce = useReducedMotion() ?? false;
  const states = planetStates(step);
  const preview = step === 0;
  const complete = step >= PLANETS.length + 1;

  return (
    <svg
      // Version réduite : on recadre sur les orbites (y 84 → 314), sinon le
      // dessin se perd dans les marges prévues pour les étiquettes.
      viewBox={compact ? `0 84 ${ORRERY_VIEWBOX.width} 230` : `0 0 ${ORRERY_VIEWBOX.width} ${ORRERY_VIEWBOX.height}`}
      className="h-full w-full overflow-visible"
      role="presentation"
    >
      <defs>
        <radialGradient id="orrery-sun-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Anneau gradué : l'instrument. Toujours là, toujours discret. */}
      <g stroke={INK} strokeLinecap="round">
        {TICKS.map((tick, i) => (
          <line
            key={i}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            strokeWidth={tick.major ? 1.2 : 0.8}
            strokeOpacity={tick.major ? 0.28 : 0.14}
          />
        ))}
      </g>

      {/* Orbites en attente : pointillé fin, sous tout le reste. */}
      {PLANETS.map((planet) => (
        <ellipse
          key={`idle-${planet}`}
          cx={ORRERY_CENTER.x}
          cy={ORRERY_CENTER.y}
          rx={ORBITS[planet].rx}
          ry={ORBITS[planet].ry}
          fill="none"
          stroke={HAIRLINE}
          strokeWidth={1}
          strokeDasharray="2 5"
        />
      ))}

      {/* Orbites allumées : tracées au moment où l'étape s'ouvre. */}
      {PLANETS.map((planet, i) => {
        const state = states[planet];
        const lit = preview || state !== 'idle';
        if (!lit) return null;
        const color = PLANET_COLOR[planet];
        const opacity = preview ? 0.5 : state === 'active' ? 1 : 0.62;
        const width = state === 'active' ? 1.8 : 1.25;
        const common = {
          cx: ORRERY_CENTER.x,
          cy: ORRERY_CENTER.y,
          rx: ORBITS[planet].rx,
          ry: ORBITS[planet].ry,
          fill: 'none',
          stroke: color,
          strokeWidth: width,
          strokeOpacity: opacity,
        };
        return reduce ? (
          <ellipse key={`lit-${planet}`} {...common} />
        ) : (
          <motion.ellipse
            key={`lit-${planet}-${preview ? 'p' : 'b'}`}
            {...common}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: preview ? 0.15 + i * 0.18 : 0.05 }}
          />
        );
      })}

      {/* Comètes : la vie du système, seulement si l'on accepte le mouvement. */}
      {!reduce &&
        PLANETS.map((planet) => {
          const state = states[planet];
          if (!(complete || state === 'active')) return null;
          return (
            <circle key={`comet-${planet}`} r={2.6} fill={PLANET_COLOR[planet]}>
              <animateMotion dur={`${ORBITS[planet].period}s`} repeatCount="indefinite" path={orbitPath(planet)} />
            </circle>
          );
        })}

      {/* Le centre : vous, sous la forme de la planète du logo. */}
      <circle cx={ORRERY_CENTER.x} cy={ORRERY_CENTER.y} r={64} fill="url(#orrery-sun-halo)" />
      <image
        href="/logo.svg"
        x={ORRERY_CENTER.x - 30}
        y={ORRERY_CENTER.y - 31}
        width={60}
        height={57}
      />
      {!compact && (
        <text
          x={ORRERY_CENTER.x}
          y={ORRERY_CENTER.y + 44}
          textAnchor="middle"
          className="font-data"
          fontSize={10.5}
          letterSpacing="0.14em"
          fill={MUTED}
        >
          {labels.you.toUpperCase()}
        </text>
      )}

      {/* Les planètes et leurs noms. */}
      {PLANETS.map((planet) => {
        const state = states[planet];
        const { x, y } = planetPosition(planet);
        const color = PLANET_COLOR[planet];
        const lit = preview || state !== 'idle';
        const r = state === 'active' ? 9.5 : lit ? 8 : 5.5;
        const count = planet === 'tasks' && taskCount > 0 && state !== 'idle' ? taskCount : 0;
        return (
          <g key={`planet-${planet}`}>
            {state === 'active' &&
              (reduce ? (
                <circle cx={x} cy={y} r={17} fill={color} fillOpacity={0.12} />
              ) : (
                <motion.circle
                  cx={x}
                  cy={y}
                  fill={color}
                  initial={{ r: 10, opacity: 0.32 }}
                  animate={{ r: 26, opacity: 0 }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
                />
              ))}
            <circle
              cx={x}
              cy={y}
              r={r}
              fill={lit ? color : '#FFFFFF'}
              stroke={lit ? '#FFFFFF' : HAIRLINE}
              strokeWidth={lit ? 2.5 : 1.5}
            />
            {count > 0 && (
              <text
                x={x}
                y={y + 3.4}
                textAnchor="middle"
                fontSize={9.5}
                fontWeight={700}
                fill="#FFFFFF"
              >
                {count}
              </text>
            )}
            {!compact && (
              <text
                x={x}
                y={y - (r + 9)}
                textAnchor="middle"
                className="font-data"
                fontSize={11}
                letterSpacing="0.12em"
                fontWeight={state === 'active' ? 700 : 500}
                fill={lit ? INK : MUTED}
                stroke="#F6F7FB"
                strokeWidth={4}
                paintOrder="stroke"
              >
                {labels[planet].toUpperCase()}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

export default Orrery;

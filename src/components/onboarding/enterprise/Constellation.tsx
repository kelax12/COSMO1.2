import { motion, useReducedMotion } from 'framer-motion';
import {
  ENT,
  GHOST_SLOTS,
  NORTH,
  OUTSIDER,
  PEOPLE_SLOTS,
  PROJECT,
  SKY,
  TEAM_HULL,
  YOU,
  clip,
  fourPointStar,
  personInitial,
  starField,
} from './constellation-geometry';

export type ConstellationFocus = 'demo' | 'name' | 'invite' | 'team' | 'project' | 'objective' | 'done' | 'join';

interface ConstellationProps {
  focus: ConstellationFocus;
  orgName: string;
  youInitials: string;
  /** Adresses invitées : une étoile chacune, dans l'ordre de saisie. */
  people: string[];
  teamName: string;
  project: { name: string; taskCount: number } | null;
  objective: string;
  labels: { you: string; north: string; team: string; project: string; orgFallback: string; pending: string };
  /** Version réduite du haut d'écran mobile : sans les petites étiquettes. */
  compact?: boolean;
}

const STARS = starField();
const DEMO_PEOPLE = ['ana', 'leo', 'mia', 'sam', 'tom'];

/**
 * La constellation, signature de l'accueil entreprise. Purement illustrative
 * (`aria-hidden` posé par le parent) : chaque chose qu'elle montre est dite
 * en texte dans la colonne du formulaire.
 *
 * 🔴 Sous `prefers-reduced-motion`, rien ne bouge : les liens sont tracés, les
 * étoiles ne scintillent pas (`<animate>` est du SMIL, qui ignore ce réglage :
 * il n'est donc pas monté). La composition finale tient seule.
 */
const Constellation = ({
  focus,
  orgName,
  youInitials,
  people,
  teamName,
  project,
  objective,
  labels,
  compact = false,
}: ConstellationProps) => {
  const reduce = useReducedMotion() ?? false;
  const demo = focus === 'demo';
  const joining = focus === 'join';
  const done = focus === 'done';

  const shownPeople = demo ? DEMO_PEOPLE : people;
  const visible = shownPeople.slice(0, PEOPLE_SLOTS.length);
  const overflow = shownPeople.length - visible.length;
  const team = demo ? labels.team : teamName;
  const proj = demo ? { name: labels.project, taskCount: 4 } : project;
  const north = demo ? labels.north : objective;
  const name = orgName || labels.orgFallback;

  const lit = (part: ConstellationFocus) => focus === part;
  const draw = (delay = 0) =>
    reduce
      ? {}
      : {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const, delay },
        };
  const appear = (delay = 0) =>
    reduce
      ? {}
      : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.6, delay } };

  const textMono = { className: 'font-data', fontSize: 10, letterSpacing: '0.14em' } as const;

  return (
    <svg
      // Version réduite : recadrée sur le dessin (les marges du ciel servent
      // l'écran large, pas un bandeau de 240 px).
      viewBox={compact ? '70 36 420 524' : `0 0 ${SKY.width} ${SKY.height}`}
      className="h-full w-full overflow-visible"
      role="presentation"
    >
      <defs>
        <radialGradient id="ent-north-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={ENT.or} stopOpacity="0.5" />
          <stop offset="100%" stopColor={ENT.or} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ent-you-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={ENT.faisceau} stopOpacity="0.32" />
          <stop offset="100%" stopColor={ENT.faisceau} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ent-north-cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ENT.or} stopOpacity="0.16" />
          <stop offset="100%" stopColor={ENT.or} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Fond : les étoiles lointaines. */}
      <g>
        {STARS.map((star, i) => (
          <circle key={i} cx={star.x} cy={star.y} r={star.r} fill={ENT.lune} opacity={star.o}>
            {!reduce && (done || demo) && (
              <animate
                attributeName="opacity"
                values={`${star.o};${star.o * 0.25};${star.o}`}
                dur={`${star.d}s`}
                repeatCount="indefinite"
              />
            )}
          </circle>
        ))}
      </g>

      {/* Le cône de l'étoile polaire : le cap éclaire toute l'organisation. */}
      {north && (
        <motion.path
          d={`M ${NORTH.x} ${NORTH.y} L ${TEAM_HULL.cx - TEAM_HULL.rx} ${PROJECT.y + PROJECT.h / 2} L ${TEAM_HULL.cx + TEAM_HULL.rx} ${PROJECT.y + PROJECT.h / 2} Z`}
          fill="url(#ent-north-cone)"
          {...appear(0.2)}
        />
      )}

      {/* Équipe : l'amas qui entoure les personnes. */}
      {team ? (
        <motion.ellipse
          cx={TEAM_HULL.cx}
          cy={TEAM_HULL.cy}
          rx={TEAM_HULL.rx}
          ry={TEAM_HULL.ry}
          fill={ENT.faisceau}
          fillOpacity={lit('team') ? 0.07 : 0.035}
          stroke={lit('team') ? ENT.faisceau : ENT.lune}
          strokeOpacity={lit('team') ? 0.75 : 0.22}
          strokeWidth={1.2}
          strokeDasharray="3 6"
          {...appear()}
        />
      ) : (
        <ellipse
          cx={TEAM_HULL.cx}
          cy={TEAM_HULL.cy}
          rx={TEAM_HULL.rx}
          ry={TEAM_HULL.ry}
          fill="none"
          stroke={lit('team') ? ENT.faisceau : ENT.brume}
          strokeOpacity={lit('team') ? 0.6 : 0.16}
          strokeDasharray="2 7"
        />
      )}
      {!compact && (
        <text
          x={TEAM_HULL.cx - TEAM_HULL.rx + 18}
          y={TEAM_HULL.cy - TEAM_HULL.ry + 2}
          {...textMono}
          fill={team ? (lit('team') ? ENT.faisceau : ENT.lune) : ENT.brume}
          fillOpacity={team ? 0.9 : 0.6}
          stroke={ENT.nuit}
          strokeWidth={5}
          paintOrder="stroke"
        >
          {clip((team || labels.team).toUpperCase(), 26)}
        </text>
      )}

      {/* Projet : sous l'équipe, porté par elle. */}
      <line
        x1={PROJECT.x}
        y1={TEAM_HULL.cy + TEAM_HULL.ry}
        x2={PROJECT.x}
        y2={PROJECT.y - PROJECT.h / 2}
        stroke={proj ? ENT.lune : ENT.brume}
        strokeOpacity={proj ? 0.3 : 0.14}
        strokeDasharray={proj ? undefined : '2 5'}
      />
      <g>
        <rect
          x={PROJECT.x - PROJECT.w / 2}
          y={PROJECT.y - PROJECT.h / 2}
          width={PROJECT.w}
          height={PROJECT.h}
          rx={14}
          fill={proj ? ENT.acier : 'none'}
          stroke={lit('project') ? ENT.faisceau : proj ? ENT.lune : ENT.brume}
          strokeOpacity={lit('project') ? 0.85 : proj ? 0.22 : 0.22}
          strokeDasharray={proj ? undefined : '3 6'}
        />
        {proj ? (
          <motion.g {...appear()}>
            <text x={PROJECT.x - PROJECT.w / 2 + 16} y={PROJECT.y - 3} fontSize={13} fontWeight={600} fill={ENT.lune}>
              {clip(proj.name, 24)}
            </text>
            {Array.from({ length: Math.min(proj.taskCount, 8) }, (_, i) => (
              <rect
                key={i}
                x={PROJECT.x - PROJECT.w / 2 + 16 + i * 14}
                y={PROJECT.y + 8}
                width={10}
                height={4}
                rx={2}
                fill={i === 0 ? ENT.faisceau : ENT.lune}
                fillOpacity={i === 0 ? 0.9 : 0.28}
              />
            ))}
          </motion.g>
        ) : (
          !compact && (
            <text x={PROJECT.x} y={PROJECT.y + 4} textAnchor="middle" {...textMono} fill={ENT.brume} fillOpacity={0.6}>
              {labels.project.toUpperCase()}
            </text>
          )
        )}
      </g>

      {/* Liens de l'organigramme : de vous vers chaque personne. */}
      {visible.map((person, i) => {
        const slot = PEOPLE_SLOTS[i];
        return (
          <motion.line
            key={`link-${person}-${i}`}
            x1={YOU.x}
            y1={YOU.y}
            x2={slot.x}
            y2={slot.y}
            stroke={lit('invite') ? ENT.faisceau : ENT.lune}
            strokeOpacity={lit('invite') ? 0.55 : 0.24}
            strokeWidth={1}
            {...draw(demo ? 0.3 + i * 0.08 : 0)}
          />
        );
      })}
      {visible.length === 0 &&
        GHOST_SLOTS.map((i) => (
          <line
            key={`ghost-link-${i}`}
            x1={YOU.x}
            y1={YOU.y}
            x2={PEOPLE_SLOTS[i].x}
            y2={PEOPLE_SLOTS[i].y}
            stroke={lit('invite') ? ENT.faisceau : ENT.brume}
            strokeOpacity={lit('invite') ? 0.4 : 0.14}
            strokeDasharray="2 6"
          />
        ))}

      {/* Les personnes. */}
      {visible.map((person, i) => {
        const slot = PEOPLE_SLOTS[i];
        return (
          <motion.g key={`person-${person}-${i}`} {...appear(demo ? 0.4 + i * 0.08 : 0.1)}>
            <circle cx={slot.x} cy={slot.y} r={15} fill={ENT.acier} stroke={lit('invite') ? ENT.faisceau : ENT.lune} strokeOpacity={lit('invite') ? 0.9 : 0.4} strokeWidth={1.3} />
            <text x={slot.x} y={slot.y + 4} textAnchor="middle" fontSize={11.5} fontWeight={600} fill={ENT.lune}>
              {personInitial(person)}
            </text>
          </motion.g>
        );
      })}
      {visible.length === 0 &&
        GHOST_SLOTS.map((i) => (
          <circle
            key={`ghost-${i}`}
            cx={PEOPLE_SLOTS[i].x}
            cy={PEOPLE_SLOTS[i].y}
            r={13}
            fill="none"
            stroke={lit('invite') ? ENT.faisceau : ENT.brume}
            strokeOpacity={lit('invite') ? 0.7 : 0.3}
            strokeDasharray="2 4"
          />
        ))}
      {overflow > 0 && (
        <text x={PEOPLE_SLOTS[4].x + 30} y={PEOPLE_SLOTS[4].y + 4} fontSize={11} fill={ENT.brume}>
          {`+${overflow}`}
        </text>
      )}

      {/* L'étoile polaire, et son lien vers vous. */}
      <line
        x1={NORTH.x}
        y1={NORTH.y + 18}
        x2={YOU.x}
        y2={YOU.y - 24}
        stroke={north ? ENT.or : ENT.brume}
        strokeOpacity={north ? 0.6 : 0.16}
        strokeDasharray="2 5"
      />
      {north && <circle cx={NORTH.x} cy={NORTH.y} r={lit('objective') || done ? 46 : 34} fill="url(#ent-north-glow)" />}
      {north ? (
        <motion.path
          d={fourPointStar(NORTH.x, NORTH.y, 15, 4.2)}
          fill={ENT.or}
          {...(reduce ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.8 } })}
        />
      ) : (
        <path
          d={fourPointStar(NORTH.x, NORTH.y, 13, 3.8)}
          fill="none"
          stroke={lit('objective') ? ENT.or : ENT.brume}
          strokeOpacity={lit('objective') ? 0.9 : 0.4}
          strokeDasharray="2 3"
        />
      )}
      {(north || !compact) && (
        <text
          x={NORTH.x}
          y={NORTH.y - 26}
          textAnchor="middle"
          {...(north
            ? { className: 'font-display', fontSize: compact ? 22 : 17, fontStyle: 'italic', fill: ENT.or }
            : { ...textMono, fill: lit('objective') ? ENT.or : ENT.brume, fillOpacity: 0.7 })}
        >
          {north ? clip(north, compact ? 26 : 40) : labels.north.toUpperCase()}
        </text>
      )}

      {/* Vous. */}
      <circle cx={YOU.x} cy={YOU.y} r={58} fill="url(#ent-you-glow)" />
      <circle cx={YOU.x} cy={YOU.y} r={23} fill={ENT.acier} stroke={ENT.faisceau} strokeWidth={1.6} />
      {/* En demande d'adhésion, le centre est l'entreprise, pas vous. */}
      {joining ? (
        <path d={fourPointStar(YOU.x, YOU.y, 9, 2.6)} fill={ENT.lune} fillOpacity={0.85} />
      ) : (
        <text x={YOU.x} y={YOU.y + 4.5} textAnchor="middle" fontSize={13} fontWeight={700} fill={ENT.lune}>
          {youInitials}
        </text>
      )}
      {!compact && !joining && (
        <text x={YOU.x + 34} y={YOU.y + 4} {...textMono} fill={ENT.faisceau}>
          {labels.you.toUpperCase()}
        </text>
      )}

      {/* Rejoindre : vous êtes encore dehors, relié par une demande. */}
      {joining && (
        <g>
          <line
            x1={OUTSIDER.x}
            y1={OUTSIDER.y}
            x2={YOU.x + 26}
            y2={YOU.y - 14}
            stroke={ENT.faisceau}
            strokeOpacity={0.6}
            strokeDasharray="3 5"
          >
            {!reduce && <animate attributeName="stroke-dashoffset" values="16;0" dur="1.4s" repeatCount="indefinite" />}
          </line>
          <circle cx={OUTSIDER.x} cy={OUTSIDER.y} r={19} fill={ENT.nuit} stroke={ENT.faisceau} strokeWidth={1.4} strokeDasharray="3 3" />
          <text x={OUTSIDER.x} y={OUTSIDER.y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={ENT.faisceau}>
            {youInitials}
          </text>
          {!compact && (
            <text x={OUTSIDER.x} y={OUTSIDER.y - 30} textAnchor="middle" {...textMono} fill={ENT.faisceau}>
              {labels.pending.toUpperCase()}
            </text>
          )}
        </g>
      )}

      {/* Le nom de l'entreprise, comme on nomme une constellation. */}
      <text
        x={SKY.width / 2}
        y={SKY.height - 14}
        textAnchor="middle"
        className="font-display"
        fontStyle="italic"
        fontSize={compact ? 34 : 30}
        fill={orgName ? ENT.lune : ENT.brume}
        fillOpacity={orgName ? (lit('name') ? 1 : 0.88) : 0.55}
      >
        {clip(name, 28)}
      </text>
      {lit('name') && !reduce && (
        <motion.line
          x1={SKY.width / 2 - 70}
          y1={SKY.height - 2}
          x2={SKY.width / 2 + 70}
          y2={SKY.height - 2}
          stroke={ENT.faisceau}
          strokeOpacity={0.7}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9 }}
        />
      )}
      {lit('name') && reduce && (
        <line x1={SKY.width / 2 - 70} y1={SKY.height - 2} x2={SKY.width / 2 + 70} y2={SKY.height - 2} stroke={ENT.faisceau} strokeOpacity={0.7} />
      )}
    </svg>
  );
};

export default Constellation;

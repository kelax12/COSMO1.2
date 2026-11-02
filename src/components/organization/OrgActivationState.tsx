import { Link } from 'react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2, UserPlus } from 'lucide-react';
import { useT } from '@/i18n/useT';

export type ActivationPhase = 'waiting' | 'timeout' | 'welcome';

interface Props {
  phase: ActivationPhase;
  tierLabel: string;
  membersHref: string;
  onClose: () => void;
}

/** Couleurs du logo (`public/logo-128.webp`), pas des jetons de thème : c'est la marque. */
const PLANET = '#4f46e5';
const RING = '#2dd4bf';
const OUTLINE = '#1a1744';

/**
 * Orbite de bienvenue (animation 6). Une seule révolution, pas de boucle : rien
 * à mettre en pause (WCAG 2.2.2 ne s'applique qu'au mouvement qui dure).
 *
 * Par défaut Framer fait tourner un élément SVG autour du centre de sa boîte
 * (`transform-box: fill-box`). Ici cette boîte n'est que celle du satellite
 * (x 91 à 105) : le centre ne serait pas la planète. On fixe donc
 * `transformBox: 'view-box'` et `transformOrigin: '60px 60px'`, le centre du
 * viewBox, qui est celui de la planète. Rotation de 0 à 360 : sous mouvement
 * réduit elle ne joue pas et le satellite reste à sa place finale.
 */
function Orbit() {
  const reduce = useReducedMotion();
  return (
    <svg width="96" height="96" viewBox="0 0 120 120" aria-hidden className="shrink-0">
      <circle cx="60" cy="60" r="38" fill="none" stroke="rgb(var(--color-border-strong))" strokeDasharray="3 5" />
      <motion.g
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 2.4, ease: [0.4, 0, 0.2, 1] }}
        style={{ transformBox: 'view-box', transformOrigin: '60px 60px' }}
      >
        <circle cx="98" cy="60" r="7" fill={RING} stroke={OUTLINE} strokeWidth="2" />
      </motion.g>
      <circle cx="60" cy="60" r="18" fill={PLANET} stroke={OUTLINE} strokeWidth="3" />
      {[
        [18, 22, 2],
        [104, 18, 1.5],
        [22, 100, 1.5],
      ].map(([cx, cy, r], i) => (
        <motion.circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="rgb(var(--color-text-muted))"
          animate={reduce ? undefined : { opacity: [1, 0.2, 1, 0.2, 1] }}
          transition={{ duration: 3.2, delay: i * 0.4 }}
        />
      ))}
    </svg>
  );
}

export function OrgActivationState({ phase, tierLabel, membersHref, onClose }: Props) {
  const { t } = useT('orgAdmin');

  if (phase === 'waiting') {
    return (
      <div role="status" className="flex flex-col items-center gap-2 rounded-xl border border-[rgb(var(--color-border))] px-4 py-8 text-center">
        <Loader2 size={24} aria-hidden className="animate-spin motion-reduce:animate-none text-[rgb(var(--color-accent))]" />
        <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('billing.activationWaitTitle')}</p>
        <p className="text-xs text-[rgb(var(--color-text-secondary))]">{t('billing.activationWaitBody')}</p>
      </div>
    );
  }

  if (phase === 'timeout') {
    return (
      <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300">
        {t('billing.activationTimeout')}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-wrap items-center gap-4 rounded-xl border border-[rgb(var(--color-border))] p-4"
    >
      <Orbit />
      <div className="flex min-w-[220px] flex-1 flex-col gap-1">
        <div role="status" className="flex flex-col gap-1">
          <p className="text-lg font-semibold text-[rgb(var(--color-text-primary))]">{t('billing.welcomeTitle', { tier: tierLabel })}</p>
          <p className="text-sm text-[rgb(var(--color-text-secondary))]">{t('billing.welcomeBody')}</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            to={membersHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[rgb(var(--color-accent-solid))] px-3 py-2 text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))]"
          >
            <UserPlus size={14} aria-hidden /> {t('billing.welcomeInvite')}
          </Link>
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-[rgb(var(--color-text-secondary))]">
            {t('billing.welcomeClose')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default OrgActivationState;

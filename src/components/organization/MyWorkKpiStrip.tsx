import type { ReactNode } from 'react';
import { format, parseISO } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import type { TeamTask } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';
import { isOverdue } from './my-work.helpers';


interface KpiStripProps {
  /** Prénom affiché dans le salut ; absent, le salut reste neutre. */
  firstName: string | null;
  waiting: number;
  open: number;
  overdue: number;
  /** Tâches terminées sur la fenêtre lue (30 jours), pour la barre. */
  done: number;
  nextDeadline: TeamTask | null;
  /** Grand format de l'Aperçu : les gros chiffres, posés sous le salut. */
  children?: ReactNode;
}

// Maquette 227 (2026-10-10) : sur mobile, plus de pastilles colorées, du
// texte ; seul le retard reste en rouge. Desktop garde ses pastilles.
const PILL = 'tabular-nums md:inline-flex md:items-center md:px-2 md:py-0.5 md:rounded-md md:text-xs md:font-semibold';

/**
 * En-tête de l'Aperçu (maquette 1 B, 2026-10-02) : une phrase plutôt que
 * quatre tuiles. Elle porte les mêmes réponses (ce qui m'attend, ce qui est
 * ouvert, ce qui est en retard, la prochaine échéance) et absorbe la barre de
 * l'ancienne carte de synthèse (maquette 4 C), qui redisait ces chiffres.
 *
 * Une pastille à 0 n'est pas peinte : la couleur ne marque que ce qui
 * demande un geste.
 */
export const KpiStrip = ({ firstName, waiting, open, overdue, done, nextDeadline, children }: KpiStripProps) => {
  const { t, tp } = useT('orgAdmin');
  const late = !!nextDeadline && isOverdue(nextDeadline);
  const inProgress = Math.max(0, open - overdue);
  const total = done + open;
  const barLabel = t('apercu.greeting.barLabel', { done, inProgress, overdue });

  return (
    <section
      aria-labelledby="my-work-greeting"
      className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-4 py-4 sm:px-5 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:px-0 max-md:py-1"
    >
      <h2 id="my-work-greeting" className="text-lg font-bold text-[rgb(var(--color-text-primary))]">
        {firstName ? t('apercu.greeting.hello', { name: firstName }) : t('apercu.greeting.helloAnon')}
      </h2>
      {children && <div className="mt-3">{children}</div>}
      {/* `data-testid` : masquée par la garde visuelle, la date et le nom de la
          prochaine échéance avancent avec le jour. */}
      {/* Masquée sur mobile (retour 2026-10-11) : les mêmes chiffres sont
          repris par les sections juste en dessous, la phrase surchargeait. */}
      <p data-testid="apercu-greeting-summary" className="max-md:hidden mt-1.5 text-sm leading-relaxed text-[rgb(var(--color-text-secondary))]">
        {waiting === 0 && overdue === 0 && open === 0 ? (
          t('apercu.greeting.allClear')
        ) : (
          <>
            {waiting > 0 && (
              <><span className={`${PILL} md:bg-amber-500/15 md:text-amber-700 md:dark:text-amber-300`}>{tp('apercu.greeting.waiting', waiting)}</span>{' '}</>
            )}
            <span className={`${PILL} md:bg-[rgb(var(--color-accent)/0.12)] md:text-[rgb(var(--color-accent))]`}>{tp('apercu.greeting.open', open)}</span>{' '}
            {overdue > 0 && (
              <><span className={`${PILL} font-semibold text-[rgb(var(--color-danger-text))] md:bg-red-500/15 md:text-red-700 md:dark:text-red-300`}>{tp('apercu.greeting.overdue', overdue)}</span>{' '}</>
            )}
            {nextDeadline?.deadline ? (
              <>
                {t(late ? 'apercu.greeting.nextLate' : 'apercu.greeting.next')}{' '}
                <time
                  dateTime={nextDeadline.deadline}
                  className={`font-semibold ${late ? 'text-red-500' : 'text-[rgb(var(--color-text-primary))]'}`}
                >
                  {format(parseISO(nextDeadline.deadline), 'EEEE d MMMM', { locale: getDateLocale() })}
                </time>
                {' · '}
                <span className="text-[rgb(var(--color-text-primary))]">{nextDeadline.name}</span>
              </>
            ) : (
              t('apercu.greeting.noDeadline')
            )}
          </>
        )}
      </p>

      {total > 0 && (
        // Maquette 227 : la barre bicolore répétait les chiffres de la phrase.
        <div className="mt-3 hidden md:block">
          <div className="flex h-2 rounded-full overflow-hidden bg-[rgb(var(--color-hover))]" role="img" aria-label={barLabel}>
            <span className="bg-emerald-500" style={{ flexGrow: done }} />
            <span className="bg-[rgb(var(--color-accent))]" style={{ flexGrow: inProgress }} />
            <span className="bg-red-500" style={{ flexGrow: overdue }} />
          </div>
          <p className="mt-1.5 text-xs text-[rgb(var(--color-text-muted))]" aria-hidden="true">{barLabel}</p>
        </div>
      )}
    </section>
  );
};

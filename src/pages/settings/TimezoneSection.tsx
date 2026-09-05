// ═══════════════════════════════════════════════════════════════════
// Le fuseau horaire d'affichage
//
// FRONTIÈRE : ce composant ne connaît ni le profil, ni le compte, ni les
// onglets des réglages. Il lit et écrit UNE préférence, via `useTimezonePref`.
//
// ⚠️ Ce réglage n'est pas cosmétique : depuis la révision du 2026-09-02, il
// découpe aussi les JOURNÉES (`dayKeyInTz`), donc les échéances, les reports
// et « Aujourd'hui » d'une personne en Guadeloupe, à La Réunion ou en
// Nouvelle-Calédonie. Cf. CLAUDE.md § Fuseau horaire.
//
// Le décalage est stocké SIGNÉ (−5, +2). L'écran, lui, le montre en signe +
// magnitude, parce qu'un champ numérique où l'on tape « -5 » passe par « - »
// puis « -5 » et rend un état intermédiaire invalide. Les deux se
// recombinent ici, et nulle part ailleurs.
//
// Extrait le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import { useTimezonePref, clampOffsetHours } from '@/lib/timezone';
import { useT } from '@/i18n/useT';
import { SectionCard } from './primitives';

const OPTION_BASE =
  'flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-colors';
const SELECTED = 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent))]/8';
const UNSELECTED = 'border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-accent))]/40';

const TimezoneSection = () => {
  const { t } = useT('settings');
  const { pref: tzPref, setMode: setTzMode, setOffsetHours: setTzOffset } = useTimezonePref();

  // Signe + magnitude dérivés du décalage signé stocké (ex. -5 → signe '-',
  // magnitude 5). L'utilisateur choisit le signe via un toggle +/− et la
  // magnitude via le champ numérique ; les deux se recombinent en un
  // offsetHours signé unique.
  const sign: '+' | '-' = tzPref.offsetHours < 0 ? '-' : '+';
  const magnitude = Math.abs(tzPref.offsetHours);
  const applySign = (nextSign: '+' | '-') =>
    setTzOffset(clampOffsetHours(nextSign === '-' ? -magnitude : magnitude));
  const applyMagnitude = (nextMagnitude: number) =>
    setTzOffset(clampOffsetHours(sign === '-' ? -nextMagnitude : nextMagnitude));

  const radio = (selected: boolean) =>
    `shrink-0 w-4 h-4 rounded-full border-2 ${
      selected ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent))]' : 'border-[rgb(var(--color-border))]'
    }`;

  return (
    <SectionCard>
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-base font-bold text-[rgb(var(--color-text-primary))]">{t('timezone.heading')}</h2>
      </div>
      <p className="text-xs text-[rgb(var(--color-text-secondary))] mb-4">{t('timezone.description')}</p>
      <div className="flex flex-col gap-2.5">
        {/* Option : heure par défaut (locale) */}
        <button
          type="button"
          onClick={() => setTzMode('default')}
          style={{ minHeight: '56px' }}
          className={`${OPTION_BASE} ${tzPref.mode === 'default' ? SELECTED : UNSELECTED}`}
          aria-pressed={tzPref.mode === 'default'}
        >
          <div>
            <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('timezone.defaultTitle')}</p>
            <p className="text-caption text-[rgb(var(--color-text-secondary))] mt-0.5">{t('timezone.defaultHint')}</p>
          </div>
          <span className={radio(tzPref.mode === 'default')} />
        </button>

        {/* Option : heure personnalisée (UTC+N) */}
        <button
          type="button"
          onClick={() => setTzMode('manual')}
          style={{ minHeight: '56px' }}
          className={`${OPTION_BASE} ${tzPref.mode === 'manual' ? SELECTED : UNSELECTED}`}
          aria-pressed={tzPref.mode === 'manual'}
        >
          <div>
            <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('timezone.customTitle')}</p>
            <p className="text-caption text-[rgb(var(--color-text-secondary))] mt-0.5">{t('timezone.customHint')}</p>
          </div>
          <span className={radio(tzPref.mode === 'manual')} />
        </button>

        {tzPref.mode === 'manual' && (
          <div className="flex items-center gap-2 pl-1 pt-1">
            <label htmlFor="tz-offset" className="text-sm text-[rgb(var(--color-text-secondary))]">
              {t('timezone.offsetLabel')}
            </label>

            {/* Toggle du signe : UTC+ (est de Greenwich) / UTC- (ouest) */}
            <div
              className="inline-flex rounded-lg border border-[rgb(var(--color-border))] overflow-hidden"
              role="group"
              aria-label={t('timezone.offsetSign')}
            >
              {(['+', '-'] as const).map((s, index) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => applySign(s)}
                  aria-pressed={sign === s}
                  className={`px-3 min-h-touch sm:min-h-9 text-sm font-semibold transition-colors ${
                    index > 0 ? 'border-l border-[rgb(var(--color-border))]' : ''
                  } ${
                    sign === s
                      ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
                      : 'bg-[rgb(var(--color-background))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
                  }`}
                >
                  {s === '+' ? '+' : '−'}
                </button>
              ))}
            </div>

            <div className="inline-flex items-stretch rounded-lg border border-[rgb(var(--color-border))] overflow-hidden focus-within:ring-2 focus-within:ring-[rgb(var(--color-accent))]/30">
              <span className="inline-flex items-center px-3 bg-[rgb(var(--color-hover))] text-sm font-semibold text-[rgb(var(--color-text-primary))] select-none">
                UTC{sign}
              </span>
              <input
                id="tz-offset"
                type="number"
                inputMode="numeric"
                min={0}
                max={sign === '-' ? 12 : 14}
                step={1}
                value={magnitude}
                onChange={(e) => applyMagnitude(Number(e.target.value))}
                className="w-16 px-3 min-h-touch sm:min-h-9 bg-[rgb(var(--color-background))] text-sm font-semibold text-[rgb(var(--color-text-primary))] outline-none"
              />
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
};

export default TimezoneSection;

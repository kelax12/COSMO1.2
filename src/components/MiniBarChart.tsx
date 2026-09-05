// ═══════════════════════════════════════════════════════════════════
// MiniBarChart — la tendance d'une tuile de statistique du Dashboard.
//
// Extrait de `DashboardPage` le 2026-09-05 : la page venait de franchir le
// budget de 600 lignes (garde `architecture.guard`), et ce composant n'avait
// jamais eu de raison d'y vivre — il ne lit rien de la page, il reçoit sept
// valeurs et les dessine. Comportement inchangé, y compris le résumé textuel
// (#35) sans lequel les valeurs n'existent que pour la souris.
// ═══════════════════════════════════════════════════════════════════
import React from 'react';
import { formatDate } from '@/i18n/format';
import { useT, type Translator } from '@/i18n/useT';

/**
 * Étiquette d'une barre du mini-graphique.
 *
 * La table `MONTHS_FR` codée en dur qui vivait ici a disparu au profit de
 * `formatDate` (`Intl` sous le capot) : les noms de mois abrégés existent déjà
 * dans toutes les locales, les réécrire à la main revenait à maintenir une
 * traduction de plus — et à la figer en français.
 */
const formatBarDate = (raw: string, t: Translator<'dashboard'>['t']): string => {
  // Only format yyyy-mm-dd strings (7 days view)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const todayStr = new Date().toLocaleDateString('en-CA');
  if (raw === todayStr) return t('chart.today');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (raw === yesterday.toLocaleDateString('en-CA')) return t('chart.yesterday');
  const [y, m, d] = raw.split('-').map(Number);
  return formatDate(new Date(y, m - 1, d), { day: 'numeric', month: 'short' });
};

export const MiniBarChart: React.FC<{ data: { value: number; label?: string; date?: string }[]; color?: string; ariaLabel?: string }> = ({ data, color = '#2563EB', ariaLabel }) => {
  const { t } = useT('dashboard');
  const [hovered, setHovered] = React.useState<number | null>(null);
  const max = Math.max(...data.map(d => d.value), 1);

  React.useEffect(() => {
    if (hovered === null) return;
    const handler = () => setHovered(null);
    window.addEventListener('touchstart', handler, { passive: true });
    return () => window.removeEventListener('touchstart', handler);
  }, [hovered]);

  const darken = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, (n >> 16) - 40);
    const g = Math.max(0, ((n >> 8) & 0xff) - 40);
    const b = Math.max(0, (n & 0xff) - 40);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  };

  // #35 — résumé textuel : les valeurs ne sont sinon exposées qu'au hover/touch,
  // invisibles au clavier et aux lecteurs d'écran (WCAG/EAA).
  const summary = ariaLabel
    ? `${ariaLabel} : ${data.map(d => d.value).join(', ')}`
    : undefined;

  return (
    <div
      className="flex items-end gap-[3px] h-[56px] w-full pt-1 relative"
      role="img"
      aria-label={summary}>
      {data.map((d, i) => {
        const tooltipLabel = d.label ? d.label : d.date ? formatBarDate(d.date, t) : '';
        return (
          <div
            key={i}
            className="flex-1 relative flex flex-col items-center justify-end h-full"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onTouchStart={(e) => {
              e.stopPropagation();
              setHovered(prev => prev === i ? null : i);
            }}
          >
            {hovered === i && (
              <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] text-caption md:text-[10px] font-bold px-2 py-1 rounded-lg shadow-lg pointer-events-none">
                {tooltipLabel ? `${tooltipLabel} : ` : ''}{d.value}
              </div>
            )}
            <div
              className={`w-full rounded-t-[3px] transition-all duration-150 ${
                hovered === i ? '' : ''
              }`}
              style={{
                height: `${Math.max((d.value / max) * 100, 8)}%`,
                backgroundColor: hovered === i ? darken(color) : color,
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

export default MiniBarChart;

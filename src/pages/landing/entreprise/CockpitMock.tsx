import React from 'react';
import { useT } from '@/i18n/useT';

/**
 * Maquettes des six onglets de l'espace entreprise.
 *
 * Volontairement schématiques : ce sont des captures *stylisées*, pas des
 * captures d'écran. Une vraie capture vieillit à chaque refonte de l'app et
 * ment sur la densité réelle ; un schéma dit la structure, qui elle ne bouge
 * pas. Aucun chiffre présenté ici ne prétend venir d'un vrai compte.
 */
const CockpitMock: React.FC<{ tabId: string }> = ({ tabId }) => {
  switch (tabId) {
    case 'overview':
      return <OverviewMock />;
    case 'pyramid':
      return <PyramidMock />;
    case 'projects':
      return <ProjectsMock />;
    case 'okr':
      return <OkrMock />;
    case 'stats':
      return <StatsMock />;
    default:
      return <MembersMock />;
  }
};

/** Cadre commun : barre de fenêtre + surface sombre. */
export const MockFrame: React.FC<React.PropsWithChildren<{ label: string }>> = ({ label, children }) => (
  <div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#0A0C11]">
    <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
      <span className="flex gap-1.5" aria-hidden="true">
        <span className="h-2 w-2 rounded-full bg-white/10" />
        <span className="h-2 w-2 rounded-full bg-white/10" />
        <span className="h-2 w-2 rounded-full bg-cyan-400/60" />
      </span>
      <span className="ml-1 font-mono text-caption uppercase tracking-[0.2em] text-slate-500">{label}</span>
    </div>
    <div className="flex-1 p-4 sm:p-5">{children}</div>
  </div>
);

const Bar: React.FC<{ w: string; tone?: 'bright' | 'dim' | 'accent' | 'gold' }> = ({ w, tone = 'dim' }) => (
  <div
    className={`h-1.5 rounded-full ${
      tone === 'bright'
        ? 'bg-white/25'
        : tone === 'accent'
          ? 'bg-cyan-400/80'
          : tone === 'gold'
            ? 'bg-[#F5B942]/80'
            : 'bg-white/10'
    }`}
    style={{ width: w }}
  />
);

const OverviewMock: React.FC = () => {
  const { t } = useT('landing');
  return (
    <div className="grid h-full gap-3 sm:grid-cols-2">
      <div className="space-y-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3.5">
        <span className="font-mono text-caption uppercase tracking-[0.18em] text-slate-500">
          {t('enterprise.cockpit.mockActivity')}
        </span>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span className="h-5 w-5 shrink-0 rounded-full border border-cyan-300/25 bg-cyan-400/10" />
            <div className="flex-1 space-y-1">
              <Bar w={`${88 - i * 12}%`} tone={i === 0 ? 'bright' : 'dim'} />
              <Bar w={`${52 - i * 6}%`} />
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3.5">
        <span className="font-mono text-caption uppercase tracking-[0.18em] text-slate-500">
          {t('enterprise.cockpit.mockWorkload')}
        </span>
        {[72, 45, 91, 33].map((v, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <Bar w="34%" />
              <span className="font-mono text-caption text-slate-600">{v}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className={`h-full rounded-full ${v > 85 ? 'bg-[#F5B942]' : 'bg-cyan-400/70'}`}
                style={{ width: `${v}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PyramidMock: React.FC = () => (
  <svg viewBox="0 0 320 170" className="h-full w-full" aria-hidden="true">
    {[
      'M160 34 C160 60, 70 60, 70 96',
      'M160 34 C160 60, 160 60, 160 96',
      'M160 34 C160 60, 250 60, 250 96',
      'M70 110 C70 130, 40 130, 40 146',
      'M70 110 C70 130, 100 130, 100 146',
      'M250 110 C250 130, 220 130, 220 146',
      'M250 110 C250 130, 280 130, 280 146',
    ].map((d, i) => (
      <path key={i} d={d} fill="none" stroke="rgba(34,211,238,0.3)" strokeWidth="1" />
    ))}
    {[
      { x: 160, y: 22, r: 12, lead: true },
      { x: 70, y: 103, r: 10, lead: true },
      { x: 160, y: 103, r: 10, lead: false },
      { x: 250, y: 103, r: 10, lead: true },
      { x: 40, y: 152, r: 7, lead: false },
      { x: 100, y: 152, r: 7, lead: false },
      { x: 220, y: 152, r: 7, lead: false },
      { x: 280, y: 152, r: 7, lead: false },
    ].map(({ x, y, r, lead }, i) => (
      <circle
        key={i}
        cx={x}
        cy={y}
        r={r}
        fill={lead ? 'rgba(34,211,238,0.18)' : '#12161D'}
        stroke="rgba(34,211,238,0.45)"
        strokeWidth="1"
      />
    ))}
  </svg>
);

const ProjectsMock: React.FC = () => {
  const { t } = useT('landing');
  const columns = [
    { key: t('enterprise.cockpit.mockTodo'), cards: 3, accent: false },
    { key: t('enterprise.cockpit.mockDoing'), cards: 2, accent: true },
    { key: t('enterprise.cockpit.mockReview'), cards: 2, accent: false },
  ];
  return (
    <div className="grid h-full grid-cols-3 gap-2.5">
      {columns.map(({ key, cards, accent }) => (
        <div key={key} className="flex flex-col gap-2 rounded-lg bg-white/[0.02] p-2">
          <span className="font-mono text-caption uppercase tracking-[0.16em] text-slate-500">{key}</span>
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className="space-y-1.5 rounded-md border border-white/[0.06] bg-[#11151C] p-2">
              <Bar w="90%" tone="bright" />
              <Bar w="60%" />
              <div className="flex items-center gap-1 pt-0.5">
                <span className={`h-1.5 w-6 rounded-full ${accent ? 'bg-cyan-400/70' : 'bg-white/10'}`} />
                <span className="ml-auto h-3.5 w-3.5 rounded-full border border-white/10 bg-white/[0.06]" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

const OkrMock: React.FC = () => (
  <div className="flex h-full flex-col justify-center gap-4">
    {[
      { label: '78%', w: '78%', tone: 'accent' as const },
      { label: '54%', w: '54%', tone: 'accent' as const },
      { label: '100%', w: '100%', tone: 'gold' as const },
      { label: '31%', w: '31%', tone: 'accent' as const },
    ].map(({ label, w, tone }, i) => (
      <div key={i} className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Bar w={`${44 - i * 4}%`} tone={i === 2 ? 'bright' : 'dim'} />
          <span className={`font-mono text-caption ${tone === 'gold' ? 'text-[#F5B942]' : 'text-slate-500'}`}>{label}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
          <div
            className={`h-full rounded-full ${tone === 'gold' ? 'bg-[#F5B942]' : 'bg-cyan-400/75'}`}
            style={{ width: w }}
          />
        </div>
      </div>
    ))}
  </div>
);

const StatsMock: React.FC = () => {
  const { t } = useT('landing');
  const bars = [34, 52, 41, 68, 59, 77, 71, 92, 84, 96];
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-end gap-4">
        <div>
          <span className="font-mono text-caption uppercase tracking-[0.18em] text-slate-500">
            {t('enterprise.cockpit.mockVelocity')}
          </span>
          <div className="text-2xl font-bold tabular-nums text-white">+18%</div>
        </div>
        <div>
          <span className="font-mono text-caption uppercase tracking-[0.18em] text-slate-500">
            {t('enterprise.cockpit.mockTrend')}
          </span>
          <div className="text-2xl font-bold tabular-nums text-cyan-300">↗</div>
        </div>
      </div>
      <div className="flex flex-1 items-end gap-1.5">
        {bars.map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className={`w-full rounded-sm ${i >= bars.length - 3 ? 'bg-cyan-400' : 'bg-cyan-400/25'}`}
              style={{ height: `${h}%` }}
            />
            <span className="font-mono text-caption text-slate-700">
              {t('enterprise.cockpit.mockWeek')}
              {i + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const MembersMock: React.FC = () => (
  <div className="grid h-full grid-cols-2 gap-2.5 sm:grid-cols-3">
    {Array.from({ length: 6 }, (_, i) => (
      <div key={i} className="flex flex-col gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <span
          className={`h-7 w-7 rounded-full border ${
            i % 3 === 0 ? 'border-cyan-300/40 bg-cyan-400/12' : 'border-white/10 bg-white/[0.05]'
          }`}
        />
        <Bar w="72%" tone="bright" />
        <Bar w="46%" />
        <div className="mt-auto h-1 overflow-hidden rounded-full bg-white/[0.05]">
          <div className="h-full rounded-full bg-cyan-400/60" style={{ width: `${40 + i * 9}%` }} />
        </div>
      </div>
    ))}
  </div>
);

export default CockpitMock;

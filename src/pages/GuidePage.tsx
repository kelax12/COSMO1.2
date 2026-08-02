import React, { useEffect, useRef, useState, Suspense, lazy } from 'react';
import { useSeoMeta } from '@/lib/useSeoMeta';
import { Link } from 'react-router';
import {
  CheckSquare, Calendar, Repeat, Target, BarChart2,
  Rocket, Star, ArrowRight, ChevronRight,
  BookOpen, Clock, Flag, Bookmark, Users, TrendingUp,
  Flame, Layers, Filter, Bell, List,
  GripVertical, PlayCircle
} from 'lucide-react';
import TaskTableShowcase from '../components/showcase/TaskTableShowcase';
import AgendaShowcase from '../components/showcase/AgendaShowcase';
import OKRCardShowcase from '../components/showcase/OKRCardShowcase';
import HabitHeatmapShowcase from '../components/showcase/HabitHeatmapShowcase';
// Audit perf 2026-05-29 — lazy-load Recharts wrapper (same rationale as LandingPage).
const StatsShowcase = lazy(() => import('../components/showcase/StatsShowcase'));
const StatsShowcaseFallback = () => (
  <div className="w-full rounded-2xl bg-slate-800/80 border border-white/10 shadow-2xl p-5 h-[340px] animate-pulse" />
);

// Atomes présentationnels + nav + schémas SEO extraits dans ./guide/primitives.
import {
  type SectionId,
  NAV_ITEMS,
  Tip,
  Note,
  Step,
  FeatureRow,
  SectionHeader,
  useGuideSchemas,
} from './guide/primitives';
import { useT } from '@/i18n/useT';
import RichText from '@/components/ui/rich-text';

const GuidePage: React.FC = () => {
  const { t } = useT('guide');
  useSeoMeta({
    title: t('meta.title'),
    description: t('meta.description'),
    canonical: 'https://thecosmo.app/guide',
  });
  useGuideSchemas();
  const [activeSection, setActiveSection] = useState<SectionId>('demarrage');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id as SectionId);
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    NAV_ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) {
        sectionRefs.current[id] = el;
        observer.observe(el);
      }
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: SectionId) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
              <img src="/logo.png" alt="Cosmo" className="w-7 h-7 rounded-lg object-contain" />
              <span className="font-semibold text-white">Cosmo</span>
            </Link>
            <ChevronRight size={14} className="text-slate-600" />
            {/* h1 sémantique (SEO) — rendu identique au span grâce au preflight
                Tailwind (les headings héritent font-size/weight) */}
            <h1 className="text-sm text-slate-400 flex items-center gap-1.5 font-normal">
              <BookOpen size={14} />
              {t('chrome.heading')}
            </h1>
          </div>
          <Link
            to="/"
            className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
          >
            {t('chrome.backHome')}
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex gap-12">

          {/* ── Sidebar ── */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-24">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">{t('chrome.summary')}</p>
              <nav className="space-y-1">
                {NAV_ITEMS.map(({ id, labelKey, icon, color }) => {
                  const isActive = activeSection === id;
                  return (
                    <button
                      key={id}
                      onClick={() => scrollTo(id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all text-left"
                      style={{
                        backgroundColor: isActive ? color + '15' : 'transparent',
                        color: isActive ? color : '#94A3B8',
                      }}
                    >
                      <span style={{ color: isActive ? color : '#64748B' }}>{icon}</span>
                      {t(labelKey)}
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* ── Content ── */}
          <main className="flex-1 min-w-0 space-y-24">

            {/* ══ PRISE EN MAIN ══════════════════════════════════════════ */}
            <section>
              <SectionHeader
                id="demarrage"
                icon={<Rocket size={24} />}
                color="#94a3b8"
                title={t('start.title')}
                subtitle={t('start.subtitle')}
              />

              <div className="space-y-6">
                <Step n={1} title={t('start.step1Title')}>
                  <RichText>{t('start.step1')}</RichText>
                </Step>
                <Step n={2} title={t('start.step2Title')}>
                  <RichText>{t('start.step2')}</RichText>
                </Step>
                <Step n={3} title={t('start.step3Title')}>
                  <RichText>{t('start.step3')}</RichText>
                </Step>
              </div>

              <Tip>
                <RichText strongClassName="font-semibold">{t('start.tip')}</RichText>
              </Tip>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { icon: <Layers size={18} />, label: t('start.cardDashboard'), desc: t('start.cardDashboardDesc') },
                  { icon: <Bell size={18} />, label: t('start.cardNotifications'), desc: t('start.cardNotificationsDesc') },
                  { icon: <Flag size={18} />, label: t('start.cardSettings'), desc: t('start.cardSettingsDesc') },
                ].map((item) => (
                  <div key={item.label} className="bg-slate-800/60 border border-white/8 rounded-xl p-4">
                    <div className="text-slate-400 mb-2">{item.icon}</div>
                    <p className="font-semibold text-white text-sm">{item.label}</p>
                    <p className="text-slate-400 text-xs mt-1">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ══ TÂCHES ═════════════════════════════════════════════════ */}
            <section>
              <SectionHeader
                id="taches"
                icon={<CheckSquare size={24} />}
                color="#3b82f6"
                title={t('tasks.title')}
                subtitle={t('tasks.subtitle')}
              />

              <div className="mb-8 rounded-2xl overflow-hidden border border-white/8 shadow-2xl">
                <TaskTableShowcase />
              </div>

              <div className="space-y-6">
                <Step n={1} title={t('tasks.step1Title')}>
                  <RichText>{t('tasks.step1')}</RichText>
                </Step>
                <Step n={2} title={t('tasks.step2Title')}>
                  <RichText>{t('tasks.step2')}</RichText>
                </Step>
                <Step n={3} title={t('tasks.step3Title')}>
                  <RichText>{t('tasks.step3')}</RichText>
                </Step>
              </div>

              <div className="mt-8 space-y-0 bg-slate-800/40 border border-white/8 rounded-2xl overflow-hidden divide-y divide-white/5">
                <FeatureRow icon={<Bookmark size={15} />}   label={t('tasks.featBookmark')}   desc={t('tasks.featBookmarkDesc')} />
                <FeatureRow icon={<Clock size={15} />}      label={t('tasks.featDuration')}   desc={t('tasks.featDurationDesc')} />
                <FeatureRow icon={<Filter size={15} />}     label={t('tasks.featFilters')}    desc={t('tasks.featFiltersDesc')} />
                <FeatureRow icon={<Users size={15} />}      label={t('tasks.featCollab')}     desc={t('tasks.featCollabDesc')} />
                <FeatureRow icon={<Flag size={15} />}       label={t('tasks.featCategories')} desc={t('tasks.featCategoriesDesc')} />
              </div>
            </section>

            {/* ══ LISTES ═════════════════════════════════════════════════ */}
            <section>
              <SectionHeader
                id="listes"
                icon={<List size={24} />}
                color="#3b82f6"
                title={t('lists.title')}
                subtitle={t('lists.subtitle')}
              />

              <div className="space-y-6">
                <Step n={1} title={t('lists.step1Title')}>
                  <RichText>{t('lists.step1')}</RichText>
                </Step>
                <Step n={2} title={t('lists.step2Title')}>
                  <RichText>{t('lists.step2')}</RichText>
                </Step>
                <Step n={3} title={t('lists.step3Title')}>
                  <RichText>{t('lists.step3')}</RichText>
                </Step>
              </div>

              <div className="mt-8 space-y-0 bg-slate-800/40 border border-white/8 rounded-2xl overflow-hidden divide-y divide-white/5">
                <FeatureRow icon={<List size={15} />}       label={t('lists.featView')}  desc={t('lists.featViewDesc')} />
                <FeatureRow icon={<Flag size={15} />}       label={t('lists.featColor')} desc={t('lists.featColorDesc')} />
                <FeatureRow icon={<Filter size={15} />}     label={t('lists.featAll')}   desc={t('lists.featAllDesc')} />
              </div>

              <Tip>
                <RichText strongClassName="font-semibold">{t('lists.tip')}</RichText>
              </Tip>
            </section>

            {/* ══ AGENDA ═════════════════════════════════════════════════ */}
            <section>
              <SectionHeader
                id="agenda"
                icon={<Calendar size={24} />}
                color="#ef4444"
                title={t('agenda.title')}
                subtitle={t('agenda.subtitle')}
              />

              <div className="mb-8 rounded-2xl overflow-hidden border border-white/8 shadow-2xl">
                <AgendaShowcase />
              </div>

              <div className="space-y-6">
                <Step n={1} title={t('agenda.step1Title')}>
                  <RichText>{t('agenda.step1')}</RichText>
                </Step>
                <Step n={2} title={t('agenda.step2Title')}>
                  <RichText>{t('agenda.step2')}</RichText>
                </Step>
                <Step n={3} title={t('agenda.step3Title')}>
                  <RichText>{t('agenda.step3')}</RichText>
                </Step>
              </div>

              <div className="mt-8 space-y-0 bg-slate-800/40 border border-white/8 rounded-2xl overflow-hidden divide-y divide-white/5">
                <FeatureRow icon={<GripVertical size={15} />} label={t('agenda.featDrag')}      desc={t('agenda.featDragDesc')} />
                <FeatureRow icon={<Repeat size={15} />}       label={t('agenda.featRecurring')} desc={t('agenda.featRecurringDesc')} />
                <FeatureRow icon={<Flag size={15} />}         label={t('agenda.featColors')}    desc={t('agenda.featColorsDesc')} />
                <FeatureRow icon={<Clock size={15} />}        label={t('agenda.featCompact')}   desc={t('agenda.featCompactDesc')} />
              </div>

              <Tip>
                {t('agenda.tip')}
              </Tip>

              <Note>
                {t('agenda.note')}
              </Note>
            </section>

            {/* ══ HABITUDES ══════════════════════════════════════════════ */}
            <section>
              <SectionHeader
                id="habitudes"
                icon={<Repeat size={24} />}
                color="#eab308"
                title={t('habits.title')}
                subtitle={t('habits.subtitle')}
              />

              <div className="mb-8 rounded-2xl overflow-hidden border border-white/8 shadow-2xl">
                <HabitHeatmapShowcase />
              </div>

              <div className="space-y-6">
                <Step n={1} title={t('habits.step1Title')}>
                  <RichText>{t('habits.step1')}</RichText>
                </Step>
                <Step n={2} title={t('habits.step2Title')}>
                  <RichText>{t('habits.step2')}</RichText>
                </Step>
                <Step n={3} title={t('habits.step3Title')}>
                  <RichText>{t('habits.step3')}</RichText>
                </Step>
              </div>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-800/40 border border-white/8 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Flame size={16} className="text-orange-400" />
                    <p className="font-semibold text-white text-sm">{t('habits.streakTitle')}</p>
                  </div>
                  <p className="text-xs text-slate-400">{t('habits.streakDesc')}</p>
                </div>
                <div className="bg-slate-800/40 border border-white/8 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={16} className="text-green-400" />
                    <p className="font-semibold text-white text-sm">{t('habits.rateTitle')}</p>
                  </div>
                  <p className="text-xs text-slate-400">{t('habits.rateDesc')}</p>
                </div>
              </div>

              <Tip>
                <RichText strongClassName="font-semibold">{t('habits.tip')}</RichText>
              </Tip>
            </section>

            {/* ══ OKR ════════════════════════════════════════════════════ */}
            <section>
              <SectionHeader
                id="okr"
                icon={<Target size={24} />}
                color="#22c55e"
                title={t('okr.title')}
                subtitle={t('okr.subtitle')}
              />

              <div className="mb-8 rounded-2xl overflow-hidden border border-white/8 shadow-2xl">
                <OKRCardShowcase />
              </div>

              <div className="mb-8 bg-slate-800/40 border border-white/8 rounded-2xl p-5">
                <p className="text-sm font-semibold text-white mb-3">{t('okr.whatIs')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-green-400 font-medium mb-1">{t('okr.objectiveLabel')}</p>
                    <p className="text-slate-400">{t('okr.objectiveDesc')} <em>{t('okr.objectiveExample')}</em></p>
                  </div>
                  <div>
                    <p className="text-blue-400 font-medium mb-1">{t('okr.krLabel')}</p>
                    <p className="text-slate-400">{t('okr.krDesc')} <em>{t('okr.krExample')}</em></p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <Step n={1} title={t('okr.step1Title')}>
                  <RichText>{t('okr.step1')}</RichText>
                </Step>
                <Step n={2} title={t('okr.step2Title')}>
                  <RichText>{t('okr.step2')}</RichText>
                </Step>
                <Step n={3} title={t('okr.step3Title')}>
                  <RichText>{t('okr.step3')}</RichText>
                </Step>
              </div>

              <div className="mt-8 space-y-0 bg-slate-800/40 border border-white/8 rounded-2xl overflow-hidden divide-y divide-white/5">
                <FeatureRow icon={<TrendingUp size={15} />} label={t('okr.featHealth')}     desc={t('okr.featHealthDesc')} />
                <FeatureRow icon={<Clock size={15} />}      label={t('okr.featDaysLeft')}  desc={t('okr.featDaysLeftDesc')} />
                <FeatureRow icon={<Flag size={15} />}       label={t('okr.featCategories')} desc={t('okr.featCategoriesDesc')} />
              </div>

              <Tip>
                <RichText strongClassName="font-semibold">{t('okr.tip')}</RichText>
              </Tip>
            </section>

            {/* ══ STATISTIQUES ═══════════════════════════════════════════ */}
            <section>
              <SectionHeader
                id="statistiques"
                icon={<BarChart2 size={24} />}
                color="#8b5cf6"
                title={t('stats.title')}
                subtitle={t('stats.subtitle')}
              />

              <div className="mb-8 rounded-2xl overflow-hidden border border-white/8 shadow-2xl">
                <Suspense fallback={<StatsShowcaseFallback />}>
                  <StatsShowcase />
                </Suspense>
              </div>

              <div className="space-y-6">
                <Step n={1} title={t('stats.step1Title')}>
                  <RichText>{t('stats.step1')}</RichText>
                </Step>
                <Step n={2} title={t('stats.step2Title')}>
                  <RichText>{t('stats.step2')}</RichText>
                </Step>
                <Step n={3} title={t('stats.step3Title')}>
                  <RichText>{t('stats.step3')}</RichText>
                </Step>
              </div>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { color: '#3b82f6', label: t('stats.legendTasks'),  desc: t('stats.legendTasksDesc') },
                  { color: '#ef4444', label: t('stats.legendAgenda'), desc: t('stats.legendAgendaDesc') },
                  { color: '#22c55e', label: t('stats.legendOkr'),    desc: t('stats.legendOkrDesc') },
                  { color: '#eab308', label: t('stats.legendHabits'), desc: t('stats.legendHabitsDesc') },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3 bg-slate-800/40 border border-white/8 rounded-xl p-4">
                    <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: item.color }} />
                    <div>
                      <p className="text-sm font-semibold text-white">{item.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Note>
                {t('stats.note')}
              </Note>
            </section>

            {/* ══ PREMIUM ════════════════════════════════════════════════ */}
            <section>
              <SectionHeader
                id="premium"
                icon={<Star size={24} />}
                color="#eab308"
                title={t('premium.title')}
                subtitle={t('premium.subtitle')}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {[
                  {
                    icon: <PlayCircle size={18} />,
                    label: t('premium.cardAd'),
                    desc: t('premium.cardAdDesc'),
                    highlight: true,
                  },
                  {
                    icon: <Users size={18} />,
                    label: t('premium.cardCollab'),
                    desc: t('premium.cardCollabDesc'),
                    highlight: false,
                  },
                  {
                    icon: <Star size={18} />,
                    label: t('premium.cardSupport'),
                    desc: t('premium.cardSupportDesc'),
                    highlight: false,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-start gap-3 rounded-xl p-4 border"
                    style={{
                      backgroundColor: item.highlight ? 'rgba(234,179,8,0.08)' : 'rgba(30,41,59,0.4)',
                      borderColor: item.highlight ? 'rgba(234,179,8,0.25)' : 'rgba(255,255,255,0.06)',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: item.highlight ? 'rgba(234,179,8,0.15)' : 'rgba(234,179,8,0.08)',
                        color: '#eab308',
                      }}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-6">
                <Step n={1} title={t('premium.step1Title')}>
                  <RichText>{t('premium.step1')}</RichText>
                </Step>
                <Step n={2} title={t('premium.step2Title')}>
                  <RichText>{t('premium.step2')}</RichText>
                </Step>
                <Step n={3} title={t('premium.step3Title')}>
                  <RichText>{t('premium.step3')}</RichText>
                </Step>
              </div>
            </section>

            {/* ── Footer guide ── */}
            <div className="border-t border-white/10 pt-10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-slate-500 text-sm">{t('chrome.contact')} <a href="mailto:axellongattepro@gmail.com" className="text-blue-400 hover:underline">axellongattepro@gmail.com</a></p>
              <Link
                to="/"
                className="flex items-center gap-2 bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))] text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
              >
                {t('chrome.cta')}
                <ArrowRight size={15} />
              </Link>
            </div>

          </main>
        </div>
      </div>
    </div>
  );
};

export default GuidePage;

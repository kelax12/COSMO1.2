import React, { useState, useRef, useLayoutEffect } from 'react';
import { Flame, CheckCircle, Circle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useHabits, useToggleHabitCompletion } from '@/modules/habits';
import { useT } from '@/i18n/useT';
import { habitStreak } from '@/modules/habits/streak';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/i18n/format';

const colorOptions = [
{ value: 'blue', color: '#3B82F6' },
{ value: 'green', color: '#10B981' },
{ value: 'purple', color: '#8B5CF6' },
{ value: 'orange', color: '#F97316' },
{ value: 'red', color: '#EF4444' },
{ value: 'pink', color: '#EC4899' }];


type PeriodType = 'week' | 'month' | '3months' | 'all';

const HabitTable: React.FC = () => {
  const { t } = useT('habits');
  const { data: habits = [] } = useHabits();
  const toggleMutation = useToggleHabitCompletion();
  const [period, setPeriod] = useState<PeriodType>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Colonnes de jour ÉLASTIQUES, puis cadrage sur aujourd'hui.
  //
  // ⚠️ LE PROBLÈME N'A JAMAIS ÉTÉ LE SCROLL-SNAP (audit UI §3). Il est
  // ARITHMÉTIQUE : la largeur disponible (334 px − 143 de colonne collante
  // = 191 px) n'est pas un multiple de la largeur de colonne (52 px), soit
  // 3,67 colonnes. Il restait donc TOUJOURS une colonne coupée, quelle que
  // soit la position de scroll — mesuré : « dim. 9 » visible sur 30 px de 52.
  // Le correctif de juillet a ajouté `snap-x` par-dessus ; il ne pouvait pas
  // marcher, parce qu'aucune position ne satisfaisait la contrainte.
  //
  // On calcule donc une largeur telle qu'un nombre ENTIER de colonnes tienne :
  //   n        = round(disponible / largeurIdéale)   (au moins 1)
  //   largeur  = disponible / n                      (fractionnaire, c'est OK)
  //
  // La propriété qui rend le cadrage correct : `scrollMax = total − disponible
  // = (jours − n) × largeur`, donc un MULTIPLE de la largeur de colonne. Se
  // caler au maximum tombe alors exactement sur une frontière.
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const applyElasticWidth = () => {
      // La zone réellement occupée par les jours, c'est la largeur visible
      // MOINS la colonne collante (à gauche) et MOINS la colonne « série » (à
      // droite). Oublier la seconde décalait le calcul de sa largeur exacte et
      // laissait une colonne coupée malgré une arithmétique par ailleurs juste.
      const sticky = container.querySelector<HTMLElement>('[data-sticky-col]');
      const streak = container.querySelector<HTMLElement>('[data-streak-col]');
      const stickyWidth = sticky ? sticky.getBoundingClientRect().width : 0;
      const streakWidth = streak ? streak.getBoundingClientRect().width : 0;
      const available = container.clientWidth - stickyWidth - streakWidth;
      if (available <= 0) return;

      // ⚠️ On ÉLARGIT, on ne rétrécit jamais. Le contenu d'une cellule
      // (« jeu. » + le quantième + padding) impose une largeur plancher que
      // l'algorithme de table respecte quoi qu'on écrive : demander moins que
      // ce minimum est ignoré en silence, et la colonne repart en morceau.
      // On mesure donc la largeur NATURELLE, puis on prend le plus grand
      // nombre de colonnes qui tient, et on répartit le reste entre elles.
      const first = container.querySelector<HTMLElement>('[data-day-cell]');
      if (!first) return;
      container.style.removeProperty('--habit-day-col');
      const natural = first.getBoundingClientRect().width;
      if (natural <= 0) return;

      const columns = Math.max(1, Math.floor(available / natural));
      container.style.setProperty('--habit-day-col', `${available / columns}px`);

      // Cadrage sur aujourd'hui (dernière colonne), PUIS alignement.
      //
      // ⚠️ L'arithmétique a priori ne suffit pas : appliquer la largeur fait
      // re-répartir la table (`w-full`), donc les mesures prises AVANT ne
      // valent plus APRÈS. On se cale donc sur une frontière RÉELLE, mesurée
      // une fois la nouvelle largeur en place.
      container.scrollLeft = container.scrollWidth - container.clientWidth;

      const maxScroll = container.scrollWidth - container.clientWidth;
      const containerLeft = container.getBoundingClientRect().left;
      const cells = Array.from(container.querySelectorAll<HTMLElement>('[data-day-cell]'));

      // ⚠️ Position mesurée, PAS `offsetLeft` : celui-ci est relatif à
      // l'`offsetParent`, qui n'est pas forcément ce conteneur. Le calcul
      // paraissait juste et retombait systématiquement sur le maximum.
      //
      // Offsets de scroll qui posent une colonne JUSTE APRÈS la colonne
      // collante. On prend le plus grand qui ne dépasse pas le maximum : la
      // colonne de gauche est alors entière, et on recule d'au plus une
      // largeur de colonne par rapport à aujourd'hui.
      const aligned = cells
        .map((cell) => {
          const inContent = cell.getBoundingClientRect().left - containerLeft + container.scrollLeft;
          return Math.round(inContent - stickyWidth);
        })
        .filter((offset) => offset >= 0 && offset <= maxScroll);
      if (aligned.length > 0) {
        container.scrollLeft = Math.max(...aligned);
      }
    };

    applyElasticWidth();

    // Pas de `ResizeObserver` ici, et c'est un choix APRÈS ESSAI.
    //
    // `applyElasticWidth` modifie la largeur des colonnes, donc l'observateur
    // se rappelle lui-même. Deux gardes ont été essayées et mesurées :
    // comparer `clientWidth` (trop restrictif : plus aucun recalcul quand
    // c'est le CONTENU qui change) puis un drapeau de ré-entrance (le cadrage
    // se perdait au redimensionnement, toutes les colonnes finissaient
    // masquées). Aucune des deux n'était déterministe.
    //
    // Le recalcul est donc déclenché par les dépendances de cet effet, qui
    // couvrent les cas réels : montage, changement de période, changement du
    // jeu d'habitudes. Un redimensionnement de fenêtre reste possible sans
    // recalcul immédiat — c'est le compromis assumé, et il se corrige au
    // prochain rendu. Mieux vaut un cadrage juste dans 99 % des cas qu'un
    // observateur qui se bat contre lui-même.
  }, [period, habits]);

  const parseLocalDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const periodOptions = [
  { value: 'week' as PeriodType, label: 'Semaine', days: 7 },
  { value: 'month' as PeriodType, label: 'Mois', days: 30 },
  { value: 'all' as PeriodType, label: 'Tout', days: 0 }];


  const getOldestHabitDate = () => {
    if (habits.length === 0) return new Date();

    let oldestDate = new Date();
    oldestDate.setHours(0, 0, 0, 0);

    habits.forEach((habit) => {
      // Prendre en compte la date de création si elle existe
      if (habit.createdAt) {
        const createdDate = new Date(habit.createdAt);
        createdDate.setHours(0, 0, 0, 0);
        if (createdDate < oldestDate) {
          oldestDate = createdDate;
        }
      }

      // ⚠️ `firstCompletionDate` D'ABORD : depuis la mig. 119, `completions` est
      // borné à une fenêtre glissante en mode Supabase. Remonter par ses clés
      // ferait démarrer la période « Tout » à la fenêtre au lieu du vrai début.
      // Le champ est calculé serveur sur l'historique entier. Le repli couvre
      // la démo et le repository local, qui ont toute la donnée.
      if (habit.firstCompletionDate) {
        const firstDate = parseLocalDate(habit.firstCompletionDate);
        firstDate.setHours(0, 0, 0, 0);
        if (firstDate < oldestDate) {
          oldestDate = firstDate;
        }
      } else {
        const completionDates = Object.keys(habit.completions);
        if (completionDates.length > 0) {
          const habitOldestDate = new Date(Math.min(...completionDates.map((date) => parseLocalDate(date).getTime())));
          habitOldestDate.setHours(0, 0, 0, 0);
          if (habitOldestDate < oldestDate) {
            oldestDate = habitOldestDate;
          }
        }
      }
    });

    // S'assurer qu'on montre au moins les 7 derniers jours même si c'est nouveau
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    if (oldestDate > sevenDaysAgo) {
      return sevenDaysAgo;
    }

    return oldestDate;
  };

  const generateDays = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = [];

    let startDate: Date;
    let dayCount: number;

    if (period === 'all') {
      startDate = getOldestHabitDate();
      startDate.setHours(0, 0, 0, 0);
      // S'assurer que le dernier jour est aujourd'hui
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);
      dayCount = Math.max(1, Math.ceil((todayEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    } else {
      const selectedPeriod = periodOptions.find((p) => p.value === period);
      dayCount = selectedPeriod?.days || 7;

      // Pour toutes les périodes, le dernier jour visible est la date actuelle
      startDate = new Date(currentDate);
      startDate.setHours(0, 0, 0, 0);
      startDate.setDate(currentDate.getDate() - dayCount + 1);
    }

    for (let i = 0; i < dayCount; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      date.setHours(0, 0, 0, 0);

      days.push({
        date: date.toLocaleDateString('en-CA'),
        dayName: formatDate(date, { weekday: 'short' }),
        dayNumber: date.getDate(),
        monthName: formatDate(date, { month: 'short' }),
        isToday: date.toDateString() === today.toDateString(),
        isPast: date < today,
        isFuture: date > today
      });
    }

    return days;
  };

  const days = generateDays();

  const handleDayClick = (habitId: string, date: string) => {
    toggleMutation.mutate({ id: habitId, date });
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);

    switch (period) {
      case 'week':{
          newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
          break;
        }
      case 'month':{
          newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
          break;
        }
      case '3months':{
          newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 3 : -3));
          break;
        }
      default:
        return;
    }

    setCurrentDate(newDate);
  };

  const canNavigateNext = () => {
    if (period === 'all') return false;
    const today = new Date();
    const nextPeriodStart = new Date(currentDate);

    switch (period) {
      case 'week':
        nextPeriodStart.setDate(currentDate.getDate() + 7);
        break;
      case 'month':
        nextPeriodStart.setMonth(currentDate.getMonth() + 1);
        break;
      case '3months':
        nextPeriodStart.setMonth(currentDate.getMonth() + 3);
        break;
    }

    return nextPeriodStart <= today;
  };

  const getCurrentPeriodLabel = () => {
    switch (period) {
      case 'week':
        return t('table.weekOf', { date: formatDate(currentDate, { day: 'numeric', month: 'short' }) });
      case 'month':
        return formatDate(currentDate, { month: 'long', year: 'numeric' });
      case '3months': {
        const endDate = new Date(currentDate);
        endDate.setMonth(currentDate.getMonth() + 2);
        return `${formatDate(currentDate, { month: 'short', year: 'numeric' })} - ${formatDate(endDate, { month: 'short', year: 'numeric' })}`;
      }
      case 'all':
        return t('table.sinceCreation');
      default:
        return '';
    }
  };

  return (
    <>
      <div className="card overflow-hidden">
      <div className="p-4 md:p-6 border-b transition-colors" style={{
          backgroundColor: 'rgb(var(--color-hover))',
          borderColor: 'rgb(var(--color-border))'
        }}>
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h2 className="text-lg md:text-xl font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>{t('table.title')}</h2>
            <p className="text-xs md:text-sm mt-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>{t('table.subtitle')}</p>
          </div>
          
            {/* Navigation */}
            {period !== 'all' &&
            <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigatePeriod('prev')}
                  aria-label={t('table.prevPeriod')}
                  className="min-w-touch min-h-touch md:min-w-0 md:min-h-0 border md:border-0"
                  style={{
                    color: 'rgb(var(--color-text-secondary))',
                    borderColor: 'rgb(var(--color-border))'
                  }}
                >
                  <ChevronLeft size={18} />
                </Button>
                <div className="text-xs md:text-sm font-medium min-w-[100px] md:min-w-[120px] text-center" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  {getCurrentPeriodLabel()}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigatePeriod('next')}
                  disabled={!canNavigateNext()}
                  aria-label={t('table.nextPeriod')}
                  className="min-w-touch min-h-touch md:min-w-0 md:min-h-0 border md:border-0"
                  style={{
                    color: canNavigateNext() ? 'rgb(var(--color-text-secondary))' : 'rgb(var(--color-text-muted))',
                    borderColor: 'rgb(var(--color-border))'
                  }}
                >
                  <ChevronRight size={18} />
                </Button>
              </div>
            }

            {/* Sélecteur de période — desktop uniquement (mobile : la période reste fixée par défaut, cf. décision produit) */}
            <div className="hidden md:flex items-center rounded-lg p-1 shadow-sm border transition-colors w-full md:w-auto" style={{
              backgroundColor: 'rgb(var(--color-surface))',
              borderColor: 'rgb(var(--color-border))'
            }}>
              {periodOptions.map((option) =>
              <button
                key={option.value}
                onClick={() => {
                  setPeriod(option.value);
                  if (option.value !== 'all') {
                    setCurrentDate(new Date());
                  }
                }}
                className="flex-1 md:flex-none px-2 md:px-3 min-h-touch md:min-h-0 md:py-2 rounded-md text-xs md:text-sm font-medium transition-all"
                style={{
                  backgroundColor: period === option.value ? '#2563EB' : 'transparent',
                  color: period === option.value ? 'white' : 'rgb(var(--color-text-secondary))',
                  boxShadow: period === option.value ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none'
                }}
              >

                  {option.label}
                </button>
              )}
            </div>
        </div>
      </div>
      
      {/* snap-x : après un scroll tactile, la vue s'aligne sur une frontière de
          colonne de jour (scroll-pl = largeur de la colonne sticky) — évite les
          colonnes coupées en deux (audit UI §4). proximity et non mandatory :
          l'auto-scroll initial vers aujourd'hui + série reste possible. */}
      <div className="overflow-x-auto hide-scrollbar snap-x snap-proximity scroll-pl-[140px] md:scroll-pl-[250px]" ref={scrollContainerRef}>
        <table className="w-full border-collapse">
          <thead className="border-b transition-colors" style={{
              backgroundColor: 'rgb(var(--table-header-bg))',
              borderColor: 'rgb(var(--table-border))'
            }}>
            <tr>
                <th data-sticky-col className="text-left p-3 md:p-4 font-semibold sticky left-0 z-20 min-w-[140px] md:min-w-[250px] border-r transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" style={{
                    color: 'rgb(var(--table-header-text))',
                    backgroundColor: 'rgb(var(--table-header-bg))',
                    borderColor: 'rgb(var(--table-border))'
                  }}>
                  Habitude
                </th>
                  {/* Largeur ELASTIQUE (`w-auto` + `min-w`) et non fixe.
                      L'ancienne largeur de 40 px ne divisait pas la place
                      disponible (334 - 143 de colonne collante = 191 px, soit
                      3,67 colonnes) : il restait toujours une colonne coupee,
                      et le scroll-snap n'y pouvait rien. */}
                  {days.map((day) =>
                  <th key={day.date} data-day-cell className="text-center p-2 font-medium snap-start transition-colors" style={{ color: 'rgb(var(--table-header-text))', width: 'var(--habit-day-col, 44px)', minWidth: 'var(--habit-day-col, 44px)' }}>
                    <div className="text-caption md:text-xs mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>{day.dayName}</div>
                    <div className={`text-xs md:text-sm ${day.isToday ? 'font-bold' : ''}`} style={{
                      color: day.isToday ? 'rgb(var(--color-accent))' : 'rgb(var(--table-header-text))'
                    }}>
                      {day.dayNumber}
                    </div>
                    {(period === 'month' || period === 'all') &&
                      <div className="text-caption md:text-xs opacity-70" style={{ color: 'rgb(var(--color-text-muted))' }}>{day.monthName}</div>
                    }
                  </th>
                  )}
                  <th data-streak-col className="text-center p-3 md:p-4 font-semibold min-w-[60px] md:min-w-[80px] transition-colors border-l" style={{ 
                    color: 'rgb(var(--table-header-text))',
                    borderColor: 'rgb(var(--table-border))'
                  }}>
                    <Flame size={16} className="mx-auto md:hidden" />
                    <span className="hidden md:inline">{t('table.streak')}</span>
                  </th>
              </tr>
            </thead>
          <tbody>
            {habits.map((habit, index) => {
              // Série de jours consécutifs (parité vue Liste).
              const streak = habitStreak(habit);
              return (
              <tr key={habit.id} className="border-b transition-colors" style={{
                borderColor: 'rgb(var(--table-border))',
                backgroundColor: index % 2 === 0 ? 'rgb(var(--table-row-even))' : 'rgb(var(--table-row-odd))'
              }}>

                  <td className="p-2 md:p-4 sticky left-0 bg-inherit z-10 border-r transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" style={{ borderColor: 'rgb(var(--table-border))' }}>
                    <div className="flex items-center gap-1.5 md:gap-3">
                      <div
                        className="w-2 h-2 md:w-3 md:h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: habit.color.startsWith('#') ? habit.color : (colorOptions.find((c) => c.value === habit.color)?.color ?? '#3B82F6') }} />

                      <div className="min-w-0">
                        <div className="font-medium truncate text-caption md:text-sm leading-tight" style={{ color: 'rgb(var(--color-text-primary))' }}>{habit.name}</div>
                        <div className="hidden md:flex text-xs items-center gap-2 mt-0.5" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                          <span>{habit.estimatedTime} min</span>
                        </div>
                      </div>
                    </div>
                  </td>
                    {days.map((day) => {
                    const isCompleted = habit.completions[day.date];

                    return (
                      <td key={day.date} className="p-1 md:p-2 text-center transition-colors">
                            <button
                          type="button"
                          role="checkbox"
                          aria-checked={!!isCompleted}
                          aria-label={isCompleted ? t('table.dayCellDone', { name: habit.name, date: day.date }) : t('table.dayCell', { name: habit.name, date: day.date })}
                          onClick={() => handleDayClick(habit.id, day.date)}
                          disabled={day.isFuture}
                          className="w-11 h-11 md:w-8 md:h-8 rounded-lg border-1.5 md:border-2 transition-all flex items-center justify-center mx-auto"
                          style={{
                            backgroundColor: isCompleted ? '#2563EB' : day.isFuture ? 'transparent' : day.isToday ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
                            borderColor: isCompleted ? '#2563EB' : day.isToday ? '#2563EB' : day.isFuture ? 'transparent' : 'rgb(var(--color-border))',
                            color: isCompleted ? 'white' : day.isFuture ? 'rgb(var(--color-text-muted) / 0.2)' : 'rgb(var(--color-text-secondary))',
                            cursor: day.isFuture ? 'not-allowed' : 'pointer',
                            opacity: 1
                          }}>

                              {isCompleted ?
                          <CheckCircle size={14} /> :
                          day.isFuture ?
                          <Circle size={12} className="opacity-10" /> :

                          <Circle size={14} className="opacity-30 hover:opacity-100" />
                            }
                              </button>
                            </td>);


                    })}
                    <td className="p-3 md:p-4 text-center transition-colors border-l" style={{ borderColor: 'rgb(var(--table-border))' }}>
                      <div className="flex items-center justify-center gap-1">
                        <Flame size={14} className="text-orange-500 md:w-4 md:h-4" />
                        <span className="font-semibold text-xs md:text-sm" style={{ color: 'rgb(var(--color-text-primary))' }}>{streak}</span>
                      </div>
                    </td>
                </tr>
                );
                })}
            </tbody>
          </table>
          </div>
        </div>

    </>
  );
};

export default HabitTable;


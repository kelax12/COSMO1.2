// ═══════════════════════════════════════════════════════════════════
// Quel jour, et sous quelle forme, le calendrier MOBILE affiche
//
// FRONTIÈRE : ce hook ne sait rien des événements, des tâches, ni d'aucune
// mutation. Il porte une date, un mode de vue, et la clé de remontage qui
// force FullCalendar à se reconstruire quand la vue change — trois valeurs
// qui ne parlaient qu'entre elles au milieu de la page.
//
// ⚠️ `handleMobileDateSelect` délègue au comportement DESKTOP (`onDateSelect`)
// dès qu'on n'est pas en vue Mois : en vue Mois, un clic sur un jour bascule
// en vue Jour au lieu d'ouvrir la carte de création rapide. C'est la seule
// règle métier d'affichage de ce fichier, et elle est ici parce qu'elle
// dépend du mode de vue, que rien d'autre ne connaît.
//
// Extrait le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import { useRef, useState } from 'react';
import type FullCalendar from '@fullcalendar/react';
import type { DateSelectArg, DatesSetArg } from '@fullcalendar/core';
import type { MobileView } from './MobileAgenda';

interface Params {
  /** Comportement de sélection hors vue Mois (carte de création rapide). */
  onDateSelect: (selectInfo: DateSelectArg) => void;
  /** Recalage de la fenêtre d'événements chargée quand la plage visible bouge. */
  applyVisibleRange: (rangeStart: Date, rangeEnd: Date) => void;
}

export function useAgendaMobileView({ onDateSelect, applyVisibleRange }: Params) {
  const mobileCalendarRef = useRef<FullCalendar>(null);
  const [mobileSelectedDate, setMobileSelectedDate] = useState<Date>(() => new Date());
  const [mobileCalendarKey, setMobileCalendarKey] = useState(0);
  const [mobileViewMode, setMobileViewMode] = useState<MobileView>('timeGridDay');

  const handleMobileSetView = (view: MobileView) => {
    setMobileViewMode(view);
    mobileCalendarRef.current?.getApi().changeView(view);
    setMobileCalendarKey((prev) => prev + 1);
  };

  const handleMobileSelectDate = (date: Date) => {
    setMobileSelectedDate(date);
    const api = mobileCalendarRef.current?.getApi();
    if (!api) return;
    if (mobileViewMode !== 'timeGridDay' && mobileViewMode !== 'timeGrid2Day') {
      handleMobileSetView('timeGridDay');
    }
    api.gotoDate(date);
  };

  // Vue Mois : un clic sur un jour bascule en vue Jour sur cette date, au lieu
  // d'ouvrir la carte de création rapide (comportement `onDateSelect`).
  const handleMobileDateSelect = (selectInfo: DateSelectArg) => {
    if (mobileViewMode === 'dayGridMonth') {
      mobileCalendarRef.current?.getApi().unselect();
      handleMobileSelectDate(selectInfo.start);
      return;
    }
    onDateSelect(selectInfo);
  };

  const handleMobileMonthPrev = () => { mobileCalendarRef.current?.getApi().prev(); };
  const handleMobileMonthNext = () => { mobileCalendarRef.current?.getApi().next(); };

  const handleMobileDatesSet = (info: DatesSetArg) => {
    setMobileSelectedDate(info.view.currentStart);
    applyVisibleRange(info.start, info.end);
  };

  return {
    mobileCalendarRef,
    mobileSelectedDate,
    mobileCalendarKey,
    setMobileCalendarKey,
    mobileViewMode,
    handleMobileSetView,
    handleMobileSelectDate,
    handleMobileDateSelect,
    handleMobileMonthPrev,
    handleMobileMonthNext,
    handleMobileDatesSet,
  };
}

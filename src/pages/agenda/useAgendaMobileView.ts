// ═══════════════════════════════════════════════════════════════════
// Quel jour, et sous quelle forme, le calendrier MOBILE affiche
//
// FRONTIÈRE : ce hook ne sait rien des événements, des tâches, ni d'aucune
// mutation. Il porte une date, un mode de vue, et la clé de remontage qui
// force FullCalendar à se reconstruire quand la vue change — trois valeurs
// qui ne parlaient qu'entre elles au milieu de la page.
//
// ⚠️ En vue Mois, un tap sur un jour bascule en vue Jour au lieu d'ouvrir la
// carte de création rapide. C'est la seule règle métier d'affichage de ce
// fichier, et elle est ici parce qu'elle dépend du mode de vue, que rien
// d'autre ne connaît.
//
// 🔴 Cette bascule DOIT écouter `dateClick`, pas seulement `select`.
// `selectLongPressDelay={250}` impose un appui MAINTENU de 250 ms pour qu'un
// doigt produise un `select` : au tap court — le seul geste qu'un utilisateur
// fait sur une case de mois — `select` ne part jamais et rien ne se passait.
// À la souris les deux partent, ce qui rendait le défaut invisible sur un
// navigateur de bureau, même en largeur mobile, tant que l'émulation tactile
// n'était pas active. Les deux chemins convergent vers `enterDayView`.
//
// Extrait le 2026-09-05 (C-09). `dateClick` + animation de bascule : 2026-09-19.
// ═══════════════════════════════════════════════════════════════════
import { useRef, useState } from 'react';
import type FullCalendar from '@fullcalendar/react';
import type { DateSelectArg, DatesSetArg } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';
import type { MobileView } from './MobileAgenda';

interface Params {
  /** Comportement de sélection hors vue Mois (carte de création rapide). */
  onDateSelect: (selectInfo: DateSelectArg) => void;
  /** Recalage de la fenêtre d'événements chargée quand la plage visible bouge. */
  applyVisibleRange: (rangeStart: Date, rangeEnd: Date) => void;
}

/**
 * Ordre de zoom envoyé à la surface calendrier quand on bascule Mois → Jour.
 *
 * `token` change à chaque bascule (c'est lui qui REJOUE l'animation, une date
 * identique deux fois de suite devant quand même s'animer). `x`/`y` sont les
 * coordonnées VIEWPORT du doigt : la surface les convertit en origine de
 * transformation dans son propre repère, parce qu'elle seule connaît son DOM.
 */
export interface MobileZoomOrder {
  token: number;
  x: number;
  y: number;
}

export function useAgendaMobileView({ onDateSelect, applyVisibleRange }: Params) {
  const mobileCalendarRef = useRef<FullCalendar>(null);
  const [mobileSelectedDate, setMobileSelectedDate] = useState<Date>(() => new Date());
  const [mobileCalendarKey, setMobileCalendarKey] = useState(0);
  const [mobileViewMode, setMobileViewMode] = useState<MobileView>('timeGridDay');
  const [mobileZoom, setMobileZoom] = useState<MobileZoomOrder | null>(null);

  // Miroir SYNCHRONE de `mobileViewMode`. À la souris, `select` ET `dateClick`
  // partent tous les deux sur le même clic ; `mobileViewMode` n'est pas encore
  // à jour dans le second appel (setState est asynchrone), donc la bascule
  // serait demandée deux fois et l'animation repartirait de zéro au milieu.
  const viewModeRef = useRef<MobileView>('timeGridDay');

  const applyViewMode = (view: MobileView) => {
    viewModeRef.current = view;
    setMobileViewMode(view);
  };

  const handleMobileSetView = (view: MobileView) => {
    applyViewMode(view);
    mobileCalendarRef.current?.getApi().changeView(view);
    setMobileCalendarKey((prev) => prev + 1);
  };

  const handleMobileSelectDate = (date: Date) => {
    setMobileSelectedDate(date);
    const api = mobileCalendarRef.current?.getApi();
    if (!api) return;
    // 🔴 Ne PAS passer par `handleMobileSetView` ici : son `setMobileCalendarKey`
    // force un REMONTAGE complet de `<FullCalendar key={mobileKey}>` — le
    // `api.gotoDate(date)` juste en dessous s'exécute alors sur la référence
    // de l'instance qui va être démontée (React n'a pas encore ré-attaché la
    // ref à la nouvelle instance dans ce même appel synchrone), une course
    // qui laissait parfois la vue Jour s'ouvrir sans se caler sur le jour
    // cliqué en vue Mois. `api.changeView` change la vue SANS démonter —
    // seul `mobileViewMode` (état d'affichage du sélecteur) est mis à jour.
    if (viewModeRef.current !== 'timeGridDay' && viewModeRef.current !== 'timeGrid2Day') {
      api.changeView('timeGridDay');
      applyViewMode('timeGridDay');
    }
    api.gotoDate(date);
  };

  /**
   * Bascule Mois → Jour sur la date touchée, avec l'ordre de zoom qui va avec.
   * Point de convergence de `dateClick` (tap) et de `select` (appui maintenu) :
   * le premier des deux à passer fait la bascule, le second retombe sur le
   * garde-fou de `viewModeRef` et ne fait rien.
   */
  const enterDayView = (date: Date, jsEvent: UIEvent | MouseEvent | null) => {
    if (viewModeRef.current !== 'dayGridMonth') return;
    const point = pointerOf(jsEvent);
    setMobileZoom({ token: Date.now(), x: point.x, y: point.y });
    mobileCalendarRef.current?.getApi().unselect();
    handleMobileSelectDate(date);
  };

  // Vue Mois : un tap sur un jour bascule en vue Jour sur cette date, au lieu
  // d'ouvrir la carte de création rapide (comportement `onDateSelect`).
  const handleMobileDateClick = (info: DateClickArg) => {
    if (viewModeRef.current !== 'dayGridMonth') return;
    enterDayView(info.date, info.jsEvent);
  };

  const handleMobileDateSelect = (selectInfo: DateSelectArg) => {
    if (viewModeRef.current === 'dayGridMonth') {
      enterDayView(selectInfo.start, selectInfo.jsEvent);
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
    mobileZoom,
    handleMobileSetView,
    handleMobileSelectDate,
    handleMobileDateClick,
    handleMobileDateSelect,
    handleMobileMonthPrev,
    handleMobileMonthNext,
    handleMobileDatesSet,
  };
}

/**
 * Point de contact de l'événement d'origine, en coordonnées viewport.
 *
 * Un tap au doigt arrive en `TouchEvent` : `clientX` n'y est PAS sur
 * l'événement mais sur chaque `Touch`, et la liste `touches` est déjà vide au
 * `touchend`, d'où `changedTouches`. Sans point exploitable (clavier), on
 * retourne `-1, -1` : la surface retombe alors sur un zoom centré.
 */
function pointerOf(jsEvent: UIEvent | MouseEvent | null): { x: number; y: number } {
  const touch = (jsEvent as TouchEvent | null)?.changedTouches?.[0];
  if (touch) return { x: touch.clientX, y: touch.clientY };
  const mouse = jsEvent as MouseEvent | null;
  if (mouse && typeof mouse.clientX === 'number' && (mouse.clientX !== 0 || mouse.clientY !== 0)) {
    return { x: mouse.clientX, y: mouse.clientY };
  }
  return { x: -1, y: -1 };
}

// ═══════════════════════════════════════════════════════════════════
// La SURFACE calendrier de l'agenda
//
// FRONTIÈRE : ce fichier est le seul de la page à connaître FullCalendar.
// Il reçoit des événements et des rappels ; il ne connaît ni les mutations,
// ni les modales, ni le panneau des tâches, ni la revue des créneaux. À
// l'inverse, `AgendaPage` n'a plus à connaître un seul nom de prop de
// FullCalendar.
//
// Ce qui vit ici et nulle part ailleurs :
//   • le décalage d'AFFICHAGE du fuseau choisi (`shiftEventsForDisplay`) —
//     le reste de la page raisonne sur les instants « vrais », et les
//     rappels retirent le décalage à la frontière ;
//   • la détection des conflits d'horaire, qui n'existe que pour peindre
//     un liseré ;
//   • l'avatar de l'auteur d'un événement créé par quelqu'un d'autre.
//
// ⚠️ Les deux calendriers coexistent dans le DOM : le desktop est masqué en
// CSS sur mobile, pas démonté. C'est pourquoi `AGENDA_CALENDAR_ID` n'est
// porté que par l'un des deux (deux `id` identiques rendraient le lien
// d'évitement indéterminé).
//
// Extrait le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import React from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { DateClickArg, EventReceiveArg, EventResizeDoneArg } from '@fullcalendar/interaction';
import { DateSelectArg, EventClickArg, EventDropArg, DatesSetArg, EventInput, EventApi } from '@fullcalendar/core';
// Données de locale FullCalendar. SANS elles, une locale non enregistrée
// retombe sur les défauts anglais pour `firstDay` : l'agenda français
// commençait la semaine le DIMANCHE. (Le bug pré-existait — `locale="fr"` sans
// ces données ne valait pas mieux.)
//
// `locales-all` (3,3 kB, dans le chunk lazy `vendor-calendar`) plutôt qu'un
// import par langue : importer `locales/fr` + `locales/en` + `locales/es`
// obligerait à éditer ce fichier à chaque nouvelle langue — exactement ce que
// le reste du socle i18n évite. Ici, toute langue future fonctionne sans code.
import allCalendarLocales from '@fullcalendar/core/locales-all';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { format } from 'date-fns';
import { CheckSquare, Check } from 'lucide-react';
import MemberAvatar from '@/components/organization/MemberAvatar';
import { getDateLocale, getIntlTag } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { useOrgMembers, useActiveOrganization } from '@/modules/organizations';
import { useAuth } from '@/modules/auth/AuthContext';
import { getInitialScrollTime, shiftEventsForDisplay, type FullCalendarEvent } from './calendar-events';
import { useTimezonePref, displayNow } from '@/lib/timezone';
import { type MobileView, mobileCalendarStyles, MobileDayStrip } from './MobileAgenda';
import type { MobileZoomOrder } from './useAgendaMobileView';

/**
 * Cible du lien d'évitement du panneau des tâches. Portée par le conteneur du
 * calendrier DESKTOP uniquement.
 */
export const AGENDA_CALENDAR_ID = 'agenda-calendar';

/** Même forme que dans `useAgendaEventDrag` : FullCalendar n'exporte pas ce type. */
type EventDragArg = { event: EventApi; el?: HTMLElement; jsEvent?: UIEvent | null };

interface AgendaCalendarSectionProps {
  /**
   * Événements DÉJÀ mis en forme pour FullCalendar (récurrences dépliées).
   * La page les calcule parce que le flux d'édition en a besoin aussi : les
   * recalculer ici ferait deux fois le même dépliage à chaque rendu.
   */
  calendarEvents: FullCalendarEvent[];
  isMobile: boolean;
  /** Remonte une nouvelle clé pour forcer FullCalendar à se reconstruire. */
  desktopKey: number;
  mobileKey: number;
  desktopRef: React.RefObject<FullCalendar>;
  mobileRef: React.RefObject<FullCalendar>;
  currentView: string;
  mobileViewMode: MobileView;
  mobileSelectedDate: Date;
  onMobileSelectDate: (date: Date) => void;
  /**
   * Ordre de zoom Mois → Jour. Change à chaque bascule ; porte le point touché
   * en coordonnées viewport, que ce composant — seul à connaître son DOM —
   * convertit en origine de transformation.
   */
  mobileZoom: MobileZoomOrder | null;
  /** Pas de temps du zoom desktop, et son intervalle d'étiquettes. */
  slotDuration: string;
  slotLabelInterval: string;
  onDateSelect: (selectInfo: DateSelectArg) => void;
  onMobileDateSelect: (selectInfo: DateSelectArg) => void;
  /** Tap sur une case : c'est LUI qui bascule Mois → Jour au doigt (cf. hook). */
  onMobileDateClick: (info: DateClickArg) => void;
  onEventClick: (clickInfo: EventClickArg) => void;
  onEventDragStart: (info: EventDragArg) => void;
  onEventDragStop: (info: EventDragArg) => void;
  onEventDrop: (dropInfo: EventDropArg) => void;
  onEventResize: (resizeInfo: EventResizeDoneArg) => void;
  onEventReceive: (receiveInfo: EventReceiveArg) => void;
  onDesktopDatesSet: (info: DatesSetArg) => void;
  onMobileDatesSet: (info: DatesSetArg) => void;
  /**
   * Pastille « ce créneau attend une décision », rendue par la PAGE.
   *
   * C'est un emplacement, pas un rappel : ce fichier place la pastille et ne
   * sait rien de ce qu'elle ouvre. La frontière du haut de fichier tient donc
   * toujours, alors qu'un `onReviewClick(eventId)` aurait fait entrer ici la
   * notion de créneau à passer en revue. Rend `null` pour un événement qui
   * n'attend rien.
   */
  renderReviewBadge?: (eventId: string) => React.ReactNode;
}

const UNSELECT_CANCEL =
  '.modal-overlay,.modal-content,input,textarea,select,button,.fc-event,[data-radix-popper-content-wrapper]';

const AgendaCalendarSection = ({
  calendarEvents,
  isMobile,
  desktopKey,
  mobileKey,
  desktopRef,
  mobileRef,
  currentView,
  mobileViewMode,
  mobileSelectedDate,
  onMobileSelectDate,
  mobileZoom,
  slotDuration,
  slotLabelInterval,
  onDateSelect,
  onMobileDateSelect,
  onMobileDateClick,
  onEventClick,
  onEventDragStart,
  onEventDragStop,
  onEventDrop,
  onEventResize,
  onEventReceive,
  onDesktopDatesSet,
  onMobileDatesSet,
  renderReviewBadge,
}: AgendaCalendarSectionProps) => {
  const { t } = useT('agenda');
  const { user } = useAuth();
  const { pref: tzPref } = useTimezonePref();
  const { activeOrg } = useActiveOrganization();
  // Membres de l'org active : sert à résoudre l'avatar de l'AUTEUR d'un
  // événement (créé par un manager) pour distinguer perso / pro dans l'agenda.
  const { data: orgMembers = [] } = useOrgMembers(activeOrg?.id);
  const memberById = React.useMemo(() => {
    const m = new Map<string, (typeof orgMembers)[number]>();
    for (const om of orgMembers) m.set(om.userId, om);
    return m;
  }, [orgMembers]);

  // Locale FullCalendar — était figée à `"fr"` sur les DEUX calendriers, donc
  // les en-têtes de jour et le format d'heure restaient français quelle que
  // soit la langue de l'app. L'étiquette BCP 47 pilote aussi le PREMIER JOUR
  // de la semaine (lundi en `fr-FR`, dimanche en `en-US`) : c'est voulu, une
  // semaine qui commence le mauvais jour est une erreur de localisation à part
  // entière. `headerToolbar` étant à `false`, aucun `buttonText` n'est à
  // traduire — les boutons sont les nôtres (`AgendaDesktopHeader`).
  const calendarLocale = getIntlTag();

  // Décale les instants dans le fuseau d'affichage choisi (feature « heure
  // personnalisée »). Le reste de la page raisonne sur les instants « vrais » :
  // seul le calendrier voit les instants décalés, et ses callbacks retirent le
  // décalage (fromDisplayISO).
  const allCalendarEvents = shiftEventsForDisplay(calendarEvents, tzPref) as EventInput[];
  // « Maintenant » et heure de scroll dans le fuseau choisi pour rester cohérent
  // avec les événements décalés (l'indicateur d'heure courante suit le fuseau).
  const calendarNow = tzPref.mode === 'manual' ? () => displayNow(tzPref) : undefined;
  const calendarScrollTime = getInitialScrollTime(displayNow(tzPref));

  // Conflits (#21) : ids des événements horaires qui se chevauchent.
  const conflictIds = React.useMemo(() => {
    const ids = new Set<string>();
    const sorted = [...calendarEvents].sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j].start >= sorted[i].end) break;
        ids.add(sorted[i].id);
        ids.add(sorted[j].id);
      }
    }
    return ids;
  }, [calendarEvents]);

  // Rendu du contenu d'un événement : titre, avatar de l'auteur si l'événement a
  // été ajouté par quelqu'un d'autre que moi (mon manager, mode entreprise), et
  // la colonne d'indicateurs en haut à droite.
  //
  // Deux indicateurs empilés, jamais fusionnés :
  //   • l'icône TÂCHE dit « cet événement est un créneau de travail sur une
  //     tâche », elle est purement informative et ne se clique pas ;
  //   • la pastille « ! » dit « ce créneau est terminé et personne n'a dit s'il
  //     avait servi », elle PORTE une action.
  // Les confondre ferait d'un état permanent (être lié à une tâche) et d'un état
  // transitoire (attendre une décision) le même signal.
  const renderEventInner = (
    title: string,
    createdBy: string | undefined,
    centered: boolean,
    eventId: string,
    hasTask: boolean,
    needsReview: boolean,
    taskDone: boolean,
  ) => {
    const author = createdBy && createdBy !== user?.id ? memberById.get(createdBy) : undefined;
    return (
      <div className={`relative h-full w-full flex items-center gap-1 p-1 text-xs cursor-pointer ${centered ? 'justify-center' : ''}`}>
        {author && (
          <span className="shrink-0 rounded-full ring-1 ring-white/70" title={t('event.addedBy', { name: author.displayName })}>
            <MemberAvatar avatar={author.avatar} name={author.displayName} size={16} />
          </span>
        )}
        <span
          className={`font-medium text-white truncate leading-tight ${centered ? 'text-center' : ''} ${hasTask ? 'pr-5' : ''}`}
        >
          {title}
        </span>
        {hasTask && (
          <span className="absolute top-0.5 right-0.5 flex flex-col items-center gap-0.5">
            {/* Informatif : `pointer-events-none` pour que le clic traverse
                jusqu'au bloc, qui ouvre l'événement comme partout ailleurs. */}
            {/* Même icône que l'entrée « Tâches » de la barre de navigation
                (`Layout.tsx`) : c'est la même notion, elle doit se reconnaître.
                Taille +20% en diagonale par rapport au premier jet (12px de
                côté → 14,4px) — demandé explicitement, la pastille en dessous
                reçoit le même facteur. */}
            <CheckSquare
              className="h-[14.4px] w-[14.4px] shrink-0 text-white/75 pointer-events-none"
              aria-label={t('event.linkedToTask')}
            />
            {/* Le clic ne doit pas remonter au bloc : il ouvrirait l'EventModal
                par-dessus le menu qu'on vient juste de demander. */}
            {needsReview && renderReviewBadge && (
              <span onClick={(e) => e.stopPropagation()}>{renderReviewBadge(eventId)}</span>
            )}
            {/* Tâche déjà validée : check vert à la place de la pastille.
                Les deux conditions ne sont jamais vraies ensemble
                (`findDoneTaskEvents` exige `task.completed`,
                `findOverdueTaskSlots` l'exclut) — pas de `!needsReview` requis
                ici, mais explicite pour que ça reste vrai si l'une des deux
                définitions bouge un jour. Purement informatif, comme l'icône
                tâche au-dessus : pas de menu, rien à décider une fois la tâche
                faite. */}
            {!needsReview && taskDone && (
              <span
                className="flex h-[19.2px] w-[19.2px] shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow ring-1 ring-emerald-900/30"
                title={t('event.taskDone')}
                aria-label={t('event.taskDone')}
              >
                <Check className="h-3 w-3 pointer-events-none" aria-hidden="true" strokeWidth={3} />
              </span>
            )}
          </span>
        )}
      </div>
    );
  };

  const isMonthView = mobileViewMode === 'dayGridMonth';

  // ── Animation de bascule Mois → Jour (MOBILE UNIQUEMENT) ───────────────────
  //
  // La grille du jour ENTRE en s'ouvrant depuis la case touchée : on part d'un
  // agrandissement centré sur le doigt, et on revient à l'échelle 1. L'œil
  // relie ainsi la case du mois à la journée qui la remplace, au lieu de subir
  // un remplacement sec.
  //
  // Pourquoi des contrôles impératifs plutôt qu'une `key` sur un `motion.div` :
  // une `key` qui change REMONTE `<FullCalendar>`, or la bascule s'appuie
  // justement sur `api.changeView` pour ne PAS démonter (cf. le commentaire de
  // `handleMobileSelectDate`). L'animation ne doit rien coûter à la correction
  // qu'elle accompagne.
  const mobileShellRef = React.useRef<HTMLDivElement>(null);
  const zoomControls = useAnimationControls();
  const reduceMotion = useReducedMotion();
  const zoomToken = mobileZoom?.token ?? 0;
  // Miroir du point touché. Il n'est lu QUE dans l'effet ci-dessous, déclenché
  // par le token ; le mettre en dépendance rejouerait l'animation à chaque
  // nouvel objet identique. Une ref ne peut pas périmer : elle est réassignée
  // au rendu qui précède l'effet, donc toujours du même passage que le token.
  const zoomPointRef = React.useRef(mobileZoom);
  zoomPointRef.current = mobileZoom;

  React.useEffect(() => {
    if (!zoomToken) return;
    // 🔴 Sous `prefers-reduced-motion`, `<MotionConfig reducedMotion="user">`
    // n'EXÉCUTE PAS les animations de transform mais laisse la valeur de
    // départ posée : un `set({ scale: 1.6 })` resterait appliqué pour de bon,
    // et la grille du jour resterait agrandie hors de l'écran. On ne pose donc
    // aucune clé de transform dans ce cas (cf. src/lib/motion-safe.ts).
    if (reduceMotion) {
      zoomControls.set({ opacity: 1 });
      return;
    }
    const shell = mobileShellRef.current;
    const rect = shell?.getBoundingClientRect();
    const point = zoomPointRef.current;
    // Origine = le doigt, ramené dans le repère du conteneur. Sans point
    // exploitable (clavier, ou tap hors cadre), on retombe au centre.
    const origin =
      rect && rect.width > 0 && rect.height > 0 && point && point.x >= 0
        ? `${clampPercent(((point.x - rect.left) / rect.width) * 100)}% ${clampPercent(
            ((point.y - rect.top) / rect.height) * 100,
          )}%`
        : '50% 50%';
    zoomControls.set({ opacity: 0, scale: 1.14, transformOrigin: origin });
    void zoomControls.start({
      opacity: 1,
      scale: 1,
      transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
    });
  }, [zoomToken, reduceMotion, zoomControls]);


  // Label du jour sélectionné
  const mobileDayLabel = (() => {
    const raw = format(mobileSelectedDate, 'EEEE d MMMM yyyy', { locale: getDateLocale() });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  })();

  return (
    <>
      {/* ── MOBILE : bandeau jours + label (masqué en vue mois) ── */}
      {!isMonthView && (
        <div
          data-tutorial-id="agenda-mobile-day-strip"
          className="md:hidden border-b shrink-0"
          style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' }}
        >
          <MobileDayStrip selectedDate={mobileSelectedDate} onSelectDate={onMobileSelectDate} />
          <p
            className="text-center pb-2 text-sm font-medium"
            style={{ color: 'rgb(var(--color-text-secondary))' }}
          >
            {mobileDayLabel}
          </p>
        </div>
      )}

      {/* ── MOBILE CALENDAR ── */}
      {isMobile && (
        <motion.div
          ref={mobileShellRef}
          animate={zoomControls}
          data-tutorial-id="agenda-mobile-calendar"
          // Pas de `pb` : le conteneur `flex-1` s'arrête déjà pile au-dessus
          // de la tab bar. L'ancien `pb-64px` (réservé pour dégager le FAB)
          // volait ~64px à la grille sans raison — le FAB étant `fixed`, il
          // flotte au-dessus du coin bas-droit sans réduire le calendrier.
          className="md:hidden mobile-calendar flex-1 overflow-hidden"
        >
          <FullCalendar
            key={mobileKey}
            ref={mobileRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={mobileViewMode}
            initialDate={mobileSelectedDate}
            headerToolbar={false}
            views={{
              timeGrid2Day: { type: 'timeGrid', duration: { days: 2 } },
            }}
            events={allCalendarEvents}
            editable={true}
            droppable={true}
            selectable={true}
            selectMirror={true}
            height="100%"
            locales={allCalendarLocales}
            locale={calendarLocale}
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            scrollTime={calendarScrollTime}
            now={calendarNow}
            allDaySlot={false}
            nowIndicator={true}
            eventDisplay="block"
            eventLongPressDelay={250}
            selectLongPressDelay={250}
            slotDuration="00:30:00"
            slotLabelInterval="01:00:00"
            snapDuration="00:15:00"
            slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            select={onMobileDateSelect}
            // 🔴 Indispensable : au doigt, un tap court ne produit AUCUN
            // `select` (`selectLongPressDelay={250}` exige un appui maintenu).
            // C'est ce seul rappel qui fait basculer Mois → Jour sur un vrai
            // téléphone. Ne pas le retirer en croyant `select` suffisant : à la
            // souris il l'est, au doigt non.
            dateClick={onMobileDateClick}
            eventClick={onEventClick}
            eventDragStart={onEventDragStart}
            eventDragStop={onEventDragStop}
            eventDrop={onEventDrop}
            eventResize={onEventResize}
            eventReceive={onEventReceive}
            unselectAuto={true}
            unselectCancel={UNSELECT_CANCEL}
            datesSet={onMobileDatesSet}
            eventContent={(eventInfo) =>
              renderEventInner(
                eventInfo.event.title,
                eventInfo.event.extendedProps?.createdBy as string | undefined,
                false,
                eventInfo.event.id,
                Boolean(eventInfo.event.extendedProps?.taskId),
                Boolean(eventInfo.event.extendedProps?.needsReview),
                Boolean(eventInfo.event.extendedProps?.taskDone),
              )
            }
            eventClassNames={(arg) => [
              'rounded-lg shadow-sm border-0 cursor-pointer',
              conflictIds.has(arg.event.id) ? 'event-conflict' : '',
            ]}
          />
          <style>{mobileCalendarStyles}</style>
        </motion.div>
      )}

      {/* ── DESKTOP CALENDAR (hidden on mobile) ── */}
      <motion.div
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
        className="hidden md:flex flex-1 p-2 lg:p-6 min-w-0 overflow-hidden"
      >
        <div className="rounded-xl shadow-lg border h-full w-full overflow-hidden focus:outline-none"
          id={AGENDA_CALENDAR_ID}
          tabIndex={-1}
          data-tutorial-id="agenda-calendar-grid"
          style={{ backgroundColor: 'rgb(var(--calendar-bg))', borderColor: 'rgb(var(--calendar-border))' }}>
          <div className="p-2 lg:p-6 h-full w-full overflow-hidden">
            <FullCalendar
              key={desktopKey}
              ref={desktopRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={currentView}
              headerToolbar={false}
              events={allCalendarEvents}
              editable={true}
              droppable={true}
              eventStartEditable={true}
              eventDurationEditable={true}
              selectable={true}
              selectMirror={true}
              dayMaxEvents={false}
              weekends={true}
              height="100%"
              locales={allCalendarLocales}
              locale={calendarLocale}
              slotMinTime="00:00:00"
              slotMaxTime="24:00:00"
              scrollTime={calendarScrollTime}
              now={calendarNow}
              allDaySlot={false}
              nowIndicator={true}
              eventDisplay="block"
              eventLongPressDelay={250}
              selectLongPressDelay={250}
              dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
              slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
              slotDuration={slotDuration}
              slotLabelInterval={slotLabelInterval}
              snapDuration={slotDuration}
              select={onDateSelect}
              eventClick={onEventClick}
              eventDragStart={onEventDragStart}
              eventDragStop={onEventDragStop}
              eventDrop={onEventDrop}
              eventResize={onEventResize}
              eventReceive={onEventReceive}
              datesSet={onDesktopDatesSet}
              unselectAuto={true}
              unselectCancel={UNSELECT_CANCEL}
              eventContent={(eventInfo) =>
                renderEventInner(
                  eventInfo.event.title,
                  eventInfo.event.extendedProps?.createdBy as string | undefined,
                  true,
                  eventInfo.event.id,
                  Boolean(eventInfo.event.extendedProps?.taskId),
                  Boolean(eventInfo.event.extendedProps?.needsReview),
                  Boolean(eventInfo.event.extendedProps?.taskDone),
                )
              }
              eventClassNames={(arg) => [
                'rounded-lg shadow-sm border-0 cursor-pointer hover:shadow-md transition-all hover:scale-105',
                conflictIds.has(arg.event.id) ? 'event-conflict' : '',
              ]}
            />
            <style>{`
              .dark .fc-theme-standard td.fc-day:hover,
              .dark .fc-theme-standard .fc-timegrid-col:hover { background-color: rgba(255,255,255,0.06) !important; }
              .dark .fc-theme-standard td.fc-day,
              .dark .fc-theme-standard .fc-timegrid-col { background-color: transparent !important; }
              .fc-event { transition: all 0.2s ease; }
              .fc-event:hover { transform: scale(1.02); z-index: 999; }
              /* Conflit d'horaires (#21) : liseré d'alerte discret — bordure fine sur tout le contour plutôt qu'un bandeau épais d'un seul côté */
              .fc-event.event-conflict { box-shadow: inset 0 0 0 2px #ef4444, 0 1px 2px rgba(0,0,0,0.1); }
            `}</style>
          </div>
        </div>
      </motion.div>
    </>
  );
};

/** Borne un pourcentage d'origine de transformation dans [0, 100]. */
function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export default AgendaCalendarSection;

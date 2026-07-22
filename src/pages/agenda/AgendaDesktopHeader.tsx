// En-tête desktop de l'agenda (toggle tâches, zoom, sélecteur de vue, nav,
// récurrences, nouveau) — extrait verbatim de AgendaPage, prop-driven.
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { fr } from 'date-fns/locale';
import type FullCalendar from '@fullcalendar/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

interface AgendaDesktopHeaderProps {
  showTaskSidebar: boolean;
  setShowTaskSidebar: React.Dispatch<React.SetStateAction<boolean>>;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  zoomLevel: number;
  zoomDurations: string[];
  handleViewChange: (view: string) => void;
  currentView: string;
  calendarRef: React.RefObject<FullCalendar>;
  setShowRecurringManager: React.Dispatch<React.SetStateAction<boolean>>;
  handleOpenAddModal: () => void;
  /** Le jour courant (aujourd'hui) est déjà dans la plage affichée par le calendrier. */
  isTodayVisible: boolean;
}

const AgendaDesktopHeader: React.FC<AgendaDesktopHeaderProps> = ({
  showTaskSidebar, setShowTaskSidebar, handleZoomIn, handleZoomOut, zoomLevel, zoomDurations,
  handleViewChange, currentView, calendarRef, setShowRecurringManager, handleOpenAddModal,
  isTodayVisible,
}) => {
  // Aujourd'hui est déjà affiché : le bouton « Aujourd'hui » ne ferait rien —
  // il ouvre plutôt un sélecteur pour naviguer vers une autre date.
  const [showDatePicker, setShowDatePicker] = useState(false);

  return (
        <div className="hidden md:block">
          <motion.div
            initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
            className="px-4 py-3 border-b"
            style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' }}
          >
            <div className="flex items-center justify-between gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setShowTaskSidebar(!showTaskSidebar)}
                data-tutorial-id="agenda-task-sidebar-toggle"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all shadow-sm shrink-0 border ${showTaskSidebar ? 'shadow-md' : ''}`}
                style={{
                  backgroundColor: showTaskSidebar ? 'rgb(var(--color-accent))' : 'rgb(var(--color-chip-bg))',
                  borderColor: showTaskSidebar ? 'rgb(var(--color-accent))' : 'rgb(var(--color-chip-border))',
                  color: showTaskSidebar ? 'white' : 'rgb(var(--color-text-primary))',
                }}
              >
                <CalendarIcon size={18} />
                <span className="font-medium text-sm lg:text-base">Tâches</span>
              </motion.button>

              <div className="flex items-center gap-2 lg:gap-3">
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleZoomIn}
                    disabled={zoomLevel === 0}
                    className={`p-1.5 rounded-md transition-all ${zoomLevel === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white dark:hover:bg-gray-700 shadow-sm'}`}>
                    <ZoomIn size={18} />
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleZoomOut}
                    disabled={zoomLevel === zoomDurations.length - 1}
                    className={`p-1.5 rounded-md transition-all ${zoomLevel === zoomDurations.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white dark:hover:bg-gray-700 shadow-sm'}`}>
                    <ZoomOut size={18} />
                  </motion.button>
                </div>

                <div className="flex gap-1 p-1 rounded-xl border"
                  data-tutorial-id="agenda-view-switcher"
                  style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' }}>
                  {(['timeGridDay', 'timeGridWeek', 'dayGridMonth'] as const).map(view => (
                    <button key={view} onClick={() => handleViewChange(view)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 outline-none whitespace-nowrap ${
                        currentView === view
                          ? 'bg-[rgb(var(--color-accent))] text-white shadow-sm'
                          : 'text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]'
                      }`}>
                      {view === 'timeGridDay' ? 'Jour' : view === 'timeGridWeek' ? 'Semaine' : 'Mois'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    onClick={() => calendarRef.current?.getApi().prev()}
                    className="p-2 rounded-lg transition-colors hover:text-blue-600"
                    style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    <ChevronLeft size={18} />
                  </motion.button>
                  {/* Retour à aujourd'hui (#16) — si aujourd'hui est déjà
                      affiché, ouvre plutôt un sélecteur pour aller ailleurs. */}
                  <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                    <PopoverTrigger asChild>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          if (isTodayVisible) { setShowDatePicker(true); return; }
                          calendarRef.current?.getApi().today();
                        }}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors hover:text-blue-600 hover:border-[rgb(var(--color-accent-solid-hover))]/60"
                        style={{ color: 'rgb(var(--color-text-secondary))', borderColor: 'rgb(var(--color-border))' }}>
                        Aujourd'hui
                      </motion.button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[100]" align="center" sideOffset={8}>
                      <Calendar
                        mode="single"
                        selected={undefined}
                        onSelect={(d) => {
                          if (!d) return;
                          calendarRef.current?.getApi().gotoDate(d);
                          setShowDatePicker(false);
                        }}
                        locale={fr}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    onClick={() => calendarRef.current?.getApi().next()}
                    className="p-2 rounded-lg transition-colors hover:text-blue-600"
                    style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    <ChevronRight size={18} />
                  </motion.button>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setShowRecurringManager(true)}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg font-medium transition-all border shrink-0 whitespace-nowrap"
                  style={{ backgroundColor: 'rgb(var(--color-chip-bg))', borderColor: 'rgb(var(--color-chip-border))', color: 'rgb(var(--color-text-primary))' }}>
                  <span className="text-sm lg:text-base">Récurrences</span>
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={handleOpenAddModal}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-bold text-[rgb(var(--color-accent-solid-foreground))] shadow-lg shadow-blue-500/25 transition-all bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] shrink-0 whitespace-nowrap">
                  <Plus size={18} />
                  <span className="font-medium text-sm lg:text-base">Nouveau</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
  );
};

export default AgendaDesktopHeader;

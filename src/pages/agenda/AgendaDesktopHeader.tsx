// En-tête desktop de l'agenda (toggle tâches, zoom, sélecteur de vue, nav,
// récurrences, nouveau) — extrait verbatim de AgendaPage, prop-driven.
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Repeat } from 'lucide-react';
import { getDateLocale } from '@/i18n/format';
import { useT } from '@/i18n/useT';
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
  calendarRef: React.RefObject<FullCalendar | null>;
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
  const { t } = useT('agenda');
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
            {/* `flex-wrap` (C-97, 2026-10-22) : sous ~1 100 px de colonne (téléphone
                en paysage, tablette, fenêtre étroite), la rangée passe à la ligne
                au lieu de sortir de l'écran. Mesuré avant : « Nouveau » coupé de
                447 px à 863 px de large, de 130 px encore à 1 280.
                Le groupe central est en `contents` pour que ses éléments se
                replient UN PAR UN ; les deux `ml-auto` rendent, sur une seule
                ligne, exactement l'ancien `justify-between`. */}
            <div className="flex flex-wrap items-center gap-2 lg:gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setShowTaskSidebar(!showTaskSidebar)}
                data-tutorial-id="agenda-task-sidebar-toggle"
                data-guide-id="perso-agenda-tasks"
                aria-label={t('nav.tasks')}
                title={t('nav.tasks')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all shadow-sm shrink-0 border ${showTaskSidebar ? 'shadow-md' : ''}`}
                style={{
                  // AM-5 : fond PLEIN = --color-accent-solid, le seul accent prévu
                  // pour porter son texte (blanc sur --color-accent : 3,67:1 en
                  // Sombre, 2,52:1 en Gris).
                  backgroundColor: showTaskSidebar ? 'rgb(var(--color-accent-solid))' : 'rgb(var(--color-chip-bg))',
                  borderColor: showTaskSidebar ? 'rgb(var(--color-accent-solid))' : 'rgb(var(--color-chip-border))',
                  // 'white' en dur était illisible en thème Noir : --color-accent
                  // y est quasi-blanc (texte/liens), pas bleu comme Sombre/Gris/Clair.
                  // --color-accent-solid-foreground existe pour ce pairage.
                  color: showTaskSidebar ? 'rgb(var(--color-accent-solid-foreground))' : 'rgb(var(--color-text-primary))',
                }}
              >
                <CalendarIcon size={18} aria-hidden="true" />
                {/* Sous `lg`, icône seule (le nom reste porté par `aria-label`) :
                    en paysage, chaque rangée d'en-tête coûte ~50 px sur 360. */}
                <span className="hidden lg:inline font-medium text-sm lg:text-base">{t('nav.tasks')}</span>
              </motion.button>

              <div className="contents">
                {/* Tokens, pas de couleurs Tailwind en dur : `.dark` est posé
                    pour Sombre ET Gris ET Noir, donc `dark:bg-gray-800` rendait
                    le même gris bleuté dans les trois thèmes. */}
                <div
                  data-guide-id="perso-agenda-zoom"
                  className="ml-auto flex items-center gap-1 rounded-lg p-1 border"
                  style={{
                    backgroundColor: 'rgb(var(--color-hover))',
                    borderColor: 'rgb(var(--color-border))',
                  }}
                >
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleZoomIn}
                    disabled={zoomLevel === 0}
                    aria-label={t('nav.zoomIn')}
                    className={`p-1.5 rounded-md transition-all ${zoomLevel === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-secondary))] shadow-sm'}`}>
                    <ZoomIn size={18} aria-hidden="true" />
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleZoomOut}
                    disabled={zoomLevel === zoomDurations.length - 1}
                    aria-label={t('nav.zoomOut')}
                    className={`p-1.5 rounded-md transition-all ${zoomLevel === zoomDurations.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-secondary))] shadow-sm'}`}>
                    <ZoomOut size={18} aria-hidden="true" />
                  </motion.button>
                </div>

                <div className="flex gap-1 p-1 rounded-xl border"
                  data-tutorial-id="agenda-view-switcher"
                  data-guide-id="perso-agenda-views"
                  style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' }}>
                  {(['timeGridDay', 'timeGridWeek', 'dayGridMonth'] as const).map(view => (
                    <button key={view} onClick={() => handleViewChange(view)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 outline-none whitespace-nowrap ${
                        currentView === view
                          ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] shadow-sm'
                          : 'text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]'
                      }`}>
                      {view === 'timeGridDay' ? t('view.day') : view === 'timeGridWeek' ? t('view.week') : t('view.month')}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    onClick={() => calendarRef.current?.getApi().prev()}
                    aria-label={t('nav.prevPeriod')}
                    className="p-2 rounded-lg transition-colors hover:text-blue-600"
                    style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    <ChevronLeft size={18} aria-hidden="true" />
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
                        {t('nav.today')}
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
                        locale={getDateLocale()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    onClick={() => calendarRef.current?.getApi().next()}
                    aria-label={t('nav.nextPeriod')}
                    className="p-2 rounded-lg transition-colors hover:text-blue-600"
                    style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    <ChevronRight size={18} aria-hidden="true" />
                  </motion.button>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2 shrink-0">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setShowRecurringManager(true)}
                  aria-label={t('nav.recurrences')}
                  title={t('nav.recurrences')}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg font-medium transition-all border shrink-0 whitespace-nowrap"
                  style={{ backgroundColor: 'rgb(var(--color-chip-bg))', borderColor: 'rgb(var(--color-chip-border))', color: 'rgb(var(--color-text-primary))' }}>
                  <Repeat size={18} aria-hidden="true" className="lg:hidden" />
                  <span className="hidden lg:inline text-sm lg:text-base">{t('nav.recurrences')}</span>
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={handleOpenAddModal}
                  aria-label={t('nav.new')}
                  title={t('nav.new')}
                  className="flex items-center justify-center gap-2 px-3 lg:px-5 py-2.5 rounded-lg font-bold text-[rgb(var(--color-accent-solid-foreground))] shadow-lg shadow-blue-500/25 transition-all bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] shrink-0 whitespace-nowrap">
                  <Plus size={18} aria-hidden="true" />
                  <span className="hidden lg:inline font-medium text-sm lg:text-base">{t('nav.new')}</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
  );
};

export default AgendaDesktopHeader;

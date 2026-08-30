import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Trash2, ListPlus, MoreHorizontal, Tag, CalendarClock, ArrowLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateCalendarPanel, DATE_PANEL_CLASS } from '@/components/ui/date-picker';
import { useT } from '@/i18n/useT';

interface CategoryOption {
  id: string;
  name: string;
  color: string;
}

interface Props {
  /** Le mode sélection est-il actif ? Pilote l'entrée et la sortie animées. */
  open: boolean;
  /** Nombre de tâches sélectionnées. Zéro désactive les actions, sans masquer la barre. */
  count: number;
  categories: CategoryOption[];
  onComplete: () => void;
  onAddToList: () => void;
  onDelete: () => void;
  onSetCategory: (categoryId: string, categoryName: string) => void;
  onSetDeadline: (deadline: string) => void;
  onExit: () => void;
}

/**
 * Barre d'actions groupées du mode sélection de la page Tâches.
 *
 * Extraite de `TaskTable` le 2026-08-29 (T-45). La frontière est réelle et pas
 * un compte de lignes : ce composant ne connaît **aucune** tâche. Il reçoit un
 * nombre et des libellés de catégories, il rend des boutons, il rappelle. Toute
 * la logique métier (quelles tâches, quelles mutations, quel toast d'annulation)
 * reste dans `TaskTable`, qui est le seul à savoir ce qui est sélectionné.
 *
 * ⚠️ **L'état du menu « ⋯ » vit ICI, volontairement.** Il était dans `TaskTable`
 * avec, en conséquence, un `setBulkMenuOpen(false)` dispersé dans cinq
 * gestionnaires métier qui n'avaient aucune raison de connaître un menu. Le
 * menu se ferme désormais lui-même avant de rappeler, et il disparaît avec la
 * barre quand on quitte le mode sélection : il n'y a plus d'état à remettre à
 * zéro à la main, donc plus d'oubli possible.
 *
 * ⚠️ L'`initial` de l'animation porte `y` **et** `opacity`. Sous
 * `prefers-reduced-motion`, `MotionConfig reducedMotion="user"` ne joue pas les
 * transforms mais resout l'opacité : une entrée en `y` SEUL laisserait la barre
 * 80 px trop bas, définitivement. C'est le bug documenté de `CookieBanner`, et
 * la raison pour laquelle la position finale vient du CSS (`bottom: calc(...)`).
 */
const TaskBulkActionsBar: React.FC<Props> = ({
  open,
  count,
  categories,
  onComplete,
  onAddToList,
  onDelete,
  onSetCategory,
  onSetDeadline,
  onExit,
}) => {
  const { t, tp } = useT('tasks');
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<'root' | 'category'>('root');
  // Calendrier COSMO hors du menu (même contrainte que le snooze : le menu se
  // ferme au clic, l'ancre doit survivre à sa fermeture). Il remplace l'input
  // natif, qui ouvrait le calendrier du navigateur — hors thème, hors locale.
  const [calendarOpen, setCalendarOpen] = useState(false);

  const openDatePicker = () => {
    setMenuOpen(false);
    setCalendarOpen(true);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl border shadow-2xl"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom) + 84px)',
            backgroundColor: 'rgb(var(--color-surface))',
            borderColor: 'rgb(var(--color-border))',
          }}
        >
          <span className="text-sm font-semibold whitespace-nowrap" style={{ color: 'rgb(var(--color-text-primary))' }}>
            {tp('table.selected', count)}
          </span>
          <Button size="sm" onClick={onComplete} disabled={count === 0} className="bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))]">
            <CheckCircle2 size={16} data-icon="inline-start" />
            <span className="hidden sm:inline">{t('table.complete')}</span>
          </Button>
          {/* Ouvre le modal d'ajout à une liste (#23) — toujours cliquable,
              même sans liste manuelle (le modal permet d'en créer une). */}
          <Button size="sm" variant="outline" disabled={count === 0} onClick={onAddToList}>
            <ListPlus size={16} data-icon="inline-start" />
            <span className="hidden sm:inline">{t('table.list')}</span>
          </Button>
          <Button size="sm" variant="outline" onClick={onDelete} disabled={count === 0} className="!text-red-500 hover:!bg-red-500/10">
            <Trash2 size={16} data-icon="inline-start" />
            <span className="hidden sm:inline">{t('table.delete')}</span>
          </Button>
          {/* « ⋯ » — actions supplémentaires : catégorie / deadline */}
          <div className="relative">
            <Button
              size="sm"
              variant="outline"
              disabled={count === 0}
              onClick={() => { setMenuView('root'); setMenuOpen((v) => !v); }}
              aria-label="Plus d'actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <MoreHorizontal size={16} />
            </Button>
            <AnimatePresence>
              {menuOpen && (
                <>
                  {/* Backdrop invisible : ferme le menu au clic en dehors */}
                  <div className="fixed inset-0 z-[60]" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className="absolute bottom-full mb-2 right-0 z-[70] w-60 rounded-xl border shadow-2xl overflow-hidden"
                    style={{
                      backgroundColor: 'rgb(var(--color-surface))',
                      borderColor: 'rgb(var(--color-border))',
                    }}
                    role="menu"
                    aria-label={t('table.moreActions')}
                  >
                    {menuView === 'root' ? (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => setMenuView('category')}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left hover:bg-[rgb(var(--color-hover))] transition-colors"
                          style={{ color: 'rgb(var(--color-text-primary))' }}
                        >
                          <Tag size={15} style={{ color: 'rgb(var(--color-text-secondary))' }} aria-hidden="true" />
                          {t('table.editCategory')}
                        </button>
                        <div className="h-px" style={{ backgroundColor: 'rgb(var(--color-border))' }} />
                        <button
                          type="button"
                          role="menuitem"
                          onClick={openDatePicker}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left hover:bg-[rgb(var(--color-hover))] transition-colors"
                          style={{ color: 'rgb(var(--color-text-primary))' }}
                        >
                          <CalendarClock size={15} style={{ color: 'rgb(var(--color-text-secondary))' }} aria-hidden="true" />
                          Modifier la deadline
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setMenuView('root')}
                          className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-[rgb(var(--color-hover))] transition-colors"
                          style={{ color: 'rgb(var(--color-text-muted))' }}
                          aria-label="Retour aux actions"
                        >
                          <ArrowLeft size={13} aria-hidden="true" /> {t('table.categoryBack')}
                        </button>
                        <div className="h-px" style={{ backgroundColor: 'rgb(var(--color-border))' }} />
                        <div className="max-h-56 overflow-y-auto">
                          {categories.length === 0 ? (
                            <p className="px-3.5 py-3 text-sm" style={{ color: 'rgb(var(--color-text-muted))' }}>
                              {t('table.noCategory')}
                            </p>
                          ) : (
                            categories.map((cat) => (
                              <button
                                key={cat.id}
                                type="button"
                                role="menuitem"
                                onClick={() => { setMenuOpen(false); onSetCategory(cat.id, cat.name); }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left hover:bg-[rgb(var(--color-hover))] transition-colors"
                                style={{ color: 'rgb(var(--color-text-primary))' }}
                              >
                                <span
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: cat.color }}
                                  aria-hidden="true"
                                />
                                <span className="truncate">{cat.name}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
            {/* Calendrier COSMO — survit à la fermeture du menu, comme l'input
                natif qu'il remplace. L'ancre est invisible : aucun champ de
                date n'est affiché, c'est l'entrée de menu qui ouvre. */}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                {/* Ancre calée sur le bouton du menu (le conteneur est déjà
                    `relative`). `pointer-events-none` pour ne jamais lui voler
                    un clic. */}
                <span aria-hidden="true" className="absolute inset-0 pointer-events-none" />
              </PopoverTrigger>
              <PopoverContent
                className={`${DATE_PANEL_CLASS} z-[100]`}
                align="start"
                collisionPadding={16}
                sideOffset={8}
                aria-label={t('table.newDeadline')}
              >
                <DateCalendarPanel
                  allowClear={false}
                  onSelect={(date) => {
                    if (!date) return;
                    onSetDeadline(date);
                    setCalendarOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
          <button
            type="button"
            onClick={onExit}
            aria-label={t('table.exitSelection')}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors"
            style={{ color: 'rgb(var(--color-text-muted))' }}
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TaskBulkActionsBar;

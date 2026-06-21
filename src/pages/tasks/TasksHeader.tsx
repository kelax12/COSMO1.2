import React from 'react';
import { motion } from 'framer-motion';
import { CalendarDays } from 'lucide-react';
import { PageHeading } from '@/components/ui/typography';

interface TasksHeaderProps {
  showDeadlineCalendar: boolean;
  onToggleCalendar: () => void;
}

// En-tête de la page Tâches : titre H1 + bouton Calendrier.
const TasksHeader: React.FC<TasksHeaderProps> = ({ showDeadlineCalendar, onToggleCalendar }) => {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.1 }}
      className="flex flex-col gap-2"
    >
      {/* Title row: H1 + Calendrier + shortcuts toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <PageHeading
            as="h1"
            variant="compact"
          >
            To do list
          </PageHeading>
          <motion.p
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-slate-500 dark:text-slate-400 font-medium text-sm sm:text-base hidden sm:block"
          >
            Gérez vos tâches efficacement
          </motion.p>
        </div>

        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2 shrink-0"
        >
          {/* Calendrier button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggleCalendar}
            data-tutorial-id="tasks-calendar-toggle"
            aria-label={showDeadlineCalendar ? 'Masquer le calendrier' : 'Afficher le calendrier'}
            className={`flex items-center justify-center gap-2 rounded-lg min-w-11 min-h-11 px-3 sm:px-4 py-2 transition-all shadow-sm border font-medium text-sm ${
              showDeadlineCalendar
                ? 'bg-blue-600 text-white border-blue-700 dark:bg-blue-500 dark:border-blue-600 monochrome:bg-white monochrome:text-black monochrome:border-white shadow-md'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 monochrome:bg-neutral-900 monochrome:text-neutral-300 monochrome:border-neutral-700 monochrome:hover:bg-neutral-800'
            }`}
          >
            <CalendarDays size={18} className={showDeadlineCalendar ? 'text-white monochrome:text-black' : 'text-blue-600 monochrome:text-neutral-300'} />
            <span className="hidden sm:inline">Calendrier</span>
          </motion.button>
        </motion.div>
      </div>
    </motion.header>
  );
};

export default TasksHeader;

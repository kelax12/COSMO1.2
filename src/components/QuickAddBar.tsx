import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Zap, CalendarDays, Tag, Flag, Clock, CornerDownLeft } from 'lucide-react';
import { parseQuickAdd } from '@/lib/quick-add-parser';
import { useCreateTask } from '@/modules/tasks';
import { useCategories } from '@/modules/categories';

/**
 * Quick-add global (#1) — capture une tâche en langage naturel depuis
 * n'importe quelle page protégée.
 *
 * Ouverture : touche « N » (hors champ de saisie) ou événement custom
 * `open-quick-add` (CommandPalette). Entrée = créer PUIS garder le champ
 * ouvert et vide pour enchaîner (#6 saisie en rafale). Échap = fermer.
 *
 * Exemple : « Appeler le dentiste jeudi 10h #santé !! ~30m »
 */
const QuickAddBar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const createTaskMutation = useCreateTask();
  const { data: categories = [] } = useCategories();

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && !isEditableTarget(e.target)) {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    const onOpenEvent = () => setIsOpen(true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('open-quick-add', onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('open-quick-add', onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Laisse le temps au montage avant de focus (mobile Safari inclus).
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setValue('');
    }
  }, [isOpen]);

  const parsed = useMemo(() => parseQuickAdd(value), [value]);

  // Résolution de #token → catégorie existante (insensible casse/accents).
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const matchedCategory = useMemo(() => {
    if (!parsed.categoryToken) return undefined;
    const token = normalize(parsed.categoryToken);
    return categories.find((c) => normalize(c.name) === token || normalize(c.name).startsWith(token));
  }, [parsed.categoryToken, categories]);

  const handleSubmit = () => {
    if (!parsed.name.trim()) return;
    createTaskMutation.mutate(
      {
        name: parsed.name,
        priority: parsed.priority ?? 0,
        category: matchedCategory?.id ?? '',
        deadline: parsed.deadline ?? '',
        estimatedTime: parsed.estimatedTime ?? 0,
        bookmarked: false,
        completed: false,
      },
      {
        onSuccess: (task) => {
          toast.success(`Tâche « ${task.name} » créée`);
        },
      }
    );
    // Saisie en rafale (#6) : le champ reste ouvert et se vide.
    setValue('');
    inputRef.current?.focus();
  };

  const formatDeadline = (d: string) => {
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[18vh] px-4"
          onClick={() => setIsOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden"
            style={{
              backgroundColor: 'rgb(var(--color-surface))',
              borderColor: 'rgb(var(--color-border))',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <Zap size={18} className="text-blue-500 shrink-0" aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmit();
                  if (e.key === 'Escape') setIsOpen(false);
                }}
                placeholder="Nouvelle tâche… ex : Appeler le dentiste jeudi #santé !! ~30m"
                aria-label="Créer une tâche rapidement"
                className="flex-1 bg-transparent outline-none text-base"
                style={{ color: 'rgb(var(--color-text-primary))' }}
              />
              <kbd
                className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs shrink-0"
                style={{ borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-muted))' }}
              >
                <CornerDownLeft size={12} aria-hidden="true" /> créer
              </kbd>
            </div>

            {/* Aperçu des champs détectés */}
            {(parsed.deadline || parsed.categoryToken || parsed.priority !== undefined || parsed.estimatedTime !== undefined) && (
              <div
                className="flex flex-wrap items-center gap-2 px-4 pb-3 pt-1 border-t"
                style={{ borderColor: 'rgb(var(--color-border))' }}
              >
                {parsed.deadline && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300">
                    <CalendarDays size={12} aria-hidden="true" /> {formatDeadline(parsed.deadline)}
                  </span>
                )}
                {parsed.categoryToken && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    matchedCategory
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400'
                  }`}>
                    <Tag size={12} aria-hidden="true" />
                    {matchedCategory ? matchedCategory.name : `${parsed.categoryToken} (inconnue)`}
                  </span>
                )}
                {parsed.priority !== undefined && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300">
                    <Flag size={12} aria-hidden="true" /> P{parsed.priority}
                  </span>
                )}
                {parsed.estimatedTime !== undefined && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300">
                    <Clock size={12} aria-hidden="true" /> {parsed.estimatedTime} min
                  </span>
                )}
              </div>
            )}

            <div
              className="px-4 py-2 text-xs border-t"
              style={{ borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-muted))' }}
            >
              Astuces : <span className="font-mono">demain</span>, <span className="font-mono">jeudi</span>,{' '}
              <span className="font-mono">15/07</span> · <span className="font-mono">#catégorie</span> ·{' '}
              <span className="font-mono">!!</span> priorité · <span className="font-mono">~30m</span> durée
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default QuickAddBar;

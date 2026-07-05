import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Zap, CalendarDays, Tag, Flag, Clock, CornerDownLeft, Repeat } from 'lucide-react';
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
// Placeholders-exemples rotatifs (#21) : enseignent la syntaxe par l'exemple,
// un différent à chaque ouverture.
const PLACEHOLDER_EXAMPLES = [
  'Appeler le dentiste jeudi 10h #santé !! ~30m',
  'Préparer la réunion demain 9h ~1h',
  'Faire les courses samedi #maison',
  'Relire le rapport !! ~45m',
];

const QuickAddBar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
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
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDER_EXAMPLES.length);
      // Laisse le temps au montage avant de focus (mobile Safari inclus).
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setValue('');
    }
  }, [isOpen]);

  // Tokens cliquables de la ligne d'aide (#21) : insèrent l'exemple dans le
  // champ pour apprendre la syntaxe en la manipulant.
  const insertToken = (token: string) => {
    setValue((prev) => (prev.length === 0 || prev.endsWith(' ') ? `${prev}${token}` : `${prev} ${token}`));
    inputRef.current?.focus();
  };

  const parsed = useMemo(() => parseQuickAdd(value), [value]);

  // Résolution de #token → catégorie existante (insensible casse/accents).
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const matchedCategory = useMemo(() => {
    if (!parsed.categoryToken) return undefined;
    const token = normalize(parsed.categoryToken);
    return categories.find((c) => normalize(c.name) === token || normalize(c.name).startsWith(token));
  }, [parsed.categoryToken, categories]);

  const handleSubmit = () => {
    if (!parsed.name.trim() || createTaskMutation.isPending) return;
    const submitted = value;
    createTaskMutation.mutate(
      {
        name: parsed.name,
        priority: parsed.priority ?? 0,
        category: matchedCategory?.id ?? '',
        deadline: parsed.deadline ?? '',
        estimatedTime: parsed.estimatedTime ?? 0,
        recurrence: parsed.recurrence ?? 'none',
        bookmarked: false,
        completed: false,
      },
      {
        onSuccess: (task) => {
          toast.success(`Tâche « ${task.name} » créée`);
        },
        onError: () => {
          // Restaure la saisie : l'utilisateur ne perd pas son texte si la
          // création échoue (le hook affiche déjà le toast d'erreur détaillé).
          setValue(submitted);
          inputRef.current?.focus();
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
            className="w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden ring-1 ring-blue-500/20"
            style={{
              backgroundColor: 'rgb(var(--color-surface))',
              borderColor: 'rgb(var(--color-border))',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Champ de saisie */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600/10 dark:bg-blue-500/15 shrink-0" aria-hidden="true">
                <Zap size={18} className="text-blue-500" />
              </span>
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmit();
                  if (e.key === 'Escape') setIsOpen(false);
                }}
                placeholder={`Ex : ${PLACEHOLDER_EXAMPLES[placeholderIdx]}`}
                aria-label="Créer une tâche rapidement"
                className="flex-1 min-w-0 bg-transparent outline-none text-lg font-medium placeholder:font-normal"
                style={{ color: 'rgb(var(--color-text-primary))' }}
                enterKeyHint="done"
              />
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!parsed.name.trim() || createTaskMutation.isPending}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <CornerDownLeft size={14} aria-hidden="true" />
                Créer
              </button>
            </div>

            {/* Aperçu des champs détectés en temps réel */}
            <div className="flex flex-wrap items-center gap-2 px-4 pb-3 min-h-[30px]">
              {!parsed.deadline && !parsed.categoryToken && parsed.priority === undefined && parsed.estimatedTime === undefined ? (
                <span className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
                  Les champs détectés (date, catégorie, priorité, durée) s'affichent ici.
                </span>
              ) : (
                <>
                  {parsed.deadline && (
                    <span className="inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-500/20">
                      <CalendarDays size={13} aria-hidden="true" /> {formatDeadline(parsed.deadline)}
                    </span>
                  )}
                  {parsed.categoryToken && (
                    <span className={`inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-lg text-xs font-semibold border ${
                      matchedCategory
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-500/20'
                        : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600/40'
                    }`}>
                      <Tag size={13} aria-hidden="true" />
                      {matchedCategory ? matchedCategory.name : `${parsed.categoryToken} (inconnue)`}
                    </span>
                  )}
                  {parsed.priority !== undefined && (
                    <span className="inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-500/20">
                      <Flag size={13} aria-hidden="true" /> Priorité {parsed.priority}
                    </span>
                  )}
                  {parsed.estimatedTime !== undefined && (
                    <span className="inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-500/20">
                      <Clock size={13} aria-hidden="true" /> {parsed.estimatedTime} min
                    </span>
                  )}
                  {parsed.recurrence && (
                    <span className="inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-500/20">
                      <Repeat size={13} aria-hidden="true" />
                      {parsed.recurrence === 'daily' ? 'Quotidien' : parsed.recurrence === 'weekly' ? 'Hebdomadaire' : 'Mensuel'}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Aide syntaxe */}
            <div
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 border-t text-xs"
              style={{ borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-muted))' }}
            >
              {([
                ['demain 10h', 'date'],
                ['#santé', 'catégorie'],
                ['!!', 'priorité'],
                ['~30m', 'durée'],
              ] as const).map(([token, label]) => (
                <span key={token} className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => insertToken(token)}
                    aria-label={`Insérer l'exemple ${token} (${label})`}
                    className="px-1.5 py-0.5 rounded border font-mono text-[11px] hover:bg-[rgb(var(--color-hover))] transition-colors cursor-pointer"
                    style={{ borderColor: 'rgb(var(--color-border))' }}
                  >
                    {token}
                  </button>
                  {label}
                </span>
              ))}
              <span className="hidden sm:inline ml-auto opacity-80">Entrée = créer et enchaîner · Échap = fermer</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default QuickAddBar;

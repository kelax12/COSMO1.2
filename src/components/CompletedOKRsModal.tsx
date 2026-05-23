import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit2, CheckCircle2, Calendar, Trophy } from 'lucide-react';
import type { OKR } from '@/modules/okrs';

type Category = { id: string; name: string; color: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  okrs: OKR[]; // déjà filtrés côté caller (completed: true)
  categories: Category[];
  resolveColor: (color: string) => string;
  onEdit: (okrId: string) => void;
};

/**
 * Modal listant tous les OKR terminés. Pour chaque OKR : titre, % de
 * progression, KR (titre + barre + ratio), bouton "Modifier" qui ouvre
 * l'OKRModal en mode édition.
 */
const CompletedOKRsModal: React.FC<Props> = ({ isOpen, onClose, okrs, categories, resolveColor, onEdit }) => {
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  const categoryById = (id: string) => categories.find(c => c.id === id);

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return ''; }
  };

  const okrProgress = (okr: OKR) => {
    if (!okr.keyResults.length) return 0;
    const sum = okr.keyResults.reduce((s, kr) =>
      s + (kr.targetValue > 0 ? Math.min((kr.currentValue / kr.targetValue) * 100, 100) : 0)
    , 0);
    return Math.round(sum / okr.keyResults.length);
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm sm:p-4"
        >
          <motion.div
            key="panel"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-3xl sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92dvh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Drag handle mobile */}
            <div className="sm:hidden flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>

            {/* Header */}
            <div className="px-5 sm:px-6 pt-4 pb-3 border-b border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                  <Trophy size={20} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                    OKR terminés
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {okrs.length} objectif{okrs.length > 1 ? 's' : ''} clôturé{okrs.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body — liste */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
              {okrs.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                    <CheckCircle2 size={28} className="text-slate-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Aucun OKR terminé pour le moment
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Vos objectifs clôturés apparaîtront ici.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {okrs.map((okr) => {
                    const cat = categoryById(okr.category);
                    const accent = cat ? resolveColor(cat.color) : '#10B981';
                    const progress = okrProgress(okr);
                    return (
                      <div
                        key={okr.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 p-4 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                      >
                        {/* Header de la carte */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              {cat && (
                                <span
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium"
                                  style={{ backgroundColor: accent + '20', color: accent }}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
                                  {cat.name}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                <CheckCircle2 size={10} />
                                Terminé
                              </span>
                              {okr.endDate && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                                  <Calendar size={10} />
                                  {formatDate(okr.endDate)}
                                </span>
                              )}
                            </div>
                            <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {okr.title}
                            </h3>
                            {okr.description && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                                {okr.description}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => { onEdit(okr.id); onClose(); }}
                            className="shrink-0 p-2 rounded-md text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
                            aria-label={`Modifier l'OKR ${okr.title}`}
                            title="Modifier"
                          >
                            <Edit2 size={16} />
                          </button>
                        </div>

                        {/* Progression globale */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 w-10 text-right">
                            {progress}%
                          </span>
                        </div>

                        {/* KR list */}
                        <div className="space-y-1.5">
                          {okr.keyResults.map((kr) => {
                            const krProgress = kr.targetValue > 0 ? (kr.currentValue / kr.targetValue) * 100 : 0;
                            const done = krProgress >= 100;
                            return (
                              <div key={kr.id} className="flex items-center gap-2 text-xs">
                                <CheckCircle2
                                  size={12}
                                  className={done ? 'text-emerald-500 shrink-0' : 'text-slate-300 dark:text-slate-600 shrink-0'}
                                />
                                <span className="flex-1 truncate text-slate-700 dark:text-slate-300">
                                  {kr.title}
                                </span>
                                <div className="w-20 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                                  <div
                                    className={`h-full rounded-full ${done ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                    style={{ width: `${Math.min(krProgress, 100)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 w-10 text-right shrink-0">
                                  {kr.currentValue}/{kr.targetValue}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default CompletedOKRsModal;

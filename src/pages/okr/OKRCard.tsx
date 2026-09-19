// Carte d'un objectif (OKR) — extraite verbatim de OKRPage, prop-driven + mémoïsée.
import React from 'react';
import { motion } from 'framer-motion';
import { Edit2, Trash2, Clock, CheckCircle, Calendar } from 'lucide-react';
import type { KeyResult } from '@/modules/okrs';
import { useTasks } from '@/modules/tasks';
import { getProgress, type Objective } from './okr-page-logic';
import { formatDate } from '@/i18n/format';
import { useT } from '@/i18n/useT';

interface OKRCardProps {
  objective: Objective;
  index: number;
  getCategoryById: (id: string) => { name: string; color: string } | undefined;
  resolveColor: (color: string) => string;
  formatTime: (m: number) => string;
  handleEditObjective: (id: string) => void;
  setDeletingObjective: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedKeyResultForModal: React.Dispatch<React.SetStateAction<{ kr: KeyResult; obj: Objective } | null>>;
  setShowAddTaskModal: React.Dispatch<React.SetStateAction<boolean>>;
  setShowAddEventModal: React.Dispatch<React.SetStateAction<boolean>>;
  updateKeyResult: (objectiveId: string, keyResultId: string, newValue: number) => void;
}

const OKRCardBase: React.FC<OKRCardProps> = ({
  objective, index, getCategoryById, resolveColor, formatTime, handleEditObjective,
  setDeletingObjective, setSelectedKeyResultForModal, setShowAddTaskModal, setShowAddEventModal,
  updateKeyResult,
}) => {
  const { t } = useT('okr');
              const progress = getProgress(objective.keyResults);
              const category = getCategoryById(objective.category);

              // Tâches liées aux KR de cet objectif (#28) — compteur par KR.
              const { data: linkedTasks = [] } = useTasks();
              const tasksByKr = new Map<string, number>();
              for (const t of linkedTasks) {
                if (t.krId && !t.completed) tasksByKr.set(t.krId, (tasksByKr.get(t.krId) ?? 0) + 1);
              }

              const start = new Date(objective.startDate);
              const end = new Date(objective.endDate);
              const today = new Date();
              const totalTime = end.getTime() - start.getTime();
              const elapsedTime = today.getTime() - start.getTime();
              const remainingTime = end.getTime() - today.getTime();
              const remainingDays = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));
              const timeProgress = totalTime > 0 ? Math.min(Math.max((elapsedTime / totalTime) * 100, 0), 100) : 0;

              return (
                <motion.div
                  key={objective.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                  data-tutorial-id={index === 0 ? 'okr-first-card' : undefined}
                  // Séparation visuelle entre cartes sur mobile (2026-09-17) :
                  // `.card-plain-mobile` rend fond ET bordure transparents
                  // sous 768px (par design, pour d'autres écrans) — ici on la
                  // contredit explicitement, chaque OKR doit rester une boîte
                  // distincte plutôt que de se fondre dans la suivante à 24px
                  // d'écart. Desktop déjà bordé, inchangé.
                  className="card-plain-mobile max-sm:!bg-[rgb(var(--color-surface))] max-sm:!border-[rgb(var(--color-border))] rounded-lg border md:p-6 p-gutter transition-all relative overflow-hidden group">
                  <div className="flex justify-between items-center mb-4 gap-4">
                    <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-caption sm:text-xs font-medium whitespace-nowrap shrink-0" style={{ backgroundColor: category ? resolveColor(category.color) + '20' : 'rgb(var(--color-accent) / 0.1)', color: category ? resolveColor(category.color) : 'rgb(var(--color-accent))' }}>
                      {category && (
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: resolveColor(category.color) }} />
                      )}
                      <span>{category?.name ?? t('card.uncategorized')}</span>
                    </span>

                    {/* Année masquée sur mobile (redesign 2026-09-16) — affichage
                        seulement, `objective.startDate`/`endDate` inchangées.
                        Date de fin remplacée sur mobile (redesign 2026-09-19) par
                        « X jours restants » — les deux pastilles qui portaient
                        cette info (et le % de temps écoulé) sont retirées sous
                        `sm` (cf. plus bas). Desktop inchangé (plage complète +
                        pastilles). */}
                    <div className="flex-1 flex items-center justify-center gap-2 text-caption" style={{ color: 'rgb(var(--color-text-muted))' }}>
                      <span className="sm:hidden">
                        {remainingDays > 0
                          ? `${remainingDays} jour${remainingDays > 1 ? 's' : ''} restant${remainingDays > 1 ? 's' : ''}`
                          : formatDate(new Date(objective.endDate), { day: 'numeric', month: 'long' })}
                      </span>
                      <span className="hidden sm:inline">
                        {formatDate(new Date(objective.startDate), { day: 'numeric', month: 'long' })}
                        <span className="hidden sm:inline"> {formatDate(new Date(objective.startDate), { year: 'numeric' })}</span>
                      </span>
                      <span className="hidden sm:inline">→</span>
                      <span className="hidden sm:inline">
                        {formatDate(new Date(objective.endDate), { day: 'numeric', month: 'long' })}
                        <span className="hidden sm:inline"> {formatDate(new Date(objective.endDate), { year: 'numeric' })}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      <button
                        onClick={() => handleEditObjective(objective.id)}
                        aria-label={t('card.editObjective')}
                        className="min-w-touch min-h-touch sm:min-w-0 sm:min-h-0 flex items-center justify-center p-1.5 transition-colors hover:bg-hover rounded-md"
                        style={{ color: 'rgb(var(--color-text-muted))' }}>
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setDeletingObjective(objective.id)}
                        aria-label={t('card.deleteObjective')}
                        className="min-w-touch min-h-touch sm:min-w-0 sm:min-h-0 flex items-center justify-center p-1.5 transition-colors hover:bg-hover rounded-md text-red-500/70 hover:text-red-500"
                        style={{ color: 'rgb(var(--color-text-muted))' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Pastilles « X j restants » / « % du temps écoulé » retirées
                      sur mobile (redesign 2026-09-19) — l'info « jours restants »
                      vit désormais dans l'en-tête (cf. plus haut). Desktop
                      inchangé. */}
                  {(remainingDays > 0 || totalTime > 0) && (
                    <div className="hidden sm:flex sm:mb-4 flex-wrap items-center gap-2">
                      {remainingDays > 0 && (
                        <div
                          className="px-2.5 py-1 text-caption md:text-[10px] font-bold uppercase tracking-widest rounded-full border shadow-sm transition-transform group-hover:scale-105 w-fit"
                          style={{
                            backgroundColor: 'rgb(var(--color-accent) / 0.1)',
                            borderColor: 'rgb(var(--color-accent) / 0.2)',
                            color: 'rgb(var(--color-accent))'
                          }}
                        >
                          <span className="whitespace-nowrap">{remainingDays}j restants</span>
                        </div>
                      )}
                      {totalTime > 0 && (
                        <div
                          className="px-2.5 py-1 text-caption md:text-[10px] font-bold uppercase tracking-widest rounded-full border shadow-sm w-fit"
                          style={{
                            backgroundColor: 'rgb(var(--color-hover))',
                            borderColor: 'rgb(var(--color-border))',
                            color: 'rgb(var(--color-text-secondary))'
                          }}
                        >
                          <span className="whitespace-nowrap">{t('card.timeElapsed', { percent: Math.round(timeProgress) })}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <h2 className="text-base sm:text-lg font-semibold mb-4 truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>{objective.title}</h2>
                  </div>

                <div className="mb-6 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                  {/* Cercle retiré sur mobile (redesign 2026-09-16) : seule la
                      barre linéaire ci-dessous reste, desktop inchangé. */}
                  <div className="hidden sm:block relative w-16 h-16 sm:w-20 sm:h-20 shrink-0">
                    <svg className="transform -rotate-90" width="100%" height="100%" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="32" stroke="rgb(var(--color-border-muted))" strokeWidth="8" fill="none" />
                      <circle cx="40" cy="40" r="32" stroke="rgb(var(--color-accent))" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 32}`} strokeDashoffset={2 * Math.PI * 32 * (1 - Math.min(progress, 100) / 100)} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg sm:text-xl font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>{progress}%</span>
                    </div>
                  </div>

                  <div className="flex-1 w-full">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs sm:text-sm font-medium" style={{ color: 'rgb(var(--color-text-secondary))' }}>{t('card.overallProgress')}</span>
                      <span className="text-xs sm:text-sm font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>{progress}%</span>
                    </div>
                    <div className="w-full rounded-full h-2" style={{ backgroundColor: 'rgb(var(--color-border-muted))' }}>
                      <div className="h-2 rounded-full transition-all duration-500" style={{ backgroundColor: 'rgb(var(--color-accent))', width: `${progress}%` }} />
                    </div>
                  </div>
                </div>

                {/* Espaces réduits sur mobile (2026-09-17) : `space-y-3`/`p-3`
                    (12px) → `space-y-1.5`/`p-2` (6-8px), desktop inchangé. */}
                <div className="space-y-1.5 sm:space-y-3">
                  <h3 className="text-xs sm:text-sm font-medium mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>{t('card.keyResults')}</h3>
                  {objective.keyResults.map((keyResult) => {
                    // Guard targetValue > 0 (B17) : évite NaN quand la cible vaut 0.
                    const krProgress = keyResult.targetValue > 0
                      ? keyResult.currentValue / keyResult.targetValue * 100
                      : 0;

                    return (
                      <div key={keyResult.id} className="rounded-lg py-1 px-2 sm:p-3 transition-all" style={{ backgroundColor: 'rgb(var(--color-hover))' }}>
                        {/* Espace réduit sur mobile (2026-09-19, resserré) entre
                            le nom du KR et la ligne de complétion — desktop
                            inchangé. */}
                        <div className="flex justify-between items-center mb-1 sm:mb-3 gap-2">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs sm:text-sm font-medium truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>{keyResult.title}</span>
                            {(keyResult.weight ?? 1) !== 1 && (
                              <span
                                className="shrink-0 text-caption sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                title={t('card.weight', { weight: keyResult.weight ?? 1 })}
                              >
                                ×{keyResult.weight}
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                            <button
                              onClick={() => {
                                setSelectedKeyResultForModal({ kr: keyResult, obj: objective });
                                setShowAddTaskModal(true);
                              }}
                              className="min-w-touch min-h-touch sm:min-w-0 sm:min-h-0 flex items-center justify-center p-1.5 rounded-md transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
                              title={t('card.createTask')}>

                              <CheckCircle size={14} className="text-[rgb(var(--color-accent-solid))] md:text-blue-500" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedKeyResultForModal({ kr: keyResult, obj: objective });
                                setShowAddEventModal(true);
                              }}
                              className="min-w-touch min-h-touch sm:min-w-0 sm:min-h-0 flex items-center justify-center p-1.5 rounded-md transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
                              title={t('card.scheduleEvent')}>

                              <Calendar size={14} style={{ color: 'rgb(var(--color-text-muted))' }} />
                            </button>
                            {(tasksByKr.get(keyResult.id) ?? 0) > 0 && (
                              <span
                                className="text-caption sm:text-xs px-1.5 py-0.5 rounded-full bg-[rgb(var(--color-accent-solid))]/10 text-blue-600 dark:text-blue-300 whitespace-nowrap"
                                title={t('card.linkedTasks')}
                              >
                                {tasksByKr.get(keyResult.id)} tâche{(tasksByKr.get(keyResult.id) ?? 0) > 1 ? 's' : ''}
                              </span>
                            )}
                            <span className="text-caption sm:text-xs flex items-center gap-1" style={{ color: 'rgb(var(--color-text-muted))' }}>
                              <Clock size={12} />
                              {keyResult.estimatedTime}min
                            </span>
                          </div>
                        </div>

                        {/* Desktop (sm+, inchangé) : boutons -/+ incrément rapide (#27) +
                            input + barre, sur deux rangées. */}
                        <div className="hidden sm:flex sm:flex-row items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateKeyResult(objective.id, keyResult.id, Math.max(0, keyResult.currentValue - 1))}
                              disabled={keyResult.currentValue <= 0}
                              aria-label={t('card.decrease', { title: keyResult.title })}
                              className="w-7 h-7 rounded-md border flex items-center justify-center text-sm font-bold transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30"
                              style={{ borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-secondary))' }}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              aria-label={t('card.progressOf', { title: keyResult.title, target: keyResult.targetValue })}
                              value={keyResult.currentValue}
                              onChange={(e) => updateKeyResult(objective.id, keyResult.id, Number(e.target.value))}
                              className="w-16 px-2 py-1 text-sm border rounded focus:outline-none text-center"
                              style={{ backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))', borderColor: 'rgb(var(--color-border))' }} />
                            <button
                              type="button"
                              onClick={() => updateKeyResult(objective.id, keyResult.id, keyResult.currentValue + 1)}
                              aria-label={t('card.increase', { title: keyResult.title })}
                              className="w-7 h-7 rounded-md border flex items-center justify-center text-sm font-bold transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
                              style={{ borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-secondary))' }}
                            >
                              +
                            </button>
                            <span className="text-sm whitespace-nowrap" style={{ color: 'rgb(var(--color-text-secondary))' }}>/ {keyResult.targetValue}</span>
                          </div>

                          <div className="flex items-center gap-3 flex-1">
                            <div className="flex-1 rounded-full h-1.5" style={{ backgroundColor: 'rgb(var(--color-border-muted))' }}>
                              <div className={`h-1.5 rounded-full transition-all duration-500 ${keyResult.completed ? 'bg-green-500' : 'bg-[rgb(var(--color-accent-solid))]'}`} style={{ width: `${Math.min(krProgress, 100)}%` }} />
                            </div>
                            <span className="text-xs font-medium w-8 text-right" style={{ color: 'rgb(var(--color-text-secondary))' }}>{Math.round(krProgress)}%</span>
                          </div>
                        </div>

                        {/* Mobile (redesign 2026-09-16) : plus de -/+ (le clavier
                            numérique du champ suffit), input réduit, sur la MÊME
                            ligne que la barre plutôt que sur deux rangées.
                            🔴 Le nombre de KR réalisés s'édite désormais via un
                            `<select>` natif (redesign 2026-09-19) : au tap, un
                            `<select>` ouvre la roue de sélection du système
                            (iOS)/le menu natif (Android) au lieu du clavier
                            numérique — même logique que les champs de durée
                            (`type="time"`, cf. TaskModalMobileBody), transposée
                            à un compteur borné par `targetValue`. */}
                        <div className="flex sm:hidden items-center gap-2">
                          <select
                            aria-label={t('card.progressOf', { title: keyResult.title, target: keyResult.targetValue })}
                            value={keyResult.currentValue}
                            onChange={(e) => updateKeyResult(objective.id, keyResult.id, Number(e.target.value))}
                            className="shrink-0 max-w-[4.5rem] px-1 py-1 text-xs border rounded focus:outline-none text-center max-sm:!bg-[rgb(var(--color-surface))]"
                            style={{
                              color: 'rgb(var(--color-text-primary))',
                              borderColor: 'rgb(var(--color-border))',
                            }}
                          >
                            {Array.from(
                              { length: Math.min(Math.max(keyResult.targetValue, keyResult.currentValue) + 1, 1001) },
                              (_, n) => n,
                            ).map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                          <span className="text-xs shrink-0 whitespace-nowrap" style={{ color: 'rgb(var(--color-text-secondary))' }}>/ {keyResult.targetValue}</span>

                          <div className="flex items-center gap-2 flex-1">
                            <div className="flex-1 rounded-full h-1.5" style={{ backgroundColor: 'rgb(var(--color-border-muted))' }}>
                              <div className={`h-1.5 rounded-full transition-all duration-500 ${keyResult.completed ? 'bg-green-500' : 'bg-[rgb(var(--color-accent-solid))]'}`} style={{ width: `${Math.min(krProgress, 100)}%` }} />
                            </div>
                            <span className="text-caption font-medium w-8 text-right shrink-0" style={{ color: 'rgb(var(--color-text-secondary))' }}>{Math.round(krProgress)}%</span>
                          </div>
                        </div>
                      </div>);

                  })}
                </div>

                {(() => {
                  const doneMins = objective.keyResults.reduce((sum, kr) => sum + Math.round(kr.currentValue * kr.estimatedTime), 0);
                  const totalMins = objective.keyResults.reduce((sum, kr) => sum + Math.round(kr.estimatedTime * kr.targetValue), 0);
                  return totalMins > 0 ? (
                    <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: 'rgb(var(--color-border))' }}>
                      <div className="flex items-center gap-1.5">
                        <Clock size={13} style={{ color: 'rgb(var(--color-text-muted))' }} />
                        <span className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>{t('card.timeSpent')}</span>
                      </div>
                      <span className="text-xs font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                        {formatTime(doneMins)} <span style={{ color: 'rgb(var(--color-text-muted))' }}>/ {formatTime(totalMins)}</span>
                      </span>
                    </div>
                  ) : null;
                })()}
            </motion.div>);
};

const OKRCard = React.memo(OKRCardBase);

export default OKRCard;

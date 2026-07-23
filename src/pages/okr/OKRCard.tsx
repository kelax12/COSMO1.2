// Carte d'un objectif (OKR) — extraite verbatim de OKRPage, prop-driven + mémoïsée.
import React from 'react';
import { motion } from 'framer-motion';
import { Edit2, Trash2, Clock, CheckCircle, Calendar } from 'lucide-react';
import type { KeyResult } from '@/modules/okrs';
import { useTasks } from '@/modules/tasks';
import { getProgress, type Objective } from './okr-page-logic';

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
                  className="card-plain-mobile rounded-lg border md:p-6 p-gutter transition-all relative overflow-hidden group">
                  <div className="flex justify-between items-center mb-4 gap-4">
                    <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-caption sm:text-xs font-medium whitespace-nowrap shrink-0" style={{ backgroundColor: category ? resolveColor(category.color) + '20' : 'rgb(var(--color-accent) / 0.1)', color: category ? resolveColor(category.color) : 'rgb(var(--color-accent))' }}>
                      {category && (
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: resolveColor(category.color) }} />
                      )}
                      <span>{category?.name ?? 'Sans catégorie'}</span>
                    </span>

                    <div className="flex-1 flex items-center justify-center gap-2 text-caption" style={{ color: 'rgb(var(--color-text-muted))' }}>
                      <span>{new Date(objective.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      <span>→</span>
                      <span>{new Date(objective.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      <button
                        onClick={() => handleEditObjective(objective.id)}
                        aria-label="Modifier l'objectif"
                        className="min-w-touch min-h-touch sm:min-w-0 sm:min-h-0 flex items-center justify-center p-1.5 transition-colors hover:bg-hover rounded-md"
                        style={{ color: 'rgb(var(--color-text-muted))' }}>
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setDeletingObjective(objective.id)}
                        aria-label="Supprimer l'objectif"
                        className="min-w-touch min-h-touch sm:min-w-0 sm:min-h-0 flex items-center justify-center p-1.5 transition-colors hover:bg-hover rounded-md text-red-500/70 hover:text-red-500"
                        style={{ color: 'rgb(var(--color-text-muted))' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {(remainingDays > 0 || totalTime > 0) && (
                    <div className="mb-4 flex flex-wrap items-center gap-2">
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
                          <span className="whitespace-nowrap">{Math.round(timeProgress)}% du temps écoulé</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <h3 className="text-base sm:text-lg font-semibold mb-4 truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>{objective.title}</h3>
                  </div>

                <div className="mb-6 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0">
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
                      <span className="text-xs sm:text-sm font-medium" style={{ color: 'rgb(var(--color-text-secondary))' }}>Progression globale</span>
                      <span className="text-xs sm:text-sm font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>{progress}%</span>
                    </div>
                    <div className="w-full rounded-full h-2" style={{ backgroundColor: 'rgb(var(--color-border-muted))' }}>
                      <div className="h-2 rounded-full transition-all duration-500" style={{ backgroundColor: 'rgb(var(--color-accent))', width: `${progress}%` }} />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs sm:text-sm font-medium mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>Résultats Clés</h4>
                  {objective.keyResults.map((keyResult) => {
                    // Guard targetValue > 0 (B17) : évite NaN quand la cible vaut 0.
                    const krProgress = keyResult.targetValue > 0
                      ? keyResult.currentValue / keyResult.targetValue * 100
                      : 0;

                    return (
                      <div key={keyResult.id} className="rounded-lg p-3 transition-all" style={{ backgroundColor: 'rgb(var(--color-hover))' }}>
                        <div className="flex justify-between items-center mb-3 gap-2">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs sm:text-sm font-medium truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>{keyResult.title}</span>
                            {(keyResult.weight ?? 1) !== 1 && (
                              <span
                                className="shrink-0 text-caption sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                title={`Coefficient d'importance ×${keyResult.weight}`}
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
                              title="Créer une tâche">

                              <CheckCircle size={14} className="text-blue-500" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedKeyResultForModal({ kr: keyResult, obj: objective });
                                setShowAddEventModal(true);
                              }}
                              className="min-w-touch min-h-touch sm:min-w-0 sm:min-h-0 flex items-center justify-center p-1.5 rounded-md transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
                              title="Planifier un événement">

                              <Calendar size={14} className="text-purple-500" />
                            </button>
                            {(tasksByKr.get(keyResult.id) ?? 0) > 0 && (
                              <span
                                className="text-caption sm:text-xs px-1.5 py-0.5 rounded-full bg-[rgb(var(--color-accent-solid))]/10 text-blue-600 dark:text-blue-300 whitespace-nowrap"
                                title="Tâches en cours liées à ce résultat clé"
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

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                          <div className="flex items-center gap-1.5 w-full sm:w-auto">
                            {/* Incrément rapide (#27) : passer de 4 à 5 sans ouvrir de modal */}
                            <button
                              type="button"
                              onClick={() => updateKeyResult(objective.id, keyResult.id, Math.max(0, keyResult.currentValue - 1))}
                              disabled={keyResult.currentValue <= 0}
                              aria-label={`Diminuer ${keyResult.title}`}
                              className="w-11 h-11 sm:w-7 sm:h-7 rounded-md border flex items-center justify-center text-sm font-bold transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30"
                              style={{ borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-secondary))' }}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              aria-label={`Avancement de ${keyResult.title} sur ${keyResult.targetValue}`}
                              value={keyResult.currentValue}
                              onChange={(e) => updateKeyResult(objective.id, keyResult.id, Number(e.target.value))}
                              className="w-14 sm:w-16 px-2 py-1 text-xs sm:text-sm border rounded focus:outline-none text-center"
                              style={{ backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))', borderColor: 'rgb(var(--color-border))' }} />
                            <button
                              type="button"
                              onClick={() => updateKeyResult(objective.id, keyResult.id, keyResult.currentValue + 1)}
                              aria-label={`Augmenter ${keyResult.title}`}
                              className="w-11 h-11 sm:w-7 sm:h-7 rounded-md border flex items-center justify-center text-sm font-bold transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
                              style={{ borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-secondary))' }}
                            >
                              +
                            </button>

                            <span className="text-xs sm:text-sm whitespace-nowrap" style={{ color: 'rgb(var(--color-text-secondary))' }}>/ {keyResult.targetValue}</span>
                          </div>
                          
                          <div className="flex items-center gap-3 w-full">
                            <div className="flex-1 rounded-full h-1.5" style={{ backgroundColor: 'rgb(var(--color-border-muted))' }}>
                              <div className={`h-1.5 rounded-full transition-all duration-500 ${keyResult.completed ? 'bg-green-500' : 'bg-[rgb(var(--color-accent-solid))]'}`} style={{ width: `${Math.min(krProgress, 100)}%` }} />
                            </div>
                            <span className="text-caption sm:text-xs font-medium w-8 text-right" style={{ color: 'rgb(var(--color-text-secondary))' }}>{Math.round(krProgress)}%</span>
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
                        <span className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>Temps effectué</span>
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

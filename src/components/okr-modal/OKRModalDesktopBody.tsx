// Corps desktop (wizard 2 étapes) de OKRModal — extrait verbatim, prop-driven.
import React from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Plus, TrendingUp, Trash2, X, Clock, ArrowRight, ArrowLeft, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DatePicker } from '../ui/date-picker';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import type { Category, KeyResultForm, Objective, OKRInfo } from './logic';

interface OKRModalDesktopBodyProps {
  step: 1 | 2;
  direction: 1 | -1;
  variants: Variants;
  info: OKRInfo;
  setInfo: React.Dispatch<React.SetStateAction<OKRInfo>>;
  keyResults: KeyResultForm[];
  addKR: () => void;
  removeKR: (i: number) => void;
  updateKR: (i: number, field: string, value: string) => void;
  handleNext: () => void;
  handleBack: () => void;
  handleSubmit: () => void;
  handleClose: () => void;
  step1Error: string;
  setStep1Error: React.Dispatch<React.SetStateAction<string>>;
  endDateError: string;
  setEndDateError: React.Dispatch<React.SetStateAction<string>>;
  register: (name: string) => (el: HTMLElement | null) => void;
  isInvalid: (name: string) => boolean;
  clear: (name: string) => void;
  duration: { text: string; isError: boolean } | null;
  KR_PLACEHOLDERS: { title: string; target: string; time: string }[];
  categories: Category[];
  editingObjective?: Objective | null;
  setShowColorSettings: React.Dispatch<React.SetStateAction<boolean>>;
  handleBarWidth: ReturnType<typeof useBottomSheet>['handleBarWidth'];
}

const OKRModalDesktopBody: React.FC<OKRModalDesktopBodyProps> = ({
  step, direction, variants, info, setInfo, keyResults, addKR, removeKR, updateKR,
  handleNext, handleBack, handleSubmit, handleClose, step1Error, setStep1Error, endDateError, setEndDateError,
  register, isInvalid, clear, duration, KR_PLACEHOLDERS, categories, editingObjective, setShowColorSettings,
  handleBarWidth,
}) => (
            <>
              {/* Drag handle — reacts to swipe on mobile */}
              <div className="sm:hidden flex justify-center pt-4 pb-3 shrink-0">
                <motion.div style={{ width: handleBarWidth }} className="h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'rgb(var(--color-border))' }}>
                <div>
                  <p className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: 'rgb(var(--color-text-muted))' }}>
                    {editingObjective ? 'Modifier' : 'Nouvel objectif'} · {step}/2
                  </p>
                  <h2 className="text-sm font-bold leading-tight" style={{ color: 'rgb(var(--color-text-primary))' }}>
                    {step === 1 ? 'Informations générales' : 'Résultats clés (KR)'}
                  </h2>
                </div>
                <Button variant="ghost" size="icon" onClick={handleClose} className="shrink-0">
                  <X size={18} />
                </Button>
              </div>

              {/* Scrollable content */}
              <div data-scroll-area className="flex-1 overflow-y-auto" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
                {/* Progress bar */}
                <div className="flex gap-1.5 px-6 pt-3 pb-1">
                  {[1, 2].map((s) => (
                    <div
                      key={s}
                      className="h-1 flex-1 rounded-full transition-all duration-400"
                      style={{ backgroundColor: step >= s ? 'rgb(var(--color-accent))' : 'rgb(var(--color-border))' }}
                    />
                  ))}
                </div>

                <div style={{ minHeight: 412 }}>
                  <AnimatePresence mode="wait" custom={direction} initial={false}>
                    {step === 1 ? (
                      <motion.div
                        key="step1"
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="px-6 py-5 space-y-4"
                      >
                        {/* Titre */}
                        <div ref={register('title')}>
                          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                            Nom de l'objectif <span className="text-red-500 normal-case">*</span>
                          </label>
                          <input
                            autoFocus
                            type="text"
                            value={info.title}
                            onChange={(e) => { setInfo({ ...info, title: e.target.value }); setStep1Error(''); clear('title'); }}
                            className={`w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 ${step1Error || isInvalid('title') ? 'border-red-400 dark:border-red-500' : ''}`}
                            style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: step1Error || isInvalid('title') ? undefined : 'rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))' }}
                            placeholder="Ex : Améliorer ma santé physique"
                          />
                          {step1Error && <p className="text-xs text-red-500 mt-1">{step1Error}</p>}
                        </div>

                        {/* Description */}
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                            Description
                          </label>
                          <textarea
                            value={info.description}
                            onChange={(e) => setInfo({ ...info, description: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-all resize-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                            style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))' }}
                            placeholder="Ex : Prendre soin de mon corps à travers le sport et l'alimentation"
                          />
                        </div>

                        {/* Catégorie + Date */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                              Catégorie
                            </label>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-all flex items-center gap-2 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                                  style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))' }}
                                >
                                  {(() => {
                                    const cat = categories.find((c) => c.id === info.category);
                                    return cat ? (
                                      <>
                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                        <span className="flex-1 text-left truncate">{cat.name}</span>
                                      </>
                                    ) : (
                                      <span className="flex-1 text-left" style={{ color: 'rgb(var(--color-text-muted))' }}>Choisir...</span>
                                    );
                                  })()}
                                  <ChevronDown size={14} className="shrink-0 ml-auto" style={{ color: 'rgb(var(--color-text-muted))' }} />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-56">
                                {categories.map((c) => (
                                  <DropdownMenuItem
                                    key={c.id}
                                    onSelect={() => setInfo({ ...info, category: c.id })}
                                    className="flex items-center gap-2 cursor-pointer"
                                  >
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                                    {c.name}
                                  </DropdownMenuItem>
                                ))}
                                {categories.length > 0 && <DropdownMenuSeparator />}
                                <DropdownMenuItem
                                  onSelect={(e) => { e.preventDefault(); setShowColorSettings(true); }}
                                  className="flex items-center gap-2 cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                >
                                  <Plus size={14} />
                                  Ajouter une catégorie
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div ref={register('endDate')}>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                              Date de fin <span className="text-red-500 normal-case">*</span>
                            </label>
                            <DatePicker
                              value={info.endDate}
                              onChange={(d) => { setInfo({ ...info, endDate: d }); setEndDateError(''); clear('endDate'); }}
                              placeholder="Choisir une date"
                              className={`h-auto py-2.5 text-sm rounded-lg ${endDateError || isInvalid('endDate') ? 'border-red-400 dark:border-red-500' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'}`}
                            />
                            {endDateError && <p className="text-xs text-red-500 mt-1">{endDateError}</p>}
                          </div>
                        </div>

                        {duration && (
                          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${
                            duration.isError
                              ? 'bg-red-50 border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-800/30 dark:text-red-400'
                              : 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800/30 dark:text-blue-400'
                          }`}>
                            <Clock size={13} />
                            <span>{duration.isError ? duration.text : <>Durée : <strong>{duration.text}</strong></>}</span>
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="step2"
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="px-6 py-5"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>Définissez comment mesurer votre succès</p>
                          <button
                            type="button"
                            onClick={addKR}
                            disabled={keyResults.length >= 10}
                            className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 disabled:opacity-40 transition-colors"
                          >
                            <Plus size={13} /> Ajouter un Résultat clé (KR)
                          </button>
                        </div>

                        <div className="space-y-2.5">
                          {keyResults.map((kr, idx) => {
                            const ph = KR_PLACEHOLDERS[idx % KR_PLACEHOLDERS.length];
                            const krInvalid = idx === 0 && (isInvalid('kr-title') || isInvalid('kr-target'));
                            return (
                              <motion.div
                                key={idx}
                                ref={idx === 0 ? (el) => { register('kr-title')(el); register('kr-target')(el); } : undefined}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                className={`group relative rounded-xl p-4 overflow-hidden transition-all border ${krInvalid ? 'border-red-400 dark:border-red-500' : ''}`}
                                style={{ backgroundColor: 'rgb(var(--color-hover))', borderColor: krInvalid ? undefined : 'rgb(var(--color-border))' }}
                              >
                                {/* accent bar */}
                                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-400/40 group-hover:bg-blue-500 rounded-l-xl transition-colors" />

                                <div className="flex items-center justify-between mb-2.5">
                                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgb(var(--color-text-muted))' }}>Résultat clé {idx + 1}</span>
                                  {keyResults.length > 1 && (
                                    <button type="button" onClick={() => removeKR(idx)} className="hover:text-red-500 transition-colors" style={{ color: 'rgb(var(--color-text-muted))' }}>
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>

                                <input
                                  type="text"
                                  value={kr.title}
                                  onChange={(e) => updateKR(idx, 'title', e.target.value)}
                                  className="w-full px-3 py-2 mb-2.5 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                                  style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))' }}
                                  placeholder={ph.title}
                                />

                                <div className="grid grid-cols-2 gap-2">
                                  <div className="relative">
                                    <input
                                      type="number"
                                      value={kr.targetValue}
                                      onChange={(e) => updateKR(idx, 'targetValue', e.target.value)}
                                      className="w-full px-3 py-2 pr-8 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                                      style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))' }}
                                      placeholder={ph.target}
                                    />
                                    <TrendingUp size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'rgb(var(--color-text-muted))' }} />
                                  </div>
                                  <div className="relative">
                                    <input
                                      type="number"
                                      value={kr.estimatedTime}
                                      onChange={(e) => updateKR(idx, 'estimatedTime', e.target.value)}
                                      className="w-full px-3 py-2 pr-8 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                                      style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))' }}
                                      placeholder={ph.time}
                                    />
                                    <Clock size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'rgb(var(--color-text-muted))' }} />
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t shrink-0" style={{ borderColor: 'rgb(var(--color-border))', backgroundColor: 'rgb(var(--color-hover))' }}>
                {step === 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white
                        bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600
                        shadow-lg shadow-blue-500/25 transition-all active:scale-95"
                    >
                      Résultats clés <ArrowRight size={15} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    >
                      <ArrowLeft size={15} /> Retour
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white
                        bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600
                        shadow-lg shadow-blue-500/25 transition-all active:scale-95"
                    >
                      {editingObjective ? 'Mettre à jour' : "Créer l'objectif"}
                    </button>
                  </>
                )}
              </div>
            </>
);

export default OKRModalDesktopBody;

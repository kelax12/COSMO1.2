import React, { useState, useEffect } from 'react';
import { Plus, TrendingUp, Trash2, X, Clock, ArrowRight, ArrowLeft, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DatePicker } from './ui/date-picker';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCategories } from '@/modules/categories';

type KeyResult = {
  id: string;
  title: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  completed: boolean;
  estimatedTime: number;
  history?: { date: string; increment: number }[];
};

type Objective = {
  id: string;
  title: string;
  description: string;
  category: string;
  startDate: string;
  endDate: string;
  keyResults: KeyResult[];
  completed: boolean;
  estimatedTime: number;
};

type Category = { id: string; name: string; color: string };

type KeyResultForm = {
  title: string;
  targetValue: string;
  currentValue: string;
  estimatedTime: string;
};

type OKRModalProps = {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  editingObjective?: Objective | null;
  onSubmit: (data: Omit<Objective, 'id'>, isEditing: boolean) => void;
};

const OKRModal: React.FC<OKRModalProps> = ({ isOpen, onClose, categories, editingObjective, onSubmit }) => {
  const { data: allCategories = [] } = useCategories();
  const [step, setStep] = useState<1 | 2>(1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [step1Error, setStep1Error] = useState('');

  const [info, setInfo] = useState({ title: '', description: '', category: '', endDate: '' });
  const [keyResults, setKeyResults] = useState<KeyResultForm[]>([
    { title: '', targetValue: '', currentValue: '', estimatedTime: '' },
    { title: '', targetValue: '', currentValue: '', estimatedTime: '' },
    { title: '', targetValue: '', currentValue: '', estimatedTime: '' },
  ]);

  useEffect(() => {
    if (editingObjective) {
      setInfo({
        title: editingObjective.title,
        description: editingObjective.description,
        category: editingObjective.category,
        endDate: editingObjective.endDate ? editingObjective.endDate.split('T')[0] : '',
      });
      setKeyResults(
        editingObjective.keyResults.map((kr) => ({
          title: kr.title ?? '',
          targetValue: (kr.targetValue ?? 0).toString(),
          currentValue: (kr.currentValue ?? 0).toString(),
          estimatedTime: (kr.estimatedTime ?? 30).toString(),
        }))
      );
    } else {
      resetForm();
    }
    setStep(1);
    setStep1Error('');
  }, [editingObjective, isOpen]);

  const resetForm = () => {
    setInfo({ title: '', description: '', category: allCategories[0]?.id ?? '', endDate: '' });
    setKeyResults([
      { title: '', targetValue: '', currentValue: '', estimatedTime: '' },
      { title: '', targetValue: '', currentValue: '', estimatedTime: '' },
      { title: '', targetValue: '', currentValue: '', estimatedTime: '' },
    ]);
    setStep1Error('');
  };

  const handleClose = () => { resetForm(); setStep(1); onClose(); };

  const handleNext = () => {
    if (!info.title.trim()) { setStep1Error("Veuillez saisir un titre."); return; }
    setStep1Error('');
    setDirection(1);
    setStep(2);
  };

  const handleBack = () => { setDirection(-1); setStep(1); };

  const addKR = () => {
    if (keyResults.length < 10)
      setKeyResults([...keyResults, { title: '', targetValue: '', currentValue: '', estimatedTime: '' }]);
  };

  const removeKR = (i: number) => {
    if (keyResults.length > 1) setKeyResults(keyResults.filter((_, idx) => idx !== i));
  };

  const updateKR = (i: number, field: string, value: string) =>
    setKeyResults(keyResults.map((kr, idx) => (idx === i ? { ...kr, [field]: value } : kr)));

  const handleSubmit = () => {
    const valid = keyResults.filter((kr) => kr.title.trim() && kr.targetValue && Number(kr.targetValue) > 0);
    if (valid.length === 0) { alert('Ajoutez au moins un résultat clé valide.'); return; }
    onSubmit(
      {
        title: info.title,
        description: info.description,
        category: info.category,
        startDate: editingObjective ? editingObjective.startDate : new Date().toISOString().split('T')[0],
        endDate: info.endDate,
        completed: false,
        estimatedTime: valid.reduce((s, kr) => s + Number(kr.estimatedTime) * Number(kr.targetValue), 0),
        keyResults: valid.map((kr, i) => ({
          id: editingObjective?.keyResults[i]?.id ?? crypto.randomUUID(),
          title: kr.title,
          currentValue: Number(kr.currentValue) || 0,
          targetValue: Number(kr.targetValue),
          unit: '',
          completed: Number(kr.currentValue) >= Number(kr.targetValue),
          estimatedTime: Number(kr.estimatedTime) || 30,
          history: editingObjective ? editingObjective.keyResults[i]?.history || [] : [],
        })),
      },
      !!editingObjective
    );
    resetForm();
    setStep(1);
    onClose();
  };

  const calcDuration = () => {
    const start = editingObjective ? editingObjective.startDate : new Date().toISOString().split('T')[0];
    if (!start || !info.endDate) return null;
    const diff = new Date(info.endDate).getTime() - new Date(start).getTime();
    if (diff < 0) return { text: "La date doit être dans le futur", isError: true };
    const days = Math.ceil(diff / 86400000);
    if (days < 7) return { text: `${days}j`, isError: false };
    if (days < 32) {
      const w = Math.floor(days / 7), r = days % 7;
      return { text: `${w} sem.${r ? ` ${r}j` : ''}`, isError: false };
    }
    const m = Math.floor(days / 30), r = days % 30;
    return { text: `${m} mois${r ? ` ${r}j` : ''}`, isError: false };
  };
  const duration = calcDuration();

  const variants = {
    enter: (d: number) => ({ x: d * 40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d * -40, opacity: 0 }),
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 border-0 sm:max-w-[624px] w-full overflow-hidden rounded-2xl shadow-2xl"
      >
        <DialogTitle className="sr-only">
          {editingObjective ? "Modifier l'objectif" : 'Nouvel Objectif'}
        </DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <div>
            <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold">
              {editingObjective ? 'Modifier' : 'Nouvel objectif'} · {step}/2
            </p>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">
              {step === 1 ? 'Informations générales' : 'Résultats clés (KR)'}
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose} className="shrink-0">
            <X size={18} />
          </Button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5 px-6 pt-3 pb-1">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all duration-400 ${
                step >= s ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Animated content */}
        <div className="overflow-hidden" style={{ minHeight: 412 }}>
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
                className="px-6 py-5 space-y-4 overflow-y-auto"
                style={{ maxHeight: 454 }}
              >
                {/* Titre */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Nom de l'objectif <span className="text-red-500 normal-case">*</span>
                  </label>
                  <input
                    autoFocus
                    type="text"
                    value={info.title}
                    onChange={(e) => { setInfo({ ...info, title: e.target.value }); setStep1Error(''); }}
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm bg-white dark:bg-slate-800 outline-none transition-all
                      focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500
                      ${step1Error ? 'border-red-400' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'}`}
                    placeholder="Ex : Améliorer ma santé physique"
                  />
                  {step1Error && <p className="text-xs text-red-500 mt-1">{step1Error}</p>}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={info.description}
                    onChange={(e) => setInfo({ ...info, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 outline-none transition-all resize-none
                      hover:border-slate-300 dark:hover:border-slate-500 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    placeholder="Ex : Prendre soin de mon corps à travers le sport et l'alimentation"
                  />
                </div>

                {/* Catégorie + Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Catégorie
                    </label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 outline-none transition-all flex items-center gap-2
                            hover:border-slate-300 dark:hover:border-slate-500 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                        >
                          {(() => {
                            const cat = categories.find((c) => c.id === info.category);
                            return cat ? (
                              <>
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                <span className="flex-1 text-left truncate">{cat.name}</span>
                              </>
                            ) : (
                              <span className="flex-1 text-left text-slate-400">Choisir...</span>
                            );
                          })()}
                          <ChevronDown size={14} className="text-slate-400 shrink-0 ml-auto" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48">
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
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Échéance
                    </label>
                    <DatePicker
                      value={info.endDate}
                      onChange={(d) => setInfo({ ...info, endDate: d })}
                      placeholder="Choisir une date"
                      className="h-auto py-2.5 text-sm rounded-lg border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500"
                    />
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
                className="px-6 py-5 overflow-y-auto"
                style={{ maxHeight: 454 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-slate-400">Définissez comment mesurer votre succès</p>
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
                    const KR_PLACEHOLDERS = [
                      { title: 'Ex : Faire 10 sorties longues en plein air', target: 'Cible (ex : 10)', time: 'Min. par sortie (ex : 120)' },
                      { title: 'Ex : Faire 50 séances de salle de sport', target: 'Cible (ex : 50)', time: 'Min. par séance (ex : 60)' },
                      { title: 'Ex : Apprendre le muscle-up', target: 'Cible (ex : 1)', time: 'Min. estimées (ex : 600)' },
                      { title: 'Ex : Cuisiner 60 repas healthy', target: 'Cible (ex : 60)', time: 'Min. par repas (ex : 60)' },
                      { title: 'Ex : Courir un semi-marathon', target: 'Cible (ex : 1)', time: 'Min. par entraînement (ex : 45)' },
                    ];
                    const ph = KR_PLACEHOLDERS[idx % KR_PLACEHOLDERS.length];
                    return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="group relative bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 overflow-hidden transition-all"
                    >
                      {/* accent bar */}
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-400/40 group-hover:bg-blue-500 rounded-l-xl transition-colors" />

                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Résultat clé {idx + 1}</span>
                        {keyResults.length > 1 && (
                          <button type="button" onClick={() => removeKR(idx)} className="text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        value={kr.title}
                        onChange={(e) => updateKR(idx, 'title', e.target.value)}
                        className="w-full px-3 py-2 mb-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 outline-none transition-all
                          focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 hover:border-slate-300"
                        placeholder={ph.title}
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <input
                            type="number"
                            value={kr.targetValue}
                            onChange={(e) => updateKR(idx, 'targetValue', e.target.value)}
                            className="w-full px-3 py-2 pr-8 rounded-lg border border-slate-200 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 outline-none transition-all
                              focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 hover:border-slate-300"
                            placeholder={ph.target}
                          />
                          <TrendingUp size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            value={kr.estimatedTime}
                            onChange={(e) => updateKR(idx, 'estimatedTime', e.target.value)}
                            className="w-full px-3 py-2 pr-8 rounded-lg border border-slate-200 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 outline-none transition-all
                              focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 hover:border-slate-300"
                            placeholder={ph.time}
                          />
                          <Clock size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
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

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
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
      </DialogContent>
    </Dialog>
  );
};

export default OKRModal;

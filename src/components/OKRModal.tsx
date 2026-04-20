import React, { useState, useEffect } from 'react';
import { Plus, TrendingUp, Trash2, X, Clock, ArrowRight, ArrowLeft, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DatePicker } from './ui/date-picker';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { Button } from '@/components/ui/button';
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

type Category = {
  id: string;
  name: string;
  color: string;
};

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

const slideVariants = {
  enterFromRight: { x: 40, opacity: 0 },
  enterFromLeft:  { x: -40, opacity: 0 },
  center:         { x: 0, opacity: 1 },
  exitToLeft:     { x: -40, opacity: 0 },
  exitToRight:    { x: 40, opacity: 0 },
};

const OKRModal: React.FC<OKRModalProps> = ({ isOpen, onClose, categories, editingObjective, onSubmit }) => {
  const { data: allCategories = [] } = useCategories();

  const [step, setStep] = useState<1 | 2>(1);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  const [newObjective, setNewObjective] = useState({
    title: '',
    description: '',
    category: '',
    endDate: '',
  });

  const [keyResults, setKeyResults] = useState<KeyResultForm[]>([
    { title: '', targetValue: '', currentValue: '', estimatedTime: '' },
    { title: '', targetValue: '', currentValue: '', estimatedTime: '' },
    { title: '', targetValue: '', currentValue: '', estimatedTime: '' },
  ]);

  const [step1Error, setStep1Error] = useState('');

  useEffect(() => {
    if (editingObjective) {
      setNewObjective({
        title: editingObjective.title,
        description: editingObjective.description,
        category: editingObjective.category,
        endDate: editingObjective.endDate,
      });
      setKeyResults(
        editingObjective.keyResults.map((kr) => ({
          title: kr.title,
          targetValue: kr.targetValue.toString(),
          currentValue: kr.currentValue.toString(),
          estimatedTime: kr.estimatedTime.toString(),
        }))
      );
    } else {
      resetForm();
    }
    setStep(1);
    setStep1Error('');
  }, [editingObjective, isOpen]);

  const calculateDuration = (start: string, end: string) => {
    if (!start || !end) return null;
    const diffTime = new Date(end).getTime() - new Date(start).getTime();
    if (diffTime < 0) return { text: "La date d'échéance doit être après la date de début", isError: true };
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return { text: "Moins d'un jour", isError: false };
    if (diffDays < 7) return { text: `${diffDays} jour${diffDays > 1 ? 's' : ''}`, isError: false };
    if (diffDays < 32) {
      const weeks = Math.floor(diffDays / 7);
      const rem = diffDays % 7;
      return { text: `${weeks} semaine${weeks > 1 ? 's' : ''}${rem > 0 ? ` et ${rem} jour${rem > 1 ? 's' : ''}` : ''}`, isError: false };
    }
    const months = Math.floor(diffDays / 30);
    const rem = diffDays % 30;
    return { text: `${months} mois${rem > 0 ? ` et ${rem} jour${rem > 1 ? 's' : ''}` : ''}`, isError: false };
  };

  const resetForm = () => {
    setNewObjective({ title: '', description: '', category: allCategories[0]?.id ?? '', endDate: '' });
    setKeyResults([
      { title: '', targetValue: '', currentValue: '', estimatedTime: '' },
      { title: '', targetValue: '', currentValue: '', estimatedTime: '' },
      { title: '', targetValue: '', currentValue: '', estimatedTime: '' },
    ]);
    setStep1Error('');
  };

  const handleClose = () => {
    resetForm();
    setStep(1);
    onClose();
  };

  const handleNext = () => {
    if (!newObjective.title.trim()) {
      setStep1Error("Veuillez saisir un titre pour l'objectif.");
      return;
    }
    setStep1Error('');
    setDirection('forward');
    setStep(2);
  };

  const handleBack = () => {
    setDirection('back');
    setStep(1);
  };

  const addKeyResult = () => {
    if (keyResults.length < 10) {
      setKeyResults([...keyResults, { title: '', targetValue: '', currentValue: '', estimatedTime: '' }]);
    }
  };

  const removeKeyResult = (index: number) => {
    if (keyResults.length > 1) setKeyResults(keyResults.filter((_, i) => i !== index));
  };

  const updateKeyResultField = (index: number, field: string, value: string) => {
    setKeyResults(keyResults.map((kr, i) => (i === index ? { ...kr, [field]: value } : kr)));
  };

  const handleSubmit = () => {
    const validKRs = keyResults.filter((kr) => kr.title.trim() && kr.targetValue && Number(kr.targetValue) > 0);
    if (validKRs.length === 0) {
      alert('Veuillez définir au moins un résultat clé valide.');
      return;
    }
    const objData: Omit<Objective, 'id'> = {
      title: newObjective.title,
      description: newObjective.description,
      category: newObjective.category,
      startDate: editingObjective ? editingObjective.startDate : new Date().toISOString().split('T')[0],
      endDate: newObjective.endDate,
      completed: false,
      estimatedTime: validKRs.reduce((s, kr) => s + Number(kr.estimatedTime) * Number(kr.targetValue), 0),
      keyResults: validKRs.map((kr, i) => ({
        id: editingObjective ? editingObjective.keyResults[i]?.id || `${Date.now()}-${i}` : `${Date.now()}-${i}`,
        title: kr.title,
        currentValue: Number(kr.currentValue) || 0,
        targetValue: Number(kr.targetValue),
        unit: '',
        completed: Number(kr.currentValue) >= Number(kr.targetValue),
        estimatedTime: Number(kr.estimatedTime) || 30,
        history: editingObjective ? editingObjective.keyResults[i]?.history || [] : [],
      })),
    };
    onSubmit(objData, !!editingObjective);
    resetForm();
    setStep(1);
    onClose();
  };

  const startDate = editingObjective ? editingObjective.startDate : new Date().toISOString().split('T')[0];
  const duration = calculateDuration(startDate, newObjective.endDate);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        showCloseButton={false}
        fullScreenMobile={true}
        className="p-0 border-0 sm:bg-transparent sm:shadow-none sm:max-w-2xl w-full h-full md:h-auto md:max-h-[90vh] overflow-hidden"
      >
        <DialogTitle className="sr-only">
          {editingObjective ? "Modifier l'objectif" : 'Nouvel Objectif'}
        </DialogTitle>

        <div className="md:rounded-xl md:shadow-2xl w-full h-full flex flex-col bg-white dark:bg-slate-800 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-700 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <Target size={16} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">
                  {editingObjective ? 'Modifier' : 'Nouvel objectif'} — étape {step}/2
                </p>
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  {step === 1 ? 'Informations générales' : 'Résultats clés'}
                </h2>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X size={18} />
            </Button>
          </div>

          {/* Step indicator */}
          <div className="px-6 pt-4 shrink-0">
            <div className="flex items-center gap-2">
              <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step >= 1 ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
              <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step >= 2 ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait" initial={false}>
              {step === 1 ? (
                <motion.div
                  key="step1"
                  initial={direction === 'back' ? slideVariants.enterFromLeft : slideVariants.enterFromRight}
                  animate={slideVariants.center}
                  exit={direction === 'back' ? slideVariants.exitToRight : slideVariants.exitToLeft}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="absolute inset-0 overflow-y-auto px-6 py-5 space-y-5"
                >
                  {/* Titre */}
                  <div>
                    <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-200">
                      Nom de l'objectif <span className="text-red-500">*</span>
                    </label>
                    <input
                      autoFocus
                      type="text"
                      value={newObjective.title}
                      onChange={(e) => { setNewObjective({ ...newObjective, title: e.target.value }); setStep1Error(''); }}
                      className={`w-full p-3 bg-white dark:bg-slate-800 border rounded-lg outline-none transition-all hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${step1Error ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'}`}
                      placeholder="Ex: Améliorer ma condition physique"
                    />
                    {step1Error && <p className="text-xs text-red-500 mt-1">{step1Error}</p>}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-200">
                      Description
                    </label>
                    <textarea
                      value={newObjective.description}
                      onChange={(e) => setNewObjective({ ...newObjective, description: e.target.value })}
                      className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none transition-all resize-none hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Ex: Courir un marathon avant la fin de l'année"
                      rows={3}
                    />
                  </div>

                  {/* Catégorie + Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-200">
                        Catégorie
                      </label>
                      <select
                        value={newObjective.category}
                        onChange={(e) => setNewObjective({ ...newObjective, category: e.target.value })}
                        className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none transition-all appearance-none hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-200">
                        Date d'échéance
                      </label>
                      <DatePicker
                        value={newObjective.endDate}
                        onChange={(date) => setNewObjective({ ...newObjective, endDate: date })}
                        placeholder="Sélectionner une date"
                      />
                    </div>
                  </div>

                  {duration && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-sm ${
                        duration.isError
                          ? 'bg-red-50 border-red-100 text-red-600 dark:bg-red-900/20 dark:border-red-800/30 dark:text-red-400'
                          : 'bg-indigo-50 border-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:border-indigo-800/30 dark:text-indigo-400'
                      }`}
                    >
                      <Clock size={15} />
                      <span>
                        {!duration.isError && "Durée de l'objectif : "}
                        <strong>{duration.text}</strong>
                      </span>
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="step2"
                  initial={direction === 'back' ? slideVariants.enterFromLeft : slideVariants.enterFromRight}
                  animate={slideVariants.center}
                  exit={direction === 'back' ? slideVariants.exitToRight : slideVariants.exitToLeft}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="absolute inset-0 overflow-y-auto px-6 py-5 space-y-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-slate-400">
                      Définissez comment mesurer votre succès
                    </p>
                    <button
                      type="button"
                      onClick={addKeyResult}
                      disabled={keyResults.length >= 10}
                      className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 disabled:opacity-40 transition-colors"
                    >
                      <Plus size={14} />
                      Ajouter un KR
                    </button>
                  </div>

                  {keyResults.map((kr, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="group relative p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl transition-all hover:border-blue-300 dark:hover:border-blue-700 overflow-hidden"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-300/50 group-hover:bg-blue-500 transition-colors rounded-l-xl" />

                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          KR {idx + 1}
                        </span>
                        {keyResults.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeKeyResult(idx)}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        <input
                          type="text"
                          value={kr.title}
                          onChange={(e) => updateKeyResultField(idx, 'title', e.target.value)}
                          className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                          placeholder="Ex: Courir 3x par semaine pendant 3 mois"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <div className="relative">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Objectif cible</label>
                            <input
                              type="number"
                              value={kr.targetValue}
                              onChange={(e) => updateKeyResultField(idx, 'targetValue', e.target.value)}
                              className="w-full p-2.5 pr-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                              placeholder="100"
                            />
                            <TrendingUp size={13} className="absolute right-2.5 bottom-3 text-slate-400" />
                          </div>
                          <div className="relative">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Temps/unité (min)</label>
                            <input
                              type="number"
                              value={kr.estimatedTime}
                              onChange={(e) => updateKeyResultField(idx, 'estimatedTime', e.target.value)}
                              className="w-full p-2.5 pr-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                              placeholder="60"
                            />
                            <Clock size={13} className="absolute right-2.5 bottom-3 text-slate-400" />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 shrink-0">
            {step === 1 ? (
              <>
                <Button variant="ghost" onClick={handleClose} className="text-slate-500">
                  Annuler
                </Button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/25 transition-all"
                >
                  Résultats clés
                  <ArrowRight size={16} />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                >
                  <ArrowLeft size={16} />
                  Retour
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/25 transition-all"
                >
                  {editingObjective ? 'Mettre à jour' : "Créer l'objectif"}
                </button>
              </>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OKRModal;

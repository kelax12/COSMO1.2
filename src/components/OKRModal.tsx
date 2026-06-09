import React, { useState, useEffect } from 'react';
import { Plus, TrendingUp, Trash2, X, Clock, ArrowRight, ArrowLeft, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import { useInvalidShake } from '@/hooks/use-invalid-shake';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DatePicker } from './ui/date-picker';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCategories } from '@/modules/categories';
import ColorSettingsModal from './ColorSettingsModal';
import { calcOkrDuration, validKeyResults } from './okr-modal/logic';

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
  const isMobile = useIsMobile();
  const { register, trigger, clear, isInvalid } = useInvalidShake();
  const [step, setStep] = useState<1 | 2>(1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [step1Error, setStep1Error] = useState('');
  const [endDateError, setEndDateError] = useState('');
  const [showColorSettings, setShowColorSettings] = useState(false);

  /* Mobile-specific UI state */
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showDescMobile, setShowDescMobile] = useState(false);

  const [info, setInfo] = useState({ title: '', description: '', category: '', endDate: '' });
  const [keyResults, setKeyResults] = useState<KeyResultForm[]>([
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
      setShowDescMobile(Boolean(editingObjective.description));
    } else {
      resetForm();
    }
    setStep(1);
    setStep1Error('');
    setEndDateError('');
    // Init du form à l'ouverture / au changement d'OKR édité ; resetForm est
    // volontairement omis (réinitialiserait le form à chaque render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingObjective, isOpen]);

  const resetForm = () => {
    setInfo({ title: '', description: '', category: allCategories[0]?.id ?? '', endDate: '' });
    setKeyResults([
      { title: '', targetValue: '', currentValue: '', estimatedTime: '' },
      { title: '', targetValue: '', currentValue: '', estimatedTime: '' },
    ]);
    setStep1Error('');
    setEndDateError('');
    setShowDescMobile(false);
  };

  const handleClose = () => { resetForm(); setStep(1); onClose(); };
  const { sheetRef, handleBarWidth, sheetDragProps } = useBottomSheet(handleClose);

  const validateStep1 = (): boolean => {
    const missing: string[] = [];
    if (!info.title.trim()) { setStep1Error("Veuillez saisir un titre."); missing.push('title'); }
    if (!info.endDate) { setEndDateError("Veuillez choisir une date de fin."); missing.push('endDate'); }
    if (missing.length) { trigger(missing); return false; }
    setStep1Error('');
    setEndDateError('');
    return true;
  };

  const handleNext = () => {
    if (!validateStep1()) return;
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

  const updateKR = (i: number, field: string, value: string) => {
    setKeyResults(keyResults.map((kr, idx) => (idx === i ? { ...kr, [field]: value } : kr)));
    if (field === 'title') clear('kr-title');
    if (field === 'targetValue') clear('kr-target');
  };

  const handleSubmit = () => {
    const valid = validKeyResults(keyResults);
    if (valid.length === 0) {
      const first = keyResults[0];
      const missing: string[] = [];
      if (!first?.title.trim()) missing.push('kr-title');
      if (!first?.targetValue || Number(first.targetValue) <= 0) missing.push('kr-target');
      trigger(missing.length ? missing : ['kr-title']);
      return;
    }
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

  const handleMobileSave = () => {
    if (!validateStep1()) return;
    handleSubmit();
  };

  const duration = calcOkrDuration(
    editingObjective ? editingObjective.startDate : new Date().toISOString().split('T')[0],
    info.endDate
  );

  const variants = {
    enter: (d: number) => ({ x: d * 40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d * -40, opacity: 0 }),
  };

  const selectedCategory = categories.find((c) => c.id === info.category);

  const KR_PLACEHOLDERS = [
    { title: 'Ex : Faire 10 sorties longues en plein air', target: 'Cible (ex : 10)', time: 'Min. par sortie (ex : 120)' },
    { title: 'Ex : Faire 50 séances de salle de sport', target: 'Cible (ex : 50)', time: 'Min. par séance (ex : 60)' },
    { title: 'Ex : Apprendre le muscle-up', target: 'Cible (ex : 1)', time: 'Min. estimées (ex : 600)' },
    { title: 'Ex : Cuisiner 60 repas healthy', target: 'Cible (ex : 60)', time: 'Min. par repas (ex : 60)' },
    { title: 'Ex : Courir un semi-marathon', target: 'Cible (ex : 1)', time: 'Min. par entraînement (ex : 45)' },
  ];

  if (!isOpen) return null;

  return (
    <>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-md"
        onClick={handleClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          ref={sheetRef}
          {...sheetDragProps}
          className="w-full sm:max-w-[624px] sm:rounded-2xl rounded-t-[28px] shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl flex flex-col max-h-[88vh] sm:max-h-[90vh] overflow-hidden"
          style={{
            backgroundColor: 'rgb(var(--color-surface))',
            paddingBottom: isMobile ? 0 : 'env(safe-area-inset-bottom)',
          }}
          onClick={(e) => e.stopPropagation()}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '110%', opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
          transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
        >
          {isMobile ? (
            /* ── MOBILE iOS ── */
            <div className="flex flex-col bg-gray-50 dark:bg-gray-950 rounded-t-3xl min-h-0">
              {/* Drag handle */}
              <div className="flex justify-center pt-2.5 shrink-0">
                <motion.div style={{ width: handleBarWidth }} className="h-1 rounded-full bg-gray-300/70 dark:bg-gray-600/60" />
              </div>

              {/* iOS Header */}
              <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200/80 dark:border-gray-800 shrink-0">
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-blue-500 text-[15px] min-w-16 min-h-11 flex items-center"
                >
                  Annuler
                </button>
                <span className="text-[17px] font-semibold text-gray-900 dark:text-gray-100">
                  {editingObjective ? 'Modifier' : 'Nouvel objectif'}
                </span>
                <button
                  type="button"
                  onClick={handleMobileSave}
                  className={`text-[15px] font-semibold min-w-16 min-h-11 flex items-center justify-end ${
                    info.title.trim() ? 'text-blue-500' : 'text-blue-300'
                  }`}
                >
                  {editingObjective ? 'OK' : 'Créer'}
                </button>
              </div>

              {/* Scroll area */}
              <div data-scroll-area className="flex-1 overflow-y-auto px-4 py-4 min-h-0">

                {/* Groupe 1 — Titre (sans overflow-hidden) */}
                <div
                  ref={register('title')}
                  className={`bg-white dark:bg-gray-900 rounded-2xl shadow-sm transition-[box-shadow] ${
                    isInvalid('title') ? 'ring-2 ring-red-500' : ''
                  }`}
                >
                  <input
                    type="text"
                    value={info.title}
                    onChange={(e) => { setInfo({ ...info, title: e.target.value }); setStep1Error(''); clear('title'); }}
                    placeholder="Nom de l'objectif"
                    autoFocus
                    className={`w-full px-4 min-h-12 text-[17px] bg-transparent focus:outline-none focus:ring-0 placeholder-gray-400 dark:placeholder-gray-600 ${
                      step1Error ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'
                    }`}
                    style={{ border: 'none' }}
                  />
                </div>
                {step1Error && (
                  <p className="text-xs text-red-500 px-4 pt-1">{step1Error}</p>
                )}

                {/* Section DÉTAILS */}
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 pb-1 pt-5">
                  Détails
                </p>
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden">

                  {/* Description toggle */}
                  {showDescMobile ? (
                    <div className="px-4 py-3">
                      <textarea
                        value={info.description}
                        onChange={(e) => setInfo({ ...info, description: e.target.value })}
                        rows={3}
                        autoFocus={!info.description}
                        placeholder="Description de l'objectif…"
                        className="w-full text-[15px] bg-transparent focus:outline-none focus:ring-0 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 resize-none"
                        style={{ border: 'none' }}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowDescMobile(true)}
                      className="flex items-center px-4 min-h-11 w-full active:bg-gray-100 dark:active:bg-gray-800"
                    >
                      <span className="flex-1 text-left text-[15px] text-gray-900 dark:text-gray-100">Description</span>
                      <span className="text-[15px] text-gray-400 mr-1">Ajouter</span>
                      <ChevronRight size={16} className="text-gray-400" />
                    </button>
                  )}

                  <div className="h-px bg-gray-200/80 dark:bg-gray-700/60 ml-4" />

                  {/* Catégorie */}
                  <button
                    type="button"
                    onClick={() => setShowCategorySheet(true)}
                    className="flex items-center px-4 min-h-11 w-full active:bg-gray-100 dark:active:bg-gray-800"
                  >
                    <span className="flex-1 text-left text-[15px] text-gray-900 dark:text-gray-100">Catégorie</span>
                    {selectedCategory ? (
                      <span className="flex items-center gap-1.5 text-[15px] text-blue-500 mr-1">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selectedCategory.color }} />
                        {selectedCategory.name}
                      </span>
                    ) : (
                      <span className="text-[15px] text-gray-400 mr-1">Aucune</span>
                    )}
                    <ChevronRight size={16} className="text-gray-400" />
                  </button>

                  <div className="h-px bg-gray-200/80 dark:bg-gray-700/60 ml-4" />

                  {/* Date de fin — native date input */}
                  <div
                    ref={register('endDate')}
                    className={`flex items-center px-4 min-h-11 relative transition-[box-shadow] ${
                      isInvalid('endDate') ? 'ring-2 ring-red-500 rounded-lg' : ''
                    }`}
                  >
                    <span className="flex-1 text-[15px] text-gray-900 dark:text-gray-100">Date de fin</span>
                    <span className={`text-[15px] mr-1 ${endDateError || isInvalid('endDate') ? 'text-red-500' : info.endDate ? 'text-blue-500' : 'text-gray-400'}`}>
                      {info.endDate
                        ? format(new Date(info.endDate + 'T12:00:00'), 'd MMM yyyy', { locale: fr })
                        : 'Aucune'}
                    </span>
                    <ChevronRight size={16} className="text-gray-400" />
                    <input
                      type="date"
                      value={info.endDate}
                      onChange={(e) => { setInfo({ ...info, endDate: e.target.value }); setEndDateError(''); clear('endDate'); }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      style={{ border: 'none' }}
                    />
                  </div>

                  {/* Durée calculée */}
                  {duration && (
                    <>
                      <div className="h-px bg-gray-200/80 dark:bg-gray-700/60 ml-4" />
                      <div className="flex items-center px-4 min-h-11">
                        <span className="flex-1 text-[15px] text-gray-900 dark:text-gray-100">Durée</span>
                        <span className={`text-[15px] ${duration.isError ? 'text-red-500' : 'text-blue-500'}`}>
                          {duration.text}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Section RÉSULTATS CLÉS */}
                <div className="flex items-center justify-between px-1 pb-1 pt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-3">
                    Résultats clés
                  </p>
                  <button
                    type="button"
                    onClick={addKR}
                    disabled={keyResults.length >= 10}
                    className="flex items-center gap-1 text-[13px] font-semibold text-blue-500 disabled:opacity-40 px-3"
                  >
                    <Plus size={13} /> Ajouter
                  </button>
                </div>

                <div className="space-y-3">
                  {keyResults.map((kr, idx) => {
                    const ph = KR_PLACEHOLDERS[idx % KR_PLACEHOLDERS.length];
                    const krInvalid = idx === 0 && (isInvalid('kr-title') || isInvalid('kr-target'));
                    return (
                      <div
                        key={idx}
                        ref={idx === 0 ? (el) => { register('kr-title')(el); register('kr-target')(el); } : undefined}
                        className={`bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden transition-[box-shadow] ${
                          krInvalid ? 'ring-2 ring-red-500' : ''
                        }`}
                      >
                        {/* KR header */}
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200/80 dark:border-gray-700/60">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                            Résultat clé {idx + 1}
                          </span>
                          {keyResults.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeKR(idx)}
                              aria-label="Supprimer ce résultat clé"
                              className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>

                        {/* Titre KR */}
                        <input
                          type="text"
                          value={kr.title}
                          onChange={(e) => updateKR(idx, 'title', e.target.value)}
                          placeholder={ph.title}
                          className="w-full px-4 py-3 text-[15px] bg-transparent focus:outline-none focus:ring-0 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600"
                          style={{ border: 'none' }}
                        />

                        <div className="h-px bg-gray-200/80 dark:bg-gray-700/60 ml-4" />

                        {/* Cible */}
                        <div className="flex items-center px-4 min-h-11">
                          <span className="flex-1 text-[15px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                            <TrendingUp size={14} className="text-gray-400" />
                            Cible
                          </span>
                          <input
                            type="number"
                            value={kr.targetValue}
                            onChange={(e) => updateKR(idx, 'targetValue', e.target.value)}
                            placeholder="0"
                            className="w-24 text-right text-[15px] text-blue-500 bg-transparent focus:outline-none focus:ring-0"
                            style={{ border: 'none' }}
                          />
                        </div>

                        <div className="h-px bg-gray-200/80 dark:bg-gray-700/60 ml-4" />

                        {/* Durée par unité */}
                        <div className="flex items-center px-4 min-h-11">
                          <span className="flex-1 text-[15px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                            <Clock size={14} className="text-gray-400" />
                            Durée/unité (min)
                          </span>
                          <input
                            type="number"
                            value={kr.estimatedTime}
                            onChange={(e) => updateKR(idx, 'estimatedTime', e.target.value)}
                            placeholder="30"
                            className="w-24 text-right text-[15px] text-blue-500 bg-transparent focus:outline-none focus:ring-0"
                            style={{ border: 'none' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Espace bas */}
                <div className="h-4" />
              </div>

              {/* Footer CTA */}
              <div
                className="px-4 pt-3 border-t border-gray-100 dark:border-gray-800 shrink-0"
                style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
              >
                <button
                  type="button"
                  onClick={handleMobileSave}
                  className={`w-full h-[50px] rounded-2xl text-[17px] font-semibold text-white transition-colors ${
                    info.title.trim() ? 'bg-blue-600 active:bg-blue-700' : 'bg-blue-200 dark:bg-blue-900/40'
                  }`}
                >
                  {editingObjective ? "Mettre à jour" : "Créer l'objectif"}
                </button>
              </div>
            </div>
          ) : (
            /* ── DESKTOP (inchangé) ── */
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
          )}
        </motion.div>
      </motion.div>

      {/* Action sheet catégorie (mobile) */}
      <AnimatePresence>
        {showCategorySheet && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[60] flex items-end"
            onClick={() => setShowCategorySheet(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
              transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
              className="w-full bg-white dark:bg-gray-900 rounded-t-2xl overflow-hidden"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-9 h-1 rounded-full bg-gray-300/70 dark:bg-gray-600/60" />
              </div>
              <p className="text-[13px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-2">
                Catégorie
              </p>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                <button
                  type="button"
                  onClick={() => { setInfo({ ...info, category: '' }); setShowCategorySheet(false); }}
                  className="flex items-center px-4 min-h-11 w-full active:bg-gray-100 dark:active:bg-gray-800"
                >
                  <span className="flex-1 text-left text-[15px] text-gray-400">Aucune</span>
                  {!info.category && <Check size={16} className="text-blue-500" />}
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setInfo({ ...info, category: c.id }); setShowCategorySheet(false); }}
                    className="flex items-center gap-3 px-4 min-h-11 w-full active:bg-gray-100 dark:active:bg-gray-800"
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="flex-1 text-left text-[15px] text-gray-900 dark:text-gray-100">{c.name}</span>
                    {info.category === c.id && <Check size={16} className="text-blue-500" />}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => { setShowCategorySheet(false); setShowColorSettings(true); }}
                  className="flex items-center gap-2 px-4 min-h-11 w-full active:bg-gray-100 dark:active:bg-gray-800"
                >
                  <Plus size={14} className="text-blue-500" />
                  <span className="text-[15px] text-blue-500 font-medium">Créer une catégorie</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ColorSettingsModal
        isOpen={showColorSettings}
        onClose={() => setShowColorSettings(false)}
        isNested
      />
    </>
  );
};

export default OKRModal;

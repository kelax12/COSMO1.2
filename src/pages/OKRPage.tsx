import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Edit2, Trash2, CheckCircle, Clock, X, Target, Trash } from 'lucide-react';
import { getColorHex } from '../components/CategoryManager';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useCreateEvent } from '@/modules/events';
import { useOkrs, useCreateOkr, useUpdateOkr, useDeleteOkr, useUpdateKeyResult, OKR, KeyResult } from '@/modules/okrs';
import { useCategories, useCreateCategory, useDeleteCategory } from '@/modules/categories';
import TaskModal from '../components/TaskModal';
import EventModal from '../components/EventModal';
import OKRModal from '../components/OKRModal';

type Objective = OKR & { estimatedTime?: number };

const OKRPage: React.FC = () => {
  const location = useLocation();
  // Use new OKR module hooks
  const { data: objectives = [] } = useOkrs();
  const createOkrMutation = useCreateOkr();
  const updateOkrMutation = useUpdateOkr();
  const deleteOkrMutation = useDeleteOkr();
  const updateKeyResultMutation = useUpdateKeyResult();
  const createEventMutation = useCreateEvent();
  const { data: categories = [] } = useCategories();
  const createCategoryMutation = useCreateCategory();
  const deleteCategoryMutation = useDeleteCategory();
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('blue');
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [selectedKeyResultForModal, setSelectedKeyResultForModal] = useState<{kr: KeyResult;obj: Objective;} | null>(null);
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
  const [showAddObjective, setShowAddObjective] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [deletingObjective, setDeletingObjective] = useState<string | null>(null);
  const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(null);
  const [categoryToDeleteId, setCategoryToDeleteId] = useState<string | null>(null);

  const confirmDeleteCategory = () => {
    if (!categoryToDeleteId) return;
    deleteCategoryMutation.mutate(categoryToDeleteId, {
      onSuccess: () => {
        if (selectedCategory === categoryToDeleteId) setSelectedCategory('all');
        setCategoryToDeleteId(null);
      },
    });
  };

  const getProgress = (keyResults: KeyResult[]) => {
    if (keyResults.length === 0) return 0;
    const totalProgress = keyResults.reduce((sum, kr) => {
      return sum + (kr.targetValue > 0 ? (kr.currentValue / kr.targetValue * 100) : 0);
    }, 0);
    return Math.round(totalProgress / keyResults.length);
  };

  const updateKeyResult = (objectiveId: string, keyResultId: string, newValue: number) => {
    const obj = objectives.find((o) => o.id === objectiveId);
    const kr = obj?.keyResults.find((k) => k.id === keyResultId);
    if (kr) {
      updateKeyResultMutation.mutate({
        okrId: objectiveId,
        keyResultId: keyResultId,
        updates: {
          currentValue: newValue,
          completed: newValue >= kr.targetValue
        }
      });
    }
  };
  const deleteObjective = (objectiveId: string) => {
    deleteOkrMutation.mutate(objectiveId);
    setDeletingObjective(null);
  };

  const handleEditObjective = (id: string) => {
    const objective = objectives.find(obj => obj.id === id);
    if (objective) {
      setEditingObjective(objective);
      setShowAddObjective(true);
    }
  };

    const handleModalSubmit = (data: Omit<Objective, 'id'>, isEditing: boolean) => {
    if (isEditing && editingObjective) {
      updateOkrMutation.mutate({ id: editingObjective.id, updates: data });
    } else {
      createOkrMutation.mutate({
        title: data.title,
        description: data.description,
        category: data.category,
        progress: data.progress || 0,
        completed: data.completed || false,
        keyResults: data.keyResults,
        startDate: data.startDate,
        endDate: data.endDate,
      });
    }
    setEditingObjective(null);
  };

  const handleModalClose = () => {
    setShowAddObjective(false);
    setEditingObjective(null);
  };

  const filteredObjectives = selectedCategory === 'all' ?
  objectives :
  selectedCategory === 'finished' ?
  objectives.filter((obj) => obj.completed) :
  objectives.filter((obj) => obj.category === selectedCategory);

  const colorOptions = [
    { value: 'blue', color: '#3B82F6' },
    { value: 'red', color: '#EF4444' },
    { value: 'green', color: '#10B981' },
    { value: 'purple', color: '#8B5CF6' },
    { value: 'orange', color: '#F97316' },
    { value: 'yellow', color: '#F59E0B' },
    { value: 'pink', color: '#EC4899' },
    { value: 'indigo', color: '#6366F1' },
  ];

  const getCategoryById = (id: string) => categories.find((cat: { id: string }) => cat.id === id);

  // Résout une couleur : accepte un hex (#3B82F6) ou un nom ('blue')
  const resolveColor = (color: string) =>
    color.startsWith('#') ? color : getColorHex(color);

  const formatTime = (minutes: number) => {
    if (minutes === 0) return '0min';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}min`;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  useEffect(() => {
    const state = location.state as {selectedOKRId?: string;};
    if (state?.selectedOKRId) {
      handleEditObjective(state.selectedOKRId);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 sm:p-8 max-w-7xl mx-auto"
      style={{ backgroundColor: 'rgb(var(--color-background))' }}>

      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
          OKR - Objectifs & Résultats Clés
        </h1>
        <p className="text-sm sm:text-base" style={{ color: 'rgb(var(--color-text-secondary))' }}>
          Définissez et suivez vos objectifs avec des résultats mesurables
        </p>
      </div>

      <div className="flex justify-end mb-8">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddObjective(true)}
          className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-white shadow-lg shadow-green-500/25 transform transition-all hover:scale-105 active:scale-95 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600"
          aria-label="Créer un nouvel objectif"
        >
          <Plus size={20} />
          <span>Nouvel Objectif</span>
        </motion.button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <span className="text-sm font-medium whitespace-nowrap" style={{ color: 'rgb(var(--color-text-secondary))' }}>Filtrer par catégorie :</span>
        <div className="flex gap-2 flex-wrap">
            <button
            onClick={() => setSelectedCategory('all')}
            className="px-3 py-1 rounded-full text-sm font-medium transition-all border"
            style={{
              backgroundColor: selectedCategory === 'all' ? 'rgb(var(--color-accent) / 0.1)' : 'rgb(var(--color-chip-bg))',
              borderColor: selectedCategory === 'all' ? 'rgb(var(--color-accent) / 0.3)' : 'rgb(var(--color-chip-border))',
              color: selectedCategory === 'all' ? 'rgb(var(--color-accent))' : 'rgb(var(--color-text-secondary))'
            }}>

              Tous
            </button>
            {categories.map((category) => {
              const isHovered = hoveredCategoryId === category.id;
              return (
                <div
                  key={category.id}
                  className="relative"
                  onMouseEnter={() => setHoveredCategoryId(category.id)}
                  onMouseLeave={() => setHoveredCategoryId(null)}
                >
                  <AnimatePresence>
                    {isHovered && (
                      <motion.button
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15 }}
                        onClick={(e) => { e.stopPropagation(); setCategoryToDeleteId(category.id); }}
                        className="absolute -top-7 left-1/2 -translate-x-1/2 p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-red-600 dark:hover:text-red-400 shadow-sm transition-colors z-10"
                        title="Supprimer la catégorie"
                      >
                        <Trash size={14} />
                      </motion.button>
                    )}
                  </AnimatePresence>
                  <button
                    onClick={() => setSelectedCategory(category.id)}
                    className="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium transition-all hover:scale-105 hover:brightness-110 active:scale-95 border"
                    style={{
                      backgroundColor: selectedCategory === category.id ? resolveColor(category.color) : resolveColor(category.color) + '18',
                      borderColor: selectedCategory === category.id ? resolveColor(category.color) : resolveColor(category.color) + '60',
                      color: selectedCategory === category.id ? '#ffffff' : resolveColor(category.color),
                      boxShadow: selectedCategory === category.id ? `0 4px 12px ${resolveColor(category.color)}40` : 'none'
                    }}>
                    <span>{category.name}</span>
                  </button>
                </div>
              );
            })}

          <AnimatePresence mode="wait">
            {!showCreateCategory ? (
              <motion.button
                key="add-btn"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => setShowCreateCategory(true)}
                className="flex items-center justify-center w-7 h-7 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-green-500 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 transition-all"
                title="Nouvelle catégorie"
              >
                <Plus size={14} />
              </motion.button>
            ) : (
              <motion.form
                key="add-form"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newCategoryName.trim()) return;
                  createCategoryMutation.mutate({ name: newCategoryName.trim(), color: newCategoryColor }, {
                    onSuccess: () => {
                      setNewCategoryName('');
                      setNewCategoryColor('blue');
                      setShowCreateCategory(false);
                    }
                  });
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    const idx = colorOptions.findIndex(c => c.value === newCategoryColor);
                    setNewCategoryColor(colorOptions[(idx + 1) % colorOptions.length].value);
                  }}
                  className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-700 shadow-sm shrink-0 transition-transform hover:scale-110"
                  style={{ backgroundColor: colorOptions.find(c => c.value === newCategoryColor)?.color || '#3B82F6' }}
                  title="Changer la couleur"
                />
                <input
                  autoFocus
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nom de la catégorie…"
                  className="px-3 py-1 text-sm rounded-full border focus:outline-none focus:ring-2 focus:ring-green-500 w-40"
                  style={{
                    backgroundColor: 'rgb(var(--color-surface))',
                    borderColor: 'rgb(var(--color-border))',
                    color: 'rgb(var(--color-text-primary))'
                  }}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setShowCreateCategory(false); setNewCategoryName(''); } }}
                />
                <button
                  type="submit"
                  disabled={!newCategoryName.trim()}
                  className="px-3 py-1 text-sm rounded-full bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-40 transition-all"
                >
                  Créer
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreateCategory(false); setNewCategoryName(''); }}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <X size={13} />
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>

      {filteredObjectives.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center py-20 px-6 text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center mb-6 border border-green-100 dark:border-green-400/20">
            <Target className="w-10 h-10 text-green-500 dark:text-green-400" strokeWidth={1.75} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            {selectedCategory === 'all'
              ? 'Aucun OKR pour le moment'
              : selectedCategory === 'completed'
              ? 'Aucun OKR complété'
              : 'Aucun OKR dans cette catégorie'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6">
            {selectedCategory === 'all'
              ? 'Créez votre premier objectif pour structurer vos résultats clés et suivre votre progression.'
              : 'Modifiez votre filtre ou créez un nouvel objectif dans cette catégorie.'}
          </p>
          <button
            onClick={() => setShowAddObjective(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Créer un OKR
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnimatePresence mode="popLayout">
            {filteredObjectives.map((objective, index) => {
              const progress = getProgress(objective.keyResults);
              const category = getCategoryById(objective.category);

              const start = new Date(objective.startDate);
              const end = new Date(objective.endDate);
              const today = new Date();
              const totalTime = end.getTime() - start.getTime();
              const elapsedTime = today.getTime() - start.getTime();
              const remainingTime = end.getTime() - today.getTime();
              const remainingDays = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));
              const timeProgress = totalTime > 0 ? Math.min(Math.max((elapsedTime / totalTime) * 100, 0), 100) : 0;
              
              // New Logic: Comparison between progress and time elapsed
              // Using ratio of progress / timeProgress to determine health
              let hue = 120;
                const saturation = 80;
                const lightness = 45;

                if (timeProgress > 0) {
                    const ratio = progress / timeProgress;
                    if (ratio >= 1.5) {
                      hue = 120; // Green for being way ahead
                    } else if (ratio >= 1.0) {
                      hue = 145; // Darker/Vibrant Green (on track or slightly ahead)
                    } else if (ratio >= 0.8) {
                    hue = 60; // Yellow (slightly behind)
                  } else if (ratio >= 0.5) {
                    hue = 30; // Orange (behind)
                  } else {
                    hue = 0; // Red (significantly behind)
                  }
                }
              
              const healthColor = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.1)`;
              const healthBorder = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.2)`;
              const healthText = `hsl(${hue}, ${saturation}%, ${lightness - 5}%)`;

              return (
                <motion.div
                  key={objective.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                  className="rounded-lg shadow-sm border p-6 transition-all relative overflow-hidden group"
                  style={{
                    backgroundColor: 'rgb(var(--color-surface))',
                    borderColor: 'rgb(var(--color-border))'
                  }}>
                  <div className="flex justify-between items-start mb-4 gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap" style={{ backgroundColor: category ? resolveColor(category.color) + '20' : 'rgb(var(--color-accent) / 0.1)', color: category ? resolveColor(category.color) : 'rgb(var(--color-accent))' }}>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: category ? resolveColor(category.color) : 'rgb(var(--color-accent))' }} />
                          <span>{category?.name ?? objective.category}</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-2 mb-2 text-[11px]" style={{ color: 'rgb(var(--color-text-muted))' }}>
                        <span>{new Date(objective.startDate).toLocaleDateString('fr-FR')}</span>
                        <span>→</span>
                        <span>{new Date(objective.endDate).toLocaleDateString('fr-FR')}</span>
                      </div>
                      <h3 className="text-base sm:text-lg font-semibold mb-1 truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>{objective.title}</h3>
                      <p className="text-xs sm:text-sm line-clamp-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>{objective.description}</p>
                    </div>

                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <button
                          onClick={() => handleEditObjective(objective.id)}
                          className="p-1.5 transition-colors hover:bg-hover rounded-md"
                          style={{ color: 'rgb(var(--color-text-muted))' }}>
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setDeletingObjective(objective.id)}
                          className="p-1.5 transition-colors hover:bg-hover rounded-md text-red-500/70 hover:text-red-500"
                          style={{ color: 'rgb(var(--color-text-muted))' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                      {remainingDays > 0 && (
                        <div 
                          className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full backdrop-blur-md border shadow-sm transition-transform group-hover:scale-105"
                          style={{ 
                            backgroundColor: healthColor,
                            borderColor: healthBorder,
                            color: healthText
                          }}
                        >
                          <span className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: healthText }}></span>
                            {remainingDays}j restants
                          </span>
                        </div>
                      )}
                    </div>
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
                    const krProgress = keyResult.currentValue / keyResult.targetValue * 100;

                    return (
                      <div key={keyResult.id} className="rounded-lg p-3 transition-all" style={{ backgroundColor: 'rgb(var(--color-hover))' }}>
                        <div className="flex justify-between items-center mb-3 gap-2">
                          <span className="text-xs sm:text-sm font-medium truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>{keyResult.title}</span>
                          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                            <button
                              onClick={() => {
                                setSelectedKeyResultForModal({ kr: keyResult, obj: objective });
                                setShowAddTaskModal(true);
                              }}
                              className="p-1.5 rounded-md transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
                              title="Créer une tâche">

                              <CheckCircle size={14} className="text-blue-500" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedKeyResultForModal({ kr: keyResult, obj: objective });
                                setShowAddEventModal(true);
                              }}
                              className="p-1.5 rounded-md transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
                              title="Planifier un événement">

                              <Calendar size={14} className="text-purple-500" />
                            </button>
                            <span className="text-[10px] sm:text-xs flex items-center gap-1" style={{ color: 'rgb(var(--color-text-muted))' }}>
                              <Clock size={12} />
                              {keyResult.estimatedTime}min
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <input
                              type="number"
                              value={keyResult.currentValue}
                              onChange={(e) => updateKeyResult(objective.id, keyResult.id, Number(e.target.value))}
                              className="w-16 sm:w-20 px-2 py-1 text-xs sm:text-sm border rounded focus:outline-none"
                              style={{ backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))', borderColor: 'rgb(var(--color-border))' }} />

                            <span className="text-xs sm:text-sm whitespace-nowrap" style={{ color: 'rgb(var(--color-text-secondary))' }}>/ {keyResult.targetValue}</span>
                          </div>
                          
                          <div className="flex items-center gap-3 w-full">
                            <div className="flex-1 rounded-full h-1.5" style={{ backgroundColor: 'rgb(var(--color-border-muted))' }}>
                              <div className={`h-1.5 rounded-full transition-all duration-500 ${keyResult.completed ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(krProgress, 100)}%` }} />
                            </div>
                            <span className="text-[10px] sm:text-xs font-medium w-8 text-right" style={{ color: 'rgb(var(--color-text-secondary))' }}>{Math.round(krProgress)}%</span>
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

          })}
        </AnimatePresence>
      </div>

      <OKRModal
        isOpen={showAddObjective}
        onClose={handleModalClose}
        categories={categories}
        editingObjective={editingObjective}
        onSubmit={handleModalSubmit}
      />

        <AnimatePresence>
          {deletingObjective && (
            <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700"
              >
                <div className="p-6">
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                    <Trash2 className="text-red-600 dark:text-red-400" size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Supprimer l'objectif</h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6">
                    Êtes-vous sûr de vouloir supprimer cet objectif ? Tous les résultats clés associés seront également supprimés.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeletingObjective(null)}
                      className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => deleteObjective(deletingObjective)}
                      className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all duration-200 shadow-md shadow-red-500/20"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      <TaskModal 
        isOpen={showAddTaskModal} 
        onClose={() => setShowAddTaskModal(false)} 
        isCreating={true}
        initialData={selectedKeyResultForModal ? { 
          name: selectedKeyResultForModal.kr.title, 
          estimatedTime: selectedKeyResultForModal.kr.estimatedTime, 
          isFromOKR: true 
        } : undefined} 
      />

      
      {selectedKeyResultForModal && showAddEventModal &&
        <EventModal
          mode="add"
          isOpen={showAddEventModal}
          onClose={() => setShowAddEventModal(false)}
            task={{
              id: selectedKeyResultForModal.kr.id,
              name: selectedKeyResultForModal.kr.title,
              completed: selectedKeyResultForModal.kr.completed,
              priority: 0,
              category: '',
              estimatedTime: selectedKeyResultForModal.kr.estimatedTime,
              deadline: selectedKeyResultForModal.obj.endDate,
              bookmarked: false,
              createdAt: '', // Added missing properties
              notes: ''      // Added missing properties
            }}
          onAddEvent={(event) => {
            createEventMutation.mutate(event);
            setShowAddEventModal(false);
          }}
        />
      }

      {/* Dialog suppression catégorie */}
      <AnimatePresence>
        {categoryToDeleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#1e2235] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-700/50"
            >
              <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-3">Confirmer la suppression</h3>
                <p className="text-slate-300 text-sm leading-relaxed mb-6">
                  Êtes-vous sûr de vouloir supprimer la catégorie <strong className="text-white">"{categories.find(c => c.id === categoryToDeleteId)?.name}"</strong> ? Les OKR associés conserveront leur catégorie mais ne seront plus filtrables.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setCategoryToDeleteId(null)}
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white border border-slate-600 hover:bg-slate-800 transition-all duration-200"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={confirmDeleteCategory}
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all duration-200"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>);

};

export default OKRPage;

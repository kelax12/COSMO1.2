import React, { useState, useEffect } from 'react';
import { Plus, TrendingUp, Calendar, Edit2, Trash2, CheckCircle, BarChart3, Clock } from 'lucide-react';
import { Button } from "@/components/ui/button";
import CategoryManager, { getColorHex } from '../components/CategoryManager';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useCreateEvent } from '@/modules/events';
import { useOkrs, useCreateOkr, useUpdateOkr, useDeleteOkr, useUpdateKeyResult, OKR, KeyResult } from '@/modules/okrs';
import TaskModal from '../components/TaskModal';
import EventModal from '../components/EventModal';
import OKRModal from '../components/OKRModal';

type Objective = OKR & { estimatedTime?: number };

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
  icon: string;
};

const OKRPage: React.FC = () => {
  const location = useLocation();
  // Use new OKR module hooks
  const { data: objectives = [] } = useOkrs();
  const createOkrMutation = useCreateOkr();
  const updateOkrMutation = useUpdateOkr();
  const deleteOkrMutation = useDeleteOkr();
  const updateKeyResultMutation = useUpdateKeyResult();
  const createEventMutation = useCreateEvent();
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [selectedKeyResultForModal, setSelectedKeyResultForModal] = useState<{kr: KeyResult;obj: Objective;} | null>(null);
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);

    const [categories, setCategories] = useState<Category[]>([
    { id: 'personal', name: 'Personnel', color: 'blue', icon: '👤' },
    { id: 'professional', name: 'Professionnel', color: 'green', icon: '💼' },
    { id: 'health', name: 'Santé', color: 'red', icon: '❤️' },
    { id: 'learning', name: 'Apprentissage', color: 'purple', icon: '📚' },
    { id: 'demo', name: 'Nouvelle Catégorie (Démo)', color: 'orange', icon: '🚀' }]
    );

    const [showAddObjective, setShowAddObjective] = useState(false);
    const [showCategoryManager, setShowCategoryManager] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [deletingObjective, setDeletingObjective] = useState<string | null>(null);
    const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

    const getProgress = (keyResults: KeyResult[]) => {
    if (keyResults.length === 0) return 0;
    const totalProgress = keyResults.reduce((sum, kr) => {
      return sum + Math.min(kr.currentValue / kr.targetValue * 100, 100);
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
  const addCategory = (category: Category) => {
    setCategories([...categories, category]);
  };

  const updateCategory = (categoryId: string, updates: Partial<Category>) => {
    setCategories((prev) => prev.map((cat) =>
    cat.id === categoryId ? { ...cat, ...updates } : cat
    ));
  };

    const deleteCategory = (categoryId: string) => {
      const isUsed = objectives.some((obj) => obj.category === categoryId);
      if (isUsed) {
        alert('Cette catégorie est utilisée par des objectifs existants et ne peut pas être supprimée.');
        return;
      }
      setCategoryToDelete(categoryId);
    };

    const confirmDeleteCategory = () => {
      if (categoryToDelete) {
        setCategories((prev) => prev.filter((cat) => cat.id !== categoryToDelete));
        setCategoryToDelete(null);
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

  const stats = {
    total: objectives.length,
    completed: objectives.filter((obj) => obj.completed).length,
    inProgress: objectives.filter((obj) => !obj.completed).length,
    avgProgress: objectives.length > 0 ?
    Math.round(objectives.reduce((sum, obj) => sum + getProgress(obj.keyResults), 0) / objectives.length) :
    0
  };

  const getCategoryById = (id: string) => categories.find((cat) => cat.id === id);

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8">
        {[
        { icon: TrendingUp, color: 'orange', label: 'En Cours', value: stats.inProgress },
        { icon: BarChart3, color: 'purple', label: 'Progression Moy.', value: `${stats.avgProgress}%` }].
        map((stat) =>
        <div
          key={stat.label}
          className="p-4 sm:p-6 rounded-lg shadow-sm border transition-all"
          style={{
            backgroundColor: 'rgb(var(--color-surface))',
            borderColor: 'rgb(var(--color-border))'
          }}>

            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: `rgba(var(--color-${stat.color}-rgb), 0.1)` }}>
                <stat.icon size={24} style={{ color: `rgb(var(--color-${stat.color}))` }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm truncate" title={stat.label} style={{ color: 'rgb(var(--color-text-secondary))' }}>{stat.label}</p>
                <p className="text-xl sm:text-2xl font-bold truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  {stat.value}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 mb-8">
          <Button
            variant="outline"
            onClick={() => setShowCategoryManager(true)}
            className="flex items-center justify-center gap-2 group relative overflow-hidden"
            style={{
              borderColor: 'rgb(var(--color-border))',
              color: 'rgb(var(--color-text-secondary))',
              backgroundColor: 'rgb(var(--color-surface))'
            }}>
            <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Plus data-icon="inline-start" size={20} className="text-blue-500 group-hover:rotate-90 transition-transform duration-300" />
            <span className="whitespace-nowrap font-medium">Gérer les catégories</span>
          </Button>
          <Button
            variant="default"
            onClick={() => setShowAddObjective(true)}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600">
          <Plus data-icon="inline-start" size={20} />
          <span className="whitespace-nowrap">Nouvel Objectif</span>
        </Button>
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
            <button
            onClick={() => setSelectedCategory('finished')}
            className="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium transition-all border"
            style={{
              backgroundColor: selectedCategory === 'finished' ? 'rgb(var(--color-accent) / 0.1)' : 'rgb(var(--color-chip-bg))',
              borderColor: selectedCategory === 'finished' ? 'rgb(var(--color-accent) / 0.3)' : 'rgb(var(--color-chip-border))',
              color: selectedCategory === 'finished' ? 'rgb(var(--color-accent))' : 'rgb(var(--color-text-secondary))'
            }}>

              <CheckCircle size={14} />
              <span>Finis</span>
            </button>
            {categories.map((category) =>
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium transition-all hover:scale-105 hover:brightness-110 active:scale-95 border"
              style={{
                backgroundColor: selectedCategory === category.id ? getColorHex(category.color) : 'rgb(var(--color-chip-bg))',
                borderColor: selectedCategory === category.id ? getColorHex(category.color) : 'rgb(var(--color-chip-border))',
                color: selectedCategory === category.id ? '#ffffff' : 'rgb(var(--color-text-secondary))',
                boxShadow: selectedCategory === category.id ? `0 4px 12px ${getColorHex(category.color)}40` : 'none'
              }}>

              {category.icon && <span>{category.icon}</span>}
              <span>{category.name}</span>
            </button>
          )}
        </div>
      </div>

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
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                        <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap" style={{ backgroundColor: 'rgb(var(--color-accent) / 0.1)', color: 'rgb(var(--color-accent))' }}>
                          {category?.icon && <span>{category.icon}</span>}
                          <span>{category?.name}</span>
                        </span>
                        <span className="text-xs sm:text-sm whitespace-nowrap" style={{ color: 'rgb(var(--color-text-muted))' }}>
                          {new Date(objective.startDate).toLocaleDateString('fr-FR')} - {new Date(objective.endDate).toLocaleDateString('fr-FR')}
                        </span>
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
                      <circle cx="40" cy="40" r="32" stroke="rgb(var(--color-accent))" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 32}`} strokeDashoffset={2 * Math.PI * 32 * (1 - progress / 100)} />
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
                    const krProgress = Math.min(keyResult.currentValue / keyResult.targetValue * 100, 100);

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
                              <div className={`h-1.5 rounded-full transition-all duration-500 ${keyResult.completed ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${krProgress}%` }} />
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

        <AnimatePresence>
          {categoryToDelete && (
            <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
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
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Supprimer la catégorie</h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6">
                    Êtes-vous sûr de vouloir supprimer cette catégorie ? Cette action est irréversible.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setCategoryToDelete(null)}
                      className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={confirmDeleteCategory}
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

      <CategoryManager
        isOpen={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
        categories={categories}
        onAdd={addCategory}
        onUpdate={updateCategory}
        onDelete={deleteCategory}
      />

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
    </motion.div>);

};

export default OKRPage;

import React, { useState, useEffect } from 'react';
import { Clock, Flame, Calendar, Edit2, Trash2, CheckCircle, Circle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Habit, useUpdateHabit, useDeleteHabit, useToggleHabitCompletion } from '@/modules/habits';

interface HabitCardProps {
  habit: Habit;
  externalIsEditing?: boolean;
  onExternalEditingChange?: (isEditing: boolean) => void;
}

const colorOptions = [
  { value: 'blue', color: '#3B82F6' },
  { value: 'green', color: '#10B981' },
  { value: 'purple', color: '#8B5CF6' },
  { value: 'orange', color: '#F97316' },
  { value: 'red', color: '#EF4444' },
  { value: 'pink', color: '#EC4899' },
];

const HabitCard: React.FC<HabitCardProps> = React.memo(({ habit, externalIsEditing, onExternalEditingChange }) => {
  // Mutations from habits module
  const updateHabitMutation = useUpdateHabit();
  const deleteHabitMutation = useDeleteHabit();
  const toggleCompletionMutation = useToggleHabitCompletion();
  
  const [showDetails, setShowDetails] = useState(false);
  const [internalIsEditing, setInternalIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: habit.name,
    estimatedTime: habit.estimatedTime,
    color: habit.color
  });

  const [isDeleting, setIsDeleting] = useState(false);

  // Use external editing state if provided, otherwise use internal
  const isEditing = externalIsEditing !== undefined ? externalIsEditing : internalIsEditing;
  const setIsEditing = onExternalEditingChange || setInternalIsEditing;

  const handleDelete = () => {
    deleteHabitMutation.mutate(habit.id);
    setIsDeleting(false);
  };

  // Auto-start editing mode if externalIsEditing is true
  useEffect(() => {
    if (externalIsEditing) {
      setEditData({
        name: habit.name,
        estimatedTime: habit.estimatedTime,
        color: habit.color
      });
    }
  }, [externalIsEditing, habit]);

  const generateDays = (count: number, endAtToday = true) => {
    const today = new Date();
    const days = [];
    
    // Si endAtToday est true, le dernier jour est aujourd'hui
    const startOffset = endAtToday ? -(count - 1) : Math.floor(count / 2) * -1;
    const endOffset = endAtToday ? 0 : Math.floor(count / 2);
    
      for (let i = startOffset; i <= endOffset; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        days.push({
          date: date.toLocaleDateString('en-CA'),
          dayName: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
          dayNumber: date.getDate(),
          isToday: i === 0,
        });
      }
    
    return days;
  };

  const compactDays = generateDays(7, true);
  const detailedDays = generateDays(30, true);

  const handleDayClick = (date: string) => {
    toggleCompletionMutation.mutate({ habitId: habit.id, date });
  };

  const handleSaveEdit = () => {
    updateHabitMutation.mutate({ id: habit.id, updates: editData });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditData({
      name: habit.name,
      estimatedTime: habit.estimatedTime,
      color: habit.color
    });
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };


  const habitColor = habit.color.startsWith('#') 
    ? habit.color 
    : (colorOptions.find(c => c.value === habit.color)?.color || '#3B82F6');

    return (
      <div 
        className="card p-4 md:p-6 hover:shadow-md transition-all cursor-pointer"
        
      >
        {isEditing ? (
          /* Mode édition */
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Modifier l'habitude</h3>
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-1 px-3 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-sm"
              >
                <X size={14} />
                Annuler
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Nom de l'habitude
                </label>
                <input
                  type="text"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  onKeyDown={handleKeyDown}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Temps estimé (min)
                </label>
                <input
                  type="number"
                  value={editData.estimatedTime}
                  onChange={(e) => setEditData({ ...editData, estimatedTime: Number(e.target.value) })}
                  onKeyDown={handleKeyDown}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  min="1"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Couleur
              </label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setEditData({ ...editData, color: option.value })}
                    className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-105 ${
                      editData.color === option.value ? 'border-slate-900 scale-110' : 'border-slate-300'
                    }`}
                    style={{ backgroundColor: option.color }}
                  />
                ))}
              </div>
            </div>
            
              <div className="flex justify-end pt-4">
                <button
                  onClick={handleSaveEdit}
                  className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
                >
                  Sauvegarder
                </button>
              </div>
          </div>
        ) : (
          /* Mode affichage normal */
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div 
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: habitColor }}
                />
                <div>
                  <h3 className="text-base md:text-lg font-semibold text-slate-900 dark:text-slate-100 leading-tight">{habit.name}</h3>
                  <div className="flex items-center gap-4 mt-1 text-xs md:text-sm text-slate-600">
                    <div className="flex items-center gap-1">
                      <Clock size={12} className="md:w-3.5 md:h-3.5" />
                      <span>{habit.estimatedTime} min</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Flame size={12} className="md:w-3.5 md:h-3.5 text-orange-500" />
                      <span>{habit.streak} jours</span>
                    </div>
                  </div>
                </div>
              </div>
              
                <div className="flex items-center gap-1 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0">
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className={`flex items-center gap-2 p-2 md:px-3 md:py-2 rounded-lg transition-colors ${
                      showDetails 
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Calendar size={18} className="md:w-4 md:h-4" />
                    <span className="text-xs font-medium md:hidden">Historique</span>
                  </button>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Edit2 size={18} className="md:w-4 md:h-4" />
                  </button>
                    <button 
                      onClick={() => setIsDeleting(true)}
                      className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} className="md:w-4 md:h-4" />
                    </button>
                  </div>
                </div>
      
                <AnimatePresence>
                  {isDeleting && (
                    <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                      <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="p-6">
                          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                            <Trash2 className="text-red-600 dark:text-red-400" size={24} />
                          </div>
                          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Supprimer l'habitude</h3>
                          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6">
                            Êtes-vous sûr de vouloir supprimer l'habitude "{habit.name}" ? Cette action est irréversible.
                          </p>
                          <div className="flex gap-3">
                            <button
                              onClick={() => setIsDeleting(false)}
                              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200"
                            >
                              Annuler
                            </button>
                            <button
                              onClick={handleDelete}
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
  
            {/* Calendrier compact - toujours visible */}
            <div className="mb-4 overflow-x-auto pb-2 -mx-1 px-1 hide-scrollbar">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300">7 derniers jours</span>
              </div>
              <div className="flex gap-2 min-w-max">
                  {compactDays.map(day => {
                    const isCompleted = habit.completions[day.date];
                    const createdDate = habit.createdAt ? habit.createdAt.split('T')[0] : '';
                    const isBeforeCreation = createdDate ? day.date < createdDate : false;
                    
                    return (
                      <div key={day.date} className="flex flex-col items-center">
                        <div className="text-[10px] md:text-xs text-slate-500 mb-1 font-medium">{day.dayName}</div>
                            <button
                              onClick={() => !isBeforeCreation && handleDayClick(day.date)}
                              disabled={isBeforeCreation}
                              className={`w-9 h-9 md:w-10 md:h-10 rounded-lg border-2 transition-all flex items-center justify-center ${
                                day.isToday 
                                  ? 'border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-800 shadow-sm' 
                                  : 'border-slate-200 dark:border-slate-700'
                              } ${
                                isCompleted 
                                  ? 'border-blue-500 text-white' 
                                  : isBeforeCreation
                                    ? 'opacity-30 grayscale cursor-not-allowed bg-slate-100 dark:bg-slate-900 border-transparent'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                              }`}
                              style={{
                                backgroundColor: isCompleted ? '#2563EB' : undefined
                              }}
                            >
                              {isCompleted ? (
                                <CheckCircle size={18} className="md:w-5 md:h-5" />
                              ) : isBeforeCreation ? (
                                <Circle size={14} className="opacity-10" />
                              ) : (
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{day.dayNumber}</span>
                              )}
                            </button>
  
                      </div>
                    );
                  })}
  
              </div>
            </div>
  
              {/* Vue détaillée */}
              {showDetails && (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-2">
                  <h4 className="text-sm md:text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">Suivi détaillé (30 jours)</h4>
                    <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
                      {detailedDays.map(day => {
                        const isCompleted = habit.completions[day.date];
                        const createdDate = habit.createdAt ? habit.createdAt.split('T')[0] : '';
                        const isBeforeCreation = createdDate ? day.date < createdDate : false;
                        
                        return (
                          <div key={day.date} className="flex flex-col items-center">
                            <div className="text-[9px] md:text-[10px] text-slate-500 mb-0.5">{day.dayName}</div>
                              <button
                                onClick={() => !isBeforeCreation && handleDayClick(day.date)}
                                disabled={isBeforeCreation}
                                className={`w-8 h-8 md:w-9 md:h-9 rounded-md border-2 transition-all flex items-center justify-center ${
                                  day.isToday 
                                    ? 'border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-800' 
                                    : 'border-slate-200 dark:border-slate-700'
                                } ${
                                  isCompleted 
                                    ? 'border-blue-500 text-white' 
                                    : isBeforeCreation
                                      ? 'opacity-30 grayscale cursor-not-allowed bg-slate-100 dark:bg-slate-900 border-transparent'
                                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                                }`}
                                style={{
                                  backgroundColor: isCompleted ? '#2563EB' : undefined
                                }}
                              >
                                {isCompleted ? (
                                  <CheckCircle size={14} className="md:w-4 md:h-4" />
                                ) : isBeforeCreation ? (
                                  <Circle size={12} className="opacity-10" />
                                ) : (
                                  <span className="text-[10px] md:text-xs text-slate-600 dark:text-slate-400">{day.dayNumber}</span>
                                )}
                              </button>
  
                          </div>
                        );
                      })}
                    </div>
  
              </div>
            )}
          </>
        )}
      </div>
        );
}, (prevProps, nextProps) => {
  // Custom comparison: ne re-render que si l'habitude change réellement
  return (
    prevProps.habit.id === nextProps.habit.id &&
    prevProps.habit.name === nextProps.habit.name &&
    prevProps.habit.estimatedTime === nextProps.habit.estimatedTime &&
    prevProps.habit.color === nextProps.habit.color &&
    prevProps.habit.streak === nextProps.habit.streak &&
    JSON.stringify(prevProps.habit.completions) === JSON.stringify(nextProps.habit.completions) &&
    prevProps.externalIsEditing === nextProps.externalIsEditing
  );
});

export default HabitCard;

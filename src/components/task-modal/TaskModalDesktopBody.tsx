// ═══════════════════════════════════════════════════════════════════
// TaskModalDesktopBody — corps desktop (wizard 2 étapes) de TaskModal
// ═══════════════════════════════════════════════════════════════════
//
// Extrait de TaskModal.tsx (god component) — pendant desktop du
// TaskModalMobileBody. Découplé du parent via l'interface explicite
// `DesktopBodyProps` : tout l'état/handlers vient des props (déplacement
// verbatim). Les seuls états locaux sont les inputs inline de création de
// catégorie/liste, propres à ce corps.
import React, { useState } from 'react';
import { X, AlertCircle, Bookmark, Trash2, List, ChevronDown, ChevronRight, Plus, Minus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DatePicker } from '@/components/ui/date-picker';
import DesktopCollaboratorsStep from './DesktopCollaboratorsStep';
import { useCreateCategory } from '@/modules/categories';
import { useCreateList } from '@/modules/lists';
import { useRejectFriendRequest } from '@/modules/friends';
import type { Task } from '@/modules/tasks';

type TaskFormState = {
  name: string;
  priority: number;
  category: string;
  deadline: string;
  estimatedTime: number;
  completed: boolean;
  bookmarked: boolean;
  isFromOKR: boolean;
};

export interface DesktopBodyProps {
  formData: TaskFormState;
  setFormData: React.Dispatch<React.SetStateAction<TaskFormState>>;
  handleInputChange: (field: string, value: string | number | boolean) => void;
  errors: { [key: string]: string };
  setErrors: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>;
  okrFields: Record<string, boolean>;
  hasChanges: boolean;
  setHasChanges: React.Dispatch<React.SetStateAction<boolean>>;
  step: number;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  dRegister: (name: string) => (el: HTMLElement | null) => void;
  dTrigger: (missing: string[]) => void;
  dClear: (name: string) => void;
  dInvalid: (name: string) => boolean;
  collaboratorRef: React.RefObject<HTMLDivElement>;
  validateForm: () => boolean;
  isStep1Valid: () => boolean;
  isFormValid: () => boolean;
  missingStep1Fields: () => string[];
  categories: Array<{ id: string; name: string; color: string }>;
  createCategoryMutation: ReturnType<typeof useCreateCategory>;
  listColorOptions: { value: string; color: string }[];
  lists: Array<{ id: string; name: string; color: string; taskIds: string[]; type?: string; smartRule?: string; isDefault?: boolean; position?: number }>;
  selectedListIds: string[];
  setSelectedListIds: React.Dispatch<React.SetStateAction<string[]>>;
  createListMutation: ReturnType<typeof useCreateList>;
  isLoading: boolean;
  isCreating: boolean;
  handleClose: () => void;
  handleSave: () => void;
  handleDelete: () => void;
  isPremium: () => boolean;
  setShowPremiumGate: React.Dispatch<React.SetStateAction<boolean>>;
  isTaskOwner: boolean;
  task?: Task;
  collaborators: string[];
  displayInfo: (id: string) => { name: string; email?: string; avatar?: string; isPending: boolean };
  pendingShareIds: Set<string>;
  handleRemoveCollaborator: (id: string) => void;
  emailInput: string;
  setEmailInput: React.Dispatch<React.SetStateAction<string>>;
  inputError: string | null;
  setInputError: React.Dispatch<React.SetStateAction<string | null>>;
  handleAddEmail: () => void;
  filteredFriends: Array<{ id: string; userId?: string; name: string; email: string; avatar?: string }>;
  collabIdOf: (f: { id: string; userId?: string }) => string;
  toggleCollaborator: (id: string) => void;
  sentRequests: Array<{ id: string; email: string; receiverId?: string }>;
  pendingInvitesLocal: string[];
  friends: Array<{ id: string; userId?: string; name: string; email: string; avatar?: string }>;
  cancelFriendRequestMutation: ReturnType<typeof useRejectFriendRequest>;
}

const TaskModalDesktopBody: React.FC<DesktopBodyProps> = ({
  formData, setFormData, handleInputChange,
  errors, setErrors, okrFields,
  hasChanges, setHasChanges,
  step, setStep,
  dRegister, dTrigger, dClear, dInvalid,
  collaboratorRef,
  validateForm, isStep1Valid, isFormValid, missingStep1Fields,
  categories, createCategoryMutation,
  listColorOptions,
  lists, selectedListIds, setSelectedListIds, createListMutation,
  isLoading, isCreating,
  handleClose, handleSave, handleDelete,
  isPremium, setShowPremiumGate,
  isTaskOwner, task,
  collaborators, displayInfo, pendingShareIds, handleRemoveCollaborator,
  emailInput, setEmailInput, inputError, setInputError, handleAddEmail,
  filteredFriends, collabIdOf, toggleCollaborator,
  sentRequests, pendingInvitesLocal, friends, cancelFriendRequestMutation,
}) => {
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('blue');
  const [showNewListInput, setShowNewListInput] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListColor, setNewListColor] = useState('blue');

  return (
        <div
          className="flex flex-col h-full w-full rounded-t-[28px] sm:rounded-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl overflow-hidden"
          style={{ backgroundColor: 'rgb(var(--color-surface))' }}
        >
        <div
          className="sm:hidden flex justify-center pt-4 pb-2 shrink-0"
          style={{ backgroundColor: 'rgb(var(--color-surface))' }}
        >
          <div className="w-9 h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
        </div>
        <div className="md:rounded-2xl md:shadow-2xl w-full transition-colors h-full min-h-inherit flex flex-col" style={{ backgroundColor: 'rgb(var(--color-surface))' }}>
          {/* Header — sticky */}
          <div
            className="sticky top-0 z-10 flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 border-b transition-colors gap-2"
            style={{ borderColor: 'rgb(var(--color-border))', backgroundColor: 'rgb(var(--color-surface))' }}
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>
                {isCreating ? 'Nouvelle tâche' : 'Modifier la tâche'}
              </h2>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className={`w-2 h-2 rounded-full transition-colors ${step === 1 ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                <div className={`w-2 h-2 rounded-full transition-colors ${step === 2 ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
              </div>
              {hasChanges &&
                <div className="hidden xs:flex items-center gap-1 text-orange-500 text-xs font-medium bg-orange-500/10 px-2 py-1 rounded-md shrink-0">
                  <AlertCircle size={12} aria-hidden="true" />
                  <span className="hidden sm:inline">Non sauvegardé</span>
                </div>
              }
            </div>
            <button
              onClick={handleClose}
              aria-label="Fermer le formulaire"
              className="min-w-11 min-h-11 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              style={{ color: 'rgb(var(--color-text-muted))' }}
            >
              <X size={22} aria-hidden="true" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto h-[calc(100%-72px)] md:h-auto" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
            {/* Error display */}
            {errors.general &&
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                  <AlertCircle size={16} aria-hidden="true" />
                  <span className="font-medium">{errors.general}</span>
                </div>
              </div>
            }

              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>

                {/* ── Step 1 : champs principaux ── */}
                {step === 1 && (
                <div className="space-y-5">

                  {/* Task Name */}
                  <div ref={dRegister('name')}>
                    <label htmlFor="task-name" className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                      Nom de la tâche *
                    </label>
                    <input
                      id="task-name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => { handleInputChange('name', e.target.value); dClear('name'); }}
                      className={`w-full px-4 h-12 border rounded-lg focus:outline-none hover:border-blue-500 focus:border-blue-600 focus:border-2 transition-all text-base ${
                        errors.name || dInvalid('name') ? 'border-red-400 dark:border-red-500' : 'border-slate-200 dark:border-slate-700'
                      } ${okrFields.name ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''}`}
                      style={{
                        backgroundColor: okrFields.name ? undefined : 'rgb(var(--color-surface))',
                        color: 'rgb(var(--color-text-primary))',
                        borderColor: errors.name || dInvalid('name') ? '#ef4444' : (okrFields.name ? undefined : undefined)
                      }}
                      placeholder="Entrez le nom de la tâche"
                      aria-describedby={errors.name ? 'name-error' : undefined}
                      aria-invalid={!!errors.name}
                    />

                    {errors.name &&
                      <div id="name-error" className="flex items-center gap-2 mt-1 text-red-600 dark:text-red-400 text-sm" role="alert">
                        <AlertCircle size={14} aria-hidden="true" />
                        {errors.name}
                      </div>
                    }
                  </div>

                  {/* Priority and Category */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div ref={dRegister('priority')}>
                        <label htmlFor="task-priority" className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                          Priorité
                        </label>
                        <div className="relative">
                          <select
                            id="task-priority"
                            value={formData.priority}
                            onChange={(e) => { handleInputChange('priority', Number(e.target.value)); dClear('priority'); }}
                            className={`w-full px-4 pr-12 h-12 border rounded-lg focus:outline-none hover:border-blue-500 focus:border-blue-600 focus:border-2 transition-all text-base appearance-none cursor-pointer ${
                              dInvalid('priority') ? 'border-red-400 dark:border-red-500' : 'border-slate-200 dark:border-slate-700'
                            }`}
                            style={{
                              backgroundColor: 'rgb(var(--color-surface))',
                              color: formData.priority === 0 ? 'rgb(var(--color-text-muted))' : 'rgb(var(--color-text-primary))',
                              borderColor: dInvalid('priority') ? '#ef4444' : undefined,
                            }}
                            aria-label="Sélectionner la priorité de la tâche"
                          >
                            <option value="0" disabled hidden>Choisir une priorité</option>
                            <option value="1" style={{ color: 'rgb(var(--color-text-primary))' }}>1 (Très haute)</option>
                            <option value="2" style={{ color: 'rgb(var(--color-text-primary))' }}>2 (Haute)</option>
                            <option value="3" style={{ color: 'rgb(var(--color-text-primary))' }}>3 (Moyenne)</option>
                            <option value="4" style={{ color: 'rgb(var(--color-text-primary))' }}>4 (Basse)</option>
                            <option value="5" style={{ color: 'rgb(var(--color-text-primary))' }}>5 (Très basse)</option>
                          </select>
                          <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" />
                        </div>
                        {errors.priority &&
                          <div className="flex items-center gap-2 mt-1 text-red-600 dark:text-red-400 text-sm" role="alert">
                            <AlertCircle size={14} aria-hidden="true" />
                            {errors.priority}
                          </div>
                        }
                    </div>

                    <div ref={dRegister('category')}>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                        Catégorie
                      </label>
                      {/* Mobile : select natif système */}
                      <div className="sm:hidden relative">
                        <select
                          value={formData.category || ''}
                          onChange={(e) => handleInputChange('category', e.target.value)}
                          className="w-full h-12 px-4 pr-10 border rounded-lg appearance-none text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                          style={{
                            backgroundColor: 'rgb(var(--color-surface))',
                            color: formData.category ? 'rgb(var(--color-text-primary))' : 'rgb(var(--color-text-muted))',
                            borderColor: errors.category ? 'rgb(var(--color-error))' : 'rgb(var(--color-border))',
                          }}
                        >
                          <option value="">Choisir...</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                        <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-blue-500" />
                      </div>
                      {/* Desktop : dropdown custom */}
                      <div className="hidden sm:block">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className={`w-full flex items-center justify-between px-4 h-12 border rounded-lg focus:outline-none hover:border-blue-500 focus:border-blue-600 focus:border-2 data-[state=open]:border-blue-600 data-[state=open]:border-2 transition-all text-base ${
                                    errors.category || dInvalid('category') ? 'border-red-400 dark:border-red-500' : (okrFields.category ? 'border-blue-500 dark:border-blue-400' : 'border-slate-200 dark:border-slate-700')
                                  } ${okrFields.category ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}
                                  style={{
                                  backgroundColor: okrFields.category ? undefined : 'rgb(var(--color-surface))',
                                  color: formData.category ? 'rgb(var(--color-text-primary))' : 'rgb(var(--color-text-muted))',
                                  borderColor: errors.category || dInvalid('category') ? '#ef4444' : (okrFields.category ? undefined : undefined)
                                }}
                              >
                              <span>{categories.find(c => c.id === formData.category)?.name || (formData.category === 'okr' ? 'OKR' : 'Choisir...')}</span>
                              <ChevronDown size={18} className="text-blue-500" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent 
                            align="start" 
                            className="w-[var(--radix-dropdown-menu-trigger-width)] bg-[#f8fafc] dark:bg-[#1e293b] border-slate-200 dark:border-slate-700 p-1 shadow-xl"
                          >
                              {formData.category === 'okr' && !categories.find(c => c.id === 'okr') && (
                            <DropdownMenuItem asChild>
                              <button
                                type="button"
                                onClick={() => handleInputChange('category', 'okr')}
                                className="w-full text-left px-4 py-3 text-base rounded-md transition-colors flex items-center gap-2 bg-blue-600 text-white shadow-sm"
                              >
                                <div className="w-2 h-2 rounded-full bg-blue-400" />
                                OKR
                              </button>
                            </DropdownMenuItem>
                          )}
                          {categories.map((cat) => (
                            <DropdownMenuItem key={cat.id} asChild>
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => handleInputChange('category', formData.category === cat.id ? '' : cat.id)}
                                className={`w-full text-left px-4 py-3 text-base rounded-md transition-colors flex items-center gap-2 ${
                                  formData.category === cat.id
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-700 dark:text-slate-200 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600'
                                }`}
                              >
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                                {cat.name}
                              </button>
                            </DropdownMenuItem>
                          ))}
                          {categories.length > 0 && <DropdownMenuSeparator className="bg-slate-200 dark:bg-slate-700 my-1" />}
                          <DropdownMenuItem asChild>
                            <button
                              type="button"
                              className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm font-medium text-blue-600 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                              onClick={() => { setShowNewCategoryInput(true); setNewCategoryName(''); }}
                            >
                              <Plus size={15} />
                              Créer une catégorie
                            </button>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>

                      {showNewCategoryInput && (
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              const idx = listColorOptions.findIndex(c => c.value === newCategoryColor);
                              setNewCategoryColor(listColorOptions[(idx + 1) % listColorOptions.length].value);
                            }}
                            className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-700 shadow-sm shrink-0 transition-transform hover:scale-110"
                            style={{ backgroundColor: listColorOptions.find(c => c.value === newCategoryColor)?.color || '#3B82F6' }}
                            title="Changer la couleur"
                          />
                          <input
                            type="text"
                            autoFocus
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const name = newCategoryName.trim();
                                if (name.length < 2) {
                                  toast.error('Le nom de la catégorie doit contenir au moins 2 caractères');
                                  return;
                                }
                                createCategoryMutation.mutate(
                                  { name, color: listColorOptions.find(c => c.value === newCategoryColor)?.color || '#3B82F6' },
                                  {
                                    onSuccess: (created) => {
                                      handleInputChange('category', created.id);
                                      setShowNewCategoryInput(false);
                                      setNewCategoryName('');
                                      setNewCategoryColor('blue');
                                    }
                                  }
                                );
                              } else if (e.key === 'Escape') {
                                setShowNewCategoryInput(false);
                                setNewCategoryName('');
                                setNewCategoryColor('blue');
                              }
                            }}
                            placeholder="Nom de la catégorie..."
                            className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:border-blue-500 border-slate-200 dark:border-slate-700"
                            style={{ backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))' }}
                          />
                          <button
                            type="button"
                            disabled={newCategoryName.trim().length < 2 || createCategoryMutation.isPending}
                            onClick={() => {
                              const name = newCategoryName.trim();
                              if (name.length < 2) {
                                toast.error('Le nom de la catégorie doit contenir au moins 2 caractères');
                                return;
                              }
                              createCategoryMutation.mutate(
                                { name, color: listColorOptions.find(c => c.value === newCategoryColor)?.color || '#3B82F6' },
                                {
                                  onSuccess: (created) => {
                                    handleInputChange('category', created.id);
                                    setShowNewCategoryInput(false);
                                    setNewCategoryName('');
                                    setNewCategoryColor('blue');
                                  }
                                }
                              );
                            }}
                            className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-40 transition-all"
                          >
                            {createCategoryMutation.isPending ? 'Création...' : 'Créer'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowNewCategoryInput(false); setNewCategoryName(''); setNewCategoryColor('blue'); }}
                            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            style={{ color: 'rgb(var(--color-text-secondary))' }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}

                        {errors.category &&
                          <div className="flex items-center gap-2 mt-1 text-red-600 dark:text-red-400 text-sm" role="alert">
                            <AlertCircle size={14} aria-hidden="true" />
                            {errors.category}
                          </div>
                        }
                      </div>
                  </div>

                  {/* Deadline and Estimated Time */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div ref={dRegister('deadline')}>
                        <label htmlFor="task-deadline" className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                          Échéance <span className="normal-case font-normal opacity-60">(Facultatif)</span>
                        </label>
                        <DatePicker
                          value={formData.deadline}
                          onChange={(date) => handleInputChange('deadline', date)}
                          placeholder="Sélectionner une date"
                          className={`h-12 w-full ${errors.deadline || dInvalid('deadline') ? 'border-red-400 dark:border-red-500' : ''}`}
                        />

                        {errors.deadline &&
                          <div id="deadline-error" className="flex items-center gap-2 mt-1 text-red-600 dark:text-red-400 text-sm" role="alert">
                            <AlertCircle size={14} aria-hidden="true" />
                            {errors.deadline}
                          </div>
                        }
                      </div>

                      <div>
                        <label htmlFor="task-time" className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                          Temps estimé (min) <span className="normal-case font-normal opacity-60">(Facultatif)</span>
                        </label>
                          <div className="flex items-stretch gap-2">
                            <input
                              id="task-time"
                              type="number"
                              value={formData.estimatedTime === 0 ? '' : formData.estimatedTime}
                              onChange={(e) => handleInputChange('estimatedTime', e.target.value === '' ? '' : Number(e.target.value))}
                              placeholder="Estimation en minute"
                              className={`flex-1 min-w-0 px-4 h-12 border rounded-lg focus:outline-none hover:border-blue-500 focus:border-blue-600 focus:border-2 transition-all text-base ${
                                errors.estimatedTime ? 'border-red-300 dark:border-red-600' : 'border-slate-200 dark:border-slate-700'
                              } ${okrFields.estimatedTime ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''}`}
                              style={{
                                backgroundColor: okrFields.estimatedTime ? undefined : 'rgb(var(--color-surface))',
                                color: 'rgb(var(--color-text-primary))',
                                borderColor: errors.estimatedTime ? 'rgb(var(--color-error))' : (okrFields.estimatedTime ? undefined : undefined)
                              }}
                              aria-describedby={errors.estimatedTime ? 'time-error' : undefined}
                              aria-invalid={!!errors.estimatedTime}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setFormData((prev) => {
                                  const cur = typeof prev.estimatedTime === 'number' ? prev.estimatedTime : 0;
                                  return { ...prev, estimatedTime: Math.max(0, cur - 5) };
                                });
                                if (errors.estimatedTime) setErrors((prev) => ({ ...prev, estimatedTime: '' }));
                              }}
                              className="w-12 h-12 flex items-center justify-center border rounded-lg hover:border-blue-500 transition-colors shrink-0"
                              style={{ borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))', backgroundColor: 'rgb(var(--color-surface))' }}
                              aria-label="Diminuer le temps estimé de 5 minutes"
                            >
                              <Minus size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFormData((prev) => {
                                  const cur = typeof prev.estimatedTime === 'number' ? prev.estimatedTime : 0;
                                  return { ...prev, estimatedTime: cur + 5 };
                                });
                                if (errors.estimatedTime) setErrors((prev) => ({ ...prev, estimatedTime: '' }));
                              }}
                              className="w-12 h-12 flex items-center justify-center border rounded-lg hover:border-blue-500 transition-colors shrink-0"
                              style={{ borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))', backgroundColor: 'rgb(var(--color-surface))' }}
                              aria-label="Augmenter le temps estimé de 5 minutes"
                            >
                              <Plus size={18} />
                            </button>
                          </div>

                      {errors.estimatedTime &&
                        <div id="time-error" className="flex items-center gap-2 mt-1 text-red-600 dark:text-red-400 text-sm" role="alert">
                          <AlertCircle size={14} aria-hidden="true" />
                          {errors.estimatedTime}
                        </div>
                      }
                    </div>
                  </div>

                  {/* Status toggles */}
                  <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
                      <button
                        type="button"
                        onClick={() => handleInputChange('bookmarked', !formData.bookmarked)}
                        aria-label={formData.bookmarked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                        className={`p-2.5 rounded-lg border transition-all ${
                          formData.bookmarked
                            ? 'bg-yellow-500/15 border-yellow-500/40'
                            : 'border-slate-200 dark:border-slate-700 hover:border-yellow-400/50 hover:bg-yellow-500/10'
                        }`}
                        style={!formData.bookmarked ? { backgroundColor: 'rgb(var(--color-hover))' } : {}}
                      >
                        <Bookmark
                          size={20}
                          className={formData.bookmarked ? 'text-yellow-500' : 'text-yellow-500/60'}
                          fill={formData.bookmarked ? 'currentColor' : 'none'}
                        />
                      </button>

                      {!isCreating && (
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={isLoading}
                          aria-label="Supprimer la tâche"
                          className="p-2.5 rounded-lg border border-red-200 dark:border-red-900/40 hover:border-red-400/60 hover:bg-red-500/10 transition-all disabled:opacity-50"
                          style={{ backgroundColor: 'rgb(var(--color-hover))' }}
                        >
                          <Trash2 size={20} className="text-red-500" />
                        </button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm font-medium border-slate-200 dark:border-slate-700 hover:border-blue-400/50 hover:bg-blue-500/10"
                            style={{
                              backgroundColor: 'rgb(var(--color-hover))',
                              color: 'rgb(var(--color-text-primary))',
                            }}
                          >
                            <List size={16} className="text-blue-500" />
                            Ajouter à une liste
                            <ChevronDown size={14} className="text-blue-500" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="w-56 shadow-xl border"
                          style={{
                            backgroundColor: 'rgb(var(--color-surface))',
                            borderColor: 'rgb(var(--color-border))',
                            color: 'rgb(var(--color-text-primary))',
                          }}
                        >
                          {lists.map(list => {
                            const listColorHex = listColorOptions.find(c => c.value === list.color)?.color || list.color || '#3B82F6';
                            return (
                            <DropdownMenuCheckboxItem
                              key={list.id}
                              checked={selectedListIds.includes(list.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedListIds([...selectedListIds, list.id]);
                                } else {
                                  setSelectedListIds(selectedListIds.filter(id => id !== list.id));
                                }
                                setHasChanges(true);
                              }}
                              className="focus:bg-blue-500/10"
                              style={{ color: 'rgb(var(--color-text-primary))' }}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: listColorHex }} />
                                {list.name}
                              </div>
                            </DropdownMenuCheckboxItem>
                            );
                          })}
                          {lists.length > 0 && (
                            <DropdownMenuSeparator style={{ backgroundColor: 'rgb(var(--color-border))' }} />
                          )}
                          <DropdownMenuItem asChild>
                            <button
                              type="button"
                              className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm font-medium text-blue-600 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                              onClick={() => { setShowNewListInput(true); setNewListName(''); }}
                            >
                              <Plus size={15} />
                              Créer une liste
                            </button>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {showNewListInput && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const idx = listColorOptions.findIndex(c => c.value === newListColor);
                              setNewListColor(listColorOptions[(idx + 1) % listColorOptions.length].value);
                            }}
                            className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-700 shadow-sm shrink-0 transition-transform hover:scale-110"
                            style={{ backgroundColor: listColorOptions.find(c => c.value === newListColor)?.color || '#3B82F6' }}
                            title="Changer la couleur"
                          />
                          <input
                            type="text"
                            autoFocus
                            value={newListName}
                            onChange={(e) => setNewListName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (!newListName.trim()) return;
                                createListMutation.mutate(
                                  { name: newListName.trim(), color: newListColor },
                                  {
                                    onSuccess: (created) => {
                                      setSelectedListIds(prev => [...prev, created.id]);
                                      setHasChanges(true);
                                      setShowNewListInput(false);
                                      setNewListName('');
                                      setNewListColor('blue');
                                    }
                                  }
                                );
                              } else if (e.key === 'Escape') {
                                setShowNewListInput(false);
                                setNewListName('');
                                setNewListColor('blue');
                              }
                            }}
                            placeholder="Nom de la liste..."
                            className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:border-blue-500 border-slate-200 dark:border-slate-700"
                            style={{ backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))' }}
                          />
                          <button
                            type="button"
                            disabled={!newListName.trim() || createListMutation.isPending}
                            onClick={() => {
                              if (!newListName.trim()) return;
                              createListMutation.mutate(
                                { name: newListName.trim(), color: newListColor },
                                {
                                  onSuccess: (created) => {
                                    setSelectedListIds(prev => [...prev, created.id]);
                                    setHasChanges(true);
                                    setShowNewListInput(false);
                                    setNewListName('');
                                    setNewListColor('blue');
                                  }
                                }
                              );
                            }}
                            className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-40 transition-all"
                          >
                            {createListMutation.isPending ? 'Création...' : 'Créer'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowNewListInput(false); setNewListName(''); setNewListColor('blue'); }}
                            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            style={{ color: 'rgb(var(--color-text-secondary))' }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}



                      <div className="flex flex-wrap gap-2 items-center">
                                {selectedListIds.map(id => {
                                  const list = lists.find(l => l.id === id);
                                  if (!list) return null;
                                  return (
                                    <div 
                                      key={id} 
                                      className="flex items-center gap-1.5 text-xs font-medium bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-lg border border-blue-500/20"
                                    >
                                      {list.name}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedListIds(selectedListIds.filter(lid => lid !== id));
                                          setHasChanges(true);
                                        }}
                                        className="text-blue-500 hover:text-blue-400 transition-colors"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                  </div>
                </div>
                )} {/* end step 1 */}

                {/* ── Step 2 : collaborateurs — extrait dans DesktopCollaboratorsStep.tsx (split #6) ── */}
                {step === 2 && (
                  <DesktopCollaboratorsStep
                    collaboratorRef={collaboratorRef}
                    isPremium={isPremium}
                    setShowPremiumGate={setShowPremiumGate}
                    isTaskOwner={isTaskOwner}
                    task={task}
                    collaborators={collaborators}
                    displayInfo={displayInfo}
                    pendingShareIds={pendingShareIds}
                    handleRemoveCollaborator={handleRemoveCollaborator}
                    emailInput={emailInput}
                    setEmailInput={setEmailInput}
                    inputError={inputError}
                    setInputError={setInputError}
                    handleAddEmail={handleAddEmail}
                    filteredFriends={filteredFriends}
                    collabIdOf={collabIdOf}
                    toggleCollaborator={toggleCollaborator}
                    sentRequests={sentRequests}
                    pendingInvitesLocal={pendingInvitesLocal}
                    friends={friends}
                    cancelFriendRequestMutation={cancelFriendRequestMutation}
                  />
                )} {/* end step 2 */}

                {/* ── Action Buttons ── */}
                <div
                  className="sticky bottom-0 -mx-6 px-4 sm:px-6 pt-3 pb-3 sm:pb-4 mt-6 border-t flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-2 sm:gap-3"
                  style={{
                    borderColor: 'rgb(var(--color-border))',
                    backgroundColor: 'rgb(var(--color-surface))',
                    paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)',
                  }}
                >
                  {step === 1 ? (
                    <>
                      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 w-full sm:ml-auto sm:w-auto">
                        <Button type="button" variant="outline" size="lg" onClick={handleClose} disabled={isLoading} className="min-h-11 w-full sm:w-auto">
                          Annuler
                        </Button>
                        <Button
                          type="button"
                          size="lg"
                          onClick={(e) => {
                            e.preventDefault();
                            const missing = missingStep1Fields();
                            if (missing.length === 0) { setStep(2); return; }
                            validateForm();
                            dTrigger(missing);
                          }}
                          className={`min-h-11 w-full sm:w-auto ${!isStep1Valid() ? '!bg-blue-300 dark:!bg-blue-900/60 !text-white !border-0 !opacity-100' : 'bg-blue-600 hover:bg-blue-700 !text-white !border-0'}`}
                        >
                          Suivant
                          <ChevronRight size={16} data-icon="inline-end" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Button type="button" variant="outline" size="lg" onClick={() => setStep(1)} disabled={isLoading} className="min-h-11 w-full sm:w-auto">
                        ← Retour
                      </Button>
                      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                        <Button
                          type="submit"
                          size="lg"
                          disabled={isLoading || !isFormValid() || (!hasChanges && !isCreating)}
                          className={`min-h-11 w-full sm:w-auto ${
                            isLoading || !isFormValid() || (!hasChanges && !isCreating)
                              ? '!bg-blue-300 dark:!bg-blue-900/60 !text-white !border-0 !opacity-100 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700 !text-white !border-0'
                          }`}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 size={16} className="animate-spin" data-icon="inline-start" />
                              <span>{isCreating ? 'Création...' : 'Sauvegarde...'}</span>
                            </>
                          ) : (
                            isCreating ? 'Créer la tâche' : 'Sauvegarder'
                          )}
                        </Button>
                      </div>
                    </>
                  )}
              </div>
            </form>
          </div>
        </div>
        </div>
  );
};

export default TaskModalDesktopBody;

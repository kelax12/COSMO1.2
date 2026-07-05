import React, { useState, useEffect, useRef } from 'react';
import { PageHeading } from '@/components/ui/typography';
import { Plus, Target, CalendarCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/modules/auth/AuthContext';
import WeeklyCheckinModal from '@/components/WeeklyCheckinModal';
import { getColorHex } from '../components/CategoryManager';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useCreateEvent } from '@/modules/events';
import { useOkrs, useCreateOkr, useUpdateOkr, useDeleteOkr, useUpdateKeyResult, OKR, KeyResult } from '@/modules/okrs';
import { showUndoToast } from '@/lib/undo-toast';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/modules/categories';
import PageErrorState from '@/components/PageErrorState';
import TaskModal from '../components/TaskModal';
import EventModal from '../components/EventModal';
import OKRModalSheet from '../components/OKRModalSheet';
import OKRDeadlineReviewModal from '../components/OKRDeadlineReviewModal';
import CompletedOKRsModal from '../components/CompletedOKRsModal';
import { toast } from 'sonner';
import PageTutorial from '@/components/tutorial/PageTutorial';
import { useTutorial } from '@/components/tutorial/useTutorial';
import { okrTutorialStepsDesktop } from '@/tutorials/okr.desktop';
import { okrTutorialStepsMobile } from '@/tutorials/okr.mobile';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { filterObjectivesByCategory, type Objective } from './okr/okr-page-logic';
import OKRCard from './okr/OKRCard';
import { OKRListSkeleton } from '@/components/skeletons';
import DeleteObjectiveConfirm from './okr/DeleteObjectiveConfirm';
import CategoryFilterBar from './okr/CategoryFilterBar';
import DeleteCategoryConfirm from './okr/DeleteCategoryConfirm';

const OKRPage: React.FC = () => {
  const isMobile = useIsMobile();
  const tutorial = useTutorial(isMobile ? 'okr_mobile' : 'okr_desktop');
  const tutorialSteps = isMobile ? okrTutorialStepsMobile : okrTutorialStepsDesktop;
  const location = useLocation();
  const { isDemo } = useAuth();
  // Bouton "Check-in hebdo" visible uniquement en mode démo pour tester le
  // composant (en prod il s'auto-déclenche lundi/mardi depuis le Dashboard).
  const [showCheckin, setShowCheckin] = useState(false);
  // Use new OKR module hooks
  const { data: objectives = [], isLoading: isLoadingOkrs, isError: isOkrsError, error: okrsError, refetch: refetchOkrs } = useOkrs();
  const createOkrMutation = useCreateOkr();
  const updateOkrMutation = useUpdateOkr();
  const deleteOkrMutation = useDeleteOkr();
  const updateKeyResultMutation = useUpdateKeyResult();
  const createEventMutation = useCreateEvent();
  const { data: categories = [] } = useCategories();
  const createCategoryMutation = useCreateCategory();
  const updateCategoryMutation = useUpdateCategory();
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
  // États d'édition inline d'une catégorie (nom + couleur). Activés via le
  // bouton crayon dans la barre flottante au-dessus d'une chip catégorie.
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryColor, setEditCategoryColor] = useState('blue');

  // ── Deadline review popup ───────────────────────────────────────────
  // À l'ouverture de la page : si un OKR non complété a une deadline atteinte
  // (endDate <= today), on affiche un popup centré demandant de faire le point
  // avant clôture. Au clic Valider, la carte s'anime vers le bouton « OKR
  // terminés » en haut à droite, puis l'OKR est marqué completed.
  const [deadlineReviewOkrId, setDeadlineReviewOkrId] = useState<string | null>(null);
  const [reviewedOkrIds, setReviewedOkrIds] = useState<Set<string>>(new Set());
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const finishedButtonRef = useRef<HTMLButtonElement>(null);

  const startEditCategory = (cat: { id: string; name: string; color: string }) => {
    setEditingCategoryId(cat.id);
    setEditCategoryName(cat.name);
    setEditCategoryColor(cat.color);
    setHoveredCategoryId(null);
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditCategoryName('');
    setEditCategoryColor('blue');
  };

  const submitEditCategory = () => {
    if (!editingCategoryId) return;
    const name = editCategoryName.trim();
    if (name.length < 2) {
      toast.error('Le nom de la catégorie doit contenir au moins 2 caractères');
      return;
    }
    updateCategoryMutation.mutate(
      { id: editingCategoryId, updates: { name, color: editCategoryColor } },
      { onSuccess: () => cancelEditCategory() }
    );
  };
  const [categoryToDeleteId, setCategoryToDeleteId] = useState<string | null>(null);

  const confirmDeleteCategory = () => {
    if (!categoryToDeleteId) return;
    // Undo (#38) : filet de sécurité aligné sur les tâches/listes — la
    // suppression d'une catégorie est plus lourde de conséquences qu'une tâche.
    const snapshot = categories.find((c) => c.id === categoryToDeleteId);
    deleteCategoryMutation.mutate(categoryToDeleteId, {
      onSuccess: () => {
        if (selectedCategory === categoryToDeleteId) setSelectedCategory('all');
        setCategoryToDeleteId(null);
        if (snapshot) {
          showUndoToast('Catégorie supprimée', () => {
            const { id: _id, ...rest } = snapshot;
            createCategoryMutation.mutate(rest);
          });
        }
      },
    });
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
    const snapshot = objectives.find(o => o.id === objectiveId);
    deleteOkrMutation.mutate(objectiveId);
    setDeletingObjective(null);
    if (snapshot) {
      const { id: _id, ...rest } = snapshot;
      showUndoToast('OKR supprimé', () => { createOkrMutation.mutate(rest); });
    }
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

  const filteredObjectives = filterObjectivesByCategory(objectives, selectedCategory);

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
    const state = location.state as {selectedOKRId?: string; openCreate?: boolean;};
    if (state?.selectedOKRId) {
      handleEditObjective(state.selectedOKRId);
      window.history.replaceState({}, document.title);
    }
    // Ouverture directe du modal de création depuis la palette ⌘K (#19).
    if (state?.openCreate) {
      setShowAddObjective(true);
      window.history.replaceState({}, document.title);
    }
    // Déclenché par la navigation (location) ; handleEditObjective omis à dessein.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // Détection des OKR à reviewer (deadline atteinte, non complétés, non encore
  // reviewés dans cette session). On affiche le 1er trouvé. Dès que l'user
  // valide ou ferme, on passe au suivant éventuel.
  useEffect(() => {
    if (deadlineReviewOkrId) return;
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const due = objectives.find(o =>
      !o.completed &&
      !reviewedOkrIds.has(o.id) &&
      new Date(o.endDate).getTime() <= todayEnd.getTime()
    );
    if (due) setDeadlineReviewOkrId(due.id);
  }, [objectives, deadlineReviewOkrId, reviewedOkrIds]);

  const deadlineReviewOkr = deadlineReviewOkrId
    ? objectives.find(o => o.id === deadlineReviewOkrId) ?? null
    : null;

  const handleCloseDeadlineReview = () => {
    if (deadlineReviewOkrId) {
      setReviewedOkrIds(prev => new Set(prev).add(deadlineReviewOkrId));
    }
    setDeadlineReviewOkrId(null);
  };

  const handleValidateDeadlineReview = (updated: OKR) => {
    updateOkrMutation.mutate({
      id: updated.id,
      updates: {
        title: updated.title,
        description: updated.description,
        endDate: updated.endDate,
        keyResults: updated.keyResults,
        progress: updated.progress,
        completed: true,
      },
    });
    toast.success('OKR validé et déplacé dans « OKR terminés »');
    handleCloseDeadlineReview();
  };

  const completedCount = objectives.filter(o => o.completed).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-[100dvh] p-4 sm:p-8 pb-[calc(64px+env(safe-area-inset-bottom)+88px)] md:pb-8 max-w-7xl mx-auto"
      style={{ backgroundColor: 'rgb(var(--color-background))' }}>

      <div className="mb-8 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <PageHeading variant="standard" className="mb-2">
            OKR - Objectifs & Résultats Clés
          </PageHeading>
          <p className="text-sm sm:text-base" style={{ color: 'rgb(var(--color-text-secondary))' }}>
            Définissez et suivez vos objectifs avec des résultats mesurables
          </p>
        </div>

        {/* Bouton "OKR terminés" en haut à droite — cible de l'animation fly-to du popup deadline (pattern Calendrier de TasksPage). */}
        <motion.button
          ref={finishedButtonRef}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCompletedModal(true)}
          aria-label="Voir la liste des OKR terminés"
          className="shrink-0 flex items-center justify-center gap-2 rounded-lg min-w-11 min-h-11 px-3 sm:px-4 py-2 transition-all shadow-sm border font-medium text-sm bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-emerald-900/20"
        >
          <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
          <span className="hidden sm:inline">OKR terminés</span>
          {completedCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              {completedCount}
            </span>
          )}
        </motion.button>
      </div>

      <div className="hidden sm:flex justify-end mb-8 gap-3">
        {/* Bouton démo : ouvrir le check-in hebdo manuellement. En prod il
            s'auto-déclenche lundi/mardi via le Dashboard. */}
        {isDemo && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCheckin(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-bold border-2 border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            aria-label="Ouvrir le check-in hebdo (démo)"
            title="Disponible uniquement en mode démo — en production le check-in s'ouvre automatiquement lundi/mardi depuis le Dashboard"
          >
            <CalendarCheck size={18} />
            <span>Check-in hebdo</span>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">démo</span>
          </motion.button>
        )}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddObjective(true)}
          data-tutorial-id="okr-create-button"
          className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-white shadow-lg shadow-blue-500/25 transform transition-all hover:scale-105 active:scale-95 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
          aria-label="Créer un nouvel objectif"
        >
          <Plus size={20} />
          <span>Nouvel Objectif</span>
        </motion.button>
      </div>

      {/* Bouton démo mobile — affiché sous le H1 */}
      {isDemo && (
        <div className="sm:hidden mb-4">
          <button
            type="button"
            onClick={() => setShowCheckin(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold border-2 border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-white dark:bg-slate-900"
          >
            <CalendarCheck size={18} />
            <span>Ouvrir le check-in hebdo</span>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">démo</span>
          </button>
        </div>
      )}

      <CategoryFilterBar
        categories={categories}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        hoveredCategoryId={hoveredCategoryId}
        setHoveredCategoryId={setHoveredCategoryId}
        editingCategoryId={editingCategoryId}
        editCategoryName={editCategoryName}
        setEditCategoryName={setEditCategoryName}
        editCategoryColor={editCategoryColor}
        setEditCategoryColor={setEditCategoryColor}
        startEditCategory={startEditCategory}
        cancelEditCategory={cancelEditCategory}
        submitEditCategory={submitEditCategory}
        setCategoryToDeleteId={setCategoryToDeleteId}
        colorOptions={colorOptions}
        resolveColor={resolveColor}
        showCreateCategory={showCreateCategory}
        setShowCreateCategory={setShowCreateCategory}
        newCategoryName={newCategoryName}
        setNewCategoryName={setNewCategoryName}
        newCategoryColor={newCategoryColor}
        setNewCategoryColor={setNewCategoryColor}
        createCategoryMutation={createCategoryMutation}
      />

      {/* État d'erreur (#39) : sans lui, un échec réseau laissait la page
          vide — indistinguable de « vous n'avez aucun OKR ». */}
      {isOkrsError && objectives.length === 0 && (
        <PageErrorState subject="les OKR" error={okrsError as Error | null} onRetry={() => refetchOkrs()} />
      )}

      {isLoadingOkrs && objectives.length === 0 && <OKRListSkeleton count={4} />}

      {!isLoadingOkrs && filteredObjectives.length === 0 && (
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
            {filteredObjectives.map((objective, index) => (
              <OKRCard
                key={objective.id}
                objective={objective}
                index={index}
                getCategoryById={getCategoryById}
                resolveColor={resolveColor}
                formatTime={formatTime}
                handleEditObjective={handleEditObjective}
                setDeletingObjective={setDeletingObjective}
                setSelectedKeyResultForModal={setSelectedKeyResultForModal}
                setShowAddTaskModal={setShowAddTaskModal}
                setShowAddEventModal={setShowAddEventModal}
                updateKeyResult={updateKeyResult}
              />
            ))}
        </AnimatePresence>
      </div>

      <OKRModalSheet
        isOpen={showAddObjective}
        onClose={handleModalClose}
        categories={categories}
        editingObjective={editingObjective}
        onSubmit={handleModalSubmit}
      />

        <DeleteObjectiveConfirm
          deletingObjective={deletingObjective}
          setDeletingObjective={setDeletingObjective}
          deleteObjective={deleteObjective}
        />

      <TaskModal
        isOpen={showAddTaskModal}
        onClose={() => setShowAddTaskModal(false)}
        isCreating={true}
        initialData={selectedKeyResultForModal ? {
          name: selectedKeyResultForModal.kr.title,
          estimatedTime: selectedKeyResultForModal.kr.estimatedTime,
          category: selectedKeyResultForModal.obj.category,
          krId: selectedKeyResultForModal.kr.id,
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
              category: selectedKeyResultForModal.obj.category,
              estimatedTime: selectedKeyResultForModal.kr.estimatedTime,
              deadline: selectedKeyResultForModal.obj.endDate,
              bookmarked: false,
              createdAt: '',
            }}
          onAddEvent={(event) => {
            createEventMutation.mutate(event);
            setShowAddEventModal(false);
          }}
        />
      }

      {/* Dialog suppression catégorie */}
      <DeleteCategoryConfirm
        open={!!categoryToDeleteId}
        categoryName={categories.find(c => c.id === categoryToDeleteId)?.name}
        onCancel={() => setCategoryToDeleteId(null)}
        onConfirm={confirmDeleteCategory}
      />

      {/* FAB Nouvel objectif — mobile only */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowAddObjective(true)}
        aria-label="Nouvel objectif"
        className="md:hidden fixed right-4 bottom-[calc(64px+env(safe-area-inset-bottom)+12px)] z-30 w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 monochrome:from-white monochrome:to-neutral-200 monochrome:text-black text-white shadow-lg shadow-blue-500/40 flex items-center justify-center"
      >
        <Plus size={28} />
      </motion.button>

      {/* Tutoriel page OKR — variante adaptée au viewport */}
      <PageTutorial
        steps={tutorialSteps}
        isOpen={tutorial.isOpen}
        onClose={tutorial.close}
        accentColor="#22C55E"
      />

      {/* Check-in hebdo — accessible manuellement en mode démo (en prod il
          s'auto-déclenche lundi/mardi via le Dashboard) */}
      <WeeklyCheckinModal isOpen={showCheckin} onClose={() => setShowCheckin(false)} />

      {/* Popup deadline atteinte : affiché à l'ouverture pour les OKR non
          complétés dont endDate <= aujourd'hui. Au validate, la carte s'anime
          vers le bouton « OKR terminés ». */}
      <OKRDeadlineReviewModal
        okr={deadlineReviewOkr}
        categories={categories}
        flyTargetRef={finishedButtonRef}
        onClose={handleCloseDeadlineReview}
        onValidate={handleValidateDeadlineReview}
        resolveColor={resolveColor}
      />

      {/* Liste des OKR terminés — ouverte par le bouton du header. Chaque
          item a un bouton "Modifier" qui referme cette modal et ouvre
          OKRModal en mode édition. */}
      <CompletedOKRsModal
        isOpen={showCompletedModal}
        onClose={() => setShowCompletedModal(false)}
        okrs={objectives.filter(o => o.completed)}
        categories={categories}
        resolveColor={resolveColor}
        onEdit={handleEditObjective}
      />
    </motion.div>);

};

export default OKRPage;

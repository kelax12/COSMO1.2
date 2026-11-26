import React, { Suspense, useState, useEffect, useRef } from 'react';
import { PageHeading } from '@/components/ui/typography';
import { MobileHeader } from '@/components/mobile';
import TouchTarget from '@/components/mobile/TouchTarget';
import { Plus, CheckCircle2 } from 'lucide-react';
import { OkrIcon } from '@/components/icons/cosmo-icons';
import { getColorHex } from '@/lib/category-colors';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router';
import { useCreateEvent } from '@/modules/events';
import { useOkrs, useCreateOkr, useUpdateOkr, useDeleteOkr, useRestoreOkrWithJournal, useUpdateKeyResult, KeyResult } from '@/modules/okrs';
import { useKRCompletions, useLoadOkrJournal } from '@/modules/kr-completions';
import { showUndoToast } from '@/lib/undo-toast';
import { useCategories } from '@/modules/categories';
import PageErrorState from '@/components/PageErrorState';
import TaskModal from '@/components/TaskModal';
import EventModal from '@/components/EventModal';
import ColorSettingsModal from '@/components/ColorSettingsModal';
import { toast } from '@/lib/toast';
import PageTutorial from '@/components/tutorial/PageTutorial';
import { useTutorial } from '@/components/tutorial/useTutorial';
import { okrTutorialStepsDesktop } from '@/tutorials/okr.desktop';
import { okrTutorialStepsMobile } from '@/tutorials/okr.mobile';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { shouldReopenOnDeadlineExtension, type Objective } from './okr/okr-page-logic';
import OKRCard from './okr/OKRCard';
import { OKRListSkeleton } from '@/components/skeletons';
import { DeleteObjectiveConfirm, OKRModalSheet } from './okr/lazy-dialogs';
import OKRFilterBar from './okr/OKRFilterBar';
import { useOKRFilters } from './okr/useOKRFilters';
import { useT } from '@/i18n/useT';
import { useDeadlineReview } from './okr/useDeadlineReview';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { formatDurationMinutes } from '@/lib/duration';

// OKR d'entreprise dont je porte un KR : section chargée à la demande (cf. ProOKRBlock).
const ProOKRBlock = lazyWithRetry(() => import('./okr/ProOKRBlock'), ['okr', 'org']);
// Deux modales qui ne s'ouvrent que sur un geste ou une échéance atteinte :
// hors du chunk de la page (cliquet `check:bundle`).
const OKRDeadlineReviewModal = lazyWithRetry(() => import('@/components/OKRDeadlineReviewModal'));
const CompletedOKRsModal = lazyWithRetry(() => import('@/components/CompletedOKRsModal'));

const OKRPage: React.FC = () => {
  const { t, tp } = useT('okr');
  const { t: tCommon } = useT('common');
  const isMobile = useIsMobile();
  const tutorial = useTutorial(isMobile ? 'okr_mobile' : 'okr_desktop', 600, !isMobile);
  const tutorialSteps = isMobile ? okrTutorialStepsMobile : okrTutorialStepsDesktop;
  const location = useLocation();
  // Le check-in hebdo peut aussi être ouvert manuellement (bouton), en plus de
  // l'auto-déclenchement lundi/mardi depuis le Dashboard.
  // Use new OKR module hooks
  const { data: objectives = [], isLoading: isLoadingOkrs, isError: isOkrsError, error: okrsError, refetch: refetchOkrs } = useOkrs();
  const createOkrMutation = useCreateOkr();
  const updateOkrMutation = useUpdateOkr();
  const deleteOkrMutation = useDeleteOkr();
  // « Annuler » d'une suppression : rend l'objectif ET son journal (C-01).
  const restoreOkrMutation = useRestoreOkrWithJournal();
  // Lu pour pouvoir CAPTURER le journal avant une suppression.
  const { data: allCompletions = [] } = useKRCompletions();
  const loadOkrJournal = useLoadOkrJournal();
  const updateKeyResultMutation = useUpdateKeyResult();
  const createEventMutation = useCreateEvent();
  const { data: categories = [] } = useCategories();
  // Popup de gestion des catégories : créer, renommer, recolorer, supprimer
  // (le filtre n'est plus qu'un menu déroulant, `OKRFilterBar`).
  const [showCategoryManage, setShowCategoryManage] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [selectedKeyResultForModal, setSelectedKeyResultForModal] = useState<{kr: KeyResult;obj: Objective;} | null>(null);
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
  const [showAddObjective, setShowAddObjective] = useState(false);
  const [deletingObjective, setDeletingObjective] = useState<string | null>(null);
  // « OKR terminés » : cible de l'animation du popup d'échéance.
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const finishedButtonRef = useRef<HTMLButtonElement>(null);

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
  const deleteObjective = async (objectiveId: string) => {
    const snapshot = objectives.find(o => o.id === objectiveId);
    // C-01 — le journal se capture AVANT le `delete` : `kr_completions`
    // cascade depuis `okrs` ET `key_results`. Sans cette capture, « Annuler »
    // laissait au graphique « KR réalisés » un trou DÉFINITIF, alors que la personne
    // venait justement de dire qu'elle ne voulait PAS supprimer. Relu entier
    // (PER-01 : `allCompletions` n'a que la fenêtre), repli sur elle si échec.
    const journalSnapshot = await loadOkrJournal(objectiveId).catch(() => allCompletions.filter(c => c.okrId === objectiveId));
    deleteOkrMutation.mutate(objectiveId);
    setDeletingObjective(null);
    if (snapshot) {
      // L'OKR, ses KR et les tâches qui les référencent (`task.krId`) revivent
      // sous leurs identifiants d'origine (R-08), et le journal est rejoué.
      showUndoToast(t('page.okrDeleted'), () => restoreOkrMutation.mutate({ okr: snapshot, completions: journalSnapshot }));
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
      // Un OKR complété parce qu'il était en retard doit redevenir « en
      // cours » dès qu'on repousse sa deadline dans le futur — sinon il
      // reste coincé dans « OKR terminés » (OKRModalSheet reconduit
      // `completed` tel quel, aucune case à cocher pour le décompléter).
      const updates = shouldReopenOnDeadlineExtension(editingObjective, data.endDate)
        ? { ...data, completed: false }
        : data;
      updateOkrMutation.mutate({ id: editingObjective.id, updates });
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

  const filters = useOKRFilters(objectives, categories);

  const getCategoryById = (id: string) => categories.find((cat: { id: string }) => cat.id === id);

  // Résout une couleur : accepte un hex (#3B82F6) ou un nom ('blue')
  const resolveColor = (color: string) =>
    color.startsWith('#') ? color : getColorHex(color);

  // Maquette 139 : une seule écriture des durées (`@/lib/duration`).
  const formatTime = formatDurationMinutes;

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
    /* eslint-disable-next-line react-hooks/exhaustive-deps --
    `handleEditObjective` omis : l effet ne doit se rejouer que sur une
       NAVIGATION. L etat de navigation est consomme puis efface
       (`replaceState`) dans la foulee, donc il ne peut pas etre relu perime. */
  }, [location]);

  // La revue d'échéance est un geste complet (repérer, proposer, clore) : elle
  // vit dans son propre module. La page garde la MUTATION, le hook n'écrit
  // rien lui-même (`src/pages/okr/useDeadlineReview.ts`, extrait).
  const deadlineReview = useDeadlineReview(objectives, (updated) => {
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
    toast.success(t('page.okrValidated'));
  });

  const completedCount = objectives.filter(o => o.completed).length;

  // Les deux modales lazy se montent à leur PREMIÈRE ouverture, puis restent
  // montées : leur sortie animée (AnimatePresence) vit à l'intérieur.
  const [completedMounted, setCompletedMounted] = useState(false);
  if (showCompletedModal && !completedMounted) setCompletedMounted(true);
  const [reviewMounted, setReviewMounted] = useState(false);
  if (deadlineReview.okr && !reviewMounted) setReviewMounted(true);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-[100dvh] p-4 sm:p-8 pb-[calc(64px+env(safe-area-inset-bottom)+88px)] md:pb-8 max-w-7xl mx-auto"
      style={{ backgroundColor: 'rgb(var(--color-background))' }}>

      {/* ── Mobile : en-tête canonique (cf. docs/MOBILE.md) ──
          Titre grand au repos, compacté au scroll. Le bloc desktop ci-dessous
          est l'ancien rendu, masqué sous `md`.
          🔴 « OKR terminés » vit désormais DANS `actions` : le poser en
          ligne séparée sous le header (comme avant) est le bug déjà corrigé
          sur le Dashboard — l'icône ne restait pas alignée avec le titre une
          fois le header compacté au scroll. Sur mobile elle perd aussi sa
          bordure/pilule au profit d'un `TouchTarget` icône seule, même
          traitement que la boîte de réception du Dashboard et de
          `TasksInboxMenu`. */}
      {/* Titre raccourci au repos : le titre complet
          (`page.title`) ne tient pas dans le `text-display` du grand titre
          et tronquait en « OKR - Objectifs & R... ». `page.titleShort` reste
          seul, au repos ET compacté : maquette 182, la page
          changeait de nom au premier défilement (« OKR - Objectifs &
          Résultats Clés »). */}
      {/* Maquette 110 : « OKR - Objectifs » disait deux fois la même chose,
          avec un tiret en plein titre, et l'onglet dit déjà « OKR ». Le
          sous-titre devient un ÉTAT (combien d'objectifs actifs) : une phrase
          de brochure n'apprend rien à quelqu'un qui revient tous les jours. */}
      <MobileHeader
        title={t('page.titleShort')}
        subtitle={tp('page.activeCount', objectives.filter((o) => !o.completed).length)}
        actions={
          <TouchTarget
            // `flyTargetRef` (OKRDeadlineReviewModal, ligne plus bas) anime un
            // objectif complété JUSQU'À ce bouton : sur mobile c'est CELUI-CI
            // qui est visible, le bouton desktop est `hidden` (donc sans
            // position de layout — sa `getBoundingClientRect()` rendrait
            // 0,0,0,0). Un seul des deux reçoit la ref à la fois.
            ref={isMobile ? finishedButtonRef : undefined}
            onClick={() => setShowCompletedModal(true)}
            aria-label={t('page.seeCompleted')}
            className="relative"
          >
            <CheckCircle2 size={20} aria-hidden="true" />
            {completedCount > 0 && (
              <span
                className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-emerald-600 text-white text-caption font-bold flex items-center justify-center shadow-sm ring-2 ring-[rgb(var(--color-background))]"
                aria-hidden="true"
              >
                {completedCount}
              </span>
            )}
          </TouchTarget>
        }
      />

      <div className="hidden md:flex mb-8 items-start justify-between gap-3">
        <div className="min-w-0">
          <PageHeading variant="standard" className="mb-2">
            {t('page.title')}
          </PageHeading>
        </div>

        {/* Bouton "OKR terminés" — cible de l'animation fly-to du popup deadline (pattern Calendrier de TasksPage). Desktop uniquement : équivalent mobile dans `MobileHeader.actions` ci-dessus. */}
        {/* Cible de l'animation fly-to du popup d'échéance. Desktop seulement :
            l'équivalent mobile vit dans `MobileHeader.actions`. */}
        <button
          ref={isMobile ? undefined : finishedButtonRef}
          type="button"
          onClick={() => setShowCompletedModal(true)}
          className="shrink-0 min-h-11 text-sm font-medium text-[rgb(var(--color-accent))] hover:underline underline-offset-4"
        >
          {t('page.seeCompletedLink')}{completedCount > 0 ? ` (${completedCount})` : ''}
        </button>
      </div>

      <div className="hidden sm:flex justify-end mb-8 gap-3">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddObjective(true)}
          data-tutorial-id="okr-create-button"
          data-guide-id="perso-okr-new"
          className="flex items-center justify-center gap-2 min-w-11 min-h-11 px-4 py-2 rounded-lg font-semibold text-sm text-[rgb(var(--color-accent-solid-foreground))] shadow-sm bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] transition-all"
          aria-label={t('page.createObjective')}
        >
          <Plus size={18} />
          <span>{t('page.newObjective')}</span>
        </motion.button>
      </div>

      <OKRFilterBar
        query={filters.query}
        onQuery={filters.setQuery}
        categories={categories}
        activeCategoryIds={filters.liveCategoryIds}
        setActiveCategoryIds={filters.setActiveCategoryIds}
        resolveColor={resolveColor}
        onManageCategories={() => setShowCategoryManage(true)}
        scope={filters.scope}
        onScope={filters.setScope}
      />

      <ColorSettingsModal
        isOpen={showCategoryManage}
        onClose={() => setShowCategoryManage(false)}
      />

      {/* État d'erreur (#39) : sans lui, un échec réseau laissait la page
          vide — indistinguable de « vous n'avez aucun OKR ». */}
      {isOkrsError && objectives.length === 0 && (
        <PageErrorState subject={tCommon('pageError.subjectOkr')} error={okrsError as Error | null} onRetry={() => refetchOkrs()} />
      )}

      {isLoadingOkrs && objectives.length === 0 && <OKRListSkeleton count={4} />}

      {!isLoadingOkrs && filters.personalEmpty && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center py-20 px-6 text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center mb-6 border border-green-100 dark:border-green-400/20">
            <OkrIcon className="w-10 h-10 text-green-500 dark:text-green-400" strokeWidth={1.75} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            {filters.unfiltered
              ? t('page.empty.allTitle')
              : t('page.empty.filteredTitle')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6">
            {filters.unfiltered
              ? t('page.empty.noneDescription')
              : t('page.empty.filteredDescription')}
          </p>
          <button
            onClick={() => setShowAddObjective(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {t('page.createOkr')}
          </button>
        </motion.div>
      )}

      <Suspense fallback={null}>
        <ProOKRBlock hidden={!filters.showPro} hasPersonal={filters.hasPersonal} query={filters.needle} />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnimatePresence mode="popLayout">
            {filters.visibleObjectives.map((objective, index) => (
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

      {/* FAB Nouvel objectif — mobile only */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowAddObjective(true)}
        aria-label="Nouvel objectif"
        className="md:hidden fixed right-4 bottom-[calc(64px+env(safe-area-inset-bottom)+12px)] z-30 w-14 h-14 rounded-2xl bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] shadow-lg shadow-black/30 flex items-center justify-center"
      >
        <Plus size={26} />
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

      {/* Popup deadline atteinte : affiché à l'ouverture pour les OKR non
          complétés dont endDate <= aujourd'hui. Au validate, la carte s'anime
          vers le bouton « OKR terminés ». */}
      {reviewMounted && <Suspense fallback={null}><OKRDeadlineReviewModal
        okr={deadlineReview.okr}
        categories={categories}
        flyTargetRef={finishedButtonRef}
        onClose={deadlineReview.close}
        onValidate={deadlineReview.validate}
        resolveColor={resolveColor}
      /></Suspense>}

      {/* Liste des OKR terminés — ouverte par le bouton du header. Chaque
          item a un bouton "Modifier" qui referme cette modal et ouvre
          OKRModalSheet en mode édition. */}
      {completedMounted && <Suspense fallback={null}><CompletedOKRsModal
        isOpen={showCompletedModal}
        onClose={() => setShowCompletedModal(false)}
        okrs={objectives.filter(o => o.completed)}
        categories={categories}
        resolveColor={resolveColor}
        onEdit={handleEditObjective}
      /></Suspense>}
    </motion.div>);

};

export default OKRPage;

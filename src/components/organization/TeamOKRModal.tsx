import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  X, Plus, Trash2, TrendingUp, Clock, Scale, Gauge, ArrowRight, ArrowLeft, Users, Building2,
} from 'lucide-react';
import {
  useCreateTeamOKR,
  useEditTeamOKR,
  type TeamOKR,
  type CreateTeamKRInput,
  type SyncTeamKRInput,
} from '@/modules/team-okrs';
import { useOrgTeams } from '@/modules/org-teams';
import type { OrgMember } from '@/modules/organizations';

interface TeamOKRModalProps {
  orgId: string;
  members: OrgMember[];
  /** OKR à modifier — absent = création. */
  editingOKR?: TeamOKR | null;
  onClose: () => void;
}

type KRDraft = {
  id?: string;
  title: string;
  targetValue: string;
  currentValue: string;
  estimatedTime: string;
  weight: string;
  unit: string;
  assigneeId: string;
};

const emptyKR = (): KRDraft => ({
  title: '', targetValue: '', currentValue: '', estimatedTime: '30', weight: '1', unit: '', assigneeId: '',
});

const inputClasses =
  'w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))]';

/** Modale création/modification d'un OKR d'équipe — wizard 2 étapes. */
const TeamOKRModal = ({ orgId, members, editingOKR, onClose }: TeamOKRModalProps) => {
  const isEditing = !!editingOKR;
  const { data: teams = [] } = useOrgTeams(orgId);
  const createOKR = useCreateTeamOKR(orgId);
  const editOKR = useEditTeamOKR(orgId);

  const [step, setStep] = useState<1 | 2>(1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [titleError, setTitleError] = useState('');

  const [title, setTitle] = useState(editingOKR?.title ?? '');
  const [category, setCategory] = useState(editingOKR?.category ?? '');
  const [description, setDescription] = useState(editingOKR?.description ?? '');
  const [endDate, setEndDate] = useState(editingOKR?.endDate ? editingOKR.endDate.slice(0, 10) : '');
  const [teamIds, setTeamIds] = useState<string[]>(editingOKR?.teamIds ?? []);
  const [krs, setKrs] = useState<KRDraft[]>(
    editingOKR && editingOKR.keyResults.length > 0
      ? editingOKR.keyResults.map((kr) => ({
          id: kr.id,
          title: kr.title,
          targetValue: String(kr.targetValue),
          currentValue: String(kr.currentValue),
          estimatedTime: String(kr.estimatedTime ?? 30),
          weight: String(kr.weight ?? 1),
          unit: kr.unit ?? '',
          assigneeId: kr.assigneeId ?? '',
        }))
      : [emptyKR()],
  );

  const isPending = createOKR.isPending || editOKR.isPending;

  const updateKR = (i: number, patch: Partial<KRDraft>) =>
    setKrs((prev) => prev.map((k, idx) => (idx === i ? { ...k, ...patch } : k)));

  const toggleTeam = (teamId: string) =>
    setTeamIds((prev) => (prev.includes(teamId) ? prev.filter((t) => t !== teamId) : [...prev, teamId]));

  const validKRs = krs.filter((k) => k.title.trim() && Number(k.targetValue) > 0);

  const handleNext = () => {
    if (!title.trim()) {
      setTitleError('Veuillez saisir un titre.');
      return;
    }
    setTitleError('');
    setDirection(1);
    setStep(2);
  };

  const handleSubmit = () => {
    if (validKRs.length === 0) return;

    if (isEditing && editingOKR) {
      const keyResults: SyncTeamKRInput[] = validKRs.map((k) => ({
        id: k.id,
        title: k.title.trim(),
        targetValue: Number(k.targetValue),
        currentValue: Number(k.currentValue) || 0,
        unit: k.unit.trim() || undefined,
        assigneeId: k.assigneeId || null,
        weight: Math.min(10, Math.max(1, Math.round(Number(k.weight) || 1))),
        estimatedTime: Math.max(0, Math.round(Number(k.estimatedTime) || 30)),
      }));
      editOKR.mutate(
        {
          okrId: editingOKR.id,
          meta: {
            title: title.trim(),
            category: category.trim(),
            description: description.trim(),
            endDate: endDate || undefined,
            teamIds,
          },
          keyResults,
        },
        { onSuccess: () => onClose() },
      );
      return;
    }

    const keyResults: CreateTeamKRInput[] = validKRs.map((k) => ({
      title: k.title.trim(),
      targetValue: Number(k.targetValue),
      currentValue: Number(k.currentValue) || 0,
      unit: k.unit.trim() || undefined,
      assigneeId: k.assigneeId || null,
      weight: Math.min(10, Math.max(1, Math.round(Number(k.weight) || 1))),
      estimatedTime: Math.max(0, Math.round(Number(k.estimatedTime) || 30)),
    }));
    createOKR.mutate(
      {
        title: title.trim(),
        category: category.trim() || undefined,
        description: description.trim() || undefined,
        endDate: endDate || undefined,
        teamIds,
        keyResults,
      },
      { onSuccess: () => onClose() },
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-t-[24px] sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgb(var(--color-border))] shrink-0">
          <div>
            <p className="text-[11px] uppercase tracking-widest font-semibold text-[rgb(var(--color-text-muted))]">
              {isEditing ? 'Modifier' : 'Nouvel objectif'} · {step}/2
            </p>
            <h2 className="text-sm font-bold leading-tight text-[rgb(var(--color-text-primary))]">
              {step === 1 ? 'Informations générales' : 'Résultats clés (KR)'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5 px-6 pt-3 pb-1 shrink-0">
          {[1, 2].map((s) => (
            <div
              key={s}
              className="h-1 flex-1 rounded-full transition-all duration-300"
              style={{ backgroundColor: step >= s ? 'rgb(59 130 246)' : 'rgb(var(--color-border))' }}
            />
          ))}
        </div>

        {/* Content — rendu conditionnel de l'étape active (pas d'AnimatePresence
            exit, robuste sous prefers-reduced-motion). */}
        <div className="flex-1 overflow-y-auto">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ x: direction * 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="px-6 py-5 space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[rgb(var(--color-text-secondary))]">
                    Nom de l'objectif <span className="text-red-500 normal-case">*</span>
                  </label>
                  <input
                    autoFocus
                    type="text"
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); setTitleError(''); }}
                    maxLength={200}
                    placeholder="Ex : Réussir le lancement produit"
                    className={`${inputClasses} ${titleError ? 'border-red-400 dark:border-red-500' : ''}`}
                  />
                  {titleError && <p className="text-xs text-red-500 mt-1">{titleError}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[rgb(var(--color-text-secondary))]">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    maxLength={2000}
                    placeholder="Décrivez l'objectif d'équipe…"
                    className={`${inputClasses} resize-none`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[rgb(var(--color-text-secondary))]">
                      Catégorie
                    </label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      maxLength={60}
                      placeholder="Ex : Croissance"
                      className={inputClasses}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[rgb(var(--color-text-secondary))]">
                      Date de fin
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className={inputClasses}
                    />
                  </div>
                </div>

                {/* Rattachement d'équipes (cloisonnement) */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[rgb(var(--color-text-secondary))]">
                    Visibilité
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setTeamIds([])}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        teamIds.length === 0
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
                      }`}
                    >
                      <Building2 size={13} aria-hidden="true" /> Toute l'entreprise
                    </button>
                    {teams.map((team) => {
                      const active = teamIds.includes(team.id);
                      return (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() => toggleTeam(team.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            active
                              ? 'bg-blue-500 border-blue-500 text-white'
                              : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
                          }`}
                        >
                          <Users size={13} aria-hidden="true" /> {team.name}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[11px] text-[rgb(var(--color-text-muted))]">
                    {teamIds.length === 0
                      ? 'Objectif visible par tous les membres de l\'entreprise.'
                      : 'Visible uniquement par les équipes sélectionnées et les admins.'}
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ x: direction * 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="px-6 py-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-[rgb(var(--color-text-muted))]">Définissez comment mesurer le succès</p>
                  <button
                    type="button"
                    onClick={() => setKrs((prev) => (prev.length < 10 ? [...prev, emptyKR()] : prev))}
                    disabled={krs.length >= 10}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 disabled:opacity-40 transition-colors"
                  >
                    <Plus size={13} aria-hidden="true" /> Ajouter un KR
                  </button>
                </div>

                <div className="space-y-2.5">
                  {krs.map((kr, idx) => (
                    <div
                      key={kr.id ?? idx}
                      className="group relative rounded-xl p-4 border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))]"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-400/40 group-hover:bg-blue-500 rounded-l-xl transition-colors" />
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[rgb(var(--color-text-muted))]">
                          Résultat clé {idx + 1}
                        </span>
                        {krs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setKrs((prev) => prev.filter((_, i) => i !== idx))}
                            aria-label="Retirer ce KR"
                            className="text-[rgb(var(--color-text-muted))] hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        value={kr.title}
                        onChange={(e) => updateKR(idx, { title: e.target.value })}
                        maxLength={300}
                        placeholder="Résultat clé mesurable"
                        className={`${inputClasses} mb-2.5 py-2`}
                      />

                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="relative">
                          <input
                            type="number"
                            value={kr.targetValue}
                            onChange={(e) => updateKR(idx, { targetValue: e.target.value })}
                            placeholder="Cible"
                            aria-label="Cible"
                            className={`${inputClasses} py-2 pr-8`}
                          />
                          <TrendingUp size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[rgb(var(--color-text-muted))]" />
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            value={kr.currentValue}
                            onChange={(e) => updateKR(idx, { currentValue: e.target.value })}
                            placeholder="Avancement"
                            aria-label="Avancement actuel"
                            className={`${inputClasses} py-2 pr-8`}
                          />
                          <Gauge size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[rgb(var(--color-text-muted))]" />
                        </div>
                      </div>

                      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-2">
                        <input
                          type="text"
                          value={kr.unit}
                          onChange={(e) => updateKR(idx, { unit: e.target.value })}
                          maxLength={30}
                          placeholder="Unité"
                          aria-label="Unité"
                          className={`${inputClasses} py-2`}
                        />
                        <div className="relative">
                          <input
                            type="number"
                            value={kr.estimatedTime}
                            onChange={(e) => updateKR(idx, { estimatedTime: e.target.value })}
                            placeholder="Durée/unité"
                            aria-label="Durée par unité en minutes"
                            className={`${inputClasses} py-2 pr-8`}
                          />
                          <Clock size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[rgb(var(--color-text-muted))]" />
                        </div>
                        <div className="relative w-20">
                          <input
                            type="number"
                            min={1}
                            max={10}
                            step={1}
                            value={kr.weight}
                            onChange={(e) => updateKR(idx, { weight: e.target.value })}
                            placeholder="1"
                            title="Coefficient d'importance (1 à 10)"
                            aria-label="Coefficient d'importance"
                            className={`${inputClasses} py-2 pr-7`}
                          />
                          <Scale size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[rgb(var(--color-text-muted))]" />
                        </div>
                      </div>

                      <select
                        value={kr.assigneeId}
                        onChange={(e) => updateKR(idx, { assigneeId: e.target.value })}
                        aria-label="Assigné"
                        className={`${inputClasses} py-2`}
                      >
                        <option value="">Non assigné</option>
                        {members.map((m) => (
                          <option key={m.userId} value={m.userId}>{m.displayName}</option>
                        ))}
                      </select>
                      <p className="mt-1.5 text-[10px] text-[rgb(var(--color-text-muted))]">
                        Cible · Avancement · Unité · Durée/unité (min) · Coef. · Assigné
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] shrink-0">
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/25 transition-all active:scale-95"
              >
                Résultats clés <ArrowRight size={15} aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { setDirection(-1); setStep(1); }}
                className="flex items-center gap-1.5 text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
              >
                <ArrowLeft size={15} aria-hidden="true" /> Retour
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={validKRs.length === 0 || isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-500/25 transition-all active:scale-95"
              >
                {isPending ? 'Enregistrement…' : isEditing ? 'Mettre à jour' : "Créer l'objectif"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default TeamOKRModal;

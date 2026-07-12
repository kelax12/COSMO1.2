import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2 } from 'lucide-react';
import { useCreateTeamOKR, type CreateTeamKRInput } from '@/modules/team-okrs';
import type { OrgMember } from '@/modules/organizations';

interface CreateTeamOKRModalProps {
  orgId: string;
  members: OrgMember[];
  onClose: () => void;
}

const inputClasses =
  'w-full h-10 px-3 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-indigo-500/40';

type KRDraft = { title: string; targetValue: string; unit: string; assigneeId: string; weight: string };
const emptyKR = (): KRDraft => ({ title: '', targetValue: '', unit: '', assigneeId: '', weight: '1' });

/** Modale de création d'un OKR d'équipe (titre + KR assignés). */
const CreateTeamOKRModal = ({ orgId, members, onClose }: CreateTeamOKRModalProps) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [krs, setKrs] = useState<KRDraft[]>([emptyKR()]);
  const createOKR = useCreateTeamOKR(orgId);

  const updateKR = (i: number, patch: Partial<KRDraft>) =>
    setKrs((prev) => prev.map((k, idx) => (idx === i ? { ...k, ...patch } : k)));

  const canSubmit =
    title.trim().length > 0 &&
    krs.some((k) => k.title.trim() && Number(k.targetValue) > 0);

  const handleSubmit = () => {
    const keyResults: CreateTeamKRInput[] = krs
      .filter((k) => k.title.trim() && Number(k.targetValue) > 0)
      .map((k) => ({
        title: k.title.trim(),
        targetValue: Number(k.targetValue),
        unit: k.unit.trim() || undefined,
        assigneeId: k.assigneeId || null,
        weight: Math.min(10, Math.max(1, Math.round(Number(k.weight) || 1))),
      }));
    createOKR.mutate(
      { title: title.trim(), category: category.trim() || undefined, description: description.trim() || undefined, keyResults },
      { onSuccess: () => onClose() },
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-t-[24px] sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">Nouvel objectif d'équipe</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Objectif (ex : Réussir le lancement)" className={inputClasses} maxLength={200} autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Catégorie" className={inputClasses} maxLength={60} />
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optionnel)" rows={2} className={`${inputClasses} h-auto py-2 resize-none`} maxLength={2000} />

          <div className="pt-2">
            <p className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-2 uppercase tracking-wide">Résultats clés</p>
            <div className="space-y-2">
              {krs.map((kr, i) => (
                <div key={i} className="rounded-xl border border-[rgb(var(--color-border))] p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input value={kr.title} onChange={(e) => updateKR(i, { title: e.target.value })} placeholder="Résultat clé mesurable" className={inputClasses} maxLength={300} />
                    {krs.length > 1 && (
                      <button type="button" onClick={() => setKrs((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Retirer ce KR" className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-red-500/10">
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" value={kr.targetValue} onChange={(e) => updateKR(i, { targetValue: e.target.value })} placeholder="Cible" className={inputClasses} />
                    <input value={kr.unit} onChange={(e) => updateKR(i, { unit: e.target.value })} placeholder="Unité" className={inputClasses} maxLength={30} />
                    <select value={kr.assigneeId} onChange={(e) => updateKR(i, { assigneeId: e.target.value })} className={inputClasses}>
                      <option value="">Non assigné</option>
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>{m.displayName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-[rgb(var(--color-text-muted))] whitespace-nowrap" htmlFor={`team-kr-weight-${i}`}>
                      Coefficient (1–10)
                    </label>
                    <input
                      id={`team-kr-weight-${i}`}
                      type="number"
                      min={1}
                      max={10}
                      step={1}
                      value={kr.weight}
                      onChange={(e) => updateKR(i, { weight: e.target.value })}
                      placeholder="1"
                      className={`${inputClasses} w-20`}
                      title="Coefficient d'importance dans la progression globale"
                    />
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setKrs((prev) => [...prev, emptyKR()])} className="mt-2 inline-flex items-center gap-1.5 text-sm text-indigo-500 hover:text-indigo-600 transition-colors">
              <Plus size={15} aria-hidden="true" /> Ajouter un résultat clé
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] transition-colors">
            Annuler
          </button>
          <button type="button" onClick={handleSubmit} disabled={!canSubmit || createOKR.isPending} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {createOKR.isPending ? 'Création…' : 'Créer l\'objectif'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CreateTeamOKRModal;

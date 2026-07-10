import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useUpdateOrganization, type MyOrganization } from '@/modules/organizations';

interface OrgProfileSheetProps {
  org: MyOrganization;
  onClose: () => void;
}

const inputClasses =
  'w-full px-3 py-2.5 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))] focus:outline-none focus:ring-2 focus:ring-indigo-500/40';

/** Édition du profil d'entreprise (admin) : nom, description, secteur. */
const OrgProfileSheet = ({ org, onClose }: OrgProfileSheetProps) => {
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description ?? '');
  const [industry, setIndustry] = useState(org.industry ?? '');
  const updateMutation = useUpdateOrganization();

  const handleSave = () => {
    updateMutation.mutate(
      {
        orgId: org.id,
        input: {
          name: name.trim(),
          description: description.trim(),
          industry: industry.trim(),
        },
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
        className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-t-[24px] sm:rounded-2xl w-full sm:max-w-md p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Profil de l'entreprise"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">Profil de l'entreprise</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="org-profile-name" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))] mb-1.5">
              Nom
            </label>
            <input
              id="org-profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClasses}
              maxLength={80}
            />
          </div>
          <div>
            <label htmlFor="org-profile-industry" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))] mb-1.5">
              Secteur d'activité
            </label>
            <input
              id="org-profile-industry"
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Design & Tech, Artisanat, Santé…"
              className={inputClasses}
              maxLength={80}
            />
          </div>
          <div>
            <label htmlFor="org-profile-description" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))] mb-1.5">
              Description
            </label>
            <textarea
              id="org-profile-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Que fait votre entreprise ?"
              rows={3}
              className={`${inputClasses} resize-none`}
              maxLength={500}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={name.trim().length < 2 || updateMutation.isPending}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {updateMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default OrgProfileSheet;

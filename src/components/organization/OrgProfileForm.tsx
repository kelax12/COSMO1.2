import { useRef, useState } from 'react';
import { Camera, Building2, Trash2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { validateAvatarFile, computeAvatarDimensions } from '@/lib/avatar-upload';
import { useUpdateOrganization, type Organization } from '@/modules/organizations';
import { useT } from '@/i18n/useT';

interface OrgProfileFormProps {
  org: Organization;
}

const inputClasses =
  'w-full px-3 py-2.5 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))] focus:outline-none focus:ring-2 focus:ring-indigo-500/40';

/**
 * Profil d'entreprise (admin) : image (#12), nom, description, secteur.
 *
 * Audit du 2026-09-24 : c'était une feuille ouverte par un crayon de
 * l'en-tête, à côté de Paramètres qui ne faisait que la rouvrir. Le profil
 * vit désormais DANS Paramètres, en formulaire ; le crayon y mène.
 */
const OrgProfileForm = ({ org }: OrgProfileFormProps) => {
  const { t } = useT('org');
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description ?? '');
  const [industry, setIndustry] = useState(org.industry ?? '');
  // undefined = inchangé ; string = nouvelle image ; null = suppression.
  const [avatarDraft, setAvatarDraft] = useState<string | null | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateMutation = useUpdateOrganization();

  const dirty =
    avatarDraft !== undefined
    || name.trim() !== org.name
    || description.trim() !== (org.description ?? '')
    || industry.trim() !== (org.industry ?? '');

  const reset = () => {
    setName(org.name);
    setDescription(org.description ?? '');
    setIndustry(org.industry ?? '');
    setAvatarDraft(undefined);
  };

  const shownAvatar = avatarDraft === undefined ? org.avatarUrl : avatarDraft ?? undefined;

  // Même pipeline que l'avatar utilisateur : validation type/taille puis
  // redimensionnement canvas → data URL jpeg compacte.
  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const verdict = validateAvatarFile(file);
    if (!verdict.ok) {
      toast.error(verdict.reason === 'type' ? t('profile.unsupportedFormat') : t('profile.tooLarge'));
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result.startsWith('data:image/')) { toast.error(t('profile.fileInvalid')); return; }
      const img = new Image();
      img.onload = () => {
        const dims = computeAvatarDimensions(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = dims.width;
        canvas.height = dims.height;
        const ctx = canvas.getContext('2d');
        setAvatarDraft(
          ctx
            ? (ctx.drawImage(img, 0, 0, canvas.width, canvas.height), canvas.toDataURL('image/jpeg', 0.85))
            : result,
        );
      };
      img.onerror = () => toast.error(t('profile.imageUnreadable'));
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    updateMutation.mutate(
      {
        orgId: org.id,
        input: {
          name: name.trim(),
          description: description.trim(),
          industry: industry.trim(),
          ...(avatarDraft !== undefined ? { avatarUrl: avatarDraft } : {}),
        },
      },
      { onSuccess: () => setAvatarDraft(undefined) },
    );
  };

  return (
    <div>
        <div className="space-y-3">
          {/* Image de profil (#12) */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label={t('profile.avatarChange')}
              className="relative group/av w-14 h-14 rounded-2xl overflow-hidden bg-gradient-to-br bg-[rgb(var(--color-accent-solid))] to-indigo-600 flex items-center justify-center text-[rgb(var(--color-accent-solid-foreground))] shrink-0"
            >
              {shownAvatar ? (
                <img src={shownAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <Building2 size={24} aria-hidden="true" />
              )}
              <span className="absolute inset-0 bg-black/40 opacity-0 group-hover/av:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={16} className="text-white" aria-hidden="true" />
              </span>
            </button>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-600 transition-colors"
              >
                <Camera size={12} aria-hidden="true" /> {t('profile.changeImage')}
              </button>
              {shownAvatar && (
                <button
                  type="button"
                  onClick={() => setAvatarDraft(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={12} aria-hidden="true" /> {t('common.removeImage')}
                </button>
              )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleAvatarFile} className="hidden" accept="image/*" />
          </div>
          <div>
            <label htmlFor="org-profile-name" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))] mb-1.5">
              {t('common.nameLabel')}
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
              {t('profile.sector')}
            </label>
            <input
              id="org-profile-industry"
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder={t('profile.sectorPlaceholder')}
              className={inputClasses}
              maxLength={80}
            />
          </div>
          <div>
            <label htmlFor="org-profile-description" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))] mb-1.5">
              {t('profile.description')}
            </label>
            <textarea
              id="org-profile-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('common.descriptionPlaceholder')}
              rows={3}
              className={`${inputClasses} resize-none`}
              maxLength={500}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={reset}
            disabled={!dirty || updateMutation.isPending}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || name.trim().length < 2 || updateMutation.isPending}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {updateMutation.isPending ? t('common.saving') : t('common.save')}
          </button>
        </div>
    </div>
  );
};

export default OrgProfileForm;

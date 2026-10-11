import { useIsMobile } from '@/lib/hooks/use-mobile';
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
  'w-full h-11 px-3.5 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))] focus:outline-none focus:ring-2 focus:ring-indigo-500/40';

/**
 * Profil d'entreprise (admin) : image (#12), nom, description, secteur.
 *
 * Audit du 2026-09-24 : c'était une feuille ouverte par un crayon de
 * l'en-tête, à côté de Paramètres qui ne faisait que la rouvrir. Le profil
 * vit désormais DANS Paramètres, en formulaire ; le crayon y mène.
 */
const OrgProfileForm = ({ org }: OrgProfileFormProps) => {
  const { t } = useT('org');
  const { t: tOrgAdmin } = useT('orgAdmin');
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description ?? '');
  const [industry, setIndustry] = useState(org.industry ?? '');
  // undefined = inchangé ; string = nouvelle image ; null = suppression.
  const [avatarDraft, setAvatarDraft] = useState<string | null | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateMutation = useUpdateOrganization();

  const isMobile = useIsMobile();
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
      toast.error(verdict.reason === 'type' ? tOrgAdmin('profile.unsupportedFormat') : tOrgAdmin('profile.tooLarge'));
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result.startsWith('data:image/')) { toast.error(tOrgAdmin('profile.fileInvalid')); return; }
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
      img.onerror = () => toast.error(tOrgAdmin('profile.imageUnreadable'));
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
        {/* Maquette 298 : sur mobile, des lignes « Nom · Nova Studio », plus des cadres. */}
        <div className="space-y-3 max-md:space-y-0">
          {/* Image de profil (#12) */}
          <div className="flex items-center gap-3 max-md:mb-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label={tOrgAdmin('profile.avatarChange')}
              className="relative group/av w-14 h-14 rounded-2xl overflow-hidden bg-gradient-to-br bg-[rgb(var(--color-accent-solid))] to-indigo-600 max-md:bg-none max-md:bg-[rgb(var(--color-hover))] max-md:text-[rgb(var(--color-text-secondary))] flex items-center justify-center text-[rgb(var(--color-accent-solid-foreground))] shrink-0"
            >
              {shownAvatar ? (
                <img src={shownAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <>
                  {/* Maquette 296 : initiales sur fond neutre, sur mobile. */}
                  <Building2 size={24} aria-hidden="true" className="max-md:hidden" />
                  <span className="md:hidden text-body font-semibold">{(name.trim() || org.name).split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')}</span>
                </>
              )}
              <span className="absolute inset-0 bg-black/40 opacity-0 group-hover/av:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={16} className="text-white" aria-hidden="true" />
              </span>
            </button>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[rgb(var(--color-accent))] hover:opacity-80 transition-colors"
              >
                <Camera size={12} aria-hidden="true" className="max-md:hidden" /> {tOrgAdmin('profile.changeImage')}
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
          <div className="max-md:flex max-md:items-center max-md:justify-between max-md:gap-3 max-md:border-b max-md:border-[rgb(var(--color-border))] max-md:py-1">
            <label htmlFor="org-profile-name" className="block text-xs max-md:text-body max-md:text-[rgb(var(--color-text-primary))] font-medium text-[rgb(var(--color-text-secondary))] mb-1.5 max-md:mb-0">
              {t('common.nameLabel')}
            </label>
            <input
              id="org-profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${inputClasses}${isMobile ? ' no-input-chrome' : ''} max-md:border-0 max-md:bg-transparent max-md:text-right max-md:px-0 max-md:w-3/5 max-md:text-[rgb(var(--color-text-secondary))]`}
              maxLength={80}
            />
          </div>
          <div className="max-md:flex max-md:items-center max-md:justify-between max-md:gap-3 max-md:border-b max-md:border-[rgb(var(--color-border))] max-md:py-1">
            <label htmlFor="org-profile-industry" className="block text-xs max-md:text-body max-md:text-[rgb(var(--color-text-primary))] font-medium text-[rgb(var(--color-text-secondary))] mb-1.5 max-md:mb-0">
              {tOrgAdmin('profile.sector')}
            </label>
            <input
              id="org-profile-industry"
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder={tOrgAdmin('profile.sectorPlaceholder')}
              className={`${inputClasses}${isMobile ? ' no-input-chrome' : ''} max-md:border-0 max-md:bg-transparent max-md:text-right max-md:px-0 max-md:w-3/5 max-md:text-[rgb(var(--color-text-secondary))]`}
              maxLength={80}
            />
          </div>
          <div className="max-md:py-2 max-md:border-b max-md:border-[rgb(var(--color-border))]">
            <label htmlFor="org-profile-description" className="block text-xs max-md:text-body max-md:text-[rgb(var(--color-text-primary))] font-medium text-[rgb(var(--color-text-secondary))] mb-1.5 max-md:mb-0">
              {tOrgAdmin('profile.description')}
            </label>
            <textarea
              id="org-profile-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('common.descriptionPlaceholder')}
              rows={3}
              // Maquette 301 : une ligne qui grandit sur mobile.
              className={`${inputClasses.replace('h-11', 'py-2.5')} resize-none${isMobile ? ' no-input-chrome' : ''} max-md:border-0 max-md:bg-transparent max-md:px-0 max-md:[field-sizing:content] max-md:min-h-0 max-md:text-[rgb(var(--color-text-secondary))]`}
              maxLength={500}
            />
          </div>
        </div>

        {/* Maquettes 299 et 300 : sur mobile, la barre n'apparaît qu'au changement. */}
        <div className={`flex justify-end gap-2 mt-5 ${dirty ? '' : 'max-md:hidden'}`}>
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
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-50 transition-colors"
          >
            {updateMutation.isPending ? t('common.saving') : t('common.save')}
          </button>
        </div>
    </div>
  );
};

export default OrgProfileForm;

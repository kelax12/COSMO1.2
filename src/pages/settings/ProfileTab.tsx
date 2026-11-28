import type { Dispatch, SetStateAction } from 'react';
import { motion } from 'framer-motion';
import { User as UserIcon, Mail, Camera } from 'lucide-react';
import type { User } from '@/modules/auth/AuthContext';
import { useT } from '@/i18n/useT';
import { TAP_AREA_44_ANCRE } from '@/components/mobile/tap-area';
import OrganizationSettingsCard from '@/components/organization/OrganizationSettingsCard';
import { LabeledInput, PrimaryButton, SectionCard } from './primitives';
import TimezoneSection from './TimezoneSection';
import { tabMotion } from './tab-motion';

export interface ProfileDraft {
  name: string;
  email: string;
}

interface ProfileTabProps {
  reduced: boolean | null;
  user: User;
  initials: string;
  onPickPhoto: () => void;
  onRemoveAvatar: () => void;
  /** Saisie locale, portée par la page : elle survit à un changement d'onglet. */
  draft: ProfileDraft;
  onDraftChange: Dispatch<SetStateAction<ProfileDraft>>;
  /** Compte OAuth : l'email se gère chez le fournisseur, champ verrouillé. */
  isThirdParty: boolean;
  onSave: () => void;
  saving: boolean;
  isMobile: boolean;
}

/** Onglet Profil : avatar, identité, fuseau horaire, carte entreprise. */
export default function ProfileTab({
  reduced, user, initials, onPickPhoto, onRemoveAvatar, draft, onDraftChange, isThirdParty, onSave, saving, isMobile,
}: ProfileTabProps) {
  const { t: tCommon } = useT('common');
  const { t } = useT('settings');
  return (
    <motion.div {...tabMotion(reduced)}
      // Deux colonnes à partir de `lg` : le groupe Entreprise vit à
      // DROITE des cartes d'identité, pas empilé sous le fuseau
      // horaire où il fallait scroller pour le trouver. `items-start`
      // pour que la colonne courte ne s'étire pas à la hauteur de
      // l'autre. Une seule colonne sous `lg` (ordre inchangé).
      className="max-w-2xl lg:max-w-5xl grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] gap-5 items-start">
      <div className="flex flex-col gap-5">
      <SectionCard>
        {/* ── Maquette 83 : le profil en une rangée sur mobile ───────
            Le bloc faisait ~155 px : un carré d'avatar de 80, le nom,
            l'email et un bouton « Changer la photo », tous CENTRÉS,
            pour trois informations qu'on ne vient pas lire. Sur mobile
            il redevient une rangée : avatar 48, nom et email à gauche,
            la photo se change par l'avatar lui-même (la pastille
            d'appareil photo, désormais toujours visible au doigt).
            `sm:` rend le bloc centré d'origine. */}
        <div className="flex flex-row sm:flex-col md:flex-row items-center sm:items-start gap-3.5 sm:gap-5">
          <div className="relative group/av shrink-0">
            <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-gradient-to-br bg-[rgb(var(--color-accent-solid))] to-violet-600 flex items-center justify-center text-[rgb(var(--color-accent-solid-foreground))] text-headline sm:text-2xl font-bold shadow-sm select-none">
              {user.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                : <span>{initials}</span>}
            </div>
            {/* Overlay icon-only : sans aria-label, axe-core le remonte
                en violation `button-name` d'impact CRITICAL (WCAG 4.1.2)
                et le guard a11y CI casse. */}
            <button onClick={() => onPickPhoto()}
              aria-label={t('profile.changePhotoAria')}
              // Sur mobile il n'y a pas de survol : la pastille est
              // toujours là, en bas à droite de l'avatar. Au-delà de
              // `sm`, le voile au survol reprend la main, inchangé.
              // C-111 · la pastille MESURAIT 24 x 24 px, soit la plus
              // petite commande des huit routes protégées. Le dessin
              // ne peut pas grandir — une pastille de 44 px avalerait
              // l'avatar de 48 —, donc la zone tactile passe par un
              // pseudo-élément, qui ne prend aucune place dans le flux.
              // ⚠️ `TAP_AREA_44_ANCRE` et non `TAP_AREA_44` : ce
              // dernier porte `relative`, qui écraserait l'`absolute`
              // ci-dessous et décrocherait la pastille du coin.
              className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[rgb(var(--color-accent-solid))] border-2 border-[rgb(var(--color-surface))] flex items-center justify-center ${TAP_AREA_44_ANCRE} sm:inset-0 sm:w-auto sm:h-auto sm:rounded-2xl sm:border-0 sm:bg-black/45 sm:opacity-0 sm:group-hover/av:opacity-100 sm:transition-opacity`}>
              <Camera size={12} className="text-white sm:hidden" aria-hidden="true" />
              <Camera size={18} className="text-white hidden sm:block" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 min-w-0 text-left sm:text-center md:text-left">
            <h2 className="text-body sm:text-lg font-bold text-[rgb(var(--color-text-primary))] truncate">{user.name}</h2>
            <p className="text-caption sm:text-sm text-[rgb(var(--color-text-secondary))] mt-0.5 truncate">{user.email}</p>
            <div className="flex flex-wrap justify-start sm:justify-center md:justify-start gap-2 mt-3">
              {/* Le bouton « Changer la photo » disparaît sous `sm` :
                  la pastille sur l'avatar fait la même chose, à deux
                  centimètres du regard. */}
              <button onClick={() => onPickPhoto()}
                className="hidden sm:inline-flex items-center gap-1.5 px-4 min-h-touch sm:min-h-[36px] border border-[rgb(var(--color-border))] rounded-lg text-xs font-semibold text-[rgb(var(--color-text-secondary))] hover:border-[rgb(var(--color-accent))] hover:text-[rgb(var(--color-accent))] transition-all duration-150">
                <Camera size={12} /> {t('profile.changePhoto')}
              </button>
              {user.avatar && (
                <button onClick={onRemoveAvatar}
                  className="inline-flex items-center gap-1.5 px-4 min-h-touch sm:min-h-[36px] border border-red-200 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-500 hover:border-red-500 hover:text-white transition-all duration-150">
                  {tCommon('actions.delete')}
                </button>
              )}
            </div>
          </div>
        </div>
      </SectionCard>
      <SectionCard>
        <h2 className="text-base font-bold text-[rgb(var(--color-text-primary))] mb-5">{t('profile.heading')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LabeledInput label={t('profile.fullName')} icon={UserIcon} value={draft.name} onChange={(e) => onDraftChange(p => ({ ...p, name: e.target.value }))} placeholder={t('profile.yourNamePlaceholder')} />
          <LabeledInput label={t('profile.emailLabel')} type="email" icon={Mail} value={draft.email} onChange={(e) => onDraftChange(p => ({ ...p, email: e.target.value }))} placeholder={t('profile.emailPlaceholder')} disabled={isThirdParty} hint={isThirdParty ? t('profile.emailManaged') : undefined} />
        </div>
        {/* Maquette 83 : pleine largeur sur mobile. C'est l'action
            principale de l'écran, et c'est elle que le FAB recouvrait
            avant d'être retiré de cette route — un bouton aligné à
            droite sur 390 px est exactement ce qu'un bouton flottant
            vient masquer. */}
        {/* Maquette 208 : le bouton n'apparaît que si quelque chose a changé. */}
        {(draft.name !== user.name || draft.email !== user.email) && <div className="flex justify-stretch sm:justify-end mt-5 [&>button]:w-full [&>button]:sm:w-auto">
          <PrimaryButton onClick={onSave} loading={saving}>{saving ? t('profile.saving') : t('profile.save')}</PrimaryButton>
        </div>}
      </SectionCard>

      {/* ── Fuseau horaire d'affichage (sa propre ligne sur mobile) ── */}
      {!isMobile && <TimezoneSection />}

      </div>

      {/* Mode entreprise : carte info (membre) ou conversion (particulier). */}
      {!isMobile && <div className="flex flex-col gap-5">
        <SectionCard>
          <OrganizationSettingsCard />
        </SectionCard>
      </div>}
    </motion.div>
  );
}

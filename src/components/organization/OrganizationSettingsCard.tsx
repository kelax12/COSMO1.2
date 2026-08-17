import { useNavigate } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { useActiveOrganization } from '@/modules/organizations';
import CreateOrJoinOrganization from './CreateOrJoinOrganization';
import { useT } from '@/i18n/useT';

/** Clé de libellé par rôle stocké — « manager » est dérivé, jamais stocké. */
const ROLE_KEYS = {
  admin: 'roles.admin',
  manager: 'roles.manager',
  member: 'roles.member',
} as const;

/**
 * Section « Entreprise » des Réglages (onglet Profil).
 *   • Membre d'une entreprise → carte info + accès à /entreprise.
 *   • Compte particulier → composant de conversion (créer / rejoindre).
 *
 * Rend son propre titre ; à insérer dans un <SectionCard> côté SettingsPage.
 */
const OrganizationSettingsCard = () => {
  const { t } = useT('org');
  const navigate = useNavigate();
  const { activeOrg: myOrg, isLoading } = useActiveOrganization();

  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-base font-bold text-[rgb(var(--color-text-primary))]">
          {t('common.settingsSection')}
        </h3>
      </div>

      {isLoading ? (
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">{t('settingsCard.loading')}</p>
      ) : myOrg ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-3">
          <div>
            <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{myOrg.name}</p>
            <p className="text-xs text-[rgb(var(--color-text-secondary))] mt-0.5">
              {t(ROLE_KEYS[myOrg.myRole as keyof typeof ROLE_KEYS] ?? 'roles.member')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/entreprise')}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 min-h-touch sm:min-h-0 sm:py-2.5 rounded-xl text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] bg-[#1f6feb] hover:bg-[rgb(var(--color-accent-solid-hover))] transition-all" // --color-accent-solid (#388bfd) ne passe pas le contraste AA (3.3:1) avec du texte blanc
          >
            {t('settingsCard.access')} <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-xs text-[rgb(var(--color-text-secondary))] mb-4">
            {t('settingsCard.hint')}
          </p>
          <CreateOrJoinOrganization onCreated={() => { /* code affiché dans le composant */ }} />
        </div>
      )}
    </>
  );
};

export default OrganizationSettingsCard;

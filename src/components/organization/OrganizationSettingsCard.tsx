import { useNavigate } from 'react-router';
import { ArrowRight, CreditCard } from 'lucide-react';
import { useAuth } from '@/modules/auth/AuthContext';
import { useActiveOrganization } from '@/modules/organizations';
import CreateOrJoinOrganization from './CreateOrJoinOrganization';
import { useT } from '@/i18n/useT';
import { buildOrgLink } from './deep-link.helpers';
import { orgSetupPath } from './org-setup.helpers';

/** Clé de libellé par rôle stocké — « manager » est dérivé, jamais stocké. */
const ROLE_KEYS = {
  admin: 'roles.admin',
  manager: 'roles.manager',
  member: 'roles.member',
} as const;

/**
 * Section « Entreprise » des Réglages (onglet Profil).
 *   • Membre d'une entreprise → carte info + accès à /entreprise.
 *   • Propriétaire → en plus, l'accès à la facturation. C'est ICI qu'on
 *     cherche un abonnement ; dans l'espace entreprise, la facturation n'a
 *     pas d'entrée de navigation (un seul compte la concerne) et n'était
 *     atteinte que par la pastille de forfait de l'en-tête.
 *   • Compte particulier → composant de conversion (créer / rejoindre).
 *
 * Rend son propre titre ; à insérer dans un <SectionCard> côté SettingsPage.
 */
const OrganizationSettingsCard = () => {
  const { t } = useT('org');
  const navigate = useNavigate();
  const { activeOrg: myOrg, isLoading } = useActiveOrganization();
  const { user } = useAuth();
  const isOwner = !!myOrg && !!user?.id && myOrg.ownerId === user.id;

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
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          {isOwner && (
            <button
              type="button"
              onClick={() => navigate(buildOrgLink('billing'))}
              className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 min-h-touch sm:min-h-0 sm:py-2.5 rounded-xl text-sm font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
            >
              <CreditCard size={15} aria-hidden="true" /> {t('settingsCard.billing')}
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/entreprise')}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 min-h-touch sm:min-h-0 sm:py-2.5 rounded-xl text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] bg-[#1f6feb] hover:bg-[rgb(var(--color-accent-solid-hover))] transition-all" // --color-accent-solid (#388bfd) ne passe pas le contraste AA (3.3:1) avec du texte blanc
          >
            {t('settingsCard.access')} <ArrowRight size={15} aria-hidden="true" />
          </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-xs text-[rgb(var(--color-text-secondary))] mb-4">
            {t('settingsCard.hint')}
          </p>
          {/* Une création ouvre l'assistant de démarrage, sur sa propre page. */}
          <CreateOrJoinOrganization onCreated={(org) => navigate(orgSetupPath(org.id))} />
        </div>
      )}
    </>
  );
};

export default OrganizationSettingsCard;

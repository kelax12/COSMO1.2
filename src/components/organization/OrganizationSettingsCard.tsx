import { useNavigate } from 'react-router';
import { ArrowRight, ChevronRight, CreditCard } from 'lucide-react';
import { useAuth } from '@/modules/auth/AuthContext';
import { useActiveOrganization } from '@/modules/organizations';
import CreateOrJoinOrganization from './CreateOrJoinOrganization';
import { useT } from '@/i18n/useT';
import { buildOrgLink } from './deep-link.helpers';

/** Clé de libellé par grade stocké : administrateur ou membre (mig. 229). */
const ROLE_KEYS = {
  admin: 'roles.admin',
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
  const { activeOrg: myOrg, isLoading, setActiveOrgId } = useActiveOrganization();
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
        <>
        {/* Maquette 214 (2026-10-10), mobile : deux lignes du même groupe.
            C'étaient deux boutons d'alignements différents (contour centré,
            puis bleu plein au texte calé à gauche). */}
        <ul className="md:hidden mt-1 -mx-1">
          <li className="border-b border-[rgb(var(--color-border))]">
            <button type="button" onClick={() => navigate('/entreprise')} className="w-full flex items-center gap-3 min-h-touch px-1 text-left">
              <span className="flex-1 min-w-0 truncate text-body text-[rgb(var(--color-text-primary))]">{myOrg.name}</span>
              <span className="text-body text-[rgb(var(--color-text-secondary))]">{t(ROLE_KEYS[myOrg.myRole as keyof typeof ROLE_KEYS] ?? 'roles.member')}</span>
              <ChevronRight size={18} aria-hidden="true" className="text-[rgb(var(--color-text-muted))]" />
            </button>
          </li>
          {isOwner && (
            <li>
              <button type="button" onClick={() => navigate(buildOrgLink('billing'))} className="w-full flex items-center gap-3 min-h-touch px-1 text-left">
                <span className="flex-1 text-body text-[rgb(var(--color-text-primary))]">{t('settingsCard.billing')}</span>
                <ChevronRight size={18} aria-hidden="true" className="text-[rgb(var(--color-text-muted))]" />
              </button>
            </li>
          )}
        </ul>
        <div className="hidden md:flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-4 mt-3">
          {/* `sm:flex-wrap` : la carte occupe UNE colonne de la grille des Réglages.
              Sans retour à la ligne, « Abonnement et factures » poussait « Accéder »
              hors de la carte et hors de l'écran (garde Visual, 2026-10-01). */}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{myOrg.name}</p>
            <p className="text-xs text-[rgb(var(--color-text-secondary))] mt-0.5">
              {t(ROLE_KEYS[myOrg.myRole as keyof typeof ROLE_KEYS] ?? 'roles.member')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
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
            className="shrink-0 inline-flex items-center gap-1.5 px-4 min-h-touch sm:min-h-0 sm:py-2.5 rounded-xl text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] transition-all" // AM-5 : le #1f6feb en dur datait d'avant C-25 ; en Noir il portait le texte quasi noir du jeton (4,32:1)
          >
            {t('settingsCard.access')} <ArrowRight size={15} aria-hidden="true" />
          </button>
          </div>
        </div>
        </>
      ) : (
        <div className="mt-3">
          <p className="text-xs text-[rgb(var(--color-text-secondary))] mb-4">
            {t('settingsCard.hint')}
          </p>
          {/* Une création mène à l'espace entreprise, où s'ouvre la vidéo d'accueil. */}
          <CreateOrJoinOrganization
            onCreated={(org) => {
              setActiveOrgId(org.id);
              navigate('/entreprise');
            }}
          />
        </div>
      )}
    </>
  );
};

export default OrganizationSettingsCard;

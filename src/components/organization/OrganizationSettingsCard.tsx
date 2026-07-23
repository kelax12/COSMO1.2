import { useNavigate } from 'react-router-dom';
import { Building2, ArrowRight } from 'lucide-react';
import { useActiveOrganization } from '@/modules/organizations';
import CreateOrJoinOrganization from './CreateOrJoinOrganization';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  manager: 'Manager',
  member: 'Membre',
};

/**
 * Section « Entreprise » des Réglages (onglet Profil).
 *   • Membre d'une entreprise → carte info + accès à /entreprise.
 *   • Compte particulier → composant de conversion (créer / rejoindre).
 *
 * Rend son propre titre ; à insérer dans un <SectionCard> côté SettingsPage.
 */
const OrganizationSettingsCard = () => {
  const navigate = useNavigate();
  const { activeOrg: myOrg, isLoading } = useActiveOrganization();

  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <Building2 size={18} className="text-[rgb(var(--color-accent))]" aria-hidden="true" />
        <h3 className="text-base font-bold text-[rgb(var(--color-text-primary))]">
          Entreprise
        </h3>
      </div>

      {isLoading ? (
        <p className="text-sm text-[rgb(var(--color-text-muted))]">Chargement…</p>
      ) : myOrg ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-3">
          <div>
            <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{myOrg.name}</p>
            <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">
              {ROLE_LABELS[myOrg.myRole] ?? 'Membre'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/entreprise')}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 min-h-touch sm:min-h-0 sm:py-2.5 rounded-xl text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] bg-[rgb(var(--color-accent-solid))] to-indigo-600 hover:bg-[rgb(var(--color-accent-solid-hover))] hover:to-indigo-500 transition-all"
          >
            Accéder <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-xs text-[rgb(var(--color-text-muted))] mb-4">
            Créez une entreprise pour collaborer avec votre équipe, ou rejoignez-en une avec un code d'invitation.
          </p>
          <CreateOrJoinOrganization onCreated={() => { /* code affiché dans le composant */ }} />
        </div>
      )}
    </>
  );
};

export default OrganizationSettingsCard;

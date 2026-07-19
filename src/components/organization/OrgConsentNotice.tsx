interface OrgConsentNoticeProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * Consentement RGPD à l'adhésion à une entreprise — affiché dans TOUS les
 * flux d'entrée (code, lien d'invitation). Résume ce que l'organisation
 * verra ; la case doit être cochée pour continuer.
 */
const OrgConsentNotice = ({ checked, onChange }: OrgConsentNoticeProps) => (
  <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] p-4 space-y-2.5">
    <p className="text-xs font-semibold text-[rgb(var(--color-text-primary))]">
      En rejoignant cette entreprise :
    </p>
    <ul className="text-xs text-[rgb(var(--color-text-secondary))] space-y-1.5 list-disc pl-4">
      <li>Les membres voient votre nom, votre avatar et votre activité sur les projets d'équipe (tâches, commentaires).</li>
      <li>Vos responsables (managers et admins) peuvent <strong>consulter votre agenda</strong> et y ajouter des événements — sauf ceux que vous marquez <strong>« Privé »</strong>, qui restent invisibles pour eux.</li>
      <li>Vos tâches, habitudes et données personnelles restent invisibles pour l'entreprise.</li>
    </ul>
    <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-[rgb(var(--color-border))] accent-[rgb(var(--color-accent))]"
      />
      <span className="text-xs text-[rgb(var(--color-text-primary))]">
        J'ai compris ce que l'entreprise pourra voir et j'accepte ces conditions.
      </span>
    </label>
  </div>
);

export default OrgConsentNotice;

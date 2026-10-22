import type { LucideIcon } from 'lucide-react';

/**
 * En-tête d'une famille de statistiques.
 *
 * La page empile ses cinq familles depuis le 2026-09-21 : sans repère, elles
 * se lisent comme une seule liste de cartes.
 *
 * Maquette 200 (2026-10-10) : sur mobile, l'icône colorée disparaît (violet,
 * bleu, rouge, vert, jaune : une couleur par titre, aucune ne voulait rien
 * dire). Desktop garde l'icône et sa couleur.
 *
 * Extrait de `StatisticsPage` le même jour : la page était à 597 lignes pour
 * un plafond de 600 (`architecture.guard`).
 */
const StatSectionHeading = ({ section, suffix }: {
  section: { label: string; icon: LucideIcon; color: string };
  // Qualificatif de période (« 7 derniers jours »), porté par le titre de la
  // vue globale.
  suffix?: string;
}) => {
  const Icon = section.icon;
  return (
    <div className="flex items-baseline gap-2.5 mt-10 mb-4">
      <Icon size={18} aria-hidden="true" style={{ color: section.color }} className="hidden md:block translate-y-0.5 shrink-0" />
      <h2 className="text-headline md:text-lg font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>
        {section.label}
        {/* L'espace explicite n'est pas décoratif : `ml-2` ne sépare que les
            pixels, le nom accessible du titre collait « Vue globale· 7 j ». */}
        {suffix && (
          <>
            {' '}
            <span className="text-sm font-medium" style={{ color: 'rgb(var(--color-text-secondary))' }}>
              · {suffix}
            </span>
          </>
        )}
      </h2>
    </div>
  );
};

export default StatSectionHeading;

// Séparateur léger entre deux sections d'une page mobile (dashboard perso,
// aperçu entreprise). Masqué à partir de `md` : le desktop garde ses cartes.
// Décoratif : `aria-hidden`, les titres de section portent la structure.
const SectionDivider = () => (
  <div
    aria-hidden="true"
    className="md:hidden h-px mx-1 bg-[rgb(var(--color-border))] opacity-60"
  />
);

export default SectionDivider;

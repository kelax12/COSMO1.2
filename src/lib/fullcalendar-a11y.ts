/**
 * FullCalendar pose `aria-labelledby` (la date) sur chaque case de la grille mensuelle.
 * Or une case porte aussi les titres de ses évènements : son texte visible n'est alors plus
 * contenu dans son nom accessible (axe 4.14, `label-content-name-mismatch`, WCAG 2.5.3).
 * Sans cet attribut, le nom d'une case se calcule depuis son contenu (jour + évènements),
 * ce qui couvre le texte visible par construction. Le rendu ne change pas.
 */
export function dayCellNameFromContent(arg: { el: HTMLElement }): void {
  arg.el.removeAttribute('aria-labelledby');
}

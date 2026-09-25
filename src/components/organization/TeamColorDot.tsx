/**
 * Pastille de la couleur CHOISIE pour une équipe (hex, `org_teams.color`).
 *
 * Règle de cohérence (2026-09-25) : la couleur d'un objet est celle que
 * l'utilisateur a choisie, et elle se voit partout où l'objet est nommé.
 * La couleur d'équipe se choisissait à la création puis ne s'affichait que
 * dans la pyramide et la page d'équipe : ailleurs, une équipe n'était qu'un
 * nom, ou une icône bleue identique pour toutes.
 */
const TeamColorDot = ({ color, size = 8 }: { color: string | null | undefined; size?: number }) => (
  <span
    className="inline-block rounded-full shrink-0"
    style={{ width: size, height: size, backgroundColor: color || 'rgb(var(--color-text-muted))' }}
    aria-hidden="true"
  />
);

export default TeamColorDot;

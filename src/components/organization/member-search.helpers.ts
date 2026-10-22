import type { OrgMember } from '@/modules/organizations';
import { normalize } from './pyramid.helpers';

/**
 * Au-delà de ce nombre de personnes, un sélecteur de membres affiche un champ
 * de recherche. En dessous, la liste tient à l'écran et le champ serait du
 * bruit. Audit « passage à l'échelle » du 2026-09-24 : à 1 000 membres, les
 * sélecteurs d'assignation et d'ajout à une équipe étaient des listes brutes
 * qu'il fallait faire défiler à la main.
 */
export const MEMBER_SEARCH_THRESHOLD = 8;

/**
 * Filtre par nom affiché ou e-mail, sans accents ni casse (« frederic »
 * trouve « Frédéric »), sur une sous-chaîne. Une requête vide rend la liste
 * telle quelle, dans son ordre.
 */
export function filterMembersByQuery<T extends Pick<OrgMember, 'displayName' | 'email'>>(
  members: T[],
  query: string,
): T[] {
  const q = normalize(query.trim());
  if (!q) return members;
  return members.filter(
    (m) => normalize(m.displayName).includes(q) || (!!m.email && normalize(m.email).includes(q)),
  );
}

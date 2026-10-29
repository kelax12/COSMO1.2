// Déplacer une catégorie d'un cran parmi ses sœurs (« Modifier l'ordre »,
// modale de gestion, 2026-10-29). Pur : rend un nouveau tableau, la modale
// ne l'écrit qu'à « Enregistrer ».
//
// Les positions de la fratrie sont RENUMÉROTÉES 0..n-1 après l'échange : des
// positions en double (créations successives à la même place) rendraient
// l'échange sans effet visible, le tri retombant sur le nom.
import type { Category } from '@/modules/categories';

const bySibling = (a: Category, b: Category): number =>
  a.position - b.position || a.name.localeCompare(b.name);

export function siblingsOf(categories: readonly Category[], id: string): Category[] {
  const target = categories.find((c) => c.id === id);
  if (!target) return [];
  return categories.filter((c) => c.parentId === target.parentId).sort(bySibling);
}

export function moveAmongSiblings(categories: readonly Category[], id: string, direction: -1 | 1): Category[] {
  const siblings = siblingsOf(categories, id);
  const index = siblings.findIndex((c) => c.id === id);
  const swapWith = index + direction;
  if (index < 0 || swapWith < 0 || swapWith >= siblings.length) return [...categories];

  const ordered = [...siblings];
  [ordered[index], ordered[swapWith]] = [ordered[swapWith], ordered[index]];
  const positions = new Map(ordered.map((c, i) => [c.id, i]));
  return categories.map((c) => (positions.has(c.id) ? { ...c, position: positions.get(c.id)! } : c));
}

// Empreinte d'un jeu de catégories, ordre des lignes indifférent : la modale
// compare brouillon et serveur pour savoir si fermer perd quelque chose.
export const draftSnapshot = (cats: readonly Category[]): string =>
  JSON.stringify([...cats].sort((a, b) => a.id.localeCompare(b.id)).map((c) => [c.id, c.name, c.color, c.parentId, c.position]));

// ═══════════════════════════════════════════════════════════════════
// Logique pure de l'organigramme (PyramidTab) — extraite pour être testée.
//
// POURQUOI CETTE EXTRACTION (audit archi 2026-08-07, point M1)
//
// `PyramidTab.tsx` fait 1 389 lignes et ~20 `useState` : drag & drop,
// auto-scroll, long-press, recherche, repli, six modales. C'est le fichier le
// plus complexe du projet, et il pilote le mode entreprise — donc le revenu
// B2B. Il n'avait aucun test, parce que rien n'y était testable : tout vivait
// dans le corps du composant.
//
// Ce module en sort les quatre fonctions qui prennent de VRAIES DÉCISIONS,
// par opposition à celles qui font du rendu :
//
//   • `canManage`         — décision d'AUTORISATION (qui peut déplacer qui)
//   • `isValidDestination` — décision d'INTÉGRITÉ (interdit les cycles)
//   • `matchesQuery`       — recherche (accents, casse)
//   • `readCollapsedIds`   — lecture localStorage tolérante aux données corrompues
//
// ⚠️ Rappel de frontière : `canManage` et `isValidDestination` sont des gardes
// d'INTERFACE. Elles évitent une action absurde et un aller-retour serveur
// inutile — elles ne protègent rien. La frontière réelle reste la RPC
// `set_member_manager` et la RLS d'`organization_members`. Ne jamais raisonner
// « c'est vérifié dans la pyramide, donc c'est sûr ».
// ═══════════════════════════════════════════════════════════════════
import { subtreeOf, type OrgMember } from '@/modules/organizations';

/** Zone de dépôt « détacher » (managerId → null). */
export const UNPLACED_DROP_ID = '__unplaced__';

/** Clé localStorage de l'état replié de la pyramide (par organisation). */
export const collapsedStorageKey = (orgId: string) => `cosmo_pyramid_collapsed_${orgId}`;

/**
 * Normalisation pour la recherche : minuscules, sans accents (diacritiques
 * combinants). « Frédéric » doit se trouver en tapant « frederic ».
 */
export const normalize = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Lecture sûre de l'état replié.
 *
 * Garde B14 (CLAUDE.md) : jamais de `JSON.parse` nu sur du localStorage — une
 * valeur corrompue (autre onglet, extension, édition manuelle) ne doit pas
 * faire planter le rendu de tout l'organigramme. Chaque entrée est en plus
 * validée individuellement : un tableau contenant des non-chaînes est filtré,
 * pas rejeté en bloc.
 */
export function readCollapsedIds(orgId: string): Set<string> {
  try {
    const raw = localStorage.getItem(collapsedStorageKey(orgId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    // localStorage indisponible (mode privé Safari) ou JSON invalide :
    // « rien de replié » est un repli sûr et sans conséquence.
    return new Set();
  }
}

/**
 * Peut-on déplacer `target` ? Admin : tous, sauf soi-même. Manager : uniquement
 * son propre sous-arbre.
 *
 * L'exclusion de soi-même n'est pas cosmétique : se déplacer soi-même permet
 * de se rattacher n'importe où dans la hiérarchie, donc de s'octroyer un
 * périmètre managérial. C'est refusé côté serveur aussi.
 */
export function canManage(
  target: OrgMember,
  members: OrgMember[],
  currentUserId: string | undefined,
  isAdmin: boolean,
): boolean {
  if (!currentUserId || target.userId === currentUserId) return false;
  if (isAdmin) return true;
  return subtreeOf(members, currentUserId).has(target.userId);
}

/**
 * `destId` est-il une destination valide pour `target` ?
 *
 * Version pure (données uniquement), utilisée en secours au relâcher quand les
 * attributs `data-drop-id` ne sont pas encore rendus — cas du glisser très
 * rapide : saisir et relâcher avant le re-render.
 *
 * La règle qui compte est la troisième : **on ne peut pas rattacher quelqu'un
 * sous l'un de ses propres subordonnés**. Sans elle, l'organigramme
 * accepterait un CYCLE (A manage B qui manage A) — et `get_subtree` est une
 * CTE récursive : un cycle la ferait tourner jusqu'à sa borne de profondeur,
 * sur chaque évaluation de policy `events`.
 */
export function isValidDestination(
  target: OrgMember,
  destId: string,
  members: OrgMember[],
  currentUserId: string | undefined,
  isAdmin: boolean,
): boolean {
  if (destId === target.userId) return false;                       // sous soi-même
  if (destId === (target.managerId ?? null)) return false;          // déjà son manager
  if (!members.some((m) => m.userId === destId)) return false;      // destination inconnue
  if (subtreeOf(members, target.userId).has(destId)) return false;  // ⚠️ cycle
  if (!isAdmin && destId !== currentUserId && !(currentUserId && subtreeOf(members, currentUserId).has(destId))) {
    return false;                                                   // hors de mon périmètre
  }
  return true;
}

/**
 * Le membre correspond-il à la recherche ? Insensible à la casse ET aux
 * accents, sur le nom affiché comme sur l'e-mail.
 */
export function matchesQuery(member: OrgMember, query: string): boolean {
  const q = normalize(query.trim());
  if (!q) return false;
  return (
    normalize(member.displayName ?? '').includes(q) ||
    normalize(member.email ?? '').includes(q)
  );
}

// ─── Grande organisation : repli par défaut, recherche ciblée ─────────
//
// Audit « passage à l'échelle » du 2026-09-24 : le repli par branche existait,
// mais tout s'ouvrait déplié. À mille personnes, la première lecture était un
// arbre de mille cartes, et une recherche dépliait TOUT pour montrer un nom.

/** Au-delà de ce nombre de personnes, la pyramide s'ouvre repliée. */
export const LARGE_PYRAMID_THRESHOLD = 40;

/**
 * Une préférence de repli a-t-elle déjà été enregistrée pour cette org ?
 * Distinct de `readCollapsedIds` : « rien de replié » est aussi une
 * préférence, qu'un repli par défaut ne doit jamais écraser.
 */
export function hasStoredCollapsed(orgId: string): boolean {
  try {
    return localStorage.getItem(collapsedStorageKey(orgId)) !== null;
  } catch {
    return false;
  }
}

/**
 * Repli par défaut d'un grand organigramme : les racines et leurs rapports
 * directs restent visibles, chaque nœud de profondeur ≥ 1 qui a des
 * subordonnés est replié. Déplier un nœud n'ouvre donc qu'UN niveau.
 */
export function defaultCollapsedIds(roots: { member: OrgMember; children: unknown[] }[]): Set<string> {
  const ids = new Set<string>();
  type Node = { member: OrgMember; children: Node[] };
  const walk = (node: Node, depth: number) => {
    if (depth >= 1 && node.children.length > 0) ids.add(node.member.userId);
    for (const c of node.children) walk(c, depth + 1);
  };
  for (const r of roots as Node[]) walk(r, 0);
  return ids;
}

/**
 * Tous les managers au-dessus des personnes trouvées. Pendant une recherche,
 * on ne déplie QUE ce chemin : le reste de l'arbre garde le repli choisi.
 * Borné par la taille de l'équipe contre un cycle `manager_id` corrompu.
 */
export function ancestorIds(members: OrgMember[], ids: Set<string>): Set<string> {
  const managerOf = new Map(members.map((m) => [m.userId, m.managerId]));
  const out = new Set<string>();
  for (const id of ids) {
    let cur = managerOf.get(id) ?? null;
    let guard = members.length;
    while (cur && guard-- > 0 && !out.has(cur)) {
      out.add(cur);
      cur = managerOf.get(cur) ?? null;
    }
  }
  return out;
}

// Validation zod — chargée à la PREMIÈRE écriture, jamais à l'ouverture.
//
// POURQUOI : `zod` pesait **131,8 ko bruts** dans le chunk d'entrée, soit le
// plus gros module non-React que tout visiteur téléchargeait — y compris celui
// qui arrive sur la landing et repart sans jamais créer quoi que ce soit.
// Mesuré par `node scripts/analyze-entry.mjs` le 2026-08-28.
//
// C'est un coût que la nature même de cette couche rend injustifiable : la
// validation zod est une **garde UX**, explicitement pas la frontière de
// sécurité (celle-ci reste la RLS + la whitelist `mapToDb`, cf. CLAUDE.md).
// Payer 130 ko à l'ouverture pour un message d'erreur plus lisible AVANT un
// appel réseau, c'est faire payer à tout le monde le confort de quelques-uns.
//
// CE QUE ÇA NE CHANGE PAS : les 17 points d'appel sont tous dans une
// `mutationFn`, donc déjà asynchrones et déjà derrière un geste utilisateur. Le
// schéma est chargé pendant que l'utilisateur vient de cliquer « Créer », et la
// validation reste STRICTEMENT antérieure à l'appel réseau — c'est tout ce que
// la garde promettait.
//
// ⚠️ **Ne jamais réimporter `@/lib/validation/validate` statiquement depuis un
// hook.** Un seul import statique suffit à ramener zod dans l'entrée, et rien
// ne le signalerait : `check:bundle` verrait le total remonter sans dire d'où.
// C'est exactement ainsi que recharts s'est retrouvé sur le chemin critique
// pendant des semaines.
//
// ⚠️ **Ne jamais réexporter un schéma depuis un barrel de module.** Les trois
// barrels le faisaient (`organizations`, `team-okrs`, `team-projects`) sans
// qu'aucun consommateur ne s'en serve : un export mort qui suffit à rattacher
// zod à tout fichier important le barrel pour une autre raison.

import type { z } from 'zod';

/**
 * Registre clé → schéma. Une clé par couple (entité, opération).
 *
 * Les imports sont dynamiques : c'est ce qui sort zod du chunk d'entrée. Les
 * regrouper ici plutôt que de disperser des `import()` dans les hooks garde une
 * seule liste à relire pour savoir ce qui est validé, et une seule frontière à
 * surveiller.
 */
const loaders = {
  'task.create': () => import('@/modules/tasks/task.schema').then((m) => m.createTaskSchema),
  'task.update': () => import('@/modules/tasks/task.schema').then((m) => m.updateTaskSchema),
  'okr.create': () => import('@/modules/okrs/okr.schema').then((m) => m.createOKRSchema),
  'okr.update': () => import('@/modules/okrs/okr.schema').then((m) => m.updateOKRSchema),
  'org.create': () =>
    import('@/modules/organizations/organization.schema').then((m) => m.createOrganizationSchema),
  'org.joinCode': () =>
    import('@/modules/organizations/organization.schema').then((m) => m.joinCodeSchema),
  'teamOkr.create': () => import('@/modules/team-okrs/team-okr.schema').then((m) => m.createTeamOKRSchema),
  'teamOkr.update': () => import('@/modules/team-okrs/team-okr.schema').then((m) => m.updateTeamOKRSchema),
  'teamKr.update': () => import('@/modules/team-okrs/team-okr.schema').then((m) => m.updateTeamKRSchema),
  'teamProject.create': () =>
    import('@/modules/team-projects/team-task.schema').then((m) => m.createTeamProjectSchema),
  'teamProject.update': () =>
    import('@/modules/team-projects/team-task.schema').then((m) => m.updateTeamProjectSchema),
  'teamTask.create': () =>
    import('@/modules/team-projects/team-task.schema').then((m) => m.createTeamTaskSchema),
  'teamTask.update': () =>
    import('@/modules/team-projects/team-task.schema').then((m) => m.updateTeamTaskSchema),
} as const;

export type SchemaKey = keyof typeof loaders;

/**
 * Toutes les clés du registre, à l'exécution.
 *
 * Exporté pour que le test puisse les parcourir TOUTES : une clé dont l'import
 * dynamique pointe vers un export inexistant ne casse rien à la compilation
 * (`m.createTaskShema` est simplement `undefined`), et ne se verrait qu'au
 * moment où un utilisateur enregistre. C'est le seul risque que la
 * paresse introduit, et il se ferme par une boucle.
 */
export const SCHEMA_KEYS = Object.keys(loaders) as SchemaKey[];
type SchemaOf<K extends SchemaKey> = Awaited<ReturnType<(typeof loaders)[K]>>;

/**
 * Valide `input` contre le schéma `key`, ou lève une `ValidationError`.
 *
 * Même contrat que `validateOrThrow`, en asynchrone : renvoie la valeur
 * PARSÉE, que treize des dix-sept points d'appel utilisent.
 */
export async function validateAsync<K extends SchemaKey>(
  key: K,
  input: unknown,
): Promise<z.infer<SchemaOf<K>>> {
  // ⚠️ Deux assertions, aucune n'est un `as any`, et toutes deux tiennent au
  // même point : indexé par un générique `K`, TypeScript élargit `loaders[key]`
  // à l'UNION des treize schémas et perd le lien K → schéma que le registre
  // garantit pourtant par construction. On valide donc contre un schéma
  // volontairement anonyme (`ZodType<unknown>`), puis on rétablit le type de
  // sortie exact, celui que la signature publique promet.
  //
  // La frontière est honnête : c'est le registre ci-dessus qui apparie clé et
  // schéma, et il est la seule chose à relire si un doute survient.
  const load = loaders[key] as () => Promise<z.ZodType<unknown>>;
  const [{ validateOrThrow }, schema] = await Promise.all([import('./validate'), load()]);
  return validateOrThrow(schema, input) as z.infer<SchemaOf<K>>;
}

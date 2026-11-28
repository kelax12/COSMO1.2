// ═══════════════════════════════════════════════════════════════════
// db-contract : les mappers à la main, accrochés au schéma (ARC-07)
//
// Avant ce fichier, les lignes brutes de chaque module (`TaskRow`, `HabitRow`…)
// étaient des interfaces écrites à la main. Renommer une colonne en base
// laissait le client compiler : le mapper lisait `row.estimated_time`,
// `undefined` à l'exécution, et aucun test ne le voyait avant la production.
//
// `src/generated/database.types.ts` est écrit par `scripts/contrat-donnees.mjs`
// depuis une base vierge où toutes les migrations sont rejouées, et la CI
// échoue s'il diverge. Ce fichier-ci est la prise : chaque ligne brute écrite
// à la main déclare à quelle table (ou fonction) elle appartient, et `tsc`
// refuse une colonne que le schéma ne porte plus.
//
//   export type TaskRowContract = Verified<ColumnsExist<TaskRow, DbRow<'tasks'>>>;
//
// Ce que cela garantit : chaque NOM de colonne d'une ligne brute existe dans le
// schéma. Ce que cela ne garantit pas : les types (les lignes écrites à la main
// sont plus étroites ou plus souples exprès : unions de chaînes, champs
// optionnels avant l'application d'une migration), ni qu'une colonne ajoutée en
// base est lue par le mapper. Témoin : `db-contract.guard.test.ts`, qui renomme
// une colonne du schéma et exige que `tsc` refuse chaque mapper.
// ═══════════════════════════════════════════════════════════════════
import type { Database, Json } from '@/generated/database.types';

export type { Json };

type Schema = Database['public'];

export type TableName = keyof Schema['Tables'];
export type FunctionName = keyof Schema['Functions'];

/**
 * Le type passé à `createClient<ClientDatabase>()` (src/lib/supabase.ts) : le
 * schéma généré, à UNE correction près. `supabase gen types` déclare chaque
 * argument de fonction non-nullable, mais Postgres n'a pas de `NOT NULL` sur un
 * argument : `p_manager := NULL` (retirer le manager), `p_target := NULL`
 * (aucun transfert) sont des appels voulus que le type généré refusait. Chaque
 * argument accepte donc `null` ; son NOM et son type restent vérifiés.
 */
type NullableArgs<Fns> = {
  [F in keyof Fns]: Fns[F] extends { Args: infer A }
    ? Omit<Fns[F], 'Args'> & { Args: { [K in keyof A]: A[K] | null } }
    : Fns[F];
};
export type ClientDatabase = Omit<Database, 'public'> & {
  public: Omit<Schema, 'Functions'> & { Functions: NullableArgs<Schema['Functions']> };
};

/** La ligne lue d'une table. */
export type DbRow<T extends TableName> = Schema['Tables'][T]['Row'];
/** La ligne écrite à l'insertion. */
export type DbInsert<T extends TableName> = Schema['Tables'][T]['Insert'];
/** La ligne écrite à la mise à jour : toutes les colonnes facultatives. */
export type DbUpdate<T extends TableName> = Schema['Tables'][T]['Update'];
/**
 * Ce qu'un `mapToDb` a le droit d'émettre : une mise à jour SANS `id` ni
 * `user_id`. La whitelist anti-mass-assignment (faille V1) devient une erreur
 * de compilation : un mapper qui écrirait `user_id` ne compile plus.
 */
export type DbPatch<T extends TableName> = Omit<DbUpdate<T>, 'id' | 'user_id'>;
/** Les arguments d'une fonction appelée par `supabase.rpc()`. */
export type RpcArgs<F extends FunctionName> = Schema['Functions'][F]['Args'];
/** Une ligne rendue par une fonction qui renvoie un tableau (`returns table`). */
export type RpcRow<F extends FunctionName> = Schema['Functions'][F]['Returns'] extends (infer R)[]
  ? R
  : Schema['Functions'][F]['Returns'];

/** Les clés de `Local` que `Reference` ne porte pas. */
export type UnknownColumns<Local, Reference> = Exclude<keyof Local, keyof Reference>;

/**
 * `true` si toutes les colonnes de `Local` existent dans `Reference`. Sinon un
 * objet qui NOMME les colonnes absentes, que `Verified` refuse avec ce nom dans
 * le message d'erreur.
 */
export type ColumnsExist<Local, Reference> = [UnknownColumns<Local, Reference>] extends [never]
  ? true
  : { colonnes_absentes_du_schema: UnknownColumns<Local, Reference> };

/** Ne s'instancie qu'avec `true` : l'erreur de compilation est le verdict. */
export type Verified<T extends true> = T;

// ═══════════════════════════════════════════════════════════════════
// Frontières typées : le client Supabase est `SupabaseClient<ClientDatabase>`
// (src/lib/supabase.ts). Les trois aides ci-dessous sont les SEULS passages
// permis entre la forme du schéma et la forme du domaine qu'il ne peut pas
// exprimer. Chacune nomme ce qu'elle suppose : grep `toJson(`, `fromJson(`,
// `asInsert(` liste toutes les hypothèses du client sur la base.
// ═══════════════════════════════════════════════════════════════════

/**
 * Écrit une valeur du domaine dans une colonne `jsonb` (ou un argument json).
 * Jamais `null` : une colonne à effacer reçoit `null` en clair, pas `toJson(null)`.
 */
export function toJson<T extends object | string | number | boolean>(value: T): NonNullable<Json> {
  return value as unknown as NonNullable<Json>;
}

/**
 * Lit une colonne `jsonb` (ou le retour json d'une RPC) dans la forme que le
 * code qui l'écrit lui donne. Le schéma ne connaît que `Json` : la forme est
 * une promesse de l'écrivain, pas une vérification.
 */
export function fromJson<T>(value: Json | null | undefined): T {
  return value as unknown as T;
}

/**
 * Une ligne d'insertion bâtie sur un `mapToDb` (toutes colonnes facultatives).
 * Les colonnes obligatoires sont garanties par la validation zod de l'entrée
 * de création (`validateOrThrow` dans la `mutationFn`), ou posées par un
 * trigger : le schéma ne peut pas le voir.
 */
export function asInsert<T extends TableName>(row: DbUpdate<T>): DbInsert<T> {
  return row as DbInsert<T>;
}

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
import type { Database } from '@/generated/database.types';

type Schema = Database['public'];

export type TableName = keyof Schema['Tables'];
export type FunctionName = keyof Schema['Functions'];

/** La ligne lue d'une table. */
export type DbRow<T extends TableName> = Schema['Tables'][T]['Row'];
/** La ligne écrite à l'insertion. */
export type DbInsert<T extends TableName> = Schema['Tables'][T]['Insert'];
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

// ═══════════════════════════════════════════════════════════════════
// KR-COMPLETIONS MODULE - Type Definitions
// ═══════════════════════════════════════════════════════════════════

/**
 * KRCompletion - Immutable record created when a Key Result is completed.
 * Append-only event log: never updated, never deleted.
 */
export interface KRCompletion {
  id: string;
  krId: string;
  okrId: string;
  userId: string;
  completedAt: string;   // ISO 8601 timestamp
  krTitle: string;
  okrTitle: string;
}

/**
 * Input type for creating a KR completion record.
 * id is generated automatically.
 */
export type CreateKRCompletionInput = Omit<KRCompletion, 'id'>;

/**
 * Filter options for querying KR completions
 */
export interface KRCompletionFilters {
  userId?: string;
  okrId?: string;
  krId?: string;
  completedAfter?: string;
  completedBefore?: string;
}

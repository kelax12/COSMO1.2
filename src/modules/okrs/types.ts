// ═══════════════════════════════════════════════════════════════════
// OKRS MODULE - Type Definitions
// ═══════════════════════════════════════════════════════════════════

/**
 * KeyResult - Represents a measurable key result for an OKR
 */
export interface KeyResult {
  id: string;
  title: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  completed: boolean;
  estimatedTime: number;
  history?: { date: string; increment: number }[];
}

/**
 * OKR - Represents an Objective with Key Results
 */
export interface OKR {
  id: string;
  title: string;
  description: string;
  category: string;
  progress: number;
  completed: boolean;
  keyResults: KeyResult[];
  startDate: string;
  endDate: string;
}

/**
 * Input type for creating a new OKR
 * - id is generated automatically
 */
export type CreateOKRInput = Omit<OKR, 'id'>;

/**
 * Input type for updating an existing OKR
 * - All fields except id are optional
 */
export type UpdateOKRInput = Partial<Omit<OKR, 'id'>>;

/**
 * Input type for updating a KeyResult
 */
export type UpdateKeyResultInput = Partial<Omit<KeyResult, 'id'>>;

/**
 * Filter options for querying OKRs
 */
export interface OKRFilters {
  category?: string;
  completed?: boolean;
  startAfter?: string;
  endBefore?: string;
}

/**
 * OKRStatus - Represents the status of an OKR
 */
export type OKRStatus = 'not_started' | 'in_progress' | 'at_risk' | 'completed';

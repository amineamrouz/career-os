/**
 * Mirrors backend/src/types.ts. Kept as a hand-written copy rather than a shared
 * package: four interfaces are not worth a build step across two apps.
 */

export type GoalStatus = 'active' | 'completed' | 'archived';

export interface Goal {
  id: number;
  title: string;
  description: string | null;
  targetDate: string | null;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Action {
  id: number;
  goalId: number;
  title: string;
  completed: boolean;
  createdAt: string;
}

/** GET /api/goals — a goal plus its action count, no actions array. */
export interface GoalSummary extends Goal {
  actionCount: number;
}

/** GET /api/goals/:id — a goal with its actions embedded. */
export interface GoalWithActions extends Goal {
  actions: Action[];
}

/** What the create form sends. Empty inputs are sent as null, never ''. */
export interface GoalDraft {
  title: string;
  description: string | null;
  targetDate: string | null;
  status: GoalStatus;
}

export const GOAL_STATUSES: readonly GoalStatus[] = ['active', 'completed', 'archived'];

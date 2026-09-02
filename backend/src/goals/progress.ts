import type { GoalProgress } from '../types.js';

/**
 * The single place the percentage is derived, so the list and detail responses
 * can never disagree. A goal with no actions is 0%, not NaN.
 */
export function computeProgress(totalActions: number, completedActions: number): GoalProgress {
  return {
    totalActions,
    completedActions,
    percentage: totalActions === 0 ? 0 : Math.round((completedActions / totalActions) * 100),
  };
}

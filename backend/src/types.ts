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

/** Completion of a goal's actions. percentage is 0-100, rounded. */
export interface GoalProgress {
  totalActions: number;
  completedActions: number;
  percentage: number;
}

export interface GoalWithActions extends Goal {
  actions: Action[];
  progress: GoalProgress;
}

/** A goals-list row: the goal plus how many actions it has and how far along it is. */
export interface GoalSummary extends Goal {
  actionCount: number;
  progress: GoalProgress;
}

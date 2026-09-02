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

export interface GoalWithActions extends Goal {
  actions: Action[];
}

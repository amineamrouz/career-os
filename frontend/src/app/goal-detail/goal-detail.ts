import { Component, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../api-error';
import { GoalsService } from '../goals.service';
import type { Action, GoalWithActions } from '../models';

@Component({
  selector: 'app-goal-detail',
  imports: [RouterLink],
  templateUrl: './goal-detail.html',
  styleUrl: './goal-detail.css',
})
export class GoalDetail {
  /** Bound from the :id route param by withComponentInputBinding(). */
  readonly id = input.required<number, unknown>({ transform: numberAttribute });

  private readonly goalsService = inject(GoalsService);
  private readonly router = inject(Router);

  protected readonly goal = signal<GoalWithActions | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  /** Action-level failures show near the checklist and leave the page loaded. */
  protected readonly actionError = signal<string | null>(null);
  protected readonly newActionTitle = signal('');
  protected readonly addingAction = signal(false);
  protected readonly deletingGoal = signal(false);
  /** Ids with a request in flight — disables just those rows. */
  protected readonly pendingActionIds = signal<ReadonlySet<number>>(new Set<number>());

  constructor() {
    // Reloads if the route id changes while the component stays mounted.
    effect(() => this.load(this.id()));
  }

  protected load(id: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.goalsService.get(id).subscribe({
      next: (goal) => {
        this.goal.set(goal);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(apiErrorMessage(err));
        this.goal.set(null);
        this.loading.set(false);
      },
    });
  }

  protected isPending(actionId: number): boolean {
    return this.pendingActionIds().has(actionId);
  }

  /**
   * Sends the checkbox's new state explicitly. The checkbox is a DOM element the
   * user has already flipped, so on failure it has to be put back by hand — the
   * [checked] binding would see an unchanged value and leave it lying.
   */
  protected toggleAction(action: Action, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const completed = checkbox.checked;

    this.actionError.set(null);
    this.setPending(action.id, true);
    this.goalsService.setActionCompleted(this.id(), action.id, completed).subscribe({
      next: (updated) => {
        this.replaceAction(updated);
        this.setPending(action.id, false);
      },
      error: (err: unknown) => {
        checkbox.checked = action.completed;
        this.actionError.set(apiErrorMessage(err));
        this.setPending(action.id, false);
      },
    });
  }

  protected addAction(): void {
    const title = this.newActionTitle().trim();
    if (title === '' || this.addingAction()) {
      return;
    }

    this.actionError.set(null);
    this.addingAction.set(true);
    this.goalsService.addAction(this.id(), title).subscribe({
      next: (action) => {
        this.goal.update((goal) => (goal ? { ...goal, actions: [...goal.actions, action] } : goal));
        this.newActionTitle.set('');
        this.addingAction.set(false);
      },
      error: (err: unknown) => {
        this.actionError.set(apiErrorMessage(err));
        this.addingAction.set(false);
      },
    });
  }

  protected deleteAction(action: Action): void {
    this.actionError.set(null);
    this.setPending(action.id, true);
    this.goalsService.removeAction(this.id(), action.id).subscribe({
      next: () => {
        this.goal.update((goal) =>
          goal ? { ...goal, actions: goal.actions.filter((a) => a.id !== action.id) } : goal,
        );
        this.setPending(action.id, false);
      },
      error: (err: unknown) => {
        this.actionError.set(apiErrorMessage(err));
        this.setPending(action.id, false);
      },
    });
  }

  protected deleteGoal(): void {
    const goal = this.goal();
    if (!goal || !confirm(`Delete "${goal.title}"? Its actions are deleted too.`)) {
      return;
    }

    this.deletingGoal.set(true);
    this.goalsService.remove(goal.id).subscribe({
      next: () => {
        void this.router.navigate(['/']);
      },
      error: (err: unknown) => {
        this.error.set(apiErrorMessage(err));
        this.deletingGoal.set(false);
      },
    });
  }

  protected onTitleInput(event: Event): void {
    this.newActionTitle.set((event.target as HTMLInputElement).value);
  }

  private replaceAction(updated: Action): void {
    this.goal.update((goal) =>
      goal
        ? { ...goal, actions: goal.actions.map((a) => (a.id === updated.id ? updated : a)) }
        : goal,
    );
  }

  private setPending(actionId: number, pending: boolean): void {
    this.pendingActionIds.update((ids) => {
      const next = new Set(ids);
      if (pending) {
        next.add(actionId);
      } else {
        next.delete(actionId);
      }
      return next;
    });
  }
}

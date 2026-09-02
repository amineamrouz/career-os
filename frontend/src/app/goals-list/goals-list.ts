import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../api-error';
import { GoalsService } from '../goals.service';
import type { GoalSummary } from '../models';

@Component({
  selector: 'app-goals-list',
  imports: [RouterLink],
  templateUrl: './goals-list.html',
  styleUrl: './goals-list.css',
})
export class GoalsList {
  private readonly goalsService = inject(GoalsService);

  protected readonly goals = signal<GoalSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  /** Only the row being deleted is disabled, not the whole list. */
  protected readonly deletingId = signal<number | null>(null);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.goalsService.list().subscribe({
      next: (goals) => {
        this.goals.set(goals);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected deleteGoal(goal: GoalSummary): void {
    // The API cascades to the goal's actions, so say so before doing it.
    if (!confirm(`Delete "${goal.title}"? Its actions are deleted too.`)) {
      return;
    }

    this.deletingId.set(goal.id);
    this.error.set(null);
    this.goalsService.remove(goal.id).subscribe({
      next: () => {
        this.goals.update((goals) => goals.filter((g) => g.id !== goal.id));
        this.deletingId.set(null);
      },
      error: (err: unknown) => {
        this.error.set(apiErrorMessage(err));
        this.deletingId.set(null);
      },
    });
  }
}

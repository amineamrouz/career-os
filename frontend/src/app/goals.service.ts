import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import type { Action, Goal, GoalDraft, GoalSummary, GoalWithActions } from './models';

/** One method per endpoint. No caching and no store — components hold their own state. */
@Injectable({ providedIn: 'root' })
export class GoalsService {
  private readonly http = inject(HttpClient);
  private readonly goalsUrl = `${environment.apiBaseUrl}/goals`;

  list(): Observable<GoalSummary[]> {
    return this.http.get<GoalSummary[]>(this.goalsUrl);
  }

  get(id: number): Observable<GoalWithActions> {
    return this.http.get<GoalWithActions>(`${this.goalsUrl}/${id}`);
  }

  create(draft: GoalDraft): Observable<Goal> {
    return this.http.post<Goal>(this.goalsUrl, draft);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.goalsUrl}/${id}`);
  }

  addAction(goalId: number, title: string): Observable<Action> {
    return this.http.post<Action>(`${this.goalsUrl}/${goalId}/actions`, { title });
  }

  /**
   * An explicit value, never a toggle: the same request twice lands in the same
   * state, so a double-tapped checkbox cannot flip it back. The backend schema is
   * strict, so `completed` must be the only key.
   */
  setActionCompleted(goalId: number, actionId: number, completed: boolean): Observable<Action> {
    return this.http.patch<Action>(`${this.goalsUrl}/${goalId}/actions/${actionId}`, { completed });
  }

  removeAction(goalId: number, actionId: number): Observable<void> {
    return this.http.delete<void>(`${this.goalsUrl}/${goalId}/actions/${actionId}`);
  }
}

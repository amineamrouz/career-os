import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoalSummary } from '../models';
import { GoalsList } from './goals-list';

const LIST_URL = 'http://localhost:3000/api/goals';

const goal = (over: Partial<GoalSummary> = {}): GoalSummary => ({
  id: 1,
  title: 'Learn Angular',
  description: null,
  targetDate: null,
  status: 'active',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  actionCount: 0,
  progress: { totalActions: 0, completedActions: 0, percentage: 0 },
  ...over,
});

/** actionCount and progress always agree, the way the API sends them. */
const withActions = (total: number, completed: number, over: Partial<GoalSummary> = {}) =>
  goal({
    actionCount: total,
    progress: {
      totalActions: total,
      completedActions: completed,
      percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
    },
    ...over,
  });

describe('GoalsList', () => {
  let fixture: ComponentFixture<GoalsList>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GoalsList);
  });

  afterEach(() => {
    http.verify();
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('shows a loading state before the response arrives', async () => {
    await fixture.whenStable();

    expect(text()).toContain('Loading goals');
    http.expectOne(LIST_URL).flush([]);
  });

  it('shows an empty state when there are no goals', async () => {
    http.expectOne(LIST_URL).flush([]);
    await fixture.whenStable();

    expect(text()).toContain('No goals yet');
  });

  it('renders a row per goal with its status, action count and percentage', async () => {
    http.expectOne(LIST_URL).flush([
      withActions(3, 1, { id: 1, title: 'Learn Angular' }),
      withActions(1, 1, { id: 2, title: 'Ship Milestone 1', status: 'archived' }),
    ]);
    await fixture.whenStable();

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('li.card');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Learn Angular');
    expect(rows[0].textContent).toContain('3 actions');
    expect(rows[0].textContent).toContain('33%');
    expect(rows[0].querySelector('.badge--active')).not.toBeNull();
    expect(rows[1].textContent).toContain('1 action');
    expect(rows[1].textContent).toContain('100%');
    expect(rows[1].querySelector('.badge--archived')).not.toBeNull();
  });

  it('says "No actions yet" rather than 0% for a goal with no actions', async () => {
    http.expectOne(LIST_URL).flush([withActions(0, 0, { id: 1 })]);
    await fixture.whenStable();

    const row = (fixture.nativeElement as HTMLElement).querySelector('li.card')!;
    expect(row.textContent).toContain('No actions yet');
    expect(row.textContent).not.toContain('0%');
    expect(row.textContent).not.toContain('0 actions');
  });

  it('shows an error instead of an empty state when the load fails', async () => {
    http
      .expectOne(LIST_URL)
      .flush({ error: { message: 'Internal server error' } }, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(text()).toContain('Internal server error');
    expect(text()).not.toContain('No goals yet');
  });

  it('deletes a goal after confirmation and drops the row', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    http.expectOne(LIST_URL).flush([goal({ id: 1 }), goal({ id: 2, title: 'Second' })]);
    await fixture.whenStable();

    const deleteButton = (fixture.nativeElement as HTMLElement).querySelector(
      'li.card button',
    ) as HTMLButtonElement;
    deleteButton.click();

    const req = http.expectOne(`${LIST_URL}/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('li.card')).toHaveLength(1);
    expect(text()).toContain('Second');
  });

  it('does not call the API when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    http.expectOne(LIST_URL).flush([goal({ id: 1 })]);
    await fixture.whenStable();

    (
      (fixture.nativeElement as HTMLElement).querySelector('li.card button') as HTMLButtonElement
    ).click();

    http.expectNone(`${LIST_URL}/1`);
  });
});

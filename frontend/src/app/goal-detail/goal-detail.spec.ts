import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Action, GoalWithActions } from '../models';
import { GoalDetail } from './goal-detail';

const GOAL_URL = 'http://localhost:3000/api/goals/1';

const action = (over: Partial<Action> = {}): Action => ({
  id: 10,
  goalId: 1,
  title: 'Read the docs',
  completed: false,
  createdAt: '2026-09-01T10:00:00.000Z',
  ...over,
});

/** Progress as the API would compute it for the given actions. */
const progressFor = (actions: Action[]) => ({
  totalActions: actions.length,
  completedActions: actions.filter((a) => a.completed).length,
  percentage:
    actions.length === 0
      ? 0
      : Math.round((actions.filter((a) => a.completed).length / actions.length) * 100),
});

const goal = (over: Partial<GoalWithActions> = {}): GoalWithActions => {
  const actions = over.actions ?? [];
  return {
    id: 1,
    title: 'Learn Angular',
    description: null,
    targetDate: null,
    status: 'active',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    progress: progressFor(actions),
    ...over,
    actions,
  };
};

describe('GoalDetail', () => {
  let fixture: ComponentFixture<GoalDetail>;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GoalDetail);
    // The :id route param arrives as a string; numberAttribute converts it.
    fixture.componentRef.setInput('id', '1');
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
  });

  const host = () => fixture.nativeElement as HTMLElement;
  const text = () => host().textContent ?? '';

  it('requests the goal named by the route param', () => {
    expect(http.expectOne(GOAL_URL).request.method).toBe('GET');
  });

  it('renders the goal and its checklist', async () => {
    http.expectOne(GOAL_URL).flush(
      goal({
        description: 'Milestone 1',
        targetDate: '2026-12-31',
        actions: [action({ id: 10, title: 'Read the docs' }), action({ id: 11, title: 'Build it', completed: true })],
      }),
    );
    await fixture.whenStable();

    expect(text()).toContain('Learn Angular');
    expect(text()).toContain('Milestone 1');
    expect(text()).toContain('2026-12-31');

    const boxes = host().querySelectorAll<HTMLInputElement>('input[type=checkbox]');
    expect(boxes).toHaveLength(2);
    expect(boxes[0].checked).toBe(false);
    expect(boxes[1].checked).toBe(true);
    expect(host().querySelectorAll('.done')).toHaveLength(1);
  });

  it('says so when the goal has no actions, with no bar and no 0%', async () => {
    http.expectOne(GOAL_URL).flush(goal());
    await fixture.whenStable();

    expect(text()).toContain('No actions yet');
    expect(text()).not.toContain('0%');
    expect(host().querySelector('.progress')).toBeNull();
  });

  it('shows the progress bar and summary line', async () => {
    http.expectOne(GOAL_URL).flush(
      goal({
        actions: [
          action({ id: 10, completed: true }),
          action({ id: 11 }),
          action({ id: 12 }),
        ],
      }),
    );
    await fixture.whenStable();

    expect(text()).toContain('1 / 3 actions completed (33%)');
    const bar = host().querySelector<HTMLElement>('.progress')!;
    expect(bar.getAttribute('aria-valuenow')).toBe('33');
    expect(bar.querySelector<HTMLElement>('.progress__fill')!.style.width).toBe('33%');
  });

  it('moves the bar when an action is checked, without refetching the goal', async () => {
    http.expectOne(GOAL_URL).flush(goal({ actions: [action({ id: 10 }), action({ id: 11 })] }));
    await fixture.whenStable();
    expect(text()).toContain('0 / 2 actions completed (0%)');

    host().querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
    http.expectOne(`${GOAL_URL}/actions/10`).flush(action({ id: 10, completed: true }));
    await fixture.whenStable();

    expect(text()).toContain('1 / 2 actions completed (50%)');
    // No second GET: progress is re-derived locally.
    http.expectNone(GOAL_URL);
  });

  it('moves the bar when an action is added or deleted', async () => {
    http.expectOne(GOAL_URL).flush(goal({ actions: [action({ id: 10, completed: true })] }));
    await fixture.whenStable();
    expect(text()).toContain('1 / 1 actions completed (100%)');

    const input = host().querySelector<HTMLInputElement>('input[type=text]')!;
    input.value = 'Another';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    host()
      .querySelector<HTMLFormElement>('form.add-action')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    http.expectOne(`${GOAL_URL}/actions`).flush(action({ id: 11, title: 'Another' }));
    await fixture.whenStable();

    expect(text()).toContain('1 / 2 actions completed (50%)');

    host().querySelectorAll<HTMLButtonElement>('li.action button')[1].click();
    http.expectOne(`${GOAL_URL}/actions/11`).flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(text()).toContain('1 / 1 actions completed (100%)');
  });

  it('falls back to "No actions yet" once the last action is deleted', async () => {
    http.expectOne(GOAL_URL).flush(goal({ actions: [action({ id: 10 })] }));
    await fixture.whenStable();

    host().querySelector<HTMLButtonElement>('li.action button')!.click();
    http.expectOne(`${GOAL_URL}/actions/10`).flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(text()).toContain('No actions yet');
    expect(host().querySelector('.progress')).toBeNull();
  });

  it('marks an action complete with an explicit true', async () => {
    http.expectOne(GOAL_URL).flush(goal({ actions: [action()] }));
    await fixture.whenStable();

    host().querySelector<HTMLInputElement>('input[type=checkbox]')!.click();

    const req = http.expectOne(`${GOAL_URL}/actions/10`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ completed: true });
    req.flush(action({ completed: true }));
    await fixture.whenStable();

    expect(host().querySelectorAll('.done')).toHaveLength(1);
  });

  it('unmarks a completed action with an explicit false', async () => {
    http.expectOne(GOAL_URL).flush(goal({ actions: [action({ completed: true })] }));
    await fixture.whenStable();

    host().querySelector<HTMLInputElement>('input[type=checkbox]')!.click();

    const req = http.expectOne(`${GOAL_URL}/actions/10`);
    expect(req.request.body).toEqual({ completed: false });
    req.flush(action({ completed: false }));
    await fixture.whenStable();

    expect(host().querySelectorAll('.done')).toHaveLength(0);
  });

  it('puts the checkbox back and explains when the toggle fails', async () => {
    http.expectOne(GOAL_URL).flush(goal({ actions: [action()] }));
    await fixture.whenStable();

    const box = host().querySelector<HTMLInputElement>('input[type=checkbox]')!;
    box.click();
    expect(box.checked).toBe(true);

    http
      .expectOne(`${GOAL_URL}/actions/10`)
      .flush({ error: { message: 'Action 10 not found for goal 1' } }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    expect(box.checked).toBe(false);
    expect(text()).toContain('Action 10 not found for goal 1');
  });

  it('adds an action and appends it to the checklist', async () => {
    http.expectOne(GOAL_URL).flush(goal());
    await fixture.whenStable();

    const input = host().querySelector<HTMLInputElement>('input[type=text]')!;
    input.value = 'Write tests';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    host().querySelector<HTMLFormElement>('form.add-action')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );

    const req = http.expectOne(`${GOAL_URL}/actions`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ title: 'Write tests' });
    req.flush(action({ id: 12, title: 'Write tests' }));
    await fixture.whenStable();

    expect(text()).toContain('Write tests');
    expect(input.value).toBe('');
  });

  it('will not submit a blank action title', async () => {
    http.expectOne(GOAL_URL).flush(goal());
    await fixture.whenStable();

    const input = host().querySelector<HTMLInputElement>('input[type=text]')!;
    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    const addButton = host().querySelector<HTMLButtonElement>('form.add-action button')!;
    expect(addButton.disabled).toBe(true);

    host().querySelector<HTMLFormElement>('form.add-action')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    http.expectNone(`${GOAL_URL}/actions`);
  });

  it('deletes an action and removes its row', async () => {
    http.expectOne(GOAL_URL).flush(goal({ actions: [action()] }));
    await fixture.whenStable();

    host().querySelector<HTMLButtonElement>('li.action button')!.click();

    const req = http.expectOne(`${GOAL_URL}/actions/10`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(host().querySelectorAll('li.action')).toHaveLength(0);
  });

  it('deletes the goal after confirmation and leaves the page', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    http.expectOne(GOAL_URL).flush(goal());
    await fixture.whenStable();

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    host().querySelector<HTMLButtonElement>('.row.spread button')!.click();

    http.expectOne(GOAL_URL).flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('shows an error when the goal cannot be loaded', async () => {
    http
      .expectOne(GOAL_URL)
      .flush({ error: { message: 'Goal 1 not found' } }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    expect(text()).toContain('Goal 1 not found');
  });
});

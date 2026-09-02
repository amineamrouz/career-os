import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoalForm } from './goal-form';

const GOALS_URL = 'http://localhost:3000/api/goals';

describe('GoalForm', () => {
  let fixture: ComponentFixture<GoalForm>;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GoalForm);
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
  });

  const host = () => fixture.nativeElement as HTMLElement;

  const type = async (selector: string, value: string) => {
    const field = host().querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };

  const submit = async () => {
    host().querySelector<HTMLFormElement>('form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await fixture.whenStable();
  };

  it('defaults the status to active', () => {
    expect(host().querySelector<HTMLSelectElement>('#status')!.value).toBe('active');
  });

  it('sends empty optional fields as null, not empty strings', async () => {
    await type('#title', 'Learn Angular');
    await submit();

    const req = http.expectOne(GOALS_URL);
    expect(req.request.method).toBe('POST');
    // targetDate: '' would be a 400 from the API, and '' is not "no description".
    expect(req.request.body).toEqual({
      title: 'Learn Angular',
      description: null,
      targetDate: null,
      status: 'active',
    });
    // Left unflushed on purpose: a successful create navigates, which is covered below.
  });

  it('sends every field that was filled in, with the title trimmed', async () => {
    await type('#title', '  Ship Milestone 1  ');
    await type('#description', 'Goals and actions only');
    await type('#targetDate', '2026-12-31');
    const status = host().querySelector<HTMLSelectElement>('#status')!;
    status.value = 'completed';
    status.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    await submit();

    expect(http.expectOne(GOALS_URL).request.body).toEqual({
      title: 'Ship Milestone 1',
      description: 'Goals and actions only',
      targetDate: '2026-12-31',
      status: 'completed',
    });
  });

  it('blocks submission and explains when the title is missing', async () => {
    await submit();

    http.expectNone(GOALS_URL);
    expect(host().textContent).toContain('A title is required');
  });

  it('treats a whitespace-only title as missing, like the API does', async () => {
    await type('#title', '    ');
    await submit();

    http.expectNone(GOALS_URL);
    expect(host().textContent).toContain('A title is required');
  });

  it('goes to the new goal on success', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await type('#title', 'Learn Angular');
    await submit();

    http.expectOne(GOALS_URL).flush({ id: 42, title: 'Learn Angular' });
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/goals', 42]);
  });

  it('keeps the form and shows the message when the API rejects it', async () => {
    await type('#title', 'Learn Angular');
    await submit();

    http.expectOne(GOALS_URL).flush(
      { error: { message: 'Validation failed', details: [{ path: 'title', message: 'Too big' }] } },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();

    expect(host().textContent).toContain('Validation failed');
    expect(host().querySelector<HTMLInputElement>('#title')!.value).toBe('Learn Angular');
  });
});

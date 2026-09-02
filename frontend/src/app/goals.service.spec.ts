import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GoalsService } from './goals.service';
import type { GoalDraft } from './models';

const BASE = 'http://localhost:3000/api/goals';

describe('GoalsService', () => {
  let service: GoalsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GoalsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('lists goals', () => {
    service.list().subscribe();

    expect(http.expectOne(BASE).request.method).toBe('GET');
  });

  it('fetches one goal with its actions', () => {
    service.get(3).subscribe();

    expect(http.expectOne(`${BASE}/3`).request.method).toBe('GET');
  });

  it('posts a draft as-is, nulls included', () => {
    const draft: GoalDraft = {
      title: 'Learn Angular',
      description: null,
      targetDate: null,
      status: 'active',
    };

    service.create(draft).subscribe();

    const req = http.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(draft);
  });

  it('deletes a goal', () => {
    service.remove(5).subscribe();

    expect(http.expectOne(`${BASE}/5`).request.method).toBe('DELETE');
  });

  it('adds an action under its goal', () => {
    service.addAction(2, 'Read the docs').subscribe();

    const req = http.expectOne(`${BASE}/2/actions`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ title: 'Read the docs' });
  });

  it('patches an action with an explicit completed value only', () => {
    service.setActionCompleted(2, 8, true).subscribe();

    const req = http.expectOne(`${BASE}/2/actions/8`);
    expect(req.request.method).toBe('PATCH');
    // The API schema is strict: completed must be the only key.
    expect(req.request.body).toEqual({ completed: true });
  });

  it('patches false just as explicitly, so unmarking is not a toggle', () => {
    service.setActionCompleted(2, 8, false).subscribe();

    expect(http.expectOne(`${BASE}/2/actions/8`).request.body).toEqual({ completed: false });
  });

  it('deletes an action through its goal', () => {
    service.removeAction(2, 8).subscribe();

    expect(http.expectOne(`${BASE}/2/actions/8`).request.method).toBe('DELETE');
  });
});

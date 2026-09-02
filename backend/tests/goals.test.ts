import type { Express } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/index.js';
import { createTestApp } from './helpers/testDb.js';

let app: Express;
let db: Db;

beforeEach(() => {
  ({ app, db } = createTestApp());
});

afterEach(() => {
  db.close();
});

const createGoal = (body: object | string = { title: 'Learn Angular' }) =>
  request(app).post('/api/goals').send(body);

describe('POST /api/goals', () => {
  it('creates a goal with defaults applied', async () => {
    const res = await createGoal({ title: 'Learn Angular' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(Number),
      title: 'Learn Angular',
      description: null,
      targetDate: null,
      status: 'active',
    });
    expect(res.body.createdAt).toEqual(res.body.updatedAt);
  });

  it('stores every provided field', async () => {
    const res = await createGoal({
      title: 'Ship Milestone 1',
      description: 'Goals and actions only',
      targetDate: '2026-12-31',
      status: 'completed',
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'Ship Milestone 1',
      description: 'Goals and actions only',
      targetDate: '2026-12-31',
      status: 'completed',
    });
  });

  it('rejects a missing, empty or whitespace-only title', async () => {
    expect((await createGoal({})).status).toBe(400);
    expect((await createGoal({ title: '' })).status).toBe(400);
    expect((await createGoal({ title: '   ' })).status).toBe(400);
  });

  it('rejects an unknown status', async () => {
    const res = await createGoal({ title: 'Valid', status: 'in-progress' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
    expect(res.body.error.details[0].path).toBe('status');
  });

  it('rejects an unparseable targetDate', async () => {
    expect((await createGoal({ title: 'Valid', targetDate: 'someday' })).status).toBe(400);
  });
});

describe('GET /api/goals', () => {
  it('returns goals newest first, without actions', async () => {
    await createGoal({ title: 'First' });
    const second = await createGoal({ title: 'Second' });
    await request(app).post(`/api/goals/${second.body.id}/actions`).send({ title: 'An action' });

    const res = await request(app).get('/api/goals');

    expect(res.status).toBe(200);
    expect(res.body.map((goal: { title: string }) => goal.title)).toEqual(['Second', 'First']);
    expect(res.body[0]).not.toHaveProperty('actions');
  });

  it('carries an action count per goal, without the actions themselves', async () => {
    const withNone = await createGoal({ title: 'No actions' });
    const withTwo = await createGoal({ title: 'Two actions' });
    for (const title of ['First action', 'Second action']) {
      await request(app).post(`/api/goals/${withTwo.body.id}/actions`).send({ title });
    }

    const res = await request(app).get('/api/goals');

    const counts = new Map<number, number>(
      res.body.map((goal: { id: number; actionCount: number }) => [goal.id, goal.actionCount]),
    );
    expect(counts.get(withNone.body.id)).toBe(0);
    expect(counts.get(withTwo.body.id)).toBe(2);
    expect(res.body[0]).not.toHaveProperty('actions');

    const rows = new Map<number, { progress: unknown }>(
      res.body.map((goal: { id: number; progress: unknown }) => [goal.id, goal]),
    );
    expect(rows.get(withNone.body.id)?.progress).toEqual({
      totalActions: 0,
      completedActions: 0,
      percentage: 0,
    });
    expect(rows.get(withTwo.body.id)?.progress).toEqual({
      totalActions: 2,
      completedActions: 0,
      percentage: 0,
    });
  });

  it('returns an empty array when there are no goals', async () => {
    const res = await request(app).get('/api/goals');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/goals/:id', () => {
  it('embeds an empty actions array for a goal with none', async () => {
    const { body: goal } = await createGoal();

    const res = await request(app).get(`/api/goals/${goal.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: goal.id, title: 'Learn Angular', actions: [] });
    expect(res.body.progress).toEqual({ totalActions: 0, completedActions: 0, percentage: 0 });
  });

  it('embeds the goal actions, oldest first', async () => {
    const { body: goal } = await createGoal();
    await request(app).post(`/api/goals/${goal.id}/actions`).send({ title: 'Read docs' });
    await request(app).post(`/api/goals/${goal.id}/actions`).send({ title: 'Build an app' });

    const res = await request(app).get(`/api/goals/${goal.id}`);

    expect(res.body.actions.map((a: { title: string }) => a.title)).toEqual([
      'Read docs',
      'Build an app',
    ]);
    expect(res.body.progress).toEqual({ totalActions: 2, completedActions: 0, percentage: 0 });
  });

  it('404s for an unknown id and 400s for a non-integer id', async () => {
    expect((await request(app).get('/api/goals/999')).status).toBe(404);
    expect((await request(app).get('/api/goals/abc')).status).toBe(400);
    expect((await request(app).get('/api/goals/1.5')).status).toBe(400);
  });
});

describe('PUT /api/goals/:id', () => {
  it('replaces the goal, clearing fields the client omitted', async () => {
    const { body: goal } = await createGoal({
      title: 'Original',
      description: 'To be cleared',
      targetDate: '2026-01-01',
      status: 'archived',
    });

    const res = await request(app).put(`/api/goals/${goal.id}`).send({ title: 'Replaced' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: goal.id,
      title: 'Replaced',
      description: null,
      targetDate: null,
      status: 'active',
      createdAt: goal.createdAt,
    });
  });

  it('advances updatedAt but not createdAt', async () => {
    const { body: goal } = await createGoal();
    await new Promise((resolve) => setTimeout(resolve, 5));

    const res = await request(app).put(`/api/goals/${goal.id}`).send({ title: 'Renamed' });

    expect(Date.parse(res.body.updatedAt)).toBeGreaterThan(Date.parse(goal.updatedAt));
    expect(res.body.createdAt).toBe(goal.createdAt);
  });

  it('accepts a goal fetched from the API, extra read-only fields and all', async () => {
    const { body: goal } = await createGoal();
    const { body: fetched } = await request(app).get(`/api/goals/${goal.id}`);

    const res = await request(app)
      .put(`/api/goals/${goal.id}`)
      .send({ ...fetched, title: 'Round-tripped' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Round-tripped');
  });

  it('requires a title and 404s for an unknown id', async () => {
    const { body: goal } = await createGoal();

    expect((await request(app).put(`/api/goals/${goal.id}`).send({})).status).toBe(400);
    expect((await request(app).put('/api/goals/999').send({ title: 'X' })).status).toBe(404);
  });
});

describe('DELETE /api/goals/:id', () => {
  it('deletes the goal, then 404s for it', async () => {
    const { body: goal } = await createGoal();

    expect((await request(app).delete(`/api/goals/${goal.id}`)).status).toBe(204);
    expect((await request(app).get(`/api/goals/${goal.id}`)).status).toBe(404);
  });

  it('404s for an unknown id', async () => {
    expect((await request(app).delete('/api/goals/999')).status).toBe(404);
  });
});

describe('error handling', () => {
  it('404s an unmatched route and 400s a malformed JSON body', async () => {
    expect((await request(app).get('/api/nope')).status).toBe(404);

    const res = await request(app)
      .post('/api/goals')
      .set('content-type', 'application/json')
      .send('{"title": ');

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Malformed JSON body');
  });
});

describe('CORS', () => {
  it('answers a preflight with 204 and the allow headers', async () => {
    const res = await request(app)
      .options('/api/goals')
      .set('Origin', 'http://localhost:4200')
      .set('Access-Control-Request-Method', 'POST');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:4200');
    expect(res.headers['access-control-allow-methods']).toContain('PATCH');
    expect(res.headers['access-control-allow-headers']).toBe('Content-Type');
  });

  it('sets allow-origin on a normal response too', async () => {
    const res = await request(app).get('/api/goals');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:4200');
  });
});

describe('goal progress', () => {
  /** Creates a goal with `total` actions and completes the first `completed` of them. */
  const goalWith = async (total: number, completed: number): Promise<number> => {
    const { body: goal } = await createGoal({ title: `${completed}/${total}` });
    const ids: number[] = [];
    for (let i = 0; i < total; i += 1) {
      const { body: action } = await request(app)
        .post(`/api/goals/${goal.id}/actions`)
        .send({ title: `Action ${i + 1}` });
      ids.push(action.id);
    }
    for (const id of ids.slice(0, completed)) {
      await request(app)
        .patch(`/api/goals/${goal.id}/actions/${id}`)
        .send({ completed: true });
    }
    return goal.id;
  };

  const progressOf = async (goalId: number) =>
    (await request(app).get(`/api/goals/${goalId}`)).body.progress;

  it('is 0% for a goal with no actions, never NaN', async () => {
    expect(await progressOf(await goalWith(0, 0))).toEqual({
      totalActions: 0,
      completedActions: 0,
      percentage: 0,
    });
  });

  it('rounds to the nearest integer', async () => {
    // 1/3 = 33.33 rounds down, 2/3 = 66.67 rounds up.
    expect(await progressOf(await goalWith(3, 1))).toEqual({
      totalActions: 3,
      completedActions: 1,
      percentage: 33,
    });
    expect(await progressOf(await goalWith(3, 2))).toEqual({
      totalActions: 3,
      completedActions: 2,
      percentage: 67,
    });
  });

  it('rounds a half up', async () => {
    // 1/8 = 12.5 — the tie case.
    expect((await progressOf(await goalWith(8, 1))).percentage).toBe(13);
  });

  it('is 100% when every action is complete', async () => {
    expect(await progressOf(await goalWith(4, 4))).toEqual({
      totalActions: 4,
      completedActions: 4,
      percentage: 100,
    });
  });

  it('follows an action being marked and unmarked', async () => {
    const { body: goal } = await createGoal();
    const { body: action } = await request(app)
      .post(`/api/goals/${goal.id}/actions`)
      .send({ title: 'Read docs' });

    await request(app)
      .patch(`/api/goals/${goal.id}/actions/${action.id}`)
      .send({ completed: true });
    expect((await progressOf(goal.id)).percentage).toBe(100);

    await request(app)
      .patch(`/api/goals/${goal.id}/actions/${action.id}`)
      .send({ completed: false });
    expect((await progressOf(goal.id)).percentage).toBe(0);
  });

  it('drops back to 0% when the only completed action is deleted', async () => {
    const { body: goal } = await createGoal();
    const { body: kept } = await request(app)
      .post(`/api/goals/${goal.id}/actions`)
      .send({ title: 'Kept' });
    const { body: doomed } = await request(app)
      .post(`/api/goals/${goal.id}/actions`)
      .send({ title: 'Doomed' });
    await request(app)
      .patch(`/api/goals/${goal.id}/actions/${doomed.id}`)
      .send({ completed: true });
    expect((await progressOf(goal.id)).percentage).toBe(50);

    await request(app).delete(`/api/goals/${goal.id}/actions/${doomed.id}`);

    expect(await progressOf(goal.id)).toEqual({
      totalActions: 1,
      completedActions: 0,
      percentage: 0,
    });
    expect(kept.id).toBeGreaterThan(0);
  });

  it('reports the same progress on the list as on the detail', async () => {
    const goalId = await goalWith(3, 2);

    const list = await request(app).get('/api/goals');
    const row = list.body.find((goal: { id: number }) => goal.id === goalId);

    expect(row.progress).toEqual(await progressOf(goalId));
  });

  it('keeps progress separate per goal', async () => {
    const half = await goalWith(2, 1);
    const done = await goalWith(2, 2);

    const list = await request(app).get('/api/goals');
    const byId = new Map<number, { progress: { percentage: number } }>(
      list.body.map((goal: { id: number }) => [goal.id, goal]),
    );

    expect(byId.get(half)?.progress.percentage).toBe(50);
    expect(byId.get(done)?.progress.percentage).toBe(100);
  });
});

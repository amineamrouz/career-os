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

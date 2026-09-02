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

/** Creates a goal and returns its id. */
async function newGoal(title = 'Learn Angular'): Promise<number> {
  const res = await request(app).post('/api/goals').send({ title });
  return res.body.id as number;
}

/** Creates an action under a goal and returns its id. */
async function newAction(goalId: number, title = 'Read the docs'): Promise<number> {
  const res = await request(app).post(`/api/goals/${goalId}/actions`).send({ title });
  return res.body.id as number;
}

const countActions = (): number =>
  (db.prepare('SELECT count(*) AS n FROM actions').get() as { n: number }).n;

describe('POST /api/goals/:goalId/actions', () => {
  it('creates an incomplete action under the goal', async () => {
    const goalId = await newGoal();

    const res = await request(app).post(`/api/goals/${goalId}/actions`).send({ title: 'Read docs' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(Number),
      goalId,
      title: 'Read docs',
      completed: false,
      createdAt: expect.any(String),
    });
  });

  it('has no updatedAt field', async () => {
    const goalId = await newGoal();

    const res = await request(app).post(`/api/goals/${goalId}/actions`).send({ title: 'Read docs' });

    expect(res.body).not.toHaveProperty('updatedAt');
  });

  it('404s under an unknown goal', async () => {
    const res = await request(app).post('/api/goals/999/actions').send({ title: 'Orphan' });

    expect(res.status).toBe(404);
    expect(countActions()).toBe(0);
  });

  it('rejects a missing or empty title', async () => {
    const goalId = await newGoal();

    expect((await request(app).post(`/api/goals/${goalId}/actions`).send({})).status).toBe(400);
    expect(
      (await request(app).post(`/api/goals/${goalId}/actions`).send({ title: '  ' })).status,
    ).toBe(400);
  });
});

describe('PATCH /api/goals/:goalId/actions/:id', () => {
  it('marks an action complete', async () => {
    const goalId = await newGoal();
    const actionId = await newAction(goalId);

    const res = await request(app)
      .patch(`/api/goals/${goalId}/actions/${actionId}`)
      .send({ completed: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: actionId, goalId, completed: true });
  });

  it('is idempotent — the same value twice yields the same state', async () => {
    const goalId = await newGoal();
    const actionId = await newAction(goalId);
    const url = `/api/goals/${goalId}/actions/${actionId}`;

    const first = await request(app).patch(url).send({ completed: true });
    const second = await request(app).patch(url).send({ completed: true });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.completed).toBe(true);
    expect(second.body).toEqual(first.body);
  });

  it('unmarks a completed action', async () => {
    const goalId = await newGoal();
    const actionId = await newAction(goalId);
    const url = `/api/goals/${goalId}/actions/${actionId}`;

    await request(app).patch(url).send({ completed: true });
    const res = await request(app).patch(url).send({ completed: false });

    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(false);
  });

  it('requires a boolean completed field', async () => {
    const goalId = await newGoal();
    const actionId = await newAction(goalId);
    const url = `/api/goals/${goalId}/actions/${actionId}`;

    expect((await request(app).patch(url).send({})).status).toBe(400);
    expect((await request(app).patch(url).send({ completed: 'yes' })).status).toBe(400);
    expect((await request(app).patch(url).send({ complete: true })).status).toBe(400);
  });

  it('404s for an unknown action and an unknown goal', async () => {
    const goalId = await newGoal();

    expect(
      (await request(app).patch(`/api/goals/${goalId}/actions/999`).send({ completed: true })).status,
    ).toBe(404);
    expect(
      (await request(app).patch('/api/goals/999/actions/1').send({ completed: true })).status,
    ).toBe(404);
  });
});

describe('action ownership', () => {
  it('refuses to patch an action through a different goal, leaving it untouched', async () => {
    const goalA = await newGoal('Goal A');
    const goalB = await newGoal('Goal B');
    const actionId = await newAction(goalA, 'Belongs to A');

    const res = await request(app)
      .patch(`/api/goals/${goalB}/actions/${actionId}`)
      .send({ completed: true });

    expect(res.status).toBe(404);

    const { body: reloaded } = await request(app).get(`/api/goals/${goalA}`);
    expect(reloaded.actions[0]).toMatchObject({ id: actionId, completed: false });
  });

  it('refuses to delete an action through a different goal, leaving it untouched', async () => {
    const goalA = await newGoal('Goal A');
    const goalB = await newGoal('Goal B');
    const actionId = await newAction(goalA, 'Belongs to A');

    const res = await request(app).delete(`/api/goals/${goalB}/actions/${actionId}`);

    expect(res.status).toBe(404);
    expect(countActions()).toBe(1);
  });
});

describe('DELETE /api/goals/:goalId/actions/:id', () => {
  it('deletes the action and drops it from the goal detail', async () => {
    const goalId = await newGoal();
    const actionId = await newAction(goalId);

    expect((await request(app).delete(`/api/goals/${goalId}/actions/${actionId}`)).status).toBe(204);

    const { body: goal } = await request(app).get(`/api/goals/${goalId}`);
    expect(goal.actions).toEqual([]);
  });

  it('404s for an unknown action', async () => {
    const goalId = await newGoal();

    expect((await request(app).delete(`/api/goals/${goalId}/actions/999`)).status).toBe(404);
  });
});

describe('cascade', () => {
  it('deletes a goal actions along with it', async () => {
    const goalId = await newGoal();
    await newAction(goalId, 'One');
    await newAction(goalId, 'Two');
    expect(countActions()).toBe(2);

    expect((await request(app).delete(`/api/goals/${goalId}`)).status).toBe(204);

    // Direct proof that PRAGMA foreign_keys = ON took effect: without it,
    // ON DELETE CASCADE is silently ignored and these rows would be orphaned.
    expect(countActions()).toBe(0);
  });

  it('leaves other goals actions alone', async () => {
    const goalA = await newGoal('Goal A');
    const goalB = await newGoal('Goal B');
    await newAction(goalA, 'A action');
    await newAction(goalB, 'B action');

    await request(app).delete(`/api/goals/${goalA}`);

    expect(countActions()).toBe(1);
    const { body: remaining } = await request(app).get(`/api/goals/${goalB}`);
    expect(remaining.actions).toHaveLength(1);
  });
});

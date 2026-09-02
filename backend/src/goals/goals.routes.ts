import { Router } from 'express';
import { createActionsRepository } from '../actions/actions.repository.js';
import type { Db } from '../db/index.js';
import { notFound } from '../errors.js';
import { parseId } from '../params.js';
import type { GoalWithActions } from '../types.js';
import { createGoalsRepository, type GoalInput } from './goals.repository.js';
import { goalBodySchema, type GoalBody } from './goals.schema.js';
import { computeProgress } from './progress.js';

/** Absent description/targetDate become null; absent status defaults to active. */
const toInput = (body: GoalBody): GoalInput => ({
  title: body.title,
  description: body.description ?? null,
  targetDate: body.targetDate ?? null,
  status: body.status ?? 'active',
});

export function createGoalsRouter(db: Db): Router {
  const goals = createGoalsRepository(db);
  const actions = createActionsRepository(db);
  const router = Router();

  router.post('/', (req, res) => {
    const goal = goals.create(toInput(goalBodySchema.parse(req.body)));
    res.status(201).json(goal);
  });

  // Bare goals — actions are only carried by the detail response below.
  router.get('/', (_req, res) => {
    res.json(goals.findAll());
  });

  router.get('/:id', (req, res) => {
    const id = parseId(req.params.id, 'id');
    const goal = goals.findById(id);
    if (!goal) {
      throw notFound(`Goal ${id} not found`);
    }
    const goalActions = actions.findByGoalId(id);
    const body: GoalWithActions = {
      ...goal,
      actions: goalActions,
      progress: computeProgress(
        goalActions.length,
        goalActions.filter((action) => action.completed).length,
      ),
    };
    res.json(body);
  });

  router.put('/:id', (req, res) => {
    const id = parseId(req.params.id, 'id');
    const updated = goals.update(id, toInput(goalBodySchema.parse(req.body)));
    if (!updated) {
      throw notFound(`Goal ${id} not found`);
    }
    res.json(updated);
  });

  router.delete('/:id', (req, res) => {
    const id = parseId(req.params.id, 'id');
    if (!goals.remove(id)) {
      throw notFound(`Goal ${id} not found`);
    }
    res.status(204).send();
  });

  return router;
}

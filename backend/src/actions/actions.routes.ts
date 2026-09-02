import { Router } from 'express';
import type { Db } from '../db/index.js';
import { notFound } from '../errors.js';
import { createGoalsRepository } from '../goals/goals.repository.js';
import { parseId } from '../params.js';
import { createActionsRepository } from './actions.repository.js';
import { createActionSchema, patchActionSchema } from './actions.schema.js';

/**
 * Mounted at /api/goals/:goalId/actions, so mergeParams is required to read
 * goalId. Handler generics spell out the merged params for the type checker.
 */
export function createActionsRouter(db: Db): Router {
  const goals = createGoalsRepository(db);
  const actions = createActionsRepository(db);
  const router = Router({ mergeParams: true });

  router.post<{ goalId: string }>('/', (req, res) => {
    const goalId = parseId(req.params.goalId, 'goalId');
    if (!goals.exists(goalId)) {
      throw notFound(`Goal ${goalId} not found`);
    }
    const { title } = createActionSchema.parse(req.body);
    res.status(201).json(actions.create(goalId, title));
  });

  router.patch<{ goalId: string; id: string }>('/:id', (req, res) => {
    const goalId = parseId(req.params.goalId, 'goalId');
    const id = parseId(req.params.id, 'id');
    const { completed } = patchActionSchema.parse(req.body);
    const updated = actions.setCompleted(id, goalId, completed);
    if (!updated) {
      throw notFound(`Action ${id} not found for goal ${goalId}`);
    }
    res.json(updated);
  });

  router.delete<{ goalId: string; id: string }>('/:id', (req, res) => {
    const goalId = parseId(req.params.goalId, 'goalId');
    const id = parseId(req.params.id, 'id');
    if (!actions.remove(id, goalId)) {
      throw notFound(`Action ${id} not found for goal ${goalId}`);
    }
    res.status(204).send();
  });

  return router;
}

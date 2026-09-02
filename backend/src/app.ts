import express, { type Express } from 'express';
import { createActionsRouter } from './actions/actions.routes.js';
import type { Db } from './db/index.js';
import { createGoalsRouter } from './goals/goals.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

/** Builds the app around an existing connection. No listen() — tests mount this directly. */
export function buildApp(db: Db): Express {
  const app = express();

  app.use(express.json());

  app.use('/api/goals/:goalId/actions', createActionsRouter(db));
  app.use('/api/goals', createGoalsRouter(db));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

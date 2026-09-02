// Career OS Backend

import express, { type Express } from 'express';
import { createActionsRouter } from './actions/actions.routes.js';
import type { Db } from './db/index.js';
import { createGoalsRouter } from './goals/goals.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

/**
 * A browser will not let the Angular dev server (:4200) read responses from this
 * API (:3000) without these headers. Hand-written rather than pulling in `cors`:
 * there is no auth in Milestone 1, so the whole policy is four headers and a
 * preflight short-circuit.
 */
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:4200';

/** Builds the app around an existing connection. No listen() — tests mount this directly. */
export function buildApp(db: Db): Express {
  const app = express();

  // Ahead of express.json() so a preflight never reaches the body parser.
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json());

  app.use('/api/goals/:goalId/actions', createActionsRouter(db));
  app.use('/api/goals', createGoalsRouter(db));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

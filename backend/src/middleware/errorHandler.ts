import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors.js';

/** Catch-all for unmatched routes. Mounted after every router. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: { message: `Cannot ${req.method} ${req.path}` } });
}

/**
 * Mounted last. Express 5 forwards rejected promises here on its own, so route
 * handlers need no async wrapper.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        message: 'Validation failed',
        details: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({ error: { message: err.message } });
    return;
  }

  // Malformed JSON from express.json() arrives as a SyntaxError carrying a status.
  if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
    res.status(400).json({ error: { message: 'Malformed JSON body' } });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { message: 'Internal server error' } });
}

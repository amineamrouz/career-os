import type { Express } from 'express';
import { buildApp } from '../../src/app.js';
import { createDb, type Db } from '../../src/db/index.js';

/**
 * A fresh in-memory database and app per test — no shared state, no cleanup,
 * no ordering dependence between tests.
 */
export function createTestApp(): { app: Express; db: Db } {
  const db = createDb(':memory:');
  return { app: buildApp(db), db };
}

import { badRequest } from './errors.js';

/** Parses a route parameter that must be a positive integer id. */
export function parseId(raw: string, name: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest(`Invalid ${name}: expected a positive integer, got "${raw}"`);
  }
  return id;
}

import type { Db } from '../db/index.js';
import type { Action } from '../types.js';

interface ActionRow extends Omit<Action, 'completed'> {
  completed: number;
}

// SQLite has no boolean type, and better-sqlite3 refuses JS booleans as
// bindings — so 0/1 conversion happens here and nowhere else.
const toAction = (row: ActionRow): Action => ({ ...row, completed: Boolean(row.completed) });

export function createActionsRepository(db: Db) {
  const insertStmt = db.prepare(
    `INSERT INTO actions (goalId, title, completed, createdAt)
     VALUES (@goalId, @title, 0, @createdAt)`,
  );
  const findByGoalIdStmt = db.prepare(
    `SELECT * FROM actions WHERE goalId = ? ORDER BY createdAt ASC, id ASC`,
  );
  const findOwnedStmt = db.prepare(`SELECT * FROM actions WHERE id = ? AND goalId = ?`);
  const setCompletedStmt = db.prepare(
    `UPDATE actions SET completed = @completed WHERE id = @id AND goalId = @goalId`,
  );
  const deleteStmt = db.prepare(`DELETE FROM actions WHERE id = ? AND goalId = ?`);

  /**
   * Ownership check: an action is only reachable through the goal it belongs
   * to, so a mismatched pair returns undefined and the route 404s.
   */
  const findOwned = (id: number, goalId: number): Action | undefined => {
    const row = findOwnedStmt.get(id, goalId) as ActionRow | undefined;
    return row ? toAction(row) : undefined;
  };

  return {
    findOwned,

    findByGoalId: (goalId: number): Action[] =>
      (findByGoalIdStmt.all(goalId) as ActionRow[]).map(toAction),

    create: (goalId: number, title: string): Action => {
      const info = insertStmt.run({ goalId, title, createdAt: new Date().toISOString() });
      const created = findOwned(Number(info.lastInsertRowid), goalId);
      if (!created) {
        throw new Error('Action insert succeeded but the row could not be read back');
      }
      return created;
    },

    /** Returns undefined when the action does not exist under that goal. */
    setCompleted: (id: number, goalId: number, completed: boolean): Action | undefined => {
      if (!findOwned(id, goalId)) {
        return undefined;
      }
      setCompletedStmt.run({ id, goalId, completed: completed ? 1 : 0 });
      return findOwned(id, goalId);
    },

    remove: (id: number, goalId: number): boolean => deleteStmt.run(id, goalId).changes > 0,
  };
}

export type ActionsRepository = ReturnType<typeof createActionsRepository>;

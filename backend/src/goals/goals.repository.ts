import type { Db } from '../db/index.js';
import type { Goal, GoalStatus, GoalSummary } from '../types.js';

export interface GoalInput {
  title: string;
  description: string | null;
  targetDate: string | null;
  status: GoalStatus;
}

export function createGoalsRepository(db: Db) {
  const insertStmt = db.prepare(
    `INSERT INTO goals (title, description, targetDate, status, createdAt, updatedAt)
     VALUES (@title, @description, @targetDate, @status, @createdAt, @updatedAt)`,
  );
  const updateStmt = db.prepare(
    `UPDATE goals
        SET title = @title,
            description = @description,
            targetDate = @targetDate,
            status = @status,
            updatedAt = @updatedAt
      WHERE id = @id`,
  );
  // LEFT JOIN so a goal with no actions counts 0 rather than being dropped, and
  // COUNT(a.id) rather than COUNT(*) so the join's null row does not count as 1.
  // id is the tie-breaker: createdAt has millisecond resolution, so two goals
  // created in the same tick would otherwise order non-deterministically.
  const findAllStmt = db.prepare(
    `SELECT g.*, COUNT(a.id) AS actionCount
       FROM goals g
       LEFT JOIN actions a ON a.goalId = g.id
      GROUP BY g.id
      ORDER BY g.createdAt DESC, g.id DESC`,
  );
  const findByIdStmt = db.prepare(`SELECT * FROM goals WHERE id = ?`);
  const existsStmt = db.prepare(`SELECT 1 FROM goals WHERE id = ?`);
  const deleteStmt = db.prepare(`DELETE FROM goals WHERE id = ?`);

  const findById = (id: number): Goal | undefined =>
    findByIdStmt.get(id) as Goal | undefined;

  const exists = (id: number): boolean => existsStmt.get(id) !== undefined;

  return {
    findById,
    exists,

    findAll: (): GoalSummary[] => findAllStmt.all() as GoalSummary[],

    create: (input: GoalInput): Goal => {
      const now = new Date().toISOString();
      const info = insertStmt.run({ ...input, createdAt: now, updatedAt: now });
      const created = findById(Number(info.lastInsertRowid));
      if (!created) {
        throw new Error('Goal insert succeeded but the row could not be read back');
      }
      return created;
    },

    /** Full replace. Returns undefined when the goal does not exist. */
    update: (id: number, input: GoalInput): Goal | undefined => {
      if (!exists(id)) {
        return undefined;
      }
      updateStmt.run({ ...input, id, updatedAt: new Date().toISOString() });
      return findById(id);
    },

    /** Cascades to the goal's actions via the FK constraint. */
    remove: (id: number): boolean => deleteStmt.run(id).changes > 0,
  };
}

export type GoalsRepository = ReturnType<typeof createGoalsRepository>;

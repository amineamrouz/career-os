import { buildApp } from './app.js';
import { createDb } from './db/index.js';

const port = Number(process.env.PORT ?? 3000);
const db = createDb();
const server = buildApp(db).listen(port, () => {
  console.log(`Career OS API listening on http://localhost:${port}`);
});

const shutdown = (): void => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

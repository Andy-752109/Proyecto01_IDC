import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { After, AfterAll, Before, BeforeAll } from '@cucumber/cucumber';
import { db, pool } from '../../server/src/db/client';
import { annotations } from '../../server/src/db/schema';
import { createTestApp } from '../../server/src/testApp';
import { resetTestState } from './testState';

let server: Server;

// exported as `let` (not `const`) because it's assigned asynchronously in
// BeforeAll, once the OS has picked a free port — step definitions read it
// after that point, never before.
export let baseUrl = '';

BeforeAll(async () => {
  const app = createTestApp();
  server = app.listen(0);
  await new Promise<void>((resolve) => {
    server.once('listening', resolve);
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://localhost:${address.port}`;
});

AfterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  // Without this, the mysql2 connection pool keeps its sockets open and
  // Node never exits on its own — the terminal looks "stuck" after the
  // test run finishes, even though every scenario already ran.
  await pool.end();
});

Before(() => {
  resetTestState();
});

After(async () => {
  // Wipe annotations created during the scenario so scenarios stay
  // independent of each other. Categories and seeded images (T-03 fixtures)
  // are never touched — only the mutable `annotations` table.
  await db.delete(annotations);
});

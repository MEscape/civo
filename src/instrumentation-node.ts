import { runAuthStartup } from '@modules/auth';

/** What the server does once at start, on the Node.js runtime only (it reads the database and sends mail). */
export async function runStartupTasks(): Promise<void> {
  await runAuthStartup();
}

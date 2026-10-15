/**
 * Runs once when the server process starts (Next.js calls `register`). The
 * work lives in its own file and is imported only on the Node.js runtime:
 * Next compiles this file for the Edge runtime as well, where the database and
 * mail libraries do not exist, and drops the branch there because it replaces
 * `process.env.NEXT_RUNTIME` by its literal value (the dotted form is the one it
 * recognises).
 */
export async function register(): Promise<void> {
  // eslint-disable-next-line no-restricted-syntax -- Next.js inlines exactly `process.env.NEXT_RUNTIME`; it is the framework's own variable, not application configuration
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { runStartupTasks } = await import('./instrumentation-node');
    await runStartupTasks();
  }
}

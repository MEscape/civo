import { execFile } from 'node:child_process';
import process from 'node:process';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath, URL } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CHECK_INTERVAL_MS = 300_000;
const shutdown = new globalThis.AbortController();
process.once('SIGINT', () => shutdown.abort());
process.once('SIGTERM', () => shutdown.abort());

/** Separate worker process: visitors never wait for remote source refreshes. */
while (!shutdown.signal.aborted) {
  try {
    const result = await execute(process.execPath, ['scripts/wuerzburg/refresh-sources.mjs'], {
      cwd: ROOT,
      // Let the current bounded refresh finish and release its lock before shutting down.
      maxBuffer: 1024 * 1024,
    });
    process.stdout.write(result.stdout);
  } catch {
    if (shutdown.signal.aborted) break;
    process.stderr.write(
      'City ingestion failed; previous data remains available. Inspect ingest-last-run.json.\n',
    );
  }
  try {
    await setTimeout(CHECK_INTERVAL_MS, undefined, { signal: shutdown.signal });
  } catch {
    break;
  }
}

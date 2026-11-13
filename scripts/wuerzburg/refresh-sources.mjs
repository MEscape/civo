import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, open, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { promisify } from 'node:util';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const execute = promisify(execFile);
const read = async (relative) => JSON.parse(await readFile(path.join(ROOT, relative), 'utf8'));
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--force')) throw new Error('Only --force is supported');
const policy = await read('data/sources/wuerzburg.ingest.json');
if (
  policy.schemaVersion !== 1 ||
  policy.websiteId !== '3b0f6f2e-8a51-4c9d-9e27-5d1a7c4b2f80' ||
  !Array.isArray(policy.sources) ||
  policy.sources.length > 20
)
  throw new Error('Unsupported ingestion policy');
const startedAt = new Date().toISOString();
const selected = [];
for (const source of policy.sources) {
  if (
    !/^[a-z0-9_-]{1,200}$/.test(source.id) ||
    !Number.isInteger(source.refreshSeconds) ||
    source.refreshSeconds < 300
  )
    throw new Error('Invalid source budget');
  let age = Number.NaN;
  try {
    age =
      Date.now() -
      Date.parse((await read(`data/fixtures/${source.id}/response.meta.json`)).fetchedAt);
  } catch {
    /* Missing evidence is due, never fresh. */
  }
  if (
    args.includes('--force') ||
    !Number.isFinite(age) ||
    age < 0 ||
    age >= source.refreshSeconds * 1000
  )
    selected.push(source.id);
}
if (!selected.length) {
  process.stdout.write('All city sources are within their refresh budgets.\n');
  process.exit(0);
}
const lockPath = path.join(ROOT, '.wuerzburg-ingest.lock');
const lock = await open(lockPath, 'wx');
await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt, websiteId: policy.websiteId }));
let backup;
const files = new Map();
const failures = [];
let applied = false;
async function node(argv) {
  const result = await execute(process.execPath, argv, {
    cwd: ROOT,
    maxBuffer: 1024 * 1024,
    timeout: 180000,
  });
  process.stdout.write(result.stdout);
}
async function restore(id) {
  const target = path.join(ROOT, 'data/fixtures', id);
  for (const file of files.get(id) ?? [])
    await copyFile(path.join(backup, id, file), path.join(target, file));
}
try {
  backup = await mkdtemp(path.join(tmpdir(), 'civo-wuerzburg-ingest-'));
  for (const id of selected) {
    const directory = path.join(ROOT, 'data/fixtures', id);
    const existing = (await readdir(directory)).filter((file) =>
      /^response\.(json|txt|meta\.json)$/.test(file),
    );
    files.set(id, existing);
    await mkdir(path.join(backup, id));
    for (const file of existing)
      await copyFile(path.join(directory, file), path.join(backup, id, file));
  }
  await node([
    'scripts/wuerzburg/capture-public.mjs',
    '--city-records',
    '--windows',
    '--complete',
    '--ignore-robots',
    `--ids=${selected.join(',')}`,
  ]);
  for (const id of selected) {
    const attempt = await read(`data/fixtures/${id}/attempt.meta.json`);
    if (attempt.httpStatus !== 200 || !attempt.sample?.endsWith('/response.json')) {
      failures.push({
        id,
        httpStatus: attempt.httpStatus,
        reason: 'Upstream failed or returned an unexpected format; previous capture retained',
      });
      await restore(id);
    }
  }
  await node(['scripts/wuerzburg/build-manifest.mjs']);
  await node(['node_modules/tsx/dist/cli.mjs', 'scripts/wuerzburg/validate.ts']);
  await node([
    'node_modules/tsx/dist/cli.mjs',
    '--import',
    './scripts/lib/server-runtime.ts',
    'scripts/wuerzburg/apply-ingest.ts',
  ]);
  applied = true;
  await node(['scripts/wuerzburg/register-sources.mjs']);
} catch (error) {
  if (!applied) {
    for (const id of selected) await restore(id);
    await node(['scripts/wuerzburg/build-manifest.mjs']);
  }
  failures.push({
    reason: applied
      ? 'Data applied; register generation failed and can be retried'
      : 'Validation or ingestion failed; previous source captures restored',
    error: error instanceof Error ? error.message.slice(0, 300) : 'Unknown failure',
  });
} finally {
  await writeFile(
    path.join(ROOT, 'docs/würzburg/verification/ingest-last-run.json'),
    JSON.stringify(
      { startedAt, finishedAt: new Date().toISOString(), selected, applied, failures },
      null,
      2,
    ) + '\n',
  );
  await lock.close();
  await rm(lockPath);
  // Only this invocation's own temporary directory may be removed recursively.
  const checked = backup === undefined ? null : path.resolve(backup);
  if (checked !== null) {
    if (
      path.dirname(checked) !== path.resolve(tmpdir()) ||
      !path.basename(checked).startsWith('civo-wuerzburg-ingest-')
    ) {
      process.stderr.write(
        'Temporary cleanup refused: path is outside the expected invocation directory.\n',
      );
      process.exitCode = 1;
    } else {
      await rm(checked, { recursive: true });
    }
  }
}
if (failures.length) process.exitCode = 1;

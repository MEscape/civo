#!/usr/bin/env tsx
import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { buildAiRules, currentAiRules, OUTPUT_FILE } from './lib/ai-rules';
import { CliError } from './lib/args';
import { REPO_ROOT } from './lib/fs';

const USAGE = `Consolidates docs/rules/*.md into ${OUTPUT_FILE}, for tools that read one file.

  npm run ai-rules            write ${OUTPUT_FILE}
  npm run ai-rules:check      fail when ${OUTPUT_FILE} is not what the rules produce (CI, npm run check)

The rule files and their order come from the index in docs/rules/README.md. A rule file the index
does not list, or an entry without a file, stops the run. A relative link that does not resolve is
reported; --check fails on it, because CLAUDE.md asks for every internal link to resolve.`;

async function main(argv: readonly string[]): Promise<number> {
  if (argv.includes('--help')) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  const { content, ruleFileCount, brokenLinks } = await buildAiRules(REPO_ROOT);
  if (brokenLinks.length > 0) {
    process.stderr.write(
      `Links that do not resolve from the repository root:\n  ${brokenLinks.join('\n  ')}\n`,
    );
  }

  if (argv.includes('--check')) {
    if (currentAiRules(REPO_ROOT) !== content) {
      process.stderr.write(`${OUTPUT_FILE} is out of date. Run: npm run ai-rules\n`);
      return 1;
    }
    process.stdout.write(`${OUTPUT_FILE} is up to date (${ruleFileCount} rule files).\n`);
    return brokenLinks.length === 0 ? 0 : 1;
  }

  writeFileSync(path.join(REPO_ROOT, OUTPUT_FILE), content);
  process.stdout.write(`Wrote ${OUTPUT_FILE} from ${ruleFileCount} rule files.\n`);
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`${error instanceof CliError ? error.message : String(error)}\n`);
    process.exitCode = 1;
  },
);

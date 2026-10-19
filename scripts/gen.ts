#!/usr/bin/env tsx
import { runComponent } from './commands/component';
import { runComponentLock } from './commands/component-lock';
import { runEnv } from './commands/env';
import { runModule } from './commands/module';
import { runTranslation } from './commands/translation';
import { runUseCase } from './commands/usecase';
import { CliError } from './lib/args';

interface Command {
  readonly summary: string;
  /** The convention document this command automates. */
  readonly convention: string;
  readonly run: (argv: string[]) => Promise<string>;
}

const COMMANDS: Record<string, Command> = {
  module: {
    summary:
      'Scaffold a business module (domain, application, infrastructure, presentation, tests)',
    convention: 'docs/conventions/adding-a-module.md',
    run: (argv) => runModule(argv),
  },
  usecase: {
    summary: 'Add one command or query to an existing module',
    convention: 'docs/conventions/adding-a-use-case.md',
    run: (argv) => runUseCase(argv),
  },
  component: {
    summary: 'Add a UI component (shared composite or module component) with a render test',
    convention: 'docs/conventions/adding-a-ui-component.md',
    run: (argv) => runComponent(argv),
  },
  'component-lock': {
    summary: 'Update component-versions.lock.json from the registered component definitions',
    convention: 'docs/conventions/adding-a-ui-component.md',
    run: (argv) => runComponentLock(argv),
  },
  env: {
    summary: 'Add an environment variable to .env.example and print its schema line',
    convention: 'docs/conventions/adding-an-environment-variable.md',
    run: (argv) => Promise.resolve(runEnv(argv)),
  },
  translation: {
    summary: 'Add one message to every locale at once',
    convention: 'docs/conventions/adding-a-translation.md',
    run: (argv) => Promise.resolve(runTranslation(argv)),
  },
};

function usage(): string {
  const width = Math.max(...Object.keys(COMMANDS).map((name) => name.length));
  return [
    'Usage: npm run gen -- <command> [args] [options]',
    '',
    'Commands:',
    ...Object.entries(COMMANDS).map(
      ([name, command]) => `  ${name.padEnd(width + 2)}${command.summary}`,
    ),
    '',
    'Every command supports --help and --dry-run.',
    'Generators never overwrite existing files: a conflict aborts before anything is written.',
  ].join('\n');
}

async function main(): Promise<void> {
  const [commandName, ...rest] = process.argv.slice(2);

  if (commandName === undefined || commandName === '--help' || commandName === '-h') {
    console.log(usage());
    return;
  }

  const command = Object.hasOwn(COMMANDS, commandName) ? COMMANDS[commandName] : undefined;
  if (command === undefined) {
    console.error(`Unknown command "${commandName}".\n\n${usage()}`);
    process.exitCode = 1;
    return;
  }

  try {
    console.log(await command.run(rest));
  } catch (error) {
    if (error instanceof CliError) {
      console.error(`Error: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

await main();

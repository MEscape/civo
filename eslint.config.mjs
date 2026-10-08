// @ts-check
/**
 * ESLint flat config: a thin composition of the modules in ./eslint.
 *
 *   base.mjs          ignores, ESLint recommended, typescript-eslint (type-aware)
 *   typescript.mjs    TypeScript rules
 *   imports.mjs       import order / duplicates / cycles / unused
 *   restrictions.mjs  package, global and syntax restrictions (locale wrappers, process.env, UI primitives)
 *   architecture.mjs  custom `architecture/*` rules (layers, modules, use cases, adapters, actions, DTOs, pages)
 *   react.mjs         React, Hooks, jsx-a11y (strict), Next.js core-web-vitals
 *   naming.mjs        kebab-case files and folders
 *   style.mjs         ESLint core correctness/style, comment hygiene, smell detection
 *   tokens.mjs        design-token conformance
 *   overrides.mjs     tests, framework files, config/tooling
 *
 * Order matters: later blocks win per rule key, Prettier is next to last
 * (it disables conflicting stylistic rules) and `curly` is re-enabled after it.
 * Layer/module rules are NOT listed per module: eslint/architecture-policy/policy.mjs is the one policy, read by
 * both the `architecture/*` rules and the architecture tests (docs/rules/boundaries.md describes it).
 */
import { defineConfig } from 'eslint/config';
import prettierConfig from 'eslint-config-prettier';

import { architectureRules } from './eslint/architecture.mjs';
import { base } from './eslint/base.mjs';
import { imports } from './eslint/imports.mjs';
import { naming } from './eslint/naming.mjs';
import { overrides } from './eslint/overrides.mjs';
import { react } from './eslint/react.mjs';
import { restrictions } from './eslint/restrictions.mjs';
import { afterPrettier, style } from './eslint/style.mjs';
import { tokens } from './eslint/tokens.mjs';
import { typescript } from './eslint/typescript.mjs';

export default defineConfig(
  ...base,
  ...imports,
  ...architectureRules,
  ...restrictions,
  ...typescript,
  ...naming,
  ...style,
  ...react,
  ...tokens,
  ...overrides,
  prettierConfig,
  ...afterPrettier,
);

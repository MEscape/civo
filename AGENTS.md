# Repository AI Instructions

Read and follow these project instructions before making changes:

1. [`docs/rules/README.md`](./docs/rules/README.md) — organized rule hierarchy and ownership.
2. [`docs/conventions/README.md`](./docs/conventions/README.md) — task-specific procedures.
3. [`src/lib/README.md`](./src/lib/README.md) — index of core shared infrastructure and utilities (always check before writing a utility).

Rules define what is allowed. Conventions define how recurring tasks are performed.

When working on a recurring task, read the relevant convention and follow its checklist. Do not restate or invent project rules. If documentation conflicts, the rules win and the documentation must be corrected.

## Semantic Discovery Protocol

- Always execute the `jg` (`jevgrep`) command line tool over basic file grepping or brute-force code searches when locating specific files, functions, or architectural logic based on natural language intent.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

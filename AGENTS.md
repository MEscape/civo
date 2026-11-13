# Repository Agent Instructions

## 1. Purpose

These instructions define how AI agents should understand, modify, test, and document this repository.

The goal is to make correct, maintainable, secure, and consistent changes while respecting the project's existing architecture and conventions.

## 2. Source of Truth

- `docs/rules/*.md` contains the canonical engineering rules.
- `docs/rules/README.md` is the index for finding applicable rules.
- `AI_RULES.md` is the consolidated engineering-rules document intended for AI tools that benefit from a single file.
- `docs/conventions/` contains task-specific procedures and conventions.
- `docs/architecture/` contains architectural explanations and subsystem documentation.

If instructions conflict, use this precedence:

1. Explicit requirements for the current task, provided they do not violate security or repository constraints.
2. Applicable canonical rules in `docs/rules/`.
3. Relevant conventions in `docs/conventions/`.
4. Relevant architectural documentation in `docs/architecture/`.
5. Existing implementation patterns, where consistent with the sources above.

`AI_RULES.md` must not silently override the canonical rule files.

## 3. Before Making Changes

1. Read this file.
2. Read `docs/rules/README.md`.
3. Identify the rules relevant to the requested change.
4. Read the applicable rule files before editing code.
5. Inspect the existing implementation and nearby tests.
6. Identify affected modules, dependencies, public interfaces, data flows, and failure paths.
7. Check for relevant conventions and architecture documentation.
8. Determine the smallest change that fully satisfies the requirement.

Do not assume that a familiar framework's default architecture is the architecture this repository uses.

## 4. Preserve Existing Architecture

- Follow established module boundaries and dependency direction.
- Keep business logic in the layer that owns the business concept.
- Prefer high cohesion and controlled coupling.
- Avoid circular dependencies.
- Avoid duplicating business rules across layers.
- Do not introduce additional layers, interfaces, abstractions, or dependencies without a concrete benefit.
- Do not replace an established project pattern with a different architecture merely because you prefer it.
- Keep changes proportional to the requirement.

## 5. Implementation Standards

- Follow the applicable rules for naming, TypeScript, code style, comments, modules, and shared code.
- Reuse established components, utilities, services, and patterns when appropriate.
- Avoid unnecessary duplication and speculative abstractions.
- Keep public interfaces narrow and intentional.
- Validate untrusted inputs at the appropriate boundary.
- Handle expected failures explicitly.
- Preserve existing behavior unless the task requires a change.
- Avoid unrelated refactoring.
- Do not add a dependency when the existing stack can solve the problem appropriately.
- Do not claim that functionality is implemented until the relevant code exists.

## 6. Security and Data Integrity

- Follow `docs/rules/security.md` and all applicable validation, persistence, API, and error-handling rules.
- Treat client input as untrusted.
- Enforce authorization at trusted server-side boundaries.
- Do not rely on frontend restrictions as security controls.
- Protect secrets, credentials, personal data, and sensitive operational information.
- Preserve data integrity and appropriate transaction boundaries.
- Consider failure, retry, concurrency, and partial-completion behavior where relevant.
- Never perform destructive operations outside the authorized scope of the task.

## 7. Testing and Verification

- Read and follow `docs/rules/testing.md`.
- Add or update tests for changed behavior where appropriate.
- Cover relevant success cases, validation failures, authorization failures, and edge cases.
- Run the most relevant available checks.
- Run broader checks when the change's scope or risk warrants them.
- Inspect the final diff for accidental changes, regressions, generated artifacts, and unrelated edits.

Report verification accurately:

- **Executed:** The command or test was actually run.
- **Passed:** The executed check completed successfully.
- **Failed:** The executed check reported a failure.
- **Not run:** The check was not executed.
- **Unverified:** The behavior or assumption has not been confirmed.

Never claim that tests, builds, type checks, or other commands passed if they were not actually executed.

## 8. Documentation

- Update the canonical rule or documentation file when the task changes a documented convention or requirement.
- Keep documentation consistent with the implementation.
- Update affected conventions and architecture documentation when necessary.
- Do not copy the same detailed rule into multiple authoritative locations without a clear reason.
- Regenerate `AI_RULES.md` whenever canonical engineering rules change.

## 9. Maintaining the Rule Files

Treat `docs/rules/*.md` as the canonical sources.

When changing a rule:

1. Edit the appropriate canonical rule file.
2. Update `docs/rules/README.md` if the rule index or file organization changes.
3. Update affected conventions or architecture documentation.
4. Regenerate `AI_RULES.md`.
5. Review the diff to verify that the consolidated document reflects the canonical sources.
6. Verify that internal Markdown links still resolve from the repository root.

Do not manually patch generated sections in `AI_RULES.md`. Fix the canonical source or the generation process instead.

If a canonical rule file is added, renamed, or removed, ensure the generation process reflects the change.

## 10. Completion Report

At the end of a coding task, summarize:

- What changed.
- Which important files or modules were affected.
- Which tests and checks were actually executed.
- Whether those checks passed or failed.
- Any known limitations, unresolved questions, or risks.

Keep the report concise and evidence-based.

Do not report unrelated improvements as completed work.

## 11. Final Principles

- Understand the repository before changing it.
- Read the rules relevant to the task.
- Prefer the simplest solution that safely satisfies the requirements.
- Preserve intentional architecture and established conventions.
- Make changes at clear ownership boundaries.
- Treat security, accessibility, validation, and data integrity as engineering requirements.
- Verify changes instead of relying on assumptions.
- Distinguish actual defects from personal preferences.
- Keep canonical documentation and generated documentation synchronized.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

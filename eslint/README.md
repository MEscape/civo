# ESLint setup

`eslint.config.mjs` only composes the blocks below, in order (later blocks win per rule key; Prettier comes next to last).

```text
eslint/
├── config/            flat-config blocks, one concern each
│   ├── globs.mjs        file groups (tests, config files, framework files, generated files)
│   ├── selectors.mjs    `no-restricted-syntax` selector fragments (process.env, raw HTML, clock, Intl…)
│   ├── base · typescript · imports · naming · style · react · tokens
│   ├── restrictions.mjs package, global and syntax restrictions per layer
│   ├── architecture.mjs turns the `architecture/*` rules on
│   └── overrides.mjs    tests, framework files, tooling (last, so it can relax)
├── policy/            the ONE architecture policy: layers, roles, allow-lists, module checks
│   └── policy.mjs       read by the plugin rules and by `__tests__/architecture`
├── plugins/
│   ├── architecture/    custom `architecture/*` rules
│   │   ├── util.mjs       rule helpers (`defineRule`, `report`, `classifyContext`)
│   │   └── rules/<group>/<rule>.mjs
│   └── civo-tokens.mjs  design-token conformance
└── shims.d.ts         lets the TypeScript tests import the untyped `.mjs`
```

Rule groups (`rules/`): `boundaries` (who may import or declare what), `structure` (module shape and public API), `use-cases` (commands, queries, authorization, rate limits), `adapters` (repositories, audit), `presentation` (actions, DTOs, forms, messages, routes), `pages` (metadata, headings). Tests mirror them in `__tests__/eslint/eslint-plugin-architecture/`.

## Adding a rule

1. Write `plugins/architecture/rules/<group>/<name>.mjs` with `defineRule`; derive scope from `classifyContext`, never name a module. Everything is syntactic (no type checker).
2. Register it in `plugins/architecture/index.mjs` and switch it on in `config/architecture.mjs`.
3. Put any list it needs (allowed names, patterns) in `policy/policy.mjs`.
4. Add a `RuleTester` case, valid and invalid, to the group's test file.
5. If it enforces a written rule, name the rule file in the message; if it adds a rule, update `docs/rules/` and `AI_RULES.md`.

A syntax-only ban (a global, a JSX attribute) is a selector in `config/selectors.mjs`. ESLint keeps only the last `no-restricted-syntax` value per file, so every block spreads `...EVERYWHERE` and then its own selectors. Never add a second block for an overlapping glob.

## Rules that ask for a stated reason, never for a workaround

A rule that cannot know intent accepts a one-line reason instead of blocking the feature:

| Rule                                 | What it asks                                                                                                                 | Opt out with                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `architecture/unsaved-work-guard`    | A `useForm` form in module components uses `useReportUnsavedChanges`, `useUnsavedNavigationGuard` or `useBeforeUnloadGuard`. | `// @unsaved-work none <reason>`                         |
| `architecture/authorization-flow`    | A use case authorizes, or is tagged public/system.                                                                           | `@authorization <category> <reason>`                     |
| `architecture/rate-limit-usage`      | A public use case spends a rate-limit budget from `application/rate-limits.ts`.                                              | `@rate-limit none <reason>`                              |
| raw HTML (`dangerouslySetInnerHTML`) | Content is rendered as text or components.                                                                                   | `// eslint-disable-next-line … -- <how it is sanitized>` |

Every `eslint-disable` needs a description (`eslint-comments/require-description`).

# Conventions

Step-by-step procedures for recurring tasks. Rules in [`rules/`](../rules/README.md) say what is allowed; conventions say how to do the task.

Conventions link to rules and never restate them. If a convention and a rule disagree, the rule wins and the convention must be fixed.

## Index

| Task                        | Convention                                                               |
| --------------------------- | ------------------------------------------------------------------------ |
| Add a business module       | [`adding-a-module.md`](adding-a-module.md)                               |
| Add a command or query      | [`adding-a-use-case.md`](adding-a-use-case.md)                           |
| Add a repository            | [`adding-a-repository.md`](adding-a-repository.md)                       |
| Add a Server Action         | [`adding-a-server-action.md`](adding-a-server-action.md)                 |
| Add a Route Handler         | [`adding-a-route-handler.md`](adding-a-route-handler.md)                 |
| Add a shared utility        | [`adding-a-shared-utility.md`](adding-a-shared-utility.md)               |
| Add a UI component          | [`adding-a-ui-component.md`](adding-a-ui-component.md)                   |
| Add an environment variable | [`adding-an-environment-variable.md`](adding-an-environment-variable.md) |
| Add a database migration    | [`adding-a-database-migration.md`](adding-a-database-migration.md)       |
| Add a translation           | [`adding-a-translation.md`](adding-a-translation.md)                     |
| Fix a bug                   | [`fixing-a-bug.md`](fixing-a-bug.md)                                     |

## Conventions for writing conventions

- One task per file, named `adding-...` or `fixing-...`.
- Start with the owning rules, then a numbered checklist, then a "Done when" list.
- Each step is one action; link the rule instead of restating it.
- Keep the checklist under twelve steps; split the task if it grows.
- A change to a rule that alters a procedure must update the affected convention in the same change.

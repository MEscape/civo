# Generators

Scaffolding for the repetitive, mechanical parts of adding code. The generators produce code that
follows the architecture policy; they do not replace the checklists in
[`docs/conventions`](../../../../Downloads/civo-generators-changes/docs/conventions), and they print every step that still needs a decision.

```bash
npm run gen                       # list the commands
npm run gen -- <command> --help   # usage, flags and examples of one command
```

Every command supports `--dry-run`, which validates everything and lists what would change
without writing. Errors exit with code 1.

## Commands

| Command                                    | What it does                                                                                                    | Convention doc                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `module <name> --fields "<fields>"`        | A complete business module: domain, application, infrastructure, presentation, a domain test, i18n registration | [`adding-a-module`](../docs/conventions/adding-a-module.md)                               |
| `usecase <name> -m <module> [--query]`     | One command or query in an existing module, registered in its `composition.ts`                                  | [`adding-a-use-case`](../docs/conventions/adding-a-use-case.md)                           |
| `usecase <name> -m <module> --action`      | Also the Server Action and input schema, for a command that takes `{ id }`                                      | [`adding-a-server-action`](../docs/conventions/adding-a-server-action.md)                 |
| `component <name> [-m <module>]`           | A shared composite (`src/components/shared`) or a module component, with a render test                          | [`adding-a-ui-component`](../docs/conventions/adding-a-ui-component.md)                   |
| `env <NAME> [--public]`                    | An entry in the right section of `.env.example`; prints the schema line                                         | [`adding-an-environment-variable`](../docs/conventions/adding-an-environment-variable.md) |
| `translation <key> "<text>" [-m <module>]` | One message in every locale at once                                                                             | [`adding-a-translation`](../docs/conventions/adding-a-translation.md)                     |

```bash
npm run gen -- module inventory --entity item \
  --fields "name:string,note:string?,quantity:number,status:enum(draft|sent|paid),dueAt:date?" \
  --unique name
npm run gen -- usecase archive-item -m inventory --action
npm run gen -- component item-summary -m inventory
npm run gen -- env STRIPE_SECRET_KEY --description "Stripe API secret"
npm run gen -- translation errors.locked "Item {name} is locked" --de "Element {name} ist gesperrt" -m inventory
```

### Field syntax (`module`)

`name:type`, `name:type?` for optional, `name:enum(a|b)`. Types: `string`, `number`,
`money` (non-negative integer minor units), `boolean` (never optional), `date`, `enum`.
`id`, `tenantId`, `createdAt` and `updatedAt` are always generated. `--unique a,b` makes required
fields unique **per tenant**.

Module names, stems and entities are kebab-case. `--stem` (default: the singular of the module
name) names module-level files and symbols; `--entity` (default: the stem) names entity-level ones.
Add `--client` for a browser-safe `client.ts`.

## What you still do by hand

`module` and `usecase` print these steps at the end of every run, because each one needs a
decision or a migration:

- the Prisma model (printed ready to paste) and its migration
  ([`adding-a-database-migration`](../docs/conventions/adding-a-database-migration.md)), then `npm run db:generate`
- the permissions and their grants per role in `src/modules/auth/domain/models/{permission,role}.ts`
- for a command: its audit event in the module's audit port and logger (the architecture policy
  fails until it exists, which is the point)
- pages, components and business rules beyond the field shape that is validated for you

## Safety

- **Nothing is overwritten.** If any target already exists, the whole run aborts and lists all
  conflicts; no file is written. There is no force mode.
- **All or nothing.** Every change is planned and validated first. If a write fails midway,
  everything already written is rolled back.
- **Edits to existing files are narrow and checked.** `module` registers the i18n namespace in
  `src/i18n/locales/*.ts`, `usecase` adds one import and one property to `composition.ts`, `env`
  and `translation` add one entry. If the file does not have the expected shape, the run aborts
  and prints the exact lines to add by hand (`usecase` also has `--no-wire`).
- **Names are validated, never rewritten.** `../x`, `a/b`, `Order` and reserved words are errors.
  Paths are checked against the repository root, including symlinks.
- Behaviour does not depend on the working directory.

## Limits

- `module` generates one kind of module: a tenant-owned entity with create, update, delete, get
  and list. Read-only or integration modules (`map`, `component-platform`) and the platform
  module (`auth`) are hand-built.
- `usecase` works on modules in the standard shape, i.e. every `gen module` output and `website`.
  It reads the module's own loader, permission and event names and refuses modules that deviate
  (for example `release`, `builder`), naming what is missing. Write those use cases by hand.
- Not generated, on purpose: repositories for additional entities, route handlers, shared
  utilities, migrations. Follow the checklists in `docs/conventions`.
- Enum fields become Prisma enums with explicit mapper tables. Soft delete is not supported
  (no module uses it).

## Maintaining the generators

[`CONVENTIONS.md`](CONVENTIONS.md) records which source of truth each template follows and the
decisions where the codebase is inconsistent. Change a template only together with that.

```bash
npm test                 # includes __tests__/scripts
npm run test:architecture
```

`__tests__/scripts` generates into temporary repositories seeded from the real one and checks
paths, imports, determinism, conflicts, rollback and path safety. Generated modules are also run
through `runAllChecks` and the architecture ESLint rules, and through the repository's
`import/order` configuration and its complexity and parameter limits.

The tests cannot compile generated code, because that needs your Prisma model and permissions.
After changing a template, verify it once against the real contract: generate a module, apply the
printed steps, run `npm run db:generate && npm run typecheck && npm run lint`, and remove the
module again.

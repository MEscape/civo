# Neon: production project and preview branching

Production data lives in one Neon project. Previews live in a second one, and each pull request gets a branch of it. Why two projects: the free compute allowance (100 CU-hours a month) and the API key are per project, so previews can neither suspend production nor reach its data. Official background: [Neon branching workflow primer](https://neon.com/docs/get-started/workflow-primer).

Both projects hold two databases: the application's (`neondb`) and the authentication tables (`civo_auth`). A Neon branch contains every database of its project, so one branch serves a whole preview.

## 1. Production project

1. Create a project, for example `civo-production`.
2. The default branch (`main`, or `production` if you rename it) is production. Nothing else is created in this project.
3. Create the second database: SQL Editor, `CREATE DATABASE civo_auth OWNER neondb_owner;`.
4. Roles: the migration role is the default owner (`neondb_owner`). Add a second role on the production branch (console: the branch, Roles) for the running application, with read and write on the tables but no right to alter them; grant it after the first migration with ordinary `GRANT` statements.
5. Connection strings (Connect, branch `main`):
   - direct (pooling off), owner role, for the **application database** and for **civo_auth**: GitHub secrets `PRODUCTION_DATABASE_URL`, `PRODUCTION_AUTH_DATABASE_URL`;
   - pooled, application role, both databases: `DATABASE_URL` and `AUTH_DATABASE_URL` in `/opt/civo/env/prod.env`.

## 2. Preview project

1. Create a second project, for example `civo-preview`. Note its **project ID** (Settings): GitHub variable `NEON_PROJECT_ID`.
2. Rename its default branch to `preview-base` (Branches, the branch's menu). It stays empty: no tables, no data. That is deliberate: every pull request builds its schema from the full migration history, so a preview exercises the migrations from zero and can never contain production data.
3. Create the authentication database on it: `CREATE DATABASE civo_auth OWNER neondb_owner;`. Leave `neondb` empty.
4. If you use other names, set the GitHub variables `NEON_PREVIEW_PARENT_BRANCH`, `NEON_DATABASE`, `NEON_AUTH_DATABASE`, `NEON_ROLE`. The defaults are `preview-base`, `neondb`, `civo_auth`, `neondb_owner`.

Do not point `NEON_PROJECT_ID` at the production project. The branch guard (below) would still refuse a branch that is not named `preview/pr-<n>`, but the separate project is the real protection.

## 3. API key

1. Neon console, Account settings, API keys, create a key for the **preview** project (use the narrowest scope your plan offers; a personal key reaches every project of the account, so prefer a key scoped to the preview project or its organization if you can).
2. GitHub, Settings, Environments, `preview`: secret `NEON_API_KEY`.

The key can delete branches of the preview project, which is why `neon-branches.sh` refuses to delete or deploy against anything that is not `preview/pr-<n>`, unprotected and not the default branch.

## 4. Try it by hand

Create a branch (console: Branches, New branch, name `preview/pr-0`, parent `preview-base`). Then:

1. Connection string: Connect, branch `preview/pr-0`, database `neondb`, role `neondb_owner`, pooling **off** for migrations (on for the running app). For the authentication database change the database name in the path to `civo_auth`.
2. Validate it: `psql "<direct url>" -c 'select current_database(), current_user'`.
3. Migrate it:

   ```sh
   DATABASE_URL='<direct app url>' AUTH_DATABASE_URL='<direct auth url>' npm run db:migrate
   ```

4. Delete it: `NEON_API_KEY=… NEON_PROJECT_ID=… bash .github/scripts/neon-branches.sh delete-preview 0`.

## 5. Test the automation

Open a pull request from a branch of this repository. Expect, in order: `Image` (slow the first time), `Preview` with the steps "Neon branch", "Check the branch and prepare connection strings", "Migrate the preview branch", "Deploy to the Oracle host", "Smoke test", and a comment with `https://pr-<n>.<domain>`. In the Neon console a branch `preview/pr-<n>` appears under `preview-base`. Push another commit: the same branch is reused (`created: false`) and the container is swapped. Close the PR: the comment changes to "Preview removed" and the branch disappears.

## What the workflow does with the branch

- The name is `preview/pr-<number>`, so reruns find the same branch (`create-branch-action` returns an existing branch instead of creating a second one). The action is pinned to commit `72ed4f69…` (v6.4.0).
- Before any statement runs, `neon-branches.sh assert-preview` fetches the branch list and fails unless the branch is named for this PR, is not the default or a protected branch, and is a child of `NEON_PREVIEW_PARENT_BRANCH`.
- Migrations run over the direct connection with the repository's own command (`npm run db:migrate`: Prisma for the application database, then the SQL files in `migrations/auth/` for the authentication database). If they fail, no container is started or updated.
- The container receives the **pooled** URLs, over stdin, never through arguments, artifacts or comments; the values are masked in logs.
- Cleanup: `preview-cleanup.yml` deletes `preview/pr-<n>` when the PR closes, and nightly for every closed PR. A missing branch is fine; the default and protected branches are never deleted.

## Limits to know (Free plan)

Ten branches per project (`preview-base` plus nine), enforced earlier by the host's `MAX_PREVIEWS` (4); 1 GB of storage across the project; 100 CU-hours a month shared by all preview branches (computes suspend after five minutes idle, so only active previews consume). When the compute allowance runs out the previews' databases are suspended until the next period. See the architecture page for sources.

## Rotating credentials

- **Neon API key**: create a new key, update `NEON_API_KEY` in the `preview` environment, then revoke the old one.
- **A connection string leaked**: reset the role's password in the console (Branches, the branch, Roles). A role lives on a branch, and a child branch inherits it when it is created, so reset it on the branch the string belongs to. Production: reset it on the production branch, then update `PRODUCTION_DATABASE_URL`, `PRODUCTION_AUTH_DATABASE_URL` and `/opt/civo/env/prod.env`, and redeploy. Preview: reset it on the `preview/pr-<n>` branch, or delete the branch (`neon-branches.sh delete-preview <n>`) and push a commit; a new branch inherits `preview-base`'s password, so reset that one too if it leaked.

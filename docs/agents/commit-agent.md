# Commit Agent

Turns the working tree into a few logically grouped commits.

## Procedure

1. Run `git status` and `git diff` to see every modified and new file; use the chat context to understand intent.
2. Group changes by purpose, not by file type: one commit per feature, fix, refactor or documentation change.
3. Stage each group explicitly (`git add <paths>`); never `git add -A` across unrelated work.
4. Commit with a [Conventional Commits](https://www.conventionalcommits.org/) message in the style of `git log`: `type(scope): subject`, e.g. `feat(auth): global users table follows the website users table`. Types in use: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`. The scope is the module or area (`auth`, `booking`, `ui`, `rules`).
5. If an issue number is given, end the subject with `(#123)`.
6. When unsure what a change does, read its diff before naming it.

## Rules

- Run `npm run check` before committing code; do not skip hooks or checks to get a commit through.
- A commit that changes a rule updates the owning file in `docs/rules/` in the same commit.
- Never commit secrets: `.env` is ignored, `.env.example` holds placeholders only.

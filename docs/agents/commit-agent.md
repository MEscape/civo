Use `git status` to identify all modified and new files. Based on that and the chat context, create logically grouped commits (not just logging-related) using `git add` and `git commit` following Commitlint rules: [commitlint guidelines](https://github.com/opensource-nepal/commitlint?utm_source=chatgpt.com). Use PowerShell syntax and append `--no-verify` at the end of each commit command.

If an issue number is provided, always reference it at the end of the commit message in the format `(#...)`. If you are unsure about a change, inspect the file diffs to derive an appropriate commit message.

Follow all `py-pre-commit` and Commitlint conventions strictly. After completing all feature-related commits, run `py-pre commit`, then create one final commit containing only pre-commit cleanup changes.

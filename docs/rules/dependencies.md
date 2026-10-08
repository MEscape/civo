# Dependency Rules

- Use the project's existing package manager exclusively and commit its lockfile.
- Prefer existing dependencies over introducing new ones.
- Every new dependency must have a concrete project requirement.
- Do not introduce a library for functionality already provided by the platform.
- Avoid duplicate libraries solving the same problem.
- Check maintenance status before adding a dependency.
- Development-only packages belong in `devDependencies`.
- Pin or constrain versions according to the lockfile; upgrade deliberately through reviewed changes.
- Remove unused dependencies.
- Run dependency vulnerability audits in CI and act on high-severity findings.
- Dependency additions must not violate architectural boundaries. See [`boundaries.md`](boundaries.md).

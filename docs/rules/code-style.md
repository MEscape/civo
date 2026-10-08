# Code Style Rules

- Formatting is owned by the formatter; do not hand-format or debate style in review.
- Prefer small, single-purpose functions.
- Prefer early returns over deep nesting.
- Prefer `const`; never use `var`.
- Prefer immutable data and non-mutating operations.
- Do not use magic numbers or strings; extract named constants. See [`naming.md`](naming.md).
- Prefer named exports; use default exports only where the framework requires them.
- Do not use barrel files except for a module's public API. See [`modules.md`](modules.md).
- Prefer `async`/`await` over promise chains.
- Do not leave dead code, unused exports, or unused parameters.
- Replace boolean parameters that change behavior with separate functions or an options object.
- Functions with more than three parameters take an options object.
- Import order and unused imports are enforced by lint, not by convention.

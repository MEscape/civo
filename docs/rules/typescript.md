# TypeScript Rules

- Use strict TypeScript, including `noUncheckedIndexedAccess`.
- Do not use `any`; where genuinely unavoidable, justify it inline. See [`comments.md`](comments.md).
- Prefer `unknown` for untrusted values and narrow before use.
- Prefer discriminated unions for finite states and variant-specific data.
- Use exhaustive checks so adding a new variant produces compile-time errors where handling is required.
- Prefer `satisfies` for validating object shapes while preserving inference.
- Prefer mapped types and conditional types when they keep related types synchronized.
- Prefer branded types for important identifiers.
- Avoid type assertions when type narrowing is possible.
- Do not use non-null assertions to hide missing invariants.
- Use `import type` for type-only imports.
- Keep domain types independent of framework-generated types.
- Domain value objects are immutable and validate their invariants at construction.
- Prefer inferred types for local implementation details.
- Explicitly type public module APIs.
- Avoid duplicate representations of the same concept; derive types from a single source such as `z.infer`. See [`validation.md`](validation.md).
- Naming follows [`naming.md`](naming.md).

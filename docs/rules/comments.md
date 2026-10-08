# Comment Rules

- Comments explain why, not what; the code itself must say what it does.
- Do not leave a comment restating the line below it in prose.
- A non-obvious business rule or invariant must be commented at the point it is enforced.
- Reference the owning rule file in a comment when code exists specifically to satisfy an architectural constraint.
- Use JSDoc for exported functions, types, and public module APIs.
- JSDoc on a public API must document behavior and constraints the signature cannot express, not restate parameter names.
- Do not comment out code; delete it and rely on version control.
- Remove or update a comment when the code it describes changes.
- `TODO` comments must name an owner or a tracked issue.
- Every lint/type-disable directive requires a one-line justification beside it.
- Do not add section-marker comments; split the file or extract a function instead. See [`code-style.md`](code-style.md).

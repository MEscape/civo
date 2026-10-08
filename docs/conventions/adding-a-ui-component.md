# Adding a UI Component

Owning rules: [`react.md`](../rules/react.md), [`styling.md`](../rules/styling.md), [`accessibility.md`](../rules/accessibility.md), [`i18n.md`](../rules/i18n.md), [`naming.md`](../rules/naming.md).

## Checklist

1. Decide where it lives: shared UI if it knows nothing about a module, otherwise `presentation/components` in the owning module. See [`modules.md`](../rules/modules.md).
2. Check for an existing primitive first and compose it instead of building a new one. See [`styling.md`](../rules/styling.md).
3. Default to a Server Component. Add `use client` only for state, effects, or browser APIs, and keep that boundary as small as possible. See [`react.md`](../rules/react.md).
4. Name the file in `kebab-case` and the component in `PascalCase`. See [`naming.md`](../rules/naming.md).
5. Style with design tokens. No inline styles for static values, no arbitrary values where a token exists.
6. Define variants explicitly and typed.
7. Take user-facing text from translations, never hard-coded strings. See [`i18n.md`](../rules/i18n.md).
8. Use semantic HTML, give interactive elements accessible names, and support keyboard use. See [`accessibility.md`](../rules/accessibility.md).
9. Handle loading, empty, and error states.
10. Test through user interaction, querying by role and accessible name.

## Done when

- [ ] No hard-coded user-facing string
- [ ] Works with keyboard only
- [ ] Uses tokens, not raw visual values
- [ ] The client boundary is as small as it can be

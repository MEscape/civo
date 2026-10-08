# Adding a Server Action

Owning rules: [`nextjs.md`](../rules/nextjs.md), [`validation.md`](../rules/validation.md), [`security.md`](../rules/security.md), [`errors.md`](../rules/errors.md), [`i18n.md`](../rules/i18n.md).

## Checklist

1. Confirm a use case already exists. The action is an adapter and contains no business logic. See [`adding-a-use-case.md`](adding-a-use-case.md).
2. Create the file in `presentation/actions/` with the `use server` directive.
3. Define the Zod input schema next to the action. Parse `FormData` here; never pass it further. See [`validation.md`](../rules/validation.md).
4. Resolve the authenticated identity from the server-side auth context. Never accept a user or tenant id from the client. See [`security.md`](../rules/security.md).
5. Call the use case with validated, typed input.
6. Map the `Result` to the action's return type: success data, or field-level errors plus an optional form-level error code. Return codes, not localized messages.
7. Revalidate or invalidate affected cache entries after a successful mutation. See [`caching.md`](../rules/caching.md).
8. On the client, show pending state, prevent double submission, and keep user input when validation fails.
9. Move focus to the first invalid field or an error summary after a failed submit. See [`accessibility.md`](../rules/accessibility.md).
10. Test the action through its observable behavior, including the unauthorized and invalid-input paths.

## Done when

- [ ] The action validates input before calling the use case
- [ ] The action derives identity server-side
- [ ] No localized message leaves the action
- [ ] Unauthorized and invalid-input paths are tested

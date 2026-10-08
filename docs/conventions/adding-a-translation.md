# Adding a Translation

Owning rules: [`i18n.md`](../rules/i18n.md), [`naming.md`](../rules/naming.md), [`errors.md`](../rules/errors.md), [`accessibility.md`](../rules/accessibility.md).

## Checklist

1. Add the key with a stable, semantic, dot-separated name in the owning namespace: the module's `presentation/i18n/<locale>.json`, or `src/i18n/messages/<locale>/app.json` for framework entry points. See [`naming.md`](../rules/naming.md).
2. Add it for every supported locale in the same change. A missing locale is a defect, not a follow-up.
3. Use variables, not string concatenation. Give the translator the whole sentence and its placeholders.
4. Use the locale-aware API for dates, times, numbers, and currencies. Do not pre-format them into the string.
5. For a domain error, keep the stable error code in the domain and map it to a key in presentation. See [`errors.md`](../rules/errors.md).
6. Reference the key statically where possible; avoid building keys dynamically.
7. Pass only the needed messages to Client Components (`I18nProvider namespaces`).
8. Check that accessible names (labels, alt text, aria-label) are translated too. See [`accessibility.md`](../rules/accessibility.md).
9. Run `npm run i18n:check`.

## Done when

- [ ] Every locale has the key (`npm run i18n:check` passes)
- [ ] No concatenated sentence
- [ ] No hard-coded user-facing string remains
- [ ] Accessible names are translated

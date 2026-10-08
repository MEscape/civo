# Fixing a Bug

Owning rules: [`testing.md`](../rules/testing.md), [`errors.md`](../rules/errors.md), [`observability.md`](../rules/observability.md).

## Checklist

1. Reproduce it. Write a failing test at the lowest layer where the bug lives (domain, use case, adapter, or UI).
2. Find the layer that owns the fault. Fix it there, not in a layer above that hides it.
3. Do not patch over an architectural violation. If the cause is a boundary breach, fix the boundary. See [`boundaries.md`](../rules/boundaries.md).
4. Make the test pass with the smallest change that addresses the cause.
5. Check whether the failure was silent. If so, add a typed error or a structured log at the boundary. See [`observability.md`](../rules/observability.md).
6. Search for the same pattern elsewhere and fix or list it.
7. If the bug exposed a missing or unclear rule, update the owning rule file in the same change.

## Done when

- [ ] A test fails without the fix and passes with it
- [ ] The fix sits in the layer that owns the fault
- [ ] No new boundary violation was introduced

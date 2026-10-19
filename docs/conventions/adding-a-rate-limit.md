# Adding a Rate Limit

Owning rules: [`security.md`](../rules/security.md), [`errors.md`](../rules/errors.md), [`architecture.md`](../rules/architecture.md), [`testing.md`](../rules/testing.md). How the pieces fit: [`rate-limiting.md`](../architecture/rate-limiting.md).

## Checklist

1. Decide whether the operation needs a budget: anyone can repeat it (public), or each run costs something (a mail, an external call, a write of a whole page, work that scales with the data). A public use case that needs none says why: `@rate-limit none <reason>` in its class comment.
2. Choose who is counted: the signed-in actor (`{ kind: 'actor', tenantId, actorId }` from the actor the use case authorized), the caller's address (`ClientAddressProvider`), an account identifier such as an email (normalised and hashed by the limiter), or a deliberate `global` cap. Never a raw request value.
3. Declare the policy in the module's `application/rate-limits.ts`: `id` (`<module>.<operation>`, kebab-case; add `-client` when it counts an address), `limit`, `windowSeconds` (from `SECONDS_PER_MINUTE` / `SECONDS_PER_HOUR`), `onBackendFailure`, and for a client policy `onUnresolvedClient`. Put the reason for the numbers in a comment above the policy.
4. Choose how it fails. Anything that sends a mail, calls an external system, changes what is live or signs people in uses `'deny'`. `'allow'` needs a reason a short gap in protection costs less than refusing the people it serves, and the id added to `RATE_LIMIT_POLICIES.failOpen` in `eslint/policy/policy.mjs`.
5. Give the use case its dependencies: `rateLimiter: RateLimiter` (and `clientAddress: ClientAddressProvider` for client policies), imported with `import type` from `@lib/rate-limit`. Wire them in `composition.ts`: `getRateLimiter()` and `getClientAddressProvider(() => headers())`.
6. Spend the budget in the use case: after authorization for a signed-in operation, before anything else for a public one. Several budgets go through one `enforceAll`, address first. Map a refusal to the module's own error with `fromRateLimitFailure`.
7. If the module has no rate-limit error yet, add `rateLimited` and `rateLimiterFailed` codes to its `domain/errors/<module>-errors.ts`, map them in `presentation/messages/message-keys.ts` and add the `errors.rateLimited` text in every locale.
8. Test with the real limiter on memory (`createTestRateLimiter` in `__tests__/src/support/rate-limiting.ts`): the use case refuses after `limit` attempts, counts callers apart, and behaves as the policy says when the store is down (`createBrokenRateLimiter`).
9. Run `npm run check`. The `rate-limit-usage` lint rule and the policy checks tell what is missing.

## Done when

- [ ] The policy is in `application/rate-limits.ts` and spent by a use case, not by an action or an adapter
- [ ] The failure mode is stated, and reviewed if it fails open
- [ ] A refusal reaches the user as the module's own translated text
- [ ] A test shows the refusal and the failure mode

# Tests

`src/` mirrors the production `src/` hierarchy. Module tests follow the same `domain`, `application`, `infrastructure`, and `presentation` directories as their source. Shared components follow their owning group, such as `components/shared`, `components/providers`, or `components/skeletons`. Route tests preserve `[locale]`, route groups, and dynamic segments.

Name focused suites after their source file. Cross-use-case scenarios may share one suite within the responsible layer, as auth's command scenarios do. Reusable port fakes and fixtures belong in a nearby `support/` directory; fixtures never become production APIs.

- `npm test` runs source unit and component tests.
- `npm run test:coverage` measures all source files, including files without tests. Keep the declared coverage thresholds and exclusions intact.
- `npm run test:architecture` checks boundaries, dependency direction, and other repository conventions. `architecture/module-dependencies.test.ts` also pins the runtime direction between website, auth, and audit.
- `npm run test:integration` runs `*.integration.test.ts` against explicitly configured external services and databases.

Application tests exercise authorization and failures through port fakes. Action and route tests substitute dependencies at composition or framework boundaries while executing the real adapter. The server-component helper resolves async components before React renders their client children; it does not simulate Next.js routing or caching.

Database-backed suites remain the evidence for actual SQL, locking, retries, and persistence constraints. Unit coverage does not establish those guarantees.

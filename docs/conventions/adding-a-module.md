# Adding a Module

Owning rules: [`architecture.md`](../rules/architecture.md), [`modules.md`](../rules/modules.md), [`boundaries.md`](../rules/boundaries.md), [`naming.md`](../rules/naming.md).

## Checklist

1. Confirm the capability is a distinct business concept, not a technical concern. If it is technical, it belongs in shared code. See [`shared.md`](../rules/shared.md).
2. Create `modules/<kebab-case-name>/` with only the layers you need now.
3. Start with `domain/`: models, typed errors, and ports. See [`modules.md`](../rules/modules.md) and [`boundaries.md`](../rules/boundaries.md).
4. Add `application/` commands and queries against the ports. See [`adding-a-use-case.md`](adding-a-use-case.md).
5. Add `infrastructure/` implementations of the ports. Keep Prisma inside. See [`adding-a-repository.md`](adding-a-repository.md).
6. Add `presentation/` (actions, DTOs, components) last.
7. Create `composition.ts` (wires use cases, adapters and any other module), `index.ts` (server-side public API) and, if browser code of other modules needs it, `client.ts`. See [`boundaries.md`](../rules/boundaries.md).
8. Verify lint fails on a deliberate boundary violation (for example, import Prisma from `domain`).
9. Add tests at each layer. See [`testing.md`](../rules/testing.md).
10. Add or update translation keys, if any. See [`i18n.md`](../rules/i18n.md).

## Target layout

```text
modules/<module>/
├── domain/
├── application/
├── infrastructure/
├── presentation/
│   ├── actions/
│   ├── components/
│   ├── dto/
│   └── i18n/
├── composition.ts
├── client.ts
└── index.ts
```

## Done when

- [ ] Lint and type-check pass
- [ ] No cross-module imports bypass `index.ts` / `client.ts`, and runtime calls into another module exist only in `composition.ts` or an adapter
- [ ] The module's translations live in its own namespace and are listed in `src/i18n/locales/*.ts`
- [ ] No Prisma or Next.js import exists in `domain/` or `application/`

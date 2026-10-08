# Module Rules

- Each business capability lives under `modules/<module>`.
- A module may contain `domain`, `application`, `infrastructure`, and `presentation`.
- `domain` contains models, errors, and ports.
- `application` contains commands and queries.
- `infrastructure` contains implementations of ports and external integrations.
- `presentation` contains actions, DTOs, and module-specific components.
- Server Actions are framework adapters; they live in `presentation/actions` and only call application use cases. See [`nextjs.md`](nextjs.md).
- Module-specific components belong in `presentation/components`.
- Shared UI components belong outside modules.
- A module must not import another module's infrastructure or internal implementation details.
- Cross-module communication must use the other module's public API.
- `composition.ts` is the module's composition root: the only file that knows both use cases and adapters, and the only place another module is wired in.
- `index.ts` exposes the module's intentional server-side public API; `client.ts` exposes the browser-safe part (Server Actions, routes, DTO types, vocabulary). Nothing else in a module is a barrel file.
- Internal implementation details must not be exported from the module public API; re-export named members, never `export *`.
- A module that refers to another module's aggregate declares its own branded reference id under the same brand name (for example `WebsiteId`) instead of importing the owner's. Values cross without mapping, the modules share no types, and no cycle appears.
- Every use case is protected by default; a `public` or `system` use case carries an `@authorization <category> <reason>` tag, and the reviewed list lives in the architecture tests.
- File and directory naming follows [`naming.md`](naming.md).

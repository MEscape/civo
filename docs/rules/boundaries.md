# Dependency Boundary Rules

- Domain must not import Next.js, React, Prisma, infrastructure, or presentation.
- Application must not import React, Next.js, infrastructure implementations, or presentation.
- Application depends on domain ports, not infrastructure implementations.
- Infrastructure may depend on domain and application contracts.
- Presentation may depend on application contracts and presentation types.
- Presentation must not import infrastructure.
- Shared UI must not import business modules.
- Modules must not import another module's infrastructure.
- Framework entry points may depend on application and presentation APIs.
- Cross-module access must use the target module's public API (`index.ts`, or `client.ts` from browser code); deep imports are forbidden. See [`modules.md`](modules.md).
- Runtime calls into another module happen only in the module's `composition.ts` and in infrastructure adapters that implement the module's own domain ports.
- Domain and application may `import type` from another module's public API; at runtime they may call only the pure functions the architecture policy lists (`CROSS_MODULE_RUNTIME_ALLOW`).
- Presentation may import another module's browser-safe API (`client.ts`: routes, vocabulary, Server Actions) or its types. Another module's server-side parts (queries, Server Components) are handed in by `composition.ts`.
- Repositories and record mappers may import only trusted brand constructors (`to<Name>Id`) from another module.
- A port defined in shared code (`Clock`) may be imported as a type by every layer; its implementation is wired only by composition roots.
- Framework entry points (`src/app`) are the application's composition boundary and may import any module's public API.
- Dependency direction must be enforced by linting.

# Architecture Rules

- Organize business capabilities as modules. See [`modules.md`](modules.md).
- Dependencies point inward toward domain and application abstractions. See [`boundaries.md`](boundaries.md).
- Business logic never lives in framework entry points.
- Framework-specific code must remain at the outer boundary.
- Prefer dependency inversion over direct infrastructure dependencies.
- Domain and application code must not read the clock, randomness, or environment directly; inject them through ports.
- Shared code must be genuinely generic; do not extract module code prematurely. See [`shared.md`](shared.md).
- Modules are integrated in composition roots: a module's `composition.ts` is the only place that wires another module into it at runtime. See [`boundaries.md`](boundaries.md).
- The module dependency graph is acyclic.
- Architectural dependency violations must fail lint/build checks.
- A deviation from these rules must be recorded as a short decision note and the owning rule updated.

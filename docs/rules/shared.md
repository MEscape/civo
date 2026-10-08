# Shared Code Rules

- Shared code lives outside modules: `src/lib` (infrastructure and utilities), `src/components` (UI), `src/hooks` (client hooks), `src/i18n` (locale plumbing).
- Shared code must be genuinely generic: it has no business owner and names no domain concept. See [`architecture.md`](architecture.md).
- Shared code never imports a business module. See [`boundaries.md`](boundaries.md).
- Extract to shared code only when a second module needs the same concept, not because two pieces look alike.
- `src/components/ui` holds design-system primitives; `src/components/layout` holds layout primitives; `src/components/shared` holds composites built from them (form fields, route error and not-found panels).
- A module composes shared primitives and does not restyle or re-implement them. See [`styling.md`](styling.md).
- A shared mechanism that every module needs (an audit log, persistence failure mapping, an action input parser) is written once in `src/lib`; each module keeps only its own vocabulary (event types, levels, error codes).
- A port shared by every module (`Clock`) is defined in `src/lib` and imported as a type; its implementation is wired only by composition roots.
- Remove a shared piece when its last consumer goes; do not keep unused primitives "for later".
- Check [`src/lib/README.md`](../../src/lib/README.md) and [`src/components/README.md`](../../src/components/README.md) before adding shared code, and update them in the same change.

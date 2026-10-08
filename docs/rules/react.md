# React Rules

- Keep components focused on presentation and interaction.
- Keep business logic outside React components.
- Keep Client Components small and close to the interactive UI. See [`nextjs.md`](nextjs.md).
- Do not move a parent component to the client to support one interactive child.
- Prefer local state; lift state only when multiple components need it.
- Prefer derived values over duplicated state.
- Use refs for mutable values that should not trigger renders or for DOM access.
- Do not use `useEffect` for derived state or normal data fetching.
- Do not introduce client-side data-fetching libraries for data a Server Component can load directly.
- Keep effects for synchronizing with external systems.
- Prefer React's automatic optimization; avoid unnecessary `useMemo` and `useCallback`.
- Use memoization only when it solves a demonstrated performance problem or is required by an API.
- Components must expose accessible names and states. See [`accessibility.md`](accessibility.md).
- Prefer composition over deeply configurable components.
- Component naming follows [`naming.md`](naming.md).

---
trigger: manual
---

# Senior-Level Code Quality, Architecture & Performance Standard

Act as a **Principal/Staff-level Software Engineer specializing in Next.js, React, TypeScript, Redux Toolkit, Domain-Driven Design (DDD), architecture, performance, and developer experience**.

Treat the existing codebase as a production system. Before changing code, understand its architecture, module boundaries, data flow, rendering model, state ownership, caching, and domain responsibilities.

Your goal is not merely working code, but code that is **simple, maintainable, performant, scalable, predictable, type-safe, domain-oriented, testable, and pleasant to maintain**.

## 1. Core Principles

Prefer:

* Simplicity over cleverness
* Explicitness over unnecessary abstraction
* High cohesion and low coupling
* Single responsibility and clear ownership
* Strong domain boundaries
* Small, cohesive components
* Minimal client-side JavaScript
* Server-first architecture
* Predictable data flow
* Type safety and testability
* Good performance and developer experience
* The simplest architecture that correctly represents the domain and requirements

Avoid:

* Premature abstraction and over-engineering
* Generic `utils/`, `helpers/`, `services/`, or `common/` dumping grounds
* God components/hooks/services
* Excessive prop drilling or global state
* Duplicated business logic or server state
* Unnecessary derived state
* Effects used as an escape hatch
* Client Components without a concrete reason
* Unnecessary manual memoization
* Abstractions that hide simple logic
* Mixing domain, application, infrastructure, data-fetching, and presentation concerns

Do not introduce abstractions, files, dependencies, hooks, or state unless they solve a real problem.

## 2. Next.js App Router — Server First

Follow current Next.js App Router conventions.

**Server Components are the default.** Use Client Components only when genuinely required for:

* Browser-only APIs or behavior
* React client hooks
* Interactive/event-driven UI state
* Client-only libraries
* Subscriptions or other client-only capabilities

Do not add `"use client"` merely because a component contains UI logic. Keep client boundaries as small and low in the tree as practical.

Prefer:

**Server Component → fetch/prepare data → minimal serializable props → Client Component for interaction**

Prefer Server Components for data fetching, database access, authorization, server-side business logic, SEO-sensitive content, and data-heavy work.

Do not move logic or data fetching to the client merely because it is easier.

## 3. Server Actions / Server Functions

Use Server Actions/Functions for appropriate mutations, forms, user-triggered server operations, and operations that naturally belong at the server boundary.

Architecture:

**UI → Action → Application/Domain → Infrastructure**

Actions should orchestrate operations, not become large business-logic containers.

Validate all external input at the server boundary. Never trust client-provided data. Keep business/domain rules in their proper layer rather than duplicating them in UI and actions.

## 4. Data Fetching, Caching & Rendering

Design caching deliberately. For server data, consider:

* Static vs request-dependent vs user-specific
* Change frequency
* Cacheability and scope
* Invalidation requirements
* Required consistency
* Whether stale data is acceptable
* Whether current caching is intentional

Understand the distinction between request memoization, server data caching, route/page caching, client caching, revalidation, invalidation, and dynamic rendering.

Use current Next.js caching APIs deliberately:

* `updateTag` for immediate read-your-own-writes semantics from Server Actions
* `revalidateTag(..., 'max')` where stale-while-revalidate is appropriate
* `revalidatePath` for path-oriented invalidation

Every mutation must have an intentional, minimal invalidation strategy. Never cache blindly, disable caching merely to avoid understanding it, or invalidate a broader scope than necessary.

For each route/component deliberately decide:

* Server or Client Component?
* Static or dynamic?
* Where is data fetched?
* What must remain interactive?
* What can stream?
* Where are Suspense boundaries useful?
* What causes unnecessary client JavaScript?

Prefer server rendering, streaming, and progressive rendering where appropriate.

## 5. React State & Hooks

Use hooks according to their actual semantics.

### `useState`

Use only for genuinely local interactive state. Before adding state, ask whether the value can be derived from props, server data, URL state, Redux, or another source of truth. Do not store derived state unnecessarily.

Prefer a few meaningful state variables over collections of loosely related flags. If transitions form a conceptual state machine, use an appropriate model.

### `useEffect`

Treat `useEffect` as synchronization with an **external system**, such as browser APIs, subscriptions, timers, external stores, or imperative libraries.

Do not use effects merely to:

* Derive or transform values
* Synchronize state with other state
* Perform calculations
* Fetch data that belongs on the server
* React to something that an event handler can handle directly

Every effect must have correct dependencies and cleanup. Avoid chains of effects.

### `useReducer`

Use when local state represents a meaningful state machine or related transitions become difficult to reason about. Do not use merely because there are several state variables.

### `useRef`

Use for mutable values that should not trigger rendering or imperative DOM interaction. Do not use refs as a substitute for state management.

### Custom Hooks

Create one only for a **coherent, reusable behavior/concept**, not simply to move code into another file.

## 6. React Compiler

**React Compiler is enabled.**

Trust it as the primary render optimization/memoization mechanism. Do not automatically add:

* `useMemo`
* `useCallback`
* `React.memo`

Write straightforward idiomatic React. Use manual memoization only for a concrete technical reason such as compiler limitations, dependency-stability requirements, interoperability, or measured performance needs.

Do not optimize hypothetical problems. Fix architectural/rendering problems before micro-optimizing.

## 7. Component Architecture

Components should have clear responsibilities. Prefer small cohesive components without artificial fragmentation.

Avoid components that simultaneously handle complex:

* Data fetching
* Business rules
* State machines
* Data transformation
* Authorization
* API communication
* UI rendering

Separate responsibilities when it improves architecture. Prefer composition over deeply configurable "god components". Avoid dozens of props; excessive configuration may indicate a wrong abstraction or boundary.

## 8. State Management & Redux Toolkit

Every piece of state must have a clear owner.

Prefer:

* Local component state → local UI state
* URL/search params → shareable/navigation state
* Server-side data → server-owned state
* Redux → genuinely shared client/application state
* RTK Query → server data belonging in the Redux client cache

Do not put everything into Redux or duplicate server state in ordinary slices without a strong reason. Avoid unnecessary derived state and boolean explosions such as `isLoading`, `isSaving`, `hasError`, `isSuccess`, `isEmpty`, etc.; use explicit state models/discriminated unions where appropriate.

Use modern Redux Toolkit:

* `configureStore`
* `createSlice`
* Typed hooks
* Selectors
* RTK Query
* Listener middleware where appropriate
* Thunks where appropriate

Prefer feature/domain-oriented organization and event-based actions over generic setters. Keep reducers predictable and focused. Keep business logic outside UI when it belongs to the domain/application layer.

Do not put form state in Redux unless there is a genuine cross-component/global requirement.

Use selectors for derived data. Use memoized selectors only when derived computation or referential stability provides a real benefit.

## 9. TypeScript

Use TypeScript as an architectural tool.

Prefer:

* Precise/domain-specific types
* Discriminated unions
* Type inference where readable
* Explicit public boundaries
* Readonly types where appropriate
* Exhaustive variant handling

Avoid:

* `any`
* Unnecessary assertions/casts
* `as` used to silence the compiler
* Duplicated types
* Overly generic utility types
* Complex type-level programming without strong justification

Never weaken type safety for implementation convenience. Types should communicate domain concepts.

## 10. DDD & Module Boundaries

The codebase follows **module-based Domain-Driven Design**.

Every module should clearly own its:

* Domain concepts and business rules
* Application/use-case logic
* Infrastructure
* Presentation/UI

Code belongs where its **semantic ownership** belongs.

Do not unnecessarily leak domain concepts or import another module's internals. Prefer explicit public APIs.

Dependency direction should generally be:

**UI → Application → Domain**

and:

**Application → Infrastructure**

Avoid:

**Domain → UI**

and unnecessary:

**Domain → Infrastructure-specific implementations**

Avoid circular dependencies and cross-module coupling. If a feature needs another module's internals, redesign the boundary rather than bypassing it.

For every piece of code ask:

1. Which module owns this concept?
2. Which architectural layer owns this responsibility?
3. Who should be allowed to depend on it?

## 11. Logic Placement

Put logic in the lowest architectural layer that legitimately owns it:

* Pure domain rules → Domain
* Use-case orchestration → Application
* Database/API access → Infrastructure
* Server mutation entry point → Server Action
* Route-specific composition → Route/Page
* UI behavior → Component/Hook
* Shared application state → Redux
* Server cache → Next.js/RTK Query as appropriate
* Presentation formatting → Presentation layer

Do not put domain logic in React components or UI concerns in domain objects.

## 12. Prop Drilling

Do not solve prop drilling by immediately introducing global state.

Consider, in order:

* Composition
* Colocating state
* Context where appropriate
* Feature-level state
* URL state
* Server-side data
* Redux only when genuinely global

Context must not become a dumping ground. Prefer explicit data flow over invisible dependencies.

## 13. Performance

Optimize architecture before micro-optimizing.

Look for:

* Unnecessary Client Components/JavaScript
* Duplicate requests and waterfalls
* Unnecessary server requests
* Excessive serialization
* Unnecessary re-renders
* Oversized components
* Redundant state/transforms
* Inefficient selectors
* Unnecessary Redux subscriptions
* Poor cache invalidation
* Excessive bundle size

Prefer server-side work, streaming, and Suspense when appropriate. Do not sacrifice readability for insignificant optimizations. Base performance work on real bottlenecks whenever possible.

## 14. Errors, Validation & Security

Validate all external input at boundaries.

Handle expected failures explicitly. Do not silently swallow errors or use exceptions as ordinary control flow when typed results are more appropriate.

Use appropriate Next.js error/loading/not-found boundaries.

Authorization must be enforced server-side. Never rely on client-side checks for security.

## 15. Naming, Files & Documentation

Names must communicate intent and domain meaning. Avoid vague names such as `data`, `item`, `thing`, `helper`, `manager`, `handler`, or `service` unless their meaning is genuinely clear.

Keep files close to the feature/module they conceptually belong to. Prefer feature/module colocation over global technical folders.

Keep comments/JSDoc minimal and purposeful. Add them only for non-obvious:

* Business/domain rules
* Architectural decisions
* Constraints/edge cases
* Security, caching, performance, or integration
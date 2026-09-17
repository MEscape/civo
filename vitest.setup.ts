import "@testing-library/jest-dom/vitest";

// Registers every feature module's component definitions into the
// component-platform domain registry (component-platform/domain/registry.ts)
// before any test runs. Needed because domain/** test files (e.g.
// builder/domain/drop-placement.test.ts, website/domain/templates/
// templates.test.ts) exercise domain code that queries the registry
// (canInsertChild, getComponentDefinition, …), but domain/** itself must
// stay framework-free and can never import this registration step — see
// component-platform/infrastructure/definitions.ts's own comment. In the
// real app, registration is guaranteed by each route's own imports
// (render-nodes.tsx, website-service.ts, component-palette.tsx); this is
// the equivalent guarantee for the test run as a whole.
import "@/modules/component-platform/infrastructure/definitions";

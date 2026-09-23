/**
 * Public API for the component-platform domain (review §H).
 *
 * This is the ONLY import point other layers should use. It exports a
 * deliberately curated set — not `export *` — so every export is
 * traceable to exactly one source file, unlike the old
 * components/website/_registry barrel, whose blanket `export *` across
 * two independent registries was what made the dual-registry problem
 * (§E1) invisible to consumers in the first place.
 *
 * Note: `componentDefinitions` (the fully-assembled array of every
 * feature module's definitions) is NOT re-exported here. Assembling it
 * requires importing from `module-components` folders (builder's and
 * each integration's own component directories), which this domain
 * layer must never depend on — see
 * `component-platform/infrastructure/definitions.ts`, which owns that
 * aggregation and calls `registerComponentDefinitions` below to populate
 * this module's registry. Callers that need the raw array (the
 * component palette, drop-handling) import it from there directly;
 * callers that only need to query the registry (which is the common
 * case, and is what keeps other modules' domain layers framework-free)
 * use the functions this file exports.
 */
export type {
    ComponentDefinition,
    ComponentDataBinding,
    ComponentCategory,
    PropField,
    PropFieldControl,
    PropFieldGroup,
    PageComponentProps,
} from "./types";

export {
    componentDefinitionRegistry,

    registerComponentDefinitions,
    isRegisteredComponentType,
    getComponentDefinition,
    tryGetComponentDefinition,
    canInsertChild,
} from "./registry";

/**
 * Public API for the component-platform domain (review §H).
 *
 * This is the ONLY import point other layers should use. It exports a
 * deliberately curated set — not `export *` — so every export is
 * traceable to exactly one source file, unlike the old
 * components/website/_registry barrel, whose blanket `export *` across
 * two independent registries was what made the dual-registry problem
 * (§E1) invisible to consumers in the first place.
 */
export type {
    ComponentDefinition,
    ComponentCategory,
    PropField,
    PropFieldControl,
    PageComponentProps,
} from "./types";

export {
    componentDefinitionRegistry,

    isRegisteredComponentType,
    getComponentDefinition,
    tryGetComponentDefinition,
    canInsertChild,
} from "./registry";

export { componentDefinitions } from "./definitions";

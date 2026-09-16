import type { ComponentDefinition } from "./types";

/* eslint-disable boundaries/dependencies */
import { layoutComponents } from "@/modules/builder/components/layout/components";
import { contentComponents } from "@/modules/builder/components/standard/components";
import { civicComponents } from "@/modules/integrations/civic/components/components";
import { smartcityComponents } from "@/modules/integrations/smartcity/components/components";
/* eslint-enable boundaries/dependencies */

/**
 * The unified list of all available components.
 * This is aggregated from feature-level definition bundles, avoiding a massive
 * import list in one file and setting the foundation for dynamic loading / code-splitting.
 */
export const componentDefinitions: ComponentDefinition[] = [
    ...layoutComponents,
    ...contentComponents,
    ...civicComponents,
    ...smartcityComponents,
];

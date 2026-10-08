- look all components and look if improvement of ui and usage of layout primitives etc

- problem between global error and module specific errors i18n

- restructure in release folder -> models ? into multiple folders

- adjustment in proxy? like let everything go through /s ?

- do not use plain formatters only via my i18n

- use attribute format, should we also have sth like this in component platform we need a lot of formatting especially in smartcity components

- website module and builder has create website ?!

- do we need in platform-component for fields like itemKeys or sth like this for more controll or not? its for accordion for example

- updated website template smartcity with map and civic with appointment booking.

- do we show for components in component-platform both data-sources and application specific errors, yes right?

- why is /support/dataset-limits only used in specific smartcity components and not all?

- is this cross module map call okey or arch violation

- finegrain app layer -> seo and consistency!

- idk how to handle error and not found buttons for redirect because how to determine which public site?!

- in public is outdated root page

- update lib readme because of seo and clock update/adding

- restructure in component-platform domain/content like domain/component and update imports. besides that think more deeply about smart-city-fields and its relation to data-sources feature. is it really static or is it dynamicly generated based on data-source output?

- no global i18n provider but one for each module? I18nProvider but what to do then with metadata translation and loading, error and not-found page if not we need to remove i18n provider in map module

- i18n translations work bout not for our external data might also need translation but because its dynamic we need like google translator or sth like this

- quick link,location skeleton?

- updated package.json home and here so merge it

- Client.ts missing and you see in Website we can Change theme and changing Colors might set the Background based on Saturation contrasts dynamic from White to black and backwards yk shouldnt map style light / dark also adjust? or is it already doing this?
  export const MAX_CONTENT_LIST_LIMIT = 1_000; shouldnt we introduce a sparate for map? ist an exception every other list not soo much!!!
  is the map also usable for example to Show Location of the "Gemeinde" or is map so specific to smartcity and we Need extra in Civic namespace?

from "migration" migration:
import type { ComponentDefinition } from "./types";

export function getAllComponentDefinitions(): ComponentDefinition[] {
return [];
}

export function getComponentDefinition(\_type: string): ComponentDefinition {
throw new Error("Not implemented");
}

export function tryGetComponentDefinition(\_type: string): ComponentDefinition | undefined {
return undefined;
}

export function canInsertChild(\_parentType: string | null, \_childType: string): boolean {
return true;
}

export type ComponentCategory = "layout" | "content" | "civic" | "smartcity";

export interface PropField {
key: string;
label: string;
control: "text" | "textarea" | "number" | "select" | "columns" | "switch" | "dataset";
group?: "data" | "content" | "appearance";
placeholder?: string;
options?: Array<{ label: string; value: string | number }>;
canonicalKind?: string;
}

/\*\*

- The minimal node shape that `createDefaultNode` must return. Defined here
- so that component-platform does not import from the builder module
- (architecture.md: dependency direction — avoid circular module dependencies).
-
- Builder's `PageNode` is structurally assignable to this type, so no
- explicit mapping is needed at call sites.
  \*/
  export interface CreatedNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: CreatedNode[] | undefined;
  }

export interface ComponentDefinition {
type: string;
label: string;
description?: string;
category: ComponentCategory;
fields: readonly PropField[];
municipalFields?: readonly string[];
municipallyEditable?: boolean;
dataBinding?: { canonicalKind: string };
canHaveChildren?: boolean;
/\*_ Content contracts this component needs, with the minimum version it works with. _/
dependsOnContracts?: ReadonlyArray<{ contract: string; minVersion: number }>;
createDefaultNode: () => CreatedNode;
}

/\*\*

- Public API for the component-platform module.
- All cross-module access must import from here.
  \*/
  import "./infrastructure/definitions";

import { tryGetComponentDefinition } from "./domain/registry";

export type {
ComponentCategory,
ComponentDefinition,
PropField,
} from "./domain/types";

export {
getAllComponentDefinitions,
getComponentDefinition,
tryGetComponentDefinition,
canInsertChild,
} from "./domain/registry";

export { renderPageNodes } from "./infrastructure/render-nodes";

// TODO: Implement properly
export const getCurrentComponentVersion = (\_type: string) => 1;
export const getCurrentContractVersion = (\_contract: string) => 1;

/\*\*

- The props a freshly created node of `type` starts with at `version`;
- `undefined` when that exact version is not retained. Consumers (the
- release module's migrations) never read `createDefaultNode` themselves, so
- what a "default" is stays defined here.
-
- TODO: Retain every published version's defaults. Until then only the
- current version is known, and a migration reports an older one as
- unresolvable instead of guessing.
  \*/
  export const getComponentDefaultProps = (
  type: string,
  version: number
  ): Readonly<Record<string, unknown>> | undefined =>
  version === getCurrentComponentVersion(type)
  ? tryGetComponentDefinition(type)?.createDefaultNode().props
  : undefined;

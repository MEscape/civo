import type { ComponentDefinition } from "@/modules/component-platform/domain/types";
import { heroDefinition } from "./hero/hero.definition";
import { richTextDefinition } from "./rich-text/rich-text.definition";
import { callToActionDefinition } from "./call-to-action/call-to-action.definition";
import { cardGridDefinition } from "./card-grid/card-grid.definition";
import { accordionDefinition } from "./accordion-block/accordion-block.definition";
import { tabsDefinition } from "./tabs-block/tabs-block.definition";

export const contentComponents: ComponentDefinition[] = [
    heroDefinition,
    richTextDefinition,
    callToActionDefinition,
    cardGridDefinition,
    accordionDefinition,
    tabsDefinition,
];

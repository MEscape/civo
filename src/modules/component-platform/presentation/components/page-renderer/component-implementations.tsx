import { AccordionBlock } from '../content/accordion-block';
import { CallToAction } from '../content/call-to-action';
import { CardGrid } from '../content/card-grid';
import { Hero, heroImageSource } from '../content/hero';
import { RichText } from '../content/rich-text';
import { TabsBlock } from '../content/tabs-block';
import { SectionBlock } from '../layout/section-block';

import { CIVIC_IMPLEMENTATIONS } from './civic-implementations';
import { implementComponent } from './component-implementation';
import { SMART_CITY_IMPLEMENTATIONS } from './smartcity-implementations';

import type { ComponentImplementation } from './component-implementation';
import type { RegisteredComponentName } from '../../../application/contracts/component-platform-constraints';

/**
 * One implementation per registered component, and the compiler holds the
 * two lists together: a definition without an entry here, or an entry for a
 * type that is not registered, does not compile.
 */
export const COMPONENT_IMPLEMENTATIONS = {
  // layout
  section: implementComponent('section', {
    render: ({ props, children }) => (
      <SectionBlock tone={props.tone} layout={props.layout} density={props.density}>
        {children}
      </SectionBlock>
    ),
  }),

  // content
  accordion: implementComponent('accordion', {
    render: ({ props }) => <AccordionBlock props={props} />,
  }),
  callToAction: implementComponent('callToAction', {
    render: ({ props }) => <CallToAction props={props} />,
  }),
  cardGrid: implementComponent('cardGrid', {
    render: ({ props }) => <CardGrid props={props} />,
  }),
  hero: implementComponent('hero', {
    render: ({ props, context, mediaUrl }) => (
      <Hero props={props} imageSrc={heroImageSource(props, context, mediaUrl)} />
    ),
  }),
  richText: implementComponent('richText', {
    render: ({ props }) => <RichText props={props} />,
  }),
  tabs: implementComponent('tabs', {
    render: ({ props }) => <TabsBlock props={props} />,
  }),

  // civic and smart city, in their own files
  ...CIVIC_IMPLEMENTATIONS,
  ...SMART_CITY_IMPLEMENTATIONS,
} as const satisfies Record<RegisteredComponentName, ComponentImplementation>;

const IMPLEMENTATIONS_BY_TYPE: ReadonlyMap<string, ComponentImplementation> = new Map(
  Object.entries(COMPONENT_IMPLEMENTATIONS),
);

/**
 * Looks a type up by exact key. A `Map` rather than property access, so a
 * stored type such as "constructor" can never resolve to an inherited member.
 */
export function findImplementation(type: string): ComponentImplementation | undefined {
  return IMPLEMENTATIONS_BY_TYPE.get(type);
}

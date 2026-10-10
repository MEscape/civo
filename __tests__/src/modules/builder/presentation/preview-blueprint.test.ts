import { describe, expect, it } from 'vitest';

import type { ComponentDescriptor } from '@modules/builder/application/contracts/builder-constraints';
import { ComponentPlatformDescriptorProvider } from '@modules/builder/infrastructure/component-platform/component-platform-descriptor-provider';
import {
  buildPreviewBlueprint,
  readPreviewSample,
} from '@modules/builder/presentation/properties/preview-blueprint';
import { toCatalogEntry } from '@modules/component-platform/application/component-platform-view-mappers';
import { COMPONENT_DEFINITIONS } from '@modules/component-platform/domain/components/component-definitions';
import { COMPONENT_REGISTRY } from '@modules/component-platform/domain/components/platform-registry';
import deComponentPlatform from '@modules/component-platform/presentation/i18n/de.json';
import enComponentPlatform from '@modules/component-platform/presentation/i18n/en.json';

const provider = new ComponentPlatformDescriptorProvider(
  COMPONENT_DEFINITIONS.map(toCatalogEntry),
  (parent, child) => COMPONENT_REGISTRY.canNest(parent, child),
);
const descriptors = provider.listDescriptors();

function describeType(type: string): ComponentDescriptor | null {
  return descriptors.find((descriptor) => descriptor.type === type) ?? null;
}

function descriptorOf(type: string): ComponentDescriptor {
  const descriptor = describeType(type);
  if (descriptor === null) {
    throw new Error(`No component ${type}`);
  }
  return descriptor;
}

const CATALOGS = {
  en: { componentPlatform: enComponentPlatform.componentPlatform },
  de: { componentPlatform: deComponentPlatform.componentPlatform },
} as const;

/** The components whose defaults render nothing, so their palette preview needs sample content. */
const COMPONENTS_WITH_SAMPLE = [
  'section',
  'richText',
  'accordion',
  'tabs',
  'cardGrid',
  'quickLinks',
] as const;

describe('readPreviewSample', () => {
  it('turns a list written as numbered keys into an array, in numeric order', () => {
    const sample = readPreviewSample(
      {
        c: {
          sample: {
            props: { items: { 2: { q: 'second' }, 10: { q: 'tenth' }, 1: { q: 'first' } } },
          },
        },
      },
      'c.sample',
    );

    expect(sample?.props).toEqual({ items: [{ q: 'first' }, { q: 'second' }, { q: 'tenth' }] });
  });

  it('reads sample children with their own props', () => {
    const sample = readPreviewSample(
      { s: { props: {}, children: { 1: { type: 'richText', props: { body: 'Hi' } } } } },
      's',
    );

    expect(sample?.children).toEqual([{ type: 'richText', props: { body: 'Hi' } }]);
  });

  it('means "no sample" when the entry is missing or malformed', () => {
    expect(readPreviewSample({}, 'missing')).toBeNull();
    expect(readPreviewSample({ s: 'text' }, 's')).toBeNull();
  });
});

describe('buildPreviewBlueprint', () => {
  it('is the component defaults when there is no sample', () => {
    const descriptor = descriptorOf('eventsGrid');

    expect(buildPreviewBlueprint(descriptor, null, describeType)).toBe(descriptor.blueprint);
  });

  it('puts the sample over the defaults without losing the defaults it does not mention', () => {
    const blueprint = buildPreviewBlueprint(
      descriptorOf('cardGrid'),
      { props: { heading: 'Offers' }, children: [] },
      describeType,
    );

    expect(blueprint.props).toMatchObject({ heading: 'Offers', columns: 3 });
  });

  it('builds sample children from their own defaults and skips unknown types', () => {
    const blueprint = buildPreviewBlueprint(
      descriptorOf('section'),
      {
        props: {},
        children: [
          { type: 'richText', props: { body: 'Text' } },
          { type: 'gone', props: {} },
        ],
      },
      describeType,
    );

    expect(blueprint.children).toHaveLength(1);
    expect(blueprint.children[0]).toMatchObject({ type: 'richText', props: { body: 'Text' } });
  });
});

describe.each(['en', 'de'] as const)('the translated preview samples (%s)', (locale) => {
  it.each(COMPONENTS_WITH_SAMPLE)('%s previews with content', (type) => {
    const descriptor = descriptorOf(type);
    const sample = readPreviewSample(CATALOGS[locale], descriptor.sampleKey);

    expect(sample, `${type} has a sample`).not.toBeNull();
    const blueprint = buildPreviewBlueprint(descriptor, sample, describeType);
    const definition = COMPONENT_DEFINITIONS.find((candidate) => candidate.type === type);

    // Every sample prop must survive the component's own validation, or the preview would silently show defaults.
    const parsed = definition?.parseProps(blueprint.props) ?? {};
    expect(parsed).toMatchObject(sample?.props ?? {});
    if (type === 'section') {
      expect(blueprint.children.length).toBeGreaterThan(0);
    }
  });
});

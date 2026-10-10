import { getPath, isJsonRecord } from '@lib/utils';
import type { JsonValue } from '@lib/utils';

import type {
  ComponentDescriptor,
  NodeBlueprint,
} from '../../application/contracts/builder-constraints';
import type { PageNodeProps } from '../../application/contracts/editor-model';

/** Translated placeholder content of one component, as its palette preview renders it. */
export interface PreviewSample {
  readonly props: PageNodeProps;
  readonly children: ReadonlyArray<{ readonly type: string; readonly props: PageNodeProps }>;
}

const INDEX_KEY = /^\d+$/;
/** Messages have no arrays; a list is written as an object keyed `1`, `2`, … */
const PLAIN_RADIX = 10;

function isIndexed(record: Readonly<Record<string, JsonValue>>): boolean {
  const keys = Object.keys(record);
  return keys.length > 0 && keys.every((key) => INDEX_KEY.test(key));
}

/** Turns message objects keyed by position into the arrays the props expect, at any depth. */
function revive(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(revive);
  }
  if (!isJsonRecord(value)) {
    return value;
  }
  if (isIndexed(value)) {
    return Object.entries(value)
      .sort(([first], [second]) => parseInt(first, PLAIN_RADIX) - parseInt(second, PLAIN_RADIX))
      .map(([, entry]) => revive(entry));
  }
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, revive(entry)]));
}

function asProps(value: JsonValue | undefined): PageNodeProps {
  const revived = value === undefined ? {} : revive(value);
  return isJsonRecord(revived) ? revived : {};
}

/**
 * Reads a component's preview sample from the loaded messages. A missing or
 * malformed entry is "no sample": the preview then renders the defaults.
 */
export function readPreviewSample(messages: unknown, sampleKey: string): PreviewSample | null {
  const raw = getPath(messages, sampleKey);
  if (!isJsonRecord(raw)) {
    return null;
  }
  const children = revive(raw['children'] ?? []);
  return {
    props: asProps(raw['props']),
    children: Array.isArray(children)
      ? children.flatMap((child) =>
          isJsonRecord(child) && typeof child['type'] === 'string'
            ? [{ type: child['type'], props: asProps(child['props']) }]
            : [],
        )
      : [],
  };
}

/**
 * The node the palette preview renders: the component's defaults with its
 * sample on top, children included. A child's own defaults sit under its
 * sample props, so a sample only states what differs.
 */
export function buildPreviewBlueprint(
  descriptor: ComponentDescriptor,
  sample: PreviewSample | null,
  describe: (type: string) => ComponentDescriptor | null,
): NodeBlueprint {
  if (sample === null) {
    return descriptor.blueprint;
  }
  return {
    ...descriptor.blueprint,
    props: { ...descriptor.blueprint.props, ...sample.props },
    children: sample.children.flatMap((child) => {
      const childDescriptor = describe(child.type);
      return childDescriptor === null
        ? []
        : [
            {
              ...childDescriptor.blueprint,
              props: { ...childDescriptor.blueprint.props, ...child.props },
            },
          ];
    }),
  };
}

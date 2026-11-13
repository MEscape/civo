import { readFile } from 'node:fs/promises';

import manifestJson from '../../data/seeds/wuerzburg.json' with { type: 'json' };
import { isJsonRecord, isPlainObject } from '../../src/lib/utils';
import { COMPONENT_DEFINITIONS } from '../../src/modules/component-platform/domain/components/component-definitions';
import {
  getContentDefinition,
  isContentKind,
} from '../../src/modules/component-platform/domain/content/content-definitions';
import { restoreDatasetMapping } from '../../src/modules/data-sources/domain/mapping/dataset-mapping';
import { isCanonicalKind } from '../../src/modules/data-sources/domain/models/canonical-kinds';
import { createDataSourceDraft } from '../../src/modules/data-sources/domain/models/data-source';

export type WuerzburgManifest = typeof manifestJson;
// A UUID like every website id: tenancy only reads a website from a UUID path segment.
export const WUERZBURG_WEBSITE_ID = '3b0f6f2e-8a51-4c9d-9e27-5d1a7c4b2f80';

function validateRecords(manifest: WuerzburgManifest): void {
  for (const source of manifest.sources) {
    const valid = createDataSourceDraft({ websiteId: manifest.websiteId, ...source });
    if (valid.isErr()) {
      throw new Error(`Invalid reference source ${source.id}`);
    }
    const dataset = manifest.datasets.find((item) => item.sourceId === source.id);
    if (dataset === undefined || !isContentKind(dataset.canonicalKind)) {
      throw new Error(`Missing canonical dataset for ${source.id}`);
    }
    const definition = getContentDefinition(dataset.canonicalKind);
    for (const record of source.config.records) {
      if (definition.parse(record).isErr()) {
        throw new Error(`Invalid ${dataset.canonicalKind} record in ${source.id}`);
      }
    }
  }
}

function validateNodes(nodes: readonly unknown[]): void {
  for (const node of nodes) {
    if (!isPlainObject(node) || typeof node['type'] !== 'string' || !isJsonRecord(node['props'])) {
      throw new Error('Invalid reference page node');
    }
    const definition = COMPONENT_DEFINITIONS.find((item) => item.type === node['type']);
    if (definition === undefined) {
      throw new Error(`Unknown reference component ${node['type']}`);
    }
    const props: Readonly<Record<string, unknown>> = definition.parseProps(node['props']);
    for (const [key, value] of Object.entries(node['props'])) {
      if (JSON.stringify(props[key]) !== JSON.stringify(value)) {
        throw new Error(`Invalid reference prop ${node['type']}.${key}`);
      }
    }
    if (!Array.isArray(node['children'])) {
      throw new Error('Reference node children must be an array');
    }
    validateNodes(node['children']);
  }
}

/** A checked-in, offline artifact; no source is silently refreshed while seeding. */
export async function readWuerzburgManifest(): Promise<WuerzburgManifest> {
  const license = await readFile(
    new URL('../../data/fixtures/pegel-license/response.html', import.meta.url),
    'utf8',
  );
  if (!/zero|Zero/.test(license)) {
    throw new Error('PEGELONLINE reuse license has not been captured and reviewed');
  }
  if (manifestJson.websiteId !== WUERZBURG_WEBSITE_ID) {
    throw new Error('Reference manifest names an unexpected website');
  }
  validateRecords(manifestJson);
  for (const dataset of manifestJson.datasets) {
    if (
      !isCanonicalKind(dataset.canonicalKind) ||
      restoreDatasetMapping(dataset.canonicalKind, dataset.mapping) === null
    ) {
      throw new Error(`Invalid stored field mapping ${dataset.id}`);
    }
  }
  for (const page of manifestJson.pages) {
    validateNodes(page.config.children);
  }
  return manifestJson;
}

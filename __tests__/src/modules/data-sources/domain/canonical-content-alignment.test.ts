import { describe, expect, it } from 'vitest';

import { CONTENT_DEFINITIONS } from '../../../../../src/modules/component-platform/domain/content/content-definitions';
import { CANONICAL_TARGET_FIELDS } from '../../../../../src/modules/data-sources/domain/mapping/canonical-target-fields';
import { restoreDatasetMapping } from '../../../../../src/modules/data-sources/domain/mapping/dataset-mapping';

describe('canonical mapping and rendered content agree', () => {
  for (const [kind, definition] of Object.entries(CONTENT_DEFINITIONS)) {
    it(`offers every renderable ${kind} field except the authoritative source id`, () => {
      const target = CANONICAL_TARGET_FIELDS[kind as keyof typeof CANONICAL_TARGET_FIELDS];
      const paths = new Set(target.map((field) => field.path));
      for (const name of definition.fieldNames.filter((field) => field !== 'id')) {
        expect(paths.has(name), `${kind}.${name}`).toBe(true);
      }
    });
  }

  it('continues to restore the prior opening-hours mapping vocabulary', () => {
    const mapping = restoreDatasetMapping('OpeningHoursEntry', {
      fields: [
        { sourcePath: 'weekday', targetPath: 'dayOfWeek' },
        { sourcePath: 'open', targetPath: 'openTime' },
        { sourcePath: 'close', targetPath: 'closeTime' },
      ],
    });
    expect(mapping?.fields.map((field) => field.targetPath)).toEqual([
      'dayOfWeek',
      'openTime',
      'closeTime',
    ]);
  });

  it('continues to reject mapping over the authoritative source id', () => {
    expect(
      restoreDatasetMapping('SmartCityMetric', {
        fields: [{ sourcePath: 'id', targetPath: 'id' }],
      }),
    ).toBeNull();
  });
});

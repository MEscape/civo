import { describe, expect, it } from 'vitest';

import { applyMapping } from '@modules/data-sources/domain/mapping/apply-mapping';
import type { DatasetMapping } from '@modules/data-sources/domain/mapping/dataset-mapping';

const MAPPING = {
  fields: [
    {
      sourcePath: 'when',
      targetPath: 'startsAt',
      required: false,
      transform: { kind: 'datetime' },
    },
  ],
} as unknown as DatasetMapping;

function startsAt(when: unknown): unknown {
  const result = applyMapping(MAPPING, { when });
  return result.isOk() ? result.value['startsAt'] : result.error;
}

/**
 * An instant must mean the same thing on every host. `new Date('2026-10-12T10:00')`
 * reads a zone-less time in the SERVER's zone, so the same record shifted
 * between a laptop in Berlin and a UTC host.
 */
describe('mapping a datetime without a zone', () => {
  it.each(['2026-10-12T10:00', '2026-10-12 10:00', '2026-10-12T10:00:00', '2026-10-12 10:00:00.5'])(
    'reads %s as UTC',
    (raw) => {
      const instant = startsAt(raw);
      expect(instant).toBeInstanceOf(Date);
      expect((instant as Date).toISOString().slice(0, 16)).toBe('2026-10-12T10:00');
    },
  );

  it('keeps an explicit offset', () => {
    expect((startsAt('2026-10-12T10:00:00+02:00') as Date).toISOString()).toBe(
      '2026-10-12T08:00:00.000Z',
    );
  });
});

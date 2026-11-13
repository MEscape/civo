import { describe, expect, it } from 'vitest';

import { loadMediaUsage } from '@modules/media/presentation/loaders/load-media-usage';
import type { MediaUsageReaders } from '@modules/media/presentation/loaders/load-media-usage';

import { infrastructureError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

const readers = (drafts: MediaUsageReaders['drafts']): MediaUsageReaders => ({
  drafts,
  labels: (_locale, types) =>
    Promise.resolve(Object.fromEntries(types.map((type) => [type, `Label ${type}`]))),
  componentHref: (websiteId, pageId, nodeId) => `/${websiteId}/${pageId}?select=${nodeId}`,
});

describe('loadMediaUsage', () => {
  it('names each component showing a file, with its page and a way to it', async () => {
    const usage = await loadMediaUsage(
      'w',
      'en',
      readers(() =>
        okAsync({
          byAsset: {
            a1: [{ pageId: 'home', title: 'Home', components: [{ nodeId: 'n1', type: 'hero' }] }],
          },
          isTruncated: false,
        }),
      ),
    );

    expect(usage).toEqual({
      a1: [{ href: '/w/home?select=n1', label: 'Label hero', detail: 'Home' }],
    });
  });

  it('answers "unknown", never "unused", when the read failed, was cut short or is not allowed', async () => {
    const failed = readers(() => errAsync(infrastructureError('builder.failed', 'down')));
    const truncated = readers(() => okAsync({ byAsset: {}, isTruncated: true }));

    expect(await loadMediaUsage('w', 'en', failed)).toBeNull();
    expect(await loadMediaUsage('w', 'en', truncated)).toBeNull();
    expect(await loadMediaUsage('w', 'en', null)).toBeNull();
  });
});

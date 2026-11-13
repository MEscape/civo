import { describe, expect, it, vi } from 'vitest';

import { loadAuditEventLabels } from '@modules/audit/presentation/loaders/load-audit-event-labels';

vi.mock('@i18n/server', () => ({
  getMessages: () =>
    Promise.resolve({
      release: { auditEvents: { release: { published: 'Release published' } } },
      auth: { auditEvents: { membership: { removed: 'Member removed' } } },
      dataSources: { auditEvents: { data_source: { created: 'Source connected' } } },
    }),
}));

describe('loadAuditEventLabels', () => {
  it('words each event from the module that records it, once per type', async () => {
    const labels = await loadAuditEventLabels('en', [
      { type: 'release.published' },
      { type: 'release.published' },
      { type: 'membership.removed' },
      { type: 'data_source.created' },
    ]);

    expect(labels).toEqual({
      'release.published': 'Release published',
      'membership.removed': 'Member removed',
      'data_source.created': 'Source connected',
    });
  });

  it('leaves an event nobody worded out, so the screen shows its code', async () => {
    expect(
      await loadAuditEventLabels('en', [{ type: 'release.vanished' }, { type: 'x.y' }]),
    ).toEqual({});
  });
});

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDatasetMapping } from '@modules/data-sources/domain/mapping/dataset-mapping';
import { discoverDatasetAction } from '@modules/data-sources/presentation/actions/discover-dataset-action';
import { saveDatasetMappingAction } from '@modules/data-sources/presentation/actions/save-dataset-mapping-action';
import { useDataSourceMapping } from '@modules/data-sources/presentation/hooks/use-data-source-mapping';
import messages from '@modules/data-sources/presentation/i18n/en.json';
import { datasetMappingCommandSchema } from '@modules/data-sources/presentation/schemas/dataset-mapping-command-schema';

import { DATASET_DTO } from '../../support/data-source-fixtures';

vi.mock('@modules/data-sources/presentation/actions/discover-dataset-action', () => ({
  discoverDatasetAction: vi.fn(),
}));
vi.mock('@modules/data-sources/presentation/actions/save-dataset-mapping-action', () => ({
  saveDatasetMappingAction: vi.fn(),
}));
vi.mock('@modules/data-sources/presentation/actions/preview-dataset-mapping-action', () => ({
  previewDatasetMappingAction: vi.fn(),
}));

function wrapper({ children }: { readonly children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());

describe('mapping preservation', () => {
  it('preserves duplicate source assignments and transforms across save, unassign, and another save', async () => {
    const existingMapping = createDatasetMapping('NewsItem', {
      fields: [
        { sourcePath: 'title', targetPath: 'title', transform: { kind: 'string' } },
        { sourcePath: 'title', targetPath: 'excerpt' },
      ],
    })._unsafeUnwrap();
    vi.mocked(saveDatasetMappingAction).mockImplementation(async (input) => {
      const command = datasetMappingCommandSchema.parse(input);
      return {
        ok: true,
        data: {
          ...DATASET_DTO,
          mapping: createDatasetMapping('NewsItem', command.mapping)._unsafeUnwrap(),
        },
      };
    });
    const { result } = renderHook(
      () =>
        useDataSourceMapping({
          datasetId: DATASET_DTO.id,
          canonicalKind: 'NewsItem',
          existingMapping,
        }),
      { wrapper },
    );
    await act(async () => {
      result.current.handleSave();
    });
    expect(
      datasetMappingCommandSchema.parse(vi.mocked(saveDatasetMappingAction).mock.calls[0]?.[0])
        .mapping.fields,
    ).toHaveLength(2);
    act(() => {
      result.current.handleAssign('title', '');
    });
    await act(async () => {
      result.current.handleSave();
    });
    expect(result.current.isDirty).toBe(false);
    expect(result.current.assignments).toEqual({ title: 'title' });
    await act(async () => {
      result.current.handleSave();
    });
    const last = datasetMappingCommandSchema.parse(
      vi.mocked(saveDatasetMappingAction).mock.lastCall?.[0],
    );
    expect(last.mapping.fields).toEqual([
      { sourcePath: 'title', targetPath: 'title', transform: { kind: 'string' } },
    ]);
    expect(result.current.isDirty).toBe(false);
  });

  it('keeps saved and unsaved assignments visible when a subsequent sample omits their fields', async () => {
    vi.mocked(discoverDatasetAction)
      .mockResolvedValueOnce({
        ok: true,
        data: { fields: [{ path: 'fresh', sampleType: 'string', sampleValue: 'Fresh' }] },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { fields: [{ path: 'other', sampleType: 'string', sampleValue: 'Other' }] },
      });
    const { result } = renderHook(
      () =>
        useDataSourceMapping({
          datasetId: DATASET_DTO.id,
          canonicalKind: 'NewsItem',
          existingMapping: DATASET_DTO.mapping,
        }),
      { wrapper },
    );
    await act(async () => {
      result.current.handleDiscover();
    });
    act(() => {
      result.current.handleAssign('fresh', 'excerpt');
    });
    await act(async () => {
      result.current.handleDiscover();
    });
    expect(result.current.fields?.map((field) => field.path)).toEqual(['other', 'title', 'fresh']);
    act(() => {
      result.current.handleAssign('fresh', '');
    });
    expect(result.current.assignments['fresh']).toBeUndefined();
  });
});

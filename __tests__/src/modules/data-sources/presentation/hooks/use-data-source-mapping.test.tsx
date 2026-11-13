import React from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { discoverDatasetAction } from '@modules/data-sources/presentation/actions/discover-dataset-action';
import { previewDatasetMappingAction } from '@modules/data-sources/presentation/actions/preview-dataset-mapping-action';
import { saveDatasetMappingAction } from '@modules/data-sources/presentation/actions/save-dataset-mapping-action';
import { useDataSourceMapping } from '@modules/data-sources/presentation/hooks/use-data-source-mapping';
import enDataSources from '@modules/data-sources/presentation/i18n/en.json';

import enApp from '@i18n/messages/en.json';

import { DATASET_DTO } from '../../support/data-source-fixtures';

vi.mock('@modules/data-sources/presentation/actions/discover-dataset-action', () => ({
  discoverDatasetAction: vi.fn(),
}));

vi.mock('@modules/data-sources/presentation/actions/preview-dataset-mapping-action', () => ({
  previewDatasetMappingAction: vi.fn(),
}));

vi.mock('@modules/data-sources/presentation/actions/save-dataset-mapping-action', () => ({
  saveDatasetMappingAction: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider
      locale="en"
      messages={{ app: enApp, dataSources: enDataSources.dataSources }}
      timeZone="UTC"
    >
      {children}
    </NextIntlClientProvider>
  );
}

describe('useDataSourceMapping', () => {
  const existingMapping = {
    fields: [
      { sourcePath: 'title', targetPath: 'title', required: true },
      { sourcePath: 'date', targetPath: 'publishedAt', required: false },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes from existing mapping and labels target fields', () => {
    const { result } = renderHook(
      () =>
        useDataSourceMapping({
          datasetId: 'dataset-1',
          canonicalKind: 'NewsItem',
          existingMapping,
        }),
      { wrapper },
    );

    expect(result.current.assignments).toEqual({
      title: 'title',
      date: 'publishedAt',
    });
    expect(result.current.targets).toBeDefined();
    expect(result.current.targetLabel('title')).toBeDefined();
    expect(result.current.describeKey('fields.0.sourcePath')).toContain('1');
    expect(result.current.targetsUsedElsewhere('title')).toEqual(new Set(['publishedAt']));
    expect(result.current.isDirty).toBe(false);
  });

  it('detects changes in assignments against the saved baseline', () => {
    const { result } = renderHook(
      () =>
        useDataSourceMapping({
          datasetId: 'dataset-1',
          canonicalKind: 'NewsItem',
          existingMapping,
        }),
      { wrapper },
    );

    act(() => {
      result.current.handleAssign('title', 'excerpt');
    });

    expect(result.current.assignments['title']).toBe('excerpt');
    expect(result.current.isDirty).toBe(true);

    act(() => {
      // Unassign field by passing empty string
      result.current.handleAssign('date', '');
    });
    expect(result.current.assignments['date']).toBeUndefined();

    // Revert title to original
    act(() => {
      result.current.handleAssign('title', 'title');
      result.current.handleAssign('date', 'publishedAt');
    });
    expect(result.current.isDirty).toBe(false);
  });

  describe('opening the panel', () => {
    it('reads the fields by itself and suggests a first mapping from their names', async () => {
      vi.mocked(discoverDatasetAction).mockResolvedValue({
        ok: true,
        data: {
          fields: [
            { path: 'title', sampleType: 'string', sampleValue: 'Example' },
            { path: 'userId', sampleType: 'number', sampleValue: '1' },
          ],
        },
      });

      const { result } = renderHook(
        () =>
          useDataSourceMapping({
            datasetId: 'dataset-1',
            canonicalKind: 'NewsItem',
            existingMapping: null,
            autoLoad: true,
          }),
        { wrapper },
      );

      await waitFor(() => {
        expect(result.current.fields).toHaveLength(2);
      });
      expect(discoverDatasetAction).toHaveBeenCalledTimes(1);
      expect(result.current.assignments).toEqual({ title: 'title' });
      expect(result.current.suggestedCount).toBe(1);
      expect(result.current.missingRequired).toEqual([]);
    });

    it('waits for a click when the panel does not load by itself', () => {
      renderHook(
        () =>
          useDataSourceMapping({
            datasetId: 'dataset-1',
            canonicalKind: 'NewsItem',
            existingMapping: null,
          }),
        { wrapper },
      );

      expect(discoverDatasetAction).not.toHaveBeenCalled();
    });

    it('does not replace a saved mapping with a suggestion', async () => {
      vi.mocked(discoverDatasetAction).mockResolvedValue({
        ok: true,
        data: { fields: [{ path: 'name', sampleType: 'string', sampleValue: 'x' }] },
      });

      const { result } = renderHook(
        () =>
          useDataSourceMapping({
            datasetId: 'dataset-1',
            canonicalKind: 'NewsItem',
            existingMapping,
            autoLoad: true,
          }),
        { wrapper },
      );

      await waitFor(() => {
        expect(result.current.fields).not.toBeNull();
      });
      expect(result.current.assignments).toEqual({ title: 'title', date: 'publishedAt' });
      expect(result.current.suggestedCount).toBe(0);
    });

    it('names the required fields nothing is assigned to', () => {
      const { result } = renderHook(
        () =>
          useDataSourceMapping({
            datasetId: 'dataset-1',
            canonicalKind: 'Event',
            existingMapping: null,
          }),
        { wrapper },
      );

      expect(result.current.missingRequired.map((target) => target.path)).toEqual([
        'title',
        'startDate',
      ]);
    });
  });

  describe('handleDiscover', () => {
    it('populates fields on discovery success', async () => {
      vi.mocked(discoverDatasetAction).mockResolvedValue({
        ok: true,
        data: {
          fields: [
            { path: 'title', sampleType: 'string', sampleValue: 'Example title' },
            { path: 'date', sampleType: 'string', sampleValue: '2026-01-01' },
          ],
        },
      });

      const { result } = renderHook(
        () =>
          useDataSourceMapping({
            datasetId: 'dataset-1',
            canonicalKind: 'NewsItem',
            existingMapping: null,
          }),
        { wrapper },
      );

      await act(async () => {
        result.current.handleDiscover();
      });

      expect(result.current.fields).toHaveLength(2);
      expect(result.current.status.kind).toBe('idle');
    });

    it('sets failed status on discovery failure', async () => {
      vi.mocked(discoverDatasetAction).mockResolvedValue({
        ok: false,
        error: { code: 'data_sources.unreachable', message: 'Failed to connect' },
      });

      const { result } = renderHook(
        () =>
          useDataSourceMapping({
            datasetId: 'dataset-1',
            canonicalKind: 'NewsItem',
            existingMapping: null,
          }),
        { wrapper },
      );

      await act(async () => {
        result.current.handleDiscover();
      });

      expect(result.current.status.kind).toBe('failed');
      expect(result.current.failure?.code).toBe('data_sources.unreachable');
    });
  });

  describe('handlePreview', () => {
    it('sets failed status if no fields are assigned', () => {
      const { result } = renderHook(
        () =>
          useDataSourceMapping({
            datasetId: 'dataset-1',
            canonicalKind: 'NewsItem',
            existingMapping: null,
          }),
        { wrapper },
      );

      act(() => {
        result.current.handlePreview();
      });

      expect(result.current.status.kind).toBe('failed');
    });

    it('sets previewed status with json data on action success', async () => {
      vi.mocked(previewDatasetMappingAction).mockResolvedValue({
        ok: true,
        data: { json: '{"items":[{"headline":"Test"}]}' },
      });

      const { result } = renderHook(
        () =>
          useDataSourceMapping({
            datasetId: 'dataset-1',
            canonicalKind: 'NewsItem',
            existingMapping,
          }),
        { wrapper },
      );

      await act(async () => {
        result.current.handlePreview();
      });

      expect(result.current.status.kind).toBe('previewed');
      if (result.current.status.kind === 'previewed') {
        expect(result.current.status.json).toContain('items');
      }
    });

    it('sets failed status on preview action error', async () => {
      vi.mocked(previewDatasetMappingAction).mockResolvedValue({
        ok: false,
        error: { code: 'data_sources.mapping_invalid', message: 'Invalid target' },
      });

      const { result } = renderHook(
        () =>
          useDataSourceMapping({
            datasetId: 'dataset-1',
            canonicalKind: 'NewsItem',
            existingMapping,
          }),
        { wrapper },
      );

      await act(async () => {
        result.current.handlePreview();
      });

      expect(result.current.status.kind).toBe('failed');
    });
  });

  describe('handleSave', () => {
    it('sets failed status if nothing is assigned', () => {
      const { result } = renderHook(
        () =>
          useDataSourceMapping({
            datasetId: 'dataset-1',
            canonicalKind: 'NewsItem',
            existingMapping: null,
          }),
        { wrapper },
      );

      act(() => {
        result.current.handleSave();
      });

      expect(result.current.status.kind).toBe('failed');
    });

    it('sets saved status on save action success', async () => {
      vi.mocked(saveDatasetMappingAction).mockResolvedValue({
        ok: true,
        data: { ...DATASET_DTO, mapping: existingMapping },
      });

      const { result } = renderHook(
        () =>
          useDataSourceMapping({
            datasetId: 'dataset-1',
            canonicalKind: 'NewsItem',
            existingMapping,
          }),
        { wrapper },
      );

      await act(async () => {
        result.current.handleSave();
      });

      expect(result.current.status.kind).toBe('saved');
    });

    it('sets failed status on save action error', async () => {
      vi.mocked(saveDatasetMappingAction).mockResolvedValue({
        ok: false,
        error: { code: 'data_sources.save_failed', message: 'Failed to save' },
      });

      const { result } = renderHook(
        () =>
          useDataSourceMapping({
            datasetId: 'dataset-1',
            canonicalKind: 'NewsItem',
            existingMapping,
          }),
        { wrapper },
      );

      await act(async () => {
        result.current.handleSave();
      });

      expect(result.current.status.kind).toBe('failed');
    });
  });
});

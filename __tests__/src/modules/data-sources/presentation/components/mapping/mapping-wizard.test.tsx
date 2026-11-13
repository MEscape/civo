import type { ComponentProps } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { discoverDatasetAction } from '@modules/data-sources/presentation/actions/discover-dataset-action';
import { previewDatasetMappingAction } from '@modules/data-sources/presentation/actions/preview-dataset-mapping-action';
import { saveDatasetMappingAction } from '@modules/data-sources/presentation/actions/save-dataset-mapping-action';
import { MappingWizard } from '@modules/data-sources/presentation/components/mapping/mapping-wizard.client';

import { DataSourceIntl } from '../../../support/data-source-intl';

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('@i18n', () => ({
  Link: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
  useRouter: () => navigation,
  usePathname: () => '/websites/website-1/data/source-1/datasets/dataset-1/mapping',
}));
vi.mock('@modules/data-sources/presentation/actions/discover-dataset-action', () => ({
  discoverDatasetAction: vi.fn(),
}));
vi.mock('@modules/data-sources/presentation/actions/preview-dataset-mapping-action', () => ({
  previewDatasetMappingAction: vi.fn(),
}));
vi.mock('@modules/data-sources/presentation/actions/save-dataset-mapping-action', () => ({
  saveDatasetMappingAction: vi.fn(),
}));

const target = {
  websiteId: 'website-1',
  sourceId: 'source-1',
  datasetId: 'dataset-1',
  canonicalKind: 'NewsItem',
  existingMapping: null,
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(discoverDatasetAction).mockResolvedValue({
    ok: true,
    data: {
      fields: [
        { path: 'title', sampleType: 'string', sampleValue: 'First' },
        { path: 'id', sampleType: 'number', sampleValue: '1' },
      ],
    },
  });
});

describe('mapping wizard', () => {
  it('reads the fields by itself and starts from a suggestion', async () => {
    render(<MappingWizard {...target} step="fields" />, { wrapper: DataSourceIntl });

    expect(await screen.findByText('title')).toBeInTheDocument();
    expect(screen.getByText(/We matched one field by its name/)).toBeInTheDocument();
    expect(screen.getByText('All required fields are assigned.')).toBeInTheDocument();
    expect(discoverDatasetAction).toHaveBeenCalledWith('dataset-1');
  });

  it('goes on to review with a preview once the required fields are assigned', async () => {
    vi.mocked(previewDatasetMappingAction).mockResolvedValue({
      ok: true,
      data: { json: '{ "title": "First" }' },
    });
    render(<MappingWizard {...target} step="fields" />, { wrapper: DataSourceIntl });
    await screen.findByText('title');
    await waitFor(() => expect(screen.getByRole('button', { name: /Next:/ })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: /Next:/ }));

    await waitFor(() => {
      expect(navigation.push).toHaveBeenLastCalledWith(
        '/websites/website-1/data/source-1/datasets/dataset-1/mapping?step=review',
      );
    });
    expect(previewDatasetMappingAction).toHaveBeenCalledTimes(1);
  });

  it('stays on the fields while a required one has nothing assigned', async () => {
    vi.mocked(discoverDatasetAction).mockResolvedValue({
      ok: true,
      data: { fields: [{ path: 'slug', sampleType: 'string', sampleValue: 'first' }] },
    });
    render(<MappingWizard {...target} step="fields" />, { wrapper: DataSourceIntl });
    await screen.findByText('slug');
    await waitFor(() => expect(screen.getByRole('button', { name: /Next:/ })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: /Next:/ }));

    expect(await screen.findByText('Required field not assigned.')).toBeInTheDocument();
    expect(screen.getByText(/Still needed: Title/)).toBeInTheDocument();
    expect(navigation.push).not.toHaveBeenCalled();
    expect(previewDatasetMappingAction).not.toHaveBeenCalled();
  });

  it('saves on review and returns to the source', async () => {
    vi.mocked(saveDatasetMappingAction).mockResolvedValue({
      ok: true,
      data: {
        id: 'dataset-1',
        mapping: { fields: [{ sourcePath: 'title', targetPath: 'title', required: true }] },
      },
    } as never);
    const { rerender } = render(<MappingWizard {...target} step="fields" />, {
      wrapper: DataSourceIntl,
    });
    await screen.findByText('title');
    rerender(<MappingWizard {...target} step="review" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save mapping' })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: 'Save mapping' }));

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith('/websites/website-1/data/source-1');
    });
    expect(saveDatasetMappingAction).toHaveBeenCalledTimes(1);
  });
});

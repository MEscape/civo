import type { ComponentProps } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDatasetAction } from '@modules/data-sources/presentation/actions/create-dataset-action';
import { updateDatasetAction } from '@modules/data-sources/presentation/actions/update-dataset-action';
import { DatasetForm } from '@modules/data-sources/presentation/components/datasets/dataset-form';

import { DATASET_DTO } from '../../../support/data-source-fixtures';
import { DataSourceIntl } from '../../../support/data-source-intl';

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('@i18n', () => ({
  Link: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
  useRouter: () => navigation,
  usePathname: () => '/websites/website-1/data/source-1/datasets/new',
}));
vi.mock('@modules/data-sources/presentation/actions/create-dataset-action', () => ({
  createDatasetAction: vi.fn(),
}));
vi.mock('@modules/data-sources/presentation/actions/update-dataset-action', () => ({
  updateDatasetAction: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());
const target = { websiteId: 'website-1', dataSourceId: 'source-1' };

describe('dataset configuration wizard', () => {
  it.each([
    { code: 'dataset.slug_taken', fieldErrors: undefined, message: 'already' },
    {
      code: 'data_source.validation_failed',
      fieldErrors: { slug: ['dataset.validation.slug_required'] },
      message: 'No key can be derived',
    },
  ])(
    'shows $code at the editable name field instead of hiding it on review',
    async ({ code, fieldErrors, message }) => {
      vi.mocked(createDatasetAction).mockResolvedValue({
        ok: false,
        error: { code, message: '', ...(fieldErrors === undefined ? {} : { fieldErrors }) },
      });
      const { rerender } = render(<DatasetForm {...target} step="basics" />, {
        wrapper: DataSourceIntl,
      });
      fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
        target: { value: '!!!!' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Next:/ }));
      await waitFor(() => {
        expect(navigation.push).toHaveBeenLastCalledWith(expect.stringContaining('step=endpoint'));
      });
      rerender(<DatasetForm {...target} step="review" />);
      fireEvent.click(screen.getByRole('button', { name: 'Add dataset' }));
      await waitFor(() => {
        expect(navigation.push).toHaveBeenLastCalledWith(expect.stringContaining('step=basics'));
      });
      rerender(<DatasetForm {...target} step="basics" />);
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('!!!!');
      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus());
      expect(screen.getByText(new RegExp(message))).toBeInTheDocument();
    },
  );

  it('opens the mapping right after a dataset is added', async () => {
    vi.mocked(createDatasetAction).mockResolvedValue({ ok: true, data: DATASET_DTO });
    const { rerender } = render(<DatasetForm {...target} step="basics" />, {
      wrapper: DataSourceIntl,
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Events' },
    });
    rerender(<DatasetForm {...target} step="review" />);
    fireEvent.click(screen.getByRole('button', { name: 'Add dataset' }));
    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith(
        '/websites/website-1/data/source-1/datasets/dataset-1/mapping',
      );
    });
  });

  it('keeps the stored type read-only, updates only supported fields and returns to the source', async () => {
    vi.mocked(updateDatasetAction).mockResolvedValue({ ok: true, data: DATASET_DTO });
    const { rerender } = render(<DatasetForm {...target} dataset={DATASET_DTO} step="basics" />, {
      wrapper: DataSourceIntl,
    });
    expect(screen.getByRole('textbox', { name: 'Dataset type' })).toHaveAttribute('readonly');
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Current news' },
    });
    rerender(<DatasetForm {...target} dataset={DATASET_DTO} step="review" />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(updateDatasetAction).toHaveBeenCalledWith({
        datasetId: DATASET_DTO.id,
        name: 'Current news',
        path: '/news',
      });
    });
    expect(navigation.replace).toHaveBeenCalledWith('/websites/website-1/data/source-1');
    expect(createDatasetAction).not.toHaveBeenCalled();
  });
});

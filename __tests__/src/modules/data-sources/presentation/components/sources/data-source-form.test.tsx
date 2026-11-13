import type { ComponentProps } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDataSourceAction } from '@modules/data-sources/presentation/actions/create-data-source-action';
import { testDataSourceConnectionAction } from '@modules/data-sources/presentation/actions/test-data-source-connection-action';
import { updateDataSourceAction } from '@modules/data-sources/presentation/actions/update-data-source-action';
import { DataSourceForm } from '@modules/data-sources/presentation/components/sources/data-source-form';
import { REST_SOURCE_FORM_DEFAULTS } from '@modules/data-sources/presentation/schemas/rest-source-form-schema';

import { SOURCE_DTO } from '../../../support/data-source-fixtures';
import { DataSourceIntl } from '../../../support/data-source-intl';

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('@i18n', () => ({
  Link: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
  useRouter: () => navigation,
  usePathname: () => '/websites/website-1/data/new',
}));
vi.mock('@modules/data-sources/presentation/actions/create-data-source-action', () => ({
  createDataSourceAction: vi.fn(),
}));
vi.mock('@modules/data-sources/presentation/actions/test-data-source-connection-action', () => ({
  testDataSourceConnectionAction: vi.fn(),
}));
vi.mock('@modules/data-sources/presentation/actions/update-data-source-action', () => ({
  updateDataSourceAction: vi.fn(),
}));

const EDITED_SOURCE = {
  id: 'source-1',
  values: {
    ...REST_SOURCE_FORM_DEFAULTS,
    name: 'Municipal events',
    baseUrl: 'https://example.org/api',
    paginationKind: 'page' as const,
    pageParam: 'p',
    pageSize: '50',
  },
  hasHiddenUrlParts: true,
};

beforeEach(() => vi.clearAllMocks());

describe('source configuration wizard', () => {
  it('keeps values across next/back, saves once on review, tests the new source and goes on to its first dataset', async () => {
    vi.mocked(createDataSourceAction).mockResolvedValue({ ok: true, data: SOURCE_DTO });
    vi.mocked(testDataSourceConnectionAction).mockResolvedValue({
      ok: true,
      data: { outcome: { isHealthy: true } },
    } as never);
    const { rerender } = render(<DataSourceForm websiteId="website-1" step="connection" />, {
      wrapper: DataSourceIntl,
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Source name' }), {
      target: { value: 'Municipal events' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'API base URL' }), {
      target: { value: 'https://example.org/api' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Next:/ }));
    await waitFor(() => {
      expect(navigation.push).toHaveBeenLastCalledWith('/websites/website-1/data/new?step=records');
    });
    expect(createDataSourceAction).not.toHaveBeenCalled();
    rerender(<DataSourceForm websiteId="website-1" step="records" />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigation.push).toHaveBeenLastCalledWith(
      '/websites/website-1/data/new?step=connection',
    );
    rerender(<DataSourceForm websiteId="website-1" step="connection" />);
    expect(screen.getByRole('textbox', { name: 'Source name' })).toHaveValue('Municipal events');
    rerender(<DataSourceForm websiteId="website-1" step="review" />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect source' }));
    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith(
        '/websites/website-1/data/source-1/datasets/new',
      );
    });
    expect(testDataSourceConnectionAction).toHaveBeenCalledWith('source-1');
    expect(createDataSourceAction).toHaveBeenCalledTimes(1);
    expect(createDataSourceAction).toHaveBeenCalledWith(
      expect.objectContaining({
        websiteId: 'website-1',
        name: 'Municipal events',
        config: expect.objectContaining({ baseUrl: 'https://example.org/api' }),
      }),
    );
  });

  it('lands on the source page when the first connection test fails, so the problem is named there', async () => {
    vi.mocked(createDataSourceAction).mockResolvedValue({ ok: true, data: SOURCE_DTO });
    vi.mocked(testDataSourceConnectionAction).mockResolvedValue({
      ok: true,
      data: { outcome: { isHealthy: false, errorCode: 'data_source.unreachable' } },
    } as never);
    const { rerender } = render(<DataSourceForm websiteId="website-1" step="connection" />, {
      wrapper: DataSourceIntl,
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Source name' }), {
      target: { value: 'Municipal events' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'API base URL' }), {
      target: { value: 'https://example.org/api' },
    });
    rerender(<DataSourceForm websiteId="website-1" step="review" />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect source' }));
    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith('/websites/website-1/data/source-1');
    });
  });

  it('returns server validation to its step and focuses the invalid field without discarding input', async () => {
    vi.mocked(createDataSourceAction).mockResolvedValue({
      ok: false,
      error: {
        code: 'data_source.validation_failed',
        message: '',
        fieldErrors: { 'config.baseUrl': ['data_source.validation.url_address_not_allowed'] },
      },
    });
    const { rerender } = render(<DataSourceForm websiteId="website-1" step="connection" />, {
      wrapper: DataSourceIntl,
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Source name' }), {
      target: { value: 'Private feed' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'API base URL' }), {
      target: { value: 'http://localhost/private' },
    });
    rerender(<DataSourceForm websiteId="website-1" step="review" />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect source' }));
    await waitFor(() => {
      expect(navigation.push).toHaveBeenLastCalledWith(
        '/websites/website-1/data/new?step=connection',
      );
    });
    rerender(<DataSourceForm websiteId="website-1" step="connection" />);
    expect(screen.getByRole('textbox', { name: 'API base URL' })).toHaveValue(
      'http://localhost/private',
    );
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'API base URL' })).toHaveFocus(),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('This address is not allowed.');
  });

  it('edits a stored source: prefilled values, the hidden address part said, saved by update', async () => {
    vi.mocked(updateDataSourceAction).mockResolvedValue({ ok: true, data: SOURCE_DTO });
    const { rerender } = render(
      <DataSourceForm websiteId="website-1" step="connection" source={EDITED_SOURCE} />,
      { wrapper: DataSourceIntl },
    );
    expect(screen.getByRole('textbox', { name: 'Source name' })).toHaveValue('Municipal events');
    expect(screen.getByRole('textbox', { name: 'API base URL' })).toHaveValue(
      'https://example.org/api',
    );
    expect(screen.getByText(/They are not shown here and are kept/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Source name' }), {
      target: { value: 'City events' },
    });
    rerender(<DataSourceForm websiteId="website-1" step="review" source={EDITED_SOURCE} />);
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      '/websites/website-1/data/source-1',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith('/websites/website-1/data/source-1?test=1');
    });
    expect(createDataSourceAction).not.toHaveBeenCalled();
    expect(updateDataSourceAction).toHaveBeenCalledWith({
      dataSourceId: 'source-1',
      name: 'City events',
      config: expect.objectContaining({
        baseUrl: 'https://example.org/api',
        pagination: expect.objectContaining({ kind: 'page', pageParam: 'p', pageSize: 50 }),
      }),
    });
  });
});

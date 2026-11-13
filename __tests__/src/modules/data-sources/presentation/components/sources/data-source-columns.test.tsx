import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { dataSourceColumns } from '@modules/data-sources/presentation/components/sources/data-source-columns';
import type { DataSourceDto } from '@modules/data-sources/presentation/dto/data-source-dto';

vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock(
  '@modules/data-sources/presentation/components/sources/remove-source-button.client',
  () => ({ RemoveSourceButton: () => <button type="button">Remove source</button> }),
);

const SOURCE = {
  id: 's1',
  name: 'Events',
  websiteId: 'w1',
  datasets: [],
} as unknown as DataSourceDto;
const t = ((key: string) => key) as never;
const format = {} as never;

function actionsOf(removal: Parameters<typeof dataSourceColumns>[0]['removal']) {
  const column = dataSourceColumns({ t, format, websiteId: 'w1', removal }).find(
    ({ id }) => id === 'actions',
  );
  return render(<div>{column?.cell(SOURCE)}</div>);
}

describe('the list of data sources', () => {
  it('lets whoever may remove a source do it from its row, like a map', () => {
    actionsOf({ usage: null, deleteData: vi.fn() });
    expect(screen.getByRole('button', { name: 'Remove source' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'list.open' })).toHaveAttribute(
      'href',
      '/websites/w1/data/s1',
    );
  });

  it('offers no removal to someone who may not', () => {
    actionsOf(undefined);
    expect(screen.queryByRole('button', { name: 'Remove source' })).not.toBeInTheDocument();
  });
});

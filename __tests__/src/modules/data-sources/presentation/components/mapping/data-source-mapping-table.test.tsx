import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { DataSourceMappingTable } from '@modules/data-sources/presentation/components/mapping/data-source-mapping-table';
import messages from '@modules/data-sources/presentation/i18n/en.json';

describe('mapping table', () => {
  function table() {
    const onAssign = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <DataSourceMappingTable
          fields={[{ path: 'name', sampleType: 'string', sampleValue: 'Town hall' }]}
          assignments={{}}
          targets={[
            { path: 'title', required: true },
            { path: 'description', required: false },
          ]}
          targetLabel={(path) => path}
          targetsUsedElsewhere={() => new Set(['description'])}
          onAssign={onAssign}
        />
      </NextIntlClientProvider>,
    );
    return onAssign;
  }

  it('keeps a named responsive table and accessible column labels', () => {
    table();
    expect(screen.getByRole('table')).toHaveAccessibleName(
      messages.dataSources.mapping.tableCaption,
    );
    expect(screen.getAllByRole('columnheader')).toHaveLength(3);
    expect(screen.getByRole('cell', { name: 'name' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Town hall' })).toBeInTheDocument();
  });

  it('keeps mapping selection and prevents assigning a target used by another field', () => {
    const onAssign = table();
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    const options = screen.getAllByRole('option');
    expect(options.at(-1)).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(options[1]!);
    expect(onAssign).toHaveBeenCalledWith('name', 'title');
  });
});

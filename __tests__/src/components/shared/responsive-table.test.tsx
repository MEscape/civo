import { useState } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ResponsiveTable } from '@components/shared/responsive-table';
import type { ResponsiveColumn } from '@components/shared/responsive-table';
import { TableRowDetailsTrigger } from '@components/shared/table-row-details';

interface Row {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

const email = `${'long'.repeat(40)}@example.com`;
const rows: readonly Row[] = [{ id: 'one', name: 'Ada', email }];
const columns: ReadonlyArray<ResponsiveColumn<Row>> = [
  {
    id: 'name',
    label: 'Name',
    header: <button type="button">Sort by name</button>,
    isSortable: true,
    sortDirection: 'ascending',
    cell: (row) => row.name,
  },
  { id: 'email', label: 'Email', cell: (row) => row.email },
  { id: 'actions', label: 'Actions', isAction: true, cell: () => <Counter /> },
];
const ready = { kind: 'ready', empty: 'No people' } as const;

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button
      type="button"
      onClick={() => {
        setCount(count + 1);
      }}
    >
      Manage access {count}
    </button>
  );
}

describe('ResponsiveTable', () => {
  it('expands only the selected row and spans every column for its details', () => {
    const expandable = [
      ...columns,
      {
        id: 'details',
        label: 'Details',
        isAction: true,
        cell: (row: Row) => <TableRowDetailsTrigger label={`${row.name} details`} />,
      },
    ];
    render(
      <ResponsiveTable
        label="People"
        rows={[...rows, { id: 'two', name: 'Grace', email: 'grace@example.org' }]}
        rowKey={(row) => row.id}
        columns={expandable}
        state={ready}
        rowDetails={(row) => <p>{row.email}</p>}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ada details' }));
    const details = screen.getByRole('region', { name: 'Ada details' });
    expect(details.closest('td')).toHaveAttribute('colspan', '4');
    expect(screen.queryByRole('region', { name: 'Grace details' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ada details' }));
    expect(screen.queryByRole('region', { name: 'Ada details' })).not.toBeInTheDocument();
  });
  it('renders one accessible dataset and keeps full values and sorting controls', () => {
    render(
      <ResponsiveTable
        label="People"
        rows={rows}
        rowKey={(row) => row.id}
        columns={columns}
        state={ready}
      />,
    );
    expect(screen.getByRole('table', { name: 'People' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Manage access 0' })).toHaveLength(1);
    expect(screen.getByRole('columnheader', { name: 'Sort by name' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    expect(screen.getByRole('cell', { name: email })).toBeInTheDocument();
  });

  it('preserves action state and focus when presentation capacity changes', () => {
    const { rerender } = render(
      <ResponsiveTable
        label="People"
        rows={rows}
        rowKey={(row) => row.id}
        columns={columns}
        state={ready}
      />,
    );
    const button = screen.getByRole('button', { name: 'Manage access 0' });
    button.focus();
    fireEvent.click(button);
    rerender(
      <ResponsiveTable
        label="People"
        rows={rows}
        rowKey={(row) => row.id}
        columns={columns}
        state={ready}
        density="wide"
      />,
    );
    expect(screen.getByRole('button', { name: 'Manage access 1' })).toBe(button);
    expect(button).toHaveFocus();
  });

  it('applies caller filtering and ordering to the same row set', () => {
    const { rerender } = render(
      <ResponsiveTable
        label="People"
        rows={rows}
        rowKey={(row) => row.id}
        columns={columns}
        state={ready}
      />,
    );
    rerender(
      <ResponsiveTable
        label="People"
        rows={[]}
        rowKey={(row) => row.id}
        columns={columns}
        state={ready}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('No people');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Manage access/ })).not.toBeInTheDocument();
  });

  it('announces loading without showing stale actions, and exposes failures', () => {
    const { rerender } = render(
      <ResponsiveTable
        label="People"
        rows={rows}
        rowKey={(row) => row.id}
        columns={columns}
        state={{ kind: 'loading', content: 'Loading people' }}
      />,
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerender(
      <ResponsiveTable
        label="People"
        rows={rows}
        rowKey={(row) => row.id}
        columns={columns}
        state={{ kind: 'error', content: 'Could not load people' }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load people');
  });

  it('hides headings that are not sortable below the breakpoint and keeps action cells unlabelled', () => {
    render(
      <ResponsiveTable
        label="People"
        rows={rows}
        rowKey={(row) => row.id}
        columns={columns}
        state={ready}
        density="compact"
      />,
    );
    const sortable = screen.getByRole('columnheader', { name: 'Sort by name' });
    const plain = screen.getByRole('columnheader', { name: 'Email' });
    expect(sortable).toHaveAttribute('data-sortable', 'true');
    expect(sortable).not.toHaveClass('absolute');
    expect(plain).not.toHaveAttribute('data-sortable');
    expect(plain).toHaveClass('absolute', '@xl:static');
    const actionCell = screen.getByRole('button', { name: 'Manage access 0' }).closest('td');
    expect(actionCell).toHaveAttribute('data-action', 'true');
    expect(actionCell).not.toHaveTextContent('Actions');
  });

  it.each([
    ['compact', '@xl:table'],
    ['standard', '@3xl:table'],
    ['wide', '@5xl:table'],
  ] as const)('turns the %s density into a table at its container width', (density, tableClass) => {
    render(
      <ResponsiveTable
        label="People"
        rows={rows}
        rowKey={(row) => row.id}
        columns={columns}
        state={ready}
        density={density}
      />,
    );
    expect(screen.getByRole('table', { name: 'People' })).toHaveClass('block', tableClass);
  });

  it('opens each group of rows with one heading spanning every column, and sizes a column on request', () => {
    const days: readonly Row[] = [
      { id: 'a', name: 'Ada', email: 'a@example.com' },
      { id: 'b', name: 'Bo', email: 'b@example.com' },
      { id: 'c', name: 'Cy', email: 'c@example.com' },
    ];
    render(
      <ResponsiveTable
        label="People"
        rows={days}
        rowKey={(row) => row.id}
        columns={[{ ...columns[0]!, width: '@3xl:w-1/4' }, columns[1]!]}
        state={ready}
        groupHeading={(row, previous) =>
          previous?.email.startsWith(row.email.slice(0, 1)) === true ? null : `Group ${row.id}`
        }
      />,
    );

    const headings = screen.getAllByRole('rowheader');
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Group a',
      'Group b',
      'Group c',
    ]);
    expect(headings[0]).toHaveAttribute('colspan', '2');
    expect(screen.getAllByRole('columnheader')[0]).toHaveClass('@3xl:w-1/4');
  });
});

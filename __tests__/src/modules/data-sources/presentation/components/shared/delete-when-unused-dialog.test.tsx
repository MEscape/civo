import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { DeleteWhenUnusedDialog } from '@modules/data-sources/presentation/components/shared/delete-when-unused-dialog';
import type { DatasetUse } from '@modules/data-sources/presentation/dto/dataset-usage-dto';
import enDataSources from '@modules/data-sources/presentation/i18n/en.json';

const push = vi.fn();
vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push }),
}));

const USED_ON: readonly DatasetUse[] = [
  {
    title: 'Home',
    href: '/websites/w1/builder/p1',
    where: 'draft',
    components: [{ label: 'Events grid', href: '/websites/w1/builder/p1?select=n1' }],
  },
];

function renderDialog(usedOn: readonly DatasetUse[], onDelete = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={enDataSources} timeZone="UTC">
      <DeleteWhenUnusedDialog
        open
        name="Events"
        usedOn={usedOn}
        title="Delete Events?"
        description="Gone for good."
        confirmLabel="Delete"
        isPending={false}
        onDelete={onDelete}
        onClose={vi.fn()}
      />
    </NextIntlClientProvider>,
  );
  return onDelete;
}

describe('DeleteWhenUnusedDialog', () => {
  it('does not offer deleting what a page still shows, and leads to the component instead', () => {
    const onDelete = renderDialog(USED_ON);

    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.getByRole('link', { name: /Events grid/ })).toHaveAttribute(
      'href',
      '/websites/w1/builder/p1?select=n1',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open in editor' }));
    expect(push).toHaveBeenCalledWith('/websites/w1/builder/p1?select=n1');
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('lists a saved map that still uses it, leading to the map editor', () => {
    const onDelete = renderDialog([
      { title: 'Stations', href: '/websites/w1/maps/m1', where: 'map', components: [] },
    ]);

    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.getByRole('link', { name: /Stations/ })).toHaveAttribute(
      'href',
      '/websites/w1/maps/m1',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open in editor' }));
    expect(push).toHaveBeenCalledWith('/websites/w1/maps/m1');
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('asks the ordinary question when nothing uses it', () => {
    const onDelete = renderDialog([]);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

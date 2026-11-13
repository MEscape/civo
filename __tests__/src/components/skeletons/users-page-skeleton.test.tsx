import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { UsersPageSkeleton } from '@components/skeletons/users-page-skeleton';

import en from '@i18n/messages/en.json';

describe('UsersPageSkeleton', () => {
  it('announces one loading state while hiding placeholder people and invitations from assistive technology', () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={{ app: en }}>
        <UsersPageSkeleton />
      </NextIntlClientProvider>,
    );
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

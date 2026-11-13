import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuditPageSkeleton } from '@components/skeletons/audit-page-skeleton';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('AuditPageSkeleton', () => {
  it('renders container with aria-busy and loading status', () => {
    render(<AuditPageSkeleton />);

    const container = screen.getByRole('generic', { busy: true });
    expect(container).toBeInTheDocument();
  });
});

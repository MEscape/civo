'use client';

import { Container, PageHeading, Section } from '@components/layout/layout-primitives';
import { Button } from '@components/ui/button';

export interface RouteErrorPanelProps {
  readonly title: string;
  readonly description: string;
  readonly retryLabel: string;
  readonly onRetry: () => void;
}

/**
 * The body of every `error.tsx`. Each route group supplies its own text; the
 * layout and the retry live here once. It never shows the error's message:
 * an unexpected failure is logged where it happened, and its details are not
 * for visitors.
 */
export function RouteErrorPanel({ title, description, retryLabel, onRetry }: RouteErrorPanelProps) {
  return (
    <Container className="max-w-md">
      <Section className="space-y-8 text-center">
        <PageHeading title={title} description={description} />
        <Button type="button" className="w-full" onClick={onRetry}>
          {retryLabel}
        </Button>
      </Section>
    </Container>
  );
}

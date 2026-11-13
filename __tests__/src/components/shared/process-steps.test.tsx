import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OnboardingChecklist, ProcessSteps } from '@components/shared/process-steps';

describe('ProcessSteps', () => {
  it('keeps instructions ordered and exposes the supplied list name', () => {
    render(
      <ProcessSteps
        label="Invitation steps"
        steps={[
          { title: 'Open your email', description: 'Follow the invitation.' },
          { title: 'Choose a password', description: 'Keep it private.' },
        ]}
      />,
    );
    const items = within(screen.getByRole('list', { name: 'Invitation steps' })).getAllByRole(
      'listitem',
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Open your email');
    expect(items[1]).toHaveTextContent('Choose a password');
  });
});

describe('OnboardingChecklist', () => {
  it('counts completion, replaces completed actions, and keeps unfinished guidance', () => {
    render(
      <OnboardingChecklist
        title="Setup"
        progressLabel="1 of 2 done"
        doneLabel="Done"
        steps={[
          {
            id: 'page',
            title: 'Create page',
            description: 'No longer needed',
            isDone: true,
            action: <button>Duplicate page</button>,
          },
          {
            id: 'publish',
            title: 'Publish website',
            description: 'Make it public',
            isDone: false,
            action: <a href="/publish">Publish now</a>,
          },
        ]}
      />,
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '2');
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('No longer needed')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Publish now' })).toHaveAttribute('href', '/publish');
  });

  it('renders an empty checklist with valid progress semantics', () => {
    render(
      <OnboardingChecklist
        title="Setup"
        progressLabel="Nothing to do"
        doneLabel="Done"
        steps={[]}
      />,
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '100');
  });
});

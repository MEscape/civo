import type { ComponentProps } from 'react';

import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { Fact, FactValue } from '@modules/audit/presentation/components/audit-fact-value';
import type { AuditFact } from '@modules/audit/presentation/entries/audit-details';
import en from '@modules/audit/presentation/i18n/en.json';

import { createAppFormatters } from '@i18n/formatters/app-formatters';

vi.mock('@i18n', () => ({
  Link: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));
const t = createTranslator({ locale: 'en', messages: en, namespace: 'audit' });
const format = createAppFormatters('en', 'UTC');
const subject = (values: Partial<Extract<AuditFact, { kind: 'subject' }>> = {}): AuditFact => ({
  field: 'pageId',
  label: null,
  kind: 'subject',
  subject: 'page',
  id: 'page-1',
  view: null,
  number: null,
  ...values,
});

function show(
  fact: AuditFact,
  options: { names?: Readonly<Record<string, string>> | null; showIds?: boolean } = {},
) {
  return render(
    <FactValue
      t={t}
      format={format}
      fact={fact}
      names={options.names ?? null}
      showIds={options.showIds ?? false}
    />,
  );
}

describe('audit fact presentation', () => {
  it('hides unauthorized subject identifiers unless explicitly requested', () => {
    const { unmount } = show(subject());
    expect(screen.getByText(t('details.hidden'))).toBeInTheDocument();
    expect(screen.queryByText('page-1')).not.toBeInTheDocument();
    unmount();
    show(subject(), { showIds: true });
    expect(screen.getByText('page-1').tagName).toBe('CODE');
  });

  it('distinguishes gone subjects, named subjects, numbered releases and unnamed links', () => {
    const { unmount } = show(subject({ view: { state: 'gone' } }));
    expect(screen.getByText(t('details.gone'))).toBeInTheDocument();
    unmount();
    show(subject({ view: { state: 'found', name: 'Home page', href: '/pages/home' } }));
    expect(screen.getByRole('link', { name: 'Home page' })).toHaveAttribute('href', '/pages/home');
  });

  it.each([null, 3])(
    'names a release with number %s when its authorized view has no name',
    (number) => {
      show(
        subject({ subject: 'release', number, view: { state: 'found', name: null, href: null } }),
      );
      expect(
        screen.getByText(number === null ? t('details.view') : t('details.release', { number })),
      ).toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    },
  );

  it.each([
    { names: null, expected: t('actors.member') },
    { names: {}, expected: t('actors.formerMember') },
    { names: { 'page-1': 'Ada' }, expected: 'Ada' },
  ])('uses the permitted member label $expected', ({ names, expected }) => {
    show(subject({ subject: 'member' }), { names });
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it.each([true, false])('translates boolean %s', (value) => {
    show({ field: 'enabled', label: null, kind: 'boolean', value });
    expect(screen.getByText(t(value ? 'details.yes' : 'details.no'))).toBeInTheDocument();
  });

  it('formats numbers and renders code as literal text', () => {
    const { unmount } = show({ field: 'count', label: null, kind: 'number', value: 1234 });
    expect(screen.getByText('1,234')).toBeInTheDocument();
    unmount();
    show({ field: 'errorCode', label: null, kind: 'code', value: 'service.unavailable' });
    expect(screen.getByText('service.unavailable').tagName).toBe('CODE');
  });

  it('shows both recognized and unknown changed field names without dropping new vocabulary', () => {
    show({
      field: 'changed',
      label: null,
      kind: 'list',
      items: [
        { text: 'name', key: 'details.changed.name' },
        { text: 'futureField', key: null },
      ],
    });
    expect(screen.getByText(t('details.changed.name'))).toBeInTheDocument();
    expect(screen.getByText('futureField')).toBeInTheDocument();
  });

  it.each([null, 'success'] as const)('translates known values with tone %s', (tone) => {
    show({
      field: 'outcome',
      label: null,
      kind: 'value',
      value: 'details.values.outcome.ok',
      tone,
    });
    expect(screen.getByText(t('details.values.outcome.ok'))).toBeInTheDocument();
  });

  it('escapes untrusted text instead of interpreting it as markup', () => {
    const text = '<img src=x onerror=alert(1)>';
    show({ field: 'note', label: null, kind: 'text', value: text });
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('keeps a detail label and value in a semantic description list', () => {
    render(
      <dl>
        <Fact label="Count">
          <span>3</span>
        </Fact>
      </dl>,
    );
    expect(screen.getByRole('term')).toHaveTextContent('Count');
    expect(screen.getByRole('definition')).toHaveTextContent('3');
  });
});

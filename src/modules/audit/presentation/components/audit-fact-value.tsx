import type { ReactNode } from 'react';

import { ArrowRight } from '@components/icons/icons';
import { Badge } from '@components/ui/badge';

import { Link } from '@i18n';

import type { AuditFact } from '../entries/audit-details';
import type { AppFormatters, AuditTranslator } from '../translation/translator';

type SubjectFact = Extract<AuditFact, { kind: 'subject' }>;
type Names = Readonly<Record<string, string>> | null;

/** A page, data set or release an entry names: its name as a link where the reader may go, else named, gone, or not theirs to see. */
function SubjectView({
  t,
  fact,
  showIds,
}: {
  readonly t: AuditTranslator;
  readonly fact: SubjectFact;
  readonly showIds: boolean;
}) {
  const { view } = fact;
  if (view === null) {
    return showIds ? (
      <code className="rounded-token-sm border border-border bg-surface px-1.5 py-0.5 font-mono text-xs break-all">
        {fact.id}
      </code>
    ) : (
      <span className="text-copy-muted">{t('details.hidden')}</span>
    );
  }
  if (view.state === 'gone') {
    return <Badge variant="muted">{t('details.gone')}</Badge>;
  }
  const text =
    view.name ??
    (fact.number === null ? t('details.view') : t('details.release', { number: fact.number }));
  return view.href === null ? (
    text
  ) : (
    <Link
      href={view.href}
      className="inline-flex items-center gap-1 font-medium text-copy underline-offset-4 hover:underline"
    >
      {text}
      <ArrowRight className="size-3.5 text-copy-muted" aria-hidden="true" />
    </Link>
  );
}

/** A thing an entry names: a member by name, anything else through its view. */
function SubjectValue({
  t,
  fact,
  names,
  showIds,
}: {
  readonly t: AuditTranslator;
  readonly fact: SubjectFact;
  readonly names: Names;
  readonly showIds: boolean;
}) {
  if (fact.subject === 'member') {
    return names?.[fact.id] ?? t(names === null ? 'actors.member' : 'actors.formerMember');
  }
  return <SubjectView t={t} fact={fact} showIds={showIds} />;
}

/** One value of an entry's details, as its kind reads best. */
export function FactValue({
  t,
  format,
  fact,
  names,
  showIds,
}: {
  readonly t: AuditTranslator;
  readonly showIds: boolean;
  readonly format: AppFormatters;
  readonly fact: AuditFact;
  readonly names: Names;
}) {
  switch (fact.kind) {
    case 'subject':
      return <SubjectValue t={t} fact={fact} names={names} showIds={showIds} />;
    case 'value':
      return fact.tone === null ? (
        t(fact.value)
      ) : (
        <Badge variant={fact.tone}>{t(fact.value)}</Badge>
      );
    case 'list':
      return (
        <ul className="flex flex-wrap gap-1">
          {fact.items.map(({ text, key }) => (
            <li key={text}>
              <Badge variant="outline">{key === null ? text : t(key)}</Badge>
            </li>
          ))}
        </ul>
      );
    case 'bytes':
      return <span className="tabular-nums">{format.bytes(fact.value)}</span>;
    case 'number':
      return <span className="tabular-nums">{format.number(fact.value)}</span>;
    case 'boolean':
      return t(fact.value ? 'details.yes' : 'details.no');
    case 'code':
      return (
        <code className="rounded-token-sm border border-border bg-surface px-1.5 py-0.5 font-mono text-xs">
          {fact.value}
        </code>
      );
    case 'text':
      return fact.value;
  }
}

/** A labelled value of the details list. */
export function Fact({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-xs text-copy-muted">{label}</dt>
      <dd className="break-words text-sm text-copy">{children}</dd>
    </div>
  );
}

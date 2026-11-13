'use client';

import { useTranslations } from '@i18n/client';

import { SERVICE_PARTS } from '../../forms/service-steps';
import { useServiceSummaries } from '../../hooks/use-service-summaries';
import { SectionOverview } from '../shared/section-overview';

import type { ResourceOptionDto } from '../../dto/service-dto';
import type { ServicePartKey } from '../../forms/service-steps';
import type { ServiceFormValues } from '../../schemas/service-schema';

/** How a part of the service is edited: an address (the overview) or a handler (the wizard's review). */
export type ServicePartAction =
  | { readonly hrefs: Readonly<Record<ServicePartKey, string>> }
  | { readonly onSelect: (part: ServicePartKey) => void }
  | undefined;

export interface ServiceSummaryRowsProps {
  /** What the service is set to, read from the data or from the form: never typed by hand. */
  readonly values: ServiceFormValues;
  /** The resources the service can name, to say what it uses and how long it holds each. */
  readonly resources: readonly ResourceOptionDto[];
  readonly action: ServicePartAction;
  /** The label of the rows list for assistive technology. */
  readonly label: string;
  /** The parts to list, in order; all of them unless the screen has no way to edit one (no resources to choose from). */
  readonly parts?: readonly ServicePartKey[];
  /** Numbers the parts ("1 · Allgemein") as the overview does. */
  readonly isNumbered?: boolean;
}

/**
 * The four parts of a service as rows, each with what is set today and its own way in. It serves the
 * overview (links) and the review step (handlers) alike, so the words never differ between them.
 */
export function ServiceSummaryRows({
  values,
  resources,
  action,
  label,
  parts = SERVICE_PARTS,
  isNumbered = false,
}: ServiceSummaryRowsProps) {
  const t = useTranslations('booking');
  const summary = useServiceSummaries(values, resources);
  const title = (part: ServicePartKey) =>
    isNumbered
      ? `${SERVICE_PARTS.indexOf(part) + 1} · ${t(`services.parts.${part}`)}`
      : t(`services.parts.${part}`);
  const rowAction = (part: ServicePartKey) => {
    if (action === undefined) {
      return undefined;
    }
    const edit = t('services.edit');
    return 'hrefs' in action
      ? { label: edit, href: action.hrefs[part] }
      : {
          label: edit,
          onSelect: () => {
            action.onSelect(part);
          },
        };
  };

  return (
    <SectionOverview
      label={label}
      rows={parts.map((part) => ({
        key: part,
        title: title(part),
        summary: summary[part],
        action: rowAction(part),
      }))}
    />
  );
}

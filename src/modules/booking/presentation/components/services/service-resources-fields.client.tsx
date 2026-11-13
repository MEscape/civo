'use client';

import { useId } from 'react';

import { Controller } from 'react-hook-form';

import { FieldMessage } from '@components/shared/field';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { removeAt, replaceAt } from '@lib/utils';

import { FormSection } from '../shared/form-section';

import { ServiceResourceRow } from './service-resource-row.client';

import type { ResourceNeed } from './service-resource-row.client';
import type { ResourceOptionDto } from '../../dto/service-dto';
import type { ServiceFormValues } from '../../schemas/service-schema';
import type { UseFormReturn } from 'react-hook-form';

export interface ServiceResourcesFieldsProps {
  readonly form: UseFormReturn<ServiceFormValues>;
  /** The resources the location can assign. Employees are not among them: they are the qualification. */
  readonly resources: readonly ResourceOptionDto[];
  /** Where a new resource of this location is made; leaving asks before unsaved work is lost. */
  readonly createHref: string;
  readonly errorText: (code: string | undefined) => string | undefined;
}

/**
 * The physical resources of this location, each with one choice for the service: not needed, needed
 * (an appointment is offered only while it is free) or used when free. Every resource of the place is
 * a row, so there is nothing to add or remove, and the wizard has this step only where there are any
 * (making one would lose what was typed). The employee is not a row: it is the next step's question.
 */
export function ServiceResourcesFields({
  form,
  resources,
  createHref,
  errorText,
}: ServiceResourcesFieldsProps) {
  const t = useTranslations('booking');
  const id = useId();
  const { errors } = form.formState;

  return (
    <Controller
      control={form.control}
      name="resources"
      render={({ field }) => {
        const links = field.value;
        const known = new Set(resources.map((resource) => resource.id));
        // A resource the service still names but the location can no longer assign stays visible, so it can be dropped.
        const rows = [
          ...resources.map((resource) => ({ resourceId: resource.id, resource })),
          ...links
            .filter((link) => !known.has(link.resourceId))
            .map((link) => ({ resourceId: link.resourceId, resource: undefined })),
        ];
        const needOf = (resourceId: string): ResourceNeed => {
          const link = links.find((candidate) => candidate.resourceId === resourceId);
          if (link === undefined) {
            return 'none';
          }
          return link.isRequired ? 'required' : 'optional';
        };
        const change = (resourceId: string, need: ResourceNeed) => {
          const index = links.findIndex((candidate) => candidate.resourceId === resourceId);
          if (need === 'none') {
            field.onChange(index < 0 ? links : removeAt(links, index));
            return;
          }
          const link = { resourceId, isRequired: need === 'required' };
          field.onChange(index < 0 ? [...links, link] : replaceAt(links, index, link));
        };

        return (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <FormSection
              title={t('services.resources.title')}
              description={t('services.resources.question')}
            >
              {rows.length === 0 ? (
                <NoResources id={id} createHref={createHref} />
              ) : (
                <ul
                  aria-label={t('services.resources.listLabel')}
                  className="divide-y divide-border overflow-hidden rounded-token border border-border bg-surface"
                >
                  {rows.map(({ resourceId, resource }) => (
                    <ServiceResourceRow
                      key={resourceId}
                      id={`${id}-${resourceId}`}
                      resourceId={resourceId}
                      need={needOf(resourceId)}
                      resource={resource}
                      errorMessage={errorText(
                        errors.resources?.[
                          links.findIndex((link) => link.resourceId === resourceId)
                        ]?.resourceId?.message,
                      )}
                      onNeedChange={(need) => {
                        change(resourceId, need);
                      }}
                    />
                  ))}
                </ul>
              )}
              <FieldMessage
                id={`${id}-resources-error`}
                message={errorText(errors.resources?.message)}
              />
            </FormSection>

            <FormSection title={t('services.resources.explainTitle')}>
              <dl className="space-y-3 rounded-token border border-border bg-canvas p-4 text-sm">
                <div className="space-y-0.5">
                  <dt className="font-medium text-copy">
                    {t('services.resources.needs.required')}
                  </dt>
                  <dd className="text-copy-muted">{t('services.resources.requiredHint')}</dd>
                </div>
                <div className="space-y-0.5">
                  <dt className="font-medium text-copy">
                    {t('services.resources.needs.optional')}
                  </dt>
                  <dd className="text-copy-muted">{t('services.resources.optionalHint')}</dd>
                </div>
                <div className="space-y-0.5">
                  <dt className="font-medium text-copy">{t('services.resources.employeeTitle')}</dt>
                  <dd className="text-copy-muted">{t('services.resources.employeeNote')}</dd>
                </div>
              </dl>
            </FormSection>
          </div>
        );
      }}
    />
  );
}

/** Only reached when a single part is edited: the wizard has no resources step without resources. */
function NoResources({ id, createHref }: { readonly id: string; readonly createHref: string }) {
  const t = useTranslations('booking');
  return (
    <div className="space-y-3">
      <p role="status" className="text-sm text-copy-muted">
        {t('services.resources.noneAvailable')}
      </p>
      <Link
        href={createHref}
        aria-describedby={`${id}-create-why`}
        className={buttonVariants({ variant: 'outline' })}
      >
        {t('services.resources.create')}
      </Link>
      <p id={`${id}-create-why`} className="text-xs text-copy-muted">
        {t('services.resources.createHint')}
      </p>
    </div>
  );
}

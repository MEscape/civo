'use client';

import { useState } from 'react';

import { ComboboxField } from '@components/shared/combobox-field';
import { useReportUnsavedChanges } from '@components/shared/unsaved-changes-guard';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { setTeamServicesAction } from '../../actions/set-team-services-action';
import { useErrorText } from '../../hooks/use-error-text';
import { useSaveForm } from '../../hooks/use-save-form';
import { teamServicesSchema } from '../../schemas/team-services-schema';
import { FormErrorSummary } from '../shared/form-error-summary';

import type { TeamDto, TeamMemberDto } from '../../dto/setup-dto';

export interface TeamMemberServicesProps {
  readonly websiteId: string;
  readonly member: TeamMemberDto;
  readonly services: TeamDto['services'];
}

const SHOWN_AT_FIELD = ['offeredServiceIds'] as const;

/**
 * The services one employee offers, chosen from those offered at their
 * location: how a manager puts somebody on a service nobody offers yet. The
 * employee is told on their own calendar that somebody else changed this.
 */
export function TeamMemberServices({ websiteId, member, services }: TeamMemberServicesProps) {
  const t = useTranslations('booking');
  const [offered, setOffered] = useState<readonly string[]>(member.offeredServiceIds);
  const form = useSaveForm({
    schema: teamServicesSchema,
    save: setTeamServicesAction,
    onSaved: () => undefined,
  });
  const errorText = useErrorText(form.errors);
  const isDirty =
    JSON.stringify([...offered].sort()) !== JSON.stringify([...member.offeredServiceIds].sort());
  useReportUnsavedChanges(isDirty);

  const available = services.filter(
    (service) => member.locationId !== null && service.locationIds.includes(member.locationId),
  );

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium text-copy">{t('team.servicesTitle')}</h3>
      {available.length === 0 ? (
        <p className="text-sm text-copy-muted">{t('team.noServicesAtLocation')}</p>
      ) : (
        <>
          <ComboboxField
            selectionMode="multiple"
            id={`team-services-${member.id}`}
            label={t('team.servicesLabel')}
            hint={t('team.servicesHint')}
            placeholder={t('own.servicesPlaceholder')}
            error={errorText('offeredServiceIds')}
            options={available.map((service) => ({ value: service.id, label: service.name }))}
            values={offered.filter((id) => available.some((service) => service.id === id))}
            emptyText={t('form.noMatches')}
            removeText={(label) => t('form.removeValue', { label })}
            onValuesChange={setOffered}
          />
          <FormErrorSummary errors={form.errors} shownAtField={SHOWN_AT_FIELD} />
          <Button
            type="button"
            variant="outline"
            disabled={form.isPending || !isDirty}
            onClick={() => {
              form.submit({ websiteId, resourceId: member.id, offeredServiceIds: offered });
            }}
          >
            {form.isPending ? t('form.saving') : t('team.saveServices')}
          </Button>
        </>
      )}
    </section>
  );
}

import { CheckboxField } from '@components/shared/checkbox-field';
import { TextField } from '@components/shared/text-field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { RESOURCE_TYPES, SERVICE_LIMITS } from '../../../application/contracts/booking-constraints';
import { DEFAULT_REQUIREMENT } from '../../drafts/service-draft';
import { RESOURCE_TYPE_MESSAGE_KEYS } from '../../messages/message-keys';
import { FormSection } from '../shared/form-section';
import { NumberField } from '../shared/number-field';
import { OptionSelectField } from '../shared/option-select-field';

import type { RequirementDraft } from '../../drafts/service-draft';
import type { ResourceDto } from '../../dto/setup-dto';

interface RequirementRowProps {
  readonly idPrefix: string;
  readonly requirement: RequirementDraft;
  readonly resources: readonly ResourceDto[];
  readonly isRemovable: boolean;
  readonly onChange: (patch: Partial<RequirementDraft>) => void;
  readonly onRemove: () => void;
}

function RequirementRow({
  idPrefix,
  requirement,
  resources,
  isRemovable,
  onChange,
  onRemove,
}: RequirementRowProps) {
  const t = useTranslations('booking');
  const candidates = resources.filter((resource) => resource.type === requirement.resourceType);

  return (
    <div className="space-y-3 rounded-token border border-border p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <OptionSelectField
          id={`${idPrefix}-type`}
          label={t('services.requirementType')}
          value={requirement.resourceType}
          options={RESOURCE_TYPES.map((kind) => ({
            value: kind,
            label: t(RESOURCE_TYPE_MESSAGE_KEYS[kind]),
          }))}
          onValueChange={(resourceType) => {
            onChange({ resourceType, resourceIds: [] });
          }}
        />
        <TextField
          id={`${idPrefix}-skills`}
          label={t('services.requirementSkills')}
          hint={t('services.requirementSkillsHint')}
          value={requirement.skills}
          onChange={(event) => {
            onChange({ skills: event.target.value });
          }}
        />
        <NumberField
          id={`${idPrefix}-count`}
          label={t('services.requirementCount')}
          value={requirement.count}
          min={1}
          max={SERVICE_LIMITS.requirementCountMax}
          onChange={(count) => {
            onChange({ count: count ?? 1 });
          }}
        />
      </div>
      {candidates.length > 0 && (
        <fieldset className="space-y-1">
          <legend className="text-xs font-medium text-copy-muted">
            {t('services.requirementPool')}
          </legend>
          <p className="text-xs text-copy-muted">{t('services.requirementPoolHint')}</p>
          {candidates.map((resource) => (
            <CheckboxField
              key={resource.id}
              id={`${idPrefix}-res-${resource.id}`}
              label={resource.name}
              checked={requirement.resourceIds.includes(resource.id)}
              onChange={(event) => {
                onChange({
                  resourceIds: event.target.checked
                    ? [...requirement.resourceIds, resource.id]
                    : requirement.resourceIds.filter((value) => value !== resource.id),
                });
              }}
            />
          ))}
        </fieldset>
      )}
      {isRemovable && (
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          {t('services.removeRequirement')}
        </Button>
      )}
    </div>
  );
}

export interface RequirementsSectionProps {
  readonly idPrefix: string;
  readonly requirements: readonly RequirementDraft[];
  readonly resources: readonly ResourceDto[];
  readonly onChange: (next: readonly RequirementDraft[]) => void;
}

/** The resources a service needs: one row per requirement, optionally pinned to a pool. */
export function RequirementsSection({
  idPrefix,
  requirements,
  resources,
  onChange,
}: RequirementsSectionProps) {
  const t = useTranslations('booking');

  return (
    <FormSection
      title={t('services.sections.resources')}
      description={t('services.sections.resourcesHint')}
    >
      {requirements.map((requirement, index) => (
        <RequirementRow
          // Rows have no identity of their own: they are edited and removed by position.
          // eslint-disable-next-line react/no-array-index-key -- see above
          key={`${idPrefix}-req-${index}`}
          idPrefix={`${idPrefix}-req-${index}`}
          requirement={requirement}
          resources={resources}
          isRemovable={requirements.length > 1}
          onChange={(patch) => {
            onChange(
              requirements.map((existing, position) =>
                position === index ? { ...existing, ...patch } : existing,
              ),
            );
          }}
          onRemove={() => {
            onChange(requirements.filter((_, position) => position !== index));
          }}
        />
      ))}
      {requirements.length < SERVICE_LIMITS.requirementsMax && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onChange([...requirements, DEFAULT_REQUIREMENT]);
          }}
        >
          {t('services.addRequirement')}
        </Button>
      )}
    </FormSection>
  );
}

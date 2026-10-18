import { ComboboxField } from '@components/shared/combobox-field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { RESOURCE_TYPES, SERVICE_LIMITS } from '../../../application/contracts/booking-constraints';
import { DEFAULT_REQUIREMENT } from '../../drafts/service-draft';
import { skillChoices } from '../../drafts/skill-key';
import { RESOURCE_TYPE_MESSAGE_KEYS } from '../../messages/message-keys';
import { FormSection } from '../shared/form-section';
import { NumberField } from '../shared/number-field';
import { OptionSelectField } from '../shared/option-select-field';

import type { RequirementDraft } from '../../drafts/service-draft';
import type { ResourceOption } from '../../dto/setup-dto';

interface RequirementRowProps {
  readonly idPrefix: string;
  readonly requirement: RequirementDraft;
  readonly resources: readonly ResourceOption[];
  readonly isRemovable: boolean;
  readonly onChange: (patch: Partial<RequirementDraft>) => void;
  readonly onRemove: () => void;
}

/** The capabilities resources of one type already have: the only ones a requirement can ask for. */
function skillsOfType(resources: readonly ResourceOption[]): readonly string[] {
  return [...new Set(resources.flatMap((resource) => resource.skills))].sort();
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <OptionSelectField
          id={`${idPrefix}-type`}
          label={t('services.requirementType')}
          value={requirement.resourceType}
          options={RESOURCE_TYPES.filter(
            (kind) =>
              kind === 'employee' ||
              kind === requirement.resourceType ||
              resources.some((resource) => resource.type === kind),
          ).map((kind) => ({
            value: kind,
            label: t(RESOURCE_TYPE_MESSAGE_KEYS[kind]),
          }))}
          onValueChange={(resourceType) => {
            // Capabilities and the pool belong to the type: neither carries over to another.
            onChange({ resourceType, resourceIds: [], skills: [] });
          }}
        />
        <NumberField
          id={`${idPrefix}-count`}
          label={t('services.requirementCount')}
          hint={t('services.requirementCountHint')}
          value={requirement.count}
          min={1}
          max={SERVICE_LIMITS.requirementCountMax}
          onChange={(count) => {
            onChange({ count: count ?? 1 });
          }}
        />
        <ComboboxField
          selectionMode="multiple"
          id={`${idPrefix}-skills`}
          label={t('services.requirementSkills')}
          hint={t('services.requirementSkillsHint')}
          options={skillChoices(skillsOfType(candidates), requirement.skills)}
          values={requirement.skills}
          emptyText={t('services.requirementSkillsEmpty')}
          removeText={(label) => t('form.removeValue', { label })}
          onValuesChange={(skills) => {
            onChange({ skills });
          }}
        />
        <ComboboxField
          selectionMode="multiple"
          id={`${idPrefix}-pool`}
          label={t('services.requirementPool')}
          hint={t('services.requirementPoolHint')}
          options={candidates.map((resource) => ({ value: resource.id, label: resource.name }))}
          values={requirement.resourceIds}
          emptyText={t('services.requirementPoolEmpty')}
          removeText={(label) => t('form.removeValue', { label })}
          onValuesChange={(resourceIds) => {
            onChange({ resourceIds });
          }}
        />
      </div>
      {isRemovable && (
        <Button type="button" variant="destructive-ghost" size="sm" onClick={onRemove}>
          {t('services.removeRequirement')}
        </Button>
      )}
    </div>
  );
}

export interface RequirementsSectionProps {
  readonly idPrefix: string;
  readonly requirements: readonly RequirementDraft[];
  /** The resources that can serve the place the service is made at; others are not offered. */
  readonly resources: readonly ResourceOption[];
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
      {resources.every((resource) => resource.type === 'employee') && (
        <p className="text-sm text-copy-muted">{t('services.requirementsNoEquipment')}</p>
      )}
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

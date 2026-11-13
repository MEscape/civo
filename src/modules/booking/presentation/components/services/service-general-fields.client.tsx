'use client';

import { useId } from 'react';

import { Controller } from 'react-hook-form';

import { TextField } from '@components/shared/field';

import { useTranslations } from '@i18n/client';

import { SERVICE_LIMITS } from '../../../application/contracts/booking-constraints';
import { AdvancedNote } from '../shared/advanced-note.client';
import { FormSection } from '../shared/form-section';
import { SuggestField } from '../shared/suggest-field.client';
import { SwitchField } from '../shared/switch-field.client';
import { TagField } from '../shared/tag-field.client';
import { TextAreaField } from '../shared/text-area-field.client';

import type { ServiceFormValues } from '../../schemas/service-schema';
import type { UseFormReturn } from 'react-hook-form';

/** One column of the step: its title and three rows, laid on the rows of the grid both columns sit in. */
const COLUMN = 'lg:row-span-4 lg:grid lg:grid-rows-subgrid lg:gap-y-4 lg:space-y-0';

export interface ServiceGeneralFieldsProps {
  readonly form: UseFormReturn<ServiceFormValues>;
  /** The categories already in use, offered to choose from or add to. */
  readonly categories: readonly string[];
  /** Turns an error code into the current language. */
  readonly errorText: (code: string | undefined) => string | undefined;
  /** The service exists: switching it off here leaves its bookings as they are (the dialog is for reviewing them). */
  readonly isExisting: boolean;
}

/** What a service is: its name, the text a citizen reads, its category, what to bring, and whether it runs and takes online bookings. */
export function ServiceGeneralFields({
  form,
  categories,
  errorText,
  isExisting,
}: ServiceGeneralFieldsProps) {
  const t = useTranslations('booking');
  const id = useId();
  const { errors } = form.formState;

  return (
    <div className="space-y-8">
      {/* Three rows shared by both columns, so a field and the one beside it start on the same line whatever the hints under them take. */}
      <div className="grid gap-x-8 gap-y-8 lg:grid-cols-2">
        <FormSection title={t('services.general.sectionAbout')} className={COLUMN} isRowGroup>
          <TextField
            id={`${id}-name`}
            label={t('services.general.name')}
            hint={t('services.general.nameHint')}
            error={errorText(errors.name?.message)}
            {...form.register('name')}
          />
          <TextAreaField
            id={`${id}-description`}
            label={t('services.general.description')}
            hint={t('services.general.descriptionHint')}
            error={errorText(errors.description?.message)}
            {...form.register('description')}
          />
          <Controller
            control={form.control}
            name="category"
            render={({ field }) => (
              <SuggestField
                id={`${id}-category`}
                label={t('services.general.category')}
                hint={t('services.general.categoryHint')}
                placeholder={t('services.general.categoryPlaceholder')}
                suggestions={categories}
                value={field.value}
                onValueChange={field.onChange}
                createText={(value) => t('services.general.categoryCreate', { value })}
                emptyText={t('services.general.categoryEmpty')}
                error={errorText(errors.category?.message)}
              />
            )}
          />
        </FormSection>

        <FormSection title={t('services.general.sectionAppointment')} className={COLUMN} isRowGroup>
          <Controller
            control={form.control}
            name="documents"
            render={({ field }) => (
              <TagField
                id={`${id}-documents`}
                label={t('services.general.documents')}
                hint={t('services.general.documentsHint')}
                placeholder={t('services.general.documentsPlaceholder')}
                emptyText={t('services.general.documentsEmpty')}
                createText={(value) => t('services.general.documentsCreate', { value })}
                removeText={(value) => t('services.general.documentsRemove', { value })}
                values={field.value}
                onValuesChange={(values) => {
                  field.onChange([...values]);
                }}
                error={errorText(
                  errors.documents?.message ??
                    errors.documents?.find?.((item) => item?.message !== undefined)?.message,
                )}
              />
            )}
          />
          <TextAreaField
            id={`${id}-instructions`}
            label={t('services.general.instructions')}
            hint={t('services.general.instructionsHint', { max: SERVICE_LIMITS.instructionsMax })}
            error={errorText(errors.instructions?.message)}
            {...form.register('instructions')}
          />
          <AdvancedNote
            id={`${id}-note`}
            title={t('services.general.advanced')}
            titleHint={t('services.general.advancedHint')}
            label={t('services.general.internalNote')}
            hint={t('services.general.internalNoteHint')}
            error={errorText(errors.internalNote?.message)}
            {...form.register('internalNote')}
          />
        </FormSection>
      </div>

      {/* Last, so the note that appears when one is switched off moves nothing below it. */}
      <FormSection title={t('services.general.sectionOffer')}>
        <div className="grid gap-4 md:grid-cols-2 md:items-start">
          <div className="rounded-token border border-border bg-surface p-4">
            <Controller
              control={form.control}
              name="isOnlineBookable"
              render={({ field }) => (
                <SwitchField
                  id={`${id}-online`}
                  label={t('services.general.onlineBookable')}
                  hint={t('services.general.onlineBookableHint')}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
          <div className="rounded-token border border-border bg-surface p-4">
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <SwitchField
                  id={`${id}-active`}
                  label={t('services.general.active')}
                  hint={t('services.general.activeHint')}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  offNote={
                    isExisting
                      ? t('services.general.inactiveNoteExisting')
                      : t('services.general.inactiveNote')
                  }
                />
              )}
            />
          </div>
        </div>
      </FormSection>
    </div>
  );
}

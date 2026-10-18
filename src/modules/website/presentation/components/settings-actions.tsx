import { FieldMessage } from '@components/shared/field-message';
import { FormPanelFooter, FormSuccess } from '@components/shared/form-panel';
import { Button } from '@components/ui/button';

export interface SettingsActionsProps {
  /** The form's id prefix, for the error message's id. */
  readonly id: string;
  readonly isPending: boolean;
  readonly isDirty: boolean;
  readonly showSaved: boolean;
  readonly savedLabel: string;
  readonly unsavedLabel: string;
  readonly submitLabel: string;
  /** The form-level refusal, translated; `undefined` while there is none. */
  readonly error?: string | undefined;
}

/**
 * The foot of a settings panel: what state the form is in (unsaved, saved,
 * refused) on the left, the save button on the right. Saving is offered only
 * when there is something to save.
 */
export function SettingsActions({
  id,
  isPending,
  isDirty,
  showSaved,
  savedLabel,
  unsavedLabel,
  submitLabel,
  error,
}: SettingsActionsProps) {
  return (
    <FormPanelFooter
      status={
        <>
          {error === undefined && showSaved && <FormSuccess>{savedLabel}</FormSuccess>}
          {error === undefined && isDirty && (
            <p className="flex items-center gap-2 text-copy-muted">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-warning" />
              {unsavedLabel}
            </p>
          )}
          <FieldMessage id={`${id}-form-error`} message={error} className="text-sm" />
        </>
      }
    >
      <Button type="submit" disabled={isPending || !isDirty}>
        {submitLabel}
      </Button>
    </FormPanelFooter>
  );
}

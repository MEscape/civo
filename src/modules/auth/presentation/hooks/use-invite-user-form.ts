'use client';

import { useRef, useState, useTransition } from 'react';
import type { SyntheticEvent } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { useReportUnsavedChanges } from '@hooks/use-unsaved-changes';
import { useWizardSteps } from '@hooks/use-wizard-steps';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';

import { AUTH_VALIDATION_CODES, ROLES } from '../../application/contracts/auth-constraints';
import { inviteUserAction } from '../actions/invite-user-action';
import { MESSAGE_PARAMS, ROLE_MESSAGE_KEYS, messageKeyForCode } from '../messages/message-keys';
import {
  INVITE_STEPS,
  INVITE_STEP_FIELDS,
  PLATFORM_TARGET,
  inviteFormSchema,
} from '../schemas/invite-user-form-schema';

import type { TenantRole } from '../../application/contracts/auth-constraints';
import type { InviteStep, InviteValues } from '../schemas/invite-user-form-schema';
import type { inviteUserSchema } from '../schemas/user-admin-schema';
import type { z } from 'zod';

type InviteInput = z.infer<typeof inviteUserSchema>;

export interface InviteUserFormOptions {
  readonly step: InviteStep;
  /** The users list: where the person returns after sending, told that it was sent. */
  readonly listHref: string;
  readonly initialRole: TenantRole;
  /** The website invited to; inside one website it is that website and cannot change. */
  readonly initialTenantId?: string | undefined;
  /** Across websites: the websites the person may invite to. Absent inside one website. */
  readonly websites?: ReadonlyArray<{ readonly id: string; readonly name: string }> | undefined;
  readonly canInvitePlatformAdmin?: boolean;
}

/**
 * The invite wizard's state: the address, target and role over three steps, what the server
 * answered, and the send. After sending, the person goes back to the list, which says so and
 * shows the invitation among the open ones; the form keeps nothing.
 */
export function useInviteUserForm({
  step,
  listHref,
  initialRole,
  initialTenantId,
  websites,
  canInvitePlatformAdmin = false,
}: InviteUserFormOptions) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const submitting = useRef(false);
  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: { email: '', role: initialRole, tenantId: initialTenantId ?? '' },
  });
  useReportUnsavedChanges(form.formState.isDirty);
  const wizard = useWizardSteps({ steps: INVITE_STEPS, fields: INVITE_STEP_FIELDS, step, form });
  const tenantId = useWatch({ control: form.control, name: 'tenantId' });

  const errorText = (code: string | undefined) =>
    code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);

  /** What is sent, or `null` (with the field marked) for a target this person may not choose. */
  function toInput(values: InviteValues): InviteInput | null {
    if (websites !== undefined) {
      if (canInvitePlatformAdmin && values.tenantId === PLATFORM_TARGET) {
        return { scope: 'platform', email: values.email };
      }
      if (!websites.some((website) => website.id === values.tenantId)) {
        form.setError('tenantId', { message: AUTH_VALIDATION_CODES.tenantInvalid });
        wizard.showErrors(['tenantId']);
        return null;
      }
    }
    return { scope: 'website', email: values.email, role: values.role, tenantId: values.tenantId };
  }

  function send(values: InviteValues) {
    const input = toInput(values);
    if (input === null || submitting.current) {
      return;
    }
    submitting.current = true;
    setFormErrorCode(null);
    startTransition(async () => {
      try {
        const result = await inviteUserAction(input);
        if (!result.ok) {
          setFormErrorCode(applyActionError(result.error, form.setError));
          wizard.showErrors(Object.keys(result.error.fieldErrors ?? {}));
          return;
        }
        form.reset();
        router.replace(`${listHref}?invited=1`);
      } finally {
        submitting.current = false;
      }
    });
  }

  return {
    form,
    wizard,
    isPending,
    errorText,
    formError: errorText(formErrorCode ?? undefined),
    isPlatformTarget: websites !== undefined && tenantId === PLATFORM_TARGET,
    roleOptions: ROLES.map((role) => ({ value: role, label: t(ROLE_MESSAGE_KEYS[role]) })),
    targetOptions: [
      ...(websites !== undefined && canInvitePlatformAdmin
        ? [{ value: PLATFORM_TARGET, label: t('users.invite.platformTarget') }]
        : []),
      ...(websites ?? []).map((website) => ({ value: website.id, label: website.name })),
    ],
    /** The chosen target's name, for the review. */
    targetName:
      tenantId === PLATFORM_TARGET
        ? t('users.invite.platformTarget')
        : websites?.find((website) => website.id === tenantId)?.name,
    onSubmit: (event: SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!wizard.isLast) {
        void wizard.goNext();
        return;
      }
      void form.handleSubmit(send, (invalid) => {
        wizard.showErrors(Object.keys(invalid));
      })(event);
    },
  };
}

import { useState } from 'react';
import type { SyntheticEvent } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useReportUnsavedChanges } from '@hooks/use-unsaved-changes';

import { useTranslations } from '@i18n/client';

import { messagesByPath } from '../forms/field-errors';
import { toTeamMemberFormValues } from '../forms/team-form-values';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { teamMemberFormSchema } from '../schemas/team-schema';

import { useTeamMemberSubmit } from './use-team-member-submit';

import type { TeamFormMode } from './use-team-member-submit';
import type { TeamMemberDto } from '../dto/team-dto';
import type { TeamMemberFormValues } from '../schemas/team-schema';

/**
 * The form of an employee's calendar: one react-hook-form value checked by the rules the server
 * applies, what it started from (the change is judged against it), the error codes in the words of
 * the current language, and the submission. Reports unsaved work to the surrounding guard.
 */
export function useTeamMemberForm(mode: TeamFormMode, member: TeamMemberDto, savedHref: string) {
  const t = useTranslations('booking');
  const [initial] = useState(() => toTeamMemberFormValues(member));
  const form = useForm<TeamMemberFormValues>({
    resolver: zodResolver(teamMemberFormSchema),
    defaultValues: initial,
  });
  useReportUnsavedChanges(form.formState.isDirty);
  const submission = useTeamMemberSubmit({
    mode,
    member,
    initial,
    savedHref,
    setError: form.setError,
  });

  /** The messages under a part of the form's errors, by path inside it, already translated. */
  const translateErrors = (subtree: unknown): Record<string, string> =>
    Object.fromEntries(
      Object.entries(messagesByPath(subtree)).map(([path, code]) => [
        path,
        t(messageKeyForCode(code), MESSAGE_PARAMS),
      ]),
    );
  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    void form.handleSubmit(submission.submit)(event);
  };

  return { form, submission, translateErrors, onSubmit };
}

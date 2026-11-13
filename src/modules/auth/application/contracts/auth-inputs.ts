import type { MailLocale } from '../../domain/ports/auth-mailer.port';

export type {
  PasswordResetInput,
  PasswordResetRequestInput,
  SignInInput,
  SignUpInput,
} from '../../domain/models/credentials';

/** The target determines permission and offered role; website offers never grant platform access. */
type InviteScope =
  | { readonly kind: 'website'; readonly role: string; readonly tenantId?: string | undefined }
  | { readonly kind: 'platform' };

export interface InviteUserInput {
  readonly email: string;
  readonly scope: InviteScope;
  /** The language of the invitation mail: the inviting administrator's. */
  readonly locale: MailLocale;
}

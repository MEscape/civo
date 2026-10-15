import type { InfrastructureAppError } from '@lib/errors';
import { ResultAsync, errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { invitationFailed } from '../../domain/errors/auth-errors';
import { EMAIL_PATTERN, normalizeEmail } from '../../domain/models/credentials';
import { toActorId } from '../../domain/models/ids';
import { INVITATION_LIFETIME_MS } from '../../domain/models/invitation';
import { PLATFORM_ADMIN_ROLE } from '../../domain/models/role';
import { PLATFORM_TENANT_ID } from '../../domain/models/tenant';
import { MAX_BOOTSTRAP_INVITATIONS_SCANNED } from '../auth-limits';

import type { MailLocale } from '../../domain/ports/auth-mailer.port';
import type { BootstrapDependencies } from '../auth-dependencies';

export interface InviteBootstrapAdminsInput {
  /** The deployment's own list of platform administrators (`AUTH_PLATFORM_ADMIN_EMAILS`). */
  readonly emails: readonly string[];
  readonly locale: MailLocale;
}

/** What one start did, per address, so the caller can log it without naming anyone. */
export interface BootstrapOutcome {
  readonly invited: number;
  /** Already has an account, or already holds an open invitation. */
  readonly skipped: number;
  readonly failed: number;
}

const SYSTEM_ACTOR = toActorId('system');

/**
 * Sign-up is closed and invitations need an administrator, so the first
 * administrator of a deployment cannot be invited by anyone. This is the way
 * in: at start, every address the deployment's own configuration names as a
 * platform administrator, and that has no account yet, is mailed a single-use
 * link to create one. The list lives in the server's environment, which only
 * the operator controls, so no request can add an address to it.
 *
 * It is safe to run at every start: an address with an account, or with a
 * still-open invitation, is skipped, so a restart does not mail again; an
 * invitation that expired unused is replaced. Accepting it creates the account
 * and makes it a platform administrator (`AcceptInvitation`). A link nobody
 * received is revoked, like any invitation.
 *
 * @authorization system Runs at server start for addresses the deployment's configuration names; no request and no actor are involved.
 */
export class InviteBootstrapAdmins {
  constructor(private readonly deps: BootstrapDependencies) {}

  execute(
    input: InviteBootstrapAdminsInput,
  ): AppResultAsync<BootstrapOutcome, InfrastructureAppError> {
    const unique = [...new Set(input.emails.map((email) => email.trim().toLowerCase()))].filter(
      (email) => email !== '',
    );
    // One address at a time: the number is tiny and the mail relay should not be hit in parallel.
    return ResultAsync.fromSafePromise(
      unique.reduce<Promise<BootstrapOutcome>>(
        async (total, email) => {
          const totalSoFar = await total;
          const result = await this.inviteOne(email, input.locale);
          if (result.isErr()) {
            return { ...totalSoFar, failed: totalSoFar.failed + 1 };
          }
          return result.value === 'invited'
            ? { ...totalSoFar, invited: totalSoFar.invited + 1 }
            : { ...totalSoFar, skipped: totalSoFar.skipped + 1 };
        },
        Promise.resolve({ invited: 0, skipped: 0, failed: 0 }),
      ),
    );
  }

  private inviteOne(
    address: string,
    locale: MailLocale,
  ): AppResultAsync<'invited' | 'skipped', InfrastructureAppError> {
    const { directory, invitations, tokens, mailer, audit, clock } = this.deps;
    const email = normalizeEmail(address);
    if (!EMAIL_PATTERN.test(email)) {
      return errAsync(
        invitationFailed('an address in the platform administrator list is not valid'),
      );
    }
    const now = clock.now();

    return directory.findByEmail(email).andThen((existing) => {
      if (existing !== null) {
        return okAsync<'invited' | 'skipped', InfrastructureAppError>('skipped');
      }
      return invitations
        .listOpen(PLATFORM_TENANT_ID, now, { page: 1, pageSize: MAX_BOOTSTRAP_INVITATIONS_SCANNED })
        .andThen((open) => {
          if (open.items.some((invitation) => invitation.email === email)) {
            return okAsync<'invited' | 'skipped', InfrastructureAppError>('skipped');
          }
          const issued = tokens.issue();
          return invitations
            .create({
              tenantId: PLATFORM_TENANT_ID,
              email,
              role: PLATFORM_ADMIN_ROLE,
              invitedBy: SYSTEM_ACTOR,
              expiresAt: new Date(now.getTime() + INVITATION_LIFETIME_MS),
              tokenHash: issued.hash,
            })
            .andThen((invitation) =>
              mailer
                .sendInvitation({ to: email, token: issued.token, locale })
                .orElse((error) =>
                  invitations
                    .revoke(invitation.id, PLATFORM_TENANT_ID)
                    .andThen(() => errAsync<undefined, InfrastructureAppError>(error)),
                )
                .map((): 'invited' => {
                  audit.record({
                    type: 'invitation.created',
                    actorId: SYSTEM_ACTOR,
                    tenantId: PLATFORM_TENANT_ID,
                    invitationId: invitation.id,
                  });
                  return 'invited';
                }),
            );
        });
    });
  }
}

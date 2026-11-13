import type { ConflictAppError, InfrastructureAppError } from '@lib/errors';
import { ResultAsync, errAsync, okAsync } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';
import { unique } from '@lib/utils';

import { AUTH_ERROR_CODES, invitationFailed } from '../../domain/errors/auth-errors';
import { EMAIL_PATTERN, normalizeEmail } from '../../domain/models/credentials';
import { BOOTSTRAP_INVITER_ID } from '../../domain/models/invitation';
import { PLATFORM_ADMIN_ROLE } from '../../domain/models/role';
import { PLATFORM_TENANT_ID } from '../../domain/models/tenant';
import { issueInvitation } from '../services/issue-invitation';

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

type InviteOutcome = 'invited' | 'skipped';
type InviteOneError = InfrastructureAppError | ConflictAppError;

const NO_OUTCOME: BootstrapOutcome = { invited: 0, skipped: 0, failed: 0 };

function tally(
  total: BootstrapOutcome,
  result: AppResult<InviteOutcome, InviteOneError>,
): BootstrapOutcome {
  if (result.isErr()) {
    return { ...total, failed: total.failed + 1 };
  }
  return result.value === 'invited'
    ? { ...total, invited: total.invited + 1 }
    : { ...total, skipped: total.skipped + 1 };
}

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
 * @audit-exempt Successful invitation creation is audited by the shared issueInvitation service; startup reports per-address failures.
 * @authorization system Runs at server start for addresses the deployment's configuration names; no request and no actor are involved.
 */
export class InviteBootstrapAdmins {
  constructor(private readonly deps: BootstrapDependencies) {}

  execute(
    input: InviteBootstrapAdminsInput,
  ): AppResultAsync<BootstrapOutcome, InfrastructureAppError> {
    const addresses = unique(input.emails.map((email) => normalizeEmail(email))).filter(
      (email) => email !== '',
    );
    // One address at a time: the number is tiny and the mail relay should not be hit in parallel.
    return ResultAsync.fromSafePromise(
      (async () => {
        let total = NO_OUTCOME;
        for (const email of addresses) {
          total = tally(total, await this.inviteOne(email, input.locale));
        }
        return total;
      })(),
    );
  }

  /** `email` is already normalised. */
  private inviteOne(
    email: string,
    locale: MailLocale,
  ): AppResultAsync<InviteOutcome, InviteOneError> {
    if (!EMAIL_PATTERN.test(email)) {
      return errAsync(
        invitationFailed('an address in the platform administrator list is not valid'),
      );
    }
    return this.deps.directory
      .findByEmail(email)
      .andThen((existing): AppResultAsync<InviteOutcome, InviteOneError> =>
        existing === null
          ? this.inviteUnlessOpen(email, locale)
          : okAsync<InviteOutcome>('skipped'),
      );
  }

  private inviteUnlessOpen(
    email: string,
    locale: MailLocale,
  ): AppResultAsync<InviteOutcome, InviteOneError> {
    return (
      issueInvitation(this.deps, {
        tenantId: PLATFORM_TENANT_ID,
        email,
        role: PLATFORM_ADMIN_ROLE,
        invitedBy: BOOTSTRAP_INVITER_ID,
        locale,
      })
        .map((): InviteOutcome => 'invited')
        // The atomic creation check also covers another process issuing the same offer during startup.
        .orElse((error): AppResultAsync<InviteOutcome, InviteOneError> =>
          error.code === AUTH_ERROR_CODES.invitationPending ? okAsync('skipped') : errAsync(error),
        )
    );
  }
}

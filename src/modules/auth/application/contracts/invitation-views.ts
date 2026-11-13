/**
 * Account setup leaves the invitation open until its verified owner explicitly accepts it.
 * `already_member`: the signed-in account already held the offered scope; nothing was granted or widened.
 */
export interface AcceptInvitationOutcome {
  readonly status: 'verify_account' | 'accepted' | 'already_member';
}

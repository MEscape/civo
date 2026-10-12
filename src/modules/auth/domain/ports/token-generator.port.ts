/** An emailed single-use secret: the token goes to the invitee, only the hash is kept. */
export interface IssuedToken {
  readonly token: string;
  readonly hash: string;
}

export interface TokenGenerator {
  issue(): IssuedToken;
  /** The hash a presented token is looked up by. */
  hash(token: string): string;
}

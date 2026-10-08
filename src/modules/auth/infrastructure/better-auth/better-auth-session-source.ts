import type { BetterAuthInstance } from './create-auth';

/** The only two facts about a session that this module uses. */
export interface SessionSnapshot {
  readonly user: { readonly id: string };
  readonly session: { readonly createdAt: Date };
}

/**
 * Narrows what the actor provider needs from Better Auth to one function
 * that returns only those facts. Taking this instead of the whole `auth`
 * object lets tests supply a fake session source without a database, and
 * keeps provider types from spreading past the adapter files.
 */
export interface SessionSource {
  getSession(input: { headers: Headers }): Promise<SessionSnapshot | null>;
}

/** Adapts a Better Auth instance to the narrow `SessionSource`. */
export function sessionSourceFrom(instance: BetterAuthInstance): SessionSource {
  return {
    async getSession(input) {
      const result = await instance.api.getSession(input);
      if (result === null) {
        return null;
      }
      return {
        user: { id: result.user.id },
        session: { createdAt: result.session.createdAt },
      };
    },
  };
}

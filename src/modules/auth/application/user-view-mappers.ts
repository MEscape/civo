import type { AccountView } from './contracts/user-views';
import type { DirectoryUser } from '../domain/ports/user-directory.port';

/** The account fields every people listing shows; whether the person administers the platform is decided by the caller. */
export function toAccountView(user: DirectoryUser, isPlatformAdmin: boolean): AccountView {
  return {
    id: user.id,
    name: user.name,
    image: user.image ?? null,
    email: user.email,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    isPlatformAdmin,
  };
}

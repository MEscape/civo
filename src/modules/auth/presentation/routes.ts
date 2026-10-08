/** Where a successful sign-in lands when no safe `returnTo` was given. */
export const DEFAULT_RETURN_PATH = '/';

/** Revalidating the root layout refreshes everything that depends on who is signed in. */
export const ROOT_LAYOUT_PATH = '/';

/**
 * Routes of the module, in one place so actions, components and the
 * composition root (which tells the provider where emailed links lead)
 * cannot drift apart. Paths carry no locale prefix: add it here if the app
 * routes by locale.
 */
export const authRoutes = {
  signIn: (returnTo?: string) =>
    returnTo === undefined
      ? '/sign-in'
      : `/sign-in?${new URLSearchParams({ returnTo }).toString()}`,
  signUp: () => '/sign-up',
  forgotPassword: () => '/forgot-password',
  /** Landing page of the emailed reset link; Better Auth appends `?token=`. */
  resetPassword: () => '/reset-password',
  /** Landing page after the emailed verification link; Better Auth appends `?error=` on failure. */
  emailVerified: () => '/email-verified',
  api: () => '/api/auth',
} as const;

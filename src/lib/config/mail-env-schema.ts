import { z } from 'zod';

import { booleanFlag, httpUrl, integerSetting } from './env-primitives';
import { refineEnv } from './env-rules';

import type { EnvRule } from './env-rules';

/** Mailpit's SMTP port, the local development default. */
const DEFAULT_SMTP_PORT = 1025;
const MAX_TCP_PORT = 65_535;
const DEFAULT_RESEND_API_URL = 'https://api.resend.com/emails';

const mailEnvObjectSchema = z.object({
  /** `none` sends nothing: a mail the application needs fails loudly, an optional one is skipped with a warning. */
  MAIL_PROVIDER: z.enum(['none', 'resend', 'smtp']).default('none'),
  /** Sender of every outgoing mail. Required with any provider but `none`. */
  MAIL_FROM: z.string().min(1).optional(),

  /** Resend only. */
  MAIL_API_KEY: z.string().min(1).optional(),
  MAIL_API_URL: httpUrl.default(DEFAULT_RESEND_API_URL),

  /** SMTP only. */
  MAIL_SMTP_HOST: z.string().min(1).optional(),
  MAIL_SMTP_PORT: integerSetting(DEFAULT_SMTP_PORT, { max: MAX_TCP_PORT }),
  /** `true` connects over TLS from the first byte (typically port 465). */
  MAIL_SMTP_SECURE: booleanFlag(false),
  /** Credentials of an authenticated relay, set together. A local catcher (Mailpit) needs neither. */
  MAIL_SMTP_USER: z.string().min(1).optional(),
  MAIL_SMTP_PASSWORD: z.string().min(1).optional(),
});

/** The mail variables, validated and typed. */
export type MailEnv = z.infer<typeof mailEnvObjectSchema>;

/** Variables that only mean something with one provider; `MAIL_API_URL` is left out, it has a default. */
const PROVIDER_VARIABLES = {
  resend: ['MAIL_API_KEY'],
  smtp: ['MAIL_SMTP_HOST', 'MAIL_SMTP_USER', 'MAIL_SMTP_PASSWORD'],
} as const satisfies Record<'resend' | 'smtp', ReadonlyArray<keyof MailEnv>>;

/**
 * Outgoing mail, shared by every module that sends some.
 * What a provider needs is required as soon as that provider is chosen,
 * whether or not authentication is enabled. Settings for a provider that is not chosen are an
 * error rather than silently ignored: a forgotten `MAIL_PROVIDER` must not look like a working
 * deployment that sends nothing.
 */
export const mailEnvRules: ReadonlyArray<EnvRule<MailEnv>> = [
  ...(['resend', 'smtp'] as const).flatMap((provider) =>
    PROVIDER_VARIABLES[provider].map((name): EnvRule<MailEnv> => ({
      path: name,
      violated: (env) => env.MAIL_PROVIDER !== provider && env[name] !== undefined,
      message: `${name} is set but MAIL_PROVIDER is not "${provider}".`,
    })),
  ),
  {
    path: 'MAIL_API_KEY',
    violated: (env) => env.MAIL_PROVIDER === 'resend' && !env.MAIL_API_KEY,
    message: 'MAIL_API_KEY is required when MAIL_PROVIDER is "resend".',
  },
  {
    path: 'MAIL_SMTP_HOST',
    violated: (env) => env.MAIL_PROVIDER === 'smtp' && !env.MAIL_SMTP_HOST,
    message: 'MAIL_SMTP_HOST is required when MAIL_PROVIDER is "smtp".',
  },
  {
    path: 'MAIL_SMTP_USER',
    violated: (env) =>
      env.MAIL_PROVIDER === 'smtp' && !env.MAIL_SMTP_USER && Boolean(env.MAIL_SMTP_PASSWORD),
    message: 'MAIL_SMTP_USER and MAIL_SMTP_PASSWORD must be set together.',
  },
  {
    path: 'MAIL_SMTP_PASSWORD',
    violated: (env) =>
      env.MAIL_PROVIDER === 'smtp' && Boolean(env.MAIL_SMTP_USER) && !env.MAIL_SMTP_PASSWORD,
    message: 'MAIL_SMTP_USER and MAIL_SMTP_PASSWORD must be set together.',
  },
  {
    path: 'MAIL_FROM',
    violated: (env) => env.MAIL_PROVIDER !== 'none' && !env.MAIL_FROM,
    message: 'MAIL_FROM is required when MAIL_PROVIDER is not "none".',
  },
];

/** The mail variables with their cross-variable rules; composed into the server schema. */
export const mailEnvSchema = mailEnvObjectSchema.superRefine(refineEnv(mailEnvRules));

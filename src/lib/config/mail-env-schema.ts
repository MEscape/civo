import { z } from 'zod';

/** Mailpit's SMTP port, the local development default. */
const DEFAULT_SMTP_PORT = 1025;
const DEFAULT_RESEND_API_URL = 'https://api.resend.com/emails';

const mailEnvObjectSchema = z.object({
  /** `none` sends nothing: sign-in mail fails loudly, booking mail is skipped with a warning. */
  MAIL_PROVIDER: z.enum(['none', 'resend', 'smtp']).default('none'),
  MAIL_FROM: z.string().min(1).optional(),
  MAIL_API_KEY: z.string().min(1).optional(),
  MAIL_API_URL: z.url().default(DEFAULT_RESEND_API_URL),
  MAIL_SMTP_HOST: z.string().min(1).optional(),
  MAIL_SMTP_PORT: z.coerce.number().int().positive().default(DEFAULT_SMTP_PORT),
  MAIL_SMTP_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

/**
 * Outgoing mail, shared by every module that sends some (sign-in, bookings).
 * What a provider needs is required as soon as that provider is chosen,
 * whether or not authentication is enabled.
 */
export const mailEnvSchema = mailEnvObjectSchema.superRefine((env, ctx) => {
  if (env.MAIL_PROVIDER === 'resend' && !env.MAIL_API_KEY) {
    ctx.addIssue({
      code: 'custom',
      path: ['MAIL_API_KEY'],
      message: 'MAIL_API_KEY is required when MAIL_PROVIDER is "resend".',
    });
  }
  if (env.MAIL_PROVIDER === 'smtp' && !env.MAIL_SMTP_HOST) {
    ctx.addIssue({
      code: 'custom',
      path: ['MAIL_SMTP_HOST'],
      message: 'MAIL_SMTP_HOST is required when MAIL_PROVIDER is "smtp".',
    });
  }
  if (env.MAIL_PROVIDER !== 'none' && !env.MAIL_FROM) {
    ctx.addIssue({
      code: 'custom',
      path: ['MAIL_FROM'],
      message: 'MAIL_FROM is required when MAIL_PROVIDER is not "none".',
    });
  }
});

export type MailEnv = z.infer<typeof mailEnvSchema>;

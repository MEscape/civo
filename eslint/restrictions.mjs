import { SOURCE_FILES } from './shared.mjs';
import {
  CLOCK_READS,
  ERROR_DETAILS,
  FORM_DATA,
  PROCESS_ENV,
  RANDOMNESS,
  UI_PRIMITIVES,
} from './syntax.mjs';

/**
 * Locale-aware wrappers: application code never imports next-intl or the
 * locale-unaware Next.js navigation primitives directly. `src/i18n/**` IS
 * the wrapper layer and is exempt.
 */
const LOCALE_WRAPPERS = {
  paths: [
    {
      name: 'next-intl',
      message:
        "Import translation hooks from '@i18n/client' (components) or '@i18n/server' (server code), not 'next-intl'.",
    },
    {
      name: 'next-intl/server',
      message: "Import server translation helpers from '@i18n/server', not 'next-intl/server'.",
    },
    {
      name: 'next/link',
      message: "Use the locale-aware `Link` from '@i18n'; 'next/link' drops the locale prefix.",
    },
    {
      name: 'next/navigation',
      importNames: ['redirect', 'usePathname', 'useRouter'],
      message:
        "Use the locale-aware `redirect`, `usePathname` and `useRouter` from '@i18n'. (`notFound`, `useSearchParams`, … are fine from 'next/navigation'.)",
    },
  ],
  patterns: [
    {
      group: ['next-intl/*', '!next-intl/server'],
      message:
        "Locale plumbing ('next-intl/navigation', 'next-intl/routing') belongs in src/i18n only.",
    },
  ],
};

/** One spelling per module alias keeps imports greppable (and the boundary rules simple). */
const MODULE_ALIAS = {
  patterns: [
    {
      group: ['@/modules', '@/modules/**'],
      message: "Import modules through the '@modules/<name>' alias, not '@/modules/…'.",
    },
  ],
};

const MODULE_PACKAGES = {
  paths: [
    {
      name: 'neverthrow',
      message:
        "Use '@lib/result' (the project's wrapper: AppResult, AppResultAsync, fromThrowable*) instead of importing neverthrow.",
    },
  ],
};

/** Components format through the request locale (docs/rules/i18n.md), never by handing a locale to @lib/utils. */
const LOCALE_FORMATTERS = [
  'formatDate',
  'formatDateTime',
  'formatRelativeTime',
  'formatNumber',
  'formatPercent',
  'formatMoney',
  'formatBytes',
];
const FORMATTERS = {
  paths: ['@lib/utils', '@lib/utils/date', '@lib/utils/number'].map((name) => ({
    name,
    importNames: LOCALE_FORMATTERS,
    message:
      "Format through getAppFormatters ('@i18n/server') or useAppFormatters ('@i18n/client'): they bind the request locale and time zone.",
  })),
};

const merge = (...configs) => ({
  paths: configs.flatMap((c) => c.paths ?? []),
  patterns: configs.flatMap((c) => c.patterns ?? []),
});

/**
 * Package/global/syntax restrictions that no architecture rule owns.
 * Layer and module boundaries are NOT here: `architecture/layer-imports` is
 * the single mechanism for those (see docs/rules/boundaries.md).
 */
export const restrictions = [
  {
    files: SOURCE_FILES,
    // src/proxy.ts is the framework's request entry point: it must build the next-intl middleware itself.
    ignores: ['src/i18n/**', 'src/proxy.ts'],
    rules: {
      'no-restricted-imports': ['error', merge(LOCALE_WRAPPERS, MODULE_ALIAS)],
    },
  },
  {
    files: ['src/modules/**/*.{ts,tsx}'],
    ignores: ['src/i18n/**'],
    rules: {
      'no-restricted-imports': ['error', merge(LOCALE_WRAPPERS, MODULE_ALIAS, MODULE_PACKAGES)],
    },
  },

  // --- process.env only in src/lib/config/env.ts ----------------------------
  {
    files: SOURCE_FILES,
    ignores: ['src/lib/config/env.ts'],
    rules: { 'no-restricted-syntax': ['error', PROCESS_ENV] },
  },
  // --- domain: no clock reads, no randomness, no process ---------------------
  // Parsing a date (`new Date(iso)`) is deterministic and allowed; READING the clock is not.
  {
    files: ['src/modules/*/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'process',
          message:
            'Domain code must not read process.env; import from @lib/config instead (AI_RULES.md §11).',
        },
      ],
      'no-restricted-syntax': ['error', PROCESS_ENV, ...CLOCK_READS, ...RANDOMNESS],
    },
  },
  // --- application: same determinism rules, no HTTP objects, no raw FormData ---
  {
    files: ['src/modules/*/application/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'Response',
          message:
            'HTTP responses are a presentation concern; return an AppResult (AI_RULES.md §6).',
        },
        {
          name: 'Request',
          message:
            'HTTP requests are a presentation concern; take validated input (AI_RULES.md §6).',
        },
        {
          name: 'process',
          message:
            'Application code must not read process.env; import from @lib/config instead (AI_RULES.md §11).',
        },
      ],
      'no-restricted-syntax': ['error', PROCESS_ENV, FORM_DATA, ...CLOCK_READS, ...RANDOMNESS],
    },
  },
  // --- presentation & pages: approved UI primitives --------------------------
  {
    files: ['src/modules/*/presentation/**/*.tsx', 'src/app/**/*.tsx'],
    rules: { 'no-restricted-syntax': ['error', PROCESS_ENV, ...UI_PRIMITIVES] },
  },
  // --- error boundaries never show the failure itself ------------------------
  {
    files: [
      'src/app/**/error.tsx',
      'src/app/**/global-error.tsx',
      'src/components/shared/route-error-panel.tsx',
    ],
    rules: { 'no-restricted-syntax': ['error', PROCESS_ENV, ...UI_PRIMITIVES, ERROR_DETAILS] },
  },
  // --- UI formats through the request locale ---------------------------------
  {
    files: ['src/modules/*/presentation/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        merge(LOCALE_WRAPPERS, MODULE_ALIAS, MODULE_PACKAGES, FORMATTERS),
      ],
    },
  },
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', merge(LOCALE_WRAPPERS, MODULE_ALIAS, FORMATTERS)],
    },
  },
];

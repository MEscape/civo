/**
 * Selector fragments for `no-restricted-syntax`.
 *
 * ESLint keeps only the LAST matching block's value for a rule key, so each
 * file group below receives ONE array assembled from these constants. Never
 * add a second `no-restricted-syntax` block for an overlapping glob.
 */
export const PROCESS_ENV = {
  selector: "MemberExpression[object.name='process'][property.name='env']",
  message:
    'Do not access process.env directly; import serverEnv or publicEnv from @lib/config (AI_RULES.md §11).',
};

/** docs/rules/typescript.md: domain and application code do not read the clock or randomness; they receive them. */
export const CLOCK_READS = [
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message:
      'Do not read the clock (Date.now()) in domain/application code; inject a Clock port (AI_RULES.md §1).',
  },
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message:
      'Do not read the clock (new Date()) in domain/application code; inject a Clock port (AI_RULES.md §1).',
  },
  {
    selector: "CallExpression[callee.object.name='performance'][callee.property.name='now']",
    message:
      'Do not read the clock (performance.now()) in domain/application code; inject a Clock port.',
  },
];

export const RANDOMNESS = [
  {
    selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
    message:
      'Do not read randomness (Math.random()) in domain/application code; inject a Random/IdGenerator port (AI_RULES.md §1).',
  },
  {
    selector:
      "CallExpression[callee.object.name='crypto'][callee.property.name=/^(randomUUID|getRandomValues)$/]",
    message:
      'Do not read randomness (crypto.*) in domain/application code; inject an IdGenerator/Random port.',
  },
];

/** Focused tests silently skip the rest of the suite; they must never be committed. */
export const FOCUSED_TESTS = [
  {
    selector:
      "CallExpression[callee.property.name='only'][callee.object.name=/^(it|test|describe|suite)$/]",
    message: 'Remove `.only`: a committed focused test silently skips the rest of the suite.',
  },
  {
    selector: 'CallExpression[callee.name=/^(fit|fdescribe|ftest)$/]',
    message: 'Remove the focused test helper: it silently skips the rest of the suite.',
  },
];

export const FORM_DATA = {
  selector: "TSTypeReference[typeName.name='FormData']",
  message: 'Do not pass raw FormData beyond the presentation boundary (AI_RULES.md §6).',
};

/**
 * Approved UI primitives: a raw element where a shared component exists is a
 * duplicated primitive (and bypasses its accessibility behavior). Only
 * primitives that exist in src/components/ui are listed.
 */
export const UI_PRIMITIVES = [
  {
    selector: "JSXOpeningElement[name.name='button']",
    message:
      "Use `Button` from '@components/ui/button' instead of a raw <button> (consistent focus, disabled and loading behavior).",
  },
  {
    selector: "JSXOpeningElement[name.name='select']",
    message: "Use `Select` from '@components/ui/select' instead of a raw <select>.",
  },
  {
    selector: "JSXOpeningElement[name.name='a']",
    message:
      "Use the locale-aware `Link` from '@i18n' for app navigation, or `ContentLink` from '@components/ui/content-link' for a target that comes from content (external URL, mailto:, tel:, a published site's path).",
  },
];

/** docs/rules/nextjs.md: an error boundary never shows the raw failure to visitors. */
export const ERROR_DETAILS = {
  selector: "MemberExpression[object.name='error'][property.name=/^(message|stack|cause)$/]",
  message:
    'An error boundary shows translated generic text; never render the error message, stack or cause (docs/rules/nextjs.md).',
};

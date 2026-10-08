import civoTokens from './plugins/civo-tokens.mjs';
import { TEST_FILES } from './shared.mjs';

/**
 * Design-token conformance (AI_RULES.md §19). Mirrors
 * __tests__/src/lib/design-tokens.test.ts so violations surface in the editor.
 * Allowed paths mirror ALLOWED_PATHS in that test.
 */
export const tokens = [
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/app/globals.css', 'src/modules/website/domain/**', 'src/data/**', ...TEST_FILES],
    plugins: { 'civo-tokens': civoTokens },
    rules: {
      'civo-tokens/no-raw-palette-color': 'error',
      'civo-tokens/no-literal-white-black': 'error',
      'civo-tokens/no-arbitrary-civo-token': 'error',
      'civo-tokens/no-brand-text-color': 'error',
      'civo-tokens/no-raw-hex': 'error',
      'civo-tokens/no-raw-color-fn': 'error',
      'civo-tokens/no-arbitrary-size': 'error',
      'civo-tokens/no-screen-height': 'error',
    },
  },
];

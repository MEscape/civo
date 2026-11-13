import { writeFile } from 'node:fs/promises';

import { DEFAULT_WEBSITE_THEME } from '../../src/modules/website/domain/models/website-theme';
import { themeToCssVariables } from '../../src/modules/website/presentation/theme/theme-css';

const brands = [
  { name: 'wuerzburg', primary: '#8F1838' },
  { name: 'light', primary: '#FFFFE0' },
  { name: 'dark', primary: '#080B14' },
  { name: 'saturated', primary: '#FFFF00' },
].map(({ name, primary }) => ({
  name,
  tokens: themeToCssVariables({
    ...DEFAULT_WEBSITE_THEME,
    colors: { primary, secondary: '#42554F', accent: '#A76521' },
  }),
}));
await writeFile(
  new URL('../../docs/würzburg/verification/brand-tokens.json', import.meta.url),
  `${JSON.stringify(brands, null, 2)}\n`,
);

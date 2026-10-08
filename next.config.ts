import type { NextConfig } from 'next';

import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Required by the one application cache (`'use cache'` in data-sources). Lifetimes are
  // declared where they are used, so there are no named cache-life profiles here.
  cacheComponents: true,
  // Recommended together with Cache Components: prefetch the static shell of a route, then stream the rest.
  partialPrefetching: true,
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);

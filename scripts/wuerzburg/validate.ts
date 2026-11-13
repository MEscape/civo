import '../../scripts/lib/server-runtime';

import { readWuerzburgManifest } from '../../prisma/seed/wuerzburg-manifest';

const manifest = await readWuerzburgManifest();
process.stdout.write(
  `Validated ${manifest.pages.length} page trees and ${manifest.datasets.length} canonical datasets offline.\n`,
);

import 'dotenv/config';
import { fileURLToPath } from 'node:url';

import { defineConfig as definePostgresConfig } from '@prisma/orm-postgres/config';
import { definePrismaConfig } from 'prisma/config';

export default definePrismaConfig({
  orm: definePostgresConfig({
    // New domain files join automatically. Absolute forward slashes keep tinyglobby working on Windows.
    // Emit artifacts into src/lib/db; the schemas remain the source of truth.
    contract: fileURLToPath(new URL('./prisma/schema/**/*.prisma', import.meta.url)).replaceAll(
      '\\',
      '/',
    ),
    output: './src/lib/db',
    db: {
      connection: process.env['DATABASE_URL']!,
    },
    migrations: {
      dir: './prisma/migrations',
    },
  }),
});

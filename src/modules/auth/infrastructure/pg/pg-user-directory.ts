import type { InfrastructureAppError } from '@lib/errors';
import { offsetOf, toPage } from '@lib/pagination';
import type { Page } from '@lib/pagination';
import { fromThrowableAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { directoryFailed } from '../../domain/errors/auth-errors';
import { toActorId } from '../../domain/models/ids';

import type {
  DirectoryUser,
  UserDirectory,
  UserSearch,
  UserSortField,
} from '../../domain/ports/user-directory.port';
import type { Pool } from 'pg';

interface UserRow {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly emailVerified: boolean;
  readonly createdAt: Date;
  readonly total: string;
}

/** Column per sortable field. Fixed text: a query value never becomes SQL. */
const SORT_COLUMNS = {
  name: 'lower("name")',
  email: 'lower("email")',
  createdAt: '"createdAt"',
} as const satisfies Record<UserSortField, string>;

/** `%`, `_` and `\` in the user's text match themselves instead of acting as wildcards. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

function toDirectoryUser(row: UserRow): DirectoryUser {
  return {
    id: toActorId(row.id),
    email: row.email,
    name: row.name,
    emailVerified: row.emailVerified,
    createdAt: row.createdAt,
  };
}

/**
 * Reads accounts straight from Better Auth's `user` table over the auth pool
 * (Prisma never touches that database). Read-only: accounts are created and
 * changed only through the provider's own API. The caller passes the ids of
 * a tenant's members, so filtering, sorting and paging all happen in SQL on
 * a set bounded by the tenant, with the total from the same statement.
 */
export class PgUserDirectory implements UserDirectory {
  constructor(private readonly getPool: () => Pool) {}

  search(query: UserSearch): AppResultAsync<Page<DirectoryUser>, InfrastructureAppError> {
    if (query.ids.length === 0) {
      return fromThrowableAsync(
        () => Promise.resolve(toPage<DirectoryUser>([], 0, query.page)),
        directoryFailed,
      );
    }
    const direction = query.sort.direction === 'desc' ? 'DESC' : 'ASC';
    const order = `${SORT_COLUMNS[query.sort.field]} ${direction}, "id" ASC`;

    return fromThrowableAsync(async () => {
      const result = await this.getPool().query<UserRow>(
        `SELECT "id", "email", "name", "emailVerified", "createdAt", COUNT(*) OVER() AS "total"
           FROM "user"
          WHERE "id" = ANY($1::text[])
            AND ($2::text IS NULL OR "name" ILIKE $2 OR "email" ILIKE $2)
          ORDER BY ${order}
          LIMIT $3 OFFSET $4`,
        [
          [...query.ids],
          query.text === null ? null : likePattern(query.text),
          query.page.pageSize,
          offsetOf(query.page),
        ],
      );
      const total = result.rows[0] === undefined ? 0 : Number(result.rows[0].total);
      return toPage(result.rows.map(toDirectoryUser), total, query.page);
    }, directoryFailed);
  }

  findByEmail(email: string): AppResultAsync<DirectoryUser | null, InfrastructureAppError> {
    return fromThrowableAsync(async () => {
      const result = await this.getPool().query<UserRow>(
        `SELECT "id", "email", "name", "emailVerified", "createdAt", 1 AS "total"
           FROM "user" WHERE lower("email") = lower($1) LIMIT 1`,
        [email],
      );
      const [row] = result.rows;
      return row === undefined ? null : toDirectoryUser(row);
    }, directoryFailed);
  }
}

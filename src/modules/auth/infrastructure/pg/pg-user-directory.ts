import type { InfrastructureAppError } from '@lib/errors';
import { logger } from '@lib/logger';
import { offsetOf, toPage } from '@lib/pagination';
import type { Page } from '@lib/pagination';
import { errAsync, fromThrowableAsync, okAsync } from '@lib/result';
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

interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly image: string | null;
  readonly emailVerified: boolean;
  readonly createdAt: Date;
}

/**
 * A row of the page query: the count comes with every row. When the requested page is empty, one
 * row remains with every user column null, so callers can still clamp to the last page.
 */
type EmptyUserRecord = { readonly [Column in keyof UserRecord]: null };
type UserPageRow = (UserRecord | EmptyUserRecord) & { readonly total: string };

const directoryLogger = logger.withContext({ module: 'auth.directory' });

function mapDirectoryFailure(cause: unknown): InfrastructureAppError {
  const failure = directoryFailed(cause);
  // Driver messages may quote account data. The result retains its cause; logs carry only our stable code.
  directoryLogger.error('auth.directory_failed', { kind: failure.kind, code: failure.code });
  return failure;
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

function toDirectoryUser(row: UserRecord): DirectoryUser {
  return {
    id: toActorId(row.id),
    email: row.email,
    name: row.name,
    image: row.image ?? null,
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
    if (query.ids !== null && query.ids.length === 0) {
      return okAsync(toPage<DirectoryUser>([], 0, query.page));
    }
    const direction = query.sort.direction === 'desc' ? 'DESC' : 'ASC';
    const order = `${SORT_COLUMNS[query.sort.field]} ${direction}, "id" ASC`;

    return fromThrowableAsync(async () => {
      const result = await this.getPool().query<UserPageRow>(
        `WITH matching AS (
           SELECT "id", "email", "name", "image", "emailVerified", "createdAt"
             FROM "user"
            WHERE ($1::text[] IS NULL OR "id" = ANY($1::text[]))
              AND ($2::text IS NULL OR "name" ILIKE $2 OR "email" ILIKE $2)
         )
         SELECT page.*, totals."total"
           FROM (SELECT COUNT(*) AS "total" FROM matching) totals
           LEFT JOIN LATERAL (
             SELECT * FROM matching ORDER BY ${order} LIMIT $3 OFFSET $4
           ) page ON true
          ORDER BY ${order}`,
        [
          query.ids === null ? null : [...query.ids],
          query.text === null ? null : likePattern(query.text),
          query.page.pageSize,
          offsetOf(query.page),
        ],
      );
      const total = result.rows[0] === undefined ? 0 : Number(result.rows[0].total);
      const users = result.rows.flatMap((row) => (row.id === null ? [] : [toDirectoryUser(row)]));
      return toPage(users, total, query.page);
    }, mapDirectoryFailure);
  }

  findByEmail(email: string): AppResultAsync<DirectoryUser | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        this.getPool().query<UserRecord>(
          `SELECT "id", "email", "name", "image", "emailVerified", "createdAt"
           FROM "user" WHERE lower("email") = lower($1) LIMIT 2`,
          [email],
        ),
      mapDirectoryFailure,
    ).andThen(({ rows }) => {
      if (rows.length > 1) {
        return errAsync(
          mapDirectoryFailure(new Error('More than one account has the normalized email address.')),
        );
      }
      const [row] = rows;
      return okAsync(row === undefined ? null : toDirectoryUser(row));
    });
  }
}

# Development demo accounts

These identities are fictional. All email domains are reserved `example.invalid`. They are created only outside production and only when `AUTH_DATABASE_URL` is configured. Existing identities and passwords are preserved; email collisions with a different identity abort provisioning.

| Login                            | Existing role    | Scope                                  |
| -------------------------------- | ---------------- | -------------------------------------- |
| `platform_admin@example.invalid` | `platform_admin` | Existing `platform` membership scope   |
| `admin@example.invalid`          | `admin`          | `3b0f6f2e-8a51-4c9d-9e27-5d1a7c4b2f80` |
| `editor@example.invalid`         | `editor`         | `3b0f6f2e-8a51-4c9d-9e27-5d1a7c4b2f80` |
| `contributor@example.invalid`    | `contributor`    | `3b0f6f2e-8a51-4c9d-9e27-5d1a7c4b2f80` |
| `viewer@example.invalid`         | `viewer`         | `3b0f6f2e-8a51-4c9d-9e27-5d1a7c4b2f80` |
| `employee@example.invalid`       | `employee`       | `3b0f6f2e-8a51-4c9d-9e27-5d1a7c4b2f80` |

Set `WUERZBURG_DEMO_PASSWORD` to a development-only password of at least 16 characters before first seeding. Otherwise seeding generates a random password in ignored `.env.wuerzburg.local`. Read that local file privately; never paste it into logs, screenshots, tickets or tracked files. All six initial accounts share that generated development password. Changing the environment variable does not rotate existing credentials.

Accounts are email-verified for local review. They are not invitations, suspended users or citizens. Those product states and roles do not currently exist and have not been fabricated. Public browsing and appointment booking use the existing anonymous path. Authentication is stored in a separate database transaction; rerunning repairs a partially completed first seed.

The six exact identity IDs use `wuerzburg-demo-<role>`. Application memberships and auth identities have synthetic provenance in the reference provenance sidecar source. The resource named as a fictional employee is not asserted to be linked to a staff account. Staff assignment/login permission edge cases remain Not Verified.

Browser login and protected landing-page checks passed for all six identities; see [demo-login.json](verification/demo-login.json). Account-by-account write authorization, cross-tenant denials and staff assignments remain **Not Verified**. Booking tests used anonymous fictional customers and do not establish authenticated-role behavior.

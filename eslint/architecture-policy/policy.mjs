/**
 * Central architecture policy.
 *
 * This file is the ONLY place that describes what the module architecture
 * allows. Both the ESLint plugin (`eslint/plugins/architecture`) and
 * the architecture tests (`__tests__/architecture`) read it, so a rule can
 * never drift from the test that double-checks it.
 *
 * A standard business module needs NO entry here: it is governed by the
 * defaults. An entry exists only for a module that legitimately differs, and
 * every entry carries a `reason`, so exceptions stay few, explicit and
 * reviewable (nothing is exempted by file or by rule).
 */

export const LAYERS = /** @type {const} */ ([
  'domain',
  'application',
  'infrastructure',
  'presentation',
]);

/** Shared libraries (`@lib/<name>`) each layer may import. Anything else is reported. */
export const SHARED_LIB_ALLOW = {
  domain: ['errors', 'result', 'utils'],
  application: ['errors', 'result', 'utils'],
  infrastructure: ['errors', 'result', 'utils', 'logger', 'db', 'config'],
  presentation: ['errors', 'result', 'utils', 'actions', 'seo', 'config', 'fonts'],
  // composition.ts, index.ts and module-root files: everything.
  root: null,
};

/**
 * Shared libraries that define a PORT shared by every module (`Clock`). Any layer may
 * `import type` the port; the implementation (`systemClock`) is runtime state and is
 * wired by composition.ts only, so a runtime import from a layer is still reported.
 */
export const SHARED_PORT_LIBS = ['clock'];

/** Packages that may never appear in a layer, regardless of how they are imported. */
export const FORBIDDEN_PACKAGES = {
  domain: [
    /^react($|\/)/,
    /^react-dom($|\/)/,
    /^next($|\/)/,
    /^next-intl($|\/)/,
    /^@prisma\//,
    /^react-hook-form$/,
  ],
  application: [
    /^react($|\/)/,
    /^react-dom($|\/)/,
    /^next($|\/)/,
    /^next-intl($|\/)/,
    /^@prisma\//,
    /^react-hook-form$/,
  ],
};

/** Layers that must never be reachable from a Client Component graph. */
export const SERVER_ONLY_SPECIFIERS = [
  /^server-only$/,
  /^next\/headers$/,
  /^@prisma\//,
  /^@lib\/db($|\/)/,
];

/**
 * Directories a layer may contain (first level below the layer folder).
 * `audit` is the canonical home of audit adapters; `logging` is the
 * established name used by the existing modules and is accepted as an alias
 * so no module has to be renamed (and no unseen import/test broken).
 */
export const LAYER_DIRS = {
  domain: ['errors', 'models', 'ports'],
  // `services` holds logic shared by several use cases (gate helpers, pure decisions); never I/O, never business rules.
  application: ['commands', 'queries', 'contracts', 'services'],
  infrastructure: ['audit', 'logging', 'prisma', 'provisioner'],
  presentation: ['actions', 'cache', 'components', 'dto', 'guards', 'i18n', 'messages', 'schemas'],
};

/**
 * Layers that may hold further sub-folders next to the conventional ones above.
 * Domain areas (`mapping`, `tree`, `rules`), technology adapters (`pg`, `cache`,
 * `connector`) and UI areas (`state`, `dnd`, `theme`) are open-ended by nature,
 * so they are allowed as long as the folder is named for what it contains.
 * `application` stays closed: it is the use-case surface and its shape is the contract.
 */
export const OPEN_LAYERS = ['domain', 'infrastructure', 'presentation'];

/** docs/rules/naming.md: names that say nothing. Rejected for module folders and files. */
export const GENERIC_NAMES = [
  'helper',
  'helpers',
  'misc',
  'common',
  'manager',
  'managers',
  'data',
  'shared',
  'util',
  'utils',
  'stuff',
  'temp',
  'tmp',
];

/** Files that may sit directly in a layer folder (no sub-folder). */
export const LAYER_ROOT_FILES = {
  domain: [],
  application: [
    /^[a-z0-9]+(?:-[a-z0-9]+)*-dependencies\.ts$/,
    /^[a-z0-9]+(?:-[a-z0-9]+)*-limits\.ts$/,
    /^[a-z0-9]+(?:-[a-z0-9]+)*-scope\.ts$/,
    /^[a-z0-9]+(?:-[a-z0-9]+)*-view-mappers\.ts$/,
    /^load-authorized-[a-z0-9]+(?:-[a-z0-9]+)*\.ts$/,
  ],
  infrastructure: [],
  presentation: [/^routes\.ts$/],
};

const KEBAB = '[a-z0-9]+(?:-[a-z0-9]+)*';

/**
 * File-name conventions per folder. A file inside one of these folders that
 * matches none of the patterns is reported by `architecture/module-structure`
 * with the list of accepted shapes. `null` means "any kebab-case file".
 */
export const DIR_FILE_PATTERNS = {
  'domain/errors': [new RegExp(`^${KEBAB}-errors\\.ts$`)],
  'domain/models': null,
  'domain/ports': [new RegExp(`^${KEBAB}\\.(?:port|repository)\\.ts$`)],
  'application/commands': null,
  'application/queries': null,
  // What a contract holds: validation limits, read shapes, request shapes, the editor/session model, a stored snapshot
  // and the cache tags that name what a read depends on. One file per kind, named `<name>-<kind>.ts`.
  'application/contracts': [
    new RegExp(`^${KEBAB}-(?:constraints|views|inputs|model|snapshot|tags)\\.ts$`),
  ],
  'infrastructure/prisma': [
    new RegExp(`^${KEBAB}\\.repository\\.ts$`),
    new RegExp(`^${KEBAB}-record-mapper\\.ts$`),
    // Tenant-scoped starting points shared by repositories (a relation filter, not a repository).
    new RegExp(`^${KEBAB}-ownership\\.ts$`),
  ],
  'infrastructure/audit': [new RegExp(`^${KEBAB}-audit-log\\.ts$`)],
  'infrastructure/logging': [new RegExp(`^${KEBAB}-audit-log\\.ts$`)],
  'infrastructure/provisioner': [new RegExp(`^${KEBAB}-provisioner\\.ts$`)],
  'presentation/actions': [new RegExp(`^${KEBAB}-action\\.ts$`)],
  'presentation/dto': [new RegExp(`^${KEBAB}-dto\\.ts$`)],
  'presentation/schemas': [
    new RegExp(`^${KEBAB}-schema\\.ts$`),
    new RegExp(`^parse-${KEBAB}-input\\.ts$`),
  ],
  'presentation/messages': [/^message-keys\.ts$/],
  'presentation/components': null,
  // <locale>.json holds the text; the module's public API exposes it as en<Module>/de<Module> for src/i18n/locales
  // (directly from the JSON, or through an optional catalog.ts).
  'presentation/i18n': [/^[a-z]{2}(?:-[A-Z]{2})?\.json$/, /^catalog\.ts$/],
  'presentation/guards': null,
  'presentation/cache': null,
  'application/services': null,
};

/** Module-root files every module may contain. */
export const MODULE_ROOT_FILES = ['index.ts', 'client.ts', 'composition.ts'];

/**
 * Module roles. A role switches whole convention groups on or off; it never
 * names a file. Only two roles exist; a module that needs a third one is a
 * signal to discuss the architecture, not to add an exception.
 *
 *  - `business`: the standard module. Commands/queries, a composition.ts,
 *    audited commands, record-mapped repositories.
 *  - `platform`: infrastructure-heavy cross-cutting module (authentication).
 *    Its composition root lives in infrastructure and its public API may
 *    expose the factory of that root.
 */
export const ROLES = {
  business: {
    compositionFile: 'composition.ts',
    requireComposition: true,
    commandsRequireAudit: true,
    repositoriesRequireRecordMapper: true,
    /** `type XId = Brand<..>` requires both `toXId` (stored) and `parseXId` (request). */
    brandParsersRequired: true,
    /**
     * Where `index.ts` (the server-capable entry) may re-export from. Stable error codes, branded ids,
     * contracts, use cases (for cross-module orchestration through an adapter) and presentation are
     * public; infrastructure, repositories and record mappers never are.
     */
    publicApiSources: [
      'composition',
      'application/contracts/',
      'application/commands/',
      'application/queries/',
      'domain/errors/',
      'domain/models/ids',
      'presentation/',
    ],
    /** Where `client.ts` (the browser-safe entry) may re-export from: nothing that reaches the server. */
    clientApiSources: [
      'application/contracts/',
      'domain/errors/',
      'domain/models/ids',
      'presentation/actions/',
      'presentation/components/',
      'presentation/dto/',
      'presentation/routes',
      'presentation/schemas/',
    ],
  },
  platform: {
    compositionFile: 'composition.ts',
    requireComposition: true,
    commandsRequireAudit: true,
    repositoriesRequireRecordMapper: false,
    // Identity ids are minted by the identity provider / membership lookup; no request ever supplies one.
    brandParsersRequired: false,
    publicApiSources: [
      'composition',
      'domain/models/',
      'domain/errors/',
      'application/authorization-service',
      'application/contracts/',
      'application/commands/',
      'application/queries/',
      'presentation/',
    ],
    clientApiSources: [
      'application/contracts/',
      'domain/errors/',
      'domain/models/ids',
      'presentation/actions/',
      'presentation/components/',
      'presentation/dto/',
      'presentation/routes',
      'presentation/schemas/',
    ],
  },
};

/**
 * Modules that differ from the defaults. Standard modules are NOT listed.
 *
 * @type {Record<string, {
 *   role: keyof typeof ROLES,
 *   reason: string,
 *   extraDirs?: Partial<Record<(typeof LAYERS)[number], string[]>>,
 *   extraRootFiles?: Partial<Record<(typeof LAYERS)[number], string[]>>,
 *   compositionFile?: string,
 *   publicApiSources?: string[],
 * }>}
 */
export const MODULE_OVERRIDES = {
  auth: {
    role: 'platform',
    reason:
      'Identity module. Its ids come from the identity provider (no request-side parser) and its repository reads ' +
      'through a row source (no record mapper). The one authorization service lives directly in application/ ' +
      '(nothing else may), and its domain models (Actor, Permission, authorize) are part of the public API.',
    extraRootFiles: { application: ['authorization-service.ts'] },
    publicApiSources: [
      'composition',
      'domain/models/',
      'domain/errors/',
      'application/authorization-service',
      'application/contracts/',
      'application/commands/',
      'application/queries/',
      'presentation/',
    ],
  },
};

/**
 * Modules that are mid-refactor and do not follow the module layout yet. Empty today. Listing one SUSPENDS only the structure family
 * for it (folder/file-name shape, the public-API source check, "index.ts only re-exports") and switches off the listed
 * `relax` rules for its folder; every dependency rule (layers, deep imports, forbidden packages, Prisma and
 * client/server containment) still applies. Each entry needs a reason, and a test fails when an entry is no longer needed,
 * so this list can only shrink. A new module never goes here; it follows the module layout from its first file.
 *
 * @type {Record<string, { reason: string, relax?: string[] }>}
 */
export const LEGACY_MODULES = {};

/**
 * Module cycles that exist today, identified by the SET of modules on the cycle. A cycle not listed here fails the
 * architecture checks; a listed cycle that no longer exists fails them too ("remove it"), so the list only shrinks.
 *
 * Empty today. Add `{ modules: ['a', 'b'], reason: '…' }` only for a cycle you cannot break in the same change.
 *
 * @type {{ modules: string[], reason: string }[]}
 */
export const KNOWN_MODULE_CYCLES = [];

/**
 * Cross-module imports in infrastructure that are allowed in repository /
 * record-mapper files: trusted brand constructors (`toTenantId`, ...) are the
 * documented way to brand a stored value; they are not an integration call.
 */
export const TRUSTED_BRAND_CONSTRUCTOR = /^to[A-Z][A-Za-z0-9]*Id$/;

/**
 * Pure, side-effect-free exports of another module that application code may call at runtime.
 * Anything else a use case needs from a module goes through an infrastructure adapter behind a domain port.
 * Keyed by module name; values are export names.
 */
export const CROSS_MODULE_RUNTIME_ALLOW = {
  // A predicate over an `Actor` value and the permission vocabulary; no I/O, no state.
  auth: ['actorHasPermission'],
};

/**
 * The locale *identifier* is shared vocabulary, not translation: layers other than
 * presentation may reference these names from '@i18n' (translation functions stay forbidden).
 */
export const I18N_VOCABULARY_ALLOW = ['Locale'];
/** Infrastructure that renders per-locale output (e-mail) may also read the locale context. */
export const I18N_INFRASTRUCTURE_ALLOW = ['Locale', 'I18N_CONFIG', 'getLocale'];

/** Domain identifiers: `type XId = Brand<string, 'XId'>` requires `toXId` and `parseXId`. */
export const BRAND_TYPE_NAME = /^[A-Z][A-Za-z0-9]*Id$/;

/** Hard-coded query bound names the `limits-usage` rule treats as limits. */
export const LIMIT_NAME_PATTERN =
  /(?:^|_)(?:LIMIT|PAGE_SIZE|TAKE|BATCH_SIZE|MAX_(?:ITEMS|ROWS|RESULTS|PER_PAGE)|MIN_LIST|MAX_LIST|DEFAULT_LIST)(?:$|_)/;

/** Returns the effective, merged policy for one module (defaults for unlisted modules). */
export function policyFor(moduleName) {
  const override = MODULE_OVERRIDES[moduleName];
  const roleName = override?.role ?? 'business';
  const role = ROLES[roleName];
  return {
    module: moduleName,
    roleName,
    role,
    reason: override?.reason ?? null,
    legacy: LEGACY_MODULES[moduleName] ?? null,
    compositionFile: override?.compositionFile ?? role.compositionFile,
    publicApiSources: override?.publicApiSources ?? role.publicApiSources,
    clientApiSources: override?.clientApiSources ?? role.clientApiSources,
    extraDirs: override?.extraDirs ?? {},
    extraRootFiles: override?.extraRootFiles ?? {},
  };
}

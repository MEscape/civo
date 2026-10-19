/**
 * Cross-file guarantees about rate limiting (docs/architecture/rate-limiting.md): what each module's
 * `application/rate-limits.ts` declares is namespaced, unique, explicit about how it fails, and
 * actually spent by a use case. `architecture/rate-limit-usage` checks one file at a time; these
 * checks need the whole tree. Whether a policy's numbers are valid is checked with the real limiter
 * in `__tests__/architecture/rate-limit-policies.test.ts`.
 */
import { RATE_LIMIT_POLICIES } from './policy.mjs';
import { topLevelClasses, violation, leadingComment } from './project.mjs';

const CLIENT_SUFFIX = '-client';
const NO_LIMIT_TAG = /@rate-limit\s+none\s+\S/;

const literalOf = (properties, name) => {
  const property = properties.find((p) => p.type === 'Property' && p.key.name === name);
  return property?.value.type === 'Literal' ? property.value.value : undefined;
};

/** `export const X_RATE_LIMITS = { key: { … } } as const satisfies …`, read from the syntax tree. */
function declaredPolicies(file) {
  const found = [];
  for (const statement of file.ast.body) {
    if (statement.type !== 'ExportNamedDeclaration') continue;
    for (const declarator of statement.declaration?.declarations ?? []) {
      const name = declarator.id.type === 'Identifier' ? declarator.id.name : null;
      const object = declarator.init?.expression?.expression;
      if (name === null || !RATE_LIMIT_POLICIES.exportName.test(name)) continue;
      if (object?.type !== 'ObjectExpression') continue;
      for (const entry of object.properties) {
        if (entry.type !== 'Property' || entry.value.type !== 'ObjectExpression') continue;
        const { properties } = entry.value;
        found.push({
          exportName: name,
          key: entry.key.name,
          id: literalOf(properties, 'id'),
          onBackendFailure: literalOf(properties, 'onBackendFailure'),
          onUnresolvedClient: literalOf(properties, 'onUnresolvedClient'),
        });
      }
    }
  }
  return found;
}

function policyFiles(project) {
  return project.modules.flatMap((name) => {
    const file = project.files.get(`src/modules/${name}/application/${RATE_LIMIT_POLICIES.file}`);
    return file === undefined ? [] : [{ module: name, file }];
  });
}

function referencedIn(project, moduleName, policiesPath, exportName, key) {
  const pattern = new RegExp(`\\b${exportName}\\.${key}\\b`);
  return [...project.files.values()].some(
    (f) =>
      f.info.area === 'module' &&
      f.info.module === moduleName &&
      f.info.layer === 'application' &&
      f.path !== policiesPath &&
      pattern.test(f.code),
  );
}

/** Every policy the modules declare, read from the syntax tree: the module, its export, key and id. */
export function describeRateLimitPolicies(project) {
  return policyFiles(project).flatMap(({ module: moduleName, file }) =>
    declaredPolicies(file).map((policy) => ({ module: moduleName, ...policy })),
  );
}

export function checkRateLimitPolicies(project) {
  const out = [];
  const idOwners = new Map();
  const failOpen = new Set(RATE_LIMIT_POLICIES.failOpen);

  for (const { module: moduleName, file } of policyFiles(project)) {
    for (const policy of declaredPolicies(file)) {
      const where = `\`${policy.exportName}.${policy.key}\``;
      const { id } = policy;
      if (typeof id !== 'string') continue; // reported by `architecture/rate-limit-usage`

      if (!id.startsWith(`${moduleName}.`)) {
        out.push(
          violation(
            'rate-limits',
            file.path,
            `${where} has id '${id}'. A module's policy ids start with the module's name ('${moduleName}.'), so a counter cannot be shared by accident.`,
          ),
        );
      }
      if (idOwners.has(id)) {
        out.push(
          violation(
            'rate-limits',
            file.path,
            `${where} reuses id '${id}', which ${idOwners.get(id)} already declares. Two policies with one id would share one counter.`,
          ),
        );
      }
      idOwners.set(id, file.path);

      if (policy.onBackendFailure !== 'deny' && policy.onBackendFailure !== 'allow') {
        out.push(
          violation(
            'rate-limits',
            file.path,
            `${where} must say how it fails: \`onBackendFailure: 'deny'\` or \`'allow'\`, as a literal.`,
          ),
        );
      }
      if (policy.onBackendFailure === 'allow') {
        if (!failOpen.has(id)) {
          out.push(
            violation(
              'rate-limits',
              file.path,
              `${where} fails open, which is a reviewed decision. Add '${id}' to RATE_LIMIT_POLICIES.failOpen in eslint/policy/policy.mjs, or let it fail closed.`,
            ),
          );
        }
        if (RATE_LIMIT_POLICIES.failClosed.some((pattern) => pattern.test(id))) {
          out.push(
            violation(
              'rate-limits',
              file.path,
              `${where} fails open, but what it protects (mail, an external system, what is live, sign-in) must fail closed.`,
            ),
          );
        }
      }

      const isClient = id.endsWith(CLIENT_SUFFIX);
      if (isClient && !['skip', 'deny'].includes(policy.onUnresolvedClient)) {
        out.push(
          violation(
            'rate-limits',
            file.path,
            `${where} counts a client address, so it must say what happens when the address cannot be determined: \`onUnresolvedClient: 'skip'\` or \`'deny'\`.`,
          ),
        );
      }
      if (!isClient && policy.onUnresolvedClient !== undefined) {
        out.push(
          violation(
            'rate-limits',
            file.path,
            `${where} sets \`onUnresolvedClient\` but is not a client policy. Name a client-address policy with the suffix '${CLIENT_SUFFIX}', or remove the setting.`,
          ),
        );
      }

      if (!referencedIn(project, moduleName, file.path, policy.exportName, policy.key)) {
        out.push(
          violation(
            'rate-limits',
            file.path,
            `${where} is declared but no use case or service of '${moduleName}' spends it. Remove it, or spend it where it protects something.`,
          ),
        );
      }
    }
  }

  return out;
}

/**
 * The use cases that run for anyone and spend no budget, each with the reason they gave
 * (`@rate-limit none <reason>`). The architecture test lists them, so adding one is a visible change
 * in review.
 */
export function describeRateLimitOptOuts(project) {
  const names = [];
  for (const name of project.modules) {
    for (const file of project
      .moduleFiles(name)
      .filter((f) => /^application\/(?:commands|queries)\//.test(f.local))) {
      for (const cls of topLevelClasses(file)) {
        if (NO_LIMIT_TAG.test(leadingComment(file, cls.statement)))
          names.push(`${name}:${cls.name}`);
      }
    }
  }
  return names.sort();
}

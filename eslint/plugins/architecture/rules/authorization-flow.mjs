import { classifyContext, defineRule, memberPath, report } from '../util.mjs';

const isCall = (node) => node?.type === 'CallExpression';

/** `@authorization public|system <reason>` in the class comment declares a use case that has no actor to authorize. */
const UNAUTHORIZED_TAG = /@authorization\s+(?:public|system)\s+\S/;

/** The call a fluent chain starts from: `a.b(x).c(y).d(z)` -> `a.b(x)`. */
export function rootCall(expression) {
  let current = expression;
  while (current) {
    if (current.type === 'AwaitExpression') current = current.argument;
    else if (
      isCall(current) &&
      current.callee.type === 'MemberExpression' &&
      (isCall(current.callee.object) || current.callee.object.type === 'AwaitExpression')
    )
      current = current.callee.object;
    else return isCall(current) ? current : null;
  }
  return null;
}

export function isAuthorizationRoot(call) {
  if (call === null) return false;
  if (call.callee.type === 'Identifier') return /^loadAuthorized[A-Z]/.test(call.callee.name);
  if (call.callee.type === 'MemberExpression') {
    const path = memberPath(call.callee);
    return path !== null && /(?:^|\.)authorization\.requireInTenant$/.test(path);
  }
  return false;
}

/** Collects `return` statements of a function body without descending into nested functions. */
/**
 * A helper whose tenant isolation is enforced by ANOTHER module (it resolves the record through that module's public
 * API) declares it: `@tenant-scope delegated <reason>`. It keeps the permission check, id parsing and not-found
 * handling, but has no tenant-keyed load of its own and no resource scope to check.
 */
export const TENANT_DELEGATED_TAG = /@tenant-scope\s+delegated\s+\S+/;

export function returnsOf(fnBody) {
  const found = [];
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return;
    if (/Function/.test(node.type)) return;
    if (node.type === 'ReturnStatement') found.push(node);
    for (const key of Object.keys(node)) {
      if (key === 'parent') continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child.type === 'string') visit(child);
    }
  };
  visit(fnBody);
  return found;
}

/**
 * Keeps the protected-resource sequence in ONE place
 * (application/load-authorized-*.ts) and makes every protected use case start
 * from authorization:
 *   requireInTenant -> parse id -> load by (id, trusted tenant) -> not found
 *   -> requireOnResource(permission, scopeOf(storedRecord)).
 */
export const authorizationFlow = defineRule({
  description:
    'Protected use cases start with authorization; resource authorization lives only in load-authorized-* helpers.',
  create(context) {
    const { file } = classifyContext(context);
    if (file.area !== 'module' || file.layer !== 'application') return {};
    const isHelper = file.rest.length === 1 && /^load-authorized-/.test(file.file);
    const isUseCase = (file.dir === 'commands' || file.dir === 'queries') && file.rest.length === 2;
    if (!isHelper && !isUseCase) return {};

    return isHelper ? helperVisitors() : useCaseVisitors();

    function useCaseVisitors() {
      let depsName = null;
      let declaredUnauthorized = false;
      return {
        ClassDeclaration(node) {
          const ctor = node.body.body.find(
            (m) => m.type === 'MethodDefinition' && m.kind === 'constructor',
          );
          const param = ctor?.value.params[0];
          const annotation =
            param?.type === 'TSParameterProperty'
              ? param.parameter.typeAnnotation?.typeAnnotation
              : undefined;
          if (annotation?.type === 'TSTypeReference' && annotation.typeName.type === 'Identifier')
            depsName = annotation.typeName.name;
          const owner = node.parent?.type === 'ExportNamedDeclaration' ? node.parent : node;
          if (
            context.sourceCode.getCommentsBefore(owner).some((c) => UNAUTHORIZED_TAG.test(c.value))
          )
            declaredUnauthorized = true;
        },
        CallExpression(node) {
          const name =
            node.callee.type === 'MemberExpression' ? node.callee.property.name : node.callee.name;
          if (name === 'requireOnResource') {
            report(
              context,
              node,
              'Do not authorize a resource inside a use case. Use the shared `loadAuthorized<Resource>` helper so load, not-found handling and the scope check cannot diverge.',
            );
          }
          if (name === 'scopeOf' && node.callee.type === 'Identifier') {
            report(
              context,
              node,
              'Derive scope inside `loadAuthorized<Resource>` from the stored record only; never build a scope in a use case (and never from request input).',
            );
          }
        },
        MethodDefinition(node) {
          if (
            node.key.name !== 'execute' ||
            depsName === null ||
            depsName.startsWith('Public') ||
            declaredUnauthorized
          )
            return;
          const returns = returnsOf(node.value.body);
          for (const statement of returns) {
            if (statement.argument && !isAuthorizationRoot(rootCall(statement.argument))) {
              report(
                context,
                statement,
                'A protected use case must authorize before anything else: `return authorization.requireInTenant(<permission>)…` or `return loadAuthorized<Resource>(…)`. Validate and load only after the permission check, so callers learn nothing about what exists.',
              );
            }
          }
        },
      };
    }

    function helperVisitors() {
      return {
        FunctionDeclaration(node) {
          if (!node.id || !/^loadAuthorized/.test(node.id.name)) return;
          const calls = [];
          const visit = (n) => {
            if (!n || typeof n.type !== 'string') return;
            if (n.type === 'CallExpression') {
              const name =
                n.callee.type === 'MemberExpression' ? n.callee.property.name : n.callee.name;
              calls.push({ name, node: n });
            }
            for (const key of Object.keys(n)) {
              if (key === 'parent') continue;
              const child = n[key];
              if (Array.isArray(child)) child.forEach(visit);
              else if (child && typeof child.type === 'string') visit(child);
            }
          };
          visit(node.body);
          const owner = node.parent?.type === 'ExportNamedDeclaration' ? node.parent : node;
          const delegated = context.sourceCode
            .getCommentsBefore(owner)
            .some((c) => TENANT_DELEGATED_TAG.test(c.value));
          const named = (predicate) => calls.find((c) => predicate(c.name ?? ''));
          const hasAuthorizationStep = calls.some(
            (c) => c.name === 'requireInTenant' || c.name === 'requireOnResource',
          );
          // A thin exported wrapper (`loadAuthorizedPage` -> private `loadAuthorized`) delegates the sequence.
          if (
            !hasAuthorizationStep &&
            calls.some(
              (c) =>
                c.node.callee.type === 'Identifier' &&
                /^loadAuthorized/.test(c.name ?? '') &&
                c.name !== node.id.name,
            )
          )
            return;
          // The load is whichever call is keyed by the trusted tenant: `<repo>.find…(id, actor.tenantId)`.
          const load = calls.find((c) => {
            const last = c.node.arguments[c.node.arguments.length - 1];
            return last?.type === 'MemberExpression' && last.property.name === 'tenantId';
          });
          if (delegated) {
            const required = [
              ['requireInTenant', named((n) => n === 'requireInTenant')],
              ['parse<Resource>Id', named((n) => /^parse[A-Z]\w*Id$/.test(n))],
              ['<resource>NotFound', named((n) => /NotFound$/.test(n))],
            ];
            const absent = required
              .filter(([, call]) => call === undefined)
              .map(([label]) => label);
            if (absent.length > 0) {
              report(
                context,
                node.id,
                `\`${node.id.name}\` is declared \`@tenant-scope delegated\` but still needs: ${absent.join(', ')}.`,
              );
            } else if (!(required[0][1].node.range[0] < required[1][1].node.range[0])) {
              report(
                context,
                node.id,
                `\`${node.id.name}\` calls steps out of order. Required: requireInTenant → parse id → load → not found.`,
              );
            }
            return;
          }
          const steps = [
            ['requireInTenant', named((n) => n === 'requireInTenant')],
            ['parse<Resource>Id', named((n) => /^parse[A-Z]\w*Id$/.test(n))],
            ['load by (id, actor.tenantId)', load],
            ['<resource>NotFound', named((n) => /NotFound$/.test(n))],
            ['requireOnResource', named((n) => n === 'requireOnResource')],
          ];
          const missing = steps.filter(([, call]) => call === undefined).map(([label]) => label);
          if (missing.length > 0) {
            report(
              context,
              node.id,
              `\`${node.id.name}\` must follow the standard sequence requireInTenant → parse id → load by (id, actor.tenantId) → not found → requireOnResource. Missing: ${missing.join(', ')}. (Never load with a tenant taken from the request.)`,
            );
            return;
          }
          const [inTenant, parse, loaded, , onResource] = steps.map(
            ([, call]) => call.node.range[0],
          );
          if (!(inTenant < parse && parse < loaded && loaded < onResource)) {
            report(
              context,
              node.id,
              `\`${node.id.name}\` calls steps out of order. Required: requireInTenant → parse id → load → requireOnResource.`,
            );
          }
          const scopeArg = steps[4][1].node.arguments[1];
          if (!(
            isCall(scopeArg) &&
            scopeArg.callee.type === 'Identifier' &&
            scopeArg.callee.name === 'scopeOf'
          )) {
            report(
              context,
              steps[4][1].node,
              'Pass `scopeOf(<stored record>)` as the resource scope: scope is derived from the loaded domain record, never from client input.',
            );
          }
        },
      };
    }
  },
});

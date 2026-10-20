import { TENANT_SCOPE_KINDS, TENANT_TABLES } from '../../../../policy/policy.mjs';
import { classifyContext, defineRule, report } from '../../util.mjs';

const KINDS = Object.keys(TENANT_SCOPE_KINDS);
const TAG = /@tenant-scope[ \t]+([\w-]+)[ \t]*([^\n]*)/;

/** Tables a raw statement may name, as the quoted identifiers SQL spells them. */
const QUOTED_TABLES = Object.keys(TENANT_TABLES).map((name) => `"${name}"`);
const RAW_PIN = /"(?:tenantId|websiteId)"/;

/** A pin a relation filter may use, whatever the table: a row owned through a parent is pinned by its owner. */
const OWNER_PINS = new Set(['tenantId', 'websiteId']);

const CREATE_CALLS = new Set(['create', 'createAll', 'createMany', 'upsert', 'insert']);

/** `<x>.orm.public.<Model>`: the model, or `null`. */
function ormModel(node) {
  if (node.type !== 'MemberExpression' || node.computed || node.property.type !== 'Identifier')
    return null;
  const schema = node.object;
  if (schema.type !== 'MemberExpression' || schema.computed || schema.property.name !== 'public')
    return null;
  const orm = schema.object;
  if (orm.type !== 'MemberExpression' || orm.computed || orm.property.name !== 'orm') return null;
  return node.property.name;
}

/** The calls made on `root`, in order: `a.where(x).select(y).all()` -> where, select, all. */
function callsOn(root) {
  const calls = [];
  let current = root;
  for (;;) {
    const parent = current.parent;
    if (parent?.type === 'MemberExpression' && parent.object === current) {
      current = parent;
    } else if (parent?.type === 'CallExpression' && parent.callee === current) {
      calls.push({ name: current.property?.name ?? null, args: parent.arguments });
      current = parent;
    } else {
      return calls;
    }
  }
}

function keyName(property) {
  if (property.type !== 'Property') return null;
  if (property.key.type === 'Identifier' && !property.computed) return property.key.name;
  if (property.key.type === 'Literal') return String(property.key.value);
  return null;
}

/** Whether an object literal names one of `pins` as a key of its own (a spread may or may not carry it, so does not count). */
function objectPins(node, pins) {
  return node.properties.some((property) => {
    const name = keyName(property);
    return name !== null && pins.has(name);
  });
}

/** Whether anything under `node` names a pin: as an object key or as a member (`row.websiteId`). */
function mentionsPin(node, pins) {
  if (!node || typeof node.type !== 'string') return false;
  if (node.type === 'Property' && pins.has(keyName(node) ?? '')) return true;
  if (node.type === 'MemberExpression' && !node.computed && pins.has(node.property.name ?? ''))
    return true;
  return Object.keys(node).some((key) => {
    if (key === 'parent') return false;
    const child = node[key];
    return Array.isArray(child)
      ? child.some((item) => mentionsPin(item, pins))
      : mentionsPin(child, pins);
  });
}

/** `x as T`, `x satisfies T` and `x!` are `x`. */
function unwrap(node) {
  let current = node;
  while (
    current &&
    (current.type === 'TSAsExpression' ||
      current.type === 'TSSatisfiesExpression' ||
      current.type === 'TSNonNullExpression')
  )
    current = current.expression;
  return current;
}

/** An identifier that names a `const` in scope, followed to what it was set to. */
function resolve(node, context) {
  let current = unwrap(node);
  for (let hops = 0; hops < 4 && current?.type === 'Identifier'; hops += 1) {
    let scope = context.sourceCode.getScope(current);
    let init = null;
    while (scope !== null && init === null) {
      const variable = scope.set.get(current.name);
      const definition = variable?.defs[0];
      init = definition?.node?.type === 'VariableDeclarator' ? definition.node.init : null;
      scope = scope.upper;
    }
    current = unwrap(init);
  }
  return current;
}

function whereIsPinned(argument, pins, context) {
  const value = resolve(argument, context);
  if (!value) return false;
  if (value.type === 'ObjectExpression') return objectPins(value, pins);
  if (/Function/.test(value.type))
    return mentionsPin(value.body, new Set([...pins, ...OWNER_PINS]));
  return false;
}

function writeIsPinned(call, pins, context) {
  const argument = resolve(call.args[0], context);
  if (!argument) return false;
  if (call.name === 'upsert') {
    const created =
      argument.type === 'ObjectExpression'
        ? argument.properties.find((property) => keyName(property) === 'create')
        : null;
    const row = created ? resolve(created.value, context) : null;
    return row?.type === 'ObjectExpression' && objectPins(row, pins);
  }
  if (argument.type === 'ObjectExpression') return objectPins(argument, pins);
  if (argument.type === 'ArrayExpression') {
    return (
      argument.elements.length > 0 &&
      argument.elements.every((row) => row?.type === 'ObjectExpression' && objectPins(row, pins))
    );
  }
  return false;
}

function isPinned(calls, model, context) {
  const table = TENANT_TABLES[model];
  const pins = new Set(table.pins.length > 0 ? table.pins : [...OWNER_PINS]);
  return calls.some((call) =>
    call.name === 'where'
      ? call.args.length > 0 && whereIsPinned(call.args[0], pins, context)
      : CREATE_CALLS.has(call.name) && call.args.length > 0 && writeIsPinned(call, pins, context),
  );
}

/** Whether `node` is a `<x>.raw.sql` template tag. */
function isRawSql(node) {
  return (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.name === 'sql' &&
    node.object.type === 'MemberExpression' &&
    node.object.property.name === 'raw'
  );
}

/**
 * Keeps every query on a tenant-owned table bound to its tenant, or explicit about why not.
 *
 * Isolation between tenants is decided in the use case (it authorizes, then loads by id AND the
 * trusted tenant, `architecture/authorization-flow`), and the repository is where that is either
 * kept or lost: one `where({ id })` that forgets the tenant is a cross-tenant read for whoever can
 * guess an id. So at the data layer a query on a table in `TENANT_TABLES` constrains the table's
 * pin column(s), or carries `@tenant-scope <kind> <reason>` (kinds in `TENANT_SCOPE_KINDS`) on its
 * statement, method or helper. Those tags are the complete list of ways data is reached without a
 * tenant, and `__tests__/architecture/tenant-scope.test.ts` lists them, so adding one is a visible
 * change in review.
 *
 * Not covered, on purpose: a query written outside `infrastructure/prisma`, which the layer rules
 * already forbid, and WHICH tenant a pinned query names (the use case decides that).
 */
export const tenantScope = defineRule({
  description:
    'Queries on tenant-owned tables are pinned to their tenant or website, or tagged @tenant-scope with a stated reason.',
  create(context) {
    const { file } = classifyContext(context);
    const isRepository =
      file.area === 'module' && file.layer === 'infrastructure' && file.dir === 'prisma';
    if (!isRepository) return {};

    const sourceCode = context.sourceCode;
    const candidates = []; // { node, model }  ORM roots
    const calls = []; // every call to a plain function, to find the builders once they are known
    const rawQueries = [];
    const builders = new Map(); // helper name -> model

    /** The `@tenant-scope` comment that covers `node`: on it, or on a statement, method or helper around it. */
    function tagFor(node) {
      for (let ancestor = node; ancestor; ancestor = ancestor.parent) {
        const comments = sourceCode.getCommentsBefore(ancestor);
        const tagged = comments.map((comment) => TAG.exec(comment.value)).find(Boolean);
        if (tagged) return tagged;
        const isDeclaration =
          ancestor.type === 'MethodDefinition' || ancestor.type === 'FunctionDeclaration';
        if (isDeclaration) {
          const exported =
            ancestor.parent?.type === 'ExportNamedDeclaration' ? ancestor.parent : null;
          const outer = exported ? sourceCode.getCommentsBefore(exported) : [];
          return outer.map((comment) => TAG.exec(comment.value)).find(Boolean) ?? null;
        }
        if (ancestor.type === 'Program') return null;
      }
      return null;
    }

    /** Whether a tag covers the query; a tag that is not a kind with a reason is reported, and still covers it. */
    function isTagged(node) {
      const tag = tagFor(node);
      if (tag === null) return false;
      const [, kind, reason] = tag;
      if (!KINDS.includes(kind) || reason.replace(/\*\/\s*$/, '').trim() === '') {
        report(
          context,
          node,
          `\`@tenant-scope ${kind}\` needs a kind (${KINDS.join(', ')}) and a one-line reason saying what binds the query to a tenant instead.`,
        );
      }
      return true;
    }

    /** Reports a query on a tenant-owned table that is neither pinned nor tagged. */
    function judge(node, model) {
      if (!(model in TENANT_TABLES)) return;
      if (isPinned(callsOn(node), model, context)) return;
      if (isTagged(node)) return;
      const table = TENANT_TABLES[model];
      const pinned = table.pins.length > 0 ? table.pins.join(' / ') : `its ${table.via}`;
      report(
        context,
        node,
        `A query on \`${model}\` (owned by a tenant) is not bound to one: constrain ${pinned} in its \`.where(…)\` or \`create(…)\`, or say why it needs none with \`@tenant-scope <${KINDS.join('|')}> <reason>\`. See docs/architecture/route-protection.md ("Tenants").`,
      );
    }

    return {
      MemberExpression(node) {
        const model = ormModel(node);
        if (model !== null) candidates.push({ node, model });
      },
      CallExpression(node) {
        if (node.callee.type === 'Identifier') calls.push(node);
      },
      TaggedTemplateExpression(node) {
        if (isRawSql(node.tag)) rawQueries.push(node);
      },
      'Program:exit'() {
        // Helpers that hand back a query to extend are tagged `builder`; their callers are queries too.
        for (const { node, model } of candidates) {
          const tag =
            model in TENANT_TABLES && !isPinned(callsOn(node), model, context)
              ? tagFor(node)
              : null;
          if (tag?.[1] !== 'builder') continue;
          for (let ancestor = node; ancestor; ancestor = ancestor.parent) {
            if (ancestor.type === 'VariableDeclarator' && ancestor.id.type === 'Identifier') {
              builders.set(ancestor.id.name, model);
              break;
            }
            if (ancestor.type === 'FunctionDeclaration' && ancestor.id) {
              builders.set(ancestor.id.name, model);
              break;
            }
          }
        }
        for (const { node, model } of candidates) judge(node, model);
        for (const call of calls) {
          const model = builders.get(call.callee.name);
          if (model !== undefined) judge(call, model);
        }
        for (const node of rawQueries) {
          const text = node.quasi.quasis.map((part) => part.value.raw).join(' ');
          if (!QUOTED_TABLES.some((table) => text.includes(table)) || RAW_PIN.test(text)) continue;
          if (isTagged(node)) continue;
          report(
            context,
            node,
            'A raw statement on a tenant-owned table must constrain `"tenantId"` or `"websiteId"` in its text, or say why it needs none with `@tenant-scope <kind> <reason>`.',
          );
        }
      },
    };
  },
});

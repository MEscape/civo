/**
 * eslint-plugin-architecture
 *
 * Enforces the module architecture described in
 * docs/architecture/eslint-architecture.md. All rules are syntactic and read
 * the central policy in eslint/architecture-policy/policy.mjs; none of them needs the
 * type checker or the file system, and none names a module.
 */
import { actionContract } from './rules/action-contract.mjs';
import { auditAdapter } from './rules/audit-adapter.mjs';
import { authorizationFlow } from './rules/authorization-flow.mjs';
import { brandedIdUsage } from './rules/branded-id-usage.mjs';
import { commandAuditDependency } from './rules/command-audit-dependency.mjs';
import { commandQueryShape } from './rules/command-query-shape.mjs';
import { dtoSerialization } from './rules/dto-serialization.mjs';
import { fieldErrorBagOwner } from './rules/field-error-bag-owner.mjs';
import { formConventions } from './rules/form-conventions.mjs';
import { headingHierarchy } from './rules/heading-hierarchy.mjs';
import { layerImports } from './rules/layer-imports.mjs';
import { limitsUsage } from './rules/limits-usage.mjs';
import { messageKeyCoverage } from './rules/message-key-coverage.mjs';
import { metadataConventions } from './rules/metadata-conventions.mjs';
import { modulePublicApi } from './rules/module-public-api.mjs';
import { moduleStructure } from './rules/module-structure.mjs';
import { noCrossModuleDeepImports } from './rules/no-cross-module-deep-imports.mjs';
import { noI18nInCore } from './rules/no-i18n-in-core.mjs';
import { noThrowInCoreLayers } from './rules/no-throw-in-core-layers.mjs';
import { persistenceFailures } from './rules/persistence-failures.mjs';
import { routeUsage } from './rules/route-usage.mjs';

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: { name: 'eslint-plugin-architecture', version: '1.0.0' },
  rules: {
    'action-contract': actionContract,
    'audit-adapter': auditAdapter,
    'authorization-flow': authorizationFlow,
    'branded-id-usage': brandedIdUsage,
    'command-audit-dependency': commandAuditDependency,
    'command-query-shape': commandQueryShape,
    'dto-serialization': dtoSerialization,
    'field-error-bag-owner': fieldErrorBagOwner,
    'form-conventions': formConventions,
    'heading-hierarchy': headingHierarchy,
    'layer-imports': layerImports,
    'limits-usage': limitsUsage,
    'message-key-coverage': messageKeyCoverage,
    'metadata-conventions': metadataConventions,
    'module-public-api': modulePublicApi,
    'module-structure': moduleStructure,
    'no-cross-module-deep-imports': noCrossModuleDeepImports,
    'no-i18n-in-core': noI18nInCore,
    'no-throw-in-core-layers': noThrowInCoreLayers,
    'persistence-failures': persistenceFailures,
    'route-usage': routeUsage,
  },
};

export default plugin;

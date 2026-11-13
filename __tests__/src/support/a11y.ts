import axe from 'axe-core';
import { expect } from 'vitest';

/**
 * Runs axe on what a test rendered and fails with the rule and the element of each violation. Colour
 * contrast is left out: it needs real layout and styles, which the test environment does not compute,
 * so what it says about contrast would be noise. Everything else (names, roles, labels, landmarks,
 * heading order, list structure) is judged.
 */
export async function expectNoViolations(container: Element): Promise<void> {
  const { violations } = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  const report = violations.map(
    (violation) =>
      `${violation.id}: ${violation.help}\n${violation.nodes.map((node) => `  ${node.html}`).join('\n')}`,
  );
  expect(report, report.join('\n\n')).toEqual([]);
}

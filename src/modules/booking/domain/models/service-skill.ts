/**
 * How an employee says "I do this service" without anyone assigning them: a
 * skill named after the service. A service that needs an employee is served
 * by the employees who hold its skill; administrators set the services up,
 * employees choose which of them they offer.
 */
const SERVICE_SKILL_PREFIX = 'svc-';

export function serviceSkillOf(serviceId: string): string {
  return `${SERVICE_SKILL_PREFIX}${serviceId.toLowerCase()}`;
}

/** The services a skill list offers. Skills of any other kind are not services. */
export function offeredServiceIdsOf(skills: readonly string[]): string[] {
  return skills
    .filter((skill) => skill.startsWith(SERVICE_SKILL_PREFIX))
    .map((skill) => skill.slice(SERVICE_SKILL_PREFIX.length));
}

/** `skills` with the offered services replaced by `serviceIds`; every other skill is kept. */
export function withOfferedServices(
  skills: readonly string[],
  serviceIds: readonly string[],
): string[] {
  const others = skills.filter((skill) => !skill.startsWith(SERVICE_SKILL_PREFIX));
  return [...others, ...serviceIds.map(serviceSkillOf)];
}

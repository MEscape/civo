import { describe, expect, it } from 'vitest';

import { PLATFORM_ADMIN_ROLE, ROLES } from '@modules/auth/domain/models/role';
import { RESOURCE_TYPES } from '@modules/booking/domain/models/bookable-resource';

import contract from '@lib/db/contract.json' with { type: 'json' };

/** The values the database accepts for an enum of the schema. */
function valuesOf(name: string): string[] {
  const members = contract.domain.namespaces.public.enum[name as 'ActorRole'].members;
  return members.map((member: { value: string }) => member.value);
}

describe('database enums', () => {
  it('accept exactly the roles the domain knows', () => {
    expect(valuesOf('ActorRole').sort()).toEqual([...ROLES, PLATFORM_ADMIN_ROLE].sort());
  });

  it('accept exactly the resource types the domain knows', () => {
    expect(valuesOf('ResourceType').sort()).toEqual([...RESOURCE_TYPES].sort());
  });
});

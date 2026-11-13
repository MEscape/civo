import { describe, expect, it, vi } from 'vitest';

import { toTenantId } from '@modules/auth';
import {
  isQualification,
  linksFor,
  loadResourcesServing,
  qualificationsOf,
  toResourceOption,
  toServiceResources,
} from '@modules/booking/application/services/service-resources';
import type { BookableResource } from '@modules/booking/domain/models/bookable-resource';
import {
  toBookableResourceId,
  toBookingLocationId,
  toWebsiteId,
} from '@modules/booking/domain/models/ids';
import type { BookingScope } from '@modules/booking/domain/ports/booking.repository';
import { parseMinutes } from '@modules/booking/domain/time/minutes';

import { okAsync } from '@lib/result';

describe('service-resources application service', () => {
  const scope: BookingScope = {
    tenantId: toTenantId('tenant-1'),
    websiteId: toWebsiteId('web-1'),
  };

  const locationId = toBookingLocationId('loc-1');
  const otherLocationId = toBookingLocationId('loc-other');

  const employeeResource: BookableResource = {
    id: toBookableResourceId('emp-1'),
    name: 'Anna Schmidt',
    type: 'employee',
    capacity: null,
    locationId,
    skills: ['passport', 'svc-old-offer', 'id-cards'],
    isActive: true,
    setupMinutes: parseMinutes(0)!,
    teardownMinutes: parseMinutes(0)!,
    availability: null,
    coverage: [],
  };

  const roomResource: BookableResource = {
    id: toBookableResourceId('room-1'),
    name: 'Room A',
    type: 'room',
    capacity: 4,
    locationId,
    skills: [],
    isActive: true,
    setupMinutes: parseMinutes(5)!,
    teardownMinutes: parseMinutes(10)!,
    availability: null,
    coverage: [],
  };

  const otherLocationResource: BookableResource = {
    id: toBookableResourceId('desk-2'),
    name: 'Desk East',
    type: 'workstation',
    capacity: 1,
    locationId: otherLocationId,
    skills: [],
    isActive: true,
    setupMinutes: parseMinutes(0)!,
    teardownMinutes: parseMinutes(0)!,
    availability: null,
    coverage: [],
  };

  describe('isQualification', () => {
    it('returns false for legacy svc- prefixed offers, true otherwise', () => {
      expect(isQualification('svc-passport')).toBe(false);
      expect(isQualification('passport')).toBe(true);
      expect(isQualification('drivers-license')).toBe(true);
    });
  });

  describe('loadResourcesServing', () => {
    it('loads and filters resources that serve the given location', async () => {
      const deps = {
        resources: {
          list: vi
            .fn()
            .mockReturnValue(okAsync([employeeResource, roomResource, otherLocationResource])),
        },
      };

      const result = await loadResourcesServing(deps, scope, locationId);
      expect(result.isOk()).toBe(true);
      const serving = result._unsafeUnwrap();
      expect(serving).toHaveLength(2);
      expect(serving.map((r) => r.id)).toEqual([employeeResource.id, roomResource.id]);
    });
  });

  describe('qualificationsOf', () => {
    it('extracts unique, sorted qualifications from employee resources ignoring legacy offers', () => {
      const anotherEmployee: BookableResource = {
        ...employeeResource,
        id: toBookableResourceId('emp-2'),
        skills: ['passport', 'marriage'],
      };

      const quals = qualificationsOf([employeeResource, roomResource, anotherEmployee]);
      expect(quals).toEqual(['id-cards', 'marriage', 'passport']);
    });
  });

  describe('toResourceOption & toServiceResources', () => {
    it('maps resource and service counts to view option', () => {
      const useCounts = new Map([[roomResource.id, 3]]);
      const option = toResourceOption(roomResource, useCounts);

      expect(option).toEqual({
        id: roomResource.id,
        name: 'Room A',
        type: 'room',
        capacity: 4,
        isActive: true,
        setupMinutes: 5,
        teardownMinutes: 10,
        usedByServices: 3,
      });
    });

    it('maps links to service resource views, ignoring un-found resources', () => {
      const useCounts = new Map([[roomResource.id, 1]]);
      const links = [
        { resourceId: roomResource.id, resourceType: 'room' as const, isRequired: true },
        {
          resourceId: toBookableResourceId('non-existent'),
          resourceType: 'equipment' as const,
          isRequired: false,
        },
      ];

      const views = toServiceResources(links, [roomResource], useCounts);
      expect(views).toHaveLength(1);
      expect(views[0]?.id).toBe(roomResource.id);
      expect(views[0]?.isRequired).toBe(true);
    });
  });

  describe('linksFor', () => {
    it('validates and creates links for non-employee serving resources', () => {
      const wanted = [{ resourceId: 'room-1', isRequired: true }];
      const result = linksFor(wanted, [roomResource, employeeResource]);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual([
        { resourceId: roomResource.id, resourceType: 'room', isRequired: true },
      ]);
    });

    it('reports error when an employee resource or unknown resource is linked', () => {
      const wanted = [
        { resourceId: 'emp-1', isRequired: true }, // employee cannot be linked
        { resourceId: 'unknown', isRequired: false }, // missing
      ];
      const result = linksFor(wanted, [roomResource, employeeResource]);
      expect(result.isErr()).toBe(true);
      const error = result._unsafeUnwrapErr();
      expect(error.fieldErrors['resources.0.resourceId']).toBeDefined();
      expect(error.fieldErrors['resources.1.resourceId']).toBeDefined();
    });
  });
});

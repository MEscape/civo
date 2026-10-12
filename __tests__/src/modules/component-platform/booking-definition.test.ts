import { describe, expect, it } from 'vitest';

import { bookingDefinition } from '@modules/component-platform/domain/components/civic/booking.component';
import { COMPONENT_DEFINITIONS } from '@modules/component-platform/domain/components/component-definitions';

describe('the booking component', () => {
  it('is registered exactly once, as a civic component municipalities may place', () => {
    const matches = COMPONENT_DEFINITIONS.filter((definition) => definition.type === 'booking');
    expect(matches).toEqual([bookingDefinition]);
    expect(bookingDefinition.category).toBe('civic');
    expect(bookingDefinition.municipallyEditable).toBe(true);
    expect(bookingDefinition.canHaveChildren).toBe(false);
  });

  it('starts as the public booking flow with no filter', () => {
    expect(bookingDefinition.fields.map((field) => field.key)).toEqual([
      'heading',
      'serviceId',
      'category',
    ]);
  });

  it('lets a municipality edit the wording and the category but not the service', () => {
    expect([...bookingDefinition.municipalFields].sort()).toEqual(['category', 'heading']);
  });

  it('never accepts a website id from the page: the website comes from the render context', () => {
    expect(bookingDefinition.fields.map((field) => field.key)).not.toContain('websiteId');
  });

  it('offers no staff screen: a stored page that still holds the removed mode renders as a public flow', () => {
    expect(bookingDefinition.parseProps({ mode: 'adminCalendar' })).not.toHaveProperty('mode');
  });
});

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
    expect(bookingDefinition.defaultProps).toMatchObject({ mode: 'public' });
    expect(bookingDefinition.parseProps({})).toMatchObject({ mode: 'public' });
  });

  it('lets a municipality edit the wording and the category but not the mode or service', () => {
    expect([...bookingDefinition.municipalFields].sort()).toEqual(['category', 'heading']);
  });

  it('never accepts a website id from the page: the website comes from the render context', () => {
    expect(bookingDefinition.fields.map((field) => field.key)).not.toContain('websiteId');
  });

  it('falls back to the default mode when a stored page holds a mode that no longer exists', () => {
    expect(bookingDefinition.parseProps({ mode: 'kiosk' })).toMatchObject({ mode: 'public' });
  });
});

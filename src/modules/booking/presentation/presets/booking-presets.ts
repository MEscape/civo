/**
 * Starting points for setting the booking system up quickly: each one fills a
 * form with what is usual, and the person reviews it before saving. Nothing is
 * saved by choosing one, and every value stays editable. Names and
 * descriptions are translated (`booking.presets.<kind>.<key>`).
 */

export const SERVICE_PRESETS = [
  {
    key: 'citizenService',
    durationMinutes: 20,
    slotIntervalMinutes: 20,
    preparationMinutes: 0,
    cleanupMinutes: 5,
    noticeMinutes: 120,
    horizonDays: 60,
    requires: 'employee',
  },
  {
    key: 'consultation',
    durationMinutes: 45,
    slotIntervalMinutes: 15,
    preparationMinutes: 5,
    cleanupMinutes: 5,
    noticeMinutes: 1440,
    horizonDays: 90,
    requires: 'employee',
  },
  {
    key: 'roomBooking',
    durationMinutes: 120,
    slotIntervalMinutes: 60,
    preparationMinutes: 0,
    cleanupMinutes: 15,
    noticeMinutes: 1440,
    horizonDays: 180,
    requires: 'meeting-room',
  },
] as const;
export type ServicePreset = (typeof SERVICE_PRESETS)[number];

export const RESOURCE_PRESETS = [
  { key: 'meetingRoom', type: 'meeting-room', capacity: 12 },
  { key: 'sportsField', type: 'sports-field', capacity: 1 },
  { key: 'vehicle', type: 'vehicle', capacity: 1 },
  { key: 'equipment', type: 'equipment', capacity: null },
] as const;
export type ResourcePreset = (typeof RESOURCE_PRESETS)[number];

import type {
  AdoptablePageDto,
  ResourceOptionDto,
  ServiceDto,
  ServiceFormOptionsDto,
  ServicePageDto,
} from '@modules/booking/client';

/** The counter of the mockups: an employee with the passport qualification, a counter and a meeting room. */
export const COUNTER: ResourceOptionDto = {
  id: 'res-counter',
  name: 'Schalter',
  type: 'service-desk',
  capacity: 1,
  isActive: true,
  setupMinutes: 0,
  teardownMinutes: 0,
  usedByServices: 6,
};

export const MEETING_ROOM: ResourceOptionDto = {
  id: 'res-room',
  name: 'Besprechungsraum',
  type: 'meeting-room',
  capacity: 4,
  isActive: true,
  setupMinutes: 10,
  teardownMinutes: 5,
  usedByServices: 0,
};

export const OPTIONS: ServiceFormOptionsDto = {
  isTruncated: false,
  categories: ['Ausweise & Pässe', 'Meldewesen'],
  qualifications: ['Ausweise', 'Meldewesen'],
  resources: [COUNTER, MEETING_ROOM],
};

const MITTE = { id: 'loc-mitte', name: 'Bürgerbüro Mitte' };
const SUED = { id: 'loc-sued', name: 'Bürgerbüro Süd' };

/** "Personalausweis beantragen" at Mitte, made there, with six bookings ahead. */
export function serviceDto(overrides: Partial<ServiceDto> = {}): ServiceDto {
  return {
    websiteId: 'site',
    id: 'svc-ausweis',
    location: MITTE,
    name: 'Personalausweis beantragen',
    description: 'Beantragung eines neuen Personalausweises',
    category: 'Ausweise & Pässe',
    documents: ['Altes Dokument', 'biometrisches Foto'],
    instructions: '',
    internalNote: 'nur intern',
    isActive: true,
    isServiceActive: true,
    isOnlineBookable: true,
    durationMinutes: 20,
    preparationMinutes: 5,
    cleanupMinutes: 10,
    resources: [
      { ...COUNTER, isRequired: true },
      { ...MEETING_ROOM, isRequired: false },
    ],
    noticeMinutes: 1440,
    horizonDays: 90,
    cancelUntilMinutes: 1440,
    changeUntilMinutes: 720,
    actors: ['customer', 'employee', 'manager'],
    employee: 'qualified',
    qualification: 'Ausweise',
    origin: { kind: 'own' },
    sharedWith: [],
    version: '2027-01-10T11:00:00.000Z',
    settingVersion: '2027-01-10T11:00:00.000Z',
    futureBookingCount: 6,
    futureBookingCountAll: 6,
    ...overrides,
  };
}

/** The same service, also on at Süd. */
export const SHARED_SERVICE = serviceDto({ sharedWith: [SUED], futureBookingCountAll: 9 });

export function servicePage(): ServicePageDto {
  const own = {
    id: 'svc-ausweis',
    name: 'Personalausweis beantragen',
    category: 'Ausweise & Pässe',
    durationMinutes: 20,
    isActive: true,
    isOnlineBookable: true,
    origin: { kind: 'own' },
  } as const;
  return {
    location: MITTE,
    groups: [
      {
        category: 'Ausweise & Pässe',
        items: [
          own,
          {
            ...own,
            id: 'svc-kind',
            name: 'Kinderreisepass',
            durationMinutes: 15,
            isActive: false,
            origin: { kind: 'copy', from: SUED },
          },
        ],
      },
      {
        category: 'Meldewesen',
        items: [
          {
            ...own,
            id: 'svc-wohnsitz',
            name: 'Wohnsitz anmelden',
            category: 'Meldewesen',
            durationMinutes: 30,
            origin: { kind: 'linked', from: SUED },
          },
        ],
      },
      {
        category: null,
        items: [{ ...own, id: 'svc-sonst', name: 'Sonstiges', category: null }],
      },
    ],
    page: 1,
    pageSize: 5,
    total: 3,
    pageCount: 1,
    serviceCount: 4,
    categories: ['Ausweise & Pässe', 'Meldewesen'],
    isTruncated: false,
  };
}

export function adoptablePage(): AdoptablePageDto {
  return {
    location: MITTE,
    items: [
      {
        id: 'svc-a',
        name: 'Wohnsitz anmelden',
        category: 'Meldewesen',
        durationMinutes: 30,
        source: SUED,
      },
      {
        id: 'svc-b',
        name: 'Wohnsitz abmelden',
        category: 'Meldewesen',
        durationMinutes: 15,
        source: SUED,
      },
    ],
    page: 1,
    pageSize: 10,
    total: 2,
    pageCount: 1,
    sources: [SUED],
    isTruncated: false,
  };
}

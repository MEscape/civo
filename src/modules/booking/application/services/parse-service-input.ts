import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { isBlank, unique } from '@lib/utils';

import {
  BOOKING_VALIDATION_CODES as CODES,
  createBookingErrorBag,
} from '../../domain/errors/booking-errors';
import { CHANGE_ACTORS } from '../../domain/models/bookable-service';
import { createSlotRules } from '../../domain/scheduling/slot-rules';
import { MAX_HORIZON_DAYS } from '../../domain/scheduling/start-window';
import { parseMinutes } from '../../domain/time/minutes';
import { EMPLOYEE_NEEDS, SERVICE_LIMITS as LIMITS } from '../contracts/booking-constraints';

import type { ChangeActor } from '../../domain/models/bookable-service';
import type { Minutes } from '../../domain/time/minutes';
import type { EmployeeNeed } from '../contracts/booking-constraints';
import type { ServiceInput } from '../contracts/service-inputs';

const MINUTES_PER_DAY = 1440;

/** The part of a service every location that has it shares, as the rules hold it. */
export interface ParsedSharedPart {
  readonly name: string;
  readonly description: string | null;
  readonly category: string | null;
  readonly documents: readonly string[];
  readonly instructions: string | null;
  readonly internalNote: string | null;
  readonly durationMinutes: number;
  readonly preparationMinutes: number;
  readonly cleanupMinutes: number;
  readonly noticeMinutes: Minutes;
  readonly horizonDays: number;
  readonly cancelUntilMinutes: Minutes;
  readonly changeUntilMinutes: Minutes;
  readonly actors: readonly ChangeActor[];
  readonly employee: EmployeeNeed;
  /** The skill an employee must hold; `null` unless `employee` is `qualified`. */
  readonly qualification: string | null;
}

/** What belongs to one location alone. */
export interface ParsedLocalPart {
  readonly isOnlineBookable: boolean;
  readonly isActive: boolean;
  readonly resources: ReadonlyArray<{ readonly resourceId: string; readonly isRequired: boolean }>;
}

export interface ParsedService {
  readonly shared: ParsedSharedPart;
  readonly local: ParsedLocalPart;
}

const isEmployeeNeed = (value: string): value is EmployeeNeed =>
  EMPLOYEE_NEEDS.some((need) => need === value);
const isChangeActor = (value: string): value is ChangeActor =>
  CHANGE_ACTORS.some((actor) => actor === value);

/** The bag every reader of the form reports its field errors into. */
type ErrorBag = ReturnType<typeof createBookingErrorBag>;

const textOrNull = (text: string): string | null => (isBlank(text) ? null : text.trim());

/** Reads the shared part's text and checks its lengths, reporting each field at once. */
function readTexts(input: ServiceInput, bag: ErrorBag) {
  const name = input.name.trim();
  const description = input.description.trim();
  const category = input.category.trim();
  const instructions = input.instructions.trim();
  const note = input.internalNote.trim();
  bag.expect(name.length >= 1 && name.length <= LIMITS.nameMax, 'name', CODES.nameInvalid);
  bag.expect(description.length <= LIMITS.descriptionMax, 'description', CODES.descriptionInvalid);
  bag.expect(category.length <= LIMITS.categoryMax, 'category', CODES.categoryInvalid);
  bag.expect(
    instructions.length <= LIMITS.instructionsMax,
    'instructions',
    CODES.instructionsInvalid,
  );
  bag.expect(note.length <= LIMITS.noteMax, 'internalNote', CODES.noteInvalid);
  return { name, description, category, instructions, note };
}

/** The documents to bring: blanks dropped, each short, not too many, none twice. */
function readDocuments(raw: readonly string[], bag: ErrorBag): string[] {
  const documents = unique(
    raw.map((item) => item.trim()).filter((item) => item !== ''),
    (item) => item.toLowerCase(),
  );
  bag.expect(documents.length <= LIMITS.documentsMax, 'documents', CODES.documentsInvalid);
  documents.forEach((item, index) => {
    bag.expect(item.length <= LIMITS.documentMax, `documents.${index}`, CODES.documentsInvalid);
  });
  return documents;
}

/** Who may cancel and change: at least one, and only the actors that exist. */
function readActors(raw: readonly string[], bag: ErrorBag): ChangeActor[] {
  const actors = unique(raw.filter(isChangeActor));
  bag.expect(actors.length === raw.length && actors.length >= 1, 'actors', CODES.actorsRequired);
  return actors;
}

/** The resources named: few, each once, each with its flag. Whether they exist here is the use case's to check. */
function readResources(input: ServiceInput, bag: ErrorBag): ParsedLocalPart['resources'] {
  const ids = input.resources.map((resource) => resource.resourceId);
  bag.expect(
    input.resources.length <= LIMITS.resourcesMax && unique(ids).length === ids.length,
    'resources',
    CODES.resourceInvalid,
  );
  input.resources.forEach((resource, index) => {
    bag.expect(
      !isBlank(resource.resourceId),
      `resources.${index}.resourceId`,
      CODES.resourceInvalid,
    );
  });
  return input.resources.map(({ resourceId, isRequired }) => ({ resourceId, isRequired }));
}

/** The length and the buffers, judged by the engine's own constructor. The grid is not a field of the form. */
function readLengths(input: ServiceInput, bag: ErrorBag) {
  const rules = createSlotRules({
    durationMinutes: input.durationMinutes,
    preparationMinutes: input.preparationMinutes,
    cleanupMinutes: input.cleanupMinutes,
    stepMinutes: LIMITS.defaultStepMinutes,
  });
  if (rules.isErr()) {
    for (const [path, codes] of Object.entries(rules.error.fieldErrors)) {
      for (const code of codes) {
        bag.add(path === 'stepMinutes' ? 'durationMinutes' : path, code);
      }
    }
    return null;
  }
  const { durationMinutes, preparationMinutes, cleanupMinutes } = rules.value;
  return { durationMinutes, preparationMinutes, cleanupMinutes };
}

/** When a booking may be made, cancelled and changed: the notice is shorter than the horizon, no deadline is negative. */
function readWindow(input: ServiceInput, bag: ErrorBag) {
  const noticeMinutes = parseMinutes(input.noticeMinutes);
  const cancelUntilMinutes = parseMinutes(input.cancelUntilMinutes);
  const changeUntilMinutes = parseMinutes(input.changeUntilMinutes);
  const isHorizonValid =
    Number.isInteger(input.horizonDays) &&
    input.horizonDays >= 1 &&
    input.horizonDays <= MAX_HORIZON_DAYS;
  bag.expect(noticeMinutes !== null, 'noticeMinutes', CODES.noticeInvalid);
  bag.expect(cancelUntilMinutes !== null, 'cancelUntilMinutes', CODES.deadlineInvalid);
  bag.expect(changeUntilMinutes !== null, 'changeUntilMinutes', CODES.deadlineInvalid);
  bag.expect(isHorizonValid, 'horizonDays', CODES.horizonInvalid);
  bag.expect(
    noticeMinutes === null ||
      !isHorizonValid ||
      noticeMinutes < input.horizonDays * MINUTES_PER_DAY,
    'noticeMinutes',
    CODES.noticeNotBeforeHorizon,
  );
  if (noticeMinutes === null || cancelUntilMinutes === null || changeUntilMinutes === null) {
    return null;
  }
  return { noticeMinutes, horizonDays: input.horizonDays, cancelUntilMinutes, changeUntilMinutes };
}

/** Who serves the service: nobody, anyone, or someone who holds the qualification named. */
function readEmployee(input: ServiceInput, bag: ErrorBag) {
  const qualification = input.qualification.trim();
  const employee = isEmployeeNeed(input.employee) ? input.employee : null;
  bag.expect(employee !== null, 'employee', CODES.qualificationInvalid);
  bag.expect(
    employee !== 'qualified' ||
      (qualification !== '' && qualification.length <= LIMITS.qualificationMax),
    'qualification',
    CODES.qualificationInvalid,
  );
  return employee === null
    ? null
    : { employee, qualification: employee === 'qualified' ? qualification : null };
}

/**
 * Reads what a form sent into what the rules hold, or says which field is wrong, all of them at
 * once and at the path the form uses. The rules a person can break are here: a duration and buffers
 * inside what the engine accepts, a notice that is shorter than the horizon, deadlines that are not
 * negative, someone who may cancel, a qualification when one is asked for. The same function runs
 * in the form and in the use case, so the message shown is the one the server would refuse with.
 */
export function parseServiceInput(
  input: ServiceInput,
): AppResult<ParsedService, ValidationAppError> {
  const bag = createBookingErrorBag();
  const texts = readTexts(input, bag);
  const documents = readDocuments(input.documents, bag);
  const actors = readActors(input.actors, bag);
  const resources = readResources(input, bag);
  const lengths = readLengths(input, bag);
  const window = readWindow(input, bag);
  const who = readEmployee(input, bag);

  if (bag.hasErrors || lengths === null || window === null || who === null) {
    return err(bag.toError());
  }
  return ok({
    shared: {
      name: texts.name,
      description: textOrNull(texts.description),
      category: textOrNull(texts.category),
      documents,
      instructions: textOrNull(texts.instructions),
      internalNote: textOrNull(texts.note),
      actors,
      ...lengths,
      ...window,
      ...who,
    },
    local: {
      isOnlineBookable: input.isOnlineBookable,
      isActive: input.isActive,
      resources,
    },
  });
}

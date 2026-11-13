/** The address parameter a new location's page carries when some of the services chosen in its wizard were refused. */
export const NOT_TAKEN_OVER_PARAM = 'notTakenOver';

const MAX_SHOWN = 999;

/** The count the address carries: a whole number, else nothing (an address is typed by anyone). */
export function notTakenOverCount(raw: string | string[] | undefined): number {
  const count = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(count) && count > 0 ? Math.min(count, MAX_SHOWN) : 0;
}

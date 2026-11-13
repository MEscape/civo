/**
 * Wrapping deeper than this is not something the runtime does; the bound only keeps a chain that
 * loops back on itself from being followed forever.
 */
const MAX_CAUSE_DEPTH = 4;

/**
 * The thrown value and what it was caused by, outermost first. The runtime wraps the normalized
 * driver error as `cause` of its own structured error (and, for a retried prepared statement, one
 * level further), so the driver error is looked for along the chain, not only at the top.
 */
export function causeChain(thrown: unknown): unknown[] {
  const chain: unknown[] = [thrown];
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
    const last = chain[chain.length - 1];
    if (!(last instanceof Error) || last.cause === undefined) {
      break;
    }
    chain.push(last.cause);
  }
  return chain;
}

/** The id the "add dataset" button points at while it is switched off: the connection notice says why. */
export function connectionNoticeId(sourceId: string): string {
  return `${sourceId}-connection`;
}

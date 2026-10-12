/** The part of a trend chart a visitor moved to: plain data for the browser. */
export interface TrendWindowDto {
  readonly points: ReadonlyArray<{ readonly date: string; readonly value: number }>;
  readonly unit: string | undefined;
  /** The dataset holds records beyond this window. */
  readonly hasMore: boolean;
}

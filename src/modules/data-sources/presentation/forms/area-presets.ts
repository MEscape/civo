/**
 * The ways well-known open-data APIs are asked for an area, to start from: the parameter and the
 * value, with the corners as `{west}`, `{south}`, `{east}` and `{north}`. The field the condition
 * names (`geo_point_2d`, `location`) belongs to the data, so it stays editable.
 */
export const AREA_PRESETS = {
  opendatasoft: {
    param: 'where',
    template: 'in_bbox(geo_point_2d, {south}, {west}, {north}, {east})',
  },
  socrata: { param: '$where', template: 'within_box(location, {north}, {west}, {south}, {east})' },
  ogc: { param: 'bbox', template: '{west},{south},{east},{north}' },
} as const;

export const AREA_MODES = ['none', 'opendatasoft', 'socrata', 'ogc', 'custom'] as const;
export type AreaMode = (typeof AREA_MODES)[number];

/** Which style the typed settings are: a preset when they match one exactly, "other" when set, else none. */
export function areaModeOf(param: string, template: string): AreaMode {
  if (param === '' && template === '') {
    return 'none';
  }
  const preset = (Object.keys(AREA_PRESETS) as ReadonlyArray<keyof typeof AREA_PRESETS>).find(
    (key) => AREA_PRESETS[key].param === param && AREA_PRESETS[key].template === template,
  );
  return preset ?? 'custom';
}

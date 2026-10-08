import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

/**
 * A map of whatever geographic data the municipality has connected. The
 * editor binds datasets, never URLs: each dataset prop names the canonical
 * kind it accepts, so the properties panel only offers matching datasets.
 *
 * The option lists mirror the map module's `PointStyle`, `FeatureInteraction`
 * and `MapHeight`; the renderer assigns them to those types, so a value one
 * side lacks fails to compile instead of drifting.
 */
export const mapDefinition = defineComponent({
  type: 'map',
  category: 'smartcity',
  municipallyEditable: true,
  props: {
    primaryDatasetId: prop.dataset('GeoFeature'),
    secondaryDatasetId: prop.dataset('GeoFeature'),
    heading: prop.text(PROP_LIMITS.heading, {
      group: 'content',
      municipal: true,
    }),
    pointStyle: prop.select(['circles', 'markers', 'clusters', 'heatmap'], 'circles', {
      group: 'appearance',
      municipal: true,
    }),
    colorBy: prop.text(PROP_LIMITS.label, {
      group: 'appearance',
      municipal: true,
    }),
    sizeBy: prop.text(PROP_LIMITS.label, {
      group: 'appearance',
      municipal: true,
    }),
    interaction: prop.select(['details', 'link', 'none'], 'details', {
      group: 'appearance',
      municipal: true,
    }),
    height: prop.select(['standard', 'compact', 'tall'], 'standard', {
      group: 'appearance',
      municipal: true,
    }),
    showFilters: prop.switch(true, { group: 'appearance', municipal: true }),
    showLegend: prop.switch(true, { group: 'appearance', municipal: true }),
  },
});

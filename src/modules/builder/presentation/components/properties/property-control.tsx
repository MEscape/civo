import type { ComponentType } from 'react';

import type { PropControl } from '@modules/component-platform/client';

import { BookingCategoryControl } from './controls/booking-category-control';
import { BookingServiceControl } from './controls/booking-service-control';
import { CategoryControl } from './controls/category-control';
import { ColumnsControl } from './controls/columns-control';
import { DatasetControl } from './controls/dataset-control';
import { DatasetsControl } from './controls/datasets-control';
import { ItemsControl } from './controls/items-control';
import { MapControl } from './controls/map-control';
import { MediaControl } from './controls/media-control';
import { NumberControl } from './controls/number-control';
import { SelectControl } from './controls/select-control';
import { SwitchControl } from './controls/switch-control';
import { TextControl } from './controls/text-control';
import { TextareaControl } from './controls/textarea-control';

import type { ControlProps } from './controls/control-props';

const CONTROLS: Readonly<Record<PropControl, ComponentType<ControlProps>>> = {
  text: TextControl,
  textarea: TextareaControl,
  number: NumberControl,
  select: SelectControl,
  columns: ColumnsControl,
  switch: SwitchControl,
  dataset: DatasetControl,
  datasets: DatasetsControl,
  category: CategoryControl,
  items: ItemsControl,
  media: MediaControl,
  map: MapControl,
  'booking-service': BookingServiceControl,
  'booking-category': BookingCategoryControl,
};

/**
 * One control per descriptor `control` kind. Each emits only values from a
 * bounded set (an option, a column count, a finite number, plain text, the id of an uploaded file),
 * never CSS or markup; a list of entries is
 * made of those same plain values. A new control kind fails to compile here until it
 * has a component.
 */
export function PropertyControl(props: ControlProps) {
  const Control = CONTROLS[props.field.control];
  return <Control {...props} />;
}

import { interfaceIcons } from './interface-icons';
import { symbolIcons } from './symbol-icons';

import type { IconProps } from '../../types/icons';

export type { IconProps };

/** Every icon shares one 24x24 stroke canvas (see `icon-factory.tsx`); this is the one object to import them from. */
export const Icons = { ...interfaceIcons, ...symbolIcons };

// Named exports — allow importing icons by PascalCase name as an alternative
// to the `Icons` object, e.g. `import { Undo2, GripVertical } from '@components/icons/icons'`.
export const Calendar = Icons.calendar;
export const Spinner = Icons.spinner;
export const Check = Icons.check;
export const ChevronRight = Icons.chevronRight;
export const Close = Icons.close;
export const GripVertical = Icons.gripVertical;
export const Copy = Icons.copy;
export const Trash2 = Icons.trash2;
export const ChevronUp = Icons.chevronUp;
export const ChevronDown = Icons.chevronDown;
export const AlertTriangle = Icons.alertTriangle;
export const Undo2 = Icons.undo2;
export const Redo2 = Icons.redo2;
export const Eye = Icons.eye;
export const Pencil = Icons.pencil;
export const Monitor = Icons.monitor;
export const FileText = Icons.fileText;
export const Tablet = Icons.tablet;
export const Smartphone = Icons.smartphone;
export const ArrowLeft = Icons.arrowLeft;
export const ExternalLink = Icons.externalLink;
export const PanelLeft = Icons.panelLeft;
export const PanelRight = Icons.panelRight;
export const UploadCloud = Icons.uploadCloud;
export const AlertOctagon = Icons.alertOctagon;
export const Info = Icons.info;
export const Mail = Icons.mail;
export const Phone = Icons.phone;
export const ArrowRight = Icons.arrowRight;
export const Search = Icons.search;
export const Minus = Icons.minus;
export const Plus = Icons.plus;
export const RefreshCw = Icons.refreshCw;
export const TrendingUp = Icons.trendingUp;
export const TrendingDown = Icons.trendingDown;
export const EyeOff = Icons.eyeOff;
export const Lock = Icons.lock;
export const KeyRound = Icons.keyRound;
export const UserPlus = Icons.userPlus;
export const MailCheck = Icons.mailCheck;
export const ShieldCheck = Icons.shieldCheck;
export const MapPin = Icons.mapPin;
export const MoreHorizontal = Icons.moreHorizontal;
export const Circle = Icons.circle;
export const Link2 = Icons.link;

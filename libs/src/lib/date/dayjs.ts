import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

import { APP_TIMEZONE } from './timezone';

// The one configured instance. Import dayjs from '@masr3/libs/date', never from
// 'dayjs' directly, so every service gets the same plugins.
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault(APP_TIMEZONE);

export { dayjs };
export type { Dayjs } from 'dayjs';

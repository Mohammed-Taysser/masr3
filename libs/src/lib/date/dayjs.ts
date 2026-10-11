import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

// The one configured instance. Import dayjs from '@masr3/libs', never from
// 'dayjs' directly, so every service gets the same plugins.
dayjs.extend(utc);
dayjs.extend(timezone);

export { dayjs };
export type { Dayjs } from 'dayjs';

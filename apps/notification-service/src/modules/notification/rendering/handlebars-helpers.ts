import { HelperDelegate } from 'handlebars';

import { dayjs } from '@masr3/libs/date';

// Formatting lives in templates through these helpers, so handlers pass raw
// values. Handlebars appends its options object as an extra last argument,
// which the typed parameters ignore.
const NOTIFICATION_HELPERS = {
  // {{money fare currency}} → EGP 95.00
  money: (amount: number, currency: string): string =>
    `${currency} ${Number(amount).toFixed(2)}`,
  // {{date occurredAt}} → Thursday, 1 October 2026 at 08:04 UTC
  date: (iso: string): string =>
    dayjs.utc(iso).format('dddd, D MMMM YYYY [at] HH:mm [UTC]'),
  // {{#if (eq cancelledBy "DRIVER")}}
  eq: (left: unknown, right: unknown): boolean => left === right,
} satisfies Record<string, HelperDelegate>;

type NotificationHelperName = keyof typeof NOTIFICATION_HELPERS;

export { NOTIFICATION_HELPERS };
export type { NotificationHelperName };

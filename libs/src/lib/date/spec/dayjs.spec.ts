import { dayjs } from '../dayjs';

describe('shared dayjs', () => {
  const iso = '2026-10-01T08:04:09.000Z';

  it('has the utc plugin, so formatting does not depend on the host timezone', () => {
    expect(dayjs.utc(iso).format('dddd, D MMMM YYYY [at] HH:mm [UTC]')).toBe(
      'Thursday, 1 October 2026 at 08:04 UTC',
    );
  });

  it('has the timezone plugin', () => {
    // Cairo is UTC+3 in October (daylight saving).
    expect(dayjs.utc(iso).tz('Africa/Cairo').format('HH:mm')).toBe('11:04');
  });

  it('round-trips an ISO timestamp', () => {
    expect(dayjs(iso).toISOString()).toBe(iso);
  });

  it('adds and diffs durations', () => {
    const later = dayjs(iso).add(600_000, 'millisecond');

    expect(later.diff(dayjs(iso), 'minute')).toBe(10);
    expect(later.toDate()).toBeInstanceOf(Date);
  });
});

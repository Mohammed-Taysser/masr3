// Every service, database and timestamp runs in this zone. Convert to a user's
// zone only when formatting for display.
const APP_TIMEZONE = 'UTC';

// Each main.ts imports '@masr3/libs/timezone' first: Node fixes a formatter's
// zone when it is created, and Nest creates its log formatter on import.
process.env['TZ'] = APP_TIMEZONE;

export { APP_TIMEZONE };

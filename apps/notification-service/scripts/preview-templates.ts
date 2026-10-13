import 'reflect-metadata';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { ConfigService } from '@nestjs/config';

import { dayjs } from '@masr3/libs';

import {
  DEFAULT_LOCALE,
  NOTIFICATION_CATALOG,
} from '../src/modules/notification/notification.constant';
import {
  NotificationChannelEnum,
  NotificationTypeEnum,
  TripCancelledByEnum,
} from '../src/modules/notification/notification.enum';
import {
  NotificationDataMap,
  NotificationSecrets,
  RenderedMessage,
} from '../src/modules/notification/notification.interface';
import RendererService from '../src/modules/notification/rendering/renderer.service';
import TemplateRegistryService from '../src/modules/notification/rendering/template-registry.service';

// Renders every notification type on each of its default channels through the
// real renderer, so a preview is exactly what would be sent. Nothing is sent.

const OUT_DIR = path.resolve(
  process.argv[2] ?? path.join(process.cwd(), 'dist', 'notification-previews'),
);

const now = dayjs();
const trip = {
  tripId: 42,
  pickupAddress: 'Tahrir Square, Cairo',
  dropoffAddress: '26th of July Street, Zamalek',
};

const SAMPLE_DATA: NotificationDataMap = {
  [NotificationTypeEnum.WELCOME]: { email: 'demo.customer@masr3.local' },
  [NotificationTypeEnum.NEW_LOGIN]: {
    occurredAt: now.toISOString(),
    ip: '203.0.113.42',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0',
  },
  [NotificationTypeEnum.PASSWORD_CHANGED]: { occurredAt: now.toISOString() },
  [NotificationTypeEnum.PASSWORD_RESET]: { expiresInMinutes: 10 },
  [NotificationTypeEnum.PASSWORD_RESET_COMPLETED]: {
    occurredAt: now.toISOString(),
  },
  [NotificationTypeEnum.TRIP_CONFIRMED]: {
    ...trip,
    fare: 95,
    currency: 'EGP',
    driverName: 'Omar Driver',
  },
  [NotificationTypeEnum.TRIP_ASSIGNED]: {
    ...trip,
    fare: 95,
    currency: 'EGP',
    customerFirstName: 'Demo',
  },
  [NotificationTypeEnum.TRIP_RECEIPT]: {
    ...trip,
    fare: 95,
    currency: 'EGP',
    completedAt: now.toISOString(),
    driverName: 'Omar Driver',
  },
  [NotificationTypeEnum.TRIP_CANCELLED]: {
    ...trip,
    cancelledBy: TripCancelledByEnum.DRIVER,
    reason: 'Car broke down',
  },
  [NotificationTypeEnum.TRIP_EXPIRED]: { ...trip, fare: 85, currency: 'EGP' },
};

const SAMPLE_SECRETS: Partial<
  Record<NotificationTypeEnum, NotificationSecrets>
> = {
  [NotificationTypeEnum.PASSWORD_RESET]: {
    resetUrl: 'http://localhost:3000/reset-password?token=preview-token',
  },
};

const SAMPLE_ADDRESSES: Record<NotificationChannelEnum, string> = {
  [NotificationChannelEnum.EMAIL]: 'demo.customer@masr3.local',
  [NotificationChannelEnum.SMS]: '+201000000000',
  [NotificationChannelEnum.WHATSAPP]: '+201000000000',
  [NotificationChannelEnum.PUSH]: 'device-token',
  [NotificationChannelEnum.IN_APP]: '1',
};

interface Preview {
  type: NotificationTypeEnum;
  channel: NotificationChannelEnum;
  files: string[];
  summary: string;
}

const renderer = new RendererService(new TemplateRegistryService(), {
  getOrThrow: () => 'Masr3',
} as unknown as ConfigService);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function write(
  base: string,
  message: RenderedMessage,
): { files: string[]; summary: string } {
  if ('html' in message) {
    fs.writeFileSync(path.join(OUT_DIR, `${base}.html`), message.html);
    fs.writeFileSync(path.join(OUT_DIR, `${base}.txt`), message.text);

    return { files: [`${base}.html`, `${base}.txt`], summary: message.subject };
  }

  const text =
    'text' in message ? message.text : `${message.title}\n\n${message.body}`;

  fs.writeFileSync(path.join(OUT_DIR, `${base}.txt`), text);

  return { files: [`${base}.txt`], summary: text.split('\n')[0] };
}

function renderIndex(previews: Preview[]): string {
  const rows = previews
    .map(
      (preview) => `      <li>
        <strong>${preview.type}</strong> <span class="channel">${preview.channel}</span>
        <span class="subject">${escapeHtml(preview.summary)}</span>
        <span class="links">${preview.files.map((file) => `<a href="${file}">${path.extname(file).slice(1)}</a>`).join(' · ')}</span>
      </li>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Notification previews</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 760px; margin: 40px auto; padding: 0 16px; color: #0f172a; }
      li { display: grid; gap: 2px; padding: 12px 0; border-bottom: 1px solid #e2e8f0; list-style: none; }
      ul { padding: 0; }
      .channel { font-size: 12px; color: #0f5c4d; font-weight: 600; }
      .subject { color: #475569; }
      .links { font-size: 14px; }
      p { color: #64748b; }
    </style>
  </head>
  <body>
    <h1>Notification previews</h1>
    <p>${previews.length} renders · locale ${DEFAULT_LOCALE} · generated ${escapeHtml(now.utc().format('D MMMM YYYY, HH:mm [UTC]'))}.</p>
    <ul>
${rows}
    </ul>
  </body>
</html>
`;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const previews: Preview[] = [];

  for (const [type, entry] of Object.entries(NOTIFICATION_CATALOG) as [
    NotificationTypeEnum,
    (typeof NOTIFICATION_CATALOG)[NotificationTypeEnum],
  ][]) {
    for (const channel of entry.defaultChannels) {
      const message = renderer.render({
        type,
        channel,
        locale: DEFAULT_LOCALE,
        firstName: 'Demo',
        address: SAMPLE_ADDRESSES[channel],
        data: SAMPLE_DATA[type],
        secrets: SAMPLE_SECRETS[type],
      });
      const base = `${type.toLowerCase()}.${channel.toLowerCase()}`;

      previews.push({ type, channel, ...write(base, message) });
      console.log(`Rendered ${type} ${channel}`);
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), renderIndex(previews));

  console.log(`\n${previews.length} previews written to ${OUT_DIR}`);
  console.log(`Open ${path.join(OUT_DIR, 'index.html')}`);
}

main();

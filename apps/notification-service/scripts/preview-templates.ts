import 'reflect-metadata';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';

import { dayjs } from '@masr3/libs';

import MailService from '../src/modules/mail/mail.service';
import { SendMailOptions } from '../src/modules/mail/mail.interface';
import NotificationEntity from '../src/modules/notification/entities/notification.entity';
import { NotificationTemplateEnum } from '../src/modules/notification/notification.enum';
import NotificationService from '../src/modules/notification/notification.service';
import TemplateService from '../src/modules/notification/templates/template.service';

/**
 * Renders every template through the real NotificationService handlers, so a
 * preview is exactly what would be sent. Nothing is sent and nothing is
 * stored: the mail transport and repository are in-memory stand-ins.
 */

const OUT_DIR = path.resolve(
  process.argv[2] ?? path.join(process.cwd(), 'dist', 'email-previews'),
);

interface Preview {
  template: NotificationTemplateEnum;
  sent: SendMailOptions;
  stored: string | null;
}

const config: Record<string, string> = {
  APP_NAME: 'Masr3',
  PASSWORD_RESET_URL_BASE: 'http://localhost:3000/reset-password',
  MAIL_FROM: 'Masr3 <no-reply@masr3.local>',
};

const configService = {
  get: (key: string) => config[key],
  getOrThrow: (key: string) => {
    if (!(key in config)) {
      throw new Error(`Preview config is missing ${key}`);
    }

    return config[key];
  },
} as unknown as ConfigService;

let lastSent: SendMailOptions | null = null;

const mailService = {
  sendMail: async (options: SendMailOptions) => {
    lastSent = options;
  },
} as unknown as MailService;

const repository = {
  create: (row: Partial<NotificationEntity>) => row,
  save: async (row: NotificationEntity) => row,
} as unknown as Repository<NotificationEntity>;

const service = new NotificationService(
  configService,
  mailService,
  new TemplateService(),
  repository,
);

const now = dayjs();

const base = {
  occurredAt: now.toISOString(),
  userId: 1,
  email: 'demo.customer@masr3.local',
  firstName: 'Demo',
};

const event = (template: NotificationTemplateEnum) => ({
  ...base,
  eventId: `preview-${template}`,
});

const renderers: Record<
  NotificationTemplateEnum,
  () => Promise<NotificationEntity | null>
> = {
  [NotificationTemplateEnum.WELCOME]: () =>
    service.handleUserRegistered(event(NotificationTemplateEnum.WELCOME)),
  [NotificationTemplateEnum.NEW_LOGIN]: () =>
    service.handleUserLoggedIn({
      ...event(NotificationTemplateEnum.NEW_LOGIN),
      ip: '203.0.113.42',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0',
    }),
  [NotificationTemplateEnum.PASSWORD_CHANGED]: () =>
    service.handleUserChangedPassword(
      event(NotificationTemplateEnum.PASSWORD_CHANGED),
    ),
  [NotificationTemplateEnum.PASSWORD_RESET]: () =>
    service.handlePasswordResetRequested({
      ...event(NotificationTemplateEnum.PASSWORD_RESET),
      resetToken: 'a-real-looking-reset-token-0123456789abcdef',
      expiresAt: now.add(10, 'minute').toISOString(),
    }),
  [NotificationTemplateEnum.PASSWORD_RESET_COMPLETED]: () =>
    service.handlePasswordResetCompleted(
      event(NotificationTemplateEnum.PASSWORD_RESET_COMPLETED),
    ),
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderIndex(previews: Preview[]): string {
  const rows = previews
    .map(({ template, sent, stored }) => {
      const storedLink =
        stored !== null && stored !== sent.html
          ? ` · <a href="${template}.stored.html">stored copy</a>`
          : '';

      return `      <li>
        <strong>${escapeHtml(template)}</strong>
        <span class="subject">${escapeHtml(sent.subject)}</span>
        <span class="links"><a href="${template}.html">html</a> · <a href="${template}.txt">text</a>${storedLink}</span>
      </li>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Email previews</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 16px; color: #0f172a; }
      li { display: grid; gap: 2px; padding: 12px 0; border-bottom: 1px solid #e2e8f0; list-style: none; }
      ul { padding: 0; }
      .subject { color: #475569; }
      .links { font-size: 14px; }
      p { color: #64748b; }
    </style>
  </head>
  <body>
    <h1>Email previews</h1>
    <p>${previews.length} templates · generated ${escapeHtml(now.utc().format('D MMMM YYYY, HH:mm [UTC]'))}. A "stored copy" is what is saved in the notifications table when it differs from what is sent (the reset token is masked).</p>
    <ul>
${rows}
    </ul>
  </body>
</html>
`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const previews: Preview[] = [];

  for (const template of Object.values(NotificationTemplateEnum)) {
    lastSent = null;

    const row = await renderers[template]();

    if (!lastSent) {
      throw new Error(`Template ${template} produced no email`);
    }

    const sent: SendMailOptions = lastSent;

    fs.writeFileSync(path.join(OUT_DIR, `${template}.html`), sent.html);
    fs.writeFileSync(path.join(OUT_DIR, `${template}.txt`), sent.text);

    const stored = row?.body ?? null;

    if (stored !== null && stored !== sent.html) {
      fs.writeFileSync(path.join(OUT_DIR, `${template}.stored.html`), stored);
    }

    previews.push({ template, sent, stored });

    console.log(`Rendered ${template}`);
  }

  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), renderIndex(previews));

  console.log(`\n${previews.length} previews written to ${OUT_DIR}`);
  console.log(`Open ${path.join(OUT_DIR, 'index.html')}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

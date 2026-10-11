import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import {
  dayjs,
  PasswordResetCompletedEvent,
  PasswordResetRequestedEvent,
  UserChangedPasswordEvent,
  UserLoggedInEvent,
  UserLoggedOutEvent,
  UserRegisteredEvent,
} from '@masr3/libs';

import MailService from '../mail/mail.service';
import NotificationEntity from './entities/notification.entity';
import { MASKED_TOKEN, PG_UNIQUE_VIOLATION } from './notification.constant';
import {
  NotificationChannelEnum,
  NotificationStatusEnum,
  NotificationTemplateEnum,
} from './notification.enum';
import {
  SendNotificationCommand,
  TemplateVars,
} from './notification.interface';
import TemplateService from './templates/template.service';

@Injectable()
class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly appName = this.configService.getOrThrow<string>('APP_NAME');

  constructor(
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly templateService: TemplateService,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
  ) {}

  /**
   * The single delivery path.
   *
   * The PENDING insert is the idempotency claim: `eventId` is unique, so a
   * redelivered event fails the insert and is skipped (returns null) instead
   * of sending a second email.
   *
   * A delivery failure does not throw — it becomes a FAILED row. Anything that
   * does throw (the database being down) propagates, so the consumer does not
   * commit the offset and Kafka redelivers.
   */
  async send(
    command: SendNotificationCommand,
  ): Promise<NotificationEntity | null> {
    const notification = await this.claim(command);

    if (!notification) {
      return null;
    }

    try {
      if (command.channel !== NotificationChannelEnum.EMAIL) {
        throw new Error(`No transport for channel ${command.channel} yet`);
      }

      await this.mailService.sendMail({
        to: command.recipient,
        subject: command.subject,
        html: command.html ?? command.text,
        text: command.text,
      });

      notification.status = NotificationStatusEnum.SENT;
    } catch (error) {
      notification.status = NotificationStatusEnum.FAILED;
      notification.error = (error as Error).message;

      this.logger.warn(
        `Delivery failed [${command.template}] to ${command.recipient}: ${notification.error}`,
      );
    }

    return this.notificationRepository.save(notification);
  }

  async handleUserRegistered(event: UserRegisteredEvent) {
    return this.sendEmail(
      event.eventId,
      event.email,
      NotificationTemplateEnum.WELCOME,
      `Welcome to ${this.appName}`,
      {
        title: `Welcome to ${this.appName}`,
        preheader: 'Your account is ready to use.',
        greeting: `Hi ${event.firstName},`,
        footer: `You're getting this because an account was created on ${this.appName} with ${event.email}.`,
        appName: this.appName,
        email: event.email,
      },
    );
  }

  async handleUserLoggedIn(event: UserLoggedInEvent) {
    const when = NotificationService.formatWhen(event.occurredAt);

    const details: [string, string][] = [['Time', when]];

    if (event.ip) {
      details.push(['IP address', event.ip]);
    }

    if (event.userAgent) {
      details.push(['Device', event.userAgent]);
    }

    return this.sendEmail(
      event.eventId,
      event.email,
      NotificationTemplateEnum.NEW_LOGIN,
      `New sign-in to your ${this.appName} account`,
      {
        title: 'New sign-in to your account',
        preheader: `Signed in on ${when}. Not you? Change your password.`,
        greeting: `Hi ${event.firstName},`,
        footer: `This is a security notice for ${event.email}. You can't turn these off.`,
        appName: this.appName,
        when,
        detailsText: details
          .map(([label, value]) => `${label}: ${value}`)
          .join('\n'),
      },
      {
        details: details
          .map(([label, value]) =>
            this.templateService.renderPartial('detail-row', { label, value }),
          )
          .join(''),
      },
    );
  }

  async handleUserLoggedOut(event: UserLoggedOutEvent) {
    this.logger.debug(`User ${event.userId} logged out; nothing to send`);

    return null;
  }

  async handleUserChangedPassword(event: UserChangedPasswordEvent) {
    return this.sendEmail(
      event.eventId,
      event.email,
      NotificationTemplateEnum.PASSWORD_CHANGED,
      'Your password was changed',
      {
        title: 'Your password was changed',
        preheader: "If you didn't make this change, reset your password now.",
        greeting: `Hi ${event.firstName},`,
        footer: `This is a security notice for ${event.email}. You can't turn these off.`,
        appName: this.appName,
        when: NotificationService.formatWhen(event.occurredAt),
      },
    );
  }

  /**
   * Renders twice from the same variables: once with the live link for the
   * recipient, once with the token masked for the stored `body`, so the raw
   * token never reaches the database.
   */
  async handlePasswordResetRequested(event: PasswordResetRequestedEvent) {
    const resetUrlBase = this.configService.getOrThrow<string>(
      'PASSWORD_RESET_URL_BASE',
    );

    const expiresInMinutes = String(
      NotificationService.minutesUntil(event.expiresAt, event.occurredAt),
    );

    const build = (token: string) =>
      this.templateService.render(
        NotificationTemplateEnum.PASSWORD_RESET,
        'Reset your password',
        {
          title: 'Reset your password',
          preheader: `Use this link within ${expiresInMinutes} minutes to choose a new password.`,
          greeting: `Hi ${event.firstName},`,
          footer: `This reset was requested for ${event.email}. You can't turn these off.`,
          appName: this.appName,
          expiresInMinutes,
          resetUrl: `${resetUrlBase}?token=${encodeURIComponent(token)}`,
        },
      );

    const delivered = build(event.resetToken);
    const persisted = build(MASKED_TOKEN);

    return this.send({
      eventId: event.eventId,
      channel: NotificationChannelEnum.EMAIL,
      recipient: event.email,
      template: NotificationTemplateEnum.PASSWORD_RESET,
      subject: delivered.subject,
      text: delivered.text,
      html: delivered.html,
      persistedBody: persisted.html,
    });
  }

  async handlePasswordResetCompleted(event: PasswordResetCompletedEvent) {
    return this.sendEmail(
      event.eventId,
      event.email,
      NotificationTemplateEnum.PASSWORD_RESET_COMPLETED,
      'Your password has been reset',
      {
        title: 'Your password has been reset',
        preheader: 'You can now sign in with your new password.',
        greeting: `Hi ${event.firstName},`,
        footer: `This is a security notice for ${event.email}. You can't turn these off.`,
        appName: this.appName,
        when: NotificationService.formatWhen(event.occurredAt),
      },
    );
  }

  private async claim(
    command: SendNotificationCommand,
  ): Promise<NotificationEntity | null> {
    try {
      return await this.notificationRepository.save(
        this.notificationRepository.create({
          eventId: command.eventId,
          channel: command.channel,
          recipient: command.recipient,
          template: command.template,
          subject: command.subject,
          body: command.persistedBody ?? command.html ?? command.text,
          status: NotificationStatusEnum.PENDING,
          error: null,
        }),
      );
    } catch (error) {
      if (NotificationService.isUniqueViolation(error)) {
        this.logger.debug(`Event ${command.eventId} already handled; skipping`);

        return null;
      }

      throw error;
    }
  }

  private sendEmail(
    eventId: string,
    recipient: string,
    template: NotificationTemplateEnum,
    subject: string,
    vars: TemplateVars,
    htmlFragments?: TemplateVars,
  ) {
    const content = this.templateService.render(
      template,
      subject,
      vars,
      htmlFragments,
    );

    return this.send({
      eventId,
      channel: NotificationChannelEnum.EMAIL,
      recipient,
      template,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
  }

  // "Thursday, 1 October 2026 at 08:04 UTC" — readable, and unambiguous
  // about the timezone.
  private static formatWhen(iso: string): string {
    return dayjs.utc(iso).format('dddd, D MMMM YYYY [at] HH:mm [UTC]');
  }

  private static minutesUntil(expiresAt: string, from: string): number {
    return Math.max(
      1,
      Math.round(dayjs(expiresAt).diff(dayjs(from), 'minute', true)),
    );
  }

  private static isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION
    );
  }
}

export default NotificationService;

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

import { SendMailOptions } from './mail.interface';

@Injectable()
class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.getOrThrow<string>('MAIL_HOST');
    const port = this.configService.getOrThrow<number>('MAIL_PORT');
    const secure = this.configService.getOrThrow<boolean>('MAIL_SECURE');
    const user = this.configService.get<string>('MAIL_USER');
    const password = this.configService.get<string>('MAIL_PASSWORD');

    // Credentials, not TLS, decide whether to authenticate: Mailhog has
    // neither, a plain-port relay can have credentials without TLS.
    const auth = user ? { user, pass: password } : undefined;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth,
    });

    try {
      await this.transporter.verify();

      this.logger.log(`SMTP connection verified (${host}:${port})`);
    } catch (error) {
      // Not fatal: a send that fails later is retried, then marked FAILED.
      this.logger.warn(
        `SMTP connection could not be verified: ${(error as Error).message}`,
      );
    }
  }

  // Returns the transport's message id.
  async sendMail(options: SendMailOptions): Promise<string> {
    const info = await this.transporter.sendMail({
      from: this.configService.getOrThrow<string>('MAIL_FROM'),
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments?.map((attachment) => ({
        filename: attachment.filename,
        contentType: attachment.contentType,
        href: attachment.url,
      })),
    });

    return info.messageId;
  }
}

export default MailService;

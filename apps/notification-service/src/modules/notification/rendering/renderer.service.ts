import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  CATEGORY_ACCENTS,
  EMAIL_HTML_LAYOUT,
  EMAIL_TEXT_LAYOUT,
  NOTIFICATION_CATALOG,
  RIGHT_TO_LEFT_LOCALES,
} from '../notification.constant';
import {
  NotificationCategoryEnum,
  NotificationChannelEnum,
  TemplatePartEnum,
} from '../notification.enum';
import {
  RenderedEmail,
  RenderInput,
  RenderedMessage,
  RenderedShortMessage,
  RenderedText,
} from '../notification.interface';
import TemplateRegistryService from './template-registry.service';

@Injectable()
class RendererService {
  private readonly appName: string;

  constructor(
    private readonly registry: TemplateRegistryService,
    configService: ConfigService,
  ) {
    this.appName = configService.getOrThrow<string>('APP_NAME');
  }

  render(request: RenderInput): RenderedMessage {
    const input = {
      ...request,
      locale: this.registry.resolveLocale(request.type, request.locale),
    };

    switch (input.channel) {
      case NotificationChannelEnum.EMAIL:
        return this.renderEmail(input);
      case NotificationChannelEnum.PUSH:
      case NotificationChannelEnum.IN_APP:
        return this.renderShortMessage(input);
      case NotificationChannelEnum.SMS:
      case NotificationChannelEnum.WHATSAPP:
        return this.renderText(input);
    }
  }

  private renderEmail(input: RenderInput): RenderedEmail {
    const { category } = NOTIFICATION_CATALOG[input.type];
    const variables = this.variables(input);

    const subject = this.part(input, TemplatePartEnum.EMAIL_SUBJECT, variables);

    const footer = this.registry
      .footer(
        category,
        input.locale,
      )(variables)
      .trim();

    const chrome = {
      ...variables,
      title: subject,
      preheader: this.part(input, TemplatePartEnum.EMAIL_PREHEADER, variables),
      footer,
      accent: CATEGORY_ACCENTS[category],
      isSecurity: category === NotificationCategoryEnum.SECURITY,
      direction: RIGHT_TO_LEFT_LOCALES.includes(input.locale) ? 'rtl' : 'ltr',
      locale: input.locale,
    };

    return {
      subject,
      html: this.registry.layout(EMAIL_HTML_LAYOUT)({
        ...chrome,
        content: this.registry.part(
          input.type,
          TemplatePartEnum.EMAIL_HTML,
          input.locale,
        )(variables),
      }),
      text: this.registry.layout(EMAIL_TEXT_LAYOUT)({
        ...chrome,
        content: this.part(input, TemplatePartEnum.EMAIL_TEXT, variables),
      }),
      attachments: input.attachments ?? [],
    };
  }

  private renderShortMessage(input: RenderInput): RenderedShortMessage {
    const variables = this.variables(input);

    return {
      title: this.part(input, TemplatePartEnum.TITLE, variables),
      body: this.part(input, TemplatePartEnum.BODY, variables),
      deepLink: this.registry.deepLink(input.type)?.(input.data) ?? null,
    };
  }

  private renderText(input: RenderInput): RenderedText {
    return {
      text: this.part(
        input,
        TemplatePartEnum.SHORT_TEXT,
        this.variables(input),
      ),
    };
  }

  private part(
    input: RenderInput,
    part: TemplatePartEnum,
    variables: object,
  ): string {
    return this.registry.part(input.type, part, input.locale)(variables).trim();
  }

  private variables(input: RenderInput): object {
    return {
      ...input.data,
      ...input.secrets,
      appName: this.appName,
      firstName: input.firstName,
      address: input.address,
    };
  }
}

export default RendererService;

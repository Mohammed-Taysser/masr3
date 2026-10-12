import { Injectable } from '@nestjs/common';
import Handlebars from 'handlebars';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, join } from 'path';

import {
  CHANNEL_TEMPLATE_PARTS,
  DEFAULT_LOCALE,
  EMAIL_HTML_LAYOUT,
  EMAIL_TEXT_LAYOUT,
  NOTIFICATION_CATALOG,
  TEMPLATE_EXTENSION,
  TEMPLATE_FOOTERS_DIRECTORY,
  TEMPLATE_LAYOUTS_DIRECTORY,
  TEMPLATE_PART_FILES,
  TEMPLATE_PARTIALS_DIRECTORY,
} from '../notification.constant';
import {
  NotificationCategoryEnum,
  NotificationTypeEnum,
  TemplatePartEnum,
} from '../notification.enum';
import {
  NOTIFICATION_HELPERS,
  NotificationHelperName,
} from './handlebars-helpers';

type CompiledTemplate = HandlebarsTemplateDelegate;

// Template files document themselves in HTML comments; they are stripped so
// they never ship. Outlook's <!--[if mso]> conditionals are markup and stay.
const HTML_COMMENT = /<!--(?!\[if )[\s\S]*?-->\s*/g;
const TRIPLE_BRACE = /\{\{\{/;

// Loads and compiles every template once at boot. A catalog type without a
// template for one of its default channels fails startup, not a send.
@Injectable()
class TemplateRegistryService {
  private readonly handlebars = Handlebars.create();
  private readonly rootDirectory = TemplateRegistryService.findRootDirectory();
  private readonly templates = new Map<string, CompiledTemplate>();
  private readonly footers = new Map<string, CompiledTemplate>();
  private readonly deepLinks = new Map<
    NotificationTypeEnum,
    CompiledTemplate
  >();
  private readonly layouts = new Map<string, CompiledTemplate>();

  constructor() {
    for (const name of Object.keys(
      NOTIFICATION_HELPERS,
    ) as NotificationHelperName[]) {
      this.handlebars.registerHelper(name, NOTIFICATION_HELPERS[name]);
    }

    this.loadPartials();
    this.loadLayouts();
    this.loadFooters();
    this.loadTypeTemplates();
    this.compileDeepLinks();
    this.assertCatalogCovered();
  }

  part(
    type: NotificationTypeEnum,
    part: TemplatePartEnum,
    locale: string,
  ): CompiledTemplate {
    const template =
      this.templates.get(TemplateRegistryService.key(type, part, locale)) ??
      this.templates.get(
        TemplateRegistryService.key(type, part, DEFAULT_LOCALE),
      );

    if (!template) {
      throw new Error(`No ${part} template for ${type}`);
    }

    return template;
  }

  // The locale actually used: the requested one if the type has it, otherwise
  // the default, so the layout's direction matches the text it shows.
  resolveLocale(type: NotificationTypeEnum, locale: string): string {
    const hasLocale =
      this.templates.has(
        TemplateRegistryService.key(
          type,
          TemplatePartEnum.EMAIL_SUBJECT,
          locale,
        ),
      ) ||
      this.templates.has(
        TemplateRegistryService.key(type, TemplatePartEnum.TITLE, locale),
      );

    return hasLocale ? locale : DEFAULT_LOCALE;
  }

  footer(category: NotificationCategoryEnum, locale: string): CompiledTemplate {
    const footer =
      this.footers.get(`${category}|${locale}`) ??
      this.footers.get(`${category}|${DEFAULT_LOCALE}`);

    if (!footer) {
      throw new Error(`No footer for ${category}`);
    }

    return footer;
  }

  layout(name: string): CompiledTemplate {
    const layout = this.layouts.get(name);

    if (!layout) {
      throw new Error(`No ${name} layout`);
    }

    return layout;
  }

  deepLink(type: NotificationTypeEnum): CompiledTemplate | null {
    return this.deepLinks.get(type) ?? null;
  }

  private loadPartials() {
    for (const file of this.files(TEMPLATE_PARTIALS_DIRECTORY)) {
      this.handlebars.registerPartial(
        basename(file, TEMPLATE_EXTENSION),
        this.read(join(TEMPLATE_PARTIALS_DIRECTORY, file)),
      );
    }
  }

  private loadLayouts() {
    this.layouts.set(
      EMAIL_HTML_LAYOUT,
      this.compile(this.layoutSource(EMAIL_HTML_LAYOUT), true),
    );
    this.layouts.set(
      EMAIL_TEXT_LAYOUT,
      this.compile(this.layoutSource(EMAIL_TEXT_LAYOUT), false),
    );
  }

  // footers/<category>.<locale>.hbs, plain text: the layouts escape it.
  private loadFooters() {
    for (const file of this.files(TEMPLATE_FOOTERS_DIRECTORY)) {
      const [category, locale] = basename(file, TEMPLATE_EXTENSION).split('.');

      this.footers.set(
        `${category.toUpperCase()}|${locale}`,
        this.compile(this.read(join(TEMPLATE_FOOTERS_DIRECTORY, file)), false),
      );
    }
  }

  // <type-in-kebab-case>/<part>.<locale>.hbs
  private loadTypeTemplates() {
    const partsByFile = new Map(
      Object.entries(TEMPLATE_PART_FILES).map(([part, file]) => [
        file,
        part as TemplatePartEnum,
      ]),
    );

    for (const type of Object.values(NotificationTypeEnum)) {
      const directory = TemplateRegistryService.directoryOf(type);

      if (!existsSync(join(this.rootDirectory, directory))) {
        continue;
      }

      for (const file of this.files(directory)) {
        const [partFile, locale] = basename(file, TEMPLATE_EXTENSION).split(
          '.',
        );
        const part = partsByFile.get(partFile);

        if (!part || !locale) {
          throw new Error(`Unexpected template file ${directory}/${file}`);
        }

        const source = this.read(join(directory, file));

        if (TRIPLE_BRACE.test(source)) {
          throw new Error(
            `${directory}/${file} uses {{{ }}}, which skips escaping; only layouts may`,
          );
        }

        this.templates.set(
          TemplateRegistryService.key(type, part, locale),
          this.compile(source, part === TemplatePartEnum.EMAIL_HTML),
        );
      }
    }
  }

  private compileDeepLinks() {
    for (const [type, entry] of Object.entries(NOTIFICATION_CATALOG)) {
      if (entry.deepLink) {
        this.deepLinks.set(
          type as NotificationTypeEnum,
          this.compile(entry.deepLink, false),
        );
      }
    }
  }

  private assertCatalogCovered() {
    const missing: string[] = [];

    for (const [type, entry] of Object.entries(NOTIFICATION_CATALOG)) {
      const parts = new Set(
        entry.defaultChannels.flatMap(
          (channel) => CHANNEL_TEMPLATE_PARTS[channel],
        ),
      );

      for (const part of parts) {
        const key = TemplateRegistryService.key(
          type as NotificationTypeEnum,
          part,
          DEFAULT_LOCALE,
        );

        if (!this.templates.has(key)) {
          missing.push(
            `${TemplateRegistryService.directoryOf(type as NotificationTypeEnum)}/${TEMPLATE_PART_FILES[part]}.${DEFAULT_LOCALE}${TEMPLATE_EXTENSION}`,
          );
        }
      }
    }

    for (const category of Object.values(NotificationCategoryEnum)) {
      if (!this.footers.has(`${category}|${DEFAULT_LOCALE}`)) {
        missing.push(
          `${TEMPLATE_FOOTERS_DIRECTORY}/${category.toLowerCase()}.${DEFAULT_LOCALE}${TEMPLATE_EXTENSION}`,
        );
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing notification templates: ${missing.join(', ')}`);
    }
  }

  // Only HTML is escaped; subjects, plain text, SMS and push are text.
  private compile(source: string, isHtml: boolean): CompiledTemplate {
    return this.handlebars.compile(source, {
      noEscape: !isHtml,
      strict: true,
    });
  }

  private layoutSource(name: string): string {
    return this.read(
      join(TEMPLATE_LAYOUTS_DIRECTORY, `${name}${TEMPLATE_EXTENSION}`),
    );
  }

  private files(directory: string): string[] {
    return readdirSync(join(this.rootDirectory, directory)).filter((file) =>
      file.endsWith(TEMPLATE_EXTENSION),
    );
  }

  private read(path: string): string {
    return readFileSync(join(this.rootDirectory, path), 'utf-8').replace(
      HTML_COMMENT,
      '',
    );
  }

  private static key(
    type: NotificationTypeEnum,
    part: TemplatePartEnum,
    locale: string,
  ): string {
    return `${type}|${part}|${locale}`;
  }

  private static directoryOf(type: NotificationTypeEnum): string {
    return type.toLowerCase().replace(/_/g, '-');
  }

  // Next to the bundle in dist (webpack assets), or next to the source.
  private static findRootDirectory(): string {
    const candidates = [
      join(__dirname, 'templates'),
      join(__dirname, '..', 'templates'),
    ];
    const found = candidates.find((directory) =>
      existsSync(join(directory, TEMPLATE_LAYOUTS_DIRECTORY)),
    );

    if (!found) {
      throw new Error(
        `Notification templates not found. Looked in: ${candidates.join(', ')}`,
      );
    }

    return found;
  }
}

export default TemplateRegistryService;

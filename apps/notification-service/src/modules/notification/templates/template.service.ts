import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import {
  ACCENT_ACCOUNT,
  ACCENT_SECURITY,
  SECURITY_TEMPLATES,
} from '../notification.constant';
import { NotificationTemplateEnum } from '../notification.enum';
import { EmailContent, TemplateVars } from '../notification.interface';

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

// Template files document their placeholders in HTML comments. Stripped on
// load, otherwise those placeholders are filled too and the comment ships in
// every email — with the live reset link in it. Outlook's `<!--[if mso]>`
// conditionals are markup, not documentation, and are kept.
const HTML_COMMENT = /<!--(?!\[if )[\s\S]*?-->\s*/g;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders `templates/html/<name>.html` into `layout.html` and
 * `templates/text/<name>.txt` into `layout.txt` from the same variables, so
 * the HTML and plain-text parts cannot drift apart.
 */
@Injectable()
class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  private readonly rootDir: string;
  private readonly cache = new Map<string, string>();

  constructor() {
    this.rootDir = TemplateService.resolveRootDir();
  }

  private static resolveRootDir(): string {
    const candidates = [__dirname, join(__dirname, 'templates')];

    const found = candidates.find((dir) => existsSync(join(dir, 'html')));

    if (!found) {
      throw new Error(
        `Email templates not found. Looked in: ${candidates.join(', ')}`,
      );
    }

    return found;
  }

  /**
   * `vars` are escaped into both the HTML and text parts. `htmlFragments` are
   * trusted markup inserted into the HTML part as-is — only ever pass the
   * output of `renderPartial`.
   */
  render(
    templateName: NotificationTemplateEnum,
    subject: string,
    vars: TemplateVars,
    htmlFragments: TemplateVars = {},
  ): EmailContent {
    const security = SECURITY_TEMPLATES.has(templateName);

    const layoutVars: TemplateVars = {
      title: vars.title ?? subject,
      preheader: vars.preheader ?? '',
      greeting: vars.greeting ?? '',
      footer: vars.footer ?? '',
      appName: vars.appName ?? '',
      accent: security ? ACCENT_SECURITY : ACCENT_ACCOUNT,
    };

    const layoutFragments: TemplateVars = {
      content: '',
      notice: security ? this.renderPartial('security-notice', {}) : '',
    };

    const htmlBody = this.fill(
      this.read('html', templateName, 'html'),
      { ...vars, ...htmlFragments },
      true,
      Object.keys(htmlFragments),
    );

    const textBody = this.fill(
      this.read('text', templateName, 'txt'),
      vars,
      false,
    );

    return {
      subject,
      html: this.fill(
        this.read('html', 'layout', 'html'),
        { ...layoutVars, ...layoutFragments, content: htmlBody },
        true,
        Object.keys(layoutFragments),
      ),
      text: this.fill(
        this.read('text', 'layout', 'txt'),
        { ...layoutVars, content: textBody },
        false,
      ),
    };
  }

  /** Renders `templates/html/partials/<name>.html` with every value escaped. */
  renderPartial(name: string, vars: TemplateVars): string {
    return this.fill(this.read('html', `partials/${name}`, 'html'), vars, true);
  }

  private read(kind: 'html' | 'text', name: string, extension: string): string {
    const path = join(this.rootDir, kind, `${name}.${extension}`);

    let contents = this.cache.get(path);

    if (contents === undefined) {
      contents = readFileSync(path, 'utf-8');

      if (kind === 'html') {
        contents = contents.replace(HTML_COMMENT, '');
      }

      this.cache.set(path, contents);
    }

    return contents;
  }

  private fill(
    template: string,
    vars: TemplateVars,
    escape: boolean,
    raw: string[] = [],
  ): string {
    return template.replace(PLACEHOLDER, (_match, key: string) => {
      if (!(key in vars)) {
        this.logger.warn(`Template references unknown variable "${key}"`);

        return '';
      }

      const value = vars[key];

      return escape && !raw.includes(key) ? escapeHtml(value) : value;
    });
  }
}

export default TemplateService;

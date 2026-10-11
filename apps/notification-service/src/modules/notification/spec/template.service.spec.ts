import { NotificationTemplateEnum } from '../notification.enum';
import TemplateService from '../templates/template.service';

describe('TemplateService', () => {
  const service = new TemplateService();

  const vars = {
    title: 'Title',
    greeting: 'Hi Demo,',
    footer: 'Footer',
    appName: 'Masr3',
    email: 'demo@example.com',
    when: 'now',
    detailsText: '',
    expiresInMinutes: '10',
    resetUrl: 'http://localhost/reset?token=t',
  };

  it.each(Object.values(NotificationTemplateEnum))(
    'renders %s in both parts with every placeholder filled',
    (template) => {
      const content = service.render(template, 'Subject', vars, {
        details: '',
      });

      expect(content.html).not.toMatch(/\{\{\s*\w+\s*\}\}/);
      expect(content.text).not.toMatch(/\{\{\s*\w+\s*\}\}/);
      expect(content.text.length).toBeGreaterThan(0);
    },
  );

  it('strips HTML comments so documented placeholders are never filled', () => {
    const { html } = service.render(
      NotificationTemplateEnum.PASSWORD_RESET,
      'Subject',
      vars,
    );

    // Outlook conditionals (`<!--[if mso]>`) are markup and must survive.
    expect(html).not.toMatch(/<!--(?!\[if )/);
    expect(html).toContain('<!--[if mso]>');
    // The button, plus the fallback link's href and visible text.
    expect(html.split(vars.resetUrl).length - 1).toBe(3);
  });

  it('wraps the body in the layout exactly once', () => {
    const { html } = service.render(
      NotificationTemplateEnum.WELCOME,
      'Subject',
      vars,
    );

    expect(html.match(/<!doctype html>/gi)).toHaveLength(1);
  });

  it('escapes vars but inserts html fragments as-is', () => {
    const { html } = service.render(
      NotificationTemplateEnum.NEW_LOGIN,
      'Subject',
      { ...vars, appName: '<b>x</b>' },
      { details: '<tr><td>row</td></tr>' },
    );

    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('<tr><td>row</td></tr>');
  });

  it('marks security emails with the signal band and notice', () => {
    const security = service.render(
      NotificationTemplateEnum.PASSWORD_RESET,
      'Subject',
      vars,
    ).html;
    const account = service.render(
      NotificationTemplateEnum.WELCOME,
      'Subject',
      vars,
    ).html;

    expect(security).toContain('Security notice');
    expect(security).toContain('border-top: 6px solid #E09A1A');
    expect(account).not.toContain('Security notice');
    expect(account).toContain('border-top: 6px solid #0F5C4D');
  });

  it('puts the preheader in the hidden inbox-preview block', () => {
    const { html } = service.render(
      NotificationTemplateEnum.WELCOME,
      'Subject',
      { ...vars, preheader: 'Your account is ready.' },
    );

    expect(html).toMatch(/display: none[^>]*>\s*Your account is ready\./);
  });

  it('escapes values in a partial', () => {
    expect(
      service.renderPartial('detail-row', { label: 'L', value: '<i>v</i>' }),
    ).toContain('&lt;i&gt;v&lt;/i&gt;');
  });
});

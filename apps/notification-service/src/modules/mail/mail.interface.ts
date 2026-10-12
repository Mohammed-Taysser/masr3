interface MailAttachment {
  filename: string;
  contentType: string;
  url: string;
}

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: MailAttachment[];
}

export type { MailAttachment, SendMailOptions };

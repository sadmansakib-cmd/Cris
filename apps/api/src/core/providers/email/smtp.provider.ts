import nodemailer, { Transporter } from 'nodemailer';
import type { EmailMessage, EmailProvider } from './email.interface';

export class SmtpEmailProvider implements EmailProvider {
  readonly id = 'smtp';
  private readonly transporter: Transporter;
  private readonly defaultFrom: string;

  constructor(cfg: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    pass?: string;
    from: string;
  }) {
    this.defaultFrom = cfg.from;
    this.transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
    });
  }

  async send(msg: EmailMessage) {
    const info = await this.transporter.sendMail({
      from: msg.from ?? this.defaultFrom,
      to: msg.to.join(','),
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      attachments: msg.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    return { id: info.messageId };
  }
}

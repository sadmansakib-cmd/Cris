export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface EmailMessage {
  to: string[];
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export interface EmailProvider {
  readonly id: string;
  send(msg: EmailMessage): Promise<{ id: string }>;
}

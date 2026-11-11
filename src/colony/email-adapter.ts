import nodemailer from 'nodemailer';

// ── Config ───────────────────────────────────────────────────────────────────

let EMAIL_HOST = '';
let EMAIL_PORT = 465;
let EMAIL_USER = '';
let EMAIL_PASS = '';
export let EMAIL_FROM = 'JAGAT G7 <no-reply@jagat-g7.local>';
export let EMAIL_ENABLED = false;

let transporter: nodemailer.Transporter | null = null;

// ── Connection ───────────────────────────────────────────────────────────────

/**
 * Initialize and verify SMTP connection
 */
export async function initEmailAdapter(): Promise<boolean> {
  // Load from process.env now (in case dotenv was loaded after import)
  EMAIL_HOST = process.env.EMAIL_HOST || '';
  EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '465', 10);
  EMAIL_USER = process.env.EMAIL_USER || '';
  EMAIL_PASS = process.env.EMAIL_PASS || '';
  EMAIL_FROM = process.env.EMAIL_FROM || 'JAGAT G7 <no-reply@jagat-g7.local>';
  EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true';

  if (!EMAIL_ENABLED) {
    console.log('[Email Adapter] Email is disabled (EMAIL_ENABLED=false)');
    return false;
  }

  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
    console.warn('[Email Adapter] Missing SMTP credentials in .env');
    return false;
  }

  try {
    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_PORT === 465, // true for 465, false for other ports
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });

    // Verify connection configuration
    await transporter.verify();
    console.log('[Email Adapter] SMTP connection verified successfully');
    return true;
  } catch (error) {
    console.error('[Email Adapter] Failed to verify SMTP connection:', error);
    transporter = null;
    return false;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  if (!EMAIL_ENABLED || !transporter) {
    return { success: false, error: 'Email adapter is not enabled or not initialized' };
  }

  try {
    const info = await transporter.sendMail({
      from: options.from || EMAIL_FROM,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    console.log(`[Email Adapter] Email sent to ${options.to}. MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(`[Email Adapter] Failed to send email to ${options.to}:`, error);
    return { success: false, error: error.message || String(error) };
  }
}

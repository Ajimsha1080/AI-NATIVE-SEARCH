import { safeFetch } from '../utils/safe-fetch';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendTransactionalEmail(options: SendEmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || 'ShopMate AI <support@aaas-platform.com>';

  if (resendApiKey && !resendApiKey.includes('PLACEHOLDER')) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [options.to],
          subject: options.subject,
          html: options.html,
          text: options.text || options.html.replace(/<[^>]+>/g, ' ')
        })
      });

      const data = await res.json();
      if (res.ok && data.id) {
        return { success: true, id: data.id };
      }
      return { success: false, error: data.message || 'Resend API returned error' };
    } catch (err: any) {
      console.error('Failed to dispatch transactional email via Resend:', err);
      return { success: false, error: err.message };
    }
  }

  // Local Store Dispatcher
  console.log(`[EMAIL DISPATCH] To: ${options.to} | Subject: ${options.subject}`);
  return { success: true, id: `email_${Date.now()}` };
}

export async function sendVerificationEmail(email: string, name: string, token: string): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const verifyLink = `${appUrl}/auth/verify-email?token=${token}`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #4f46e5;">Verify Your ShopMate AI Account</h2>
      <p>Hello ${name},</p>
      <p>Thank you for signing up for the ShopMate AI-Native E-Commerce Platform. Please confirm your email address by clicking the link below:</p>
      <p style="margin: 24px 0;">
        <a href="${verifyLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Verify Email Address
        </a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">This link will expire in 24 hours. If you did not sign up, please ignore this email.</p>
    </div>
  `;

  const res = await sendTransactionalEmail({
    to: email,
    subject: 'Confirm your ShopMate AI Account',
    html
  });

  return res.success;
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const resetLink = `${appUrl}/auth/reset-password?token=${token}`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #4f46e5;">Password Reset Request</h2>
      <p>We received a request to reset your ShopMate AI account password.</p>
      <p style="margin: 24px 0;">
        <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Reset Password
        </a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">This single-use password reset link will expire in 1 hour. If you did not request this, no action is needed.</p>
    </div>
  `;

  const res = await sendTransactionalEmail({
    to: email,
    subject: 'Reset your ShopMate AI Password',
    html
  });

  return res.success;
}

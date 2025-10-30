import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Email configuration with flexible SMTP and sane timeouts
// Support both SMTP_* and EMAIL_* alias keys from environment
const SMTP_HOST = process.env.SMTP_HOST || process.env.EMAIL_HOST;
const SMTP_PORT = process.env.SMTP_PORT
  ? Number(process.env.SMTP_PORT)
  : (process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : undefined);
const SMTP_SECURE = process.env.SMTP_SECURE
  ? process.env.SMTP_SECURE === 'true'
  : (process.env.EMAIL_SECURE ? process.env.EMAIL_SECURE === 'true' : undefined);
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD;

let transporter: nodemailer.Transporter;
try {
  if (SMTP_HOST && SMTP_PORT && EMAIL_USER && EMAIL_APP_PASSWORD) {
    // Use explicit SMTP host/port when provided
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE ?? SMTP_PORT === 465,
      auth: { user: EMAIL_USER , pass: EMAIL_APP_PASSWORD },
      connectionTimeout: 15000,
    });
  } else if (EMAIL_USER && EMAIL_APP_PASSWORD) {
    // Default to Gmail SMTP using STARTTLS on port 587 (more reliable on Render)
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: EMAIL_USER, pass: EMAIL_APP_PASSWORD },
      connectionTimeout: 20000,
      socketTimeout: 20000,
    });
  } else {
    // Fallback: JSON transport to avoid crashes when email isn't configured
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
} catch {
  // As a last resort, prevent crashes by using JSON transport
  transporter = nodemailer.createTransport({ jsonTransport: true });
}

// Generate verification token
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Generate reset token
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Send verification email
export async function sendVerificationEmail(email: string, token: string, fullName: string): Promise<boolean> {
  try {
    const verificationUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'no-reply@makenihighcurtffl.onrender.com',
      to: email,
      subject: 'Verify Your Legal System Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Legal System</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Account Verification</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
            <h2 style="color: #2c3e50; margin: 0 0 20px 0;">Hello ${fullName}!</h2>
            <p style="color: #6c757d; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Thank you for registering with Legal System. To complete your registration and activate your account, please verify your email address by clicking the button below.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: linear-gradient(135deg, #667eea, #764ba2); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 25px; 
                        font-weight: bold; 
                        font-size: 16px;
                        display: inline-block;">
                Verify Email Address
              </a>
            </div>
            
            <p style="color: #6c757d; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
              If the button doesn't work, you can copy and paste this link into your browser:
            </p>
            <p style="color: #667eea; font-size: 14px; word-break: break-all; margin: 10px 0 0 0;">
              ${verificationUrl}
            </p>
          </div>
          
          <div style="text-align: center; color: #6c757d; font-size: 14px;">
            <p>This verification link will expire in 24 hours.</p>
            <p>If you didn't create an account with Legal System, please ignore this email.</p>
          </div>
        </div>
      `
    };

    if (process.env.RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: mailOptions.from,
          to: [mailOptions.to],
          subject: mailOptions.subject,
          html: mailOptions.html,
        }),
      });
      if (!res.ok) throw new Error(`Resend failed: ${res.status}`);
      return true;
    }
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
}

// Send password reset email
export async function sendPasswordResetEmail(email: string, token: string, fullName: string): Promise<boolean> {
  try {
    const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'no-reply@makenihighcurtffl.onrender.com',
      to: email,
      subject: 'Reset Your Legal System Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Legal System</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Password Reset</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
            <h2 style="color: #2c3e50; margin: 0 0 20px 0;">Hello ${fullName}!</h2>
            <p style="color: #6c757d; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              We received a request to reset your password for your Legal System account. Click the button below to reset your password.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: linear-gradient(135deg, #667eea, #764ba2); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 25px; 
                        font-weight: bold; 
                        font-size: 16px;
                        display: inline-block;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #6c757d; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
              If the button doesn't work, you can copy and paste this link into your browser:
            </p>
            <p style="color: #667eea; font-size: 14px; word-break: break-all; margin: 10px 0 0 0;">
              ${resetUrl}
            </p>
          </div>
          
          <div style="text-align: center; color: #6c757d; font-size: 14px;">
            <p>This reset link will expire in 1 hour.</p>
            <p>If you didn't request a password reset, please ignore this email.</p>
          </div>
        </div>
      `
    };

    if (process.env.RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: mailOptions.from,
          to: [mailOptions.to],
          subject: mailOptions.subject,
          html: mailOptions.html,
        }),
      });
      if (!res.ok) throw new Error(`Resend failed: ${res.status}`);
      return true;
    }
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
}

// Send welcome email after verification
export async function sendWelcomeEmail(email: string, fullName: string, role: string): Promise<boolean> {
  try {
    const dashboardUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'makenihighcurtffl.onrender.com'}/dashboard/${role}`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'no-reply@makenihighcurt.onrender.com',
      to: email,
      subject: 'Welcome to Legal System!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Legal System!</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Your account is now active</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
            <h2 style="color: #2c3e50; margin: 0 0 20px 0;">Hello ${fullName}!</h2>
            <p style="color: #6c757d; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Welcome to the Legal System! Your account has been created by an administrator and is now active. 
              You can now access all features of the platform as a ${role}.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${dashboardUrl}" 
                 style="background: linear-gradient(135deg, #667eea, #764ba2); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 25px; 
                        font-weight: bold; 
                        font-size: 16px;
                        display: inline-block;">
                Go to Dashboard
              </a>
            </div>
            
            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #1976d2; margin: 0 0 10px 0; font-size: 18px;">What's Next?</h3>
              <ul style="color: #6c757d; margin: 0; padding-left: 20px;">
                <li>Complete your profile information</li>
                <li>Explore the dashboard features</li>
                <li>Start using the platform based on your role</li>
              </ul>
            </div>
          </div>
          
          <div style="text-align: center; color: #6c757d; font-size: 14px;">
            <p>If you have any questions, feel free to contact our support team.</p>
          </div>
        </div>
      `
    };

    if (process.env.RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: mailOptions.from,
          to: [mailOptions.to],
          subject: mailOptions.subject,
          html: mailOptions.html,
        }),
      });
      if (!res.ok) throw new Error(`Resend failed: ${res.status}`);
      return true;
    }
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
}

export async function sendNewCaseEmailToLawyer(params: {
  to: string;
  lawyerName: string;
  caseTitle: string;
  clientName: string;
  dueDate: Date;
}): Promise<boolean> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'makenihighcurtffl.onrender.com';
    const dashboardUrl = `${baseUrl}/dashboard/lawyer`;
    const dueDateStr = new Date(params.dueDate).toLocaleDateString();

    const mailOptions = {
      from: process.env.EMAIL_USER || 'no-reply@makenihighcurt.onrender.com',
      to: params.to,
      subject: `New Case Assigned • ${params.caseTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Legal System</h1>
            <p style="color: white; margin: 8px 0 0 0; font-size: 14px;">New Case Notification</p>
          </div>
          <div style="background: #f8f9fa; padding: 24px; border-radius: 10px; margin-bottom: 20px;">
            <h2 style="color: #2c3e50; margin: 0 0 16px 0;">Hello ${params.lawyerName},</h2>
            <p style="color: #6c757d; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
              A new case titled <strong>${params.caseTitle}</strong> has been filed by <strong>${params.clientName}</strong> and assigned to you.
            </p>
            <p style="color: #6c757d; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
              <strong>Due Date:</strong> ${dueDateStr}
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${dashboardUrl}" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 12px 24px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 14px; display: inline-block;">View in Dashboard</a>
            </div>
          </div>
          <div style="text-align: center; color: #6c757d; font-size: 13px;">
            <p>You're receiving this because you are the assigned lawyer.</p>
          </div>
        </div>
      `,
    } as any;

    if (process.env.RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: mailOptions.from,
          to: [mailOptions.to],
          subject: mailOptions.subject,
          html: mailOptions.html,
        }),
      });
      if (!res.ok) throw new Error(`Resend failed: ${res.status}`);
      return true;
    }
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending new case email to lawyer:', error);
    return false;
  }
}

export async function sendCaseApprovedEmailToClient(params: {
  to: string;
  clientName: string;
  caseTitle: string;
  lawyerName: string;
}): Promise<boolean> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'makenihighcurtffl.onrender.com';
    const dashboardUrl = `${baseUrl}/dashboard/client`;

    const mailOptions = {
      from: process.env.EMAIL_USER || 'no-reply@makenihighcurt.onrender.com',
      to: params.to,
      subject: `Your Case Was Approved • ${params.caseTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Legal System</h1>
            <p style="color: white; margin: 8px 0 0 0; font-size: 14px;">Case Approval Notification</p>
          </div>
          <div style="background: #f8f9fa; padding: 24px; border-radius: 10px; margin-bottom: 20px;">
            <h2 style="color: #2c3e50; margin: 0 0 16px 0;">Hello ${params.clientName},</h2>
            <p style="color: #6c757d; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
              Your case titled <strong>${params.caseTitle}</strong> has been <strong>approved</strong> by <strong>${params.lawyerName}</strong>.
            </p>
            <p style="color: #6c757d; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
              You can now continue collaboration via chat and review documents.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${dashboardUrl}" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 12px 24px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 14px; display: inline-block;">Open Client Dashboard</a>
            </div>
          </div>
          <div style="text-align: center; color: #6c757d; font-size: 13px;">
            <p>You're receiving this because a lawyer approved your case.</p>
          </div>
        </div>
      `,
    } as any;

    if (process.env.RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: mailOptions.from,
          to: [mailOptions.to],
          subject: mailOptions.subject,
          html: mailOptions.html,
        }),
      });
      if (!res.ok) throw new Error(`Resend failed: ${res.status}`);
      return true;
    }
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending case approved email to client:', error);
    return false;
  }
}

export async function sendCaseOutcomeReceiptEmail(params: {
  to: string;
  subject: string;
  html: string;
  pdfBuffer: Buffer;
  filename?: string;
}): Promise<boolean> {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'no-reply@makenihighcurt.onrender.com',
      to: params.to,
      subject: params.subject,
      html: params.html,
      attachments: [
        {
          filename: params.filename || 'case-outcome-receipt.pdf',
          content: params.pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    } as any;

    if (process.env.RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: mailOptions.from,
          to: [mailOptions.to],
          subject: mailOptions.subject,
          html: mailOptions.html,
          attachments: [
            {
              filename: mailOptions.attachments[0].filename,
              content: mailOptions.attachments[0].content.toString('base64'),
            },
          ],
        }),
      });
      if (!res.ok) throw new Error(`Resend failed: ${res.status}`);
      return true;
    }
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending case outcome receipt email:', error);
    return false;
  }
}

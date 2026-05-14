import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../../.env') });

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const FROM_ADDRESS = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@appointment-scheduler.com';

/**
 * Send an email reminder for an upcoming appointment.
 * @param {Object} appointment - appointment row (with contact_name, contact_email optional)
 */
export async function sendEmailReminder(appointment) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[notificationService] SMTP not configured - skipping email for appointment ${appointment.id}`);
    return null;
  }

  const recipient = appointment.contact_email || appointment.user_email;
  if (!recipient) {
    console.log(`[notificationService] No email address for appointment ${appointment.id}, skipping.`);
    return null;
  }

  const startTime = new Date(appointment.start_time);
  const endTime = new Date(appointment.end_time);
  const formattedDate = startTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formattedStart = startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const formattedEnd = endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const subject = `Reminder: ${appointment.title} on ${formattedDate}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #4f46e5; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">Appointment Reminder</h2>
      </div>
      <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
        <h3 style="color: #1f2937;">${appointment.title}</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; font-weight: bold; color: #6b7280; width: 120px;">Date</td><td style="padding: 8px;">${formattedDate}</td></tr>
          <tr style="background: #f3f4f6;"><td style="padding: 8px; font-weight: bold; color: #6b7280;">Time</td><td style="padding: 8px;">${formattedStart} – ${formattedEnd}</td></tr>
          ${appointment.location ? `<tr><td style="padding: 8px; font-weight: bold; color: #6b7280;">Location</td><td style="padding: 8px;">${appointment.location}</td></tr>` : ''}
          ${appointment.contact_name ? `<tr style="background: #f3f4f6;"><td style="padding: 8px; font-weight: bold; color: #6b7280;">With</td><td style="padding: 8px;">${appointment.contact_name}</td></tr>` : ''}
          ${appointment.description ? `<tr><td style="padding: 8px; font-weight: bold; color: #6b7280;">Notes</td><td style="padding: 8px;">${appointment.description}</td></tr>` : ''}
        </table>
        <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
          This is an automated reminder from your AI Appointment Scheduler.
        </p>
      </div>
    </div>
  `;

  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from: FROM_ADDRESS,
    to: recipient,
    subject,
    html,
    text: `Reminder: ${appointment.title} on ${formattedDate} from ${formattedStart} to ${formattedEnd}${appointment.location ? ' at ' + appointment.location : ''}.`,
  });

  console.log(`[notificationService] Email reminder sent for appointment ${appointment.id} to ${recipient}: messageId=${info.messageId}`);
  return info;
}

/**
 * Send an SMS reminder for an appointment via Twilio (or log if not configured).
 * @param {Object} appointment
 * @param {string} phone - E.164 phone number e.g. '+15551234567'
 */
export async function sendSMSReminder(appointment, phone) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  const startTime = new Date(appointment.start_time);
  const formattedDate = startTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const formattedTime = startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const message = `Reminder: "${appointment.title}" on ${formattedDate} at ${formattedTime}${appointment.location ? ' at ' + appointment.location : ''}.`;

  if (!accountSid || !authToken || !fromNumber) {
    console.log(`[notificationService] Twilio not configured - SMS not sent for appointment ${appointment.id}. Message would be: "${message}"`);
    return { simulated: true, message, to: phone };
  }

  // Dynamic import to avoid hard dependency
  const twilio = (await import('twilio')).default;
  const client = twilio(accountSid, authToken);

  const result = await client.messages.create({
    body: message,
    from: fromNumber,
    to: phone,
  });

  console.log(`[notificationService] SMS sent for appointment ${appointment.id} to ${phone}: sid=${result.sid}`);
  return result;
}

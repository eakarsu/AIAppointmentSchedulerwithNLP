import pool from './config/database.js';
import { initializeDatabase, dropAllTables } from './models/schema.js';
if (process.env.CONFIRM_DEMO_SEED !== 'yes') throw new Error('Refusing destructive demo seed without CONFIRM_DEMO_SEED=yes');
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

async function seedDatabase() {
  console.log('Starting database seeding...');

  try {
    // Drop and recreate tables
    await dropAllTables();
    await initializeDatabase();

    const client = await pool.connect();

    try {
      // Seed Users (15+ items)
      const hashedPassword = await bcrypt.hash('demo123456', 10);
      const users = [
        { email: 'demo@scheduler.com', password: hashedPassword, name: 'Demo User', role: 'admin' },
        { email: 'john.doe@email.com', password: hashedPassword, name: 'John Doe', role: 'user' },
        { email: 'jane.smith@email.com', password: hashedPassword, name: 'Jane Smith', role: 'user' },
        { email: 'mike.johnson@email.com', password: hashedPassword, name: 'Mike Johnson', role: 'user' },
        { email: 'sarah.williams@email.com', password: hashedPassword, name: 'Sarah Williams', role: 'user' },
        { email: 'david.brown@email.com', password: hashedPassword, name: 'David Brown', role: 'user' },
        { email: 'emily.davis@email.com', password: hashedPassword, name: 'Emily Davis', role: 'user' },
        { email: 'chris.wilson@email.com', password: hashedPassword, name: 'Chris Wilson', role: 'user' },
        { email: 'amanda.taylor@email.com', password: hashedPassword, name: 'Amanda Taylor', role: 'user' },
        { email: 'robert.anderson@email.com', password: hashedPassword, name: 'Robert Anderson', role: 'user' },
        { email: 'lisa.thomas@email.com', password: hashedPassword, name: 'Lisa Thomas', role: 'user' },
        { email: 'kevin.martinez@email.com', password: hashedPassword, name: 'Kevin Martinez', role: 'user' },
        { email: 'nancy.garcia@email.com', password: hashedPassword, name: 'Nancy Garcia', role: 'user' },
        { email: 'steven.rodriguez@email.com', password: hashedPassword, name: 'Steven Rodriguez', role: 'user' },
        { email: 'patricia.lee@email.com', password: hashedPassword, name: 'Patricia Lee', role: 'user' },
        { email: 'admin@scheduler.com', password: hashedPassword, name: 'Admin User', role: 'admin' },
      ];

      for (const user of users) {
        await client.query(
          'INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING',
          [user.email, user.password, user.name, user.role]
        );
      }
      console.log('Users seeded: 16 items');

      // Seed Contacts (15+ items)
      const contacts = [
        { user_id: 1, name: 'Dr. John Smith', email: 'dr.smith@hospital.com', phone: '555-0100', company: 'City Hospital', notes: 'Cardiologist' },
        { user_id: 1, name: 'Dr. Sarah Mitchell', email: 'sarah.mitchell@hospital.com', phone: '555-0101', company: 'City Hospital', notes: 'Primary care physician' },
        { user_id: 1, name: 'Mark Thompson', email: 'mark.t@techcorp.com', phone: '555-0102', company: 'TechCorp Inc', notes: 'Software consultant' },
        { user_id: 1, name: 'Jennifer Adams', email: 'j.adams@lawfirm.com', phone: '555-0103', company: 'Adams Law Firm', notes: 'Personal attorney' },
        { user_id: 1, name: 'Robert Chen', email: 'rchen@finance.com', phone: '555-0104', company: 'Finance Plus', notes: 'Financial advisor' },
        { user_id: 1, name: 'Maria Garcia', email: 'maria.g@design.com', phone: '555-0105', company: 'Creative Design Studio', notes: 'Graphic designer' },
        { user_id: 1, name: 'James Wilson', email: 'jwilson@realestate.com', phone: '555-0106', company: 'Premier Realty', notes: 'Real estate agent' },
        { user_id: 1, name: 'Emily Brooks', email: 'ebrooks@marketing.com', phone: '555-0107', company: 'Marketing Masters', notes: 'Marketing consultant' },
        { user_id: 1, name: 'Daniel Kim', email: 'dkim@startup.io', phone: '555-0108', company: 'InnovateTech', notes: 'Startup founder' },
        { user_id: 1, name: 'Rachel Green', email: 'rgreen@fashion.com', phone: '555-0109', company: 'Fashion Forward', notes: 'Fashion consultant' },
        { user_id: 1, name: 'Michael Scott', email: 'mscott@paper.com', phone: '555-0110', company: 'Paper Company', notes: 'Regional manager' },
        { user_id: 1, name: 'Laura Palmer', email: 'lpalmer@cafe.com', phone: '555-0111', company: 'Twin Peaks Cafe', notes: 'Cafe owner' },
        { user_id: 1, name: 'Tom Hanks', email: 'thanks@movies.com', phone: '555-0112', company: 'Film Studios', notes: 'Actor contact' },
        { user_id: 1, name: 'Susan Miller', email: 'smiller@health.com', phone: '555-0113', company: 'Wellness Center', notes: 'Nutritionist' },
        { user_id: 1, name: 'Brian Johnson', email: 'bjohnson@auto.com', phone: '555-0114', company: 'Auto Services', notes: 'Mechanic' },
        { user_id: 1, name: 'Angela Martin', email: 'amartin@accounting.com', phone: '555-0115', company: 'Accounting Pros', notes: 'Accountant' },
        { user_id: 1, name: 'Kevin Malone', email: 'kmalone@accounting.com', phone: '555-0116', company: 'Accounting Pros', notes: 'Junior accountant' },
      ];

      for (const contact of contacts) {
        await client.query(
          'INSERT INTO contacts (user_id, name, email, phone, company, notes) VALUES ($1, $2, $3, $4, $5, $6)',
          [contact.user_id, contact.name, contact.email, contact.phone, contact.company, contact.notes]
        );
      }
      console.log('Contacts seeded: 16 items');

      // Seed Categories (15+ items)
      const categories = [
        { user_id: 1, name: 'Medical', color: '#EF4444', description: 'Doctor appointments and health checkups' },
        { user_id: 1, name: 'Business', color: '#3B82F6', description: 'Business meetings and work-related' },
        { user_id: 1, name: 'Personal', color: '#10B981', description: 'Personal appointments and errands' },
        { user_id: 1, name: 'Legal', color: '#8B5CF6', description: 'Legal consultations and court dates' },
        { user_id: 1, name: 'Financial', color: '#F59E0B', description: 'Financial planning and banking' },
        { user_id: 1, name: 'Social', color: '#EC4899', description: 'Social events and gatherings' },
        { user_id: 1, name: 'Fitness', color: '#06B6D4', description: 'Gym sessions and sports activities' },
        { user_id: 1, name: 'Education', color: '#84CC16', description: 'Classes, workshops, and training' },
        { user_id: 1, name: 'Travel', color: '#F97316', description: 'Travel plans and reservations' },
        { user_id: 1, name: 'Entertainment', color: '#A855F7', description: 'Movies, concerts, and events' },
        { user_id: 1, name: 'Home', color: '#6366F1', description: 'Home maintenance and repairs' },
        { user_id: 1, name: 'Pet Care', color: '#14B8A6', description: 'Vet visits and pet grooming' },
        { user_id: 1, name: 'Beauty', color: '#F472B6', description: 'Salon and spa appointments' },
        { user_id: 1, name: 'Religious', color: '#78716C', description: 'Religious services and events' },
        { user_id: 1, name: 'Volunteer', color: '#22C55E', description: 'Volunteer work and charity events' },
        { user_id: 1, name: 'Other', color: '#64748B', description: 'Miscellaneous appointments' },
      ];

      for (const category of categories) {
        await client.query(
          'INSERT INTO categories (user_id, name, color, description) VALUES ($1, $2, $3, $4)',
          [category.user_id, category.name, category.color, category.description]
        );
      }
      console.log('Categories seeded: 16 items');

      // Seed Appointments (15+ items)
      const now = new Date();
      const appointments = [
        { user_id: 1, contact_id: 1, title: 'Annual Health Checkup', description: 'Regular annual physical examination', location: 'City Hospital, Room 201', start_time: addDays(now, 1, 9, 0), end_time: addDays(now, 1, 10, 0), status: 'scheduled' },
        { user_id: 1, contact_id: 2, title: 'Software Project Review', description: 'Review Q1 project deliverables', location: 'TechCorp Office', start_time: addDays(now, 2, 14, 0), end_time: addDays(now, 2, 15, 30), status: 'scheduled' },
        { user_id: 1, contact_id: 3, title: 'Legal Consultation', description: 'Discuss contract review', location: 'Adams Law Firm', start_time: addDays(now, 3, 11, 0), end_time: addDays(now, 3, 12, 0), status: 'scheduled' },
        { user_id: 1, contact_id: 4, title: 'Financial Planning Session', description: 'Quarterly investment review', location: 'Finance Plus, 5th Floor', start_time: addDays(now, 4, 10, 0), end_time: addDays(now, 4, 11, 30), status: 'scheduled' },
        { user_id: 1, contact_id: 5, title: 'Logo Design Discussion', description: 'Review new brand identity concepts', location: 'Creative Design Studio', start_time: addDays(now, 5, 15, 0), end_time: addDays(now, 5, 16, 0), status: 'scheduled' },
        { user_id: 1, contact_id: 6, title: 'Property Viewing', description: 'View downtown apartment listings', location: '123 Main Street', start_time: addDays(now, 6, 13, 0), end_time: addDays(now, 6, 14, 30), status: 'scheduled' },
        { user_id: 1, contact_id: 7, title: 'Marketing Strategy Meeting', description: 'Plan Q2 marketing campaigns', location: 'Virtual - Zoom', start_time: addDays(now, 7, 9, 30), end_time: addDays(now, 7, 10, 30), status: 'scheduled' },
        { user_id: 1, contact_id: 8, title: 'Startup Pitch Review', description: 'Review pitch deck for investors', location: 'InnovateTech HQ', start_time: addDays(now, 8, 16, 0), end_time: addDays(now, 8, 17, 30), status: 'scheduled' },
        { user_id: 1, contact_id: 9, title: 'Wardrobe Consultation', description: 'Spring wardrobe refresh planning', location: 'Fashion Forward Boutique', start_time: addDays(now, 9, 11, 0), end_time: addDays(now, 9, 12, 30), status: 'scheduled' },
        { user_id: 1, contact_id: 10, title: 'Team Building Event', description: 'Quarterly team building activity', location: 'Paper Company Office', start_time: addDays(now, 10, 14, 0), end_time: addDays(now, 10, 17, 0), status: 'scheduled' },
        { user_id: 1, contact_id: 11, title: 'Coffee Meeting', description: 'Casual business networking', location: 'Twin Peaks Cafe', start_time: addDays(now, 11, 10, 0), end_time: addDays(now, 11, 11, 0), status: 'scheduled' },
        { user_id: 1, contact_id: 13, title: 'Nutrition Consultation', description: 'Diet plan review and adjustments', location: 'Wellness Center', start_time: addDays(now, 12, 9, 0), end_time: addDays(now, 12, 10, 0), status: 'scheduled' },
        { user_id: 1, contact_id: 14, title: 'Car Service Appointment', description: 'Annual maintenance and inspection', location: 'Auto Services Garage', start_time: addDays(now, 13, 8, 0), end_time: addDays(now, 13, 10, 0), status: 'scheduled' },
        { user_id: 1, contact_id: 15, title: 'Tax Review Meeting', description: 'Review tax documents for filing', location: 'Accounting Pros Office', start_time: addDays(now, 14, 13, 0), end_time: addDays(now, 14, 14, 30), status: 'scheduled' },
        { user_id: 1, contact_id: 1, title: 'Follow-up Appointment', description: 'Follow-up on test results', location: 'City Hospital, Room 201', start_time: addDays(now, 15, 11, 0), end_time: addDays(now, 15, 11, 30), status: 'scheduled' },
        { user_id: 1, contact_id: 2, title: 'Technical Workshop', description: 'New framework training session', location: 'TechCorp Training Room', start_time: addDays(now, 16, 9, 0), end_time: addDays(now, 16, 12, 0), status: 'scheduled' },
      ];

      for (const apt of appointments) {
        await client.query(
          'INSERT INTO appointments (user_id, contact_id, title, description, location, start_time, end_time, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [apt.user_id, apt.contact_id, apt.title, apt.description, apt.location, apt.start_time, apt.end_time, apt.status]
        );
      }
      console.log('Appointments seeded: 16 items');

      // Seed Reminders (15+ items)
      const reminders = [];
      for (let i = 1; i <= 16; i++) {
        const reminderTime = addDays(now, i, 8, 0);
        reminders.push({ appointment_id: i, remind_at: reminderTime, type: i % 2 === 0 ? 'email' : 'sms', sent: false });
      }

      for (const reminder of reminders) {
        await client.query(
          'INSERT INTO reminders (appointment_id, remind_at, type, sent) VALUES ($1, $2, $3, $4)',
          [reminder.appointment_id, reminder.remind_at, reminder.type, reminder.sent]
        );
      }
      console.log('Reminders seeded: 16 items');

      // Seed NLP Logs (15+ items)
      const nlpLogs = [
        { user_id: 1, input_text: 'Book me a meeting with Dr. Sarah on Tuesday at 2pm', parsed_result: { action: 'create', date: 'tuesday', time: '14:00', contact: 'Dr. Sarah' }, success: true },
        { user_id: 1, input_text: 'Schedule appointment tomorrow morning', parsed_result: { action: 'create', date: 'tomorrow', time: 'morning' }, success: true },
        { user_id: 1, input_text: 'Cancel my appointment on Friday', parsed_result: { action: 'cancel', date: 'friday' }, success: true },
        { user_id: 1, input_text: 'Move my 3pm meeting to 4pm', parsed_result: { action: 'reschedule', old_time: '15:00', new_time: '16:00' }, success: true },
        { user_id: 1, input_text: 'Book lunch with Mark next Wednesday', parsed_result: { action: 'create', date: 'next wednesday', time: '12:00', contact: 'Mark' }, success: true },
        { user_id: 1, input_text: 'Schedule a call for Monday afternoon', parsed_result: { action: 'create', date: 'monday', time: 'afternoon' }, success: true },
        { user_id: 1, input_text: 'Set up meeting with lawyer tomorrow', parsed_result: { action: 'create', date: 'tomorrow', type: 'legal' }, success: true },
        { user_id: 1, input_text: 'Book dentist appointment next month', parsed_result: { action: 'create', date: 'next month', type: 'medical' }, success: true },
        { user_id: 1, input_text: 'Remind me about the meeting in 30 minutes', parsed_result: { action: 'reminder', time: '30 minutes' }, success: true },
        { user_id: 1, input_text: 'What appointments do I have this week', parsed_result: { action: 'query', period: 'this week' }, success: true },
        { user_id: 1, input_text: 'Show my schedule for tomorrow', parsed_result: { action: 'query', date: 'tomorrow' }, success: true },
        { user_id: 1, input_text: 'Book me Tuesday afternoon', parsed_result: { action: 'create', date: 'tuesday', time: 'afternoon' }, success: true },
        { user_id: 1, input_text: 'Schedule gym session at 6am daily', parsed_result: { action: 'create', time: '06:00', recurring: 'daily', type: 'fitness' }, success: true },
        { user_id: 1, input_text: 'Cancel all meetings on Christmas', parsed_result: { action: 'cancel', date: 'december 25', all: true }, success: true },
        { user_id: 1, input_text: 'Set up weekly review every Friday at 4pm', parsed_result: { action: 'create', day: 'friday', time: '16:00', recurring: 'weekly' }, success: true },
        { user_id: 1, input_text: 'Book haircut appointment Saturday morning', parsed_result: { action: 'create', date: 'saturday', time: 'morning', type: 'beauty' }, success: true },
      ];

      for (const log of nlpLogs) {
        await client.query(
          'INSERT INTO nlp_logs (user_id, input_text, parsed_result, success) VALUES ($1, $2, $3, $4)',
          [log.user_id, log.input_text, JSON.stringify(log.parsed_result), log.success]
        );
      }
      console.log('NLP Logs seeded: 16 items');

      // Seed Voice Commands (15+ items)
      const voiceCommands = [
        { user_id: 1, transcript: 'Book me a doctor appointment for next Tuesday', action_taken: 'Created appointment', appointment_id: 1 },
        { user_id: 1, transcript: 'Cancel my meeting with Mark', action_taken: 'Cancelled appointment', appointment_id: null },
        { user_id: 1, transcript: 'What is my schedule for today', action_taken: 'Displayed schedule', appointment_id: null },
        { user_id: 1, transcript: 'Remind me about the meeting in an hour', action_taken: 'Set reminder', appointment_id: 2 },
        { user_id: 1, transcript: 'Schedule a call with Jennifer tomorrow at 3', action_taken: 'Created appointment', appointment_id: 3 },
        { user_id: 1, transcript: 'Move my 2pm to 4pm', action_taken: 'Rescheduled appointment', appointment_id: 4 },
        { user_id: 1, transcript: 'Book lunch meeting Friday noon', action_taken: 'Created appointment', appointment_id: 5 },
        { user_id: 1, transcript: 'Cancel all appointments tomorrow', action_taken: 'Cancelled multiple appointments', appointment_id: null },
        { user_id: 1, transcript: 'Set up weekly standup Monday 9am', action_taken: 'Created recurring appointment', appointment_id: 6 },
        { user_id: 1, transcript: 'When is my next appointment', action_taken: 'Displayed next appointment', appointment_id: null },
        { user_id: 1, transcript: 'Book me Tuesday afternoon with the accountant', action_taken: 'Created appointment', appointment_id: 7 },
        { user_id: 1, transcript: 'Reschedule dentist to next week', action_taken: 'Rescheduled appointment', appointment_id: 8 },
        { user_id: 1, transcript: 'Add gym session every morning at 6', action_taken: 'Created recurring appointment', appointment_id: 9 },
        { user_id: 1, transcript: 'Show me free slots on Wednesday', action_taken: 'Displayed availability', appointment_id: null },
        { user_id: 1, transcript: 'Book car service appointment for Saturday', action_taken: 'Created appointment', appointment_id: 10 },
        { user_id: 1, transcript: 'What meetings do I have this week', action_taken: 'Displayed weekly schedule', appointment_id: null },
      ];

      for (const cmd of voiceCommands) {
        await client.query(
          'INSERT INTO voice_commands (user_id, transcript, action_taken, appointment_id) VALUES ($1, $2, $3, $4)',
          [cmd.user_id, cmd.transcript, cmd.action_taken, cmd.appointment_id]
        );
      }
      console.log('Voice Commands seeded: 16 items');

      // Seed Settings (15+ items)
      const settings = [
        { user_id: 1, timezone: 'America/New_York', notification_email: true, notification_sms: true, default_reminder_minutes: 30, theme: 'light' },
        { user_id: 2, timezone: 'America/Los_Angeles', notification_email: true, notification_sms: false, default_reminder_minutes: 15, theme: 'dark' },
        { user_id: 3, timezone: 'Europe/London', notification_email: true, notification_sms: true, default_reminder_minutes: 60, theme: 'light' },
        { user_id: 4, timezone: 'Europe/Paris', notification_email: false, notification_sms: true, default_reminder_minutes: 30, theme: 'dark' },
        { user_id: 5, timezone: 'Asia/Tokyo', notification_email: true, notification_sms: false, default_reminder_minutes: 45, theme: 'light' },
        { user_id: 6, timezone: 'Australia/Sydney', notification_email: true, notification_sms: true, default_reminder_minutes: 30, theme: 'dark' },
        { user_id: 7, timezone: 'America/Chicago', notification_email: false, notification_sms: false, default_reminder_minutes: 15, theme: 'light' },
        { user_id: 8, timezone: 'America/Denver', notification_email: true, notification_sms: true, default_reminder_minutes: 60, theme: 'dark' },
        { user_id: 9, timezone: 'Europe/Berlin', notification_email: true, notification_sms: false, default_reminder_minutes: 30, theme: 'light' },
        { user_id: 10, timezone: 'Asia/Singapore', notification_email: false, notification_sms: true, default_reminder_minutes: 45, theme: 'dark' },
        { user_id: 11, timezone: 'Pacific/Auckland', notification_email: true, notification_sms: true, default_reminder_minutes: 30, theme: 'light' },
        { user_id: 12, timezone: 'America/Toronto', notification_email: true, notification_sms: false, default_reminder_minutes: 15, theme: 'dark' },
        { user_id: 13, timezone: 'Europe/Madrid', notification_email: false, notification_sms: true, default_reminder_minutes: 60, theme: 'light' },
        { user_id: 14, timezone: 'Asia/Dubai', notification_email: true, notification_sms: true, default_reminder_minutes: 30, theme: 'dark' },
        { user_id: 15, timezone: 'America/Phoenix', notification_email: true, notification_sms: false, default_reminder_minutes: 45, theme: 'light' },
        { user_id: 16, timezone: 'UTC', notification_email: true, notification_sms: true, default_reminder_minutes: 30, theme: 'system' },
      ];

      for (const setting of settings) {
        await client.query(
          'INSERT INTO settings (user_id, timezone, notification_email, notification_sms, default_reminder_minutes, theme) VALUES ($1, $2, $3, $4, $5, $6)',
          [setting.user_id, setting.timezone, setting.notification_email, setting.notification_sms, setting.default_reminder_minutes, setting.theme]
        );
      }
      console.log('Settings seeded: 16 items');

      // Seed Buffer Time Analyses (16 items)
      const bufferAnalyses = [];
      for (let i = 1; i <= 16; i++) {
        bufferAnalyses.push({
          user_id: 1,
          appointment_id: Math.min(i, 16),
          suggested_buffer_minutes: 15 + Math.floor(Math.random() * 30),
          travel_time_estimate: Math.floor(Math.random() * 25),
          preparation_time: 5 + Math.floor(Math.random() * 15),
          decompression_time: 5 + Math.floor(Math.random() * 10),
          confidence_score: 0.6 + Math.random() * 0.35,
          ai_reasoning: `Buffer analysis for appointment ${i}: Recommended based on location distance, appointment type, and historical patterns.`,
          applied: i % 3 === 0
        });
      }

      for (const analysis of bufferAnalyses) {
        await client.query(
          `INSERT INTO buffer_time_analyses
           (user_id, appointment_id, suggested_buffer_minutes, travel_time_estimate,
            preparation_time, decompression_time, confidence_score, ai_reasoning, applied)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [analysis.user_id, analysis.appointment_id, analysis.suggested_buffer_minutes,
           analysis.travel_time_estimate, analysis.preparation_time, analysis.decompression_time,
           analysis.confidence_score, analysis.ai_reasoning, analysis.applied]
        );
      }
      console.log('Buffer Time Analyses seeded: 16 items');

      // Seed No-Show Predictions (16 items)
      const riskLevels = ['low', 'medium', 'high'];
      const noShowPredictions = [];
      for (let i = 1; i <= 16; i++) {
        const score = Math.random();
        noShowPredictions.push({
          user_id: 1,
          appointment_id: Math.min(i, 16),
          prediction_score: score,
          risk_level: score < 0.3 ? 'low' : score < 0.6 ? 'medium' : 'high',
          contributing_factors: JSON.stringify([
            { factor: 'Historical Attendance', weight: 0.4, description: 'Based on past appointments' },
            { factor: 'Lead Time', weight: 0.3, description: 'Time until appointment' },
            { factor: 'Appointment Type', weight: 0.3, description: 'Category of appointment' }
          ]),
          suggested_actions: JSON.stringify([
            { action: 'Send reminder 24 hours before', priority: 1, expected_impact: 'Reduces no-shows by 20%' },
            { action: 'Confirm attendance via SMS', priority: 2, expected_impact: 'Reduces no-shows by 15%' }
          ]),
          ai_reasoning: `Prediction for appointment ${i}: Analysis based on contact history, appointment timing, and behavioral patterns.`,
          actual_outcome: i % 4 === 0 ? 'attended' : i % 5 === 0 ? 'no-show' : null
        });
      }

      for (const prediction of noShowPredictions) {
        await client.query(
          `INSERT INTO no_show_predictions
           (user_id, appointment_id, prediction_score, risk_level, contributing_factors,
            suggested_actions, ai_reasoning, actual_outcome)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [prediction.user_id, prediction.appointment_id, prediction.prediction_score,
           prediction.risk_level, prediction.contributing_factors, prediction.suggested_actions,
           prediction.ai_reasoning, prediction.actual_outcome]
        );
      }
      console.log('No-Show Predictions seeded: 16 items');

      // Seed Reschedule Suggestions (16 items)
      const rescheduleSuggestions = [];
      for (let i = 1; i <= 16; i++) {
        const suggestedTimes = [];
        for (let j = 1; j <= 5; j++) {
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + j);
          suggestedTimes.push({
            date: futureDate.toISOString().split('T')[0],
            time: `${9 + j}:00`,
            end_time: `${10 + j}:00`,
            score: 1 - (j * 0.15),
            reasoning: `Available slot with minimal conflicts`
          });
        }

        rescheduleSuggestions.push({
          user_id: 1,
          original_appointment_id: Math.min(i, 16),
          suggested_times: JSON.stringify(suggestedTimes),
          reason_for_reschedule: ['Conflict detected', 'User request', 'Venue unavailable', 'Contact request'][i % 4],
          priority_score: 0.5 + Math.random() * 0.4,
          ai_reasoning: `Reschedule suggestion for appointment ${i}: Found ${suggestedTimes.length} alternative times based on calendar analysis.`,
          accepted_suggestion: i % 3 === 0 ? Math.floor(Math.random() * 3) : null
        });
      }

      for (const suggestion of rescheduleSuggestions) {
        await client.query(
          `INSERT INTO reschedule_suggestions
           (user_id, original_appointment_id, suggested_times, reason_for_reschedule,
            priority_score, ai_reasoning, accepted_suggestion)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [suggestion.user_id, suggestion.original_appointment_id, suggestion.suggested_times,
           suggestion.reason_for_reschedule, suggestion.priority_score, suggestion.ai_reasoning,
           suggestion.accepted_suggestion]
        );
      }
      console.log('Reschedule Suggestions seeded: 16 items');

      // Seed Resources (16 items)
      const resourceTypes = ['room', 'equipment', 'staff', 'vehicle'];
      const resources = [
        { name: 'Conference Room A', type: 'room', capacity: 10, location: 'Building 1, Floor 2', cost_per_hour: 50 },
        { name: 'Conference Room B', type: 'room', capacity: 6, location: 'Building 1, Floor 3', cost_per_hour: 35 },
        { name: 'Board Room', type: 'room', capacity: 20, location: 'Building 1, Floor 5', cost_per_hour: 100 },
        { name: 'Meeting Room 1', type: 'room', capacity: 4, location: 'Building 2, Floor 1', cost_per_hour: 25 },
        { name: 'Projector HD', type: 'equipment', capacity: 1, location: 'IT Storage', cost_per_hour: 15 },
        { name: 'Video Conferencing Kit', type: 'equipment', capacity: 1, location: 'IT Storage', cost_per_hour: 20 },
        { name: 'Whiteboard Set', type: 'equipment', capacity: 1, location: 'Supply Room', cost_per_hour: 5 },
        { name: 'Laptop Pool Unit 1', type: 'equipment', capacity: 1, location: 'IT Storage', cost_per_hour: 10 },
        { name: 'Dr. Sarah Mitchell', type: 'staff', capacity: 1, location: 'City Hospital', cost_per_hour: 150 },
        { name: 'Mark Thompson', type: 'staff', capacity: 1, location: 'TechCorp', cost_per_hour: 100 },
        { name: 'Jennifer Adams', type: 'staff', capacity: 1, location: 'Law Firm', cost_per_hour: 200 },
        { name: 'Robert Chen', type: 'staff', capacity: 1, location: 'Finance Plus', cost_per_hour: 175 },
        { name: 'Company Car 1', type: 'vehicle', capacity: 4, location: 'Parking Lot A', cost_per_hour: 30 },
        { name: 'Company Van', type: 'vehicle', capacity: 8, location: 'Parking Lot B', cost_per_hour: 45 },
        { name: 'Executive Car', type: 'vehicle', capacity: 4, location: 'Executive Parking', cost_per_hour: 60 },
        { name: 'Shuttle Bus', type: 'vehicle', capacity: 15, location: 'Main Entrance', cost_per_hour: 80 }
      ];

      for (const resource of resources) {
        await client.query(
          `INSERT INTO resources
           (user_id, name, type, capacity, location, cost_per_hour, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [1, resource.name, resource.type, resource.capacity, resource.location, resource.cost_per_hour, true]
        );
      }
      console.log('Resources seeded: 16 items');

      // Seed Resource Allocations (16 items)
      const allocations = [];
      for (let i = 1; i <= 16; i++) {
        allocations.push({
          user_id: 1,
          appointment_id: Math.min(i, 16),
          resource_id: ((i - 1) % 16) + 1,
          allocation_type: i % 3 === 0 ? 'backup' : 'primary',
          utilization_score: 0.5 + Math.random() * 0.45,
          cost_efficiency_score: 0.6 + Math.random() * 0.35,
          ai_reasoning: `Resource allocated based on availability, proximity, and cost optimization for appointment ${i}.`
        });
      }

      for (const allocation of allocations) {
        await client.query(
          `INSERT INTO resource_allocations
           (user_id, appointment_id, resource_id, allocation_type, utilization_score,
            cost_efficiency_score, ai_reasoning)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [allocation.user_id, allocation.appointment_id, allocation.resource_id,
           allocation.allocation_type, allocation.utilization_score, allocation.cost_efficiency_score,
           allocation.ai_reasoning]
        );
      }
      console.log('Resource Allocations seeded: 16 items');

      console.log('\n✅ Database seeding completed successfully!');
      console.log('\nSeeded data summary:');
      console.log('  - 16 Users');
      console.log('  - 16 Contacts');
      console.log('  - 16 Categories');
      console.log('  - 16 Appointments');
      console.log('  - 16 Reminders');
      console.log('  - 16 NLP Logs');
      console.log('  - 16 Voice Commands');
      console.log('  - 16 Settings');
      console.log('  - 16 Buffer Time Analyses');
      console.log('  - 16 No-Show Predictions');
      console.log('  - 16 Reschedule Suggestions');
      console.log('  - 16 Resources');
      console.log('  - 16 Resource Allocations');
      console.log('\nDemo login credentials:');
      console.log('Email: demo@scheduler.com');
      console.log('Password: demo123456');

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

function addDays(date, days, hours = 0, minutes = 0) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

seedDatabase();

import Joi from 'joi';

export function validatePassword(password) {
  const errors = [];
  if (!password || password.length < 12) errors.push('Password must be at least 12 characters');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain a lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain a number');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('Password must contain a special character');
  return { valid: errors.length === 0, errors };
}

export function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

export function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  next();
}

function sanitizeObject(obj) {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      obj[key] = obj[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').trim();
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

// ── Joi Schemas ────────────────────────────────────────────────────────────────

export const schemas = {
  // Auth
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(1).required(),
  }),
  register: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
  }),
  forgotPassword: Joi.object({
    email: Joi.string().email().required(),
  }),
  resetPassword: Joi.object({
    token: Joi.string().required(),
    password: Joi.string().min(8).required(),
  }),
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).required(),
  }),

  // Appointments
  createAppointment: Joi.object({
    title: Joi.string().min(1).max(255).required(),
    start_time: Joi.string().isoDate().required(),
    end_time: Joi.string().isoDate().required(),
    description: Joi.string().max(5000).allow('', null),
    location: Joi.string().max(255).allow('', null),
    contact_id: Joi.number().integer().positive().allow(null),
    status: Joi.string().valid('scheduled', 'completed', 'cancelled', 'no-show').default('scheduled'),
    timezone: Joi.string().max(100).allow('', null),
  }),
  updateAppointment: Joi.object({
    title: Joi.string().min(1).max(255),
    start_time: Joi.string().isoDate(),
    end_time: Joi.string().isoDate(),
    description: Joi.string().max(5000).allow('', null),
    location: Joi.string().max(255).allow('', null),
    contact_id: Joi.number().integer().positive().allow(null),
    status: Joi.string().valid('scheduled', 'completed', 'cancelled', 'no-show'),
    timezone: Joi.string().max(100).allow('', null),
  }),

  // Contacts
  createContact: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    email: Joi.string().email().allow('', null),
    phone: Joi.string().max(50).allow('', null),
    company: Joi.string().max(255).allow('', null),
    notes: Joi.string().max(5000).allow('', null),
  }),
  updateContact: Joi.object({
    name: Joi.string().min(1).max(255),
    email: Joi.string().email().allow('', null),
    phone: Joi.string().max(50).allow('', null),
    company: Joi.string().max(255).allow('', null),
    notes: Joi.string().max(5000).allow('', null),
  }),

  // Categories
  createCategory: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#3B82F6'),
    description: Joi.string().max(1000).allow('', null),
  }),
  updateCategory: Joi.object({
    name: Joi.string().min(1).max(100),
    color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
    description: Joi.string().max(1000).allow('', null),
  }),

  // Reminders
  createReminder: Joi.object({
    appointment_id: Joi.number().integer().positive().required(),
    remind_at: Joi.string().isoDate().required(),
    type: Joi.string().valid('email', 'sms', 'push').default('email'),
  }),

  // Resources (AI)
  createResource: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    type: Joi.string().min(1).max(100).required(),
    capacity: Joi.number().integer().positive().default(1),
    availability_hours: Joi.object().allow(null),
    location: Joi.string().max(255).allow('', null),
    cost_per_hour: Joi.number().min(0).default(0),
    skills: Joi.array().items(Joi.string()).allow(null),
  }),

  // NLP / AI
  nlpParse: Joi.object({
    text: Joi.string().min(1).max(2000).required(),
  }),
  nlpChat: Joi.object({
    message: Joi.string().min(1).max(2000).required(),
  }),
  analyzeBuffer: Joi.object({
    appointment_id: Joi.number().integer().positive().required(),
  }),
  predictNoShow: Joi.object({
    appointment_id: Joi.number().integer().positive().required(),
  }),
  reschedule: Joi.object({
    appointment_id: Joi.number().integer().positive().required(),
    reason: Joi.string().max(500).allow('', null),
  }),
};

// ── Validation middleware factory ──────────────────────────────────────────────

export function validate(schemaKey) {
  const schema = schemas[schemaKey];
  if (!schema) throw new Error(`Unknown validation schema: ${schemaKey}`);
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const messages = error.details.map((d) => d.message.replace(/['"]/g, '')).join('. ');
      return res.status(400).json({ error: messages });
    }
    req.body = value;
    next();
  };
}

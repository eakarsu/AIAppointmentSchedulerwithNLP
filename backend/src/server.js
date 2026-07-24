import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { generalLimiter, authLimiter, aiLimiter } from './middleware/rateLimiter.js';
import { sanitizeBody } from './middleware/validation.js';
import authRoutes from './routes/auth.js';
import appointmentRoutes from './routes/appointments.js';
import contactRoutes from './routes/contacts.js';
import categoryRoutes from './routes/categories.js';
import reminderRoutes from './routes/reminders.js';
import nlpRoutes from './routes/nlp.js';
import voiceRoutes from './routes/voice.js';
import settingsRoutes from './routes/settings.js';
import aiRoutes from './routes/ai.js';
import aiExtrasRoutes from './routes/aiExtras.js';
import aiBacklogRoutes from './routes/aiBacklog.js';
import adminRoutes from './routes/admin.js';
import analyticsRoutes from './routes/analytics.js';
import searchRoutes from './routes/search.js';
import customViewsRoutes from './routes/customViews.js';
import waitlistFillOptimizerRoutes from './routes/waitlistFillOptimizer.js';
import governedBookingsRoutes from './routes/governedBookings.js';
import runtimeAiRoutes from './routes/runtimeAi.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;
if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) throw new Error('CORS_ORIGIN is required in production');
if (process.env.NODE_ENV === 'production' && !process.env.DEFAULT_TENANT_ID) throw new Error('DEFAULT_TENANT_ID is required in production');

// Security headers
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS — env-driven origin list; defaults to localhost dev origins when not set
const rawCorsOrigins = process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173';
const corsOrigins = rawCorsOrigins
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const corsOptions = {
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin || corsOrigins.includes(origin) || corsOrigins.includes('*')) {
      return cb(null, true);
    }
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(sanitizeBody);

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Apply rate limiters
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/nlp', aiLimiter);
app.use('/api/ai', aiLimiter);
app.use('/api/ai-extras', aiLimiter);
app.use('/api', generalLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/runtime-ai', runtimeAiRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/reminders', reminderRoutes);
if (process.env.ENABLE_EXPERIMENTAL_AI === 'true') app.use('/api/nlp', nlpRoutes);
if (process.env.ENABLE_EXPERIMENTAL_AI === 'true') app.use('/api/voice', voiceRoutes);
app.use('/api/settings', settingsRoutes);
if (process.env.ENABLE_EXPERIMENTAL_AI === 'true') {
  app.use('/api/ai', aiRoutes);
  app.use('/api/ai-extras', aiExtrasRoutes);
  app.use('/api/ai-extras', aiBacklogRoutes);
}
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/custom-views', customViewsRoutes);
app.use('/api/waitlist-fill-optimizer', waitlistFillOptimizerRoutes);
app.use('/api/governed-bookings', governedBookingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Schema changes are explicit (npm run migrate), never startup side effects.
function startServer() {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log('API endpoints:');
      console.log('  - POST /api/auth/login');
      console.log('  - POST /api/auth/register');
      console.log('  - POST /api/auth/forgot-password');
      console.log('  - POST /api/auth/reset-password');
      console.log('  - PUT  /api/auth/change-password');
      console.log('  - GET  /api/auth/demo-credentials');
      console.log('  - GET  /api/appointments');
      console.log('  - POST /api/appointments/nlp');
      console.log('  - GET  /api/contacts');
      console.log('  - GET  /api/categories');
      console.log('  - GET  /api/reminders');
      console.log('  - POST /api/nlp/parse');
      console.log('  - POST /api/voice/process');
      console.log('  - GET  /api/settings');
      console.log('  - GET  /api/admin/users (admin only)');
      console.log('AI Features:');
      console.log('  - GET  /api/ai/summary');
      console.log('  - POST /api/ai/buffer/analyze');
      console.log('  - POST /api/ai/noshow/predict');
      console.log('  - POST /api/ai/reschedule/suggest');
      console.log('  - POST /api/ai/allocations/optimize');
    });
}

startServer();

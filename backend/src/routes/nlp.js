import { Router } from 'express';
import {
  getAllNlpLogs,
  getNlpLogById,
  parseText,
  getSuggestions,
  deleteNlpLog,
  chat,
  getInsights,
  matchContact,
  suggestAppointmentCategory,
  checkConflicts,
  suggestAppointmentReminders,
  generateTitle,
  getAIStatus
} from '../controllers/nlpController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

// AI Status - Check if AI is configured
router.get('/status', getAIStatus);

// NLP Logs
router.get('/logs', getAllNlpLogs);
router.get('/logs/:id', getNlpLogById);
router.delete('/logs/:id', deleteNlpLog);

// Core AI Features
router.post('/parse', parseText);
router.post('/suggestions', getSuggestions);
router.post('/chat', chat);
router.get('/insights', getInsights);

// Smart AI Features
router.post('/match-contact', matchContact);
router.post('/suggest-category', suggestAppointmentCategory);
router.post('/check-conflicts', checkConflicts);
router.post('/suggest-reminders', suggestAppointmentReminders);
router.post('/generate-title', generateTitle);

export default router;

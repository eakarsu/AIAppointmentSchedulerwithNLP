// Apply pass 5 — additive backlog routes mounted under /api/ai-extras.
//
// Env vars: OPENROUTER_API_KEY (required for AI; missing => 503 + missing: OPENROUTER_API_KEY).

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  cancellationPredict,
  satisfactionScore,
  optimalTimeSuggest,
} from '../controllers/aiBacklogController.js';

const router = Router();
router.use(authenticateToken);

// MECHANICAL
router.post('/cancellation-predict', cancellationPredict);

// PRODUCT-DECISION (rating 1-5 + free-text feedback)
router.post('/satisfaction-score', satisfactionScore);

// PRODUCT-DECISION (LLM-only travel estimate; no Maps creds)
router.post('/optimal-time-suggest', optimalTimeSuggest);

export default router;

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  tzReschedule,
  durationPredict,
  listDurationPredictions,
  calendarHeatmap,
  summarize,
  listTranscripts,
  analyzeAttendeeSentiment,
  listFeedback,
  recurringPatterns,
  meetingROI,
  listROI,
  teamConsensus,
} from '../controllers/aiExtrasController.js';

const router = Router();
router.use(authenticateToken);

// 1. Time-zone Smart Rescheduling
router.post('/tz-reschedule', tzReschedule);

// 2. Meeting Duration Predictor
router.post('/duration-predict', durationPredict);
router.get('/duration-predict', listDurationPredictions);

// 3. Calendar Heatmap (extended)
router.get('/heatmap', calendarHeatmap);

// 4. Meeting Transcript Summarizer
router.post('/summarize', summarize);
router.get('/summarize', listTranscripts);

// 5. Attendee Sentiment Checker
router.post('/sentiment', analyzeAttendeeSentiment);
router.get('/sentiment', listFeedback);

// 6. Smart Recurring Pattern detection
router.post('/recurring-patterns', recurringPatterns);

// 7. Meeting Value ROI
router.post('/roi', meetingROI);
router.get('/roi', listROI);

// 8. Cross-Team Calendar Consensus
router.post('/team-consensus', teamConsensus);

export default router;

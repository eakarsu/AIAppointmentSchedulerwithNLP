import { Router } from 'express';
import {
  // Buffer Time Optimizer
  getAllBufferAnalyses,
  analyzeAppointmentBuffer,
  applyBufferSuggestion,
  deleteBufferAnalysis,

  // No-Show Predictor
  getAllNoShowPredictions,
  predictAppointmentNoShow,
  updateNoShowOutcome,
  deleteNoShowPrediction,

  // Reschedule Suggester
  getAllRescheduleSuggestions,
  getRescheduleSuggestions,
  acceptRescheduleSuggestion,
  deleteRescheduleSuggestion,

  // Resource Allocator
  getAllResources,
  createResource,
  updateResource,
  deleteResource,
  getAllResourceAllocations,
  optimizeAllocations,
  deleteResourceAllocation,

  // Conflict Resolver
  resolveSchedulingConflicts,
  getAllConflictResolutions,

  // Summary
  getAIFeaturesSummary
} from '../controllers/aiController.js';

import {
  generateFollowUp,
  getFollowUpDrafts,
  scoreAppointment
} from '../controllers/aiExtrasNewController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = Router();

router.use(authenticateToken);

// AI Features Summary
router.get('/summary', getAIFeaturesSummary);

// ============================================
// Buffer Time Optimizer Routes
// ============================================
router.get('/buffer', getAllBufferAnalyses);
router.post('/buffer/analyze', validate('analyzeBuffer'), analyzeAppointmentBuffer);
router.put('/buffer/:id/apply', applyBufferSuggestion);
router.delete('/buffer/:id', deleteBufferAnalysis);

// ============================================
// No-Show Predictor Routes
// ============================================
router.get('/noshow', getAllNoShowPredictions);
router.post('/noshow/predict', validate('predictNoShow'), predictAppointmentNoShow);
router.put('/noshow/:id/outcome', updateNoShowOutcome);
router.delete('/noshow/:id', deleteNoShowPrediction);

// ============================================
// Reschedule Suggester Routes
// ============================================
router.get('/reschedule', getAllRescheduleSuggestions);
router.post('/reschedule/suggest', validate('reschedule'), getRescheduleSuggestions);
router.put('/reschedule/:id/accept', acceptRescheduleSuggestion);
router.delete('/reschedule/:id', deleteRescheduleSuggestion);

// ============================================
// Resource Allocator Routes
// ============================================
router.get('/resources', getAllResources);
router.post('/resources', validate('createResource'), createResource);
router.put('/resources/:id', updateResource);
router.delete('/resources/:id', deleteResource);

router.get('/allocations', getAllResourceAllocations);
router.post('/allocations/optimize', optimizeAllocations);
router.delete('/allocations/:id', deleteResourceAllocation);

// ============================================
// Conflict Resolver Routes
// ============================================
router.post('/conflicts/resolve', resolveSchedulingConflicts);
router.get('/conflicts', getAllConflictResolutions);

// ============================================
// Follow-Up Generator (NEW)
// ============================================
router.post('/followup/:id', generateFollowUp);
router.get('/followup', getFollowUpDrafts);

// ============================================
// AI Appointment Scoring (NEW)
// ============================================
router.post('/score/:id', scoreAppointment);

export default router;

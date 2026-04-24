import { Router } from 'express';
import {
  getAllVoiceCommands,
  getVoiceCommandById,
  processCommand,
  deleteVoiceCommand
} from '../controllers/voiceController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/', getAllVoiceCommands);
router.get('/:id', getVoiceCommandById);
router.post('/process', processCommand);
router.delete('/:id', deleteVoiceCommand);

export default router;

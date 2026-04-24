import { Router } from 'express';
import {
  getSettings,
  updateSettings,
  getAllSettings
} from '../controllers/settingsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/', getSettings);
router.put('/', updateSettings);
router.get('/all', getAllSettings);

export default router;

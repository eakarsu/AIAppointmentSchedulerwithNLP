import { Router } from 'express';
import {
  getAllReminders, getReminderById, createReminder, updateReminder, deleteReminder, bulkDeleteReminders
} from '../controllers/reminderController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/', getAllReminders);
router.get('/:id', getReminderById);
router.post('/', createReminder);
router.post('/bulk-delete', bulkDeleteReminders);
router.put('/:id', updateReminder);
router.delete('/:id', deleteReminder);

export default router;
